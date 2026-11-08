import { canonicalUuid, sourceRef, formatUuid } from './identity';

export const SPELL_CLASSES = {
    priest: 'Compendium.shadowdark.classes.Item.oZWzXx1WRLg286zD',
    wizard: 'Compendium.shadowdark.classes.Item.035nuVkU9q2wtMPs',
    witch: 'Compendium.shadowdark.classes.Item.KGnBAFiTiLHZJUND',
    seer: 'Compendium.shadowdark.classes.Item.xdjod5gPhNPIkLth',
} as const;
type GrantRule = { classUuid: string | null; tier: 'known' | 'half-level'; label: string };
/** Pinned native 4.0.6 Talent identities, not name/description recognition. */
export const SPELL_CHOICE_GRANTS: Readonly<Record<string, GrantRule>> = {
    'Compendium.shadowdark.talents.Item.mgRrWET5MEaGLVNo': { classUuid: SPELL_CLASSES.wizard, tier: 'half-level', label: 'Shune: wizard spell' },
    'Compendium.shadowdark.talents.Item.T5nkdUM75LSnDpu5': { classUuid: SPELL_CLASSES.wizard, tier: 'known', label: 'Additional wizard spell' },
    'Compendium.shadowdark.talents.Item.ZYZkbENdQAiNsEL6': { classUuid: SPELL_CLASSES.witch, tier: 'known', label: 'Additional witch spell' },
    'Compendium.shadowdark.talents.Item.LaRNVk9FZkrM1nSJ': { classUuid: SPELL_CLASSES.seer, tier: 'known', label: 'Additional seer spell' },
    'Compendium.shadowdark.talents.Item.Ey3P0EplF5SHIdey': { classUuid: null, tier: 'known', label: 'Additional known-list spell' },
};
export const FIXED_SPELL_GRANTS: Readonly<Record<string, string>> = {
    'Compendium.shadowdark.talents.Item.LfHTnYW8I65x8Y31': 'Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH',
};
export function grantSource(item: any): string | null {
    const origin = sourceRef(item);
    return origin ? formatUuid(origin) : canonicalUuid(item?.documentUuid ?? item?.uuid);
}
export const spellChoiceGrant = (item: any): GrantRule | null => SPELL_CHOICE_GRANTS[grantSource(item) ?? ''] ?? null;
export interface SpellGrantContext { level: number; known: any[]; classDoc?: any }
const classesOf = (spell: any): string[] => (Array.isArray(spell.system?.class) ? spell.system.class : []).map(canonicalUuid).filter(Boolean);
export function grantChoiceClasses(rule: GrantRule, context: SpellGrantContext): string[] {
    if (rule.classUuid) return [rule.classUuid];
    const cls = context.classDoc;
    const base = canonicalUuid(cls?.system?.spellcasting?.class || cls?.uuid);
    return [...new Set([...context.known.filter(item => item.type === 'Spell').flatMap(classesOf),
        ...(cls?.system?.spellcasting?.ability && base ? [base] : [])])];
}
/** User-selected SheetDelver interpretation; see docs/rules/spell-grants.md. */
export const shuneSpellTier = (level: number) => Math.max(1, Math.floor(level / 2));
/** Eligible casting lists for this exact choice, including its tier allowance. */
export function spellGrantClasses(grant: any, spell: any, context: SpellGrantContext): string[] {
    const rule = spellChoiceGrant(grant);
    if (!rule || spell?.type !== 'Spell') return [];
    const tier = Number(spell.system?.tier);
    if (!Number.isInteger(tier) || tier < 1 || tier > 5) return [];
    const lists = grantChoiceClasses(rule, context).filter(uuid => classesOf(spell).includes(uuid));
    if (rule.tier === 'half-level') return tier === shuneSpellTier(context.level) ? lists : [];
    const cls = context.classDoc;
    const ownList = canonicalUuid(cls?.system?.spellcasting?.class || cls?.uuid);
    return lists.filter(list => context.known.some(item => item.type === 'Spell' && Number(item.system?.tier) === tier && classesOf(item).includes(list))
        || (list === ownList && Number(cls?.system?.spellcasting?.spellsknown?.[context.level]?.[tier] ?? 0) > 0));
}
export const spellFitsGrant = (grant: any, spell: any, context: SpellGrantContext): boolean =>
    spellGrantClasses(grant, spell, context).length > 0;
/** Each independent grant gets one distinct choice, including overlapping lists. */
export function matchSpellGrants(grants: any[], spells: any[], context: SpellGrantContext): number[] | null {
    if (spells.length > grants.length) return null;
    const identities = spells.map(grantSource);
    if (identities.some(id => !id) || new Set(identities).size !== identities.length) return null;
    const assigned: number[] = Array(grants.length).fill(-1);
    const place = (spell: number, visited: Set<number>): boolean => {
        for (let g = 0; g < grants.length; g++) {
            if (visited.has(g) || !spellFitsGrant(grants[g], spells[spell], context)) continue;
            visited.add(g);
            if (assigned[g] === -1 || place(assigned[g], visited)) { assigned[g] = spell; return true; }
        }
        return false;
    };
    return spells.every((_, i) => place(i, new Set())) ? assigned : null;
}
/** Only source-linked grants from an owned native talent/boon exempt a chosen Spell from quota. */
export function ownedSpellGrant(spell: any, items: any[]): { source: string; classUuid: string } | null {
    const value = spell?.flags?.shadowdark?.spellGrant;
    const rule = SPELL_CHOICE_GRANTS[value?.source];
    if (!rule || !items.some(item => ['Talent', 'Boon'].includes(item.type) && grantSource(item) === value.source)) return null;
    const classUuid = canonicalUuid(value.classUuid);
    if (!classUuid || !classesOf(spell).includes(classUuid) || (rule.classUuid && rule.classUuid !== classUuid)) return null;
    return { source: value.source, classUuid };
}
/** Learned spells imply their native casting list; no progression table is granted. */
export function spellGrantCastingRefs(items: any[]): string[] {
    const result = new Set<string>();
    for (const item of items) {
        if (['Talent','Boon'].includes(item.type)) {
            const source = grantSource(item), rule = spellChoiceGrant(item);
            if (rule?.classUuid) result.add(rule.classUuid);
            if (source && FIXED_SPELL_GRANTS[source]) result.add(SPELL_CLASSES.priest);
        }
        if (item.type === 'Spell') { const grant = ownedSpellGrant(item,items); if (grant) result.add(grant.classUuid); }
    }
    return [...result];
}
