import { readChanges, serializeChanges } from './effects';
import { slugify } from './foundry';

/**
 * Talent choices follow native 4.0.6 ActiveEffectsSD.createItemWithEffect /
 * modifyEffectChangesWithInput / handlePredefinedEffect:
 *
 * - the choice kind comes from the *effect name* containing `REPLACEME`
 *   ("Weapon Mastery"/"Increased Weapon Damage Die" → base weapon,
 *   "Armor Mastery" → base armor, "Spellcasting Advantage on Spell" → spell);
 * - options are compendium base items (`baseWeapon`/`baseArmor` blank, not magic),
 *   keyed by Foundry-slugified name (CompendiumsSD.baseWeapons/baseArmor);
 * - `REPLACEME` is replaced in change keys of that effect and the item name gains
 *   ` (<choice name>)`. Values are not rewritten.
 *
 * Both the legacy `changes` and Foundry 14 `system.changes` shapes are handled, and
 * every other field of the template is preserved.
 */
export type ChoiceKind = 'weapon' | 'armor' | 'spell';
export interface ChoiceOption { slug: string; name: string }
export type ChoiceCatalog = Partial<Record<ChoiceKind, ChoiceOption[]>>;

const EFFECT_CHOICE_KIND: Record<string, ChoiceKind> = {
    'weapon mastery': 'weapon',
    'increased weapon damage die': 'weapon',
    'armor mastery': 'armor',
    'spellcasting advantage on spell': 'spell',
};

const effectsOf = (item: any): any[] => Array.isArray(item?.effects) ? item.effects : [];
const hasPlaceholder = (effect: any) => readChanges(effect).changes.some(change => change.key.includes('REPLACEME'));

export function choiceKindForEffect(effect: any): ChoiceKind | null {
    return EFFECT_CHOICE_KIND[String(effect?.name ?? '').trim().toLowerCase()] ?? null;
}

/** Choice options from declared compendium documents (native baseWeapons/baseArmor/spells). */
export function choiceCatalog(documents: any[]): ChoiceCatalog {
    const options = (filter: (doc: any) => boolean): ChoiceOption[] => {
        const seen = new Map<string, ChoiceOption>();
        for (const doc of documents.filter(filter)) {
            const slug = slugify(doc.name ?? '');
            if (slug && !seen.has(slug)) seen.set(slug, { slug, name: doc.name });
        }
        return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    };
    return {
        weapon: options(doc => doc?.type === 'Weapon' && (doc.system?.baseWeapon ?? '') === '' && !doc.system?.magicItem),
        armor: options(doc => doc?.type === 'Armor' && (doc.system?.baseArmor ?? '') === '' && !doc.system?.magicItem),
        spell: options(doc => doc?.type === 'Spell'),
    };
}

/** The pending choice kind of an unresolved template, or null when it needs none. */
export function pendingChoiceKind(item: any): ChoiceKind | null {
    for (const effect of effectsOf(item)) if (hasPlaceholder(effect)) return choiceKindForEffect(effect);
    return null;
}

/** Mastery grants and pending spell targets; fixed spell effects need no input. */
export function talentChoiceKind(item: any): ChoiceKind | null {
    for (const effect of effectsOf(item)) {
        const kind = choiceKindForEffect(effect);
        if (kind && (kind !== 'spell' || hasPlaceholder(effect))) return kind;
    }
    return null;
}

/**
 * Kind of a mastery-style talent, resolved or not, from native effect names.
 * Used to count independent grants; it never infers a kind from an ID suffix.
 */
export function masteryKind(item: any): 'weapon' | 'armor' | null {
    for (const effect of effectsOf(item)) {
        const kind = choiceKindForEffect(effect);
        if (kind === 'weapon' || kind === 'armor') return kind;
    }
    return null;
}

/** The selector a resolved mastery talent applies to, read from its keys. */
export function resolvedChoice(item: any): string | null {
    for (const effect of effectsOf(item)) {
        if (!choiceKindForEffect(effect)) continue;
        for (const change of readChanges(effect).changes) {
            const match = /^system\.(?:roll\.melee\.bonus|attributes\.ac|roll\.attack\.upgrade-damage-die|roll\.spell\.advantage)\.([^.]+)$/.exec(change.key);
            if (match && match[1] !== 'REPLACEME') return match[1];
        }
    }
    return null;
}

export function applyChoice(item: any, selection: unknown, kind: ChoiceKind, catalog: ChoiceCatalog): any {
    const options = catalog[kind];
    if (!options || !options.length) {
        throw new Error(`${item?.name || 'Talent'} needs a ${kind} choice, but no ${kind} options are available from declared Shadowdark data. No Actor or Item was created.`);
    }
    const selected = typeof selection === 'string' && options.find(option => option.slug === slugify(selection) || option.name === selection);
    if (!selected) throw new Error(`Choose a valid ${kind} for ${item?.name || 'this talent'} before creating it.`);
    const copy = JSON.parse(JSON.stringify(item));
    let replaced = false;
    for (const effect of effectsOf(copy)) {
        if (!hasPlaceholder(effect) || choiceKindForEffect(effect) !== kind) continue;
        const { changes } = readChanges(effect);
        const patch = serializeChanges(effect, changes.map(change => ({
            index: change.index, key: change.key.replace('REPLACEME', selected.slug), type: change.type,
            value: change.value, phase: change.phase, priority: change.storedPriority,
        })));
        if (patch['system.changes']) {
            effect.system ??= {};
            effect.system.changes = patch['system.changes'];
            // A stale legacy copy beside system.changes is never applied, but it
            // must not keep an unresolved placeholder either.
            if (Array.isArray(effect.changes)) effect.changes = effect.changes.map((change: any) =>
                typeof change?.key === 'string' ? { ...change, key: change.key.replace('REPLACEME', selected.slug) } : change);
        }
        if (patch.changes) effect.changes = patch.changes;
        replaced = true;
    }
    if (!replaced) throw new Error(`${item?.name || 'Talent'} has no ${kind} choice to resolve.`);
    if (!String(copy.name ?? '').endsWith(` (${selected.name})`)) copy.name = `${copy.name} (${selected.name})`;
    assertResolvedTalentChoices([copy]);
    return copy;
}

/** Weapon/armor mastery wrapper kept for existing callers. */
export function applyMasteryChoice(item: any, selection: unknown, kind: 'weapon' | 'armor', catalog: ChoiceCatalog): any {
    return applyChoice(item, selection, kind, catalog);
}

/** Any remaining placeholder in either serialized shape blocks every write. */
export function assertResolvedTalentChoices(items: any[]): void {
    for (const item of items) for (const effect of effectsOf(item)) {
        const legacy = Array.isArray(effect?.changes) ? effect.changes : [];
        const modern = Array.isArray(effect?.system?.changes) ? effect.system.changes : [];
        if ([...legacy, ...modern].some((change: any) => typeof change?.key === 'string' && change.key.includes('REPLACEME'))) {
            throw new Error(`${item?.name || 'Talent'} needs a choice before creation. No Actor or Item was created.`);
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
