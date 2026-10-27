import { handleLightChat } from '../server/api/light-chat';
import { recordSpellLoss } from '../server/spell-loss';
import { handleRest } from '../server/api/rest';
import { restPlan, DAILY_ABILITIES, REST_ABILITIES } from '../logic/rest';
import { planConsequences } from '../logic/actions';
import { requestRules } from '../server/access';
import { manualSpellLoss } from '../logic/spell-loss';
/** ADR-0002 operation/receipt regressions. Real module handlers, isolated source state. */
import assert from 'node:assert/strict';
import { handleActorAction } from '../server/api/actions';
import { shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { evaluateOutcome, prepareRequestedAction } from '../logic/actions';
import { prepareActorCore } from '../logic/actor-preparation';
import { primLike, worldSnapshot } from './fixtures/native-406';
import { SdkError } from '@sheet-delver/sdk';
import path from 'node:path';
import { nativePacks } from './core0191/world';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { ownedCopy } from '../logic/identity';
import { buildOwnedItemCard } from '../logic/resource-cards';
import { spellMishap } from '../logic/spell-mishaps';
import { SPELL_CLASSES } from '../logic/spell-grants';
import { itemControls } from '../logic/inventory-controls';
import { isWand, wandSpells, wandBroken, wandRestUpdates } from '../logic/wands';
import { buildDocumentCard } from '../logic/resource-cards';
import { parseUuid } from '../logic/identity';
const checks: any[] = [];
const packs = nativePacks(process.env.SHADOWDARK_NATIVE ?? path.resolve('temp/shadowdark'), ['shadowdark.magic-items', 'shadowdark.spells', 'shadowdark.classes', 'shadowdark.rollable-tables']);
const docs = new Map<string, any>(Object.entries(packs).flatMap(([pack, items]) => items.map(item => {
    const uuid = `Compendium.${pack}.${pack === 'shadowdark.rollable-tables' ? 'RollTable' : 'Item'}.${item._id}`; return [uuid, { ...item, uuid }] as const;
})));
const legacyScrolls = ['N27A6nb0epkHZ3lR', 'mXkpNk8z0eZU8kKj'].map(id => ({ ...ownedCopy(docs.get(`Compendium.shadowdark.magic-items.Item.${id}`)), _id: id }));
const legacyWands = ['yyUwr6H9imWcJ9YS', 'gqSggLFDj78yoPW2', 'P921JRq5leqOWpwv'].map(id => ({ ...ownedCopy(docs.get(`Compendium.shadowdark.magic-items.Item.${id}`)), _id: id }));
function scrollFixture(item: any) {
    const t = fixture([item]); t.body.kind = 'spell';
    t.actor.effects = [{ _id: 'casting', name: 'Spell Class', changes: [{ key: 'system.spellcasting.classes', mode: 2, value: 'wizard' }] }];
    t.runtime.compendium = { getById: async (_kind: string, uuid: string) => structuredClone(docs.get(uuid) ?? null) };
    return t;
}
async function check(id: string, run: () => unknown | Promise<unknown>) { try { await run(); checks.push({ id, passed: true }); } catch(e) { checks.push({ id, passed: false, error: (e as Error).message }); } }
let next = 0;
const ability = (uses = 1, noCheck = false) => ({ _id: 'ability', name: 'Native-shaped ability', type: 'Class Ability', system: { ability: noCheck ? '' : 'wis', dc: 10, limitedUses: true, uses: { available: uses, max: uses }, loseOnFailure: true, lost: false }, effects: [] });
const potion = () => ({ _id: 'potion', name: 'Cloudy vial', type: 'Potion', system: { description: 'Cloudy liquid', quantity: 5, identification: { identified: false, name: 'Healing Potion', description: 'Known healing effect', unknown: { keep: true } }, unknown: 7 }, effects: [{ _id: 'same', name: 'First', disabled: true, flags: { keep: 1 } }, { _id: 'second', name: 'Second', disabled: true }] });
function fixture(items: any[] = [ability()], kind = 'Player') {
    const actor: any = { ...primLike(), _id: `phases${++next}`, type: kind, items: structuredClone(items), effects: [] };
    const events: string[] = []; const receipts = new Map<string, any>(); let fail = '', failed = false, revision = 1;
    const dice: number[] = []; const rollCalls: any[] = [];
    const patch = (target: any, data: any) => { for(const [path,value] of Object.entries(data)) { const keys=path.split('.');const leaf=keys.pop()!;let owner=target;for(const key of keys)owner=owner[key]??={};owner[leaf]=structuredClone(value); } };
    const runtime: any = { world: { snapshot: () => worldSnapshot(revision), assertRevision: (value: number) => { if (value !== revision) throw Error('Context retired'); } },
        access: { canReadPack: () => true }, dataStore: { get: async (key: string) => receipts.has(key) ? structuredClone(receipts.get(key)) : null, set: async (key: string,value: any) => { receipts.set(key,structuredClone(value)); } },
        documents: { get: async (type: string,id: string) => type === 'Actor' && id === actor._id ? structuredClone(actor) : null,
            items: { update: async (_parent: any,id: string,data: any) => { events.push(`item:${id}`); if (fail==='spend-denied') throw new SdkError('permission_denied','Controlled spend denial'); if(fail==='fields')throw Error('Field write failed'); patch(actor.items.find((item:any)=>item._id===id),data);if(fail==='spend-lost')throw Error('Spend receipt lost'); },
                delete: async (_parent: any,id: string) => {events.push(`delete:${id}`);if(fail==='delete'&&!failed){failed=true;throw Error('Delete failed');}actor.items=actor.items.filter((item:any)=>item._id!==id);} },
            effects: { update: async (parent: any,id: string,data: any) => {events.push(`effect:${parent.id}:${id}`);if(fail==='effect'&&id==='same')throw new SdkError('permission_denied','First effect denied');patch(actor.items.find((item:any)=>item._id===parent.id).effects.find((effect:any)=>effect._id===id),data);} } },
        rolls: { roll: async (formula: string, label: string, options: any) => { events.push('roll'); rollCalls.push({formula,label,options}); if(fail==='roll'||(fail==='mishap'&&rollCalls.length===2))throw Error('Result receipt unavailable');const result=dice.shift()??5;return { formula,total:result,terms:[{faces:formula.includes('d12')?12:20,results:[{result,active:true}]}] }; } },
        chat: { send: async () => { events.push('chat');if(fail==='chat')throw Error('Chat receipt unavailable');return {}; } } };
    const body: any = { requestId:`action-phases-${next}`, kind:items[0]?.type==='Potion'?'potion':'ability', itemId:items[0]?._id };
    const send = async (extra: any = {}) => {const res=await handleActorAction(actor._id,{runtime,userSession:{userId:'controlled'},json:async()=>({...body,...extra})} as any);return {status:res.status,body:await res.json() as any};};
    return { actor, runtime, body, events, receipts, dice, rollCalls, send, fail: (value: string) => { fail=value; }, retire: () => {revision++;} };
}
await check('SD-UI22 all legacy native wands, including old Gear Add copies, expose spells instead of weapon attacks', async () => {
    for (const native of legacyWands) for (const sourced of [true,false]) {
        const {name,type,img,system}=native;
        const item=sourced?native:{_id:native._id,name,type,img,system:structuredClone(system)};
        const t=scrollFixture(item), before=structuredClone(t.actor);
        const lookups=await shadowdarkAdapter.callerLookups(t.actor,{runtime:t.runtime,isGM:false});
        const view=prepareShadowdarkView(t.actor,lookups), card=buildOwnedItemCard(view,t.actor.items[0],lookups)!;
        assert.equal(card.subtitle,'Wand');
        assert.equal(view.actions.filter(a=>a.kind==='spell').length,native._id==='yyUwr6H9imWcJ9YS'?1:2);
        assert.equal(view.actions.some(a=>a.kind==='attack'),false);
        assert.equal(card.facts.some(f=>/damage|attack/i.test(f.label)),false);
        assert.equal(card.diagnostics.some(text=>/damage unavailable/i.test(text)),false);
        assert.equal(itemControls(view.items,t.actor.items,item._id).some(c=>c.id==='equip'),false);
        const preview=buildDocumentCard(item,parseUuid(`Compendium.shadowdark.magic-items.Item.${native._id}`),lookups);
        assert.equal(preview.subtitle,'Wand');assert.equal(preview.facts.some(f=>/damage/i.test(f.label)),false);
        assert.deepEqual(t.actor,before);
        t.actor.effects=[];
        const noncaster=prepareShadowdarkView(t.actor,lookups);
        assert.equal(noncaster.showSpellsTab,true);assert.ok(noncaster.actions.filter(a=>a.kind==='spell').every(a=>!a.available));
    }
});
await check('SD-UI22 legacy wand outcomes persist safe flags, restore after rest, and retain source schemas', async () => {
    for(const native of legacyWands) for(const die of [20,5,1]) {
        const t=scrollFixture(native),original=structuredClone(t.actor.items[0]);t.dice.push(die,2);
        const priest=native._id==='yyUwr6H9imWcJ9YS';
        if(priest)t.actor.effects[0].changes[0].value='priest';
        const result=await t.send();assert.equal(result.body.state,'complete',JSON.stringify(result));
        assert.equal(t.actor.items[0].type,original.type);assert.deepEqual(t.actor.items[0].system,original.system);
        assert.equal(t.actor.items.length,1);assert.equal(wandBroken(t.actor.items[0]),die===1);
        assert.equal(wandSpells(t.actor.items[0])[0].lost,die!==20);
        if(die===1) {assert.equal(result.body.mishap?.status,priest?undefined:'complete');assert.equal(wandRestUpdates(t.actor.items[0]),null);}
        if(die===5) {
            const lookups=await shadowdarkAdapter.callerLookups(t.actor,{runtime:t.runtime,isGM:false});
            const view=prepareShadowdarkView(t.actor,lookups);
            const restore=itemControls(view.items,t.actor.items,native._id).find(c=>c.id==='restore-wand')!;
            assert.ok(restore);await t.runtime.documents.items.update({type:'Actor',id:t.actor._id},native._id,restore.writes[0].patch);
            assert.ok(wandSpells(t.actor.items[0]).every(row=>!row.lost));assert.equal(wandBroken(t.actor.items[0]),false);
        }
    }
});
await check('SD-UI22 partial signatures and conflicting origins remain weapons; unreadable spells never cast', async () => {
    const {_stats,...oldCopy}=structuredClone(legacyWands[0]);
    for(const edit of [{img:'custom.webp'},{name:'Other wand'},{system:{...oldCopy.system,description:'A wand'}},
        {_stats:{compendiumSource:'Compendium.shadowdark.magic-items.Item.other'}}]) assert.equal(isWand({...oldCopy,...edit}),false);
    const t=scrollFixture(legacyWands[0]);t.runtime.access.canReadPack=()=>false;
    assert.equal((await t.send()).status,409);assert.deepEqual(t.events,[]);
    const lookups=await shadowdarkAdapter.callerLookups(t.actor,{runtime:t.runtime,isGM:false});
    assert.equal(prepareRequestedAction(prepareActorCore(t.actor),t.actor,lookups,{kind:'attack',itemId:legacyWands[0]._id}),null);
});
await check('SD-UI21 scroll critical failure rolls the exact tier mishap once and keeps spent inventory', async () => {
    for (const tier of [1, 2, 3, 4, 5]) {
        const t = scrollFixture(legacyScrolls[0]); t.dice.push(1, 2);
        t.runtime.compendium.getById = async (_kind: string, uuid: string) => {
            const doc = structuredClone(docs.get(uuid) ?? null); if (doc?.type === 'Spell') doc.system.tier = tier; return doc;
        };
        const result = await t.send({rollMode:'gmroll'});
        assert.equal(result.body.state,'complete'); assert.equal(result.body.mishap.status,'complete');
        assert.equal(result.body.mishap.total,2); assert.match(result.body.mishap.description, /\S/);
        const tableId = tier < 3 ? 'NiiJKAiBjpPAj5U1' : tier < 5 ? 'tXhX6Iv3rOc6GlF6' : 'q83PUKIAznuLpqSr';
        assert.equal(result.body.mishap.rule.table.id,tableId);
        assert.deepEqual(t.events,[`item:${legacyScrolls[0]._id}`,'roll','roll','chat']);
        assert.equal(t.rollCalls[1].formula,docs.get(`Compendium.shadowdark.rollable-tables.RollTable.${tableId}`)!.formula);
        assert.equal(t.rollCalls[1].options.rollMode,'gmroll'); assert.equal(t.rollCalls[1].options.speaker.actor,t.actor._id);
        const before=[...t.events]; assert.equal((await t.send({rollMode:'gmroll'})).body.replayed,true); assert.deepEqual(t.events,before);
        assert.equal(t.actor.items[0].flags.shadowdark.sheetDelver.scrollSpent,true);
    }
});
await check('SD-UI21 wand failure rests, critical failure breaks and rolls; rest never repairs a broken wand', async () => {
    const wand = {_id:'wand',name:'Test wand',type:'Wand',system:{broken:false,spells:[{uuid:'Compendium.shadowdark.spells.Item.ItN82uLU3PhJFLNm',lost:false}]}};
    for (const natural of [5,1]) {
        const t=scrollFixture(wand); t.dice.push(natural,2);
        const result=await t.send(); assert.equal(result.body.state,'complete');
        assert.equal(t.actor.items[0].system.spells[0].lost,true); assert.equal(t.actor.items[0].system.broken,natural===1);
        assert.deepEqual(t.events,natural===1?['roll','item:wand','roll','chat']:['roll','item:wand']);
        assert.equal((await t.send({requestId:'wand-unavailable'})).status,409);
        // Native full-rest refresh clears lost flags, but does not repair broken.
        t.actor.items[0].system.spells[0].lost=false;
        const lookups=await shadowdarkAdapter.callerLookups(t.actor,{runtime:t.runtime,isGM:false});
        const action=prepareShadowdarkView(t.actor,lookups).actions.find(a=>a.kind==='spell')!;
        assert.equal(action.available,natural!==1); if(natural===1)assert.match(action.reason!,/broken/);
    }
});
await check('SD-UI21 missing and uncertain mishaps preserve the confirmed cast and cannot reroll on replay', async () => {
    for (const mode of ['missing','mishap','chat']) {
        const t=scrollFixture(legacyScrolls[0]);t.dice.push(1,2);
        if(mode==='missing')t.runtime.compendium.getById=async(kind:string,uuid:string)=>kind==='RollTable'?null:structuredClone(docs.get(uuid)??null);
        else t.fail(mode);
        const result=await t.send();assert.equal(result.body.outcome.criticalFailure,true);assert.ok(result.body.warnings.length);
        assert.equal(result.body.mishap.status,mode==='missing'?'unavailable':mode==='mishap'?'uncertain':'complete');
        assert.equal(t.actor.items[0].flags.shadowdark.sheetDelver.scrollSpent,true);
        const before=[...t.events];await t.send();assert.deepEqual(t.events,before);
    }
});
await check('SD-UI21 a refused wand consequence retries its write before one mishap, never the casting roll', async () => {
    const t=scrollFixture({_id:'wand',name:'Wand',type:'Wand',system:{broken:false,spells:[{uuid:'Compendium.shadowdark.spells.Item.ItN82uLU3PhJFLNm',lost:false}]}});
    t.dice.push(1,2);t.fail('fields');
    assert.equal((await t.send()).body.state,'partial');assert.deepEqual(t.events,['roll','item:wand']);
    t.fail('');const resumed=await t.send();assert.equal(resumed.body.mishap.status,'complete');
    assert.deepEqual(t.events,['roll','item:wand','item:wand','roll','chat']);
    const before=[...t.events];await t.send();assert.deepEqual(t.events,before);
});
await check('SD-UI21 owned spells share the mishap flow but manual totals do not imply a natural one', async () => {
    const spell={...ownedCopy(docs.get('Compendium.shadowdark.spells.Item.ItN82uLU3PhJFLNm')),_id:'known'};
    for (const manual of [false,true]) {
        const t=scrollFixture(spell);t.dice.push(1,2);
        const response=await t.send(manual?{overrides:{manualValue:1}}:{});
        assert.equal(t.actor.items[0].system.lost,true);
        assert.equal(response.body.mishap?.status,manual?undefined:'complete');
        assert.equal(t.rollCalls.length,manual?0:2);
    }
});
await check('SD-UI21 spell traditions never substitute a Wizard table for Witch, Priest or unknown classes', () => {
    assert.equal(spellMishap(SPELL_CLASSES.priest,1,false,[]),undefined);
    assert.equal(spellMishap(SPELL_CLASSES.seer,1,false,[]),undefined);
    assert.deepEqual(spellMishap(SPELL_CLASSES.witch,1,false,[]),{label:'Diabolical mishap',table:null});
    assert.equal(spellMishap('Item.custom',1,false,[]),undefined);
    const dabbler={type:'Talent',_stats:{compendiumSource:'Compendium.shadowdark.talents.Item.Om7QWre7U4Tbh84B'}};
    assert.equal(spellMishap(null,1,true,[dabbler])?.table?.id,'NiiJKAiBjpPAj5U1');
});
await check('SD-UI20 both native Basic scrolls expose exact linked actions and retain their source type', async () => {
    for (const item of legacyScrolls) {
        const t = scrollFixture(item), before = structuredClone(t.actor);
        const lookups = await shadowdarkAdapter.callerLookups(t.actor, { runtime: t.runtime, isGM: false });
        const view = prepareShadowdarkView(t.actor, lookups);
        const action = view.actions.find(action => action.kind === 'spell' && action.itemId === item._id)!;
        assert.ok(action?.available, action?.reason ?? 'Missing scroll action');
        assert.equal(action.spell?.name, item._id === 'N27A6nb0epkHZ3lR' ? 'Burning Hands' : 'Hold Portal');
        assert.deepEqual(t.actor, before); assert.equal(t.actor.items[0].type, 'Basic');
        // Historical Gear Add copied only these fields, dropping all provenance.
        const { name, type, img, system } = item;
        const oldCopy = { _id: 'old-copy', name, type, img, system: structuredClone(system) };
        const historical = scrollFixture(oldCopy);
        assert.ok(prepareShadowdarkView(historical.actor, lookups).actions.some(action => action.kind === 'spell' && action.available));
        assert.equal((await historical.send()).body.state, 'complete');
        assert.equal(historical.actor.items[0].flags.shadowdark.sheetDelver.scrollSpent, true);
        for (const edit of [{ name: 'Ring of Burning Hands' }, { img: 'custom.webp' }, { system: { ...system, description: '<p>A scroll.</p>' } },
            { _stats: { compendiumSource: 'Compendium.shadowdark.magic-items.Item.unrelated' } }]) {
            const custom = structuredClone(t.actor); custom.items = [{ ...oldCopy, ...edit }];
            assert.equal(prepareShadowdarkView(custom, lookups).actions.some(action => action.kind === 'spell'), false, 'Partial matches do not establish a legacy scroll');
        }
        t.runtime.access.canReadPack = () => false;
        const denied = await shadowdarkAdapter.callerLookups(t.actor, { runtime: t.runtime, isGM: false });
        const unavailable = prepareShadowdarkView(t.actor, denied).actions.find(action => action.kind === 'spell')!;
        assert.equal(unavailable.available, false); assert.equal((await t.send()).status, 409); assert.deepEqual(t.events, []);
    }
});
await check('SD-UI20 success and failure spend legacy and native scrolls without deletion or repeated casts', async () => {
    const modern = { ...structuredClone(legacyScrolls[0]), type: 'Scroll', system: { spellUuid: 'Compendium.shadowdark.spells.Item.ItN82uLU3PhJFLNm' } };
    for (const item of [...legacyScrolls, modern]) for (const manualValue of [1, 20]) {
        const t = scrollFixture(item); const original = structuredClone(t.actor.items[0]);
        const request = { overrides: { manualValue } }; const first = await t.send(request);
        assert.equal(first.body.state, 'complete', JSON.stringify(first));
        assert.deepEqual(t.events, [`item:${item._id}`, 'chat']);
        assert.equal(t.actor.items.length, 1); assert.equal(t.actor.items[0].flags.shadowdark.sheetDelver.scrollSpent, true);
        assert.deepEqual(t.actor.items[0].system, original.system);
        assert.equal((await t.send(request)).body.replayed, true);
        assert.equal((await t.send({ ...request, requestId: 'new-spent-request' })).status, 409);
        const lookups = await shadowdarkAdapter.callerLookups(t.actor, { runtime: t.runtime, isGM: false });
        const view = prepareShadowdarkView(t.actor, lookups), action = view.actions.find(action => action.kind === 'spell')!;
        assert.equal(action.available, false); assert.match(action.reason!, /spent/i);
        assert.ok(buildOwnedItemCard(view, t.actor.items[0], lookups)?.states.includes('Spent'));
        assert.deepEqual(t.events, [`item:${item._id}`, 'chat']);
    }
});
await check('SD-UI20 concurrent requests and uncertain results cannot reuse a scroll', async () => {
    const t = scrollFixture(legacyScrolls[0]);
    const results = await Promise.all([t.send(), t.send({ requestId: 'other-scroll-request' })]);
    assert.deepEqual(results.map(row => row.status).sort(), [200, 409]); assert.equal(t.events.filter(event => event === 'roll').length, 1);
    for (const failure of ['roll', 'spend-lost', 'spend-denied']) {
        const trial = scrollFixture(legacyScrolls[0]); trial.fail(failure); const first = await trial.send();
        assert.equal(first.body.state, 'partial'); assert.equal(trial.events.some(event => event.startsWith('delete:')), false);
        const before = [...trial.events]; trial.fail('');
        if (failure === 'spend-denied') { assert.equal((await trial.send()).body.state, 'complete'); }
        else {
            await trial.send(); assert.deepEqual(trial.events, before);
            assert.equal((await trial.send({ requestId: 'uncertain-scroll-reuse' })).status, 409);
        }
    }
});
await check('SD02-09 spend → roll → loss; replay does not repeat', async()=>{
    const t=fixture();const first=await t.send();assert.equal(first.body.state,'complete');assert.deepEqual(t.events,['item:ability','roll','item:ability']);assert.equal(t.actor.items[0].system.uses.available,0);
    assert.equal((await t.send()).body.replayed,true);assert.deepEqual(t.events,['item:ability','roll','item:ability']);
});
await check('SD02-09 denied spend blocks result and restored permission retries exactly once',async()=>{
    const t=fixture();t.fail('spend-denied');const first=await t.send();assert.equal(first.body.phase,'prerequisites');assert.deepEqual(t.events,['item:ability']);assert.equal(t.actor.items[0].system.uses.available,1);
    t.fail('');const second=await t.send();assert.equal(second.body.state,'complete');assert.deepEqual(t.events,['item:ability','item:ability','roll','item:ability']);
});
await check('SD02-09 uncertain spend and failed result never spend/roll again',async()=>{
    for(const fault of ['spend-lost','roll']){const t=fixture([ability(2)]);t.fail(fault);const first=await t.send();assert.equal(first.body.state,'partial');assert.equal(first.body.retryable,false);assert.equal(t.actor.items[0].system.uses.available,1);const before=[...t.events];t.fail('');await t.send();assert.deepEqual(t.events,before);}
});
await check('SD02-09 no-check ability spends before chat; chat failure survives without another post',async()=>{
    const t=fixture([ability(1,true)]);t.fail('chat');assert.equal((await t.send()).body.phase,'result-uncertain');assert.deepEqual(t.events,['item:ability','chat']);assert.equal(t.actor.items[0].system.uses.available,0);t.fail('');await t.send();assert.deepEqual(t.events,['item:ability','chat']);
});
await check('SD02-09 two distinct last-use requests serialize and only one rolls',async()=>{
    const t=fixture();const result=await Promise.all([t.send(),t.send({requestId:'distinct-request-last-use'})]);assert.deepEqual(result.map(row=>row.status).sort(),[200,409]);assert.equal(t.events.filter(event=>event==='roll').length,1);assert.equal(t.actor.items[0].system.uses.available,0);
});
await check('SD02-10 identify all fields → enable exact owned effects → chat → consume, quantity is irrelevant',async()=>{
    const t=fixture([potion(),{_id:'other',type:'Basic',system:{},effects:[{_id:'same',disabled:true}]}]);const result=await t.send();assert.equal(result.body.state,'complete');assert.deepEqual(t.events,['item:potion','effect:potion:same','effect:potion:second','chat','delete:potion']);assert.equal(t.actor.items.length,1);assert.equal(t.actor.items[0].effects[0].disabled,true);
});
await check('SD02-10 every effect activation is attempted; a denied effect prevents chat/delete',async()=>{
    const t=fixture([potion()]);t.fail('effect');const first=await t.send();assert.equal(first.body.phase,'prerequisites');assert.equal(t.actor.items[0].name,'Healing Potion');assert.equal(t.actor.items[0].effects[0].disabled,true);assert.equal(t.actor.items[0].effects[1].disabled,false);assert.deepEqual(t.events,['item:potion','effect:potion:same','effect:potion:second']);
    t.fail('');await t.send();assert.deepEqual(t.events,['item:potion','effect:potion:same','effect:potion:second','effect:potion:same','chat','delete:potion']);
});
await check('SD02-10 deletion retry retains identified state/unknown data and never swaps/posts again',async()=>{
    const t=fixture([potion()]);t.fail('delete');const result=await t.send();assert.equal(result.body.state,'partial');const item=t.actor.items[0];assert.equal(item.name,'Healing Potion');assert.equal(item.system.description,'Known healing effect');assert.deepEqual(item.system.identification,{identified:true,name:'Cloudy vial',description:'Cloudy liquid',unknown:{keep:true}});assert.equal(item.system.quantity,5);assert.equal(item.system.unknown,7);assert.equal(item.effects[0].flags.keep,1);
    await t.send();assert.equal(t.events.filter(event=>event==='chat').length,1);assert.equal(t.events.filter(event=>event==='item:potion').length,1);assert.equal(t.actor.items.length,0);
});
await check('SD02-10 field/chat failure and native empty-name fallback preserve surviving source',async()=>{
    const field=fixture([potion()]);field.fail('fields');await field.send();assert.equal(field.actor.items[0].name,'Cloudy vial');assert.deepEqual(field.events,['item:potion']);
    const raw=potion();raw.system.identification.name='';const chat=fixture([raw]);chat.fail('chat');await chat.send();assert.equal(chat.actor.items[0].name,'Unidentified Potion');assert.equal(chat.actor.items[0].system.identification.name,'Cloudy vial');assert.ok(chat.actor.items[0].effects.every((effect:any)=>effect.disabled===false));assert.equal(chat.events.some(event=>event.startsWith('delete:')),false);
});
await check('SD02-09/10 durable completed and partial receipts survive a new adapter epoch without writes',async()=>{
    for(const fault of ['', 'roll']){const t=fixture();t.fail(fault);await t.send();const before=[...t.events];shadowdarkAdapter.runtimeGeneration++;const replay=await t.send();assert.equal(replay.body.replayed,true);assert.deepEqual(t.events,before);if(fault)assert.equal(replay.body.phase,'review-required');}
});
await check('SD02-11 NPC focus is not a Player exemption',async()=>{
    const spell={_id:'spell',name:'NPC spell',type:'Spell',system:{tier:1,lost:false,class:[]},effects:[]};const t=fixture([spell],'NPC');t.actor.system.spellcasting={ability:'int',bonus:2,attacks:1};t.body.kind='spell';const result=await t.send({focus:true});assert.equal(result.body.state,'complete');assert.equal(t.actor.items[0].system.lost,true);assert.equal(t.events.filter(event=>event==='roll').length,1);
});
await check('SD02-13 zero/custom/default thresholds and unknown natural are distinct',()=>{
    for(const [success,failure,natural,expected] of [[0,0,20,[false,false]],[19,2,19,[true,false]],[19,2,2,[false,true]],[undefined,undefined,20,[true,false]],[20,1,null,[false,false]]] as any[]){const out=evaluateOutcome({dc:10,critical:{success,failure}} as any,15,natural);assert.deepEqual([out.criticalSuccess,out.criticalFailure],expected);}
    for(const v14 of [false,true]){const a:any=primLike();const changes=[{key:'system.roll.attack.critical-success.all',value:'0',...(v14?{type:'override',phase:'initial'}:{mode:5})},{key:'system.roll.attack.critical-failure.all',value:'0',...(v14?{type:'override',phase:'initial'}:{mode:5})}];a.effects=[{_id:'crit',...(v14?{system:{changes}}:{changes})}];const core=prepareActorCore(a);const action=prepareRequestedAction(core,a,{}, {kind:'attack',itemId:'primLongsword'})!;assert.equal(action.critical.success,0);assert.equal(action.critical.failure,0);assert.equal(evaluateOutcome(action,20,20).criticalSuccess,false);}
});
await check('SD02-08 concealed/absent Actors return404 without exposing an action receipt; observer SDK denial remains403',async()=>{
 const t=fixture(); await t.send(); const before=[...t.events];
 t.runtime.documents.get=async(_type:string,_id:string,opts:any)=>opts?.minOwnership==='owner'?null:structuredClone(t.actor); assert.equal((await t.send()).status,403); assert.deepEqual(t.events,before);
 t.runtime.documents.get=async()=>null; assert.equal((await t.send()).status,404); assert.deepEqual(t.events,before);
 t.runtime.documents.get=async()=>{throw new SdkError('permission_denied','Observer lacks owner access')}; assert.equal((await t.send()).status,403); assert.deepEqual(t.events,before);
});

const restPacks=nativePacks(process.env.SHADOWDARK_NATIVE ?? path.resolve('temp/shadowdark'),['shadowdark.class-abilities','shadowdark.gear','shadowdark.talents']);
const nativeRation=restPacks['shadowdark.gear'].find((i:any)=>i._id==='GX6OmWQiE7MzTmjX')!;
const rationItem=()=>({...ownedCopy(nativeRation,'Compendium.shadowdark.gear.Item.GX6OmWQiE7MzTmjX'),_id:'food'});
const restFixture=(items:any[]=[])=>{
    const t=fixture(items);t.actor.system.attributes.hp={value:1,max:9};
    t.runtime.documents.patch=async(_type:string,_id:string,patch:any)=>{
        t.events.push('actor');for(const [path,value]of Object.entries(patch)){const keys=path.split('.');const leaf=keys.pop()!;let target=t.actor;for(const k of keys)target=target[k]??={};target[leaf]=value;}
    };
    const send=async(mode:'plan'|'complete'|'status',body:any={})=>{
        const response=await handleRest(t.actor._id,{method:'POST',runtime:t.runtime,userSession:{userId:'controlled'},json:async()=>body} as any,mode);
        return {status:response.status,body:await response.json() as any};
    };
    return {...t,rest:send};
};
const choice={consumeRation:true,rationId:'food',confirmedSpells:[]};
await check('REST daily/native coverage and exact-source counters',()=>{
    const abilities=restPacks['shadowdark.class-abilities'].filter((i:any)=>i.type==='Class Ability');
    assert.equal(abilities.length,22);assert.equal(DAILY_ABILITIES.size,15);assert.equal(REST_ABILITIES.size,7);
    for(const native of abilities){
        const uuid=`Compendium.shadowdark.class-abilities.Item.${native._id}`;
        assert.equal(DAILY_ABILITIES.has(uuid),native.system.limitedUses);assert.equal(REST_ABILITIES.has(uuid),native.system.loseOnFailure);
        if(native.system.limitedUses)assert.match(native.system.description,/day/i);
        const item={...ownedCopy(native,uuid),_id:'ability'};if(item.system.limitedUses){item.system.uses={available:0,max:7};}else item.system.lost=true;
        const t=restFixture([item]),plan=restPlan(t.actor,{consumeRation:false,confirmedSpells:[]},{},requestRules(t.runtime));
        const w=plan.writes.find(w=>w.itemId==='ability')!;assert.ok(w);
        assert.equal(item.system.limitedUses?w.patch['system.uses.available']:w.patch['system.lost'],item.system.limitedUses?7:false);
    }
});
await check('REST mixed success consumes one ration, restores supported resources and preserves exclusions',async()=>{
    const spell=(id:string,reason?:string)=>({_id:id,type:'Spell',name:id,system:{lost:true},flags:{shadowdark:{sheetDelver:{spellLoss:reason?{reason}:null}}}});
    const daily={...ownedCopy(restPacks['shadowdark.class-abilities'].find((i:any)=>i._id==='pRO1kFMnFkkcYOgC'),'Compendium.shadowdark.class-abilities.Item.pRO1kFMnFkkcYOgC'),_id:'omen'};daily.system.uses={available:0,max:4};
    const t=restFixture([rationItem(),spell('ordinary','rest'),spell('penance','penance'),spell('unknown'),daily,
        {_id:'wand',name:'Broken wand',type:'Wand',system:{broken:true,spells:[{lost:true}]}},
        {...legacyScrolls[0],_id:'spent',flags:{shadowdark:{sheetDelver:{scrollSpent:true}}}}]);
    t.actor.items[1]._stats={modifiedTime:1};t.actor.items[2]._stats={modifiedTime:1};
    for(const item of t.actor.items.slice(1,3))await recordSpellLoss({runtime:t.runtime} as any,t.actor._id,item._id,{'flags.shadowdark.sheetDelver.spellLoss':item.flags.shadowdark.sheetDelver.spellLoss});
    const plan=await t.rest('plan',choice);assert.equal(plan.status,200);assert.deepEqual(plan.body.reset.map((r:any)=>r.id),['hp','ordinary','omen']);
    for(const id of ['penance','unknown','wand','spent'])assert.ok(plan.body.excluded.some((r:any)=>r.id===id));
    const body={...choice,review:plan.body.review,requestId:'rest-mixed-success'};
    assert.equal((await t.rest('complete',body)).body.state,'complete');
    assert.equal(t.actor.system.attributes.hp.value,9);assert.equal(t.actor.items[0].system.quantity,2);
    assert.equal(t.actor.items[1].system.lost,false);assert.equal(t.actor.items[2].system.lost,true);assert.equal(t.actor.items[4].system.uses.available,4);
    const before=[...t.events];await t.rest('complete',body);assert.deepEqual(t.events,before);assert.equal(t.events[0],'item:food');
});
await check('REST no personal food, explicit external food, stale preview and authorization',async()=>{
    // Exact initial modal request: discover stacks before a ration ID exists.
    for(const food of [[],[rationItem()]]){
        const initial=restFixture(food),choices={consumeRation:true,confirmedSpells:[]};
        const preview=await initial.rest('plan',choices);assert.equal(preview.status,200);
        assert.equal(preview.body.rations.length,food.length);assert.ok(preview.body.errors.length);
        const completion=await initial.rest('complete',{...choices,review:preview.body.review,requestId:'rest-missing-selection'});
        assert.equal(completion.status,400);assert.deepEqual(initial.events,[]);
    }
    const t=restFixture();const blocked=await t.rest('plan',choice);assert.ok(blocked.body.errors.length);
    assert.equal((await t.rest('complete',{...choice,review:blocked.body.review,requestId:'rest-no-food-blocked'})).status,400);assert.deepEqual(t.events,[]);
    const external={consumeRation:false,confirmedSpells:[]};const p=await t.rest('plan',external);
    t.actor.system.attributes.hp.value=2;assert.equal((await t.rest('complete',{...external,review:p.body.review,requestId:'rest-stale-blocked'})).status,409);assert.deepEqual(t.events,[]);
    const fresh=await t.rest('plan',external);assert.equal((await t.rest('complete',{...external,review:fresh.body.review,requestId:'rest-external-food'})).body.state,'complete');assert.deepEqual(t.events,['actor']);
    t.runtime.documents.get=async()=>null;assert.ok(((await t.rest('status',{})).status??0)>=400);
});
await check('REST lost ration acknowledgement reconciles without spending twice',async()=>{
    const t=restFixture([rationItem()]);const p=await t.rest('plan',choice),body={...choice,review:p.body.review,requestId:'rest-lost-ack'};
    t.fail('spend-lost');assert.equal((await t.rest('complete',body)).body.state,'partial');assert.equal(t.actor.items[0].system.quantity,2);
    t.fail('');const status=await t.rest('status',{});assert.equal(status.body.retryable,true);assert.equal(t.actor.system.attributes.hp.value,1);
    assert.equal((await t.rest('complete',body)).body.state,'complete');assert.equal(t.actor.system.attributes.hp.value,9);assert.equal(t.events.filter(e=>e==='item:food').length,1);
});
await check('REST uncertain writes and independent edits never authorize replay or a replacement',async()=>{
    for(const failure of ['fields','spend-lost']){
        const t=restFixture([rationItem()]);const p=await t.rest('plan',choice),body={...choice,review:p.body.review,requestId:'rest-uncertain-request'};
        t.fail(failure);await t.rest('complete',body);t.fail('');t.actor.system.attributes.hp.value=4;
        await t.rest('status',{});const before=[...t.events];assert.equal((await t.rest('complete',body)).body.retryable,false);assert.deepEqual(t.events,before);
        assert.equal((await t.rest('complete',{...body,requestId:'rest-replacement-denied'})).status,409);assert.deepEqual(t.events,before);
        t.actor.items[0].system.quantity=2;t.actor.system.attributes.hp.value=9;
        assert.equal((await t.rest('status',{})).body.state,'complete','manual exact completion clears the pending receipt without writes');assert.deepEqual(t.events,before);
    }
});
await check('REST external spell edits invalidate old casting provenance',async()=>{
    const item={_id:'spell',type:'Spell',name:'Native-edited spell',_stats:{modifiedTime:1},system:{lost:true},flags:{shadowdark:{sheetDelver:{spellLoss:{reason:'rest'}}}}};
    const t=restFixture([item]),intent={consumeRation:false,confirmedSpells:[]};
    await recordSpellLoss({runtime:t.runtime} as any,t.actor._id,'spell',{'flags.shadowdark.sheetDelver.spellLoss':item.flags.shadowdark.sheetDelver.spellLoss});
    assert.ok((await t.rest('plan',intent)).body.reset.some((r:any)=>r.id==='spell'));
    t.actor.items[0]._stats.modifiedTime=2;
    const plan=await t.rest('plan',intent);assert.ok(!plan.body.reset.some((r:any)=>r.id==='spell'));assert.match(plan.body.excluded.find((r:any)=>r.id==='spell').detail,/unknown/);
    assert.equal(t.actor.items[0].flags.shadowdark.sheetDelver.spellLoss.reason,'rest','planning does not edit source flags');
});
await check('REST known refusal can finish, changed context blocks and additive HP is not doubled',async()=>{
    const t=restFixture([rationItem()]);const p=await t.rest('plan',choice),body={...choice,review:p.body.review,requestId:'rest-known-refusal'};
    t.fail('spend-denied');assert.equal((await t.rest('complete',body)).body.retryable,true);assert.equal(t.actor.items[0].system.quantity,3);
    t.fail('');assert.equal((await t.rest('complete',body)).body.state,'complete');assert.equal(t.actor.items[0].system.quantity,2);
    const other=restFixture([rationItem()]);const preview=await other.rest('plan',choice);other.retire();
    assert.equal((await other.rest('complete',{...choice,review:preview.body.review,requestId:'rest-retired-context'})).status,409);assert.deepEqual(other.events,[]);
    const hp=restFixture();hp.actor.effects=[{_id:'bonus',name:'HP bonus',disabled:false,changes:[{key:'system.attributes.hp.value',mode:2,value:'2'}]}];
    const plan=restPlan(hp.actor,{consumeRation:false,confirmedSpells:[]},{},requestRules(hp.runtime));
    assert.equal(plan.writes.find(w=>!w.itemId)?.patch['system.attributes.hp.value'],7);
});
await check('REST spell provenance and manual restore preserve penance and unknown losses',()=>{
    for(const [classUuid,critical,expected]of [[SPELL_CLASSES.wizard,true,'rest'],[SPELL_CLASSES.priest,true,'penance'],[SPELL_CLASSES.seer,true,'penance'],[SPELL_CLASSES.witch,true,'unknown'],[SPELL_CLASSES.priest,false,'rest']] as const){
        const w=planConsequences({kind:'spell',itemId:'spell',castingClass:classUuid,spell:{name:'Test'}} as any,{type:'Spell'}, {success:false,criticalFailure:critical} as any)[0];
        assert.equal((w.updates!['flags.shadowdark.sheetDelver.spellLoss'] as any).reason,expected);
    }
    assert.equal(manualSpellLoss(false)['flags.shadowdark.sheetDelver.spellLoss'],null);
    const t=restFixture([{_id:'penance',type:'Spell',name:'Penance',system:{lost:true},flags:{shadowdark:{sheetDelver:{spellLoss:{reason:'penance'}}}}}]);
    assert.ok(restPlan(t.actor,{consumeRation:false,confirmedSpells:['penance']},{},requestRules(t.runtime)).reset.some(r=>r.id==='penance'));
    t.actor.items[0].flags.shadowdark.sheetDelver.spellLoss.reason='permanent';
    const p=restPlan(t.actor,{consumeRation:false,confirmedSpells:['penance']},{},requestRules(t.runtime));assert.ok(p.errors.length);assert.ok(!p.reset.some(r=>r.id==='penance'));
});
await check('LIGHT chat uses SDK cards, native visibility, owner state and duplicate suppression', async () => {
    for (const active of [true, false]) for (const setting of [0, 1, 2, null]) {
        const t=fixture([{_id:'torch',name:'Torch <one>',type:'Basic',system:{light:{isSource:true,active,remainingSecs:125}}}]);
        t.actor.name='Prim <one>'; const cards:any[]=[];
        t.runtime.world.snapshot=()=>({...worldSnapshot(1),settings:{'shadowdark.playerShowLightRemaining':setting===null?{status:'unavailable'}:{status:'world',value:setting}}});
        t.runtime.chat.card=async(card:any,options:any)=>{cards.push({card,options});};
        const body={requestId:'light-card-test',itemId:'torch',active};
        const send=async(extra:any={})=>handleLightChat(t.actor._id,{method:'POST',runtime:t.runtime,userSession:{userId:'controlled'},json:async()=>({...body,...extra})} as any);
        assert.equal((await send()).status,200);assert.equal(cards.length,1);
        assert.equal(cards[0].options.rollMode,'publicroll');assert.equal(cards[0].options.speaker.actor,t.actor._id);
        assert.match(cards[0].card.title,active?/lit$/:/extinguished$/);
        assert.match(cards[0].card.content,/Prim &lt;one&gt;/);assert.equal(cards[0].card.content.includes('2 min remaining'),setting===2);
        assert.equal((await send()).status,200);assert.equal(cards.length,1);
        assert.equal((await send({active:!active})).status,409);assert.equal(cards.length,1);
        assert.equal((await send({requestId:'light-new-state',active:!active})).status,409);assert.equal(cards.length,1);
        t.runtime.documents.get=async()=>null;
        assert.equal((await send()).status,404);assert.equal(cards.length,1);
        assert.equal(t.events.length,0,'notification never writes inventory');
    }
});
await check('LIGHT uncertain chat acknowledgement does not retry or change inventory', async () => {
    const t=fixture([{_id:'torch',type:'Basic',system:{light:{isSource:true,active:true}}}]);let calls=0;
    t.runtime.chat.card=async()=>{calls++;throw Error('Acknowledgement lost')};
    const send=()=>handleLightChat(t.actor._id,{method:'POST',runtime:t.runtime,userSession:{userId:'controlled'},json:async()=>({requestId:'light-uncertain',itemId:'torch',active:true})} as any);
    for(let i=0;i<2;i++){const r=await send();assert.equal(r.status,200);assert.equal((await r.json() as any).posted,false);}
    assert.equal(calls,1);assert.equal(t.events.length,0);
});
console.log(JSON.stringify({method:'Actual module operations over controlled source/receipts; not native Foundry acceptance',checks},null,2));
if(checks.some(row=>!row.passed))process.exitCode=1;
