import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { handleEffects, parseEffectRef, buildEffectUpdate } from '../server/api/effects';
import { handleActorAction } from '../server/api/actions';
import { handleGetDocument } from '../server/api/document';
import { handleLearnSpell } from '../server/api/spells';
import { handleBestiaryCard, handleBestiaryList } from '../server/api/bestiary';
import { handleGetCollection } from '../server/api/collections';
import { handleIndex } from '../server/api/index';
import { handleFinalizeLevelUp } from '../server/api/level-up';
import { ShadowdarkRegistry } from '../server/Registry';
import { shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { ShadowdarkImporter } from '../server/importer';
import { prepareActorCore } from '../logic/actor-preparation';
import { prepareRequestedAction, listActions, actionFormula } from '../logic/actions';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { buildOwnedItemCard, buildNpcCard } from '../logic/resource-cards';
import { presentDescription } from '../logic/description';
import { collectEffects, serializeChanges } from '../logic/effects';
import { resolveFormula } from '../logic/formula';
import { getActiveEffectKeys } from '../logic/roll-keys';
import { applyChoice, choiceCatalog } from '../logic/talent-choices';
import { primLike, v14Mastery } from './fixtures/native-406';

/**
 * ADR-0001 boundary regressions (C1–C7, C9). Each case states the native or
 * contract rule it checks. Fake runtimes are in-memory; nothing reaches Foundry.
 */
type Result = { id: string; name: string; ok: boolean; detail?: string };
const results: Result[] = [];
async function check(id: string, name: string, fn: () => unknown | Promise<unknown>) {
    try { await fn(); results.push({ id, name, ok: true }); }
    catch (error) { results.push({ id, name, ok: false, detail: (error as Error).message.split('\n').slice(0, 6).join(' ') }); }
}

function fakeRuntime(actor: any, options: { owner?: boolean; rolls?: number[]; failWrites?: string[] } = {}) {
    const writes: any[] = [];
    const state = structuredClone(actor);
    const apply = (target: any, patch: any) => { for (const [path,value] of Object.entries(patch)) { const keys=path.split('.');const leaf=keys.pop()!;let owner=target;for(const key of keys)owner=owner[key]??={};owner[leaf]=structuredClone(value); } };
    const rolls = [...(options.rolls ?? [])];
    let rollCount = 0;
    const runtime: any = {
        access: { canReadPack: () => true, packs: () => [] },
        documents: {
            get: async (type: string, id: string, opts?: any) => {
                if (type !== 'Actor' || id !== (actor?._id)) return null;
                if (opts?.minOwnership === 'owner' && options.owner === false) return null;
                return structuredClone(state);
            },
            list: async () => ({ rows: [], total: 0 }),
            fetchByUuid: async () => { throw new Error('fetchByUuid must not be used for caller reads'); },
            patch: async (...args: any[]) => { writes.push(['patch', ...args]); return {}; },
            effects: {
                create: async (parent: any, data: any) => { writes.push(['effect.create', parent, data]); return { _id: 'new' }; },
                update: async (parent: any, id: string, data: any) => { writes.push(['effect.update', parent, id, data]); return {}; },
                delete: async (parent: any, id: string) => { writes.push(['effect.delete', parent, id]); },
            },
            items: {
                create: async (parent: any, data: any) => { writes.push(['item.create', parent, data]); return { _id: 'created' }; },
                update: async (parent: any, id: string, data: any) => {
                    if (options.failWrites?.includes(id)) throw new Error(`write to ${id} refused`);
                    writes.push(['item.update', parent, id, data]); const item=state.items?.find((row:any)=>row._id===id);if(item)apply(item,data);return {};
                },
                delete: async (parent: any, id: string) => {
                    if (options.failWrites?.includes(id)) throw new Error(`delete of ${id} refused`);
                    writes.push(['item.delete', parent, id]);state.items=state.items?.filter((row:any)=>row._id!==id);
                },
            },
        },
        rolls: { roll: async (formula: string) => { rollCount++; const natural = rolls.shift() ?? 10; return { formula, total: natural, terms: [{ faces: 20, results: [{ result: natural, active: true }] }] }; } },
        chat: { send: async () => { writes.push(['chat']); return {}; } },
    };
    return { runtime, writes, rolls: () => rollCount };
}
/** Core's request-runtime pack capability (module-api 1.5), driven by a test policy. */
const packAccess = (allowed: (pack: string) => boolean) => ({ canReadPack: allowed, packs: () => [] });
const request = (runtime: any, body: unknown, extra: any = {}) => ({ runtime, json: async () => body, userSession: { userId: 'u1', isGM: false }, ...extra });
const params = (route: string[]) => ({ params: Promise.resolve({ systemId: 'shadowdark', route }) });
const statusOf = async (response: any) => ({ status: response.status ?? 200, body: await response.json() });

async function effectsRoute() {
    const actor: any = { _id: 'a1', type: 'Player', system: {}, effects: [
        { _id: 'dup', name: 'Actor copy', disabled: false, flags: { core: { note: 'keep' } }, duration: { rounds: 3 }, statuses: ['blessed'],
            system: { changes: [{ key: 'system.attributes.hp.max', type: 'add', value: 1, phase: 'initial', priority: null, note: 'custom field' }] } },
    ], items: [{ _id: 'sword', name: 'Sword', type: 'Weapon', system: { equipped: true }, effects: [
        { _id: 'dup', name: 'Item copy', disabled: false, changes: [{ key: 'system.roll.melee.bonus.this', mode: 2, value: '1' }] },
    ] }] };
    await check('SD01-02', 'effect refs are owner-qualified', () => {
        assert.deepEqual(parseEffectRef('ActiveEffect.dup'), { kind: 'actor', effectId: 'dup' });
        assert.deepEqual(parseEffectRef('Item.sword.ActiveEffect.dup'), { kind: 'item', itemId: 'sword', effectId: 'dup' });
        assert.equal(parseEffectRef('dup'), null, 'a bare embedded effect id is ambiguous');
    });
    await check('SD01-11', 'list returns Actor and Item effects with the same id once each', async () => {
        const { runtime } = fakeRuntime(actor);
        const list: any = await handleEffects('a1', runtime, 'list');
        assert.deepEqual(list.active.map((effect: any) => effect.ref).sort(), ['ActiveEffect.dup', 'Item.sword.ActiveEffect.dup']);
    });
    await check('SD01-02', 'update addresses the exact parent despite a colliding id', async () => {
        const { runtime, writes } = fakeRuntime(actor);
        await handleEffects('a1', runtime, 'update', { ref: 'Item.sword.ActiveEffect.dup', patch: { disabled: true } });
        assert.deepEqual(writes, [['effect.update', { type: 'Actor.a1.Item', id: 'sword' }, 'dup', { disabled: true }]]);
    });
    await check('SD01-02', 'value-only edit keeps unknown change fields and writes nothing else', async () => {
        const { runtime, writes } = fakeRuntime(actor);
        await handleEffects('a1', runtime, 'update', { ref: 'ActiveEffect.dup', patch: { changes: [
            { index: 0, key: 'system.attributes.hp.max', type: 'add', value: 2, phase: 'initial', priority: null },
        ] } });
        assert.deepEqual(writes[0][3], { 'system.changes': [{ key: 'system.attributes.hp.max', type: 'add', value: 2, phase: 'initial', priority: null, note: 'custom field' }] });
    });
    await check('SD01-02', 'no-op save performs no write', async () => {
        const { runtime, writes } = fakeRuntime(actor);
        const result: any = await handleEffects('a1', runtime, 'update', { ref: 'ActiveEffect.dup', patch: { name: 'Actor copy', changes: [
            { index: 0, key: 'system.attributes.hp.max', type: 'add', value: 1, phase: 'initial', priority: null },
        ] } });
        assert.deepEqual(result, { unchanged: true }); assert.equal(writes.length, 0);
    });
    await check('SD01-02', 'legacy-shape effect rejects a phase it cannot store', () => {
        assert.throws(() => buildEffectUpdate(actor.items[0].effects[0], { changes: [{ index: 0, key: 'system.roll.melee.bonus.this', type: 'add', value: '1', phase: 'final' }] }), /phase/);
        assert.throws(() => buildEffectUpdate(actor.items[0].effects[0], { changes: [{ index: 0, key: 'system.roll.melee.bonus.this', type: 'subtract', value: '1' }] }), /legacy mode/);
    });
    await check('SD01-02', 'legacy edit maps types to native modes (UPGRADE 4, DOWNGRADE 3)', () => {
        const update = buildEffectUpdate(actor.items[0].effects[0], { changes: [
            { index: 0, key: 'system.roll.melee.bonus.this', type: 'upgrade', value: '1' }, { key: 'system.slots', type: 'downgrade', value: '12' },
        ] });
        assert.deepEqual((update as any).changes.map((change: any) => change.mode), [4, 3]);
    });
    await check('SD01-02', 'unresolved predefined choice writes nothing', async () => {
        const { runtime, writes } = fakeRuntime(actor);
        const catalogFn = shadowdarkAdapter.getChoiceCatalog;
        shadowdarkAdapter.getChoiceCatalog = async () => choiceCatalog([{ name: 'Leather Armor', type: 'Armor', system: { baseArmor: '', magicItem: false } }]);
        try {
            await assert.rejects(() => handleEffects('a1', runtime, 'create', { predefined: { key: 'armorMastery' } }), /choice/);
            await assert.rejects(() => handleEffects('a1', runtime, 'create', { predefined: { key: 'armorMastery', choice: 'plate-mail' } }), /choice/);
            await assert.rejects(() => handleEffects('a1', runtime, 'create', { predefined: { key: 'weaponMastery' } }), /rejected/);
            assert.equal(writes.length, 0);
            await handleEffects('a1', runtime, 'create', { predefined: { key: 'armorMastery', choice: 'leather-armor' } });
            assert.equal(writes[0][2].system.changes[0].key, 'system.attributes.ac.leather-armor', 'v14 Actor gets a v14 effect');
            assert.equal(writes[0][2].system.changes[0].type, 'add');
        } finally { shadowdarkAdapter.getChoiceCatalog = catalogFn; }
    });
    await check('SD01-06', 'effects of an Actor the caller cannot read are not reachable', async () => {
        const { runtime, writes } = fakeRuntime(null as any);
        await assert.rejects(() => handleEffects('a1', runtime, 'update', { ref: 'ActiveEffect.dup', patch: { disabled: true } }), /not found/);
        assert.equal(writes.length, 0);
    });
}

const wizardActor = (extra: any = {}) => ({
    _id: 'w1', name: 'Wizard', type: 'Player', system: { abilities: { int: { value: 14 }, str: { value: 10 }, dex: { value: 10 }, con: { value: 10 }, wis: { value: 10 }, cha: { value: 10 } }, level: { value: 1 }, attributes: { hp: { value: 4, max: 4 } } },
    effects: [],
    items: [
        { _id: 'talent', name: 'Spellcasting (Wizard)', type: 'Talent', system: {}, effects: [{ _id: 'e', name: 'Spell Class', system: { changes: [{ key: 'system.spellcasting.classes', type: 'add', value: 'wizard', phase: 'initial' }] } }] },
        { _id: 'mm', name: 'Magic Missile', type: 'Spell', system: { tier: 1, class: ['Compendium.shadowdark.classes.Item.wiz'], lost: false, range: 'far', duration: { type: 'instant', value: '-1' } }, effects: [] },
        { _id: 'lost', name: 'Sleep', type: 'Spell', system: { tier: 1, class: ['Compendium.shadowdark.classes.Item.wiz'], lost: true }, effects: [] },
        { _id: 'scroll', name: 'Scroll', type: 'Scroll', system: { intent: 'inventory', spellUuid: 'Compendium.shadowdark.spells.Item.light' }, effects: [] },
        { _id: 'wand', name: 'Wand', type: 'Wand', system: { broken: false, spells: [{ uuid: 'Compendium.shadowdark.spells.Item.light', lost: false }, { uuid: 'Compendium.shadowdark.spells.Item.missing', lost: false }] }, effects: [] },
        { _id: 'turn', name: 'Turn', type: 'Class Ability', system: { ability: 'cha', dc: 12, limitedUses: true, uses: { available: 1, max: 1 }, loseOnFailure: true }, effects: [] },
        { _id: 'potion', name: 'Draught', type: 'Potion', system: { identification: { identified: false, name: 'Healing Potion' } }, effects: [] },
        ...(extra.items ?? []),
    ],
});
const classDocs: Record<string, any> = { 'Compendium.shadowdark.classes.Item.wiz': { name: 'Wizard', type: 'Class', system: { spellcasting: { ability: 'int' } } } };
const spellDocs: Record<string, any> = { 'Compendium.shadowdark.spells.Item.light': { name: 'Light', type: 'Spell', system: { tier: 1, class: ['Compendium.shadowdark.classes.Item.wiz'] } } };
const lookups = { classDocument: (ref: any) => classDocs[`Compendium.${ref.pack}.${ref.documentType}.${ref.id}`] ?? null,
    spellDocument: (ref: any) => spellDocs[`Compendium.${ref.pack}.${ref.documentType}.${ref.id}`] ?? null, label: () => null };

async function actions() {
    const lookupsFn = shadowdarkAdapter.lookups;
    shadowdarkAdapter.lookups = () => lookups as any;
    const resolveFor = shadowdarkAdapter.resolveDocumentFor;
    shadowdarkAdapter.resolveDocumentFor = async (uuid: string) => spellDocs[uuid] ?? classDocs[uuid] ?? null;
    try {
        const core = prepareActorCore(wizardActor(), lookups);
        await check('SD01-08', 'spell ability comes from the spell class (PlayerSD._getSpellcastingAbility)', () => {
            const action = prepareRequestedAction(core, wizardActor(), lookups, { kind: 'spell', itemId: 'mm' })!;
            assert.equal(action.ability, 'int'); assert.equal(action.abilityBonus, 2); assert.equal(action.dc, 11);
            assert.equal(actionFormula(action), '1d20+2');
        });
        await check('SD01-08', 'lost spell, non-caster and unknown class are unavailable with reasons', () => {
            assert.match(prepareRequestedAction(core, wizardActor(), lookups, { kind: 'spell', itemId: 'lost' })!.reason!, /lost/);
            const fighter = wizardActor(); fighter.items = fighter.items.filter((item: any) => item._id !== 'talent');
            assert.match(prepareRequestedAction(prepareActorCore(fighter, lookups), fighter, lookups, { kind: 'spell', itemId: 'mm' })!.reason!, /not a spellcaster/);
            assert.match(prepareRequestedAction(core, wizardActor(), { ...lookups, classDocument: () => null }, { kind: 'spell', itemId: 'mm' })!.reason!, /unavailable or not visible/);
        });
        await check('SD01-08', 'each wand spell is its own action; a missing spell is unavailable', () => {
            const wandActions = listActions(core, wizardActor(), lookups).filter(action => action.itemId === 'wand');
            assert.equal(wandActions.length, 2);
            assert.equal(wandActions[0].spell?.name, 'Light'); assert.equal(wandActions[0].available, true);
            assert.match(wandActions[1].reason!, /not available/);
        });
        await check('C4', 'an unavailable action is refused before rolling or writing', async () => {
            const { runtime, writes, rolls } = fakeRuntime(wizardActor());
            const { status } = await statusOf(await handleActorAction('w1', request(runtime, { requestId: 'req-lost-0001', kind: 'spell', itemId: 'lost' }) as any));
            assert.equal(status, 409); assert.equal(rolls(), 0); assert.equal(writes.length, 0);
        });
        await check('C4', 'non-owners cannot run actions (no roll)', async () => {
            const { runtime, rolls } = fakeRuntime(wizardActor(), { owner: false });
            const { status } = await statusOf(await handleActorAction('w1', request(runtime, { requestId: 'req-owner-001', kind: 'spell', itemId: 'mm' }) as any));
            assert.equal(status, 403); assert.equal(rolls(), 0);
        });
        await check('C4', 'failed spell is lost; a focus check is not', async () => {
            const failed = fakeRuntime(wizardActor(), { rolls: [3] });
            const result = await statusOf(await handleActorAction('w1', request(failed.runtime, { requestId: 'req-fail-0001', kind: 'spell', itemId: 'mm' }) as any));
            assert.equal(result.body.outcome.success, false);
            assert.deepEqual(failed.writes.find(write => write[0] === 'item.update'), ['item.update', { type: 'Actor', id: 'w1' }, 'mm', { 'system.lost': true }]);
            const focus = fakeRuntime(wizardActor(), { rolls: [3] });
            await handleActorAction('w1', request(focus.runtime, { requestId: 'req-focus-001', kind: 'spell', itemId: 'mm', focus: true }) as any);
            assert.equal(focus.writes.filter(write => write[0] === 'item.update').length, 0);
        });
        await check('C4', 'scroll is consumed even on success', async () => {
            const { runtime, writes } = fakeRuntime(wizardActor(), { rolls: [18] });
            await handleActorAction('w1', request(runtime, { requestId: 'req-scroll-01', kind: 'spell', itemId: 'scroll', spellIndex: 0 }) as any);
            assert.ok(writes.some(write => write[0] === 'item.delete' && write[2] === 'scroll'));
        });
        await check('C4', 'wand critical failure loses that spell and breaks the wand', async () => {
            const { runtime, writes } = fakeRuntime(wizardActor(), { rolls: [1] });
            await handleActorAction('w1', request(runtime, { requestId: 'req-wand-0001', kind: 'spell', itemId: 'wand', spellIndex: 0 }) as any);
            const update = writes.find(write => write[0] === 'item.update');
            assert.equal(update[3]['system.broken'], true);
            assert.deepEqual(update[3]['system.spells'].map((entry: any) => entry.lost), [true, false]);
        });
        await check('C4', 'a repeated request id does not roll or consume twice', async () => {
            const { runtime, writes, rolls } = fakeRuntime(wizardActor(), { rolls: [3, 3] });
            const body = { requestId: 'req-dedupe-01', kind: 'spell', itemId: 'mm' };
            await handleActorAction('w1', request(runtime, body) as any);
            await handleActorAction('w1', request(runtime, body) as any);
            assert.equal(rolls(), 1); assert.equal(writes.filter(write => write[0] === 'item.update').length, 1);
        });
        await check('C4', 'limited Class Ability uses one use and is lost on failure; a failed write is reported', async () => {
            const { runtime, writes } = fakeRuntime(wizardActor(), { rolls: [2] });
            const result = await statusOf(await handleActorAction('w1', request(runtime, { requestId: 'req-ability-1', kind: 'ability', itemId: 'turn' }) as any));
            assert.deepEqual(writes.filter(write => write[0] === 'item.update').map(write => write[3]), [{ 'system.uses.available': 0 }, { 'system.lost': true }]);
            assert.equal(result.body.consequences.every((entry: any) => entry.status === 'applied'), true);
            const failing = fakeRuntime(wizardActor(), { rolls: [2], failWrites: ['turn'] });
            const partial = await statusOf(await handleActorAction('w1', request(failing.runtime, { requestId: 'req-ability-2', kind: 'ability', itemId: 'turn' }) as any));
            assert.equal(partial.body.consequences[0].status, 'uncertain');
            assert.equal(partial.body.phase, 'prerequisites'); assert.equal(failing.rolls(), 0, 'a failed spend must not request a result');
            assert.equal(partial.body.outcome, null);
        });
        await check('C4', 'potion is consumed after a confirmation, without a roll', async () => {
            const { runtime, writes, rolls } = fakeRuntime(wizardActor());
            await handleActorAction('w1', request(runtime, { requestId: 'req-potion-01', kind: 'potion', itemId: 'potion' }) as any);
            assert.equal(rolls(), 0); assert.ok(writes.some(write => write[0] === 'item.delete' && write[2] === 'potion'));
        });
    } finally {
        shadowdarkAdapter.lookups = lookupsFn;
        shadowdarkAdapter.resolveDocumentFor = resolveFor;
    }
}

async function preparation() {
    const base = () => primLike(v14Mastery());
    await check('SD01-01', 'unequipped, stashed and unidentified item effects are suppressed (ActiveEffectSD.isSuppressed)', () => {
        for (const patch of [{ equipped: false }, { stashed: true }, { identification: { identified: false } }]) {
            const actor: any = base();
            actor.items[0].system = { ...actor.items[0].system, ...patch };
            actor.items[0].effects = [{ _id: 'x', name: 'Magic', changes: [{ key: 'system.roll.melee.bonus.this', mode: 2, value: '5' }] }];
            const view = prepareShadowdarkView(actor);
            const action = view.actions.find(entry => entry.itemId === 'primLongsword');
            assert.equal(action?.bonus, 0, JSON.stringify(patch));
        }
    });
    await check('SD01-01', 'a non-transferred Item effect is not applied to the Actor', () => {
        const actor: any = base();
        actor.items[1].effects[0].transfer = false;
        assert.equal(prepareShadowdarkView(actor).actions.find(entry => entry.itemId === 'primLongsword')?.bonus, -1);
    });
    await check('SD01-01', 'situational effects need selection for roll keys', () => {
        const actor: any = base();
        actor.items[1].effects[0].flags = { shadowdark: { situational: true } };
        const core = prepareActorCore(actor);
        const plain = prepareRequestedAction(core, actor, {}, { kind: 'attack', itemId: 'primLongsword' })!;
        assert.equal(plain.bonus, -1); assert.equal(plain.situational[0].ref, 'Item.primMastery.ActiveEffect.primMasteryEffect');
        const chosen = prepareRequestedAction(core, actor, {}, { kind: 'attack', itemId: 'primLongsword', selected: [plain.situational[0].ref] })!;
        assert.equal(chosen.bonus, 0);
    });
    await check('SD01-01', 'final-phase changes apply after derived AC', () => {
        const actor: any = base();
        actor.effects = [{ _id: 'f', name: 'Final AC', system: { changes: [{ key: 'system.attributes.ac.value', type: 'override', value: 20, phase: 'final' }] } }];
        assert.equal(prepareActorCore(actor).ac, 20);
    });
    await check('SD01-01', 'priority orders same-phase changes (override before add when lower priority)', () => {
        const actor: any = base();
        actor.effects = [{ _id: 'p', name: 'Priority', system: { changes: [
            { key: 'system.attributes.hp.max', type: 'add', value: 2, phase: 'initial', priority: 60 },
            { key: 'system.attributes.hp.max', type: 'override', value: 10, phase: 'initial' },
        ] } }];
        assert.equal(prepareActorCore(actor).hp.max, 12);
    });
    await check('SD01-01', 'pre-4.0 keys and missing references are diagnosed, never zero-filled', () => {
        const actor: any = base();
        actor.effects = [{ _id: 'l', name: 'Old', changes: [{ key: 'system.bonuses.meleeAttackBonus', mode: 2, value: '1' },
            { key: 'system.attributes.hp.max', mode: 2, value: '@missing.path' }] }];
        const core = prepareActorCore(actor);
        assert.equal(core.hp.max, 8);
        assert.ok(core.diagnostics.some(message => /pre-4\.0 key/.test(message)));
        assert.ok(core.diagnostics.some(message => /@missing\.path/.test(message)));
        assert.equal(resolveFormula('@missing.path + 1', {}).ok, false);
    });
    await check('SD01-01', 'roll selectors aggregate dice-valued ADD as native strings', () => {
        const effects = collectEffects({ effects: [{ _id: 'd', name: 'Bless', system: { changes: [{ key: 'system.roll.melee.damage', type: 'add', value: '1d4', phase: 'initial' }] } }] });
        assert.equal(getActiveEffectKeys(effects, {}, 'roll.melee.damage', 'd8').value, 'd8+1d4');
    });
    await check('SD01-02', 'serializer keeps the effect shape and unknown fields', () => {
        const v14 = { system: { changes: [{ key: 'a', type: 'add', value: 1, phase: 'final', priority: 5, extra: true }] } };
        assert.deepEqual(serializeChanges(v14, [{ index: 0, key: 'a', type: 'add', value: 2 }]),
            { 'system.changes': [{ key: 'a', type: 'add', value: 2, phase: 'final', priority: 5, extra: true }] });
    });
    await check('SD01-02', 'mixed template choice resolves both copies', () => {
        const mixed: any = v14Mastery();
        mixed.name = 'Weapon Mastery';
        mixed.effects[0].system.changes.forEach((change: any) => { change.key = change.key.replace('longsword', 'REPLACEME'); });
        mixed.effects[0].changes = mixed.effects[0].system.changes.map(({ key, value }: any) => ({ key, mode: 2, value }));
        const resolved = applyChoice(mixed, 'longsword', 'weapon', choiceCatalog([{ name: 'Longsword', type: 'Weapon', system: {} }]));
        assert.doesNotMatch(JSON.stringify(resolved), /REPLACEME/);
    });
}

async function registryAndRoutes() {
    await check('SD01-07', 'attach resets the projection; a load from an old runtime cannot publish', async () => {
        const registry = new ShadowdarkRegistry();
        let release: (rows: any[]) => void = () => {};
        const slow = new Promise<any[]>(resolve => { release = resolve; });
        registry.attach({ findAll: (type: string) => type === 'Item' ? slow : Promise.resolve([]) } as any, { fetchByUuid: async () => null } as any);
        const first = registry.getDocument('Compendium.shadowdark.gear.Item.old');
        registry.attach({ findAll: async (type: string) => type === 'Item'
            ? [{ _id: 'new', name: 'New', type: 'Basic', pack: 'shadowdark.gear', uuid: 'Compendium.shadowdark.gear.Item.new', system: {} }] : [] } as any,
            { fetchByUuid: async () => null } as any);
        release([{ _id: 'old', name: 'Old', type: 'Basic', pack: 'shadowdark.gear', uuid: 'Compendium.shadowdark.gear.Item.old', system: {} }]);
        await first;
        assert.equal(await registry.getDocument('Compendium.shadowdark.gear.Item.old'), null);
        assert.equal((await registry.getDocument('Compendium.shadowdark.gear.Item.new'))?.name, 'New');
    });
    await check('SD01-07', 'explicit legacy alias resolves only within a declared pack', async () => {
        const registry = new ShadowdarkRegistry();
        registry.attach({ findAll: async (type: string) => type === 'Item'
            ? [{ _id: 'abc', name: 'Talent', type: 'Talent', pack: 'shadowdark.talents', system: {} }] : [] } as any, { fetchByUuid: async () => null } as any);
        assert.equal((await registry.getDocument('Compendium.shadowdark.talents.abc'))?.name, 'Talent');
        assert.equal(await registry.getDocument('abc'), null, 'a bare id is not an identity');
        assert.equal(await registry.getDocument('Item.abc'), null, 'world ids are never served by the shared registry');
    });
    await check('SD01-07', 'same-name documents stay ambiguous for import conversion', async () => {
        const registry = new ShadowdarkRegistry();
        registry.attach({ findAll: async (type: string) => type === 'Actor' ? [
            { _id: 'g1', name: 'Goblin', type: 'NPC', pack: 'shadowdark.monsters', system: {} },
            { _id: 'g2', name: 'Goblin', type: 'NPC', pack: 'shadowdark.monsters', system: {} },
        ] : [] } as any, { fetchByUuid: async () => null } as any);
        const { doc, ambiguous } = await registry.findUniqueByName('goblin', ['NPC'], () => true);
        assert.equal(doc, null); assert.equal(ambiguous.length, 2);
    });
    await check('SD01-06', 'world and embedded document reads use the caller projection', async () => {
        const visible = { _id: 'w', name: 'World item', type: 'Item' };
        const req: any = { runtime: { documents: {
            get: async (type: string, id: string) => type === 'Item' && id === 'w' ? visible
                : type === 'Actor' && id === 'a' ? { _id: 'a', items: [{ _id: 'i', name: 'Owned' }] } : null,
            fetchByUuid: async () => { throw new Error('caller reads must not use fetchByUuid'); },
        } } };
        assert.equal((await statusOf(await handleGetDocument(req, params(['document', 'Item.w'])))).body.name, 'World item');
        assert.equal((await statusOf(await handleGetDocument(req, params(['document', 'Actor.a.Item.i'])))).body.name, 'Owned');
        assert.equal((await statusOf(await handleGetDocument(req, params(['document', 'Item.hidden'])))).status, 404);
        assert.equal((await statusOf(await handleGetDocument(req, params(['document', 'not-a-uuid'])))).status, 400);
    });
    await check('SD01-06', 'a privileged read is not served to a later denied caller', async () => {
        const secret = { _id: 's', name: 'GM secret', type: 'Item' };
        const caller = (allowed: boolean): any => ({ runtime: { documents: {
            get: async (type: string, id: string) => allowed && type === 'Item' && id === 's' ? secret : null,
            fetchByUuid: async () => { throw new Error('caller reads must not use fetchByUuid'); },
        } } });
        assert.equal((await statusOf(await handleGetDocument(caller(true), params(['document', 'Item.s'])))).body.name, 'GM secret');
        const denied = await statusOf(await handleGetDocument(caller(false), params(['document', 'Item.s'])));
        assert.equal(denied.status, 404);
        assert.doesNotMatch(JSON.stringify(denied.body), /GM secret/);
        assert.equal(await shadowdarkAdapter.resolveDocumentFor('Item.s', { runtime: caller(false).runtime, isGM: false }), null,
            'a world document comes only from the caller runtime');
    });
    await check('SD01-09', 'learning rejects a non-Spell source and copies the full Spell with its source', async () => {
        const actor = { _id: 'a1', items: [] };
        const resolveFor = shadowdarkAdapter.resolveDocumentFor;
        shadowdarkAdapter.resolveDocumentFor = async (uuid: string) => uuid.endsWith('notspell')
            ? { name: 'Sword', type: 'Weapon', system: {} }
            : { _id: 'sp', name: 'Light', type: 'Spell', img: 'x.webp', system: { tier: 1, class: ['c'] }, effects: [{ name: 'E' }], flags: { keep: true } };
        try {
            const { runtime, writes } = fakeRuntime(actor);
            assert.equal((await statusOf(await handleLearnSpell('a1', request(runtime, { intent: 'inventory', spellUuid: 'Compendium.shadowdark.spells.Item.notspell' }) as any))).status, 400);
            await handleLearnSpell('a1', request(runtime, { intent: 'inventory', spellUuid: 'Compendium.shadowdark.spells.Item.sp' }) as any);
            const created = writes.find(write => write[0] === 'item.create')[2];
            assert.deepEqual(created.effects, [{ name: 'E' }]); assert.deepEqual(created.flags, { keep: true });
            assert.equal(created._stats.compendiumSource, 'Compendium.shadowdark.spells.Item.sp');
            assert.equal(created._id, undefined);
        } finally { shadowdarkAdapter.resolveDocumentFor = resolveFor; }
    });
    await check('SD01-09', 'level-up ignores client-supplied class objects and checks the class spell list', async () => {
        const actor = { _id: 'a1', system: { level: { value: 0 } }, items: [] };
        const resolveFor = shadowdarkAdapter.resolveDocumentFor;
        shadowdarkAdapter.resolveDocumentFor = async (uuid: string) => uuid.endsWith('wiz') ? { name: 'Wizard', type: 'Class', system: {} }
            : uuid.endsWith('heal') ? { name: 'Cure', type: 'Spell', system: { tier: 1, class: ['Compendium.shadowdark.classes.Item.priest'] } } : null;
        try {
            const { runtime, writes } = fakeRuntime(actor);
            const body = { targetLevel: 1, classUuid: 'Compendium.shadowdark.classes.Item.wiz', classObj: { name: 'Injected', type: 'Class' },
                selectedSpells: [{ name: 'Cure', uuid: 'Compendium.shadowdark.spells.Item.heal' }] };
            const response = await statusOf(await handleFinalizeLevelUp('a1', request(runtime, body) as any));
            assert.equal(response.status, 400); assert.match(response.body.error, /not on the exact Class spell list/);
            assert.equal(writes.length, 0);
        } finally { shadowdarkAdapter.resolveDocumentFor = resolveFor; }
    });
    await check('SD01-16', 'bestiary offers compendium monsters only with the caller pack capability', async () => {
        const registry = (shadowdarkAdapter as any)._registry;
        const collection = registry.getCollection;
        const resolve = registry.getDocument;
        const goblin = { _id: 'g1', uuid: 'Compendium.shadowdark.monsters.Actor.g1', name: 'Goblin', type: 'NPC', items: [],
            system: { abilities: { dex: { mod: 1 } }, attributes: { ac: { value: 11 }, hp: { value: 5, max: 5 } }, level: { value: 1 }, move: 'near', darkAdapted: true } };
        registry.getCollection = async (id: string, options: any = {}) => id === 'monsters' ? [goblin].filter(doc => !options.readable || options.readable('shadowdark.monsters')) : [];
        registry.getDocument = async (uuid: string) => uuid === goblin.uuid ? structuredClone(goblin) : null;
        try {
            const documents = { list: async () => ({ rows: [], total: 0 }), get: async () => null };
            // Core's effective capability: this world restricts the monster pack from players.
            const player = { runtime: { documents, access: packAccess(pack => pack !== 'shadowdark.monsters') }, userSession: { isGM: false } } as any;
            const gm = { runtime: { documents, access: packAccess(() => true) }, userSession: { isGM: true } } as any;
            assert.equal((await statusOf(await handleBestiaryList(player))).body.entries.length, 0);
            assert.equal((await statusOf(await handleBestiaryCard(player, params(['bestiary', goblin.uuid])))).status, 403);
            assert.equal((await statusOf(await handleBestiaryList(gm))).body.entries.length, 1);
            const card = (await statusOf(await handleBestiaryCard(gm, params(['bestiary', goblin.uuid])))).body.card;
            assert.equal(card.facts.find((fact: any) => fact.label === 'AC').value, '11');
            assert.equal(card.facts.find((fact: any) => fact.label === 'Senses').value, 'Dark-adapted');
            assert.equal(card.actions.length, 0, 'no spawn, encounter or share action');
        } finally { registry.getCollection = collection; registry.getDocument = resolve; }
    });
}

/**
 * Independent review corrections (audit "Independent review addendum"): RV-01
 * one caller policy for compendium monsters on every route; RV-03 action replay
 * rechecks the caller and binds the request identity to its body.
 */
async function reviewCorrections() {
    const registry = (shadowdarkAdapter as any)._registry;
    const monsterUuid = 'Compendium.shadowdark.monsters.Actor.fixture-monster';
    const spellUuid = 'Compendium.shadowdark.spells.Item.fixture-spell';
    const monster = { _id: 'fixture-monster', uuid: monsterUuid, name: 'Synthetic Ogre', type: 'NPC', items: [],
        system: { abilities: {}, attributes: { ac: { value: 9 }, hp: { value: 30, max: 30 } }, level: { value: 6 } } };
    const docs: Record<string, any> = { [monsterUuid]: monster, [spellUuid]: { _id: 'fixture-spell', uuid: spellUuid, name: 'Synthetic Light', type: 'Spell', system: {} } };
    const saved = { getDocument: registry.getDocument, getSystemData: registry.getSystemData, getCollection: registry.getCollection,
        collectionSize: registry.collectionSize };
    registry.collectionSize = async (id: string) => id === 'monsters' ? 1 : 0;
    registry.getDocument = async (uuid: string) => docs[uuid] ? structuredClone(docs[uuid]) : null;
    registry.getSystemData = async () => ({ nameIndex: { [monsterUuid]: monster.name, [spellUuid]: 'Synthetic Light' }, titles: {} });
    registry.getCollection = async (id: string, options: any = {}) => id === 'monsters'
        ? [structuredClone(monster)].filter(doc => !options.readable || options.readable('shadowdark.monsters')) : [];
    const documents = { list: async () => ({ rows: [], total: 0 }), get: async () => null,
        fetchByUuid: async () => { throw new Error('caller reads must not use fetchByUuid'); } };
    // Unfiltered pack rows: the module must apply the caller capability itself.
    const compendium = { findAll: async (type: string) => type === 'Actor' ? [{ ...structuredClone(monster), pack: 'shadowdark.monsters' }]
        : type === 'Item' ? [{ ...docs[spellUuid], pack: 'shadowdark.spells' }] : [] };
    // The world restricts the monster pack from this player; GMs read every pack.
    const caller = (isGM: boolean): any => ({ runtime: { documents, compendium, access: packAccess(pack => isGM || pack !== 'shadowdark.monsters') },
        url: 'http://localhost/x', userSession: { userId: isGM ? 'gm' : 'p1', isGM }, getAccessContext: () => ({ isGM }) });
    try {
        await check('RV-01', 'generic document route denies a compendium monster to a player and serves a GM', async () => {
            const player = await statusOf(await handleGetDocument(caller(false), params(['document', monsterUuid])));
            assert.equal(player.status, 403);
            assert.doesNotMatch(JSON.stringify(player.body), /Synthetic Ogre/);
            assert.equal((await statusOf(await handleGetDocument(caller(true), params(['document', monsterUuid])))).body.name, 'Synthetic Ogre');
            assert.equal((await statusOf(await handleGetDocument(caller(false), params(['document', spellUuid])))).body.name, 'Synthetic Light');
        });
        await check('RV-01', 'a GM read of a monster is not served to a later player request', async () => {
            assert.equal((await statusOf(await handleGetDocument(caller(true), params(['document', monsterUuid])))).status, 200);
            assert.equal((await statusOf(await handleGetDocument(caller(false), params(['document', monsterUuid])))).status, 403);
            assert.equal((await statusOf(await handleBestiaryCard(caller(false), params(['bestiary', monsterUuid])))).status, 403);
        });
        await check('RV-01', 'system index omits monster names for players and keeps them for GMs', async () => {
            const player = (await statusOf(await handleIndex(caller(false)))).body;
            assert.equal(player.nameIndex[monsterUuid], undefined); assert.equal(player.nameIndex[spellUuid], 'Synthetic Light');
            assert.equal((await statusOf(await handleIndex(caller(true)))).body.nameIndex[monsterUuid], 'Synthetic Ogre');
        });
        await check('RV-01', 'monster collection follows the capability; a runtime without capabilities reads no pack', async () => {
            assert.equal((await statusOf(await handleGetCollection(caller(false), 'monsters'))).status, 403);
            assert.equal((await statusOf(await handleGetCollection(caller(true), 'monsters'))).body.length, 1);
            const noAccess: any = { runtime: { documents }, url: 'http://localhost/x', userSession: { userId: 'gm', isGM: true } };
            assert.equal((await statusOf(await handleGetDocument(noAccess, params(['document', spellUuid])))).status, 403,
                'no capability is not an allow-all fallback, even for a GM session');
        });
        await check('RV-01', 'every caller-bound document path applies the same policy (spell learning)', async () => {
            const { runtime: owned, writes } = fakeRuntime({ _id: 'a1', type: 'Player', system: {}, items: [] });
            const learn = await statusOf(await handleLearnSpell('a1', { ...caller(false), runtime: { ...owned, access: packAccess(() => false) }, json: async () => ({ intent: 'inventory', spellUuid: monsterUuid }) } as any));
            assert.equal(learn.status, 403); assert.equal(writes.length, 0);
            assert.doesNotMatch(JSON.stringify(learn.body), /Synthetic Ogre/);
        });
    } finally {
        Object.assign(registry, saved);
    }

    const lookupsFn = shadowdarkAdapter.lookups;
    shadowdarkAdapter.lookups = () => lookups as any;
    const resolver = shadowdarkAdapter.resolveDocumentFor;
    shadowdarkAdapter.resolveDocumentFor = async (uuid, caller) => classDocs[uuid] ?? spellDocs[uuid] ?? resolver.call(shadowdarkAdapter, uuid, caller);
    try {
        const potionActor = () => ({ _id: 'a1', name: 'Drinker', type: 'Player', system: { abilities: {} }, effects: [],
            items: [{ _id: 'potion', name: 'Healing Potion', type: 'Potion', system: {}, effects: [] },
                { _id: 'potion2', name: 'Other Potion', type: 'Potion', system: {}, effects: [] }] });
        await check('RV-03', 'a replay rechecks current ownership and discloses nothing after revocation', async () => {
            let owner = true;
            const { runtime, writes } = fakeRuntime(potionActor());
            const get = runtime.documents.get;
            let reads = 0;
            runtime.documents.get = async (type: string, id: string, opts?: any) => { reads++; return opts?.minOwnership === 'owner' && !owner ? null : get(type, id, opts); };
            const body = { requestId: 'rv03-revoke-01', kind: 'potion', itemId: 'potion' };
            assert.equal((await statusOf(await handleActorAction('a1', request(runtime, body) as any))).status, 200);
            const beforeReplayReads = reads;
            owner = false;
            const replay = await statusOf(await handleActorAction('a1', request(runtime, body) as any));
            assert.equal(replay.status, 403); assert.equal(reads, beforeReplayReads + 1, 'the replay re-read the Actor under current ownership');
            assert.doesNotMatch(JSON.stringify(replay.body), /Healing Potion/);
            assert.equal(writes.filter(write => write[0] === 'item.delete').length, 1);
        });
        await check('RV-03', 'reusing a request id with a different action is refused', async () => {
            const { runtime, writes } = fakeRuntime(potionActor());
            await handleActorAction('a1', request(runtime, { requestId: 'rv03-body-0001', kind: 'potion', itemId: 'potion' }) as any);
            const reused = await statusOf(await handleActorAction('a1', request(runtime, { requestId: 'rv03-body-0001', kind: 'potion', itemId: 'potion2' }) as any));
            assert.equal(reused.status, 409);
            assert.deepEqual(writes.filter(write => write[0] === 'item.delete').map(write => write[2]), ['potion']);
        });
        await check('RV-03', 'an identical replay returns the first result without rolling or writing', async () => {
            const { runtime, writes, rolls } = fakeRuntime(wizardActor(), { rolls: [3, 3] });
            const body = { requestId: 'rv03-same-0001', kind: 'spell', itemId: 'mm' };
            const first = await statusOf(await handleActorAction('w1', request(runtime, body) as any));
            const again = await statusOf(await handleActorAction('w1', request(runtime, body) as any));
            assert.equal(again.status, 200); assert.equal(again.body.replayed, true);
            assert.deepEqual(again.body.roll, first.body.roll); assert.equal(rolls(), 1);
            assert.equal(writes.filter(write => write[0] === 'item.update').length, 1);
        });
        await check('RV-03', 'a chat failure after the result does not reroll or skip consequences', async () => {
            const { runtime, writes, rolls } = fakeRuntime(wizardActor());
            runtime.chat.send = async () => { throw new Error('chat transport down'); };
            const body = { requestId: 'rv03-chat-0001', kind: 'spell', itemId: 'mm', overrides: { manualValue: 2 } };
            const first = await statusOf(await handleActorAction('w1', request(runtime, body) as any));
            assert.equal(first.status, 200); assert.equal(first.body.outcome.success, false);
            assert.ok(first.body.warnings.some((warning: string) => /chat transport down/.test(warning)));
            assert.deepEqual(writes.filter(write => write[0] === 'item.update').map(write => write[3]), [{ 'system.lost': true }]);
            assert.equal((await statusOf(await handleActorAction('w1', request(runtime, body) as any))).body.replayed, true);
            assert.equal(rolls(), 0); assert.equal(writes.filter(write => write[0] === 'item.update').length, 1);
        });
        await check('RV-03', 'a replay of a partial result applies only the outstanding writes, without rerolling', async () => {
            const { runtime, writes, rolls } = fakeRuntime(wizardActor(), { rolls: [2, 20] });
            let refuse = true;
            const update = runtime.documents.items.update;
            runtime.documents.items.update = async (parent: any, id: string, data: any) => {
                if (refuse && 'system.lost' in data) throw new Error('write refused');
                return update(parent, id, data);
            };
            const body = { requestId: 'rv03-part-0001', kind: 'ability', itemId: 'turn' };
            const first = await statusOf(await handleActorAction('w1', request(runtime, body) as any));
            assert.equal(first.body.state, 'partial');
            assert.deepEqual(first.body.consequences.map((entry: any) => entry.status), ['applied', 'failed']);
            refuse = false;
            const again = await statusOf(await handleActorAction('w1', request(runtime, body) as any));
            assert.equal(again.body.state, 'complete'); assert.equal(rolls(), 1);
            assert.deepEqual(writes.filter(write => write[0] === 'item.update').map(write => write[3]), [{ 'system.uses.available': 0 }, { 'system.lost': true }],
                'the use is consumed once; only the lost write is retried');
        });
        await check('RV-03', 'a new adapter runtime does not replay results from the previous one', async () => {
            const { runtime, writes } = fakeRuntime(potionActor());
            await handleActorAction('a1', request(runtime, { requestId: 'rv03-life-0001', kind: 'potion', itemId: 'potion' }) as any);
            (shadowdarkAdapter as any).runtimeGeneration++;
            const fresh = await statusOf(await handleActorAction('a1', request(runtime, { requestId: 'rv03-life-0001', kind: 'potion', itemId: 'potion2' }) as any));
            assert.equal(fresh.status, 200); assert.equal(fresh.body.replayed, undefined);
            assert.deepEqual(writes.filter(write => write[0] === 'item.delete').map(write => write[2]), ['potion', 'potion2']);
        });
    } finally {
        shadowdarkAdapter.lookups = lookupsFn;
        shadowdarkAdapter.resolveDocumentFor = resolver;
    }
}

async function importerAndCards() {
    await check('SD01-09', 'import with unresolved references writes nothing until confirmed', async () => {
        const unique = shadowdarkAdapter.findUniqueByName;
        const resolve = shadowdarkAdapter.resolveReadable;
        const catalog = shadowdarkAdapter.getChoiceCatalog;
        shadowdarkAdapter.findUniqueByName = async (name: string) => name === 'Arrows'
            ? { doc: { name: 'Arrows', type: 'Basic', uuid: 'Compendium.shadowdark.gear.Item.arrows', system: { quantity: 20, isAmmunition: true } }, ambiguous: [] }
            : { doc: null, ambiguous: [] };
        shadowdarkAdapter.resolveReadable = async () => null;
        shadowdarkAdapter.getChoiceCatalog = async () => ({});
        try {
            const json = { name: 'Imported', rolledStats: { STR: 9, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }, maxHitPoints: 6, level: 1,
                gear: [{ name: 'Arrows', type: 'basic', quantity: 1 }, { name: 'Mystery Box', type: 'sundry', quantity: 2, slots: 1 }] };
            const { runtime, writes } = fakeRuntime(null as any);
            (runtime.documents as any).create = async (type: string, data: any) => { writes.push(['create', type, data]); return { _id: 'new' }; };
            const preview = await new ShadowdarkImporter().importFromJSON(runtime, json);
            assert.equal(preview.needsConfirmation, true); assert.equal(writes.length, 0);
            assert.ok(preview.unresolved!.some(entry => entry.name === 'Mystery Box'));
            const done = await new ShadowdarkImporter().importFromJSON(runtime, json, { confirm: true, allowCustomGear: true });
            assert.equal(done.success, true);
            const actorData = writes.find(write => write[0] === 'create')[2];
            assert.deepEqual(actorData.system.abilities.str, { value: 9 }, 'native score field only');
            assert.equal(actorData.system.ancestry, undefined, 'no names written into UUID fields');
            const items = writes.filter(write => write[0] === 'item.create').map(write => write[2]);
            assert.equal(items.find(item => item.name === 'Arrows').system.quantity, 1, 'ammo quantity is not inferred from the name');
            assert.match(items.find(item => item.name === 'Mystery Box').system.description, /Custom item/);
        } finally {
            shadowdarkAdapter.findUniqueByName = unique; shadowdarkAdapter.resolveReadable = resolve;
            shadowdarkAdapter.getChoiceCatalog = catalog;
        }
    });
    await check('SD01-13', 'cards never project the alternate identification fields', () => {
        const actor: any = { _id: 'a', type: 'Player', system: {}, effects: [], items: [{ _id: 'p', name: 'Unknown Potion', type: 'Potion',
            system: { description: '<p>Bubbling.</p>', identification: { identified: false, name: 'Potion of Flying', description: '<p>Secret: you fly.</p>' } }, effects: [] }] };
        const card = buildOwnedItemCard(prepareShadowdarkView(actor), actor.items[0])!;
        const text = JSON.stringify(card);
        assert.doesNotMatch(text, /Flying|Secret/); assert.ok(card.states.includes('Unidentified'));
    });
    await check('SD01-13', 'description presentation sanitizes without rewriting source', () => {
        const source = '<p onclick="steal()">Hit [[/r 1d6]] or [[check 12 dex]] @UUID[Compendium.shadowdark.spells.Item.x]{Light}<script>alert(1)</script><a href="javascript:alert(1)">x</a></p>';
        const before = source;
        const html = presentDescription(source);
        assert.equal(source, before);
        assert.doesNotMatch(html, /<script|onclick|javascript:/);
        assert.match(html, /data-action="roll-formula" data-formula="1d6"/);
        assert.match(html, /data-action="roll-check" data-dc="12" data-stat="dex"/);
        assert.match(html, /data-uuid="Compendium.shadowdark.spells.Item.x"/);
    });
    await check('SD01-16', 'NPC card lists attacks with counts, ranges, damage and features', () => {
        const npc: any = { _id: 'm', name: 'Medusa', type: 'NPC', effects: [], system: { alignment: 'chaotic', abilities: { dex: { mod: 1 } },
            attributes: { ac: { value: 14 }, hp: { value: 38, max: 38 } }, level: { value: 8 }, move: 'near', darkAdapted: true },
            items: [{ _id: 'bite', name: 'Snake Bite', type: 'NPC Attack', effects: [], system: { attack: { num: 1 }, ranges: ['close'],
                bonuses: { attackBonus: 6, damageBonus: 0, critical: { successThreshold: 20, failureThreshold: 1, multiplier: 2 } }, damage: { value: '1d6', special: 'Poison' } } },
            { _id: 'poison', name: 'Poison', type: 'NPC Feature', effects: [], system: { description: '<p>[[check 15 con]] or go to 0 HP.</p>' } }] };
        const card = buildNpcCard(prepareShadowdarkView(npc), npc, null);
        const attack = card.sections.find(section => section.title === 'Attacks')!.entries[0];
        assert.deepEqual(attack.facts!.map(fact => fact.value), ['+6', 'Close', '1d6', 'Poison']);
        assert.equal(card.sections.find(section => section.title === 'Features')!.entries[0].title, 'Poison');
    });
}

/** Independent oracle from the pinned native 4.0.6 pack source when it is present locally. */
async function nativePackOracle() {
    const root = process.env.SHADOWDARK_NATIVE_REF ?? join(process.cwd(), 'temp/shadowdark');
    const packs = join(root, 'data/packs');
    if (!existsSync(join(packs, 'talents.db'))) {
        results.push({ id: 'A01-01', name: 'native pack oracle (skipped: native 4.0.6 reference not present)', ok: true });
        return;
    }
    const read = (dir: string, prefix: string) => JSON.parse(readFileSync(join(packs, dir, readdirSync(join(packs, dir)).find(file => file.endsWith(`__${prefix}.json`))!), 'utf8'));
    await check('A01-01', 'native Weapon Mastery + Longsword packs, Foundry 14 migrated, give +0 / d8+1', () => {
        const talent = read('talents.db', '5bpWuaT0KTNzuzCu');
        const effect = read('talents.db', 'E7SwrOhzSAyMZ1Ec');
        const sword = read('gear.db', 'ZPUhNMmwXXrtbCXi');
        // Foundry 14 BaseActiveEffect.migrateData: changes → system.changes, mode → type.
        const migrated = { ...effect, system: { changes: effect.changes.map((change: any) => ({ key: change.key, type: ['custom', 'multiply', 'add', 'downgrade', 'upgrade', 'override'][change.mode], value: change.value, phase: 'initial', priority: change.priority })) } };
        delete migrated.changes;
        const template = { ...talent, uuid: 'Compendium.shadowdark.talents.Item.5bpWuaT0KTNzuzCu', effects: [migrated] };
        const choice = applyChoice(template, 'longsword', 'weapon', choiceCatalog([sword]));
        const actor: any = { _id: 'prim', type: 'Player', system: { abilities: { str: { value: 9 }, dex: { value: 10 } }, level: { value: 1 } }, effects: [],
            items: [{ ...sword, system: { ...sword.system, equipped: true } }, { ...choice, _id: 'm' }] };
        const action = prepareShadowdarkView(actor).actions.find(entry => entry.itemId === sword._id)!;
        assert.equal(action.bonus, 0); assert.equal(action.damage?.formula, 'd8+1');
    });
}

export async function run(options: { report?: boolean } = {}) {
    results.length = 0;
    await effectsRoute();
    await actions();
    await preparation();
    await registryAndRoutes();
    await reviewCorrections();
    await importerAndCards();
    await nativePackOracle();
    const failed = results.filter(result => !result.ok);
    if (options.report || failed.length) {
        for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.id} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
    }
    console.log(`shadowdark ADR-0001 boundaries: ${results.length - failed.length}/${results.length} passed`);
    if (failed.length) throw new Error(`${failed.length} boundary regressions failed`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run({ report: process.argv.includes('--report') }).catch(() => { process.exitCode = 1; });
}
