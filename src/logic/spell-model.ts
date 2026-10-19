import type { PreparedActorCore, PreparationLookups } from './actor-preparation';
import { canonicalUuid, documentId, formatUuid, parseUuid, sourceRef } from './identity';
import { slugify } from './foundry';

/** Native priest talent → spell. Exact identities, shared by every count consumer. */
export const GRANTED_SPELLS: Readonly<Record<string, string>> = {
    'Compendium.shadowdark.talents.Item.LfHTnYW8I65x8Y31': 'Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH',
};
export function grantedSpellSources(items: any[]): Set<string> {
    return new Set(items.map(item => sourceRef(item)).filter(Boolean).map(ref => GRANTED_SPELLS[formatUuid(ref!)]).filter(Boolean));
}
export type SpellLimit = { status: 'known'; value: number } | { status: 'unavailable'; value: null; reason: string };
/** Explicit native null is zero; missing/invalid data is never unlimited. */
export function spellLimit(table: any, level: number, tier: number): SpellLimit {
    const unknown = (): SpellLimit => ({ status: 'unavailable', value: null, reason: `Spells-known data is unavailable for level ${level}, tier ${tier}.` });
    if (!table || typeof table !== 'object' || !Object.hasOwn(table, String(level))) return unknown();
    const row = table[String(level)];
    if (row === null) return { status: 'known', value: 0 };
    if (!row || typeof row !== 'object' || !Object.hasOwn(row, String(tier))) return unknown();
    const value = row[String(tier)];
    if (value === null) return { status: 'known', value: 0 };
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? { status: 'known', value } : unknown();
}
export function spellListIdentity(classDoc: any, classUuid: unknown): string | null {
    const override = classDoc?.system?.spellcasting?.class;
    if (override === '__not_spellcaster__') return null;
    // Empty is native's explicit "this Class". Missing data cannot establish it.
    return override === '' ? canonicalUuid(classUuid) : canonicalUuid(override);
}
export function advancementSpellChoices(classDoc: any, current: number, target: number) {
    const required: Record<number, number> = {}, diagnostics: string[] = [];
    for (let tier = 1; tier <= 5; tier++) {
        const before: SpellLimit = current === 0 ? { status: 'known', value: 0 } : spellLimit(classDoc?.system?.spellcasting?.spellsknown, current, tier);
        const after = spellLimit(classDoc?.system?.spellcasting?.spellsknown, target, tier);
        if (before.status !== 'known' || after.status !== 'known') diagnostics.push(`Cannot determine required tier ${tier} choices: progression data is unavailable.`);
        else if (after.value < before.value) diagnostics.push(`Tier ${tier} progression shrinks; review the exact Class source before advancing.`);
        else if (after.value > before.value) required[tier] = after.value - before.value;
    }
    return { required, diagnostics };
}

/** One ownership/progression projection. Catalog membership never establishes ownership. */
export function prepareSpellModel(actor: any, core: PreparedActorCore, lookups: PreparationLookups) {
    const items: any[] = Array.isArray(actor?.items) ? actor.items : [];
    const identity = canonicalUuid(actor?.system?.class);
    const ref = parseUuid(identity);
    const classDoc = ref ? lookups.classDocument?.(ref) : null;
    const listUuid = spellListIdentity(classDoc, identity);
    const listRef = parseUuid(listUuid);
    const listDoc = listUuid === identity ? classDoc : listRef ? lookups.classDocument?.(listRef) : null;
    const grants = 'classes' in core.spellcasting ? core.spellcasting.classes : [];
    const active = !!listDoc && grants.includes(slugify(listDoc.name ?? ''));
    const granted = grantedSpellSources(items);
    const owned = items.filter(item => item.type === 'Spell').map(item => {
        const origin = sourceRef(item);
        const classes = (Array.isArray(item.system?.class) ? item.system.class : []).map((value: unknown) => canonicalUuid(value));
        const innate = !!origin && granted.has(formatUuid(origin));
        const resolved = classes.length && classes.every((uuid: string | null) => {
            const ref = parseUuid(uuid);
            return ref && !!lookups.classDocument?.(ref);
        });
        return { actorId: documentId(actor), itemId: documentId(item), name: item.name, tier: item.system?.tier ?? null,
            source: origin, classes, innate, classification: innate ? 'granted' : resolved ? 'ordinary' : 'unresolved' };
    });
    const diagnostics: string[] = [];
    if (core.kind === 'Player') {
        if (identity && !classDoc) diagnostics.push('Actor Class is unavailable. Resolve its exact reference; no Class was inferred.');
        if (classDoc?.system?.spellcasting?.ability && !grants.length) diagnostics.push('Missing casting grant: the Class identity does not grant spellcasting by itself.');
        if (listUuid && !listDoc) diagnostics.push('The exact spell-list Class is unavailable.');
        if (listDoc && grants.length && !active) diagnostics.push('The spell-list Class does not match this Actor’s active casting grant.');
    }
    const sources = core.kind === 'Player' && active && listUuid ? [{ classUuid: identity!, listUuid, name: classDoc.name,
        grant: slugify(listDoc.name ?? ''), limits: Object.fromEntries([1,2,3,4,5].map(tier => [tier, spellLimit(classDoc.system?.spellcasting?.spellsknown, core.level, tier)])) }] : [];
    // An additional active grant has no proven Actor progression owner. Keep its
    // owned rows manageable for explicit removals, without borrowing its table.
    if (core.kind === 'Player') for (const uuid of new Set<string>(owned.flatMap(row => row.classes).filter((uuid): uuid is string => !!uuid))) {
        const ref = parseUuid(uuid), doc = ref ? lookups.classDocument?.(ref) : null;
        const grant = slugify(doc?.name ?? '');
        if (!doc || !grants.includes(grant) || sources.some(source => source.listUuid === uuid)) continue;
        sources.push({ classUuid: uuid, listUuid: uuid, name: doc.name, grant, limits: Object.fromEntries([1,2,3,4,5].map(tier => [tier,
            { status: 'unavailable', value: null, reason: 'This additional casting grant has no proven progression Class. Existing spells are preserved; choose an exact progression source before adding.' } as SpellLimit])) });
    }
    return { classUuid: identity, listUuid, grants, sources, owned, diagnostics };
}
