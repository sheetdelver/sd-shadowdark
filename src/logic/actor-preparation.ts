import { spellGrantCastingRefs } from './spell-grants';
import { describeMigration, isRejectedBonusesKey, nativeKeyMigration } from './legacy-effect-keys';
import { collectEffects, type CanonicalChange, type CanonicalEffect } from './effects';
import { clone, finiteNumber, getProperty, setProperty, slugify } from './foundry';
import { resolveFormula } from './formula';
import { classifyEffectKey } from './effect-key-coverage';
import { getActiveEffectKeys, numericKey, type RollKeyItem } from './roll-keys';
import { documentId, parseUuid, sourceRef, type DocumentRef } from './identity';
import { UNAVAILABLE_RULE_INPUTS, type RuleInputs } from './world-settings';

/**
 * Module-prepared Shadowdark Actor data following native 4.0.6 preparation:
 *
 *   PlayerSD.migrateData / attributeModel (`base` → `value`, `hp.base` → `hp.max`)
 *   → PlayerSD.prepareBaseData (slots = 10, empty spellcasting)
 *   → Foundry 14 `applyActiveEffects("initial")` with ActiveEffectSD.applyRules
 *   → PlayerSD.prepareDerivedData (AC, STR slot bonus, spellcasting cleanup)
 *   → Foundry 14 `applyActiveEffects("final")`.
 *
 * NPCs (NpcSD) keep explicit ability modifiers and AC. Results are computed by
 * SheetDelver from serialized source; they are not native browser-prepared data.
 */
export const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type AbilityKey = typeof ABILITY_KEYS[number];
export type ActorKind = 'Player' | 'NPC' | 'Light' | 'Unknown';

/** PlayerSD attributeModel.mod. */
export const playerModifier = (score: number): number => Math.min(4, Math.max(-4, Math.floor((score - 10) / 2)));

interface FieldSpec { type: 'number' | 'boolean' | 'string'; integer?: boolean; min?: number; initial?: number }
const abilityFields = (suffix: 'value' | 'mod', min?: number, initial?: number) => Object.fromEntries(ABILITY_KEYS.map(key =>
    [`abilities.${key}.${suffix}`, { type: 'number', integer: true, ...(min !== undefined ? { min } : {}), ...(initial !== undefined ? { initial } : {}) } as FieldSpec]));
const COMMON_FIELDS: Record<string, FieldSpec> = {
    'attributes.ac.value': { type: 'number', integer: true, min: 0, initial: 10 },
    'attributes.hp.value': { type: 'number', integer: true, min: 0 },
    'attributes.hp.max': { type: 'number', integer: true, min: 0 },
    'level.value': { type: 'number', integer: true, min: 0 },
    'level.xp': { type: 'number', integer: true, min: 0 },
    alignment: { type: 'string' }, notes: { type: 'string' },
};
/** PlayerSD.defineSchema fields that ActiveEffects commonly target. */
const PLAYER_FIELDS: Record<string, FieldSpec> = {
    ...COMMON_FIELDS, ...abilityFields('value', 0, 10),
    'coins.gp': { type: 'number', integer: true, min: 0 }, 'coins.sp': { type: 'number', integer: true, min: 0 },
    'coins.cp': { type: 'number', integer: true, min: 0 }, 'luck.remaining': { type: 'number', integer: true, min: 0 },
    'luck.available': { type: 'boolean' }, renown: { type: 'number', integer: true }, slots: { type: 'number', integer: true, min: 10, initial: 10 },
};
/** NpcSD.defineSchema fields. */
const NPC_FIELDS: Record<string, FieldSpec> = {
    ...COMMON_FIELDS, ...abilityFields('mod'), darkAdapted: { type: 'boolean' }, move: { type: 'string' },
    moveNote: { type: 'string' }, 'spellcasting.ability': { type: 'string' },
    'spellcasting.bonus': { type: 'number', integer: true, min: 0 }, 'spellcasting.attacks': { type: 'number', integer: true, min: 0 },
};

