import { logger } from '@sheet-delver/sdk';
import type { CompendiumPackReader, ReadonlyDocumentStore } from '@sheet-delver/sdk/server';
import { languageRarity } from '../logic/languages';
import { BOON_TYPE_MAP, EFFECT_TRANSLATIONS_MAP } from '../data/talent-effects';
import { NATIVE_PREDEFINED_EFFECTS } from '../data/native-predefined-effects';
import { canonicalUuid, declaredPack, formatUuid, parseUuid } from '../logic/identity';
import { choiceCatalog, type ChoiceCatalog } from '../logic/talent-choices';

/**
 * ShadowdarkRegistry — a derived, in-process projection over this module's
 * declared compendium packs (`runtime.compendium`). It is not a document store:
 *
 * - Lookups are by exact canonical UUID. A request for another pack, a terminal
 *   ID or a name never returns a different document (SD01-07).
 * - Only declared compendium identities are served. World and embedded UUIDs are
 *   caller-specific and must be read through the request runtime (SD01-06); they
 *   are never fetched with the system-level reader or kept in shared collections.
 * - `attach` (a new runtime/world) resets every collection and in-flight load, and
 *   a load started for an earlier generation cannot publish into the new one.
 */
/** The caller's pack capability, applied to rows after the cache read. */
export type PackFilter = (pack: string) => boolean;

export class ShadowdarkRegistry {
    private systemData: any = null;
    private _collections: Record<string, any[]> = {};
    private nameIndex: Record<string, string> = {};
    private byUuid = new Map<string, any>();
    private lastFetch = 0;
    private generation = 0;

    private aggregationPromise: Promise<any> | null = null;
    private pendingFetches = new Map<string, Promise<any>>();

    private _compendium: CompendiumPackReader | null = null;
    private _documents: ReadonlyDocumentStore | null = null;

    private readonly CACHE_TTL = 300000; // 5 minutes

    private static readonly TYPE_TO_COLLECTION: Record<string, string> = {
        'ancestry': 'ancestries',
        'class': 'classes',
        'background': 'backgrounds',
        'deity': 'deities',
        'patron': 'patrons',
        'language': 'languages',
        'spell': 'spells',
        'talent': 'talents',
        'class ability': 'class-abilities',
        'rolltable': 'tables',
        'basic': 'gear',
        'weapon': 'gear',
        'armor': 'gear',
        'npc': 'monsters',
    };

    private static readonly COLLECTIONS = [
        ...new Set(Object.values(ShadowdarkRegistry.TYPE_TO_COLLECTION)),
        'magic-items', 'conditions', 'spell-effects', 'properties'
    ];

    /** Wire the runtime-backed data sources; discards everything from a prior runtime. */
    public attach(compendium: CompendiumPackReader, documents: ReadonlyDocumentStore): void {
        this.generation++;
        this._compendium = compendium;
        this._documents = documents;
        this.reset();
    }

    /** Drop the derived projection so the next read rebuilds it from current packs. */
    public reset(): void {
        this.systemData = null;
        this._collections = {};
        this.nameIndex = {};
        this.byUuid = new Map();
        this.lastFetch = 0;
        this.aggregationPromise = null;
        this.pendingFetches = new Map();
    }

    /**
     * Rebuild the projection from current packs after a Core world-context change
     * (pack content or same-world recovery). Loads begun before the refresh belong
     * to an older generation and cannot publish. The previous projection keeps
     * answering synchronous lookups until the new one is complete, then is
     * replaced as a whole; it is never mutated into the new values. A failed
     * rebuild rejects, so Core keeps the world unavailable instead of serving it.
     */
    public async refresh(): Promise<void> {
        this.generation++;
        this.aggregationPromise = null;
        this.pendingFetches = new Map();
        this.lastFetch = 0;
        await this.aggregate();
        if (!this.isFresh()) throw new Error('Shadowdark compendium projection did not refresh.');
    }

    /** The lean system index for the adapter's synchronous SystemAdapter methods. */
    public getCachedSystemData(): any {
        return this.systemData;
    }

    /** Synchronous exact lookup in the hydrated declared-pack projection. */
    public getCachedDocument(uuid: string): any | null {
        const canonical = canonicalUuid(uuid);
        const doc = canonical ? this.byUuid.get(canonical) : null;
        return doc ? JSON.parse(JSON.stringify(doc)) : null;
    }

