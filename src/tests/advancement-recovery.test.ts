/** SD02-R1: actual handlers and independent stored-source outcomes, offline SDK only. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { nativePacks } from './core0191/world';
import { shadowdarkAdapter as adapter } from '../server/ShadowdarkAdapter';
import { DECLARED_PACKS, ownedCopy } from '../logic/identity';
import { primLike, worldSnapshot } from './fixtures/native-406';
import { handleFinalizeLevelUp, handleGetLevelUpData } from '../server/api/level-up';
import { reviewToken } from '../server/source-review';
import { SdkError } from '@sheet-delver/sdk';
const packs = nativePacks(process.env.SHADOWDARK_NATIVE ?? path.resolve('temp/shadowdark'), DECLARED_PACKS.map(p => p.id));
const rows: any[] = Object.entries(packs).flatMap(([pack, docs]) => docs.map(doc => ({ ...doc, pack, uuid: `Compendium.${pack}.${['Player','NPC'].includes(doc.type) ? 'Actor' : pack.endsWith('tables') ? 'RollTable' : 'Item'}.${doc._id}` })));
const byUuid = new Map(rows.map(doc => [doc.uuid, doc]));
const world = { snapshot: () => worldSnapshot(1), assertRevision: () => {} };
const compendium = { findAll: async () => rows, getById: async (_type: string, uuid: string) => structuredClone(byUuid.get(uuid) ?? null) };
await adapter.initialize({ compendium, documents: { get: async () => null, list: async () => ({ rows: [], total: 0 }) }, logger: console, world } as any);
const KNIGHT = 'Compendium.shadowdark.classes.Item.0uVUOXKuX9xfJ600', WITCH = 'Compendium.shadowdark.classes.Item.KGnBAFiTiLHZJUND';
const grant = rows.find(doc => doc._id === 'XRW3jhpTni15hwFc');
const spell = rows.find(doc => doc.type === 'Spell' && doc.system.tier === 1 && doc.system.class.includes(WITCH));
function fixture(failure = '') {
    const actor: any = primLike(); actor.effects = []; actor.system.class = KNIGHT; actor.system.level = { value: 2, xp: 35 };
    actor.items = [{ ...ownedCopy(byUuid.get(KNIGHT), KNIGHT), _id: 'class' }, { ...ownedCopy(grant, grant.uuid), _id: 'grant' }];
    const initial = structuredClone(actor), events: any[] = [], records = new Map<string, any>(); let sequence = 0, revision = 1, owner = true, visible = true;
    const runtime: any = { world: { snapshot: () => worldSnapshot(revision), assertRevision: (value: number) => { if (value !== revision) throw Error('Retired context'); } }, compendium, access: { canReadPack: () => true },
        dataStore: { get: async (key: string) => structuredClone(records.get(key) ?? null), set: async (key: string, value: any) => { records.set(key, structuredClone(value)); } },
        documents: { get: async (type: string, id: string, options: any = {}) => type === 'Actor' && id === actor._id && visible && (options.minOwnership !== 'owner' || owner) ? structuredClone(actor) : null,
            list: async () => ({ rows: [], total: 0 }),
            patch: async (_type: string, _id: string, patch: any) => {
                events.push({ kind: 'patch', patch }); if (failure === 'patch') throw new SdkError('permission_denied', 'Refused final patch');
                for (const [path, value] of Object.entries(patch)) { const parts = path.split('.'); let target = actor;
                    for (const part of parts.slice(0, -1)) target = target[part] ??= {}; target[parts.at(-1)!] = value; }
                if (failure === 'patch-lost') throw new Error('Patch acknowledgement lost');
            }, items: { create: async (_parent: any, item: any) => {
                const index = ++sequence; events.push({ kind: 'item', index, name: item.name });
                if (failure === `item-${index}`) throw new SdkError('permission_denied', `Refused Item ${index}`);
                const created = { ...structuredClone(item), _id: `confirmed${index}` }; actor.items.push(created);
                if (failure === 'item-lost') throw new Error('Create acknowledgement lost'); return structuredClone(created);
            } } } };
    const body: any = { requestId: 'advancement-test', baseline: reviewToken(actor), classUuid: KNIGHT, targetLevel: 3, selectedSpells: [spell], rolledTalents: [grant], hpRoll: 3 };
    const request = (input = body): any => ({ runtime, userSession: { userId: 'offline-owner' }, url: 'http://offline/level-up/data', json: async () => structuredClone(input) });
    const run = async (input = body) => { const response = await handleFinalizeLevelUp(actor._id, request(input)); return { status: response!.status, body: await response!.json() as any }; };
    const review = (items = {}) => ({ requestId: body.requestId, recovery: { reviewed: true, baseline: reviewToken(actor), items } });
    return { actor, initial, events, records, body, request, run, review, restore: () => { failure = ''; }, context: (value: number) => { revision = value; }, authority: (owned: boolean, seen = true) => { owner = owned; visible = seen; } };
}
const checks: any[] = [];
async function check(name: string, run: () => Promise<void>) { try { await run(); checks.push({ name, pass: true }); } catch (e) { checks.push({ name, pass: false, error: String(e) }); } }
const unchangedAdvancement = (f: ReturnType<typeof fixture>) => { assert.deepEqual(f.actor.system.level, f.initial.system.level); assert.deepEqual(f.actor.system.attributes.hp, f.initial.system.attributes.hp); };
const finished = (f: ReturnType<typeof fixture>) => { assert.deepEqual(f.actor.system.level, { value: 3, xp: 15 }); assert.deepEqual(f.actor.system.attributes.hp, { value: 11, max: 11 }); assert.equal(f.actor.items.length, 4); };
await check('first Item refusal preserves level/XP/HP and reports refused outcome', async () => {
    const f = fixture('item-1'), result = await f.run(); unchangedAdvancement(f); assert.equal(result.body.state, 'partial');
    assert.equal(result.body.items, undefined, 'receipts must not serve saved source payloads'); assert.equal(result.body.operations[0].status, 'failed'); assert.equal(result.body.operations[0].itemId, undefined); assert.equal(f.events.length, 1);
    f.restore(); assert.equal((await f.run()).body.state, 'complete'); finished(f);
});
await check('later Item refusal resumes only outstanding grants; final patch follows all grants', async () => {
    const f = fixture('item-2'), result = await f.run(); unchangedAdvancement(f); assert.equal(result.body.operations[0].itemId, 'confirmed1');
    assert.equal(f.actor.items.length, 3); f.restore(); assert.equal((await f.run()).body.state, 'complete'); finished(f);
    assert.deepEqual(f.events.map(e => e.kind), ['item','item','item','patch']); assert.equal(f.actor.items.filter((i: any) => i._id === 'confirmed1').length, 1);
    await f.run(); assert.equal(f.events.length, 4);
});
await check('lost Item acknowledgement never repeats; exact-ID explicit source review recovers', async () => {
    const f = fixture('item-lost'), result = await f.run(); unchangedAdvancement(f); assert.equal(result.body.operations[0].status, 'uncertain');
    f.restore(); await f.run(); assert.equal(f.events.length, 1);
    assert.ok((await f.run(f.review({ 0: 'grant' }))).status! >= 400); assert.equal(f.events.length, 1);
    const repaired = await f.run(f.review({ 0: 'confirmed1' })); assert.equal(repaired.body.state, 'complete'); finished(f);
    assert.deepEqual(f.events.map(e => e.kind), ['item','item','patch']);
});
await check('final Actor refusal retries frozen scalar values without repeating grants', async () => {
    const f = fixture('patch'); const result = await f.run(); unchangedAdvancement(f); assert.equal(f.actor.items.length, 4);
    assert.equal(result.body.operations.at(-1).status, 'failed'); f.restore(); assert.equal((await f.run()).body.state, 'complete'); finished(f);
    assert.deepEqual(f.events.map(e => e.kind), ['item','item','patch','patch']); assert.deepEqual(f.events[2]!.patch, f.events[3]!.patch);
});
await check('lost final Actor acknowledgement needs explicit exact-source review and no second patch', async () => {
    const f = fixture('patch-lost'); assert.equal((await f.run()).body.state, 'partial'); finished(f); f.restore();
    assert.equal((await f.run()).body.state, 'partial'); assert.equal(f.events.length, 3);
    assert.equal((await f.run(f.review())).body.state, 'complete'); assert.equal(f.events.length, 3); finished(f);
});
await check('concurrent duplicate requests and completed replay write once', async () => {
    const f = fixture(); const results = await Promise.all([f.run(), f.run()]); assert.ok(results.every(r => r.body.state === 'complete')); finished(f); assert.equal(f.events.length, 3);
    assert.equal((await f.run()).body.state, 'complete'); assert.equal(f.events.length, 3);
    assert.equal((await f.run({ ...f.body, hpRoll: 5 })).status, 409);
});
await check('restart receipts require review then continue confirmed refusals safely', async () => {
    const f = fixture('item-2'); await f.run(); f.restore();
    for (const record of f.records.values()) if (record.process) record.process = 'prior-process';
    assert.equal((await f.run()).body.state, 'partial'); assert.equal(f.events.length, 2);
    assert.equal((await f.run(f.review())).body.state, 'complete'); finished(f); assert.equal(f.events.length, 4);
});
await check('interrupted started receipt becomes uncertain and cannot repeat automatically', async () => {
    const f = fixture('item-lost'); await f.run(); f.restore();
    for (const record of f.records.values()) if (record.grants) { record.process = 'prior-process'; record.grants[0].status = 'started'; }
    const replay = await f.run(); assert.equal(replay.body.operations[0].status, 'uncertain'); assert.equal(f.events.length, 1);
    assert.equal((await f.run(f.review({ 0: 'confirmed1' }))).body.state, 'complete'); finished(f);
});
await check('fresh request cannot bypass pending operation; reopening exposes stable request and receipts', async () => {
    const f = fixture('item-2'); await f.run(); f.restore();
    assert.equal((await f.run({ ...f.body, requestId: 'different-operation', baseline: reviewToken(f.actor) })).status, 409);
    const response = await handleGetLevelUpData(f.actor._id, f.request()); const data: any = await response.json();
    assert.equal(data.data.advancementOperation.requestId, f.body.requestId); assert.equal(data.data.advancementOperation.operations[0].itemId, 'confirmed1');
    assert.equal(f.events.length, 2);
});
await check('intervening edits cannot be blessed by review; source changes never advance', async () => {
    const f = fixture('item-2'); await f.run(); f.restore(); f.actor.system.level.xp++;
    assert.equal((await f.run()).body.state, 'partial'); assert.equal((await f.run(f.review())).status, 409); assert.equal(f.events.length, 2);
});
const dispose = (f: ReturnType<typeof fixture>, action = 'retire-zero-write', note?: string) => ({ ...f.review(), recovery: { ...f.review().recovery, action, ...(note ? { note } : {}) } });
await check('R1a zero-write/context-change retirement permits fresh approved advancement, never old replay', async () => {
    const f = fixture('item-1'); await f.run(); f.restore(); f.context(2);
    assert.equal((await f.run(f.review())).status,409);
    const fresh = { ...f.body, requestId: 'fresh-current-plan', baseline: reviewToken(f.actor) };
    assert.equal((await f.run(fresh)).status,409); assert.deepEqual(f.actor,f.initial);
    const original = [...f.records.values()].find(row => row.grants);
    const terminal = await f.run(dispose(f)); assert.equal(terminal.body.state,'retired'); assert.equal(terminal.body.terminal.disposition,'zero-write');
    assert.equal(f.events.length,1); const saved = [...f.records.values()].find(row => row.grants);
    assert.deepEqual(saved.grants,original.grants); assert.equal(saved.revision,1); assert.equal(saved.terminal.revision,2);
    assert.equal((await f.run(fresh)).body.state,'complete'); finished(f); const count=f.events.length;
    assert.equal((await f.run(f.body)).body.state,'retired'); assert.equal((await f.run(dispose(f))).body.state,'retired'); assert.equal(f.events.length,count);
});
await check('R1a zero-write retirement survives restart and duplicate requests without erasing journal', async () => {
    const f=fixture('item-1');await f.run();f.restore();f.context(2);
    for(const row of f.records.values())if(row.process)row.process='prior-process';
    const results=await Promise.all([f.run(dispose(f)),f.run(dispose(f))]);assert.ok(results.every(row=>row.body.state==='retired'));assert.equal(f.events.length,1);
    const saved=[...f.records.values()].find(row=>row.grants);assert.equal(saved.grants[0].status,'failed');assert.ok(saved.terminal.at);
    saved.process='another-process';assert.equal((await f.run()).body.state,'retired');assert.equal(f.events.length,1);
    const response=await handleGetLevelUpData(f.actor._id,f.request());assert.equal((await response.json() as any).data.advancementOperation,null);
});
await check('R1a terminal disposition must persist before active exclusion is released', async () => {
    const f=fixture('item-1');await f.run();f.restore();f.context(2);
    const save=f.request().runtime.dataStore.set;let fail=true;
    f.request().runtime.dataStore.set=async(key:string,value:any)=>{if(fail&&value.terminal)throw Error('Terminal persistence refused');return save(key,value);};
    assert.equal((await f.run(dispose(f))).status,500);
    assert.equal((await f.run({...f.body,requestId:'fresh-before-durable',baseline:reviewToken(f.actor)})).status,409);
    assert.equal([...f.records.values()].find(row=>row.grants).terminal,undefined);assert.equal(f.events.length,1);
    fail=false;assert.equal((await f.run(dispose(f))).body.state,'retired');assert.equal(f.events.length,1);
});
await check('R1a retirement rejects stale reviews, changed source, non-owner/hidden/other callers', async () => {
    const f=fixture('item-1');await f.run();f.restore();f.context(2);
    const stale=dispose(f);stale.recovery.baseline='sha256:stale';assert.equal((await f.run(stale)).status,409);
    f.actor.system.level.xp++;assert.equal((await f.run(dispose(f))).status,409);f.actor.system.level.xp--;
    f.authority(false);assert.equal((await f.run(dispose(f))).status,403);f.authority(false,false);assert.equal((await f.run(dispose(f))).status,404);f.authority(true);
    const request=f.request(dispose(f));request.userSession.userId='another-owner';const response=await handleFinalizeLevelUp(f.actor._id,request);assert.equal(response!.status,404);
    assert.equal([...f.records.values()].find(row=>row.grants).terminal,undefined);assert.equal(f.events.length,1);
});
await check('R1a uncertain/in-flight outcomes cannot use zero-write retirement even after source restoration', async () => {
    for(const status of ['uncertain','started']){const f=fixture('item-lost');await f.run();f.restore();f.context(2);
        for(const row of f.records.values())if(row.grants)row.grants[0].status=status;
        f.actor.items=structuredClone(f.initial.items);assert.equal((await f.run(dispose(f))).status,409);assert.equal(f.events.length,1);
        assert.equal([...f.records.values()].find(row=>row.grants).terminal,undefined);
    }
});
await check('R1a partial known writes require exact restoration and preserve terminal evidence', async () => {
    const f=fixture('item-2');await f.run();f.restore();f.context(2);
    assert.equal((await f.run(dispose(f))).status,409);
    assert.equal((await f.run(dispose(f,'resolve-restored','Reviewed export restoration'))).status,409);
    // Independent operator restoration through ordinary document controls is
    // modeled here. The resolution handler itself must perform zero writes.
    f.actor.items=structuredClone(f.initial.items);
    assert.equal((await f.run(dispose(f))).status,409);
    assert.equal((await f.run(dispose(f,'resolve-restored'))).status,400);
    const response=await f.run(dispose(f,'resolve-restored','Removed exact confirmed1; compared original source export'));
    assert.equal(response.body.state,'retired');assert.equal(response.body.terminal.disposition,'restored');assert.equal(f.events.length,2);
    const saved=[...f.records.values()].find(row=>row.grants);assert.equal(saved.grants[0].itemId,'confirmed1');assert.equal(saved.grants[0].status,'complete');
    assert.equal(saved.initialPatch.find((row:any)=>row.path==='system.level.xp').value,35);
    assert.equal((await f.run({...f.body,requestId:'fresh-after-restoration',baseline:reviewToken(f.actor)})).body.state,'complete');finished(f);
});
await check('R1a uncertain grant can reconcile without stale-rule replay, then verified restoration closes it', async () => {
    const f=fixture('item-lost');await f.run();f.restore();f.context(2);
    const reconciled=await f.run({...f.review({0:'confirmed1'}),recovery:{...f.review({0:'confirmed1'}).recovery,action:'reconcile'}});
    assert.equal(reconciled.body.operations[0].status,'complete');assert.equal(reconciled.body.state,'partial');assert.equal(f.events.length,1);unchangedAdvancement(f);
    assert.equal((await f.run(f.review())).status,409);assert.equal(f.events.length,1);
    f.actor.items=structuredClone(f.initial.items);
    assert.equal((await f.run(dispose(f,'resolve-restored','Reconciled confirmed1, removed it and verified original export'))).body.state,'retired');assert.equal(f.events.length,1);
});
console.log(JSON.stringify({ scope: 'offline actual handlers; stored source/receipt/order assertions; not native acceptance', checks }, null, 2));
if (checks.some(c => !c.pass)) process.exitCode = 1;