export interface PreparedAbility { value: number | null; mod: number; source: 'score' | 'npc-modifier' }

export interface PreparedItemProperty { ref: DocumentRef | null; name: string | null; slug: string | null }

export interface PreparedItemBasics {
    id: string;
    name: string;
    type: string;
    source: DocumentRef | null;
    physical: boolean;
    equipped: boolean;
    stashed: boolean;
    quantity: number;
    slotsUsed: number;
    freeCarry: number;
    treasure: boolean;
    gem: boolean;
    ammunition: boolean;
    identified: boolean;
    magicItem: boolean;
    broken: boolean;
    lost: boolean;
    lightSource: boolean;
    properties: PreparedItemProperty[];
    propertyNames: string[];
    diagnostics: string[];
}

export interface PreparationLookups {
    /** Name of a declared property document by exact UUID. */
    propertyName?: (uuid: string) => string | null;
    /** Declared Class document by exact reference, for spellcasting ability. */
    classDocument?: (ref: DocumentRef) => any | null;
    /** Declared Spell document by exact reference (wand/scroll spells). */
    spellDocument?: (ref: DocumentRef) => any | null;
}

export interface PreparedActorCore {
    kind: ActorKind;
    /** Effect-applied system data used for roll data and effective values. */
    effective: Record<string, any>;
    level: number;
    abilities: Record<AbilityKey, PreparedAbility>;
    hp: { value: number; max: number };
    ac: number;
    acSource: 'prepared-armor' | 'npc-explicit';
    maxSlots: number | null;
    slotUsage: { gear: number; treasure: number; coins: number; gems: number; total: number } | null;
    spellcasting: { classes: string[]; allowAllItems: boolean; itemAbility: string } | { ability: string; bonus: number; attacks: number };
    initiative: { value: number; advantage: number };
    effects: CanonicalEffect[];
    items: PreparedItemBasics[];
    /** World-setting rule inputs this preparation used (one context revision). */
    rules: RuleInputs;
    diagnostics: string[];
}

const PHYSICAL_TYPES = new Set(['Armor', 'Basic', 'Gem', 'Potion', 'Scroll', 'Wand', 'Weapon']);

export function actorKind(actor: any): ActorKind {
    const type = String(actor?.type ?? '');
    if (type === 'Player' || type === 'NPC' || type === 'Light') return type;
    if (type.toLowerCase() === 'npc') return 'NPC';
    if (['player', 'character'].includes(type.toLowerCase())) return 'Player';
    return 'Unknown';
}

/** Native migrateData equivalents applied to a working copy only. */
export function migrateSystem(kind: ActorKind, source: any): Record<string, any> {
    const system = clone(source ?? {}) as Record<string, any>;
    system.attributes ??= {};
    system.attributes.hp ??= {};
    system.attributes.ac ??= {};
    if (kind === 'Player') {
        system.abilities ??= {};
        for (const key of ABILITY_KEYS) {
            const ability = system.abilities[key] ??= {};
            // attributeModel.migrateData: _addDataFieldMigration(data, "base", "value").
            if (ability.value === undefined && ability.base !== undefined) ability.value = ability.base;
        }
        // PlayerSD.migrateData: a truthy hp.base replaces hp.max.
        if (system.attributes.hp.base) system.attributes.hp.max = system.attributes.hp.base;
    }
    if (kind === 'NPC') {
        system.spellcasting ??= {};
        for (const [from, to] of [['spellcastingAbility', 'ability'], ['spellcastingBonus', 'bonus'], ['spellcastingAttackNum', 'attacks']]) {
            if (system.spellcasting[to] === undefined && system[from] !== undefined) system.spellcasting[to] = system[from];
        }
    }
    return system;
}

