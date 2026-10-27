import type { PreparedActorCore } from './actor-preparation';

/** Shadowdark core rules, Level Advancement (p. 39); Player creation/advancement only. */
export const MAX_CHARACTER_LEVEL = 10;

/** Native 4.0.6 starting wealth, shared by advancement and Creator controls. */
export const STARTING_GOLD = { formula: '2d6 * 5', label: '2d6 × 5', max: 60 } as const;

/** Native 4.0.6 LevelUpSD._finalizeLevelUp, after preparing the new grants. */
export function advancementHitPoints(prepared: PreparedActorCore, targetLevel: number, hitDieTotal: number) {
    if (!Number.isFinite(hitDieTotal) || hitDieTotal <= 0) throw new Error('A positive hit-point roll is required.');
    if (targetLevel === 1) {
        const hp = Math.max(1, hitDieTotal + prepared.abilities.con.mod);
        return { value: hp, max: hp };
    }
    return { value: prepared.hp.value + hitDieTotal, max: prepared.hp.max + hitDieTotal };
}
