/** ADR-0002 operation/receipt regressions. Real module handlers, isolated source state. */
import assert from 'node:assert/strict';
import { handleActorAction } from '../server/api/actions';
import { shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { evaluateOutcome, prepareRequestedAction } from '../logic/actions';
import { prepareActorCore } from '../logic/actor-preparation';
import { primLike, worldSnapshot } from './fixtures/native-406';
import { SdkError } from '@sheet-delver/sdk';
const checks: any[] = [];
async function check(id: string, run: () => unknown | Promise<unknown>) { try { await run(); checks.push({ id, passed: true }); } catch(e) { checks.push({ id, passed: false, error: (e as Error).message }); } }
let next = 0;
const ability = (uses = 1, noCheck = false) => ({ _id: 'ability', name: 'Native-shaped ability', type: 'Class Ability', system: { ability: noCheck ? '' : 'wis', dc: 10, limitedUses: true, uses: { available: uses, max: uses }, loseOnFailure: true, lost: false }, effects: [] });
const potion = () => ({ _id: 'potion', name: 'Cloudy vial', type: 'Potion', system: { description: 'Cloudy liquid', quantity: 5, identification: { identified: false, name: 'Healing Potion', description: 'Known healing effect', unknown: { keep: true } }, unknown: 7 }, effects: [{ _id: 'same', name: 'First', disabled: true, flags: { keep: 1 } }, { _id: 'second', name: 'Second', disabled: true }] });
function fixture(items: any[] = [ability()], kind = 'Player') {
    const actor: any = { ...primLike(), _id: `phases${++next}`, type: kind, items: structuredClone(items), effects: [] };
    const events: string[] = []; const receipts = new Map<string, any>(); let fail = '', failed = false, revision = 1;
    const patch = (target: any, data: any) => { for(const [path,value] of Object.entries(data)) { const keys=path.split('.');const leaf=keys.pop()!;let owner=target;for(const key of keys)owner=owner[key]??={};owner[leaf]=structuredClone(value); } };
    const runtime: any = { world: { snapshot: () => worldSnapshot(revision), assertRevision: (value: number) => { if (value !== revision) throw Error('Context retired'); } },
        access: { canReadPack: () => true }, dataStore: { get: async (key: string) => receipts.has(key) ? structuredClone(receipts.get(key)) : null, set: async (key: string,value: any) => { receipts.set(key,structuredClone(value)); } },
        documents: { get: async (type: string,id: string) => type === 'Actor' && id === actor._id ? structuredClone(actor) : null,
            items: { update: async (_parent: any,id: string,data: any) => { events.push(`item:${id}`); if (fail==='spend-denied') throw new SdkError('permission_denied','Controlled spend denial'); if(fail==='fields')throw Error('Field write failed'); patch(actor.items.find((item:any)=>item._id===id),data);if(fail==='spend-lost')throw Error('Spend receipt lost'); },
                delete: async (_parent: any,id: string) => {events.push(`delete:${id}`);if(fail==='delete'&&!failed){failed=true;throw Error('Delete failed');}actor.items=actor.items.filter((item:any)=>item._id!==id);} },
            effects: { update: async (parent: any,id: string,data: any) => {events.push(`effect:${parent.id}:${id}`);if(fail==='effect'&&id==='same')throw new SdkError('permission_denied','First effect denied');patch(actor.items.find((item:any)=>item._id===parent.id).effects.find((effect:any)=>effect._id===id),data);} } },
        rolls: { roll: async () => { events.push('roll'); if(fail==='roll')throw Error('Result receipt unavailable');return { formula:'1d20',total:5,terms:[{faces:20,results:[{result:5,active:true}]}] }; } },
        chat: { send: async () => { events.push('chat');if(fail==='chat')throw Error('Chat receipt unavailable');return {}; } } };
    const body: any = { requestId:`action-phases-${next}`, kind:items[0]?.type==='Potion'?'potion':'ability', itemId:items[0]?._id };
    const send = async (extra: any = {}) => {const res=await handleActorAction(actor._id,{runtime,userSession:{userId:'controlled'},json:async()=>({...body,...extra})} as any);return {status:res.status,body:await res.json() as any};};
    return { actor, runtime, body, events, receipts, send, fail: (value: string) => { fail=value; }, retire: () => {revision++;} };
}
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
console.log(JSON.stringify({method:'Actual module operations over controlled source/receipts; not native Foundry acceptance',checks},null,2));
if(checks.some(row=>!row.passed))process.exitCode=1;
