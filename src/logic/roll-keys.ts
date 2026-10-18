import type { CanonicalEffect } from './effects';
import { slugify } from './foundry';
import { formatBonus, resolveFormula } from './formula';

/**
 * Port of native 4.0.6 `ActorBaseSD._getActiveEffectKeys` (src/models/_ActorBaseSD.mjs)
 * over canonical serialized effects. It reads the Actor's applied effects
 * (Actor effects plus transferred Item effects that are active), resolves each
 * matching change value against roll data and aggregates ADD, then MULTIPLY,
 * then OVERRIDE across all effects. Situational effects are reported as options
 * and only count when selected. This is distinct from phased ActiveEffect
 * application to Actor data (see actor-preparation.ts).
 */
export interface RollKeyItem {
    id: string;
    name: string;
    propertyNames: string[];
    baseWeapon?: string;
    baseArmor?: string;
    isArmor?: boolean;
}

export interface RollKeyChange {
    key: string;
    type: string;
    value: number | string;
    effectName: string;
    effectRef: string;
    ownerItemId: string | null;
}

export interface SituationalOption { ref: string; name: string }

export interface RollKeyResult {
    value: number | string;
    changes: RollKeyChange[];
    situational: SituationalOption[];
    diagnostics: string[];
}

export interface RollKeyConfig {
    /** Selected situational effect refs (ActorEffect refs from collectEffects). */
    selected?: readonly string[];
    /** The `.this` item, when it differs from `item` (wand or scroll casts). */
    thisItemId?: string | null;
}

/** Native config.mjs PREDEFINED/selector keys only accept ADD/MULTIPLY/OVERRIDE here. */
const AGGREGATED = new Set(['add', 'multiply', 'override']);

export function selectorKeys(baseKey: string, item: RollKeyItem | null): { baseKeys: string[]; keys: string[] } {
    if (!baseKey.startsWith('system.')) baseKey = `system.${baseKey}`;
    const baseKeys = [baseKey];
    if (baseKey.startsWith('system.roll.melee') || baseKey.startsWith('system.roll.ranged')) {
        baseKeys.push(baseKey.replace(/^system\.roll\.(melee|ranged)\./, 'system.roll.attack.'));
    } else if (baseKey.startsWith('system.roll.stat.')) {
        baseKeys.push(baseKey.replace(/(str|dex|con|int|wis|cha)$/, 'all'));
    }
    const keys = [...baseKeys];
    for (const base of baseKeys) {
        if (!item) continue;
        const selectors = ['all', ...item.propertyNames];
        if (item.baseArmor) selectors.push(item.baseArmor);
        if (item.baseWeapon) selectors.push(item.baseWeapon);
        selectors.push(slugify(item.name));
        for (const selector of selectors) keys.push(`${base}.${slugify(selector)}`);
    }
    if (item?.isArmor) {
        for (const excluded of ['system.attributes.ac', 'system.attributes.ac.all']) {
            const index = keys.indexOf(excluded);
            if (index !== -1) keys.splice(index, 1);
        }
    }
    return { baseKeys, keys };
}

export function getActiveEffectKeys(effects: readonly CanonicalEffect[], rollData: unknown, baseKey: string,
    baseValue: number | string, item: RollKeyItem | null = null, config: RollKeyConfig = {}): RollKeyResult {
    const { baseKeys, keys } = selectorKeys(baseKey, item);
    const thisItemId = config.thisItemId ?? item?.id ?? null;
    const changes: RollKeyChange[] = [];
    const situational: SituationalOption[] = [];
    const diagnostics: string[] = [];
    for (const effect of effects) {
        if (!effect.applies) continue;
        for (const change of effect.changes) {
            const isItem = !!thisItemId && effect.owner.kind === 'item' && effect.owner.itemId === thisItemId
                && baseKeys.some(base => change.key === `${base}.this`);
            if (!keys.includes(change.key) && !isItem) continue;
            if (effect.situational) {
                if (!situational.some(option => option.ref === effect.ref)) situational.push({ ref: effect.ref, name: effect.name });
                if (!config.selected?.includes(effect.ref)) continue;
            }
            if (!AGGREGATED.has(change.type)) {
                diagnostics.push(`${effect.name}: "${change.type}" on ${change.key} is not used by native roll selectors.`);
                continue;
            }
            const resolved = resolveFormula(change.value, rollData);
            if (!resolved.ok) {
                diagnostics.push(`${effect.name}: ${change.key} is unsupported — ${resolved.reason}`);
                continue;
            }
            changes.push({ key: change.key, type: change.type, value: resolved.value, effectName: effect.name,
                effectRef: effect.ref, ownerItemId: effect.owner.kind === 'item' ? effect.owner.itemId ?? null : null });
        }
    }

    let finalValue: number | string = baseValue;
    let intParts = 0;
    let strParts = '';
    for (const change of changes.filter(entry => entry.type === 'add')) {
        if (typeof change.value === 'number' || (change.value !== '' && !Number.isNaN(Number(change.value)))) intParts += Number(change.value);
        else strParts += `+${change.value}`;
    }
    if (typeof finalValue === 'string' || strParts) {
        if (typeof finalValue === 'number') finalValue = formatBonus(finalValue + intParts);
        else finalValue = finalValue.concat(formatBonus(intParts));
        if (strParts) finalValue = finalValue.concat(strParts);
        finalValue = finalValue.trim().replace(/^\+\s*/, '');
    } else {
        finalValue += intParts;
    }

    let multiplier = 1;
    for (const change of changes.filter(entry => entry.type === 'multiply')) {
        const factor = Number(change.value);
        if (!Number.isFinite(factor)) { diagnostics.push(`${change.effectName}: MULTIPLY on ${change.key} needs a number.`); continue; }
        multiplier *= factor;
    }
    if (multiplier !== 1) finalValue = typeof finalValue === 'string' ? `(${finalValue})*${multiplier}` : finalValue * multiplier;

    for (const change of changes.filter(entry => entry.type === 'override')) finalValue = change.value;

    return { value: finalValue, changes, situational, diagnostics };
}

/** Numeric roll-key value, or null with the reason recorded. */
export function numericKey(result: RollKeyResult, label: string): number | null {
    if (typeof result.value === 'number') return result.value;
    const number = Number(result.value);
    if (result.value !== '' && Number.isFinite(number)) return number;
    result.diagnostics.push(`${label} resolved to "${result.value}", which is not a number.`);
    return null;
}