    public async getSystemData(): Promise<any> {
        if (!this.isFresh()) {
            await this.aggregate();
        }

        return {
            titles: this.systemData?.titles || {},
            nameIndex: this.nameIndex || {},
            PREDEFINED_EFFECTS: { ...NATIVE_PREDEFINED_EFFECTS },
            BOON_TYPES: { ...BOON_TYPE_MAP },
            EFFECT_TRANSLATIONS: { ...EFFECT_TRANSLATIONS_MAP },
            _debug: {
                source: this.isFresh() ? 'cache' : 'rehydrated',
                timestamp: Date.now()
            }
        };
    }

    public async collectionSize(id: string): Promise<number> {
        if (!this.isFresh()) await this.aggregate();
        return ((this._collections as any)[id] || []).length;
    }

    /** A collection's rows; `readable` (the caller's pack capability) is applied after the load. */
    public async getCollection(id: string, options: { summary?: boolean; readable?: PackFilter } = {}): Promise<any[]> {
        if (!this.isFresh()) await this.aggregate();
        const collection = ((this._collections as any)[id] || []).filter((doc: any) => !options.readable || options.readable(doc.pack));

        // Character-builder categories keep complete source documents.
        const forceFull = [
            'ancestries', 'backgrounds', 'classes',
            'deities', 'patrons', 'talents', 'languages'
        ].includes(id);

        if (options.summary && !forceFull) {
            return JSON.parse(JSON.stringify(collection.map((d: any) => ({
                uuid: d.uuid,
                name: d.name,
                img: d.img,
                rarity: d.rarity,
                type: d.type,
                tier: d.system?.tier,
                level: d.system?.level?.value,
                system: {
                    cost: d.system?.cost,
                    slots: d.system?.slots,
                    properties: d.system?.properties,
                    description: d.system?.description,
                    tier: d.system?.tier,
                    talentClass: d.system?.talentClass,
                    talentLevel: d.system?.talentLevel,
                    requirement: d.system?.requirement,
                    class: d.system?.class,
                    baseWeapon: d.system?.baseWeapon,
                    baseArmor: d.system?.baseArmor,
                    magicItem: d.system?.magicItem,
                    level: d.system?.level,
                    alignment: d.system?.alignment,
                }
            }))));
        }

        return JSON.parse(JSON.stringify(collection));
    }

    private async aggregate() {
        if (this.aggregationPromise) {
            return this.aggregationPromise;
        }
        const generation = this.generation;

        const promise = (async () => {
            try {
                logger.info('[ShadowdarkRegistry] Starting compendium-driven aggregation...');

                if (!this._compendium) {
                    logger.warn('[ShadowdarkRegistry] No compendium attached. Skipping aggregation.');
                    this.systemData = { ...this.createSkeleton(), ...this._getRuleData() };
                    return this.systemData;
                }

                // Declared packs only; rows arrive identity-stamped with `pack`/`uuid`.
                const [items, tables, actors] = await Promise.all([
                    this._compendium.findAll('Item'),
                    this._compendium.findAll('RollTable'),
                    this._compendium.findAll('Actor'),
                ]);
                if (generation !== this.generation) return this.systemData;

                const { collections: aggregated, byUuid, nameIndex } = ShadowdarkRegistry.project([...items, ...tables, ...actors]);

                this._collections = aggregated;
                this.byUuid = byUuid;
                this.nameIndex = nameIndex;

                this.systemData = {
                    ...this.createSkeleton(),
                    nameIndex: this.nameIndex,
                    titles: aggregated.titles || {},
                    ...this._getRuleData()
                };

                this.lastFetch = Date.now();

                logger.info(`[ShadowdarkRegistry] Aggregation complete. Index size: ${Object.keys(this.nameIndex).length}`);

                return this.systemData;
            } catch (err) {
                logger.error('[ShadowdarkRegistry] Aggregation failed:', err);
                throw err;
            } finally {
                if (generation === this.generation) this.aggregationPromise = null;
            }
        })();
        this.aggregationPromise = promise;
        return promise;
    }

