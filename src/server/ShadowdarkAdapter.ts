import { spellGrantCastingRefs } from '../logic/spell-grants';
import { isScroll, scrollSpellUuid } from '../logic/scrolls';
import { isWand, wandSpells } from '../logic/wands';
import { prepareReferenceView } from './reference-view';
import { resolveDisplayArtwork } from './community-artwork';
import { BaseSystemAdapter, logger } from '@sheet-delver/sdk';
import type {
    ActorPreparationContext,
    ActorSheetData,
    FoundryActor,
    PreparedActorData,
} from '@sheet-delver/sdk';
import type { ModuleWorldSnapshot } from '@sheet-delver/sdk';
import type { ModuleRuntime, ModuleRequestRuntime, ReadonlyDocumentStore } from '@sheet-delver/sdk/server';
import { ShadowdarkRegistry, type PackFilter } from './Registry';
import { canReadPack, compendiumDenied, readableRows, type Caller } from './access';
import { ruleInputsFrom, readSourceFilters, sourceAllowed, UNAVAILABLE_RULE_INPUTS, type RuleInputs } from '../logic/world-settings';
import { NATIVE_PREDEFINED_EFFECTS } from '../data/native-predefined-effects';
import { BOON_TYPE_MAP, EFFECT_TRANSLATIONS_MAP } from '../data/talent-effects';
import { ShadowdarkNormalizer, lookupsFromSystemData } from '../logic/normalization';
import { getInitiativeFormula, isClassSpellcaster } from '../logic/rules';
import { actorKind, prepareActorCore } from '../logic/actor-preparation';
import { actionFormula, prepareRequestedAction, type ActionRequest, type RollOverrides } from '../logic/actions';
import { canonicalUuid, DECLARED_PACKS, documentId, formatUuid, parseUuid, sourceRef } from '../logic/identity';
import type { ViewLookups } from '../logic/prepared-view';
import type { ChoiceCatalog } from '../logic/talent-choices';
import { knownSpellSources, advancementSpellChoices, grantedSpellSources, spellListIdentity } from '../logic/spell-model';

/**
 * ShadowdarkAdapter — the Shadowdark system adapter (ADR-0027 conformed).
 *
 * All system data flows through the runtime-backed {@link ShadowdarkRegistry}
 * (declared compendium packs only). A `globalThis` singleton bridges the
 * platform-instantiated adapter and the `shadowdarkAdapter` instance route
 * handlers import, so both share one initialized registry. Caller-specific world
 * documents are never read through it; see {@link resolveDocumentFor}.
 */
export class ShadowdarkAdapter extends BaseSystemAdapter {
    systemId = 'shadowdark';
    private static instance: ShadowdarkAdapter;
    private readonly _registry = new ShadowdarkRegistry();
    /**
     * Incremented per platform runtime (world/epoch); request-scoped caches key on
     * it. A world-context change or same-world recovery does not change it, so an
     * evaluated action is replayed, never rerolled, across a context change.
     */
    runtimeGeneration = 0;
    private world: ModuleRuntime['world'];
    /** Rule inputs for the Actor being prepared (set only during prepareActorData). */
    private preparationRules: RuleInputs | null = null;

    constructor() {
        super();
        const globalAny = globalThis as any;
        if (globalAny.__shadowdarkAdapter) {
            return globalAny.__shadowdarkAdapter;
        }
        if (!ShadowdarkAdapter.instance) {
            ShadowdarkAdapter.instance = this;
        }
        globalAny.__shadowdarkAdapter = ShadowdarkAdapter.instance;
        return ShadowdarkAdapter.instance;
    }

    public static getInstance(): ShadowdarkAdapter {
        const globalAny = globalThis as any;
        if (!ShadowdarkAdapter.instance) {
            if (!globalAny.__shadowdarkAdapter) {
                globalAny.__shadowdarkAdapter = new ShadowdarkAdapter();
            }
            ShadowdarkAdapter.instance = globalAny.__shadowdarkAdapter;
        }
        return ShadowdarkAdapter.instance;
    }

    async initialize(runtime: ModuleRuntime): Promise<void> {
        await super.initialize(runtime);
        this.runtimeGeneration++;
        this.world = runtime.world;
        // A new runtime (world/epoch) starts from an empty projection.
        this._registry.attach(runtime.compendium, runtime.documents);
        logger.info('[ShadowdarkAdapter] Service layer unified via runtime-backed Registry.');
        try {
            await this._registry.getSystemData();
        } catch (e) {
            logger.warn('[ShadowdarkAdapter] System data warm-up deferred:', e);
        }
    }

