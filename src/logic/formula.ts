import { finiteNumber, getProperty } from './foundry';

/**
 * Bounded equivalent of native `shadowdark.dice.resolveFormula` (src/dice/dice.mjs)
 * for serialized data, without Foundry's Roll class or `eval`.
 *
 * Supported syntax: numbers, `@data.path` references, + - * / %, parentheses,
 * floor/ceil/round/trunc/abs/sign/min/max and dice terms such as `d8`, `2d6`,
 * `2d20kh`, `1d6x`. A formula without dice resolves to a number; one with dice
 * resolves to a formula string with its references substituted. Anything else,
 * including a missing reference, is an explicit failure — never a guessed zero.
 */
export type FormulaResult =
    | { ok: true; value: number; deterministic: true }
    | { ok: true; value: string; deterministic: false }
    | { ok: false; reason: string };

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
    floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc,
    abs: Math.abs, sign: Math.sign, min: Math.min, max: Math.max,
};
const DICE = /^\d*d\d+(?:(?:kh|kl|k|x|xo)\d*)?$/i;
const TOKEN = /\d*d\d+(?:(?:kh|kl|k|x|xo)\d*)?|\d+(?:\.\d+)?|[a-z]+|[()+\-*/%,]/gi;

/** Replace `@path` references; a missing or non-scalar reference is a failure. */
export function replaceFormulaData(formula: string, data: unknown): { ok: true; value: string } | { ok: false; reason: string } {
    let failure: string | null = null;
    const value = formula.replace(/@([a-z0-9_.-]+)/gi, (_match, path: string) => {
        const found = getProperty(data, path);
        const number = typeof found === 'number' && Number.isFinite(found) ? found : null;
        if (number !== null) return number < 0 ? `(${number})` : String(number);
        if (typeof found === 'string' && found.trim() && !found.includes('@')) return `(${found.trim()})`;
        failure ??= `Formula reference @${path} is unavailable on this Actor.`;
        return '0';
    });
    return failure ? { ok: false, reason: failure } : { ok: true, value };
}

export function resolveFormula(raw: unknown, data: unknown = {}, options: { forceDeterministic?: boolean } = {}): FormulaResult {
    if (typeof raw === 'number') return Number.isFinite(raw) ? { ok: true, value: raw, deterministic: true }
        : { ok: false, reason: 'Formula value is not a finite number.' };
    if (typeof raw === 'boolean') return { ok: false, reason: 'Boolean values are not formulas.' };
    if (typeof raw !== 'string' || !raw.trim()) return { ok: false, reason: 'Formula is empty.' };
    if (raw.length > 256) return { ok: false, reason: 'Formula exceeds the supported length.' };
    const replaced = replaceFormulaData(raw, data);
    if (!replaced.ok) return replaced;
    const expression = replaced.value.replace(/\s+/g, '');
    const tokens = expression.match(TOKEN) ?? [];
    if (!tokens.length || tokens.join('') !== expression) {
        return { ok: false, reason: `Unsupported formula syntax: ${raw}` };
    }
    const hasDice = tokens.some(token => DICE.test(token));
    let index = 0;
    const fail = (): never => { throw new Error(`Unsupported formula syntax: ${raw}`); };
    // Parse once for validation; numeric evaluation only when no dice are present.
    const primary = (depth: number): number => {
        if (depth > 32) fail();
        const token = tokens[index++];
        if (token === undefined) return fail();
        if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * primary(depth + 1);
        if (token === '(') { const value = additive(depth + 1); if (tokens[index++] !== ')') fail(); return value; }
        if (DICE.test(token)) return NaN;
        const fn = FUNCTIONS[token.toLowerCase()];
        if (fn) {
            if (tokens[index++] !== '(') fail();
            const args = [additive(depth + 1)];
            while (tokens[index] === ',') { index++; args.push(additive(depth + 1)); }
            if (tokens[index++] !== ')') fail();
            if (['min', 'max'].includes(token.toLowerCase()) ? args.length < 1 : args.length !== 1) fail();
            return fn(...args);
        }
        if (!/^\d/.test(token)) fail();
        return Number(token);
    };
    const multiplicative = (depth: number): number => {
        let value = primary(depth);
        while (['*', '/', '%'].includes(tokens[index])) {
            const op = tokens[index++], next = primary(depth);
            value = op === '*' ? value * next : op === '/' ? value / next : value % next;
        }
        return value;
    };
    const additive = (depth: number): number => {
        let value = multiplicative(depth);
        while (tokens[index] === '+' || tokens[index] === '-') {
            const op = tokens[index++], next = multiplicative(depth);
            value = op === '+' ? value + next : value - next;
        }
        return value;
    };
    let result: number;
    try { result = additive(0); if (index !== tokens.length) fail(); }
    catch (error) { return { ok: false, reason: (error as Error).message }; }
    if (hasDice) {
        if (options.forceDeterministic) return { ok: false, reason: `Formula is not deterministic: ${raw}` };
        return { ok: true, value: expression, deterministic: false };
    }
    if (!Number.isFinite(result)) return { ok: false, reason: `Formula does not resolve to a finite number: ${raw}` };
    if (options.forceDeterministic && !Number.isInteger(result)) {
        return { ok: false, reason: `Formula does not resolve to an integer: ${raw}` };
    }
    return { ok: true, value: result, deterministic: true };
}

/** Native `formatBonus` in compact form: 0 → "", 2 → "+2", "1d4" → "+1d4". */
export function formatBonus(bonus: number | string): string {
    if (typeof bonus === 'number') return bonus === 0 ? '' : bonus > 0 ? `+${bonus}` : `-${Math.abs(bonus)}`;
    const trimmed = bonus.trim();
    if (!trimmed) return '';
    return trimmed.startsWith('+') || trimmed.startsWith('-') ? trimmed : `+${trimmed}`;
}

/** Numeric value for the resolved part of a formula, or null. */
export function deterministicNumber(raw: unknown, data: unknown = {}): number | null {
    const result = resolveFormula(raw, data);
    return result.ok && result.deterministic ? result.value : finiteNumber(null);
}
