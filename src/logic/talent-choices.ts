import { slug } from './weapon-rules';

export const MASTERY_WEAPONS = ['Dagger', 'Staff', 'Club', 'Mace', 'Shortsword', 'Longsword', 'Bastard Sword',
    'Greatsword', 'Greataxe', 'Warhammer', 'Spear', 'Javelin', 'Shortbow', 'Longbow', 'Crossbow', 'Sling'];
export const MASTERY_ARMOR = ['Leather', 'Chainmail', 'Plate', 'Shield'];

export function masteryKind(item: any): 'weapon' | 'armor' | null {
    const name = String(item?.name ?? item?.text ?? '').toLowerCase();
    const id = String(item?.uuid ?? item?._id ?? '');
    // Resolved custom templates keep their typed choice identity through the
    // generator's enrichment pass, not just the built-in compendium UUIDs.
    if (name.startsWith('weapon mastery (') && item.system?.bonuses?.weaponMastery) return 'weapon';
    if (name.startsWith('armor mastery (') && item.system?.bonuses?.armorMastery) return 'armor';
    if (name === 'weapon mastery' || id.endsWith('5bpWuaT0KTNzuzCu')) return 'weapon';
    if (name === 'armor mastery' || id.endsWith('BsRPGhKXYwJBI9ex')) return 'armor';
    return null;
}

export function applyMasteryChoice(item: any, selection: unknown, kind: 'weapon' | 'armor'): any {
    const choices = kind === 'weapon' ? MASTERY_WEAPONS : MASTERY_ARMOR;
    const selected = typeof selection === 'string' && choices.find(choice => slug(choice) === slug(selection));
    if (!selected) throw new Error(`Choose a valid ${kind} for ${item.name || 'Mastery'} before creating it.`);
    const copy = JSON.parse(JSON.stringify(item));
    const selectedSlug = slug(selected);
    for (const effect of copy.effects ?? []) for (const change of effect.changes ?? []) {
        if (typeof change.key === 'string') change.key = change.key.replaceAll('REPLACEME', selectedSlug);
        if (change.value === 'REPLACEME') change.value = selectedSlug;
    }
    copy.system ??= {};
    copy.system.bonuses ??= {};
    copy.system.bonuses[`${kind}Mastery`] = selectedSlug;
    if (!copy.name.endsWith(` (${selected})`)) copy.name += ` (${selected})`;
    assertResolvedTalentChoices([copy]);
    return copy;
}

export function assertResolvedTalentChoices(items: any[]): void {
    for (const item of items) for (const effect of item.effects ?? []) for (const change of effect.changes ?? []) {
        if (typeof change.key === 'string' && change.key.includes('REPLACEME')) {
            throw new Error(`${item.name || 'Talent'} needs a choice before creation. No Actor or Item was created.`);
        }
    }
}

/** Fixed references use the same rule as the existing baggage resolver. */
export function fixedTalentReferences(doc: any): string[] {
    const system = doc?.system ?? {}, talents = system.talents ?? [];
    const fixed = !system.talentChoiceCount || talents.length <= system.talentChoiceCount ? talents : [];
    return [...fixed, ...(system.features ?? []), ...(system.abilities ?? []), ...(system.classAbilities ?? [])]
        .flatMap((ref: any) => typeof ref === 'string' ? [ref] : typeof ref?.uuid === 'string' ? [ref.uuid] : []);
}
