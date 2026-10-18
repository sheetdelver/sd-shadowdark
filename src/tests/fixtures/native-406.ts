/**
 * Minimal mechanical extracts from released native Shadowdark 4.0.6
 * (tag release-4.0.6, commit 9677d16b3903b3b640f00d4efd48249142ac8334).
 * Descriptions are omitted; only the fields used by the rules are kept.
 *
 * Source files (relative to the native repository):
 * - data/packs/gear.db/longsword__ZPUhNMmwXXrtbCXi.json
 * - data/packs/talents.db/weapon_mastery__5bpWuaT0KTNzuzCu.json (+ effect E7SwrOhzSAyMZ1Ec)
 * - data/packs/gear.db/shield__UWp4WkkiaBMSXYPE.json, leather_armor__EoTEHXApVDS7rHfw.json
 *
 * The v14 serialized effect below is what Foundry 14 `BaseActiveEffect.migrateData`
 * produces from the pack's legacy effect: `changes` moves to `system.changes`, numeric
 * `mode: 2` becomes `type: "add"`, `phase` defaults to "initial" and a non-JSON string
 * value is kept. It matches the operator issue-23 excerpt. This is a synthetic
 * Prim-like Actor, not a captured Prim document.
 */

export const LONGSWORD_UUID = 'Compendium.shadowdark.gear.Item.ZPUhNMmwXXrtbCXi';
export const MASTERY_UUID = 'Compendium.shadowdark.talents.Item.5bpWuaT0KTNzuzCu';
export const FIGHTER_UUID = 'Compendium.shadowdark.classes.Item.hO7KrvqDRH6kvftJ';

export const longsword = () => ({
    _id: 'primLongsword', name: 'Longsword', type: 'Weapon',
    system: {
        damage: { oneHanded: 'd8', twoHanded: '' }, properties: [], handedness: null,
        type: 'melee', range: 'close', baseWeapon: '', magicItem: false, equipped: true,
        stashed: false, quantity: 1, slots: { free_carry: 0, per_slot: 1, slots_used: 1 },
        identification: { identified: true, name: '', description: '' },
    },
    effects: [],
    flags: { core: { sourceId: LONGSWORD_UUID } },
});

/** Native talent after a Longsword choice: `REPLACEME` replaced in keys only. */
export const v14Mastery = (overrides: Record<string, unknown> = {}) => ({
    _id: 'primMastery', name: 'Weapon Mastery (Longsword)', type: 'Talent',
    system: { level: 1, talentClass: 'class', properties: [] },
    flags: { core: { sourceId: MASTERY_UUID } },
    effects: [{
        _id: 'primMasteryEffect', name: 'Weapon Mastery', type: 'base', transfer: true, disabled: false,
        origin: null, statuses: [], flags: {}, img: 'icons/skills/melee/weapons-crossed-swords-white-blue.webp',
        system: { changes: [
            { key: 'system.roll.melee.bonus.longsword', type: 'add', value: '1+floor(@level.value/2)', phase: 'initial', priority: null },
            { key: 'system.roll.melee.damage.longsword', type: 'add', value: '1+floor(@level.value/2)', phase: 'initial', priority: null },
        ] },
        ...overrides,
    }],
});

/** The same talent in the legacy (v13 / pack source) shape. */
export const legacyMastery = () => {
    const talent: any = v14Mastery();
    const effect = talent.effects[0];
    effect.changes = effect.system.changes.map(({ key, value }: any) => ({ key, mode: 2, value, priority: null }));
    effect.system = {};
    return talent;
};

/** Native `system.abilities.<k>.value` scores (PlayerSD attributeModel). */
export const primLike = (talent: any = v14Mastery()) => ({
    _id: 'primLike', name: 'Prim-like Fighter', type: 'Player', systemId: 'shadowdark',
    system: {
        abilities: { str: { value: 9 }, dex: { value: 10 }, con: { value: 12 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } },
        attributes: { ac: { value: 10 }, hp: { value: 8, max: 8 } },
        level: { value: 1, xp: 0 }, alignment: 'lawful', class: FIGHTER_UUID,
        coins: { gp: 0, sp: 0, cp: 0 }, languages: [], luck: { remaining: 0, available: false }, slots: 10,
    },
    items: [longsword(), talent],
    effects: [],
});

