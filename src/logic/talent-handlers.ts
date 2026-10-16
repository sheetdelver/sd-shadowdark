import { NATIVE_PREDEFINED_EFFECTS } from '../data/native-predefined-effects';
import { createEffect } from '../utils/Sanitizer';
import { applyMasteryChoice, masteryKind, pendingChoiceKind, type ChoiceCatalog } from './talent-choices';

/**
 * Level-up/generation selection handlers. Native 4.0.6 talent tables return
 * talent documents that already carry their native effects; these handlers only
 * collect explicit player choices the module UI offers (stat selections, mastery
 * choices, an extra spell). They never synthesize effects by name or with
 * pre-4.0 keys: stat choices use the native predefined `abilityImprovement*`
 * definitions (`system.abilities.<key>.value`, ADD).
 */
export interface TalentHandler {
    id: string;
    description: string;
    matches: (item: any) => boolean;
    onRoll?: (context: any) => void | boolean;
    action?: 'stat-selection' | 'stat-pool' | 'weapon-mastery' | 'armor-mastery' | 'extra-spell' | 'language-selection';
    config?: any;
    onInit?: (context: { actor: any, targetLevel: number }) => { requiredTalents?: number; choiceRolls?: number };
    isBlocked?: (state: any) => boolean;
    resolveItems?: (state: any, targetLevel: number, resolveDocFn?: (uuid: string) => Promise<any>, catalog?: ChoiceCatalog) => Promise<any[]>;
    mutateItem?: (item: any, state: any) => void;
}

const ABILITY_EFFECT: Record<string, string> = {
    str: 'abilityImprovementStr', dex: 'abilityImprovementDex', con: 'abilityImprovementCon',
    int: 'abilityImprovementInt', wis: 'abilityImprovementWis', cha: 'abilityImprovementCha',
};

/** Native predefined ability improvement as an effect with the chosen amount. */
function abilityImprovementEffect(stat: string, amount: number, sourceName: string) {
    const definition = NATIVE_PREDEFINED_EFFECTS[ABILITY_EFFECT[stat]];
    if (!definition) throw new Error(`Unknown ability ${stat}.`);
    return createEffect(definition.label, definition.icon, [{ key: definition.key, mode: definition.mode, value: amount }], { sourceName });
}

function distributeAllocations(item: any, state: any, sourceName: string) {
    const allocated = state.statPool?.allocated ?? {};
    item.effects = (Array.isArray(item.effects) ? item.effects : []).filter((effect: any) =>
        effect?.flags?.shadowdark?.sourceName !== sourceName);
    for (const [stat, raw] of Object.entries(allocated)) {
        const value = Number(raw);
        if (value > 0) item.effects.push(abilityImprovementEffect(stat, value, sourceName));
    }
}

const SPELL_CLASS_FROM_NAME = /\blearn(?:\s+an?)?(?:\s+extra)?\s+(\w+)\s+spell\b/i;

/** Resolve a fixed mastery template for a selection using the declared-data catalog. */
async function masteryTemplate(kind: 'weapon' | 'armor', state: any, targetLevel: number,
    resolveDocFn?: (uuid: string) => Promise<any>, catalog?: ChoiceCatalog) {
    const selection = kind === 'weapon' ? state.weaponMasterySelection : state.armorMasterySelection;
    if (!selection?.selected?.length || !resolveDocFn) return [];
    const uuid = kind === 'weapon' ? 'Compendium.shadowdark.talents.Item.5bpWuaT0KTNzuzCu' : 'Compendium.shadowdark.talents.Item.BsRPGhKXYwJBI9ex';
    const doc = await resolveDocFn(uuid);
    if (!doc) throw new Error(`The native ${kind === 'weapon' ? 'Weapon' : 'Armor'} Mastery talent (${uuid}) is unavailable.`);
    const template = JSON.parse(JSON.stringify(doc));
    delete template._id;
    template.system = { ...(template.system ?? {}), level: targetLevel };
    return [applyMasteryChoice(template, selection.selected[0], kind, catalog ?? {})];
}

