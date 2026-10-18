import info from '../../info.json';

/**
 * Canonical document identities. A reference is an explicit parsed form, never a
 * name or terminal-ID guess.
 *
 * Structured references deliberately carry no `Compendium.`-prefixed string: Core
 * 0.18.1 rewrites every such string in the Actor detail projection into a name
 * (SD01-05, an external dependency). Module-owned views therefore expose
 * `{ kind, pack, documentType, id }`, from which `formatUuid` rebuilds the exact UUID.
 */
export type DocumentRef =
    | { kind: 'compendium'; pack: string; documentType: string; id: string }
    | { kind: 'world'; documentType: string; id: string }
    | { kind: 'embedded'; parentType: string; parentId: string; documentType: string; id: string };

const WORLD_TYPES = new Set(['Actor', 'Item', 'JournalEntry', 'RollTable', 'Macro', 'Scene', 'Folder', 'Playlist', 'Cards', 'Adventure']);

type PackDeclaration = { id: string; type: string; hydrate: boolean };
export const DECLARED_PACKS: ReadonlyArray<PackDeclaration> =
    ((info as { compendiumPacks?: { packs?: PackDeclaration[] } }).compendiumPacks?.packs ?? []).map(pack => ({ ...pack }));

export function declaredPack(pack: string): PackDeclaration | null {
    return DECLARED_PACKS.find(entry => entry.id === pack) ?? null;
}

export function parseUuid(value: unknown): DocumentRef | null {
    if (typeof value !== 'string' || !value || value.length > 512) return null;
    const parts = value.split('.');
    if (parts.some(part => !part)) return null;
    if (parts[0] === 'Compendium') {
        // Compendium.<scope>.<pack>.<Type>.<id>
        if (parts.length === 5) return { kind: 'compendium', pack: `${parts[1]}.${parts[2]}`, documentType: parts[3], id: parts[4] };
        // Explicit legacy alias Compendium.<scope>.<pack>.<id>: the type comes
        // only from this module's declaration of that exact pack.
        if (parts.length === 4) {
            const pack = declaredPack(`${parts[1]}.${parts[2]}`);
            return pack ? { kind: 'compendium', pack: pack.id, documentType: pack.type, id: parts[3] } : null;
        }
        return null;
    }
    if (parts.length === 2 && WORLD_TYPES.has(parts[0])) return { kind: 'world', documentType: parts[0], id: parts[1] };
    if (parts.length === 4 && WORLD_TYPES.has(parts[0])) {
        return { kind: 'embedded', parentType: parts[0], parentId: parts[1], documentType: parts[2], id: parts[3] };
    }
    return null;
}

export function formatUuid(ref: DocumentRef): string {
    if (ref.kind === 'compendium') return `Compendium.${ref.pack}.${ref.documentType}.${ref.id}`;
    if (ref.kind === 'world') return `${ref.documentType}.${ref.id}`;
    return `${ref.parentType}.${ref.parentId}.${ref.documentType}.${ref.id}`;
}

/** Canonical exact UUID string, or null when the value is not a supported identity. */
export function canonicalUuid(value: unknown): string | null {
    const ref = parseUuid(value);
    return ref ? formatUuid(ref) : null;
}

export function refFromValue(value: unknown): DocumentRef | null {
    if (value && typeof value === 'object' && 'kind' in (value as object)) {
        const ref = value as DocumentRef;
        return parseUuid(formatUuid(ref)) ? ref : null;
    }
    return parseUuid(value);
}

export function sameRef(a: DocumentRef | null | undefined, b: DocumentRef | null | undefined): boolean {
    return !!a && !!b && formatUuid(a) === formatUuid(b);
}

/** `_id` (raw Foundry source) or `id` (projected) — never a name. */
export function documentId(doc: any): string {
    return String(doc?._id ?? doc?.id ?? '');
}

/** The source document an embedded copy was created from, when recorded. */
export function sourceRef(doc: any): DocumentRef | null {
    return parseUuid(doc?._stats?.compendiumSource) ?? parseUuid(doc?.flags?.core?.sourceId);
}

/**
 * Data for creating an owned copy of a declared document: no `_id`, transport
 * stamps removed and `_stats.compendiumSource` recording the exact source, as
 * Foundry's own `fromCompendium` does. Everything else is preserved.
 */
export function ownedCopy(doc: any, source?: unknown): any {
    const copy = JSON.parse(JSON.stringify(doc ?? {}));
    const canonical = canonicalUuid(source ?? copy.uuid ?? copy._stats?.compendiumSource ?? copy.flags?.core?.sourceId);
    delete copy._id;
    delete copy.uuid;
    delete copy.pack;
    delete copy.isShallow;
    delete copy._key;
    if (canonical) copy._stats = { ...(copy._stats ?? {}), compendiumSource: canonical };
    return copy;
}
