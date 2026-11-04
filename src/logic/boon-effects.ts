import { NATIVE_PREDEFINED_EFFECTS, NATIVE_REJECTED_PREDEFINED } from '../data/native-predefined-effects';
import { MODE_TO_TYPE } from './foundry';
import { createEffect } from '../utils/Sanitizer';

/** Shared explicit authoring used by the sheet's custom-boon form and GM builder. */
export interface BoonEffectRow { key: string; type: number; value: string; label: string; icon: string; disabled?: boolean }
export const BOON_EFFECT_PRESETS = Object.entries(NATIVE_PREDEFINED_EFFECTS)
    .filter(([id, entry]) => !NATIVE_REJECTED_PREDEFINED[id] && !entry.restriction && !entry.key.includes('REPLACEME') && entry.value !== 'REPLACEME')
    .sort(([, a], [, b]) => a.label.localeCompare(b.label));

export function boonEffectErrors(rows?: BoonEffectRow[]): Record<string, string> {
    if (rows === undefined) return {};
    if (!Array.isArray(rows) || rows.length > 20) return { 'boon.effects': 'Use at most 20 effects.' };
    const errors: Record<string, string> = {};
    rows.forEach((row, i) => {
        const prefix = `boon.effects.${i}`;
        if (!row || typeof row !== 'object') { errors[prefix] = 'Choose or enter an effect.'; return; }
        if (typeof row.label !== 'string' || !row.label.trim() || row.label.length > 200) errors[`${prefix}.label`] = 'Enter an effect name (up to 200 characters).';
        if (typeof row.key !== 'string' || !row.key.trim() || row.key.length > 200 || row.key.includes('REPLACEME')
            || row.key.trim().split('.').some(part => !part || ['__proto__', 'constructor', 'prototype'].includes(part))) errors[`${prefix}.key`] = 'Enter a complete effect key without unresolved choices.';
        if (!Number.isInteger(row.type) || !Object.hasOwn(MODE_TO_TYPE, row.type)) errors[`${prefix}.type`] = 'Choose a supported operation.';
        if (typeof row.value !== 'string' || row.value.length > 1000) errors[`${prefix}.value`] = 'Enter an effect value (up to 1,000 characters).';
        if (typeof row.icon !== 'string' || row.icon.length > 2048) errors[prefix] = 'Choose a valid effect icon.';
        if (row.disabled !== undefined && typeof row.disabled !== 'boolean') errors[prefix] = 'Choose whether this effect is enabled.';
    });
    return errors;
}

export function buildBoonEffects(rows: BoonEffectRow[] = [], sourceName: string): any[] {
    if (Object.keys(boonEffectErrors(rows)).length) throw new Error('Correct the boon effects.');
    return rows.map(row => createEffect(row.label.trim(), row.icon,
        [{ key: row.key.trim(), mode: row.type, value: row.value }], { sourceName, disabled: row.disabled === true }));
}
