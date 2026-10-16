import { BaseSystemAdapter, logger } from '@sheet-delver/sdk';
import type {
    ActorPreparationContext,
    ActorSheetData,
    FoundryActor,
    PreparedActorData,
} from '@sheet-delver/sdk';
import type { ModuleRequestRuntime, ModuleRuntime } from '@sheet-delver/sdk/server';
import { ShadowdarkRegistry } from './Registry';
import { ShadowdarkNormalizer, lookupsFromSystemData } from '../logic/normalization';
import { getInitiativeFormula, isClassSpellcaster } from '../logic/rules';
import { prepareActorCore } from '../logic/actor-preparation';
import { actionFormula, prepareRequestedAction, type ActionRequest, type RollOverrides } from '../logic/actions';
import { canonicalUuid, documentId, formatUuid, parseUuid, sourceRef } from '../logic/identity';
import type { ViewLookups } from '../logic/prepared-view';
import type { ChoiceCatalog } from '../logic/talent-choices';

/** Exact talent → granted spell pairs (native priest Turn Undead). */
const GRANTED_SPELLS: Record<string, string> = {
    'Compendium.shadowdark.talents.Item.LfHTnYW8I65x8Y31': 'Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH',
};

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
        // A new runtime (world/epoch) starts from an empty projection.
        this._registry.attach(runtime.compendium, runtime.documents);
        logger.info('[ShadowdarkAdapter] Service layer unified via runtime-backed Registry.');
        try {
            await this._registry.getSystemData();
        } catch (e) {
            logger.warn('[ShadowdarkAdapter] System data warm-up deferred:', e);
        }
    }

    /** Preparation lookups over the hydrated declared-pack projection. */
    lookups(): ViewLookups {
        return lookupsFromSystemData(this._registry.getCachedSystemData(), uuid => this._registry.getCachedDocument(uuid));
    }

    getInitiativeFormula(actor: PreparedActorData): string {
        return getInitiativeFormula(actor);
    }

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
            level
        };
    }

    match(actor: any): boolean {
        const hasShadowdarkType = ['player', 'character', 'npc'].includes(actor.type?.toLowerCase());
        const hasShadowdarkSystem = actor.system?.attributes?.hp !== undefined ||
            actor.system?.abilities?.str !== undefined;

        return actor.systemId === 'shadowdark' || (hasShadowdarkType && hasShadowdarkSystem);
    }

    prepareActorData(
        actor: FoundryActor,
        context: Readonly<ActorPreparationContext>,
    ): PreparedActorData {
        return super.prepareActorData(actor, context);
    }

    async getSystemData(_options?: { minimal?: boolean }): Promise<any> {
        return this._registry.getSystemData();
    }

    async getCollection(id: string, options: { summary?: boolean } = {}): Promise<any[]> {
        return this._registry.getCollection(id, options);
    }

    async drawTable(uuid: string, rollOverride?: number): Promise<any> {
        return this._registry.draw(uuid, rollOverride);
    }

    async getSpellsForClass(classUuid: string): Promise<any[]> {
        return this._registry.getSpellsForClass(classUuid);
    }

    async findUniqueByName(name: string, types: string[]): Promise<{ doc: any | null; ambiguous: string[] }> {
        return this._registry.findUniqueByName(name, types);
    }

    async getChoiceCatalog(): Promise<ChoiceCatalog> {
        return this._registry.getChoiceCatalog();
    }

    async getRegistryIndex(): Promise<Record<string, string>> {
        return this._registry.getIndex();
    }

    normalizeActorData(actor: any): ActorSheetData {
        return ShadowdarkNormalizer.normalizeActorData(actor, this._registry.getCachedSystemData(), this.lookups());
    }

    /** Exact declared compendium document (system-level read of shared pack data only). */
    async resolveDocument(uuid: string): Promise<any> {
        return this._registry.getDocument(uuid);
    }

    /**
     * Caller-bound resolution: declared compendium documents from the registry;
     * world and embedded documents only through the caller's request runtime,
     * which applies Core's visibility projection. Unsupported identities are null.
     */
    async resolveDocumentFor(uuid: string, runtime: Pick<ModuleRequestRuntime, 'documents'>): Promise<any | null> {
        const ref = parseUuid(uuid);
        if (!ref) return null;
        if (ref.kind === 'compendium') return this.resolveDocument(formatUuid(ref));
        if (ref.kind === 'world') {
            return runtime.documents.get(ref.documentType, ref.id);
        }
        if (ref.parentType !== 'Actor' || !['Item', 'ActiveEffect'].includes(ref.documentType)) return null;
        const parent: any = await runtime.documents.get('Actor', ref.parentId);
        const children = ref.documentType === 'Item' ? parent?.items : parent?.effects;
        const child = Array.isArray(children) ? children.find((entry: any) => documentId(entry) === ref.id) : null;
        return child ? { ...child, uuid: formatUuid(ref) } : null;
    }

    async getLevelUpData(actor: any, classUuidOverride?: string, patronUuidOverride?: string, runtime?: Pick<ModuleRequestRuntime, 'documents'>) {
        const currentLevel = actor?.system?.level?.value || 0;
        const targetLevel = currentLevel + 1;
        const currentXP = actor?.system?.level?.xp || 0;
        const classUuid = classUuidOverride || actor?.system?.class;
        const patronUuid = patronUuidOverride || actor?.system?.patron;
        const prepared = prepareActorCore(actor, this.lookups());
        const conMod = prepared.abilities.con.mod;
        const resolve = (uuid: string) => runtime ? this.resolveDocumentFor(uuid, runtime) : this.resolveDocument(uuid);

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
                const currentSpells = skTable[String(currentLevel)] || {};
                const targetSpells = skTable[String(targetLevel)] || {};
                for (let tier = 1; tier <= 5; tier++) {
                    const diff = (Number(targetSpells[String(tier)]) || 0) - (Number(currentSpells[String(tier)]) || 0);
                    if (diff > 0) spellsToChoose[tier] = diff;
                }
            }
            const classRef = canonicalUuid(classDoc.uuid);
            if (classRef) {
                availableSpells = await this.getSpellsForClass(classRef);
                const granted = new Set((actor?.items || []).map((item: any) => sourceRef(item)).filter(Boolean)
                    .map((ref: any) => GRANTED_SPELLS[formatUuid(ref)]).filter(Boolean));
                for (const spell of availableSpells) if (granted.has(canonicalUuid(spell.uuid))) spell.isInnate = true;
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
        const action = prepared ?? prepareRequestedAction(prepareActorCore(actor, lookups), actor, lookups, request);
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