    /** Current host rule inputs; unavailable without a live world context. */
    currentRules(): RuleInputs {
        try {
            return ruleInputsFrom(this.world?.snapshot());
        } catch {
            return UNAVAILABLE_RULE_INPUTS;
        }
    }

    /**
     * Core world-context change (setting values, declared pack content, or a
     * same-world recovery), called before Core rebuilds prepared Actors. Setting
     * values reach preparation through `context.world`, so only pack-dependent
     * projections need work: the registry is rebuilt from current packs before
     * this returns. Bounded by one projection load; reads only; fenced by the
     * registry generation. A failure rejects and Core holds the world unavailable.
     */
    async onWorldContextChanged(_next: Readonly<ModuleWorldSnapshot>, change: { keys: readonly string[]; recovery: boolean; packs?: readonly string[] }): Promise<void> {
        if (change.recovery || (change.packs?.length ?? 0) > 0) await this._registry.refresh();
    }

    /** Preparation lookups over the hydrated declared-pack projection. */
    lookups(): ViewLookups {
        return lookupsFromSystemData(this._registry.getCachedSystemData(), uuid => this._registry.getCachedDocument(uuid));
    }

    getInitiativeFormula(actor: PreparedActorData): string {
        return getInitiativeFormula(actor);
    }

    /** Optional SDK display hook, structurally typed to retain the older host floor. */
    resolveDisplayArtwork = resolveDisplayArtwork;
    prepareReferenceView = (context: Parameters<typeof prepareReferenceView>[0], runtime: Parameters<typeof prepareReferenceView>[1]) =>
        prepareReferenceView(context, runtime, this.lookups());

    getActorCardData(actor: PreparedActorData): any {
        const derived = (actor.derived ?? {}) as any;
        const label = (entry: any) => entry?.label ?? entry?.value ?? '';
        const ancestry = label(derived.identity?.ancestry);
        const className = label(derived.identity?.class);
        const level = Number(derived.level ?? (actor.system as any)?.level?.value ?? 0);
        return {
            subtext: [ancestry, className || 'Adventurer', `Level ${level}`].filter(Boolean).join(' • '),
            ancestry,
            class: className,
            level,
            // Core refreshes cards independently of the dashboard's Actor list.
            // Keep displayed stats in this projection, using shared preparation.
            blocks: [
                { title: 'HP', value: derived.hp?.value ?? '?', subValue: `/ ${derived.hp?.max ?? '?'}`, valueClass: 'sd-ui-success' },
                { title: 'AC', value: derived.ac ?? '?' },
            ],
        };
    }

    match(actor: any): boolean {
        const hasShadowdarkType = ['player', 'character', 'npc'].includes(actor.type?.toLowerCase());
        const hasShadowdarkSystem = actor.system?.attributes?.hp !== undefined ||
            actor.system?.abilities?.str !== undefined;

        return actor.systemId === 'shadowdark' || (hasShadowdarkType && hasShadowdarkSystem);
    }

    /**
     * Preparation with the context Core supplies for this Actor revision: the
     * world snapshot's settings become the rule inputs of every derived value
     * (luck mode, action consequences). Preparation stays user-invariant.
     */
    prepareActorData(
        actor: FoundryActor,
        context: Readonly<ActorPreparationContext>,
    ): PreparedActorData {
        this.preparationRules = ruleInputsFrom(context.world);
        try {
            return super.prepareActorData(actor, context);
        } finally {
            this.preparationRules = null;
        }
    }

    /** Full-GM legacy projection (Core serves it to full GMs only). */
    async getSystemData(_options?: { minimal?: boolean }): Promise<any> {
        return this._registry.getSystemData();
    }