/** Native Actor#getRollData: system data with Player ability modifier getters. */
export function buildRollData(kind: ActorKind, working: Record<string, any>): Record<string, any> {
    const data: Record<string, any> = { ...working };
    if (kind === 'Player') {
        data.abilities = Object.fromEntries(ABILITY_KEYS.map(key => {
            const value = finiteNumber(working.abilities?.[key]?.value) ?? 10;
            return [key, { ...(working.abilities?.[key] ?? {}), value, mod: playerModifier(value) }];
        }));
    }
    return data;
}

const typeOf = (value: unknown): string => value === null || value === undefined ? 'null' : Array.isArray(value) ? 'Array' : typeof value;

// Roll selectors read canonical changes again against completed roll data.
// A later effect may supply a reference that is absent during phased application.
const usesCompletedRollData = (key: string) => key.startsWith('system.roll.') && classifyEffectKey(key).kind === 'roll-key';

function castDelta(raw: unknown, targetType: string): unknown {
    if (targetType === 'boolean') return typeof raw === 'string' ? raw === 'true' : !!raw;
    if (targetType === 'number') return Number(raw);
    if (targetType === 'string') return String(raw);
    return raw;
}

function applyTyped(current: unknown, delta: unknown, type: string): { ok: true; value: unknown } | { ok: false; reason: string } {
    const ct = typeOf(current);
    switch (type) {
        case 'add':
            if (ct === 'boolean') return { ok: true, value: (current as boolean) || (delta as boolean) };
            if (ct === 'null') return { ok: true, value: delta };
            if (ct === 'Array') return { ok: true, value: (current as unknown[]).concat(delta as unknown[]) };
            if (ct === 'number') return { ok: true, value: (current as number) + (delta as number) };
            if (ct === 'string') return { ok: true, value: (current as string) + String(delta) };
            return { ok: false, reason: `cannot ADD to a ${ct}` };
        case 'subtract':
            if (ct === 'boolean') return { ok: true, value: current !== delta };
            if (ct === 'null') return { ok: true, value: delta };
            if (ct === 'string') return { ok: true, value: (current as string).replace(String(delta), '') };
            if (ct === 'Array') {
                const next = [...(current as unknown[])];
                for (const element of delta as unknown[]) {
                    const index = next.findIndex(entry => JSON.stringify(entry) === JSON.stringify(element));
                    if (index !== -1) next.splice(index, 1);
                }
                return { ok: true, value: next };
            }
            if (ct === 'number') return { ok: true, value: (current as number) - (delta as number) };
            return { ok: false, reason: `cannot SUBTRACT from a ${ct}` };
        case 'multiply':
            if (ct === 'boolean') return { ok: true, value: (current as boolean) && (delta as boolean) };
            if (ct === 'number') return { ok: true, value: (current as number) * (delta as number) };
            return { ok: true, value: current };
        case 'override':
            return { ok: true, value: delta };
        case 'upgrade':
            return ct === 'number' || ct === 'boolean' ? { ok: true, value: (delta as number) > (current as number) ? delta : current } : { ok: true, value: current };
        case 'downgrade':
            return ct === 'number' || ct === 'boolean' ? { ok: true, value: (delta as number) < (current as number) ? delta : current } : { ok: true, value: current };
        default:
            return { ok: false, reason: `"${type}" needs a Foundry hook and is not applied` };
    }
}

/**
 * Applies one change to working system data like Foundry 14 `ActiveEffect.applyChange`
 * preceded by ShadowdarkSD `applyRules`. Unsupported input leaves data unchanged
 * and records why.
 */
