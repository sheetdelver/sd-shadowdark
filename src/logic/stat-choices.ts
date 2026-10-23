import { NATIVE_PREDEFINED_EFFECTS } from '../data/native-predefined-effects';
import { createEffect } from '../utils/Sanitizer';

export const STAT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type StatAllocation = Record<string, number>;
export interface StatChoiceRule { total: number; maxPerStat: number }

/** Explicit distribution instructions; fixed native +1/+2 Items retain their own effects. */
export function statChoiceRule(item: any): StatChoiceRule | null {
    const name = String(item?.name ?? item?.text ?? '').trim();
    if (name === 'Distribute to Stats (Warlock)' || /\+1(?: point)? to two stats/i.test(name)) return { total: 2, maxPerStat: 1 };
    if (name === 'Distribute to Stats') return { total: 2, maxPerStat: 2 };
    const text = String(item?.text ?? item?.description ?? '');
    return /distribute/i.test(text) && /\+2/.test(text) && /stat/i.test(text) ? { total: 2, maxPerStat: 2 } : null;
}

export function validStatAllocation(rule: StatChoiceRule, value: unknown): value is StatAllocation {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const entries = Object.entries(value);
    return entries.every(([stat, points]) => STAT_KEYS.includes(stat as typeof STAT_KEYS[number])
        && typeof points === 'number' && Number.isInteger(points) && points >= 0 && points <= rule.maxPerStat)
        && entries.reduce((sum, [,points]) => sum + Number(points), 0) === rule.total;
}

/** One effect set per independent grant; never apply an aggregate pool to every Item. */
export function applyStatAllocation(item: any, allocation: StatAllocation): any {
    const rule = statChoiceRule(item);
    if (!rule || !validStatAllocation(rule, allocation)) throw new Error(`Allocate exactly ${rule?.total ?? 2} points for ${item.name}, at most ${rule?.maxPerStat ?? 2} per stat.`);
    const copy = JSON.parse(JSON.stringify(item));
    copy.effects = (copy.effects ?? []).filter((effect: any) => !['Stat Improvement', 'Stat Distribution', 'Stat Distribution (Warlock)'].includes(effect.flags?.shadowdark?.sourceName));
    for (const stat of STAT_KEYS) if (allocation[stat]) {
        const definition = NATIVE_PREDEFINED_EFFECTS['abilityImprovement' + stat[0].toUpperCase() + stat.slice(1)];
        copy.effects.push(createEffect(definition.label, definition.icon,
            [{ key: definition.key, mode: definition.mode, value: allocation[stat] }], { sourceName: 'Stat Distribution' }));
    }
    return copy;
}