    /**
     * Caller-safe system data for Core's `/api/system/data` and the module index
     * route. Built from the caller's own compendium reads (Core filters them by
     * the caller's effective pack capability), re-checked against `access` after
     * the reads; the warmed system projection is not used. Contains only the
     * caller-readable name index, class titles and native rule tables.
     */
    async getSystemDataForUser(context: Pick<ModuleRequestRuntime, 'compendium' | 'access' | 'world'> & { documents: ReadonlyDocumentStore }): Promise<any> {
        const [items, tables, actors] = await Promise.all([
            context.compendium.findAll('Item'), context.compendium.findAll('RollTable'), context.compendium.findAll('Actor'),
        ]);
        const caller: Caller = { runtime: { documents: context.documents as any, access: context.access }, isGM: false };
        const { collections, nameIndex } = ShadowdarkRegistry.project(readableRows([...items, ...tables, ...actors] as any[], caller));
        return {
            titles: collections.titles ?? {},
            nameIndex,
            PREDEFINED_EFFECTS: { ...NATIVE_PREDEFINED_EFFECTS },
            BOON_TYPES: { ...BOON_TYPE_MAP },
            EFFECT_TRANSLATIONS: { ...EFFECT_TRANSLATIONS_MAP },
        };
    }

    /** The caller's pack capability as a registry row filter (evaluated per row, after the load). */
    private readable(caller: Caller): PackFilter {
        return pack => canReadPack(caller, pack);
    }

    /**
     * A declared collection filtered to the caller's readable packs. A collection
     * whose every row is in packs the caller cannot read is refused.
     */
    async getCollection(id: string, options: { summary?: boolean; caller: Caller }): Promise<any[]> {
        const rows = await this._registry.getCollection(id, { summary: options.summary, readable: this.readable(options.caller) });
        if (rows.length === 0 && await this._registry.collectionSize(id) > 0) throw compendiumDenied();
        return rows;
    }

    async drawTable(uuid: string, caller: Caller, rollOverride?: number): Promise<any> {
        return this._registry.draw(uuid, this.readable(caller), rollOverride);
    }

    async getSpellsForClass(classUuid: string, caller: Caller): Promise<any[]> {
        return this._registry.getSpellsForClass(classUuid, this.readable(caller));
    }

    async findUniqueByName(name: string, types: string[], caller: Caller): Promise<{ doc: any | null; ambiguous: string[] }> {
        return this._registry.findUniqueByName(name, types, this.readable(caller));
    }

    async getChoiceCatalog(caller: Caller): Promise<ChoiceCatalog> {
        return this._registry.getChoiceCatalog(this.readable(caller));
    }

    normalizeActorData(actor: any): ActorSheetData {
        return ShadowdarkNormalizer.normalizeActorData(actor, this._registry.getCachedSystemData(), this.lookups(), undefined,
            this.preparationRules ?? this.currentRules());
    }

    /** Like {@link resolveDocumentFor}, but content the caller cannot read is null instead of an error. */
    async resolveReadable(uuid: string, caller: Caller): Promise<any | null> {
        try {
            return await this.resolveDocumentFor(uuid, caller);
        } catch (e: any) {
            if (e?.code === 'permission_denied') return null;
            throw e;
        }
    }

    /**
     * Caller-bound resolution: declared compendium documents from the shared
     * projection when the caller's pack capability allows it, checked before and
     * again after the awaited read (restricted content throws
     * `permission_denied`); world and embedded documents only through the
     * caller's request runtime, which applies Core's visibility projection.
     * Unsupported identities are null.
     */
    async resolveDocumentFor(uuid: string, caller: Caller): Promise<any | null> {
        const ref = parseUuid(uuid);
        if (!ref) return null;
        if (ref.kind === 'compendium') {
            if (!canReadPack(caller, ref.pack)) throw compendiumDenied(ref.pack);
            const doc = await this._registry.getDocument(formatUuid(ref))
                ?? await caller.runtime.compendium?.getById(ref.documentType, formatUuid(ref));
            if (!canReadPack(caller, ref.pack)) throw compendiumDenied(ref.pack);
            // A public exact-UUID read must never become terminal-ID substitution.
            return doc && canonicalUuid(doc.uuid) === formatUuid(ref) ? doc : null;
        }
        if (ref.kind === 'world') {
            const doc = await caller.runtime.documents.get(ref.documentType, ref.id);
            return doc ? { ...doc, uuid: formatUuid(ref) } : null;
        }
        if (ref.parentType !== 'Actor' || !['Item', 'ActiveEffect'].includes(ref.documentType)) return null;
        const parent: any = await caller.runtime.documents.get('Actor', ref.parentId);
        const children = ref.documentType === 'Item' ? parent?.items : parent?.effects;
        const child = Array.isArray(children) ? children.find((entry: any) => documentId(entry) === ref.id) : null;
        return child ? { ...child, uuid: formatUuid(ref) } : null;
    }