export function applyEffectChange(kind: ActorKind, working: Record<string, any>, change: CanonicalChange,
    effect: CanonicalEffect, diagnostics: string[]): void {
    const label = `${effect.name} → ${change.key}`;
    // Shown with the Actor's diagnostics and under the effect on the Effects tab.
    const report = (message: string) => {
        diagnostics.push(message);
        if (!effect.diagnostics.includes(message)) effect.diagnostics.push(message);
    };
    if (!change.key.startsWith('system.')) {
        if (!change.key.startsWith('token.')) report(`${label}: only system data changes are prepared by SheetDelver.`);
        return;
    }
    // Pre-4.0 keys (native Update_251001_1): native 4.0.6 does not use them, so
    // neither does SheetDelver; the diagnostic names the native replacement.
    const migration = nativeKeyMigration(change, effect.owner.kind === 'item' ? effect.owner.itemType : undefined);
    if (migration) {
        report(`${label}: pre-4.0 key; native Shadowdark 4.0.6 ignores it. Its 4.0 equivalent is ${describeMigration(migration)}.`);
        return;
    }
    // ActiveEffectSD.applyRules rejects these keys (logged as invalid AE keys).
    if (change.key === 'system.attributes.ac' || isRejectedBonusesKey(change.key)) {
        report(`${label}: key rejected by native Shadowdark 4.0.6 and it has no native 4.0 equivalent.`);
        return;
    }
    const path = change.key.slice(7);
    const fields = kind === 'Player' ? PLAYER_FIELDS : kind === 'NPC' ? NPC_FIELDS : COMMON_FIELDS;
    const field = fields[path];
    let value: unknown = change.value;
    if (value) {
        const forceInt = field?.type === 'number' && field.integer === true;
        const resolved = resolveFormula(value, buildRollData(kind, working), { forceDeterministic: forceInt });
        if (resolved.ok) value = resolved.value;
        else if (forceInt) { report(`${label}: ${resolved.reason}`); return; }
        else if (typeof value === 'string' && value.includes('@') && !usesCompletedRollData(change.key)) report(`${label}: ${resolved.reason}`);
    }
    const current = getProperty(working, path);
    let result: ReturnType<typeof applyTyped>;
    if (field) {
        const delta = castDelta(value, field.type);
        if (field.type === 'number' && !Number.isFinite(delta as number)) { report(`${label}: value is not a number.`); return; }
        // Absent schema fields start at their native initial value.
        const base = current ?? (field.type === 'number' ? field.initial ?? 0 : field.type === 'boolean' ? false : '');
        result = applyTyped(base, delta, change.type);
        if (result.ok && field.type === 'number') {
            const number = result.value as number;
            if ((field.integer && !Number.isInteger(number)) || (field.min !== undefined && number < field.min)) {
                report(`${label}: result ${number} fails native field validation and is not applied.`);
                return;
            }
        }
    } else {
        const ct = typeOf(current);
        const delta = ct === 'Array'
            ? (Array.isArray(value) ? value : [value]).map(entry => castDelta(entry, typeOf((current as unknown[])[0] ?? '')))
            : castDelta(value, ct);
        result = applyTyped(current ?? null, delta, change.type);
    }
    if (!result.ok) { report(`${label}: ${result.reason}.`); return; }
    if (!setProperty(working, path, result.value)) report(`${label}: target path cannot be written.`);
}

function applyPhase(kind: ActorKind, working: Record<string, any>, effects: CanonicalEffect[], phase: string, diagnostics: string[]) {
    const entries = effects.filter(effect => effect.applies)
        .flatMap(effect => effect.changes.filter(change => change.phase === phase && change.key !== '').map(change => ({ effect, change })));
    entries.sort((a, b) => a.change.priority - b.change.priority);
    for (const { effect, change } of entries) applyEffectChange(kind, working, change, effect, diagnostics);
}

export function rollKeyItem(item: any, basics: PreparedItemBasics): RollKeyItem {
    return {
        id: basics.id, name: String(item?.name ?? ''), propertyNames: basics.propertyNames,
        baseWeapon: item?.type === 'Weapon' ? item?.system?.baseWeapon || undefined : undefined,
        baseArmor: item?.type === 'Armor' ? item?.system?.baseArmor || undefined : undefined,
        isArmor: item?.type === 'Armor',
    };
}

