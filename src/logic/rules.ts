import { finiteNumber } from './foundry';

/**
 * Shadowdark helpers that are not part of Actor preparation. Effective
 * statistics, AC, slots, effects, spellcasting and actions are prepared once in
 * actor-preparation.ts / actions.ts / prepared-view.ts; nothing here recomputes them.
 */

/** Core consumes the prepared initiative unchanged when no GM override exists. */
export function getInitiativeFormula(actor: any): string {
    const prepared = actor?.derived?.initiative ?? actor?.computed?.initiative;
    const value = finiteNumber(prepared?.value);
    const advantage = finiteNumber(prepared?.advantage);
    if (value === null || advantage === null) return '1d20';
    const baseDie = advantage > 0 ? '2d20kh1' : advantage < 0 ? '2d20kl1' : '1d20';
    return `${baseDie}${value >= 0 ? '+' : ''}${value}`;
}

/**
 * XP and Talent Rules
 */

/** PlayerSheetSD: xpNextLevel = level * 10. */
export const calculateXPForLevel = (level: number): number => {
    return level * 10;
};

export const calculateXPCarryover = (currentXP: number, currentLevel: number): number => {
    if (currentLevel === 0) return 0;
    return currentXP - (currentLevel * 10);
};

export const shouldGainTalent = (targetLevel: number): boolean => {
    return targetLevel % 2 !== 0;
};

/** Native ClassSD.isCastingClass: a class casts when its spellcasting ability is set. */
export const isClassSpellcaster = (classItem: any): boolean =>
    !!classItem && classItem.type === 'Class' && !!classItem.system?.spellcasting?.ability;