    /**
     * Identity-checked projection of declared-pack rows into collections, an
     * exact-UUID map and a name index. Shared by the warmed system projection and
     * the caller-bound system data built from a caller's own compendium reads.
     */
    public static project(rows: readonly any[]): { collections: Record<string, any[]> & { titles: Record<string, unknown> }; byUuid: Map<string, any>; nameIndex: Record<string, string> } {
        const collections = ShadowdarkRegistry.skeleton();
        const byUuid = new Map<string, any>();
        const nameIndex: Record<string, string> = {};
        for (const original of rows) {
            const doc: any = { ...original };
            const packId = typeof doc.pack === 'string' ? doc.pack : null;
            const pack = packId ? declaredPack(packId) : null;
            if (!pack) continue;
            const id = doc._id || doc.id;
            const canonical = canonicalUuid(doc.uuid) ?? (id ? `Compendium.${pack.id}.${pack.type}.${id}` : null);
            const ref = canonical ? parseUuid(canonical) : null;
            // A row must belong to the pack it was read from.
            if (!ref || ref.kind !== 'compendium' || ref.pack !== pack.id || ref.id !== id) continue;
            if (byUuid.has(canonical!)) continue;
            doc.uuid = canonical;
            doc.pack = pack.id;
            byUuid.set(canonical!, doc);
            if (typeof doc.name === 'string') nameIndex[canonical!] = doc.name;
            ShadowdarkRegistry.categorize(pack.id, doc, collections);
        }
        return { collections, byUuid, nameIndex };
    }

    /**
     * Resolves an exact declared compendium document. Supported inputs are a
     * canonical `Compendium.<pack>.<Type>.<id>` UUID or the explicit legacy alias
     * `Compendium.<pack>.<id>` for a declared pack. Anything else returns null.
     */
    public async getDocument(uuid: string): Promise<any | null> {
        const ref = parseUuid(uuid);
        if (!ref || ref.kind !== 'compendium') return null;
        const pack = declaredPack(ref.pack);
        if (!pack || pack.type !== ref.documentType) return null;
        const canonical = formatUuid(ref);

        if (!this.isFresh()) await this.aggregate();
        const found = this.byUuid.get(canonical);
        if (found && (found.system || found.results || found.type === 'RollTable')) return JSON.parse(JSON.stringify(found));

        // Index-only declared packs can be hydrated per document through the
        // platform reader; the result must match the exact requested identity.
        if (!this._documents) return null;
        if (this.pendingFetches.has(canonical)) return this.pendingFetches.get(canonical);
        const generation = this.generation;
        const fetchPromise = (async () => {
            try {
                const fullDoc: any = await this._documents!.fetchByUuid(canonical);
                if (!fullDoc || generation !== this.generation) return null;
                if ((fullDoc._id ?? fullDoc.id) !== ref.id) return null;
                const doc = { ...fullDoc, uuid: canonical, pack: pack.id };
                this.byUuid.set(canonical, doc);
                if (typeof doc.name === 'string') this.nameIndex[canonical] = doc.name;
                return JSON.parse(JSON.stringify(doc));
            } catch (e) {
                logger.warn(`[ShadowdarkRegistry] Hydration failed for ${canonical}:`, e);
                return null;
            } finally {
                this.pendingFetches.delete(canonical);
            }
        })();
        this.pendingFetches.set(canonical, fetchPromise);
        return fetchPromise;
    }

    /**
     * Rolls a declared RollTable and hydrates exact result documents. A missing
     * table or result document is reported, not substituted by name.
     */
    public async draw(uuid: string, readable: PackFilter, rollOverride?: number): Promise<any | null> {
        const tablePack = parseUuid(uuid);
        if (tablePack?.kind !== 'compendium' || !readable(tablePack.pack)) return null;
        const table = await this.getDocument(uuid);
        if (!readable(tablePack.pack)) return null;
        if (!table || !Array.isArray(table.results) || !table.results.length) {
            logger.warn(`[ShadowdarkRegistry] Draw failed: table '${uuid}' is not a declared, populated RollTable.`);
            return null;
        }

        const formula = table.system?.formula || table.formula;
        let roll = rollOverride;
        const match = typeof formula === 'string' ? formula.match(/^(\d+)d(\d+)$/i) : null;
        if (roll === undefined) {
            if (!match) {
                logger.warn(`[ShadowdarkRegistry] Draw failed: table formula '${formula}' is not supported.`);
                return null;
            }
            const count = parseInt(match[1]);
            const die = parseInt(match[2]);
            roll = 0;
            for (let i = 0; i < count; i++) roll += Math.floor(Math.random() * die) + 1;
        }

        const matched = table.results.filter((r: any) => {
            const range = Array.isArray(r.range) ? r.range : null;
            return range && roll! >= range[0] && roll! <= range[1];
        });

        const items: any[] = [];
        const unresolved: string[] = [];
        for (const res of matched) {
            const targetUuid = canonicalUuid(res.documentUuid)
                ?? (res.documentCollection && res.documentId ? canonicalUuid(`Compendium.${res.documentCollection}.Item.${res.documentId}`) : null);
            if (!targetUuid) continue;
            const ref = parseUuid(targetUuid);
            const pack = ref?.kind === 'compendium' ? ref.pack : null;
            const item = pack && readable(pack) ? await this.getDocument(targetUuid) : null;
            if (item && pack && readable(pack)) items.push(item); else unresolved.push(targetUuid);
        }

        return { id: table._id || table.id, uuid: table.uuid, roll, total: roll, formula, results: matched, items, unresolved, table };
    }