export function prepareItemBasics(item: any, lookups: PreparationLookups): PreparedItemBasics {
    const system = item?.system ?? {};
    const diagnostics: string[] = [];
    const properties: PreparedItemProperty[] = (Array.isArray(system.properties) ? system.properties : []).map((value: unknown) => {
        const ref = parseUuid(value);
        if (!ref || typeof value !== 'string') {
            // Bare legacy slugs remain explicit property names; nothing else is guessed.
            if (typeof value === 'string' && value && !value.includes('.')) return { ref: null, name: value, slug: slugify(value) };
            diagnostics.push(`Unsupported property reference ${String(value)}.`);
            return { ref: null, name: null, slug: null };
        }
        const name = lookups.propertyName?.(value) ?? null;
        if (!name) diagnostics.push(`Unresolved property ${value}; it is not in the declared property index.`);
        return { ref, name, slug: name ? slugify(name) : null };
    });
    const physical = PHYSICAL_TYPES.has(item?.type);
    const slots = system.slots ?? {};
    const quantity = finiteNumber(system.quantity) ?? 1;
    const perSlot = finiteNumber(slots.per_slot) ?? 1;
    const slotsUsedEach = finiteNumber(slots.slots_used) ?? 1;
    return {
        id: documentId(item), name: String(item?.name ?? ''), type: String(item?.type ?? ''), source: sourceRef(item),
        physical, equipped: system.equipped === true, stashed: system.stashed === true, quantity,
        // _PhysicalItemSD.slotsUsed
        slotsUsed: physical ? Math.ceil(quantity / perSlot) * slotsUsedEach : 0,
        freeCarry: finiteNumber(slots.free_carry) ?? 0,
        treasure: system.treasure === true, gem: item?.type === 'Gem', ammunition: system.isAmmunition === true,
        identified: system.identification?.identified ?? true,
        magicItem: system.magicItem === true || ['Scroll', 'Wand', 'Potion'].includes(item?.type),
        broken: system.broken === true, lost: system.lost === true, lightSource: system.light?.isSource === true,
        properties, propertyNames: properties.flatMap(property => property.slug ? [property.slug] : []), diagnostics,
    };
}

/** ActorBaseSD.getSlotUsage over non-stashed physical items, in source order. */
function slotUsage(items: Array<{ item: any; basics: PreparedItemBasics }>, coins: any, gemsPerSlot = 10, freeCoins = 100) {
    const usage = { coins: 0, gear: 0, gems: 0, treasure: 0, total: 0 };
    if (coins) {
        const total = (finiteNumber(coins.gp) ?? 0) + (finiteNumber(coins.sp) ?? 0) + (finiteNumber(coins.cp) ?? 0);
        if (total > freeCoins) usage.coins = Math.ceil((total - freeCoins) / freeCoins);
    }
    const seen: Record<string, number> = {};
    let gemCount = 0;
    const ordered = [...items].sort((a, b) => (finiteNumber(a.item?.sort) ?? 0) - (finiteNumber(b.item?.sort) ?? 0));
    for (const { item, basics } of ordered) {
        if (!basics.physical || basics.stashed) continue;
        if (basics.gem) { gemCount++; continue; }
        let freeCarry = basics.freeCarry;
        if (Object.hasOwn(seen, basics.name)) {
            freeCarry = Math.max(0, freeCarry - seen[basics.name]);
            seen[basics.name] += freeCarry;
        } else seen[basics.name] = freeCarry;
        const used = basics.slotsUsed - freeCarry * (finiteNumber(item?.system?.slots?.slots_used) ?? 1);
        if (basics.treasure) usage.treasure += used; else usage.gear += used;
    }
    if (gemCount > 0) usage.gems = Math.ceil(gemCount / gemsPerSlot);
    usage.total = usage.gear + usage.treasure + usage.coins + usage.gems;
    return usage;
}

