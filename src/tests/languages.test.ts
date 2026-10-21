import { handleFinalizeLevelUp } from '../server/api/level-up';
import { creationGrants } from '../logic/creation-grants';
/** SD02-12: field-based rarity, separate native choice pools, and server zero-write refusal. */
import assert from 'node:assert/strict';
import { languagePlan, languageRarity, validateLanguageSelections, emptyLanguageSelections, validateLanguageInventory, languageInventorySections, languageEditingPlan } from '../logic/languages';
import { ShadowdarkRegistry } from '../server/Registry';
import { shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { handleCreateCharacter, handleLanguagePlan, handleManageLanguages } from '../server/api/languages';
import { worldSnapshot } from './fixtures/native-406';
import { SdkError } from '@sheet-delver/sdk';
const checks: any[]=[];
async function check(id:string,run:()=>unknown|Promise<unknown>){try{await run();checks.push({id,passed:true});}catch(e){checks.push({id,passed:false,error:(e as Error).message});}}
const ref=(id:string)=>`Compendium.shadowdark.languages.Item.${id}`;
const rows=[{uuid:ref('a'),name:'Draconic',type:'Language',system:{rarity:'common'}},{uuid:ref('b'),name:'Mundane label',type:'Language',system:{rarity:'common'}},{uuid:ref('r'),name:'Star Tongue',type:'Language',system:{rarity:'rare'}},{uuid:ref('s'),name:'Second rare',type:'Language',system:{rarity:'rare'}},{uuid:ref('x'),name:'Celestial',type:'Language',system:{rarity:'unknown'}}];
const ancestry={_id:'ancestry',uuid:'Item.ancestry',type:'Ancestry',name:'Controlled ancestry',system:{languages:{common:1,rare:0,select:1,selectOptions:[ref('r'),ref('s')],fixed:[ref('b')]}}};
const cls={_id:'class',uuid:'Item.class',type:'Class',name:'Controlled class',system:{spellcasting:{ability:''},languages:{common:0,rare:0,select:1,selectOptions:[ref('r')],fixed:[]}}};
const selected={ancestry:[ref('s')],class:[ref('r')],common:[ref('a')],rare:[]};
await check('SD02-12 names never classify rarity; unknown is not common',()=>{
    assert.equal(languageRarity(rows[0]),'common');assert.equal(languageRarity(rows[2]),'rare');assert.equal(languageRarity(rows[4]),null);
    const projected=ShadowdarkRegistry.project(rows.map(row=>({...structuredClone(row),_id:row.uuid.split('.').at(-1),pack:'shadowdark.languages'}))).collections;
    assert.deepEqual(projected.languages.map((row:any)=>row.rarity),['common','common','rare','rare',null]);
});
await check('SD02-12 explicit zero/missing native defaults never create a choice from a pool',()=>{
    const plan=languagePlan(null,{type:'Class',system:{languages:{select:0,selectOptions:[ref('r')]}}},rows);
    assert.deepEqual(plan.groups.map(group=>group.count),[0,0,0,0]);assert.deepEqual(plan.fixed,[]);assert.deepEqual(plan.errors,[]);assert.equal(validateLanguageSelections(plan,emptyLanguageSelections()).valid,true);
});
await check('SD02-12 fixed, ancestry, class, common and rare remain independent',()=>{
    const before=structuredClone([ancestry,cls,rows]);const plan=languagePlan(ancestry,cls,rows);const valid=validateLanguageSelections(plan,selected);
    assert.equal(valid.valid,true);assert.deepEqual(valid.languages,[ref('b'),ref('s'),ref('r'),ref('a')]);assert.deepEqual([ancestry,cls,rows],before);
    for(const invalid of [{...selected,ancestry:[]},{...selected,ancestry:[ref('r')]},{...selected,common:[ref('s')]},{...selected,rare:[ref('s')]},{...selected,class:[ref('r'),ref('s')]}])assert.equal(validateLanguageSelections(plan,invalid).valid,false);
});
await check('SD02-12 unavailable references and invalid counts have actionable errors',()=>{
    for(const bad of [-1,null,1.5,'1'])assert.ok(languagePlan(null,{system:{languages:{select:bad}}},rows).errors.length);
    const plan=languagePlan(null,{system:{languages:{select:1,selectOptions:['Item.unreadable']}}},rows);
    assert.match(plan.errors.join(' '),/unavailable|not visible/);assert.equal(validateLanguageSelections(plan,{class:['Item.unreadable']}).valid,false);
});
await check('SD02-12 existing custom/extra languages are retained outside creation quotas',()=>{
    const existing=['Old custom label','Item.unreadable',ref('s')];const plan=languagePlan(null,{system:{languages:{common:0,rare:0,select:0,fixed:[]}}},rows,existing);
    assert.deepEqual(validateLanguageSelections(plan,emptyLanguageSelections(),existing).languages,existing);
});
await check('SD03 languages count native fixed and independent restricted grants without double counting',()=>{
 const plan=languagePlan(ancestry,cls,rows); const current=[ref('b'),ref('s'),ref('r'),ref('a')];
 assert.deepEqual(languageInventorySections(plan,rows,current),[{kind:'common',count:2,limit:2},{kind:'rare',count:2,limit:2}]);
 assert.equal(validateLanguageInventory(plan,current,current).valid,true);
 assert.equal(validateLanguageInventory(plan,current,[...current,ref('x')]).valid,false);
 assert.equal(validateLanguageInventory(plan,current,current.filter(uuid=>uuid!==ref('b'))).valid,false);
 const overlap=languagePlan(null,{system:{languages:{select:1,selectOptions:[ref('r'),ref('s')],rare:0}}},rows);
 assert.equal(validateLanguageInventory(overlap,[],[ref('r'),ref('s')]).valid,false);
 assert.equal(validateLanguageInventory(overlap,[],[ref('r')]).valid,true);
});
await check('SD03 retained extras never create allowance; removal and exact replacement remain possible',()=>{
 const plan=languagePlan(null,{system:{languages:{common:1}}},rows);
 const existing=[ref('a'),ref('b'),'Old custom tongue','Item.unreadable'];
 assert.equal(validateLanguageInventory(plan,existing,existing).valid,true);
 assert.equal(validateLanguageInventory(plan,existing,[ref('b'),'Old custom tongue','Item.unreadable']).valid,true);
 assert.equal(validateLanguageInventory(plan,existing,[...existing,ref('r')]).valid,false);
 assert.equal(validateLanguageInventory(plan,[ref('a')],[ref('b')]).valid,true);
 assert.equal(validateLanguageInventory(plan,[],[ref('a'),ref('a')]).valid,false);
});
await check('SD03 mixed-rarity restricted allowance is not doubled into two free quotas',()=>{
 const plan=languagePlan(null,{system:{languages:{select:1,selectOptions:[ref('a'),ref('r')]}}},rows);
 assert.deepEqual(languageInventorySections(plan,rows,[ref('r')]),[{kind:'common',count:0,limit:null},{kind:'rare',count:1,limit:null}]);
 assert.equal(validateLanguageInventory(plan,[],[ref('a'),ref('r')]).valid,false);
});
await check('SD-UI09 editing totals permit defaults to be customized without changing creation pools',()=>{
 const native=languagePlan(ancestry,cls,rows),before=structuredClone(native);
 const editing=languageEditingPlan(native,rows);
 assert.deepEqual(native,before);assert.deepEqual(editing.fixed,[]);
 assert.equal(validateLanguageInventory(editing,[ref('b')],[ref('a')]).valid,true);
 assert.equal(validateLanguageInventory(editing,[],[ref('a'),ref('b'),ref('r'),ref('s')]).valid,true);
 assert.equal(validateLanguageInventory(editing,[],[ref('a'),ref('b'),ref('x')]).valid,false);
 assert.equal(validateLanguageSelections(native,{...selected,class:[ref('s')]}).valid,false);
 const mixed=languageEditingPlan(languagePlan(null,{system:{languages:{select:1,selectOptions:[ref('a'),ref('r')]}}},rows),rows);
 assert.equal(validateLanguageInventory(mixed,[],[ref('a'),ref('r')]).valid,false);
 assert.equal(validateLanguageInventory(mixed,[],[ref('s')]).valid,false);
});
const original=shadowdarkAdapter.getCollection;
let allowed=true,revision=1;const writes:any[]=[];
const documents=new Map<string,any>([[ancestry.uuid,ancestry],[cls.uuid,cls],...rows.map(row=>[row.uuid,row] as [string,any])]);
const runtime:any={access:{canReadPack:()=>allowed},world:{snapshot:()=>worldSnapshot(revision),assertRevision:(value:number)=>{if(value!==revision)throw Error('Context retired');}},
    compendium:{getById:async(_type:string,uuid:string)=>structuredClone(documents.get(uuid)??null)},
    documents:{patch:async(type:string,id:string,patch:any)=>{writes.push({type,id,patch:structuredClone(patch)});documents.get(`${type}.${id}`).system.languages=structuredClone(patch['system.languages']);},get:async(type:string,id:string)=>structuredClone(documents.get(`${type}.${id}`)??null),create:async(type:string,data:any)=>{writes.push({type,data:structuredClone(data)});return{...data,_id:'created'};}}};
shadowdarkAdapter.getCollection=async(id,options)=>{if(id!=='languages')return original.call(shadowdarkAdapter,id,options);if(!allowed)throw new SdkError('permission_denied','Languages denied');return structuredClone(rows);};
const actor=()=>({name:'Sanitized creation',type:'Player',system:{ancestry:ancestry.uuid,class:cls.uuid,languages:[ref('b'),ref('s'),ref('r'),ref('a')],level:{value:1,xp:0}},items:[],effects:[],flags:{unknown:{keep:true}}});
const post=async(data:any)=>{const response=await handleCreateCharacter({runtime,userSession:{userId:'fixture'},json:async()=>data} as any);return{status:response.status,body:await response.json() as any};};
try{
 await check('SD02-12 missing, wrong-pool, duplicate and extra creation choices write nothing',async()=>{
    for(const languageChoices of [undefined,{...selected,class:[]},{...selected,ancestry:[ref('r')]},{...selected,common:[ref('s')]},{...selected,rare:[ref('a')]}]){const before=writes.length;const result=await post({actor:actor(),languageChoices});assert.equal(result.status,400,JSON.stringify(result));assert.equal(writes.length,before);}
 });
 await check('SD02-12 denied required language content is explicit and never empty-success creation',async()=>{
    allowed=false;try{const result=await post({actor:actor(),languageChoices:selected});assert.equal(result.status,400);assert.match(result.body.error,/not readable|unavailable|not visible/);assert.equal(writes.length,0);
    const plan:any=await(await handleLanguagePlan({runtime,json:async()=>({ancestryUuid:ancestry.uuid,classUuid:cls.uuid})} as any)).json();assert.ok(plan.errors.length);assert.deepEqual(plan.rows,[]);
    }finally{allowed=true;}
 });
 await check('SD02-12 restored exact source choices create once and preserve unknown source',async()=>{
    const choices={targetLevel:1,classUuid:cls.uuid,ancestryUuid:ancestry.uuid,hpRoll:3,languageChoices:selected};
    const prepared=await handleFinalizeLevelUp('new',{runtime,userSession:{userId:'fixture'},json:async()=>choices} as any);assert.equal(prepared.status,200);
    const plan:any=await prepared.json();const candidate=actor();candidate.items=creationGrants(plan.items) as never[];
    const result=await post({actor:candidate,languageChoices:selected,creationPlan:plan.creationPlan});assert.equal(result.status,200,JSON.stringify(result));assert.equal(writes.length,1);assert.deepEqual(writes[0].data.system.languages,[ref('b'),ref('s'),ref('r'),ref('a')]);assert.deepEqual(writes[0].data.flags,{unknown:{keep:true}});
 });
 await check('SD02-12 a retired language-plan request returns409 before creation',async()=>{
    const read=runtime.compendium.getById;runtime.compendium.getById=async(...args:any[])=>{revision++;return read(...args);};try{const before=writes.length;assert.equal((await post({actor:actor(),languageChoices:selected})).status,409);assert.equal(writes.length,before);}finally{runtime.compendium.getById=read;}
 });
 await check('SD03 guided language route rejects excess, stale source/context and denied owners before writes',async()=>{
  documents.set('Actor.a',actor());
  const req=(body:any)=>({runtime,userSession:{userId:'fixture'},json:async()=>body}) as any;
  const getPlan=async()=>{const response=await handleLanguagePlan(req({mode:'inventory',actorId:'a'}));assert.equal(response.status,200);return await response.json() as any;};
  const plan=await getPlan();const before=writes.length;
  const send=(languages:any,overrides:any={})=>handleManageLanguages(req({actorId:'a',languages,review:plan.review,contextRevision:revision,...overrides}));
  assert.equal((await send([...plan.current,ref('x')])).status,400);
  assert.equal((await send(plan.current,{contextRevision:revision-1})).status,409);
  documents.get('Actor.a').system.languages=['Item.other'];assert.equal((await send(plan.current)).status,409);documents.set('Actor.a',actor());
  const read=runtime.documents.get;runtime.documents.get=async(type:string,id:string,options:any)=>options?.minOwnership==='owner'?null:read(type,id);
  try{assert.equal((await send(plan.current)).status,403);}finally{runtime.documents.get=read;}
  const previous=documents.get('Actor.a');documents.delete('Actor.a');assert.equal((await send(plan.current)).status,404);documents.set('Actor.a',previous);
  assert.equal(writes.length,before);
  assert.equal((await send(plan.current)).status,200);assert.equal(writes.length,before);
  assert.equal((await send(plan.current.filter((u:string)=>u!==ref('a')))).status,200);
  assert.equal(writes.length,before+1);assert.deepEqual(writes.at(-1).patch,{'system.languages':[ref('b'),ref('s'),ref('r')]});
  assert.deepEqual(documents.get('Actor.a').flags,{unknown:{keep:true}});
 });
 await check('SD-UI09 fixed-only characters browse all readable languages and replace within rarity totals',async()=>{
  const oldAncestry=documents.get(ancestry.uuid),oldClass=documents.get(cls.uuid);
  documents.set(ancestry.uuid,{...ancestry,system:{languages:{fixed:[ref('a'),ref('b')]}}});
  documents.set(cls.uuid,{...cls,system:{languages:{}}});
  documents.set('Actor.a',{...actor(),system:{...actor().system,languages:[ref('a'),ref('b')]}});
  const req=(body:any)=>({runtime,userSession:{userId:'fixture'},json:async()=>body}) as any;
  try{
   const plan:any=await(await handleLanguagePlan(req({mode:'inventory',actorId:'a'}))).json();
   assert.deepEqual(new Set(plan.rows.map((r:any)=>r.uuid)),new Set(rows.map(r=>r.uuid)));
   assert.deepEqual(languageInventorySections(plan,plan.rows,plan.current),[{kind:'common',count:2,limit:2},{kind:'rare',count:0,limit:0}]);
   const before=writes.length;
   assert.equal((await handleManageLanguages(req({actorId:'a',languages:[...plan.current,ref('r')],review:plan.review,contextRevision:revision}))).status,400);
   assert.equal(writes.length,before);
   assert.equal((await handleManageLanguages(req({actorId:'a',languages:[ref('b')],review:plan.review,contextRevision:revision}))).status,200);
   const refreshed:any=await(await handleLanguagePlan(req({mode:'inventory',actorId:'a'}))).json();
   assert.equal((await handleManageLanguages(req({actorId:'a',languages:[ref('a')],review:refreshed.review,contextRevision:revision}))).status,200);
   assert.deepEqual(documents.get('Actor.a').system.languages,[ref('a')]);
  }finally{documents.set(ancestry.uuid,oldAncestry);documents.set(cls.uuid,oldClass);}
 });
 await check('SD03 review survives exact-source completion order but retires changed allowance',async()=>{
  documents.set('Actor.a',actor());const req={runtime,userSession:{userId:'fixture'},json:async()=>({mode:'inventory',actorId:'a'})} as any;
  const first:any=await(await handleLanguagePlan(req)).json();const resolve=shadowdarkAdapter.resolveDocumentFor;
  shadowdarkAdapter.resolveDocumentFor=async(uuid,caller)=>{await new Promise(resolve=>setTimeout(resolve,uuid===ref('r')?10:1));return resolve.call(shadowdarkAdapter,uuid,caller);};
  try{const second:any=await(await handleLanguagePlan(req)).json();assert.equal(second.review,first.review);
   const prior=documents.get(cls.uuid);documents.set(cls.uuid,{...prior,system:{...prior.system,languages:{...prior.system.languages,select:0}}});
   try{const third:any=await(await handleLanguagePlan(req)).json();assert.notEqual(third.review,first.review);}finally{documents.set(cls.uuid,prior);}
  }finally{shadowdarkAdapter.resolveDocumentFor=resolve;}
 });
}finally{shadowdarkAdapter.getCollection=original;}
console.log(JSON.stringify({method:'Actual module rules/routes with sanitized sources; native-method oracle is maintained separately',checks},null,2));if(checks.some(row=>!row.passed))process.exitCode=1;