    /** Request-local bounded dependencies; never published to the shared registry. */
    async callerLookups(actor: any, caller: Caller, options: { languages?: boolean; identities?: boolean } = {}): Promise<ViewLookups> {
        const base = this.lookups();
        const documents = new Map<string, any>();
        const visited = new Set<string>();
        const resolve = async (value: unknown) => {
            const uuid = canonicalUuid(value);
            if (!uuid || visited.has(uuid)) return;
            visited.add(uuid);
            try {
                const doc = await this.resolveDocumentFor(uuid, caller);
                if (doc) documents.set(uuid, doc);
            } catch (e: any) {
                // Denial/missing data is a bounded unavailable dependency, never
                // permission to fall back to the warmed privileged projection.
                if (!['permission_denied', 'not_found'].includes(e?.code)) throw e;
            }
        };
        const items: any[] = Array.isArray(actor?.items) ? actor.items : [];
        const player = actorKind(actor) === 'Player';
        await Promise.all([...(player ? [resolve(actor?.system?.class), ...spellGrantCastingRefs(items).map(resolve)] : []), ...items.flatMap(item => isScroll(item) ? [resolve(scrollSpellUuid(item))]
            : isWand(item) ? wandSpells(item).map(s => resolve(s.uuid)) : [])]);
        const spells = [...items.filter(item => item.type === 'Spell'), ...[...documents.values()].filter(doc => doc.type === 'Spell')];
        if (player) await Promise.all(spells.flatMap(spell => (Array.isArray(spell.system?.class) ? spell.system.class : []).map(resolve)));
        await Promise.all([...documents.values()].filter(doc => doc.type === 'Class').map(doc => resolve(doc.system?.spellcasting?.class)));
        if (options.identities) await Promise.all(['ancestry','background','deity','patron'].map(key => resolve(actor?.system?.[key])));
        if (options.languages) {
            const prepared = prepareActorCore(actor, base);
            await Promise.all((Array.isArray(prepared.effective.languages) ? prepared.effective.languages : []).map(resolve));
        }
        const read = (ref: any, type: string) => {
            const uuid = formatUuid(ref);
            if (ref.kind === 'compendium' && !canReadPack(caller, ref.pack)) return null;
            const doc = documents.get(uuid);
            return doc?.type === type ? doc : null;
        };
        return { propertyName: base.propertyName, dependencies: [...documents.keys()],
            classDocument: ref => read(ref, 'Class'), spellDocument: ref => read(ref, 'Spell'), languageDocument: ref => read(ref, 'Language'),
            label: ref => ref.kind === 'compendium' && !canReadPack(caller, ref.pack) ? null
                : documents.get(formatUuid(ref))?.name ?? (ref.kind === 'compendium' ? base.label?.(ref) : null) ?? null };
    }

    /** Caller catalog coverage is explicit; exact dependency reads remain separate. */
    async spellCatalog(caller: Caller, classUuid?: string) {
        const sources: Array<{ source: string; status: 'ready' | 'failed'; reason?: string }> = [];
        const rows: any[] = [];
        const filters = readSourceFilters(caller.runtime.world?.snapshot());
        if (filters.value === null) return { rows, sources: [{ source: 'world source filters', status: 'failed' as const, reason: filters.reason }], state: 'failed' as const };
        try {
            rows.push(...await this._registry.getCollection('spells', { readable: pack => canReadPack(caller, pack) }));
            for (const pack of DECLARED_PACKS.filter(pack => pack.type === 'Item')) sources.push({ source: pack.id,
                status: canReadPack(caller, pack.id) ? 'ready' : 'failed', ...(!canReadPack(caller, pack.id) ? { reason: 'Pack is not readable by this caller.' } : {}) });
        } catch (e: any) { sources.push({ source: 'declared packs', status: 'failed', reason: String(e?.message ?? e) }); }
        try {
            let page = 0, count = 0;
            do {
                const result = await caller.runtime.documents.list('Item', { filter: { type: 'Spell' }, page, pageSize: 200 });
                if (!Array.isArray(result.rows)) throw new Error('World Item read returned no source rows.');
                for (const doc of result.rows) if (doc.type === 'Spell') rows.push({ ...doc, uuid: `Item.${documentId(doc)}` });
                count += result.rows.length;
                if (count >= result.total) break;
                if (!result.rows.length) throw new Error('World Item pagination ended before its reported total.');
                page++;
            } while (true);
            sources.push({ source: 'world Items', status: 'ready' });
        } catch (e: any) { sources.push({ source: 'world Items', status: 'failed', reason: String(e?.message ?? e) }); }
        // Recheck capabilities after all awaits; a warm read is never authorization.
        const unique = new Map<string, any>();
        for (const doc of rows) {
            const uuid = canonicalUuid(doc.uuid), ref = parseUuid(uuid);
            if (!uuid || !ref || doc.type !== 'Spell' || (ref.kind === 'compendium' && !canReadPack(caller, ref.pack))) continue;
            if (classUuid && !(doc.system?.class ?? []).some((value: unknown) => canonicalUuid(value) === classUuid)) continue;
            if (sourceAllowed(doc, filters.value)) unique.set(uuid, { ...doc, uuid, tier: doc.system?.tier ?? null });
        }
        for (const source of sources) if (source.status === 'ready' && source.source !== 'world Items' && !canReadPack(caller, source.source)) {
            source.status = 'failed'; source.reason = 'Pack access changed while loading.';
        }
        const ready = sources.filter(source => source.status === 'ready').length;
        return { rows: [...unique.values()].sort((a,b) => Number(a.tier) - Number(b.tier) || String(a.name).localeCompare(String(b.name))), sources,
            state: !ready ? 'failed' as const : sources.some(source => source.status === 'failed') ? 'partial' as const : 'complete' as const };
    }