    /**
     * Spells whose `system.class` references the exact class document. Class
     * identity is the declared class UUID, not a name substring.
     */
    public async getSpellsForClass(classUuid: string, readable: PackFilter): Promise<any[]> {
        if (!this.isFresh()) await this.aggregate();
        const canonical = canonicalUuid(classUuid);
        if (!canonical) return [];
        return JSON.parse(JSON.stringify((this._collections.spells ?? []).filter((spell: any) => readable(spell.pack)
            && (Array.isArray(spell.system?.class) ? spell.system.class : []).some((value: unknown) => canonicalUuid(value) === canonical))));
    }

    /**
     * Import-format conversion: the one declared document of an allowed native type
     * whose name equals `name` (case-insensitive). Several distinct documents with
     * that name are ambiguous and return `{ ambiguous }` instead of a guess.
     */
    public async findUniqueByName(name: string, types: string[], readable: PackFilter): Promise<{ doc: any | null; ambiguous: string[] }> {
        if (!this.isFresh()) await this.aggregate();
        const wanted = String(name ?? '').trim().toLowerCase();
        if (!wanted) return { doc: null, ambiguous: [] };
        const matches = [...this.byUuid.values()].filter(doc => readable(doc.pack) && types.includes(doc.type) && String(doc.name ?? '').trim().toLowerCase() === wanted);
        if (matches.length === 1) return { doc: JSON.parse(JSON.stringify(matches[0])), ambiguous: [] };
        return { doc: null, ambiguous: matches.map(doc => doc.uuid) };
    }

    /** Native choice options (base weapons/armor, spells) from declared packs. */
    public async getChoiceCatalog(readable: PackFilter): Promise<ChoiceCatalog> {
        if (!this.isFresh()) await this.aggregate();
        return choiceCatalog([...(this._collections.gear ?? []), ...(this._collections['magic-items'] ?? []), ...(this._collections.spells ?? [])]
            .filter((doc: any) => readable(doc.pack)));
    }

    public async getIndex(): Promise<Record<string, string>> {
        if (!this.isFresh()) await this.aggregate();
        return this.nameIndex;
    }

    private isFresh(): boolean {
        if (!this.systemData || !this.lastFetch) return false;
        return (Date.now() - this.lastFetch) < this.CACHE_TTL;
    }

    private _getRuleData() {
        return {
            PREDEFINED_EFFECTS: { ...NATIVE_PREDEFINED_EFFECTS },
            BOON_TYPES: { ...BOON_TYPE_MAP },
            EFFECT_TRANSLATIONS: { ...EFFECT_TRANSLATIONS_MAP },
            DEBUG_SYNC_MS: Date.now()
        };
    }

    private createSkeleton() {
        return ShadowdarkRegistry.skeleton();
    }

    private static skeleton(): any {
        const skeleton: any = {
            titles: {}
        };

        for (const key of ShadowdarkRegistry.COLLECTIONS) {
            skeleton[key] = [];
        }

        return skeleton;
    }

    /** Category from native document type; pack names only split mixed packs. */
    private static categorize(packId: string, doc: any, results: any) {
        const lowerPack = packId.toLowerCase();
        const type = String(doc.type || '').toLowerCase();
        let category: string | null = null;

        if (lowerPack.endsWith('.magic-items') && ['weapon', 'armor', 'basic', 'potion', 'scroll', 'wand'].includes(type)) category = 'magic-items';
        else if (lowerPack.endsWith('.conditions')) category = 'conditions';
        else if (lowerPack.endsWith('.spell-effects')) category = 'spell-effects';
        else if (lowerPack.endsWith('.properties')) category = 'properties';
        else if (lowerPack.endsWith('.rollable-tables') || type === 'rolltable' || (doc.results && !doc.type)) category = 'tables';
        else category = ShadowdarkRegistry.TYPE_TO_COLLECTION[type] ?? null;

        if (!category && ['potion', 'scroll', 'wand', 'gem'].includes(type)) category = 'gear';
        if (!category) return;
        if (category === 'languages') {
            doc.rarity = languageRarity(doc);
        } else if (category === 'classes' && doc.system?.titles) {
            results.titles[doc.name] = doc.system.titles;
        }
        (results[category] ??= []).push(doc);
    }
}