export const TALENT_HANDLERS: TalentHandler[] = [
    {
        id: 'stat-improvement',
        description: "Gain +1 to two stats",
        matches: (item: any) => {
            const text = (item.text || item.name || item.description || "").toLowerCase();
            return text.includes("+1 point to two stats") || text.includes("+1 to two stats");
        },
        action: 'stat-selection',
        config: { required: 2 },
        mutateItem: (item: any, state: any) => {
            const selected: string[] = state.statSelection?.selected ?? [];
            if (!selected.length) return;
            item.effects = (Array.isArray(item.effects) ? item.effects : []).filter((effect: any) =>
                effect?.flags?.shadowdark?.sourceName !== 'Stat Improvement');
            for (const stat of selected) item.effects.push(abilityImprovementEffect(stat, 1, 'Stat Improvement'));
        }
    },
    {
        id: 'stat-distribution',
        description: "Distribute +2 points across any stats",
        matches: (item: any) => {
            if (item.name === "Distribute to Stats") return true;
            const text = (item.text || item.description || "").toLowerCase();
            return text.includes("distribute") && text.includes("+2") && text.includes("stat");
        },
        action: 'stat-pool',
        config: { total: 2 },
        mutateItem: (item: any, state: any) => {
            if (state.statPool && state.statPool.total > 0) distributeAllocations(item, state, 'Stat Distribution');
        }
    },
    {
        id: 'stat-distribution-warlock',
        description: "Distribute +2 points (max 1 per stat)",
        matches: (item: any) => item.name === "Distribute to Stats (Warlock)",
        action: 'stat-pool',
        config: { total: 2, maxPerStat: 1 },
        mutateItem: (item: any, state: any) => {
            if (state.statPool && state.statPool.total > 0) distributeAllocations(item, state, 'Stat Distribution (Warlock)');
        }
    },
    {
        id: 'weapon-mastery',
        description: "Choose one type of weapon",
        matches: (item: any) => masteryKind(item) === 'weapon' || pendingChoiceKind(item) === 'weapon'
            || String(item?.name ?? item?.text ?? '').toLowerCase() === 'weapon mastery',
        action: 'weapon-mastery',
        config: { required: 1 },
        resolveItems: (state, targetLevel, resolveDocFn, catalog) => masteryTemplate('weapon', state, targetLevel, resolveDocFn, catalog),
    },
    {
        id: 'armor-mastery',
        description: "Choose one type of armor",
        matches: (item: any) => masteryKind(item) === 'armor' || pendingChoiceKind(item) === 'armor'
            || String(item?.name ?? item?.text ?? '').toLowerCase() === 'armor mastery',
        action: 'armor-mastery',
        config: { required: 1 },
        resolveItems: (state, targetLevel, resolveDocFn, catalog) => masteryTemplate('armor', state, targetLevel, resolveDocFn, catalog),
    },
    {
        id: 'extra-spell-handler',
        description: "Learn an extra spell",
        matches: (item: any) => SPELL_CLASS_FROM_NAME.test(String(item.name || item.text || item.description || '')),
        action: 'extra-spell',
        config: { active: true, count: 1 },
        // Native "Learn … Spell" talents have no effects; the selected spell is the
        // only grant. No spellcasting class is added on the player's behalf.
    },
    {
        id: 'generic-choice',
        description: "Parse 'Choose one' or 'X or Y' talents",
        matches: (item: any) => {
            const name = (item.name || "").toLowerCase();
            const text = (item.text || item.description || "").toLowerCase();
            const regex = /(?:choose|select)\s+(?:one|1)|\s+or\s+/i;
            return regex.test(name) || regex.test(text);
        },
        action: undefined,
    }
];

/** The spell class named by a "Learn … Spell" talent, used only to filter the offered list. */
export function extraSpellClassName(item: any): string | null {
    const name = SPELL_CLASS_FROM_NAME.exec(String(item?.name || item?.text || item?.description || ''))?.[1]?.toLowerCase() ?? null;
    return name && name !== 'extra' ? name : null;
}
