import type { ActorSheetData } from '@sheet-delver/sdk';
import { prepareShadowdarkView, type ViewLookups } from './prepared-view';
import { canonicalUuid, documentId, formatUuid } from './identity';
import { UNAVAILABLE_RULE_INPUTS, type RuleInputs } from './world-settings';

/**
 * Exact label for a reference: the declared-pack name index entry for the
 * canonical UUID. Unknown references return null; a plain string that is not a
 * reference is already a label. No suffix, terminal-ID or name matching.
 */
export function resolveDocumentName(val: any, cachedSystemData: any): string {
    if (!val) return '';
    if (typeof val !== 'string') return val.name || val.label || '';
    const canonical = canonicalUuid(val);
    if (!canonical) return val;
    return cachedSystemData?.nameIndex?.[canonical] ?? '';
}

/** Lookups over a module system projection (registry cached data). */
export function lookupsFromSystemData(cachedSystemData: any, documents?: (uuid: string) => any | null): ViewLookups {
    const nameIndex: Record<string, string> = cachedSystemData?.nameIndex ?? {};
    return {
        propertyName: uuid => nameIndex[canonicalUuid(uuid) ?? ''] ?? null,
        label: ref => nameIndex[formatUuid(ref)] ?? null,
        classDocument: ref => {
            const doc = documents?.(formatUuid(ref)) ?? null;
            return doc?.type === 'Class' ? doc : null;
        },
        spellDocument: ref => {
            const doc = documents?.(formatUuid(ref)) ?? null;
            return doc?.type === 'Spell' ? doc : null;
        },
        languageDocument: ref => {
            const doc = documents?.(formatUuid(ref)) ?? null;
            return doc?.type === 'Language' ? doc : null;
        },
    };
}

/** Native PlayerSD.getTitle from the exact class document. */
function classTitle(actor: any, view: ReturnType<typeof prepareShadowdarkView>, lookups: ViewLookups): string {
    const level = view.level;
    const alignment = String(actor.system?.alignment ?? '');
    if (!alignment || view.kind !== 'Player') return '';
    const ref = view.identity.class.ref;
    const doc = ref ? lookups.classDocument?.(ref) : null;
    const titles = Array.isArray(doc?.system?.titles) ? doc.system.titles : [];
    const match = titles.find((title: any) => level >= title.from && level <= title.to);
    return match?.[alignment] ?? '';
}

/**
 * Projects a raw Actor into the sheet data contract. Source `system` and items
 * are not mutated: items are shallow copies with a canonical `id`, and every
 * rule result lives in the single prepared view (`derived`, aliased `computed`).
 */
export class ShadowdarkNormalizer {
    static normalizeActorData(actor: any, cachedSystemData: any, lookups: ViewLookups = lookupsFromSystemData(cachedSystemData), collections?: any,
        rules: RuleInputs = UNAVAILABLE_RULE_INPUTS): ActorSheetData {
        const view = prepareShadowdarkView(actor, lookups, rules);
        const s = actor.system || {};
        const items = (actor.items || []).map((item: any) => ({ ...item, id: documentId(item) }));
        const label = (entry: { label: string | null; value: string | null }) => entry.label ?? entry.value ?? '';
        const derived: any = {
            ...view,
            // Display-only labels for existing components; identities stay in `identity`.
            resolvedNames: {
                ancestry: label(view.identity.ancestry), class: label(view.identity.class),
                background: label(view.identity.background), deity: label(view.identity.deity),
                patron: label(view.identity.patron), languages: [...view.identity.languages, ...(view.identity.grantedLanguages ?? [])].map(label),
            },
            title: classTitle(actor, view, lookups),
        };

        return {
            id: documentId(actor),
            name: actor.name,
            type: actor.type,
            img: actor.img,
            system: s,
            hp: view.hp,
            ac: view.ac,
            attributes: view.abilities,
            stats: view.abilities,
            items,
            level: { value: view.level, xp: Number(s.level?.xp ?? 0), next: view.xpNextLevel },
            details: {
                alignment: s.alignment || 'neutral',
                background: derived.resolvedNames.background,
                ancestry: derived.resolvedNames.ancestry,
                class: derived.resolvedNames.class,
                patron: derived.resolvedNames.patron,
                deity: derived.resolvedNames.deity,
                languages: derived.resolvedNames.languages,
                biography: s.details?.biography?.value || '',
                notes: s.notes || s.details?.notes?.value || '',
                title: derived.title,
            },
            luck: s.luck || {},
            coins: s.coins || {},
            // Source shape is retained (SDK PreparedActorData); the canonical
            // effect list for sheets is derived.effects.
            effects: actor.effects ?? [],
            computed: derived,
            derived,
        } as any;
    }
}

