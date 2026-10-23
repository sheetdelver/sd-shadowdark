import { SPELL_CHOICE_GRANTS, SPELL_CLASSES, shuneSpellTier, spellGrantClasses, spellFitsGrant, matchSpellGrants, spellGrantCastingRefs } from '../logic/spell-grants';
/** ADR-0002 sanitized source regressions. No operator data or native writes. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { nativePacks } from './core0191/world';
import { ShadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { DECLARED_PACKS, ownedCopy } from '../logic/identity';
import { primLike, worldSnapshot } from './fixtures/native-406';
import { handleFinalizeLevelUp, handleRollHP } from '../server/api/level-up';
import { handleActorView } from '../server/api/actor-view';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { spellReview } from '../logic/spell-review';
import { spellLimit } from '../logic/spell-model';
import { handleSpellGrants } from '../server/api/spell-grants';
import { handleManageSpells } from '../server/api/manage-spells';
import { resolveSubItems, enrichItem } from '../logic/actor-enricher';
import { resolveBaggage } from '../server/api/gear-resolver';
import { SdkError } from '@sheet-delver/sdk';
const nativeRoot = process.env.SHADOWDARK_NATIVE ?? path.resolve(process.cwd(), 'temp/shadowdark');
const packs = nativePacks(nativeRoot, DECLARED_PACKS.map(p => p.id));
const rows: any[] = Object.entries(packs).flatMap(([pack, docs]) => docs.map(doc => ({ ...doc, pack, uuid: `Compendium.${pack}.${doc.type === 'Player' || doc.type === 'NPC' ? 'Actor' : pack.endsWith('tables') ? 'RollTable' : 'Item'}.${doc._id}` })));
const byUuid = new Map(rows.map(doc => [doc.uuid, doc]));
const adapter = new ShadowdarkAdapter();
const documents: any = { get: async () => null, fetchByUuid: async () => null, list: async () => ({ rows: [], total: 0 }) };
const caller: any = { runtime: { documents, access: { canReadPack: () => true }, world: { snapshot: () => worldSnapshot(1), assertRevision: () => {} } }, isGM: false };
await adapter.initialize({ compendium: { findAll: async (type: string) => rows.filter(doc => type === 'Item' ? !['Player','NPC'].includes(doc.type) : type === doc.type), getById: async (_type: string, uuid: string) => byUuid.get(uuid) ?? null }, documents, logger: console, world: caller.runtime.world } as any);
const KNIGHT = 'Compendium.shadowdark.classes.Item.0uVUOXKuX9xfJ600';
const WITCH = 'Compendium.shadowdark.classes.Item.KGnBAFiTiLHZJUND';
const talent = rows.find(doc => doc._id === 'XRW3jhpTni15hwFc')!;
const checks: any[] = [];
async function check(id: string, fn: () => unknown | Promise<unknown>) { try { await fn(); checks.push({ id, passed: true }); } catch (e) { checks.push({ id, passed: false, error: (e as Error).message }); } }
const knight = () => { const a: any = primLike(); a.items = [{ ...ownedCopy(byUuid.get(KNIGHT), KNIGHT), _id: 'class' }, { ...ownedCopy(talent, talent.uuid), _id: 'talent' }]; a.effects = []; a.system.class = KNIGHT; a.system.level = { value: 2, xp: 35 }; return a; };
const WIZARD = 'Compendium.shadowdark.classes.Item.035nuVkU9q2wtMPs';
const castingActor = () => { const a: any = primLike(); a.items = [{ _id: 'spellA', name: 'Custom spell', type: 'Spell', system: { class: ['Item.worldClass'], tier: 1, lost: false }, effects: [] }];
    a.effects = [{ _id: 'grant', changes: [{ key: 'system.spellcasting.classes', mode: 2, value: 'wizard', priority: 20 }], disabled: false, transfer: true }]; a.system.class = 'Item.worldClass'; return a; };
await check('SD-UI16d native grant inventory covers every Learn Spell template and table reference', () => {
    const templates = rows.filter(doc => doc.type === 'Talent' && /^Learn.*Spell$/i.test(doc.name));
    assert.deepEqual(templates.map(doc => doc.uuid).sort(), Object.keys(SPELL_CHOICE_GRANTS).sort());
    const references = rows.filter(doc => Array.isArray(doc.results)).flatMap(doc => doc.results)
        .map(result => result.documentUuid).filter(uuid => templates.some(doc => doc.uuid === uuid));
    for (const uuid of Object.keys(SPELL_CHOICE_GRANTS).filter(uuid => !uuid.endsWith('Ey3P0EplF5SHIdey'))) assert.ok(references.includes(uuid), uuid);
    assert.deepEqual(spellGrantCastingRefs(rows.filter(doc => doc.type === 'Talent' && /Magical Dabbler|Spellcasting Advantage|Magic Missile Advantage/.test(doc.name))), []);
});
await check('SD-UI16d Shune uses acquisition level, rounds down with minimum one, and requires exact Wizard tier', () => {
    const grant = byUuid.get('Compendium.shadowdark.talents.Item.mgRrWET5MEaGLVNo');
    assert.deepEqual([1,2,3,4,5,6,7,8,9,10].map(shuneSpellTier), [1,1,1,2,2,3,3,4,4,5]);
    for (let level=1; level<=10; level++) for (const spell of rows.filter(doc => doc.type === 'Spell')) {
        const expected = spell.system.class.includes(WIZARD) && spell.system.tier === Math.max(1, Math.floor(level/2));
        assert.equal(spellFitsGrant(grant, spell, {level,known:[]}),expected, level+':'+spell.name);
    }
});
await check('SD-UI16d each native choice grant supplies casting on a noncaster without borrowed progression', async () => {
    for (const [uuid, rule] of Object.entries(SPELL_CHOICE_GRANTS)) {
        const list = rule.classUuid ?? WIZARD;
        const spell = rows.find(doc => doc.type === 'Spell' && doc.system.tier === 1 && doc.system.class.includes(list));
        const actor = primLike(); actor.system.class = 'Compendium.shadowdark.classes.Item.hO7KrvqDRH6kvftJ'; actor.effects=[];
        const talent = { ...ownedCopy(byUuid.get(uuid)), _id:'grant' };
        const learned = { ...ownedCopy(spell), _id:'learned', flags:{shadowdark:{spellGrant:{source:uuid,classUuid:list,level:1}}} };
        actor.items=[talent,learned]; const before=structuredClone(actor);
        const lookups=await adapter.callerLookups(actor,caller), view=prepareShadowdarkView(actor,lookups);
        const action=view.actions.find(row=>row.itemId==='learned' && row.kind==='spell');
        assert.equal(action?.available,true,uuid); assert.equal(action?.ability,byUuid.get(list).system.spellcasting.ability);
        assert.equal(view.spellModel.owned[0].classification,'granted');
        assert.ok(view.spellModel.sources.every(source=>Object.values(source.limits).every(limit=>limit.status==='unavailable')));
        assert.deepEqual(actor,before);
        const denied=await adapter.callerLookups(actor,{...caller,runtime:{...caller.runtime,access:{canReadPack:()=>false}}});
        assert.equal(prepareShadowdarkView(actor,denied).actions.find(row=>row.itemId==='learned')?.available,false);
    }
});
await check('SD-UI16d Shune keeps INT when another active class has a higher casting modifier', async () => {
    const uuid='Compendium.shadowdark.talents.Item.mgRrWET5MEaGLVNo';
    // Controlled custom shared-list fixture; native lists need not overlap.
    const spell=structuredClone(rows.find(doc=>doc.type==='Spell'&&doc.system.class.includes(WIZARD)));
    spell.system.class=[WIZARD,SPELL_CLASSES.priest];
    const actor:any=primLike(); actor.system.abilities.wis.value=18;actor.system.abilities.int.value=10;
    actor.effects=[{_id:'priest',disabled:false,transfer:true,changes:[{key:'system.spellcasting.classes',mode:2,value:'priest',priority:20}]}];
    actor.items=[{...ownedCopy(byUuid.get(uuid)),_id:'grant'}, {...ownedCopy(spell),_id:'learned',flags:{shadowdark:{spellGrant:{source:uuid,classUuid:WIZARD,level:1}}}}];
    const view=prepareShadowdarkView(actor,await adapter.callerLookups(actor,caller));
    assert.equal(view.actions.find(row=>row.itemId==='learned')?.ability,'int');
});
await check('SD-UI16d mixed grants match distinct eligible spells independent of selection order', () => {
    const wizard=byUuid.get('Compendium.shadowdark.talents.Item.T5nkdUM75LSnDpu5');
    const witch=byUuid.get('Compendium.shadowdark.talents.Item.ZYZkbENdQAiNsEL6');
    const w=rows.find(doc=>doc.type==='Spell'&&doc.system.tier===1&&doc.system.class.includes(WIZARD)&&!doc.system.class.includes(WITCH));
    const c=rows.find(doc=>doc.type==='Spell'&&doc.system.tier===1&&doc.system.class.includes(WITCH)&&!doc.system.class.includes(WIZARD));
    const context={level:1,known:[w,c]};
    assert.deepEqual(matchSpellGrants([wizard,witch],[c,w],context),[1,0]);
    assert.equal(matchSpellGrants([wizard,witch],[w,w],context),null);
    assert.equal(matchSpellGrants([wizard],[c],context),null);
});
await check('SD-UI16d generic shared-list choice retains the Class that establishes its eligible tier', () => {
    const grant=byUuid.get('Compendium.shadowdark.talents.Item.Ey3P0EplF5SHIdey');
    const known=[{type:'Spell',system:{tier:1,class:[WIZARD]}},{type:'Spell',system:{tier:2,class:[WITCH]}}];
    const choice={type:'Spell',system:{tier:2,class:[WIZARD,WITCH]}};
    assert.deepEqual(spellGrantClasses(grant,choice,{level:3,known}),[WITCH]);
});
await check('SD-UI15 first-level Priest picker excludes the automatic Turn Undead grant', async () => {
    const priest = 'Compendium.shadowdark.classes.Item.oZWzXx1WRLg286zD';
    const turn = 'Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH';
    for (const actor of [null, { ...primLike(), items: [], system: { class: priest, level: { value: 0 } } }]) {
        const data = await adapter.getLevelUpData(actor, priest, undefined, caller);
        assert.equal(data.spellsToChoose[1], 2);
        assert.equal(data.availableSpells.find((spell: any) => spell.uuid === turn)?.isInnate, true);
        assert.ok(data.availableSpells.filter((spell: any) => !spell.isInnate && spell.system.tier === 1).length >= 2);
    }
});
await check('SD-UI16 advancement catalogs flag owned origins without changing grant classification', async () => {
    const actor = primLike(); const spell = rows.find(doc => doc.type === 'Spell' && doc.system?.class?.includes(WIZARD));
    actor.system.class = WIZARD; actor.system.level.value = 1;
    actor.items = [{ ...ownedCopy(spell, spell.uuid), _id: 'fromBoon' }];
    const data = await adapter.getLevelUpData(actor, WIZARD, undefined, caller);
    assert.equal(data.availableSpells.find((row: any) => row.uuid === spell.uuid)?.isKnown, true);
    assert.equal(data.availableSpells.find((row: any) => row.uuid === spell.uuid)?.isInnate, false);
});
await check('SD02-01 L01/L02/L04 diagnostics do not infer missing native data', () => {
    const a = castingActor(); const source = structuredClone(a); a.effects = [];
    const missingGrant = prepareShadowdarkView(a, { classDocument: () => byUuid.get(WIZARD) });
    assert.match(missingGrant.actions.find(row => row.kind === 'spell')!.reason!, /Missing casting grant/);
    a.effects = source.effects; a.items[0].system.class = [];
    assert.match(prepareShadowdarkView(a).actions.find(row => row.kind === 'spell')!.reason!, /no class reference/);
    a.items[0].system.class = [WIZARD]; a.effects[0].changes[0].value = 'knight-of-st.-ydris';
    assert.match(prepareShadowdarkView(a, { classDocument: () => byUuid.get(WIZARD) }).actions.find(row => row.kind === 'spell')!.reason!, /does not match/);
    assert.equal(a.items[0]._stats, undefined);
});
await check('SD02-02 caller world Class reaches shared display/action preparation without registry cache', async () => {
    const a = castingActor(); const before = structuredClone(a);
    const worldClass = { ...structuredClone(byUuid.get(WIZARD)), _id: 'worldClass', uuid: 'Item.worldClass' };
    const runtime: any = { documents: { get: async (type: string, id: string) => type === 'Actor' && id === a._id ? structuredClone(a) : type === 'Item' && id === 'worldClass' ? structuredClone(worldClass) : null } };
    const req: any = { runtime, json: async () => ({ baseline: spellReview(a) }) };
    const res = await handleActorView(a._id, req); assert.equal(res.status, 200);
    const view: any = await res.json(); assert.equal(view.derived.actions.find((row: any) => row.kind === 'spell').available, true);
    assert.equal(adapter.lookups().classDocument!({ kind: 'world', documentType: 'Item', id: 'worldClass' }), null);
    assert.deepEqual(a, before);
    assert.equal(view.derived.spellModel.owned[0].itemId, 'spellA'); assert.equal(view.derived.spellModel.owned[0].source, null);
    a.items.push({ ...structuredClone(a.items[0]), _id: 'spellB' });
    const lookups = await adapter.callerLookups(a, { runtime, isGM: false });
    assert.deepEqual(prepareShadowdarkView(a, lookups).spellModel.owned.map(row => row.itemId), ['spellA', 'spellB']);
});
await check('SD02-02 exact embedded Class and denied/retired dependencies', async () => {
    const a = castingActor(); a.items[0].system.class = ['Actor.other.Item.class'];
    const worldClass = { ...structuredClone(byUuid.get(WIZARD)), _id: 'class' };
    const runtime: any = { documents: { get: async (type: string, id: string) => id === 'other' ? { items: [worldClass] } : structuredClone(a) } };
    let lookups = await adapter.callerLookups(a, { runtime, isGM: false });
    assert.equal(prepareShadowdarkView(a, lookups).actions.find(row => row.kind === 'spell')!.available, true);
    runtime.documents.get = async (_type: string, id: string) => id === a._id ? structuredClone(a) : null;
    lookups = await adapter.callerLookups(a, { runtime, isGM: false });
    assert.match(prepareShadowdarkView(a, lookups).actions.find(row => row.kind === 'spell')!.reason!, /unavailable|not visible/);
    let calls = 0;
    runtime.documents.get = async (_type: string, id: string) => { if (id !== a._id) return null; if (++calls > 1) a.system.level.value++; return structuredClone(a); };
    const res = await handleActorView(a._id, { runtime, json: async () => ({ baseline: spellReview(a) }) } as any);
    assert.equal(res.status, 409);
});
await check('SD02-07 zero/null/missing/invalid progression limits stay distinct', () => {
    assert.deepEqual(spellLimit({ 2: null }, 2, 1), { status: 'known', value: 0 });
    assert.deepEqual(spellLimit({ 2: { 1: 0 } }, 2, 1), { status: 'known', value: 0 });
    for (const table of [null, {}, { 2: {} }, { 2: { 1: -1 } }, { 2: { 1: '2' } }]) assert.equal(spellLimit(table, 2, 1).status, 'unavailable');
});
await check('SD02-03 Knight progression keeps Knight counts and Witch list', async () => {
    const before = knight(); const input = structuredClone(before);
    const data = await adapter.getLevelUpData(input, undefined, undefined, caller);
    assert.deepEqual(data.spellsToChoose, { 1: 1 });
    assert.equal(data.classUuid, KNIGHT);
    assert.equal(data.availableSpells.length, 46);
    assert.ok(data.availableSpells.every((spell: any) => spell.system.class.includes(WITCH)));
    assert.deepEqual(input, before);
});
await check('SD02-03 advancement HP roll uses the exact referenced Class and refuses unresolved source',async()=>{
 const actor=castingActor();actor.items.push({_id:'mutableCopy',type:'Class',name:'Unrelated copied Class',system:{hitPoints:'d12'}});let rolls:string[]=[];
 const classDoc={...structuredClone(byUuid.get(WIZARD)),_id:'worldClass'};
 const runtime:any={...caller.runtime,documents:{get:async(type:string,id:string)=>type==='Actor'?structuredClone(actor):id==='worldClass'?structuredClone(classDoc):null},rolls:{roll:async(formula:string)=>{rolls.push(formula);return{total:3}}}};
 let response=await handleRollHP(actor._id,{runtime,json:async()=>({classId:'Item.worldClass'})} as any);assert.equal(response.status,200);assert.deepEqual(rolls,['1d4']);
 rolls=[];runtime.documents.get=async(type:string)=>type==='Actor'?structuredClone(actor):null;
 response=await handleRollHP(actor._id,{runtime,json:async()=>({classId:'Item.worldClass'})} as any);assert.equal(response.status,400);assert.deepEqual(rolls,[]);
});
await check('SD02-07 crafted advancement missing mandatory spell makes zero writes', async () => {
    const actor = knight(); let writes = 0;
    const req: any = { userSession: { userId: 'sanitized', isGM: true }, runtime: { ...caller.runtime, documents: { ...documents, get: async () => structuredClone(actor), patch: async () => { writes++; }, items: { create: async () => { writes++; } } } }, json: async () => ({ classUuid: KNIGHT, targetLevel: 3, selectedSpells: [], hpRoll: 3 }) };
    const res = await handleFinalizeLevelUp(actor._id, req);
    assert.equal(writes, 0, 'missing required spell must block HP/XP and Item writes');
    assert.equal(res.status, 400);
});
await check('SD02-07 crafted too-many/duplicate/wrong-list/wrong-tier/unauthorized extra choices make zero writes', async () => {
    const catalog = (await adapter.getLevelUpData(knight(),undefined,undefined,caller)).availableSpells;
    const tierOne = catalog.filter((spell: any) => spell.system.tier === 1), higher = catalog.find((spell: any) => spell.system.tier > 1);
    for (const selectedSpells of [[tierOne[0],tierOne[1]], [tierOne[0],tierOne[0]], [higher], [rows.find(doc=>doc.type==='Spell' && doc.system?.tier===1 && !(doc.system.class??[]).includes(WITCH))]]) {
        const actor = knight(); let writes = 0;
        const res = await handleFinalizeLevelUp(actor._id,{userSession:{userId:'sanitized'},runtime:{...caller.runtime,documents:{...documents,get:async()=>structuredClone(actor),patch:async()=>{writes++},items:{create:async()=>{writes++}}}},json:async()=>({classUuid:KNIGHT,targetLevel:3,selectedSpells,hpRoll:3})} as any);
        assert.equal(writes,0); assert.ok((res.status??0)>=400);
    }
    const actor = knight(); let writes=0;
    const res=await handleFinalizeLevelUp(actor._id,{userSession:{userId:'sanitized'},runtime:{...caller.runtime,documents:{...documents,get:async()=>structuredClone(actor),patch:async()=>{writes++},items:{create:async()=>{writes++}}}},json:async()=>({classUuid:KNIGHT,targetLevel:3,selectedSpells:[tierOne[0]],extraSpellSelection:{selected:[tierOne[1]],active:true},hpRoll:3})} as any);
    assert.equal(writes,0); assert.equal(res.status,400);
});
function management(failure = '') {
    const actor = castingActor(); const events: string[] = []; let sequence = 0;
    const receipts = new Map<string, any>();
    const classDoc = { ...structuredClone(byUuid.get(WIZARD)), _id: 'worldClass', uuid: 'Item.worldClass' };
    const spell = { _id: 'newSpell', uuid: 'Item.newSpell', name: 'Custom spell', type: 'Spell', system: { class: ['Item.worldClass'], tier: 1, source: { title: '' }, unknownField: { preserved: true } }, effects: [{ _id: 'unknownEffect', name: 'Source effect', disabled: false, transfer: true, changes: [], flags: { keep: true } }] };
    const runtime: any = { world: caller.runtime.world, access: caller.runtime.access,
        dataStore: { get: async (key: string) => receipts.has(key) ? structuredClone(receipts.get(key)) : null, set: async (key: string, value: any) => { receipts.set(key, structuredClone(value)); } },
        documents: { get: async (type: string, id: string) => type === 'Actor' && id === actor._id ? structuredClone(actor)
            : type === 'Item' && id === 'worldClass' ? structuredClone(classDoc) : type === 'Item' && id === 'newSpell' ? structuredClone(spell) : null,
            list: async () => ({ rows: [spell], total: 1 }), items: {
                create: async (_parent: any, data: any) => { events.push('create'); if (failure === 'denied') throw new SdkError('permission_denied', 'Controlled denial');
                    const item = { ...structuredClone(data), _id: `created${++sequence}` }; actor.items.push(item); if (failure === 'lost-receipt') throw new Error('Create response lost'); return structuredClone(item); },
                delete: async (_parent: any, id: string) => { events.push('delete'); if (failure === 'delete') throw new SdkError('permission_denied', 'Controlled deletion denial'); actor.items = actor.items.filter((item: any) => item._id !== id); },
            } } };
    const body = { requestId: `manage-${Math.random().toString(36).slice(2)}`, baseline: spellReview(actor), listUuid: 'Item.worldClass', tier: 1, additions: ['Item.newSpell'], removals: ['spellA'] };
    const run = () => handleManageSpells(actor._id, { runtime, userSession: { userId: 'sanitized' }, json: async () => structuredClone(body) } as any);
    return { actor, events, receipts, body, runtime, run, recover: () => { failure = ''; } };
}
function fixedGrant(failure = '') {
    const test = management(failure);
    const priest = 'Compendium.shadowdark.classes.Item.oZWzXx1WRLg286zD';
    const turn = 'Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH';
    const grant = 'Compendium.shadowdark.talents.Item.LfHTnYW8I65x8Y31';
    const ordinary = rows.filter(doc => doc.type === 'Spell' && doc.system.tier === 1 && doc.system.class.includes(priest) && doc.uuid !== turn).slice(0,2);
    test.actor.system.class = priest; test.actor.system.level.value = 1;
    test.actor.effects[0].changes[0].value = 'priest';
    test.actor.items = [...ordinary.map((doc, i) => ({...ownedCopy(doc,doc.uuid),_id:`ordinary${i}`})), {...ownedCopy(byUuid.get(grant),grant),_id:'grant'}];
    test.body.listUuid = priest; test.body.additions = [turn]; test.body.removals = []; test.body.baseline = spellReview(test.actor);
    const request = (userId = 'sanitized', method = 'POST') => ({ runtime: test.runtime, method, userSession: { userId }, json: async () => ({}) } as any);
    return { ...test, turn, request, sync: (userId?: string) => handleSpellGrants(test.actor._id, request(userId)) };
}
await check('SD-UI16c fixed grants automatically become real known/castable Items at full ordinary quota', async () => {
    const test = fixedGrant();
    assert.equal((await test.run()).status,400, 'manual selection of an automatic grant is refused');
    assert.deepEqual(test.events,[]);
    const res = await test.sync(); assert.equal(res.status,200,JSON.stringify(await res.json()));
    const lookups = await adapter.callerLookups(test.actor,{...caller,runtime:test.runtime});
    const view = prepareShadowdarkView(test.actor,lookups);
    assert.equal(view.spellModel.owned.filter(row => row.innate).length,1);
    assert.ok(view.actions.some(action => action.kind === 'spell' && action.itemId === 'created1'));
    assert.equal(view.spellModel.owned.filter(row => !row.innate).length,2);
    assert.deepEqual(test.events,['create']);
    await Promise.all([test.sync(),test.sync('other-owner')]); assert.deepEqual(test.events,['create']);
});
await check('SD-UI16c actor view advertises owner grant sync but remains read-only', async () => {
    const test = fixedGrant();
    const response = await handleActorView(test.actor._id,test.request('sanitized','GET'));
    assert.equal(response.status,200); const data: any = await response.json();
    assert.deepEqual(data.actor.spellGrants,{missing:true,canApply:true}); assert.deepEqual(test.events,[]);
    await test.sync();
    const after: any = await (await handleActorView(test.actor._id,test.request('sanitized','GET'))).json();
    assert.deepEqual(after.actor.spellGrants,{missing:false,canApply:false});
    assert.ok(after.actor.derived.actions.some((action: any) => action.kind === 'spell' && action.itemId === 'created1'));
});
await check('SD-UI16c concurrent owners, reloads and new grant events never duplicate the fixed Spell', async () => {
    const test = fixedGrant();
    const talent = test.actor.items.pop();
    await test.sync(); assert.deepEqual(test.events,[]);
    test.actor.items.push(talent);
    const results = await Promise.all([test.sync(),test.sync('other-owner'),test.sync()]);
    assert.ok(results.every(result => result.status === 200)); assert.deepEqual(test.events,['create']);
});
await check('SD-UI16c GET and observer access cannot apply grants; source denial writes nothing', async () => {
    const test = fixedGrant();
    assert.equal((await handleSpellGrants(test.actor._id,test.request('sanitized','GET'))).status,405);
    const get = test.runtime.documents.get;
    test.runtime.documents.get = async (kind: string,id: string,options: any) => options?.minOwnership === 'owner' ? null : get(kind,id,options);
    assert.equal((await test.sync()).status,403); assert.deepEqual(test.events,[]);
    test.runtime.documents.get = get;
    test.runtime.access = { canReadPack: () => false };
    assert.equal((await test.sync()).status,403); assert.deepEqual(test.events,[]);
});
await check('SD-UI16c unknown grant responses/receipt failures never replay creates; refusals can retry', async () => {
    const test = fixedGrant('lost-receipt');
    assert.equal((await test.sync()).status,500); await test.sync(); assert.deepEqual(test.events,['create']);
    // Missing source after an ambiguous write still cannot authorize replacement.
    test.actor.items = test.actor.items.filter((item: any) => item._id !== 'created1');
    assert.equal((await test.sync('other-owner')).status,409); assert.deepEqual(test.events,['create']);
    const denied = fixedGrant('denied'); assert.equal((await denied.sync()).status,403);
    denied.recover(); assert.equal((await denied.sync()).status,200); assert.deepEqual(denied.events,['create','create']);
    const receiptFailure = fixedGrant(); const set = receiptFailure.runtime.dataStore.set;
    receiptFailure.runtime.dataStore.set = async (key: string,value: any) => { if (value.status === 'complete') throw new Error('Receipt save unavailable'); return set(key,value); };
    assert.equal((await receiptFailure.sync()).status,500); await receiptFailure.sync(); assert.deepEqual(receiptFailure.events,['create']);
});
await check('SD-UI16c pending advancement from any caller fences automatic writes', async () => {
    const test = fixedGrant(); const get = test.runtime.dataStore.get;
    test.runtime.dataStore.get = async (key: string) => key.startsWith('advancement-active-') ? { key: 'other-owner-operation' } : key === 'other-owner-operation' ? { grants: [], advancement: { status: 'started' } } : get(key);
    assert.equal((await test.sync()).status,409); assert.deepEqual(test.events,[]);
});
await check('SD-UI16 known spells cannot be added again, including talent/boon copies', async () => {
    for (const stamp of ['_stats', 'flags']) {
        const test = management();
        Object.assign(test.actor.items[0], stamp === '_stats' ? { _stats: { compendiumSource: 'Item.newSpell' } } : { flags: { core: { sourceId: 'Item.newSpell' } } });
        test.body.baseline = spellReview(test.actor);
        test.body.removals = [];
        const before = structuredClone(test.actor);
        assert.equal((await test.run()).status, 400);
        assert.deepEqual(test.events, []);
        assert.deepEqual(test.actor, before);
        assert.equal(test.receipts.size, 0);
    }
});
await check('SD02-04/05 no-op save, duplicate copies and explicit exact-ID removal', async () => {
    const test = management(); const before = structuredClone(test.actor);
    test.body.additions = []; test.body.removals = [];
    assert.equal((await test.run()).status, 200); assert.deepEqual(test.events, []); assert.deepEqual(test.actor, before);
    const replacement = management();
    const res: any = await (await replacement.run()).json(); assert.equal(res.state, 'complete'); assert.deepEqual(replacement.events, ['create','delete']);
    assert.equal(replacement.actor.items[0]._stats.compendiumSource, 'Item.newSpell');
    assert.deepEqual(replacement.actor.items[0].system.unknownField, { preserved: true });
    assert.deepEqual(replacement.actor.items[0].effects[0].flags, { keep: true });
    assert.equal((await (await replacement.run()).json() as any).replayed, true); assert.deepEqual(replacement.events, ['create','delete']);
});
await check('SD02-05 failed addition never removes; permission restoration retries same receipt', async () => {
    const test = management('denied');
    const first: any = await (await test.run()).json(); assert.equal(first.state, 'partial'); assert.deepEqual(test.events, ['create']); assert.equal(test.actor.items[0]._id, 'spellA');
    test.recover(); const retry: any = await (await test.run()).json(); assert.equal(retry.state, 'complete'); assert.deepEqual(test.events, ['create','create','delete']);
});
await check('SD02-05 uncertain create and restart-shaped receipts never duplicate or remove', async () => {
    const test = management('lost-receipt');
    const first: any = await (await test.run()).json(); assert.equal(first.operations[0].status, 'uncertain'); assert.deepEqual(test.events, ['create']);
    assert.equal(test.actor.items.length, 2); test.recover();
    await test.run(); assert.deepEqual(test.events, ['create']); assert.equal(test.actor.items.length, 2);
    for (const row of test.receipts.values()) row.operations[0].status = 'started';
    await test.run(); assert.deepEqual(test.events, ['create']);
});
await check('SD02-05 deletion retry does not repeat confirmed addition; actor edits require review', async () => {
    const test = management('delete');
    assert.equal((await (await test.run()).json() as any).state, 'partial'); assert.deepEqual(test.events, ['create','delete']);
    test.recover(); assert.equal((await (await test.run()).json() as any).state, 'complete'); assert.deepEqual(test.events, ['create','delete','delete']);
    const stale = management('delete'); await stale.run(); stale.actor.system.level.xp++;
    assert.equal((await stale.run()).status, 409); assert.deepEqual(stale.events, ['create','delete']);
});
await check('SD02-06 partial catalog, source filters and legitimate empty preserve ownership', async () => {
    const test = management(); const before = structuredClone(test.actor);
    test.runtime.documents.list = async () => { throw new SdkError('permission_denied', 'World Items denied'); };
    let catalog = await adapter.spellCatalog({ runtime: test.runtime, isGM: false }, WIZARD);
    assert.equal(catalog.state, 'partial'); assert.ok(catalog.rows.length); assert.ok(catalog.sources.some(row => row.reason?.includes('denied')));
    test.runtime.world = { snapshot: () => ({ ...worldSnapshot(2), settings: { ...worldSnapshot(2).settings, 'shadowdark.sourceFilters': { status: 'world', value: ['No native source selected'] } } }) };
    test.runtime.documents.list = async () => ({ rows: [], total: 0 });
    catalog = await adapter.spellCatalog({ runtime: test.runtime, isGM: false }, 'Item.noClass');
    assert.equal(catalog.state, 'complete'); assert.deepEqual(catalog.rows, []); assert.deepEqual(test.actor, before);
});
await check('SD02-06 public world Item pagination starts at zero and includes every source once', async () => {
    const test = management(); const seen: number[] = [];
    test.runtime.documents.list = async (_type: string, query: any) => { seen.push(query.page); return {rows: query.page === 0 ? [{_id:'first',type:'Spell',name:'First world spell',system:{class:['Item.worldClass'],tier:1,source:{title:''}}}] : [],total:1}; };
    const catalog = await adapter.spellCatalog({runtime:test.runtime,isGM:false},'Item.worldClass');
    assert.deepEqual(seen,[0]); assert.equal(catalog.state,'complete'); assert.ok(catalog.rows.some(row=>row.uuid==='Item.first'));
});
await check('SD02-01 current writers reject missing fixed grants and preserve distinct same-name sources', async () => {
    const context: any = { addedSourceIds: new Set(), addedNames: new Set(), targetLevel: 1, actor: null };
    await assert.rejects(() => resolveSubItems({ type: 'Class', name: 'Required Class', system: { talents: ['Item.requiredGrant'] } }, async () => null, context), /requiredGrant|unavailable/i);
    await assert.rejects(() => resolveBaggage({ type: 'Class', name: 'Required Class', system: { talents: ['Compendium.shadowdark.talents.Item.missingGrant'] } }, caller), /missingGrant|unavailable/i);
    const one = await enrichItem({ uuid: 'Item.sourceOne', name: 'Same title', type: 'Spell', system: { class: [WIZARD] }, effects: [] }, context);
    const two = await enrichItem({ uuid: 'Item.sourceTwo', name: 'Same title', type: 'Spell', system: { class: [WIZARD] }, effects: [] }, context);
    assert.ok(one && two, 'names must not replace exact source identity');
});
await check('SD02-01 native fixed grants survive creation copies; exact-source historical remediation preserves custom fields', async () => {
    const context: any = { addedSourceIds: new Set(), addedNames: new Set(), targetLevel: 1, actor: null };
    const classDoc = byUuid.get(KNIGHT);
    const grants = await resolveSubItems(classDoc, async uuid => byUuid.get(uuid) ?? null, context);
    assert.ok(grants.some(doc => (doc.effects ?? []).some((effect: any) => (effect.changes ?? []).some((change: any) => change.key === 'system.spellcasting.classes' && change.value === 'witch'))));
    const ancestry = { type: 'Ancestry', name: 'Exact ancestry', system: { talents: [talent.uuid], talentChoiceCount: 0 } };
    assert.equal((await resolveSubItems(ancestry, async uuid => byUuid.get(uuid), { ...context, addedSourceIds: new Set(), addedNames: new Set() })).length, 1);
    const wizardGrant = byUuid.get(WIZARD).system.talents.map((uuid: string) => byUuid.get(uuid)).find((doc: any) => doc.effects?.some((effect: any) => effect.changes?.some((change: any) => change.key === 'system.spellcasting.classes')));
    const missing = castingActor(); missing.effects = []; missing.system.custom = { retain: true };
    const explicit = structuredClone(missing); explicit.items.push({ ...ownedCopy(wizardGrant, wizardGrant.uuid), _id: 'reviewedGrant' });
    assert.equal(prepareShadowdarkView(explicit, { classDocument: () => byUuid.get(WIZARD) }).actions.find(row => row.kind === 'spell')!.available, true);
    explicit.items.pop(); assert.deepEqual(explicit, missing);
    const wrong = knight(); wrong.items[1].effects[0].changes.find((change: any) => change.key === 'system.spellcasting.classes').value = 'knight-of-st.-ydris';
    wrong.items[1].effects[0].flags = { custom: { keep: true } };
    wrong.items[1].effects[0].changes[0].unknownSourceField = 'keep';
    const reviewedKnight = structuredClone(wrong);
    const nativeGrant = talent.effects[0].changes.find((change: any) => change.key === 'system.spellcasting.classes');
    reviewedKnight.items[1].effects[0].changes.find((change: any) => change.key === nativeGrant.key).value = nativeGrant.value;
    const knightLookups = { classDocument: (ref: any) => byUuid.get(ref.kind === 'compendium' ? `Compendium.${ref.pack}.${ref.documentType}.${ref.id}` : '') };
    assert.equal(prepareShadowdarkView(reviewedKnight, knightLookups).spellModel.sources[0].listUuid, WITCH);
    reviewedKnight.items[1].effects[0].changes = structuredClone(wrong.items[1].effects[0].changes); assert.deepEqual(reviewedKnight, wrong);
    const original = castingActor(); original.system.custom = { retain: true }; original.items[0].system.class = [];
    const repaired = structuredClone(original);
    // Explicit GM preview on a disposable copy: only the chosen owned Spell's
    // Class field changes. No source identity is inferred from its display name.
    repaired.items[0].system.class = ['Item.worldClass'];
    const changed = structuredClone(repaired); changed.items[0].system.class = [];
    assert.deepEqual(changed, original);
    assert.equal(prepareShadowdarkView(repaired, { classDocument: () => byUuid.get(WIZARD) }).actions.find(row => row.kind === 'spell')!.available, true);
});
await check('SD02-02 copied Class provenance cannot satisfy a denied exact reference', async () => {
    const actor = castingActor(); actor.items.push({ ...ownedCopy(byUuid.get(WIZARD), 'Item.worldClass'), _id: 'copy' });
    const model = prepareShadowdarkView(actor);
    assert.equal(model.actions.find(row => row.kind === 'spell')!.available, false);
    assert.equal(model.spellModel.sources.length, 0);
    assert.equal(model.identity.class.label,null,'An unrelated/copied Class title cannot label an unresolved exact reference.');
    assert.equal(model.spellModel.owned[0].classification, 'unresolved');
    const exact = prepareShadowdarkView(actor, { classDocument: () => byUuid.get(WIZARD) });
    assert.equal(exact.actions.find(row => row.kind === 'spell')!.available, true);
    assert.equal(exact.spellModel.sources[0].limits[1].status, 'known');
});
console.log(JSON.stringify({ method: 'Controlled native pack sources and actual module routes; not native acceptance', checks }, null, 2));
if (checks.some(row => !row.passed) && !process.argv.includes('--baseline')) process.exitCode = 1;