/** PlayerSD._calcArmorClass with native best-armor and bonus-armor rules. */
function playerArmorClass(effects: CanonicalEffect[], rollData: unknown, abilities: Record<AbilityKey, PreparedAbility>,
    armors: Array<{ item: any; basics: PreparedItemBasics }>, diagnostics: string[]): number {
    const baseAC = 10 + abilities.dex.mod;
    const equipped = armors.filter(({ basics }) => basics.equipped);
    let unarmored = true;
    let best = baseAC;
    for (const { item, basics } of equipped.filter(({ item }) => item?.system?.ac?.base)) {
        unarmored = false;
        const ac = item.system.ac;
        const armorAC = (finiteNumber(ac.base) ?? 0) + (abilities[ac.attribute as AbilityKey]?.mod ?? 0) + (finiteNumber(ac.modifier) ?? 0);
        const total = getActiveEffectKeys(effects, rollData, 'attributes.ac', armorAC, rollKeyItem(item, basics));
        diagnostics.push(...total.diagnostics);
        const value = numericKey(total, `${basics.name} AC`);
        if (value !== null && value > best) best = value;
    }
    let bonus = 0;
    for (const { item, basics } of equipped.filter(({ item }) => !item?.system?.ac?.base)) {
        unarmored = false;
        const result = getActiveEffectKeys(effects, rollData, 'attributes.ac', Number(item?.system?.ac?.modifier ?? 0), rollKeyItem(item, basics));
        diagnostics.push(...result.diagnostics);
        bonus += numericKey(result, `${basics.name} AC bonus`) ?? 0;
    }
    let total: number;
    if (unarmored) {
        const result = getActiveEffectKeys(effects, rollData, 'attributes.ac.unarmored', baseAC);
        diagnostics.push(...result.diagnostics);
        total = numericKey(result, 'Unarmored AC') ?? baseAC;
    } else total = best + bonus;
    const final = getActiveEffectKeys(effects, rollData, 'attributes.ac.value', total);
    diagnostics.push(...final.diagnostics);
    return numericKey(final, 'AC') ?? total;
}

