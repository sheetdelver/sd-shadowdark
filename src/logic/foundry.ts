/**
 * Environment-neutral equivalents of the Foundry primitives native Shadowdark
 * 4.0.6 relies on. Source: Foundry 14.367 common/primitives/string.mjs (slugify),
 * common/documents/active-effect.mjs (#MODES_TO_TYPES) and common/constants.mjs
 * (ACTIVE_EFFECT_CHANGE_TYPES default priorities). No Foundry globals are used.
 */

/** Numeric legacy `mode` → v14 string `type` (BaseActiveEffect.#MODES_TO_TYPES). */
export const MODE_TO_TYPE: Readonly<Record<number, string>> = Object.freeze({
    0: 'custom', 1: 'multiply', 2: 'add', 3: 'downgrade', 4: 'upgrade', 5: 'override',
});

/** v14 string `type` → legacy numeric `mode` (#TYPES_TO_MODES plus `custom.<n>`). */
export function typeToMode(type: string): number | null {
    const found = Object.entries(MODE_TO_TYPE).find(([, name]) => name === type);
    if (found) return Number(found[0]);
    const custom = /^custom\.(-?\d+)$/.exec(type);
    return custom ? Number(custom[1]) : null;
}

/** Legacy mode → type, keeping unknown numbers as `custom.<n>` like Foundry. */
export function modeToType(mode: number): string {
    return MODE_TO_TYPE[mode] ?? `custom.${mode}`;
}

/** CONST.ACTIVE_EFFECT_CHANGE_TYPES default priorities. */
export const CHANGE_TYPE_PRIORITY: Readonly<Record<string, number>> = Object.freeze({
    custom: 0, multiply: 10, add: 20, subtract: 20, downgrade: 30, upgrade: 40, override: 50,
});

export const CHANGE_PHASES = ['initial', 'final'] as const;

/**
 * Foundry `String#slugify()` with default options (lowercase, `-`, not strict).
 * Foundry first transliterates through its CHAR_MAP; NFKD diacritic removal is
 * the bounded equivalent used here and is documented as such.
 */
export function slugify(value: string): string {
    return String(value).normalize('NFKD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[\s-]+/g, '-');
}

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

export function getProperty(source: unknown, path: string): unknown {
    if (!path) return source;
    let current: any = source;
    for (const part of path.split('.')) {
        if (UNSAFE_KEYS.has(part) || current === null || current === undefined || typeof current !== 'object') return undefined;
        current = current[part];
    }
    return current;
}

export function setProperty(target: Record<string, any>, path: string, value: unknown): boolean {
    const parts = path.split('.');
    if (!parts.length || parts.some(part => !part || UNSAFE_KEYS.has(part))) return false;
    let current: any = target;
    for (const part of parts.slice(0, -1)) {
        if (current[part] === null || current[part] === undefined) current[part] = {};
        if (typeof current[part] !== 'object') return false;
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
    return true;
}

export function finiteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

/** Compact signed display, e.g. 0 → "+0", -1 → "-1". */
export function signedString(value: number): string {
    return `${value >= 0 ? '+' : ''}${value}`;
}

export function clone<T>(value: T): T {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
}