    async getLevelUpData(actor: any, classUuidOverride: string | undefined, patronUuidOverride: string | undefined, caller: Caller) {
        const currentLevel = actor?.system?.level?.value || 0;
        const targetLevel = currentLevel + 1;
        const currentXP = actor?.system?.level?.xp || 0;
        const classUuid = classUuidOverride || actor?.system?.class;
        const patronUuid = patronUuidOverride || actor?.system?.patron;
        const prepared = prepareActorCore(actor, this.lookups(), this.currentRules());
        const conMod = prepared.abilities.con.mod;
        const resolve = (uuid: string) => this.resolveDocumentFor(uuid, caller);

        const classDoc = classUuid ? await resolve(classUuid) : null;
        const patronDoc = patronUuid ? await resolve(patronUuid) : null;
        const diagnostics: string[] = [];
        if (classUuid && !classDoc) diagnostics.push(`Class ${classUuid} is unavailable.`);

        const talentGained = targetLevel % 2 !== 0;
        const isSpellcasterChar = classDoc ? isClassSpellcaster(classDoc) : false;
        const spellsToChoose: Record<number, number> = {};
        let availableSpells: any[] = [];

        if (isSpellcasterChar && classDoc) {
            const skTable = classDoc.system?.spellcasting?.spellsknown;
            if (skTable) {
                const choices = advancementSpellChoices(classDoc, currentLevel, targetLevel);
                Object.assign(spellsToChoose, choices.required);
                diagnostics.push(...choices.diagnostics);
            }
            else diagnostics.push('The exact Class has no spells-known table.');
            const classRef = spellListIdentity(classDoc, classDoc.uuid);
            if (classRef) {
                const catalog = await this.spellCatalog(caller, classRef);
                availableSpells = catalog.rows;
                diagnostics.push(...catalog.sources.filter(source => source.status === 'failed').map(source => `${source.source}: ${source.reason}`));
                const plannedTalents = targetLevel === 1 ? [classDoc, patronDoc].flatMap(doc => doc?.system?.talents ?? []) : [];
                const granted = grantedSpellSources(actor?.items ?? [], plannedTalents);
                const known = knownSpellSources(actor?.items ?? []);
                availableSpells = availableSpells.map(spell => ({ ...spell,
                    isInnate: granted.has(canonicalUuid(spell.uuid) ?? ''),
                    isKnown: known.has(canonicalUuid(spell.uuid) ?? '') }));
            } else diagnostics.push('The class is not a declared compendium document, so its spell list is unavailable.');
        }

        const tableRaw = classDoc?.system?.classTalentTable;
        const talentTable = tableRaw ? canonicalUuid(tableRaw) : null;
        if (tableRaw && !talentTable) diagnostics.push(`Class talent table ${tableRaw} is not a supported reference.`);

        return {
            success: true,
            actorId: actor?.id || actor?._id || 'new',
            currentLevel,
            targetLevel,
            currentXP,
            talentGained,
            classHitDie: classDoc?.system?.hitPoints ?? null,
            talentTable,
            patronBoonTable: patronDoc?.system?.boonTable ? canonicalUuid(patronDoc.system.boonTable) : null,
            canRollBoons: classDoc?.system?.patron?.required || false,
            startingBoons: (targetLevel === 1 && classDoc?.system?.patron?.startingBoons) || 0,
            isSpellcaster: isSpellcasterChar,
            progressionReady: !!classDoc && (!isSpellcasterChar || (!!spellListIdentity(classDoc, classDoc.uuid)
                && advancementSpellChoices(classDoc, currentLevel, targetLevel).diagnostics.length === 0)),
            spellsToChoose,
            availableSpells,
            conMod,
            classUuid: classDoc?.uuid || classUuid || null,
            diagnostics,
        };
    }

