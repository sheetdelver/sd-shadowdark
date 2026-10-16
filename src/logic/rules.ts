import { finiteNumber } from './foundry';
import { canonicalUuid } from './identity';

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
 * Standard Shadowdark language classification
 */
export const SHADOWDARK_LANGUAGES = {
    common: [
        'common', 'dwarvish', 'elvish', 'giant', 'goblin',
        'merran', 'orcish', 'reptilian', 'sylvan', 'thanian'
    ],
    rare: [
        'celestial', 'diabolic', 'draconic', 'primordial'
    ]
};

/**
 * Helper to determine if a language is considered rare.
 */
export const isRareLanguage = (name: string): boolean => {
    const lower = (name || '').toLowerCase();
    if (SHADOWDARK_LANGUAGES.rare.some(r => lower.includes(r))) return true;
    if (SHADOWDARK_LANGUAGES.common.some(c => lower.includes(c))) return false;

    // Default system fallback for unknown languages
    return false;
};

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

/** Exact reference match on canonical UUIDs (no suffix or name matching). */
const sameIdentity = (a: unknown, b: unknown): boolean => {
    const left = canonicalUuid(a), right = canonicalUuid(b);
    return !!left && left === right;
};

/**
 * Calculates language selection limits based on class and ancestry.
 */
export const getLanguageLimits = (actor: any, systemData?: any, collections?: any) => {
    const items = actor.items || [];
    const findItem = (type: string) => items.find((i: any) => (i.type || "").toLowerCase() === type.toLowerCase());

    const classObj = findItem('class');
    const ancestryObj = findItem('ancestry');
    const backgroundObj = findItem('background');

    // Embedded item first, otherwise the exact referenced collection document.
    const getLangConfig = (embeddedItem: any, uuid: string | undefined, systemList: any[] | undefined) => {
        const fromItem = embeddedItem?.system?.languages;
        if (fromItem && Object.keys(fromItem).length > 0) return fromItem;
        if (!uuid || !systemList) return {};
        const found = systemList.find((s: any) => sameIdentity(s.uuid, uuid));
        return found?.system?.languages || found?.languages || {};
    };

    const cl = getLangConfig(classObj, actor.system?.class, collections?.classes || systemData?.classes);
    const al = getLangConfig(ancestryObj, actor.system?.ancestry, collections?.ancestries || systemData?.ancestries);
    const bl = getLangConfig(backgroundObj, actor.system?.background, collections?.backgrounds || systemData?.backgrounds);

    const allFixed = Array.from(new Set([
        ...(cl.fixed || []),
        ...(al.fixed || []),
        ...(bl.fixed || [])
    ]));

    const allSelectOptions = Array.from(new Set([
        ...(cl.selectOptions || []),
        ...(al.selectOptions || []),
        ...(bl.selectOptions || [])
    ]));

    const languages = collections?.languages || systemData?.languages;
    const countRarity = (pool: any[], counter: { common: number, rare: number }) => {
        for (const f of pool) {
            const lang = languages?.find((l: any) => l.name === f || sameIdentity(l.uuid, f));
            const name = lang?.name || (typeof f === 'string' ? f : '');
            if (isRareLanguage(name)) {
                counter.rare++;
            } else {
                counter.common++;
            }
        }
    };

    const fixedCounts = { common: 0, rare: 0 };
    const optionCounts = { common: 0, rare: 0 };

    countRarity(allFixed, fixedCounts);
    countRarity(allSelectOptions, optionCounts);

    // If limits were explicitly defined by the old integer system, use them.
    // Otherwise, infer slots from the new `selectOptions` array (assuming 1 slot per rarity pool presented, which is standard for Shadowdark classes granting specific localized choices).
    // E.g., if a class gives [Diabolic, Celestial] in selectOptions, it grants 1 rare choice pool.

    const fallbackCommonSelect = optionCounts.common > 0 ? 1 : 0;
    const fallbackRareSelect = optionCounts.rare > 0 ? 1 : 0;

    // Core rule: Every player gets 'Common' (1) and +1 for each point of INT mod.
    const intMod = finiteNumber(actor.derived?.abilities?.int?.mod ?? actor.computed?.abilities?.int?.mod) ?? 0;
    const playerBaseCommon = (actor.type === "Player" || actor.type === "Character") ? (1 + Math.max(0, intMod)) : 0;

    const baseCommon = playerBaseCommon +
        (Number(cl.common) || 0) + (Number(al.common) || 0) + (Number(bl.common) || 0) +
        (Number(cl.select) || 0) + (Number(al.select) || 0) + (Number(bl.select) || Number(fallbackCommonSelect));

    const baseRare = (Number(cl.rare) || 0) + (Number(al.rare) || 0) + (Number(bl.rare) || Number(fallbackRareSelect));

    const calculatedMaxCommon = baseCommon + fixedCounts.common;
    const calculatedMaxRare = baseRare + fixedCounts.rare;

    // Calculate current languages possessed to establish a floor limit. This prevents regressions
    // where dynamically granted or legacy languages exceed the strict static calculation limits.
    const currentLanguages = actor.system?.languages || [];
    let currentCommon = 0;
    let currentRare = 0;

    for (const id of currentLanguages) {
        const lang = languages?.find((l: any) => sameIdentity(l.uuid, id) || l.name === id);
        const name = lang?.name || (typeof id === 'string' ? id : '');
        if (isRareLanguage(name)) {
            currentRare++;
        } else {
            currentCommon++;
        }
    }

    return {
        maxCommon: Math.max(calculatedMaxCommon, currentCommon),
        maxRare: Math.max(calculatedMaxRare, currentRare)
    };
};

/** Native ClassSD.isCastingClass: a class casts when its spellcasting ability is set. */
export const isClassSpellcaster = (classItem: any): boolean =>
    !!classItem && classItem.type === 'Class' && !!classItem.system?.spellcasting?.ability;
