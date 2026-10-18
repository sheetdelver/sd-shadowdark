import assert from 'node:assert/strict';
import { ShadowdarkAdapter, shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { ShadowdarkRegistry } from '../server/Registry';
import { ruleInputsFrom, UNAVAILABLE_RULE_INPUTS } from '../logic/world-settings';
import { prepareActorCore } from '../logic/actor-preparation';
import { planConsequences, prepareWeaponAction } from '../logic/actions';
import { handleLuck } from '../server/api/luck';
import { handleActorAction } from '../server/api/actions';
import { handleGetDocument } from '../server/api/document';
import { handleGetCollection } from '../server/api/collections';
import { handleIndex } from '../server/api/index';
import { handleGetSpellsBySource } from '../server/api/spells';
import { contextWith, primLike, worldSnapshot } from './fixtures/native-406';

/**
 * ADR-0001 G8 adoption regressions (Core v0.19.0 contracts), module side:
 * authoritative world settings (G8-A), dependency refresh and replay safety
 * (G8-C) and caller-capability projections (G8-D). The host is simulated with
 * SDK-shaped request runtimes here; the audit records the separate actual-host
 * checks. Expected values come from native 4.0.6 settings/ItemSD/PlayerSD.
 */
type Result = { id: string; name: string; ok: boolean; detail?: string };
const results: Result[] = [];
async function check(id: string, name: string, fn: () => unknown | Promise<unknown>) {
    try { await fn(); results.push({ id, name, ok: true }); }
    catch (error) { results.push({ id, name, ok: false, detail: (error as Error).message.split('\n').slice(0, 6).join(' ') }); }
}

const params = (route: string[]) => ({ params: Promise.resolve({ route }) }) as any;
async function statusOf(response: any) {
    const body = typeof response?.json === 'function' ? await response.json() : response?.body;
    return { status: response?.status ?? 200, body };
}
/** Core's request-runtime capability (module-api 1.5) under a mutable test policy. */
const packAccess = (allowed: (pack: string) => boolean) => ({ canReadPack: (pack: string) => allowed(pack), packs: () => [] });
/** Core's request-runtime world handle over a fixed snapshot. */
const worldHandle = (snapshot: ReturnType<typeof worldSnapshot>) => ({
    snapshot: () => snapshot,
    settings: { get: (key: string) => (snapshot.settings as any)[key] ?? { status: 'unavailable', reason: 'undeclared' } },
    assertRevision: (revision: number) => { if (revision !== snapshot.identity.contextRevision) throw new Error('World context changed; refresh this action'); },
});

const SPELL = { _id: 'sp1', name: 'Light', type: 'Spell', pack: 'shadowdark.spells', uuid: 'Compendium.shadowdark.spells.Item.sp1',
    system: { tier: 1, class: ['Compendium.shadowdark.classes.Item.wiz'] } };
const WIZARD = { _id: 'wiz', name: 'Wizard', type: 'Class', pack: 'shadowdark.classes', uuid: 'Compendium.shadowdark.classes.Item.wiz',
    system: { titles: [{ from: 1, to: 2, lawful: 'Apprentice' }], spellcasting: { ability: 'int' } } };
const OGRE = { _id: 'ogre', name: 'Ogre', type: 'NPC', pack: 'shadowdark.monsters', uuid: 'Compendium.shadowdark.monsters.Actor.ogre', items: [], system: {} };
const TABLE = { _id: 't1', name: 'Talents', type: 'RollTable', pack: 'shadowdark.rollable-tables', uuid: 'Compendium.shadowdark.rollable-tables.RollTable.t1',
    formula: '1d1', results: [{ range: [1, 1], documentUuid: SPELL.uuid, text: 'Light' }] };

/** Pack rows as Core's privileged reader returns them; the warmed registry is built from these. */
function packReader(rows: any[], gate?: Promise<void>) {
    return { findAll: async (type: string) => { await gate; return structuredClone(rows.filter(row => (row.type === 'NPC' ? 'Actor' : row.type === 'RollTable' ? 'RollTable' : 'Item') === type)); },
        findOne: async () => null, getById: async () => null };
}

async function settings() {
    await check('G8-A', 'rule inputs distinguish world, registered-default and unavailable, and keep a stored false', () => {
        const inputs = ruleInputsFrom(worldSnapshot(3, { usePulpMode: false }));
        assert.deepEqual(inputs.usePulpMode, { status: 'world', value: false });
        assert.deepEqual(inputs.autoConsumeAmmunition, { status: 'registered-default', value: true });
        assert.equal(inputs.contextRevision, 3);
        assert.equal(ruleInputsFrom(worldSnapshot(4, { usePulpMode: 'true' })).usePulpMode.status, 'unavailable', 'a non-Boolean is invalid');
        assert.equal(ruleInputsFrom(worldSnapshot(5, {}, { usePulpMode: 'unsupported-version' })).usePulpMode.value, null);
        assert.equal(ruleInputsFrom({ settings: {} }).usePulpMode.status, 'unavailable', 'an undeclared key is not a default');
        assert.deepEqual(ruleInputsFrom(null), UNAVAILABLE_RULE_INPUTS);
    });
    // ItemSD.usesAmmunition: the setting && owned Player Weapon && ammoClass. Reading the
    // setting does not make SheetDelver consume ammunition.
    const bow = { _id: 'bow', name: 'Shortbow', type: 'Weapon', system: { type: 'ranged', range: 'far', ammoClass: 'arrow', equipped: true,
        damage: { oneHanded: 'd4', twoHanded: '' }, properties: [] }, effects: [] };
    const actor = { ...primLike(), items: [bow] };
    const attack = (snapshot: ReturnType<typeof worldSnapshot> | null) => {
        const core = prepareActorCore(actor, {}, ruleInputsFrom(snapshot));
        return prepareWeaponAction(core, bow, { attackType: 'ranged' });
    };
    await check('G8-A', 'ammunition: the setting decides the stated consequence; nothing is consumed', () => {
        const on = attack(worldSnapshot(6));
        assert.match(on.consequences.map(entry => entry.description).join(' '), /uses one arrow ammunition per attack.*does not consume/);
        assert.deepEqual(planConsequences(on, bow, null), [], 'no ammunition write is planned');
        assert.deepEqual(attack(worldSnapshot(7, { autoConsumeAmmunition: false })).consequences, [], 'off: native uses none');
        const unknown = attack(worldSnapshot(8, {}, { autoConsumeAmmunition: 'not-ready' }));
        assert.deepEqual(unknown.consequences, []);
        assert.ok(unknown.diagnostics.some(message => /ammunition is unknown/.test(message)));
    });
    await check('G8-A', 'preparation records the rule inputs and revision it used; roll data re-prepares with them', () => {
        const adapter = new ShadowdarkAdapter();
        const prepared: any = adapter.prepareActorData(structuredClone(actor) as any, contextWith(worldSnapshot(9, { autoConsumeAmmunition: false })));
        assert.equal(prepared.derived.ruleInputs.contextRevision, 9);
        assert.deepEqual(prepared.derived.ruleInputs.autoConsumeAmmunition, { status: 'world', value: false });
        // An option-dependent request re-prepares with the Actor's own revision, not the adapter's current one.
        const roll = adapter.getRollData(prepared, 'item', 'bow', { attackType: 'ranged', selected: ['x'] });
        assert.ok(roll?.formula);
    });
}

async function projections() {
    const rows = [SPELL, WIZARD, OGRE, TABLE];
    const registry = (shadowdarkAdapter as any)._registry as ShadowdarkRegistry;
    registry.attach(packReader(rows) as any, { fetchByUuid: async () => null } as any);
    let allowSpells = true;
    // This world restricts monsters from the player and, mid-test, revokes spells.
    const player = () => ({ runtime: { documents: { get: async () => null, list: async () => ({ rows: [], total: 0 }), fetchByUuid: async () => null },
        compendium: packReader(rows), access: packAccess(pack => pack !== 'shadowdark.monsters' && (allowSpells || pack !== 'shadowdark.spells')) },
        url: 'http://localhost/x?class=Compendium.shadowdark.classes.Item.wiz', userSession: { userId: 'p1', isGM: false } }) as any;
    const gm = () => ({ ...player(), runtime: { ...player().runtime, access: packAccess(() => true) }, userSession: { userId: 'gm', isGM: true } }) as any;

    await check('G8-D', 'getSystemDataForUser builds from the caller reads and rechecks every row', async () => {
        const warm = registry.getSystemData;
        (registry as any).getSystemData = async () => { throw new Error('the privileged projection must not be used'); };
        try {
            const data: any = await shadowdarkAdapter.getSystemDataForUser({ ...player().runtime, world: undefined });
            assert.equal(data.nameIndex[SPELL.uuid], 'Light');
            assert.equal(data.nameIndex[OGRE.uuid], undefined, 'a restricted pack row is dropped even when the read returned it');
            assert.deepEqual(data.titles.Wizard, WIZARD.system.titles);
            assert.ok(Object.keys(data.nameIndex).every(uuid => uuid.startsWith('Compendium.shadowdark.')), 'canonical UUID keys');
            const viaRoute = (await statusOf(await handleIndex(player()))).body;
            assert.deepEqual(viaRoute.nameIndex, data.nameIndex, 'the module index route serves the same projection');
        } finally { (registry as any).getSystemData = warm; }
    });
    await check('G8-D', 'a GM-warmed projection is not served to a player; capability applies to every pack', async () => {
        assert.equal((await statusOf(await handleGetDocument(gm(), params(['document', OGRE.uuid])))).body.name, 'Ogre');
        assert.equal((await statusOf(await handleGetDocument(player(), params(['document', OGRE.uuid])))).status, 403);
        assert.equal((await statusOf(await handleGetCollection(player(), 'monsters'))).status, 403);
        allowSpells = false;
        try {
            assert.equal((await statusOf(await handleGetDocument(player(), params(['document', SPELL.uuid])))).status, 403, 'revocation applies to a warm cache');
            assert.equal((await statusOf(await handleGetCollection(player(), 'spells'))).status, 403);
            assert.deepEqual((await statusOf(await handleGetSpellsBySource(player()))).body.spells, [], 'class spell list follows the capability');
            assert.equal(await shadowdarkAdapter.drawTable(TABLE.uuid, { runtime: player().runtime, isGM: false }).then((draw: any) => draw.items.length), 0,
                'a drawn result in a revoked pack is not hydrated');
            assert.deepEqual(await shadowdarkAdapter.findUniqueByName('Light', ['Spell'], { runtime: player().runtime, isGM: false }), { doc: null, ambiguous: [] });
        } finally { allowSpells = true; }
        assert.equal((await statusOf(await handleGetDocument(player(), params(['document', SPELL.uuid])))).body.name, 'Light');
    });
    await check('G8-D', 'access revoked while a cache read is awaited is denied after the read', async () => {
        const getDocument = registry.getDocument.bind(registry);
        let reads = 0;
        // The capability holds when the read starts and is revoked while it is awaited.
        (registry as any).getDocument = async (uuid: string) => { reads++; allowSpells = false; await Promise.resolve(); return getDocument(uuid); };
        try {
            const response = await statusOf(await handleGetDocument(player(), params(['document', SPELL.uuid])));
            assert.equal(reads, 1, 'the read started under the capability');
            assert.equal(response.status, 403);
            assert.doesNotMatch(JSON.stringify(response.body), /Light/);
        } finally { (registry as any).getDocument = getDocument; allowSpells = true; }
    });
    await check('G8-D', 'a runtime without Core capabilities is denied, not allowed', async () => {
        const bare = { ...player(), runtime: { ...player().runtime, access: undefined } };
        assert.equal((await statusOf(await handleGetDocument(bare, params(['document', SPELL.uuid])))).status, 403);
        const data: any = await shadowdarkAdapter.getSystemDataForUser({ ...bare.runtime, world: undefined });
        assert.deepEqual(data.nameIndex, {});
    });
}

async function refresh() {
    await check('G8-C', 'a setting-only change does not reload packs; a pack change or recovery rebuilds before returning', async () => {
        const adapter = shadowdarkAdapter as any;
        const registry = adapter._registry as ShadowdarkRegistry;
        let rows: any[] = [SPELL];
        registry.attach({ findAll: async (type: string) => type === 'Item' ? structuredClone(rows) : [] } as any, { fetchByUuid: async () => null } as any);
        await registry.getSystemData();
        const generation = adapter.runtimeGeneration;
        rows = [{ ...SPELL, name: 'Light (errata)' }];
        await adapter.onWorldContextChanged(worldSnapshot(20), { keys: ['shadowdark.usePulpMode'], recovery: false, packs: [] });
        assert.equal(registry.getCachedDocument(SPELL.uuid)?.name, 'Light', 'settings reach preparation through context.world only');
        await adapter.onWorldContextChanged(worldSnapshot(21), { keys: [], recovery: false, packs: ['shadowdark.spells'] });
        assert.equal(registry.getCachedDocument(SPELL.uuid)?.name, 'Light (errata)', 'synchronous lookups are current before Core rebuilds');
        rows = [{ ...SPELL, name: 'Light (recovered)' }];
        await adapter.onWorldContextChanged(worldSnapshot(22), { keys: [], recovery: true });
        assert.equal(registry.getCachedDocument(SPELL.uuid)?.name, 'Light (recovered)', 'same-world recovery refreshes without initialize');
        assert.equal(adapter.runtimeGeneration, generation, 'recovery keeps request identity');
    });
    await check('G8-C', 'a load started before a refresh cannot publish over the refreshed projection', async () => {
        const registry = new ShadowdarkRegistry();
        let release!: () => void;
        const slow = new Promise<void>(resolve => { release = resolve; });
        let call = 0;
        registry.attach({ findAll: async (type: string) => {
            if (type !== 'Item') return [];
            const mine = ++call;
            if (mine === 1) { await slow; return [{ ...SPELL, name: 'Stale' }]; }
            return [{ ...SPELL, name: 'Fresh' }];
        } } as any, { fetchByUuid: async () => null } as any);
        const stale = registry.getSystemData();
        await registry.refresh();
        release();
        await stale;
        assert.equal(registry.getCachedDocument(SPELL.uuid)?.name, 'Fresh');
    });
    await check('G8-C', 'a failed refresh rejects so Core keeps the world unavailable', async () => {
        const registry = (shadowdarkAdapter as any)._registry as ShadowdarkRegistry;
        registry.attach({ findAll: async () => { throw new Error('pack read failed'); } } as any, { fetchByUuid: async () => null } as any);
        await assert.rejects(() => shadowdarkAdapter.onWorldContextChanged(worldSnapshot(23) as any, { keys: [], recovery: false, packs: ['shadowdark.spells'] }), /pack read failed/);
    });
}

function ownerRuntime(actor: any, snapshot: ReturnType<typeof worldSnapshot>) {
    const writes: any[] = [];
    let rolls = 0;
    const runtime: any = {
        world: worldHandle(snapshot),
        access: packAccess(() => true),
        documents: {
            get: async (type: string, id: string) => type === 'Actor' && id === actor._id ? structuredClone(actor) : null,
            patch: async (...args: any[]) => { writes.push(['patch', ...args]); return {}; },
            items: {
                update: async (...args: any[]) => { writes.push(['item.update', ...args]); return {}; },
                delete: async (...args: any[]) => { writes.push(['item.delete', ...args]); },
            },
        },
        rolls: { roll: async (formula: string) => { rolls++; return { formula, total: 15, terms: [{ faces: 20, results: [{ result: 12, active: true }] }] }; } },
        chat: { send: async () => ({}) },
    };
    return { runtime, writes, rolls: () => rolls };
}

async function luckAndReplay() {
    const actor = { ...primLike(), _id: 'pc', system: { ...primLike().system, luck: { available: true, remaining: 2 } } };
    const post = (runtime: any, body: unknown) => handleLuck('pc', { runtime, json: async () => body, userSession: { userId: 'p1', isGM: false } } as any);
    await check('G8-C', 'luck writes the field of the current mode and refuses a stale or unknown mode', async () => {
        const pulp = ownerRuntime(actor, worldSnapshot(30, { usePulpMode: true }));
        assert.equal((await statusOf(await post(pulp.runtime, { mode: 'pulp', value: 4 }))).status, 200);
        assert.deepEqual(pulp.writes, [['patch', 'Actor', 'pc', { 'system.luck.remaining': 4 }]]);
        const stale = await statusOf(await post(pulp.runtime, { mode: 'standard', value: false }));
        assert.equal(stale.status, 409); assert.match(stale.body.error, /World rules changed/);
        const standard = ownerRuntime(actor, worldSnapshot(31));
        await post(standard.runtime, { mode: 'standard', value: false });
        assert.deepEqual(standard.writes, [['patch', 'Actor', 'pc', { 'system.luck.available': false }]]);
        const unknown = ownerRuntime(actor, worldSnapshot(32, {}, { usePulpMode: 'not-ready' }));
        assert.equal((await statusOf(await post(unknown.runtime, { mode: 'standard', value: true }))).status, 409);
        assert.equal((await statusOf(await post(pulp.runtime, { mode: 'pulp', value: -1 }))).status, 400);
        assert.equal(unknown.writes.length, 0);
    });
    await check('G8-C', 'a replay after a world-context change returns the result without rolling again', async () => {
        const caster = { ...actor, items: [{ _id: 'ability', name: 'Herbalism', type: 'Class Ability', system: { ability: 'int', dc: 12, limitedUses: true, uses: { available: 2, max: 2 } }, effects: [] }] };
        const lookups = shadowdarkAdapter.lookups;
        shadowdarkAdapter.lookups = () => ({}) as any;
        try {
            const before = ownerRuntime(caster, worldSnapshot(40));
            const body = { requestId: 'g8c-replay-0001', kind: 'ability', itemId: 'ability' };
            const req = (runtime: any) => ({ runtime, json: async () => body, userSession: { userId: 'p1', isGM: false } }) as any;
            const first = await statusOf(await handleActorAction('pc', req(before.runtime)));
            assert.equal(first.status, 200); assert.equal(before.rolls(), 1);
            // Core published a new context; the adapter generation (request identity) is unchanged.
            await shadowdarkAdapter.onWorldContextChanged(worldSnapshot(41, { usePulpMode: true }) as any, { keys: ['shadowdark.usePulpMode'], recovery: false, packs: [] });
            const after = ownerRuntime(caster, worldSnapshot(41, { usePulpMode: true }));
            const replay = await statusOf(await handleActorAction('pc', req(after.runtime)));
            assert.equal(replay.body.replayed, true); assert.equal(after.rolls(), 0);
            assert.deepEqual(replay.body.roll, first.body.roll);
        } finally { shadowdarkAdapter.lookups = lookups; }
    });
}

/** A request world whose context Core retires mid-request: its reads then fail with Core's plain Error. */
function retiringWorld(start: number) {
    let revision = start;
    const handle = {
        snapshot: () => worldSnapshot(revision),
        settings: { get: (key: string) => (worldSnapshot(revision).settings as any)[key] },
        assertRevision: (expected: number) => { if (expected !== revision) throw new Error('World context changed; refresh this action'); },
    };
    const retire = () => { revision++; throw new Error('World context changed; refresh this action'); };
    return { handle, retire };
}

async function midRequest() {
    await check('G8-C', 'a context retired while a request runs answers 409, not an internal 500', async () => {
        const index = retiringWorld(60);
        const indexResponse = await statusOf(await handleIndex({ runtime: { world: index.handle, access: packAccess(() => true),
            compendium: { findAll: async () => index.retire(), findOne: async () => null, getById: async () => null },
            documents: { get: async () => null } } } as any));
        assert.equal(indexResponse.status, 409); assert.equal(indexResponse.body.code, 'conflict');
        const collection = retiringWorld(70);
        const registry = (shadowdarkAdapter as any)._registry;
        const getCollection = registry.getCollection;
        registry.getCollection = () => collection.retire();
        try {
            const response = await statusOf(await handleGetCollection({ url: '/fetch-pack/spells', runtime: { world: collection.handle, access: packAccess(() => true) } } as any, 'spells'));
            assert.equal(response.status, 409);
        } finally { registry.getCollection = getCollection; }
        const luck = retiringWorld(80);
        const writes: unknown[] = [];
        const luckResponse = await statusOf(await handleLuck('pc', { json: async () => ({ mode: 'standard', value: true }), userSession: { userId: 'p1', isGM: false },
            runtime: { world: luck.handle, documents: { get: async () => luck.retire(), patch: async (...args: unknown[]) => { writes.push(args); } } } } as any));
        assert.equal(luckResponse.status, 409); assert.deepEqual(writes, []);
        // The same failure with an unchanged context is still an internal error.
        const steady = retiringWorld(90);
        const internal = await statusOf(await handleIndex({ runtime: { world: steady.handle, access: packAccess(() => true),
            compendium: { findAll: async () => { throw new Error('transport down'); }, findOne: async () => null, getById: async () => null },
            documents: { get: async () => null } } } as any));
        assert.equal(internal.status, 500);
    });
}

async function run() {
    await settings();
    await projections();
    await refresh();
    await luckAndReplay();
    await midRequest();
    for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.id} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
    const failed = results.filter(result => !result.ok);
    console.log(`shadowdark G8 world adoption: ${results.length - failed.length}/${results.length} passed`);
    if (failed.length) process.exitCode = 1;
}

run().catch(error => { console.error(error); process.exitCode = 1; });