    /**
     * Roll formula for Core's generic roll route. Checks and attacks come from the
     * shared action preparer; explicit dialog fields replace individual
     * components. Spells, Class Abilities and potions have native consequences and
     * use the module action route instead, so they return null here.
     */
    getRollData(actor: PreparedActorData, type: string, key: string, options: any = {}): { formula: string; type: string; label: string; flags?: any } | null {
        const items: any[] = Array.isArray(actor.items) ? actor.items : [];
        if (options.manualValue !== undefined && options.manualValue !== null) {
            let label = 'Manual Roll';
            if (type === 'ability') label = `${key.toUpperCase().replace('ABILITY', '')} (Manual)`;
            if (type === 'item') {
                const item = items.find((i: any) => documentId(i) === key);
                label = item ? `${item.name} (Manual)` : 'Item (Manual)';
            }
            const total = Number(options.manualValue);
            const bonuses = [options.abilityBonus, options.itemBonus, options.talentBonus].filter(value => value !== undefined).map(Number);
            const totalBonus = bonuses.reduce((acc, b) => acc + b, 0);
            const formula = totalBonus !== 0 ? `${total} + ${totalBonus}` : String(total);
            return { formula, type: 'manual', label, flags: { shadowdark: { isManual: true } } };
        }

        const lookups = this.lookups();
        let request: ActionRequest | null = null;
        if (type === 'ability') request = { kind: 'check', stat: key.toLowerCase() as any, selected: options.selected };
        if (type === 'item') {
            const item = items.find((i: any) => documentId(i) === key);
            if (!item || !['Weapon', 'NPC Attack', 'NPC Special Attack'].includes(item.type)) return null;
            request = { kind: 'attack', itemId: key, attackType: options.attackType, handedness: options.handedness, selected: options.selected };
        }
        if (!request) return null;
        // The prepared store's view already holds this revision's actions; reuse
        // the matching one, and re-prepare only for option-dependent requests.
        const prepared = ((actor.derived as any)?.actions ?? []).find((entry: any) => entry.kind === request!.kind
            && (request!.kind === 'check' ? entry.request?.stat === request!.stat : entry.itemId === request!.itemId
                && (!request!.attackType || entry.attack?.type === request!.attackType)
                && (!request!.handedness || entry.attack?.handedness === request!.handedness))
            && !(request!.selected?.length));
        // Re-preparation uses the rule inputs this Actor revision was prepared with.
        const rules = ((actor.derived as any)?.ruleInputs as RuleInputs | undefined) ?? UNAVAILABLE_RULE_INPUTS;
        const action = prepared ?? prepareRequestedAction(prepareActorCore(actor, lookups, rules), actor, lookups, request);
        if (!action || !action.available) return null;
        const overrides: RollOverrides = {
            abilityBonus: options.abilityBonus !== undefined ? Number(options.abilityBonus) : undefined,
            itemBonus: options.itemBonus !== undefined ? Number(options.itemBonus) : undefined,
            talentBonus: options.talentBonus !== undefined ? Number(options.talentBonus) : undefined,
            advantageMode: options.advantageMode,
        };
        return {
            formula: actionFormula(action, overrides),
            type: action.kind === 'check' ? 'ability' : 'attack',
            label: action.kind === 'check' ? `${key.toUpperCase()} Check` : action.label,
            flags: { shadowdark: { actionId: action.id, critical: action.critical, damage: action.damage?.formula ?? null } },
        };
    }
}

export const shadowdarkAdapter = ShadowdarkAdapter.getInstance();
export { ShadowdarkAdapter as Adapter };