/** Host projection index: declared pack rows Core can resolve to names. */
export const hostIndex: Record<string, string> = {
    [LONGSWORD_UUID]: 'Longsword',
    [MASTERY_UUID]: 'Weapon Mastery',
    [FIGHTER_UUID]: 'Fighter',
};

/**
 * Test replica of Core 0.19.0 `ActorService` Actor responses (Core ADR-0064 G7):
 * canonical source strings are kept and `referenceLabels` maps each declared
 * compendium UUID the caller may read to its name. A boundary simulator, not
 * Core code.
 */
export function coreActorResponse<T extends object>(prepared: T, index: Record<string, string> = hostIndex,
    canReadPack: (pack: string) => boolean = () => true): T & { referenceLabels: Record<string, string> } {
    const referenceLabels: Record<string, string> = {};
    const collect = (value: unknown): void => {
        if (typeof value === 'string') {
            const pack = value.startsWith('Compendium.') ? value.split('.').slice(1, 3).join('.') : null;
            if (pack && index[value] && canReadPack(pack)) referenceLabels[value] = index[value];
        } else if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    const response = JSON.parse(JSON.stringify(prepared));
    collect(response);
    return { ...response, referenceLabels };
}

/**
 * Test replica of Core 0.18.1 `ActorService.getActorById/resolveUUIDs`
 * (src/server/services/actors/ActorService.ts): every string beginning with
 * `Compendium.` whose pack index contains the document becomes that document's
 * name, recursively, after JSON serialization. It is a boundary simulator for
 * SD01-05, not Core code; unknown UUIDs stay unchanged as in Core.
 */
export function hostActorProjection<T>(prepared: T, index: Record<string, string> = hostIndex): T {
    const rewrite = (value: unknown): unknown => {
        if (typeof value === 'string') return value.startsWith('Compendium.') ? index[value] ?? value : value;
        if (Array.isArray(value)) return value.map(rewrite);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
        return value;
    };
    return rewrite(JSON.parse(JSON.stringify(prepared))) as T;
}

export const preparationContext = Object.freeze({
    worldEpoch: 1, sourceRevision: 1, systemId: 'shadowdark', systemVersion: '4.0.6',
    moduleId: 'shadowdark', moduleVersion: '0.9.4',
});

/**
 * A Core world snapshot (module-api 1.5 `ModuleWorldSnapshot`) as Core resolves
 * this module's two declared settings: `world` for a stored row, or
 * `registered-default` with the declared native default (usePulpMode false,
 * autoConsumeAmmunition true) when the world has none.
 */
export function worldSnapshot(revision: number, stored: { usePulpMode?: unknown; autoConsumeAmmunition?: unknown } = {},
    unavailable: Partial<Record<'usePulpMode' | 'autoConsumeAmmunition', string>> = {}) {
    const result = (name: 'usePulpMode' | 'autoConsumeAmmunition', fallback: boolean) => unavailable[name]
        ? { status: 'unavailable', reason: unavailable[name] }
        : name in stored ? { status: 'world', value: stored[name] } : { status: 'registered-default', value: fallback };
    return {
        identity: { instanceId: 'fixture', worldId: 'fixture-world', systemId: 'shadowdark', systemVersion: '4.0.6', foundryGeneration: 14,
            foundryBuild: '367', runtimeEpoch: 1, contextRevision: revision },
        settings: {
            'shadowdark.usePulpMode': result('usePulpMode', false),
            'shadowdark.autoConsumeAmmunition': result('autoConsumeAmmunition', true),
        },
    };
}

/** Preparation context carrying a world snapshot, as Core supplies it (ADR-0064). */
export const contextWith = (world: ReturnType<typeof worldSnapshot>) =>
    Object.freeze({ ...preparationContext, world, contextRevision: world.identity.contextRevision }) as any;

/**
 * Attack-mode extracts (native 4.0.6 data/packs): gear.db/dagger__C3mc5OlKPSJNMrng.json,
 * bastard_sword__1T8oUkfkBtYTLNF3.json, shield__UWp4WkkiaBMSXYPE.json and the
 * properties.db Finesse, Thrown, Versatile, Shield and Occupies One Hand rows.
 */
export const PROPERTY_NAMES: Record<string, string> = {
    'Compendium.shadowdark.properties.Item.rqQwpoeWEqi0ZcYK': 'Finesse',
    'Compendium.shadowdark.properties.Item.c35ROL1nXwC840kC': 'Thrown',
    'Compendium.shadowdark.properties.Item.qEIYaQ9j2EUmSrx6': 'Versatile',
    'Compendium.shadowdark.properties.Item.61gM0DuJQwLbIBwu': 'Shield',
    'Compendium.shadowdark.properties.Item.jq0m0lGb7QOCSJXL': 'Occupies One Hand',
    'Compendium.shadowdark.properties.Item.b6Gm2ULKj2qyy2xJ': 'Two-Handed',
};

const gear = (id: string, name: string, type: string, system: Record<string, unknown>) => ({
    _id: id, name, type, effects: [],
    system: { equipped: true, stashed: false, quantity: 1, slots: { free_carry: 0, per_slot: 1, slots_used: 1 },
        identification: { identified: true, name: '', description: '' }, magicItem: false, ...system },
});
export const dagger = (system: Record<string, unknown> = {}) => gear('dagger', 'Dagger', 'Weapon', {
    damage: { oneHanded: 'd4', twoHanded: '' }, handedness: null, type: 'melee', range: 'near',
    properties: ['Compendium.shadowdark.properties.Item.rqQwpoeWEqi0ZcYK', 'Compendium.shadowdark.properties.Item.c35ROL1nXwC840kC'], ...system,
});
export const bastardSword = (system: Record<string, unknown> = {}) => gear('bastard', 'Bastard Sword', 'Weapon', {
    damage: { oneHanded: 'd8', twoHanded: 'd10' }, handedness: null, type: 'melee', range: 'close',
    properties: ['Compendium.shadowdark.properties.Item.qEIYaQ9j2EUmSrx6'], ...system,
});
export const shield = (system: Record<string, unknown> = {}) => gear('shield', 'Shield', 'Armor', {
    ac: { attribute: '', base: 0, modifier: 2 },
    properties: ['Compendium.shadowdark.properties.Item.jq0m0lGb7QOCSJXL', 'Compendium.shadowdark.properties.Item.61gM0DuJQwLbIBwu'], ...system,
});
/** STR 14 (+2), DEX 14 (+2) level-1 Player carrying the given items. */
export const armsman = (items: unknown[]) => ({
    _id: 'armsman', name: 'Armsman', type: 'Player', effects: [], items,
    system: {
        abilities: { str: { value: 14 }, dex: { value: 14 }, con: { value: 10 }, int: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } },
        attributes: { ac: { value: 10 }, hp: { value: 6, max: 6 } }, level: { value: 1, xp: 0 }, alignment: 'neutral',
        coins: { gp: 0, sp: 0, cp: 0 }, languages: [], luck: { remaining: 0, available: false }, slots: 10,
    },
});

/** gear.db/greatsword__eqUuf9OGupuGPsBM.json (Two-Handed, d12). */
export const greatsword = (system: Record<string, unknown> = {}) => gear('greatsword', 'Greatsword', 'Weapon', {
    damage: { oneHanded: '', twoHanded: 'd12' }, handedness: null, type: 'melee', range: 'close',
    properties: ['Compendium.shadowdark.properties.Item.b6Gm2ULKj2qyy2xJ'], ...system,
});
/** gear.db/torch__z3xc7HGysC4ZCU8e.json and lantern__lCWOUkVp4N1geMRt.json (`isSource` false natively). */
const lightData = (isSource: boolean, light: Record<string, unknown>) => ({
    equipped: false, light: { active: false, hasBeenUsed: false, isSource, longevityMins: 60, remainingSecs: 3600, template: 'torch', ...light },
});
export const torch = (id = 'torch', light: Record<string, unknown> = {}) => gear(id, 'Torch', 'Basic', lightData(true, light));
export const lantern = () => gear('lantern', 'Lantern', 'Basic', lightData(false, {}));
