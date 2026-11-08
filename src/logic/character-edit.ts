import { ABILITY_KEYS } from './actor-preparation';

/** Source fields only. Do not seed edits from derived scores or maximum HP. */
export function characterEditValues(actor: any): Record<string, string> {
    return {
        name: String(actor?.name ?? ''),
        ...Object.fromEntries(ABILITY_KEYS.map(key => [key, String(actor?.system?.abilities?.[key]?.value ?? '')])),
        hp: String(actor?.system?.attributes?.hp?.max ?? ''),
    };
}

/** Native 4.0.6 PlayerSD/ActorBaseSD: integer, minimum zero, no score/HP ceiling. */
export function characterEditErrors(values: Record<string, string>): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!values.name?.trim()) errors.name = 'Enter a character name.';
    for (const key of [...ABILITY_KEYS, 'hp']) {
        if (!/^\d+$/.test(values[key] ?? '') || !Number.isSafeInteger(Number(values[key]))) {
            errors[key] = 'Enter a whole number of zero or higher.';
        }
    }
    return errors;
}

/** One sparse actor patch; never replace system, effects, items or current HP. */
export function characterEditPatch(before: Record<string, string>, after: Record<string, string>): Record<string, unknown> {
    if (Object.keys(characterEditErrors(after)).length) return {};
    const patch: Record<string, unknown> = {};
    if (after.name.trim() !== before.name) patch.name = after.name.trim();
    for (const key of ABILITY_KEYS) {
        if (Number(after[key]) !== Number(before[key])) patch[`system.abilities.${key}.value`] = Number(after[key]);
    }
    if (Number(after.hp) !== Number(before.hp)) patch['system.attributes.hp.max'] = Number(after.hp);
    return patch;
}