export function prepareActorCore(source: any, lookups: PreparationLookups = {}, rules: RuleInputs = UNAVAILABLE_RULE_INPUTS): PreparedActorCore {
    const kind = actorKind(source);
    const diagnostics: string[] = [];
    const working = migrateSystem(kind, source?.system);
    const effects = collectEffects(source);
    for (const effect of effects) diagnostics.push(...effect.diagnostics.map(message => `${effect.name}: ${message}`));
    const items = (Array.isArray(source?.items) ? source.items : []).map((item: any) => ({ item, basics: prepareItemBasics(item, lookups) }));

    // prepareBaseData
    if (kind === 'Player') {
        working.slots = 10;
        working.spellcasting = { classes: [], allowAllItems: false, itemAbility: '' };
    }
    applyPhase(kind, working, effects, 'initial', diagnostics);
    const unknownPhases = new Set(effects.filter(effect => effect.applies).flatMap(effect => effect.changes)
        .map(change => change.phase).filter(phase => phase !== 'initial' && phase !== 'final'));
    for (const phase of unknownPhases) diagnostics.push(`ActiveEffect phase "${phase}" is not registered by Shadowdark and is not applied.`);

    const abilityFrom = (): Record<AbilityKey, PreparedAbility> => Object.fromEntries(ABILITY_KEYS.map(key => {
        if (kind === 'NPC') {
            const mod = finiteNumber(working.abilities?.[key]?.mod);
            return [key, { value: null, mod: mod ?? 0, source: 'npc-modifier' as const }];
        }
        const score = finiteNumber(working.abilities?.[key]?.value);
        if (score === null && kind === 'Player') diagnostics.push(`${key.toUpperCase()} score is absent; native schema initial 10 is used.`);
        const value = score ?? 10;
        return [key, { value, mod: playerModifier(value), source: 'score' as const }];
    })) as Record<AbilityKey, PreparedAbility>;

    let abilities = abilityFrom();
    let ac: number;
    let maxSlots: number | null = null;
    if (kind === 'Player') {
        // prepareDerivedData
        const armors = items.filter(({ item }: any) => item?.type === 'Armor');
        ac = playerArmorClass(effects, buildRollData(kind, working), abilities, armors, diagnostics);
        setProperty(working, 'attributes.ac.value', ac);
        working.slots = (finiteNumber(working.slots) ?? 10) + Math.max(0, (abilities.str.value ?? 10) - 10);
        const spellcasting = working.spellcasting ?? {};
        // Native prose grants (including non-caster boons) are module-prepared rules;
        // source effects remain untouched. Resolve casting ability from the exact Class.
        const grantedClasses = spellGrantCastingRefs(items.map(({ item }: any) => item)).flatMap(uuid => {
            const ref = parseUuid(uuid), cls = ref ? lookups.classDocument?.(ref) : null;
            return cls?.system?.spellcasting?.ability ? [slugify(cls.name ?? '')] : [];
        });
        spellcasting.classes = [...new Set([...(Array.isArray(spellcasting.classes) ? spellcasting.classes : []), ...grantedClasses])].sort();
        spellcasting.allowAllItems = !!spellcasting.allowAllItems;
        if (spellcasting.itemAbility && !ABILITY_KEYS.includes(spellcasting.itemAbility)) spellcasting.itemAbility = '';
    }
    applyPhase(kind, working, effects, 'final', diagnostics);
    // Validate roll references when their consumers do, without reordering or
    // reapplying Actor changes. Keep genuine failures visible on the Effects tab,
    // including situational effects which have not been selected for a roll yet.
    const completedRollData = buildRollData(kind, working);
    for (const effect of effects.filter(effect => effect.applies)) for (const change of effect.changes) {
        if (!['initial', 'final'].includes(change.phase) || !usesCompletedRollData(change.key)
            || typeof change.value !== 'string' || !change.value.includes('@')) continue;
        const resolved = resolveFormula(change.value, completedRollData);
        if (!resolved.ok) {
            const message = `${effect.name} → ${change.key}: ${resolved.reason}`;
            diagnostics.push(message);
            if (!effect.diagnostics.includes(message)) effect.diagnostics.push(message);
        }
    }
    abilities = abilityFrom();
    if (kind === 'Player') {
        ac = finiteNumber(working.attributes?.ac?.value) ?? 10;
        maxSlots = finiteNumber(working.slots) ?? 10;
    } else {
        ac = finiteNumber(working.attributes?.ac?.value) ?? 10;
    }

    const spellcasting = kind === 'NPC'
        ? { ability: String(working.spellcasting?.ability ?? ''), bonus: finiteNumber(working.spellcasting?.bonus) ?? 0, attacks: finiteNumber(working.spellcasting?.attacks) ?? 0 }
        : { classes: (working.spellcasting?.classes ?? []) as string[], allowAllItems: !!working.spellcasting?.allowAllItems, itemAbility: String(working.spellcasting?.itemAbility ?? '') };

    // ActorBaseSD._modifyRollData initiative: DEX mod + roll.initiative.bonus, signed advantage.
    const initiative = {
        value: abilities.dex.mod + (finiteNumber(working.roll?.initiative?.bonus) ?? 0),
        advantage: finiteNumber(working.roll?.initiative?.advantage) ?? 0,
    };

    for (const { basics } of items as Array<{ basics: PreparedItemBasics }>) diagnostics.push(...basics.diagnostics.map((message: string) => `${basics.name}: ${message}`));
    return {
        kind, effective: working, level: finiteNumber(working.level?.value) ?? 0, abilities,
        hp: { value: finiteNumber(working.attributes?.hp?.value) ?? 0, max: finiteNumber(working.attributes?.hp?.max) ?? 0 },
        ac, acSource: kind === 'Player' ? 'prepared-armor' : 'npc-explicit', maxSlots,
        slotUsage: kind === 'Player' ? slotUsage(items, working.coins) : null,
        spellcasting, initiative, effects, items: items.map(({ basics }: any) => basics), rules, diagnostics,
    };
}
