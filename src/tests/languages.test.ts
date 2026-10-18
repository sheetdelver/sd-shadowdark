/** SD02-12: field-based rarity, separate native choice pools, and server zero-write refusal. */
import assert from 'node:assert/strict';
import { languagePlan, languageRarity, validateLanguageSelections, emptyLanguageSelections } from '../logic/languages';
import { ShadowdarkRegistry } from '../server/Registry';
import { shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { handleCreateCharacter, handleLanguagePlan } from '../server/api/languages';
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
const original=shadowdarkAdapter.getCollection;
let allowed=true,revision=1;const writes:any[]=[];
const documents=new Map<string,any>([[ancestry.uuid,ancestry],[cls.uuid,cls],...rows.map(row=>[row.uuid,row] as [string,any])]);
const runtime:any={access:{canReadPack:()=>allowed},world:{snapshot:()=>worldSnapshot(revision),assertRevision:(value:number)=>{if(value!==revision)throw Error('Context retired');}},
    compendium:{getById:async(_type:string,uuid:string)=>structuredClone(documents.get(uuid)??null)},
    documents:{get:async(type:string,id:string)=>structuredClone(documents.get(`${type}.${id}`)??null),create:async(type:string,data:any)=>{writes.push({type,data:structuredClone(data)});return{...data,_id:'created'};}}};
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
    const result=await post({actor:actor(),languageChoices:selected});assert.equal(result.status,200,JSON.stringify(result));assert.equal(writes.length,1);assert.deepEqual(writes[0].data.system.languages,[ref('b'),ref('s'),ref('r'),ref('a')]);assert.deepEqual(writes[0].data.flags,{unknown:{keep:true}});
 });
 await check('SD02-12 a retired language-plan request returns409 before creation',async()=>{
    const read=runtime.compendium.getById;runtime.compendium.getById=async(...args:any[])=>{revision++;return read(...args);};try{const before=writes.length;assert.equal((await post({actor:actor(),languageChoices:selected})).status,409);assert.equal(writes.length,before);}finally{runtime.compendium.getById=read;}
 });
}finally{shadowdarkAdapter.getCollection=original;}
console.log(JSON.stringify({method:'Actual module rules/routes with sanitized sources; native-method oracle is maintained separately',checks},null,2));if(checks.some(row=>!row.passed))process.exitCode=1;
