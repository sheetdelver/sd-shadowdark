import { logger } from '@sheet-delver/sdk';
import type { CompendiumPackReader, ReadonlyDocumentStore } from '@sheet-delver/sdk/server';
import { isRareLanguage } from '../logic/rules';
import { SYSTEM_PREDEFINED_EFFECTS, BOON_TYPE_MAP, EFFECT_TRANSLATIONS_MAP } from '../data/talent-effects';

/**
 * ShadowdarkRegistry — system-wide data, sourced entirely from the SDK runtime.
 *
 * It no longer maintains its own persistent cache or reaches into `PersistentCache` / `fs` /
 * `info.json`. Pack data comes from `runtime.compendium` (the module's declared packs, whose
 * rows the platform identity-stamps with `pack`/`uuid`), and UUID hydration from
 * `runtime.documents.fetchByUuid`. The categorized collections + nameIndex it builds are an
 * in-process *derived projection* over that platform data (TTL-memoized) — not a parallel
 * store. The adapter wires the sources via {@link attach} in `initialize(runtime)`.
 */
export class ShadowdarkRegistry {
    private systemData: any = null;
    private _collections: Record<string, any[]> = {};
    private nameIndex: Record<string, string> = {};
    private lastFetch = 0;

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
        'rolltable': 'tables',
        'item': 'gear',
        'weapon': 'gear',
        'armor': 'gear'
    };

    private static readonly COLLECTIONS = [
        ...new Set(Object.values(ShadowdarkRegistry.TYPE_TO_COLLECTION)),
        'magic-items', 'conditions', 'spell-effects', 'properties'
    ];

    /** Wire the runtime-backed data sources (called by the adapter on initialize). */
    public attach(compendium: CompendiumPackReader, documents: ReadonlyDocumentStore): void {
        this._compendium = compendium;
        this._documents = documents;
    }

    /** The lean system index for the adapter's synchronous SystemAdapter methods. */
    public getCachedSystemData(): any {
        return this.systemData;
    }

    /**
     * Gets the lean aggregated system data (titles + nameIndex + rule data), reloading if stale.
     */
    public async getSystemData(): Promise<any> {
        if (!this.isFresh()) {
            await this.aggregate();
        }

        return {
            titles: this.systemData?.titles || {},
            nameIndex: this.nameIndex || {},
            PREDEFINED_EFFECTS: { ...SYSTEM_PREDEFINED_EFFECTS },
            BOON_TYPES: { ...BOON_TYPE_MAP },
            EFFECT_TRANSLATIONS: { ...EFFECT_TRANSLATIONS_MAP },
            _debug: {
                source: this.isFresh() ? 'cache' : 'rehydrated',
                timestamp: Date.now()
            }
        };
    }

    public async getCollection(id: string, options: { summary?: boolean } = {}): Promise<any[]> {
        if (!this.isFresh()) await this.aggregate();
        const collection = (this._collections as any)[id] || [];

        // Force full data for character builder critical categories
        // This ensures the Generator gets "unaltered" data without diet summaries.
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
                // Rule Shard Statistics
                system: {
                    cost: d.system?.cost,
                    slots: d.system?.slots,
                    properties: d.system?.properties,
                    description: d.system?.description,
                    tier: d.system?.tier,
                    talentClass: d.system?.talentClass,
                    talentLevel: d.system?.talentLevel,
                    requirement: d.system?.requirement,
                    class: d.system?.class
                }
            }))));
        }

        return JSON.parse(JSON.stringify(collection));
    }

    private async aggregate() {
        if (this.aggregationPromise) {
            return this.aggregationPromise;
        }

        this.aggregationPromise = (async () => {
            try {
                logger.info('[ShadowdarkRegistry] Starting compendium-driven aggregation...');

                if (!this._compendium) {
                    logger.warn('[ShadowdarkRegistry] No compendium attached. Skipping aggregation.');
                    this.systemData = { ...this.createSkeleton(), ...this._getRuleData() };
                    return this.systemData;
                }

                // Declared packs only; rows arrive identity-stamped with `pack`/`uuid`.
                const [items, tables] = await Promise.all([
                    this._compendium.findAll('Item'),
                    this._compendium.findAll('RollTable'),
                ]);

                const aggregated = this.createSkeleton();
                const encounteredUuids = new Set<string>();
                const localNameIndex = new Map<string, string>();

                // Group rows by their source pack so the same categorization logic that used
                // to iterate manifest pack shards can run per pack.
                const byPack = new Map<string, any[]>();
                for (const doc of [...items, ...tables]) {
                    const packId = typeof doc.pack === 'string' ? doc.pack : 'shadowdark.unknown';
                    if (!byPack.has(packId)) byPack.set(packId, []);
                    byPack.get(packId)!.push(doc);
                }

                let loadedCount = 0;
                for (const [packId, docs] of byPack) {
                    loadedCount++;
                    this._processShardDocuments(packId, docs, aggregated, localNameIndex, encounteredUuids);
                }

                this._collections = aggregated;
                this.nameIndex = encounteredUuids.size > 0 ? Array.from(encounteredUuids).reduce((acc: Record<string, string>, uuid: string) => {
                    const name = localNameIndex.get(uuid);
                    if (name) acc[uuid] = name;
                    return acc;
                }, {}) : {};

                this.systemData = {
                    ...this.createSkeleton(),
                    nameIndex: this.nameIndex,
                    titles: aggregated.titles || {},
                    ...this._getRuleData()
                };

                this.lastFetch = Date.now();

                logger.info(`[ShadowdarkRegistry] Aggregation complete. ${loadedCount} packs processed. Index size: ${Object.keys(this.nameIndex).length}`);

                return this.systemData;
            } catch (err) {
                logger.error('[ShadowdarkRegistry] Aggregation failed:', err);
                throw err;
            } finally {
                this.aggregationPromise = null;
            }
        })();

        return this.aggregationPromise;
    }

    /**
     * Resolves a document by its UUID, hydrating it from the platform if it's not in the
     * aggregated projection.
     */
    public async getDocument(uuid: string): Promise<any | null> {
        if (!uuid) return null;

        // 1. Check local aggregated projection
        if (!this.isFresh()) await this.aggregate();
        const collections = this._collections;

        let found = null;
        const extractedId = uuid.includes('.') ? uuid.split('.').pop() : uuid;

        for (const key of ShadowdarkRegistry.COLLECTIONS) {
            found = collections[key]?.find((d: any) => {
                const idMatch = d._id === extractedId || d.id === extractedId || d._id === uuid || d.id === uuid;
                if (d.uuid === uuid || idMatch) return true;

                // Flexible UUID matching (handle missing .Item. or .RollTable. segment)
                if (uuid.startsWith('Compendium.') && d.uuid?.startsWith('Compendium.')) {
                    const parts1 = uuid.split('.');
                    const parts2 = d.uuid.split('.');
                    if (parts1[1] === parts2[1] && (parts1[2] === parts2[2] || parts1.length === parts2.length)) {
                        const id1 = parts1[parts1.length - 1];
                        const id2 = parts2[parts2.length - 1];
                        return id1 === id2;
                    }
                }
                return false;
            });
            if (found && (found.system || found.type === 'RollTable' || found.results)) {
                return JSON.parse(JSON.stringify(found));
            }
        }

        if (!found) {
            logger.debug(`[ShadowdarkRegistry] ${uuid} not found in projection. Index has ${Object.keys(this.nameIndex).length} items.`);
        }

        // 2. Hydrate from the platform document surface (compendium-backed, no live fetch).
        if (this._documents) {
            if (this.pendingFetches.has(uuid)) return this.pendingFetches.get(uuid);

            const fetchPromise = (async () => {
                try {
                    logger.debug(`[ShadowdarkRegistry] Hydrating ${uuid} via runtime.documents...`);
                    const fullDoc = await this._documents!.fetchByUuid(uuid);
                    if (fullDoc) {
                        return this.inventoryDocument(uuid, fullDoc);
                    }
                    return null;
                } catch (e) {
                    logger.warn(`[ShadowdarkRegistry] Hydration failed for ${uuid}:`, e);
                    return null;
                } finally {
                    this.pendingFetches.delete(uuid);
                }
            })();

            this.pendingFetches.set(uuid, fetchPromise);
            return fetchPromise;
        }

        return null;
    }

    /**
     * Rolls on a table and ensures results are hydrated.
     */
    public async draw(uuidOrName: string, rollOverride?: number): Promise<any | null> {
        let table = await this.getDocument(uuidOrName);

        if (!table && !uuidOrName.includes('.')) {
            table = await this.findByName(uuidOrName, 'RollTable');
        }

        if (!table || (!table.results && !table.results?.length)) {
            logger.warn(`[ShadowdarkRegistry] Draw failed: Table '${uuidOrName}' not found or empty.`);
            return null;
        }

        const formula = table.system?.formula || table.formula || "1d20";
        let roll = rollOverride;

        if (roll === undefined) {
            const match = formula.match(/^(\d+)d(\d+)$/i);
            if (match) {
                const count = parseInt(match[1]);
                const die = parseInt(match[2]);
                roll = 0;
                for (let i = 0; i < count; i++) roll += Math.floor(Math.random() * die) + 1;
            } else {
                roll = Math.floor(Math.random() * 20) + 1;
            }
        }

        const matched = table.results.filter((r: any) => {
            const range = r.range || [1, 1];
            return roll! >= range[0] && roll! <= range[1];
        });

        const items: any[] = [];
        for (const res of matched) {
            const targetUuid = res.documentUuid || (res.documentCollection && res.documentId ? `Compendium.${res.documentCollection}.Item.${res.documentId}` : null);

            if (targetUuid) {
                const item = await this.getDocument(targetUuid);
                if (item) items.push(item);
            }
        }

        return {
            id: table._id || table.id,
            roll,
            total: roll,
            formula,
            results: matched,
            items: items,
            table
        };
    }

    /**
     * Finds a document in the projection by name and type.
     */
    public async findByName(name: string, type?: string): Promise<any | null> {
        if (!this.isFresh()) await this.aggregate();
        const normalized = name.toLowerCase();

        for (const key of ShadowdarkRegistry.COLLECTIONS) {
            const found = this._collections[key]?.find((doc: any) => {
                const matchesName = (doc.name || "").toLowerCase() === normalized;
                if (!matchesName) return false;
                if (!type) return true;

                const docType = (doc.type || "").toLowerCase();
                const targetType = type.toLowerCase();

                if (targetType === 'rolltable' && (doc.results || key === 'tables')) return true;

                return docType === targetType;
            });
            if (found) return JSON.parse(JSON.stringify(found));
        }
        return null;
    }

    /**
     * Filters discovered spells by class source.
     */
    public async getSpellsBySource(className: string): Promise<any[]> {
        if (!this.isFresh()) await this.aggregate();
        if (!this._collections?.spells) return [];

        const normalizedClass = className.toLowerCase();
        return JSON.parse(JSON.stringify(this._collections.spells.filter((spell: any) => {
            const spellClasses = spell.system?.class || [];
            const list = Array.isArray(spellClasses) ? spellClasses : [spellClasses];
            return list.some((c: string) => {
                const identifier = String(c).toLowerCase();

                if (identifier.includes(normalizedClass)) return true;

                const resolvedName = (this.nameIndex[c] || "").toLowerCase();
                if (resolvedName && resolvedName.includes(normalizedClass)) return true;

                return false;
            });
        })));
    }

    public async getIndex(): Promise<Record<string, string>> {
        if (!this.isFresh()) await this.aggregate();
        return this.nameIndex;
    }

    /**
     * Updates/Inserts a hydrated document into the aggregated projection.
     */
    private inventoryDocument(uuid: string, doc: any): any {
        const enriched = { ...doc, uuid, isShallow: false };
        let updated = false;

        for (const key of ShadowdarkRegistry.COLLECTIONS) {
            if (!this._collections[key]) continue;
            const idx = this._collections[key].findIndex((d: any) => d.uuid === uuid || d._id === uuid || d.id === uuid);
            if (idx !== -1) {
                this._collections[key][idx] = enriched;
                updated = true;
            }
        }

        if (!updated) {
            const target = ShadowdarkRegistry.TYPE_TO_COLLECTION[doc.type?.toLowerCase()] || 'gear';
            if (!this._collections[target]) this._collections[target] = [];
            this._collections[target].push(enriched);
        }

        if (doc.uuid && doc.name) {
            this.nameIndex[doc.uuid] = doc.name;
            if (this.systemData) {
                this.systemData.nameIndex = { ...this.nameIndex };
            }
        }

        return JSON.parse(JSON.stringify(enriched));
    }

    private isFresh(): boolean {
        if (!this.systemData || !this.lastFetch) return false;
        return (Date.now() - this.lastFetch) < this.CACHE_TTL;
    }

    private _getRuleData() {
        return {
            PREDEFINED_EFFECTS: { ...SYSTEM_PREDEFINED_EFFECTS },
            BOON_TYPES: { ...BOON_TYPE_MAP },
            EFFECT_TRANSLATIONS: { ...EFFECT_TRANSLATIONS_MAP },
            DEBUG_SYNC_MS: Date.now()
        };
    }

    private createSkeleton() {
        const skeleton: any = {
            titles: {}
        };

        for (const key of ShadowdarkRegistry.COLLECTIONS) {
            skeleton[key] = [];
        }

        return skeleton;
    }

    private _processShardDocuments(packId: string, docs: any[], results: any, nameIndex: Map<string, string>, encounteredUuids: Set<string>) {
        const lowerPack = packId.toLowerCase();
        docs.forEach(originalDoc => {
            const doc = { ...originalDoc };
            const id = doc._id || doc.id;

            if (!doc.uuid) {
                const isTable = doc.type === 'RollTable' || (doc.results && !doc.type) || lowerPack.includes('rollable-tables');
                const docType = isTable ? 'RollTable' : 'Item';
                doc.uuid = `Compendium.${packId}.${docType}.${id}`;
            }
            doc.pack = packId;

            if (encounteredUuids.has(doc.uuid)) return;
            encounteredUuids.add(doc.uuid);
            if (typeof doc.uuid === 'string' && typeof doc.name === 'string') {
                nameIndex.set(doc.uuid, doc.name);
            }

            const type = (doc.type || "").toLowerCase();
            let category: string | null = null;

            category = ShadowdarkRegistry.TYPE_TO_COLLECTION[type] || null;

            if (!category) {
                if (lowerPack.includes('ancestries')) category = 'ancestries';
                else if (lowerPack.includes('backgrounds')) category = 'backgrounds';
                else if (lowerPack.includes('classes')) category = 'classes';
                else if (lowerPack.includes('spells')) category = 'spells';
                else if (lowerPack.includes('talents') || lowerPack.includes('class-abilities')) category = 'talents';
                else if (lowerPack.includes('languages')) category = 'languages';
                else if (lowerPack.includes('magic-items')) category = 'magic-items';
                else if (lowerPack.includes('gear')) category = 'gear';
                else if (lowerPack.includes('conditions')) category = 'conditions';
                else if (lowerPack.includes('spell-effects')) category = 'spell-effects';
                else if (lowerPack.includes('properties')) category = 'properties';
                else if (lowerPack.includes('rollable-tables')) category = 'tables';
            }

            if (!category && lowerPack.includes('patrons-and-deities')) {
                const name = (doc.name || "").toLowerCase();
                if (name.includes('patron')) category = 'patrons';
                else category = 'deities';
            }

            if (category && results[category]) {
                if (category === 'languages') {
                    doc.rarity = isRareLanguage(doc.name) ? 'rare' : 'common';
                } else if (category === 'classes' && doc.system?.titles) {
                    results.titles[doc.name] = doc.system.titles;
                }
                results[category].push(doc);
            } else if (!category) {
                if (['item', 'weapon', 'armor'].includes(type)) {
                    results.gear.push(doc);
                }
            }

            if (type === 'rolltable' || (doc.results && !category)) {
                if (!results.tables.includes(doc)) {
                    results.tables.push(doc);
                }
            }
        });
    }
}
