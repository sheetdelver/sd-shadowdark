/** Exhaustive pinned Class × Ancestry × level paths, including native ancestry
 * choices and Warlock patrons. Real planner/final writer; isolated SDK storage.
 * This is not every random award/spell combination or native Foundry acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createMockModuleRuntime } from '@sheet-delver/sdk/testing';
import { creatorRows as rows, creatorSources as sources, CREATOR_NATIVE } from './fixtures/creator';
import { worldSnapshot } from './fixtures/native-406';
import { emptyCharacterDraft } from '../logic/character-creation';
import { prepareCreator, LEVEL_ZERO_CLASS } from '../server/character-creation';
import { handleCreatorCreate } from '../server/api/character-creator';
import { shadowdarkAdapter as adapter } from '../server/ShadowdarkAdapter';
import { talentChoiceKind } from '../logic/talent-choices';
import { statChoiceRule } from '../logic/stat-choices';
import { spellChoiceGrant, FIXED_SPELL_GRANTS } from '../logic/spell-grants';
import { NONREPEATABLE_CREATOR_AWARDS } from '../logic/creator-awards';
import { handleFinalizeLevelUp } from '../server/api/level-up';
import { handleCreateCharacter } from '../server/api/languages';
import { enrichItem, resolveSubItems } from '../logic/actor-enricher';
import { ownedCopy } from '../logic/identity';
import { creationGrants } from '../logic/creation-grants';
import { prepareActorCore } from '../logic/actor-preparation';
const clone=structuredClone, actors=new Map<string,any>();let writes=0;
const runtime:any=createMockModuleRuntime({moduleId:'shadowdark',world:worldSnapshot(1) as any,compendium:{Item:rows.filter(r=>!r.results),RollTable:rows.filter(r=>r.results)}});
runtime.access={canReadPack:()=>true,packs:()=>[]};
runtime.compendium={findAll:async()=>clone(rows),getById:async(_type:string,id:string)=>clone(sources.get(id)??null)};
runtime.documents.get=async(type:string,id:string)=>type==='Actor'?clone(actors.get(id)??null):null;
runtime.documents.list=async(type:string,query:any)=>{const found=type==='Actor'?[...actors.values()].filter(a=>!query?.filter||a.flags?.shadowdark?.sheetDelver?.creatorOperation===query.filter['flags.shadowdark.sheetDelver.creatorOperation']):[];return{rows:clone(found),total:found.length};};
runtime.documents.create=async(type:string,payload:any)=>{assert.equal(type,'Actor');writes++;const actor={...clone(payload),_id:'matrix'+writes,items:payload.items.map((i:any,n:number)=>({...clone(i),_id:'item'+n}))};actors.set(actor._id,actor);return clone(actor);};
runtime.documents.items.create=async()=>{throw Error('Creation must send one complete Actor');};
await adapter.initialize({...runtime,logger:console});
const req=(body:any):any=>({runtime,userSession:{userId:'matrix-owner'},json:async()=>clone(body)});
const ancestors=rows.filter(r=>r.type==='Ancestry'),classes=rows.filter(r=>r.type==='Class'),patrons=rows.filter(r=>r.type==='Patron');
const baseline=JSON.stringify(rows),results:any[]=[],generatorResults:any[]=[];
function combinations<T>(pool:T[],count:number):T[][]{if(!count)return[[]];return pool.flatMap((item,i)=>combinations(pool.slice(i+1),count-1).map(rest=>[item,...rest]));}
function awardFor(tableId:string):string{
 const table=sources.get(tableId);assert.ok(table,'missing table '+tableId);
 const eligible=table.results.map((r:any)=>sources.get(r.documentUuid)).filter((r:any)=>r&&['Talent','Boon'].includes(r.type)&&!NONREPEATABLE_CREATOR_AWARDS.has(r.uuid)&&!talentChoiceKind(r)&&!statChoiceRule(r)&&!spellChoiceGrant(r));
 assert.ok(eligible.length,'no simple repeated award in '+table.name);
 // Prefer a constant numeric bonus; avoid prose-only instructions when possible.
 return (eligible.find((r:any)=>r.effects?.some((e:any)=>e.changes?.some((c:any)=>Number.isFinite(Number(c.value)))))??eligible[0]).uuid;
}
for(const cls of classes){
 const levels=cls.uuid===LEVEL_ZERO_CLASS?[0]:Array.from({length:10},(_,i)=>i+1);
 for(const ancestry of ancestors)for(const ancestryTalents of combinations<string>(ancestry.system.talents,ancestry.system.talentChoiceCount))for(const patron of cls.system.patron.required?patrons:[null])for(const level of levels){
  const label=`${cls.name} / ${ancestry.name} / ${ancestryTalents.map(r=>sources.get(r).name).join(', ')}${patron?' / '+patron.name:''} / ${level}`;
  const before=writes;
  try{
   const d=emptyCharacterDraft();Object.assign(d,{name:label,level,classUuid:cls.uuid,ancestryUuid:ancestry.uuid,backgroundUuid:rows.find(r=>r.type==='Background').uuid,alignment:'neutral',patronUuid:patron?.uuid??'',ancestryTalents,classTalents:cls.system.talentChoices.slice(0,cls.system.talentChoiceCount)});
   for(const key of Object.keys(d.abilities))d.abilities[key as keyof typeof d.abilities]={value:12,basis:'base'};
   d.hp={value:{value:4,basis:'effective'},max:{value:40,basis:'effective'}};
   const fixed=[...cls.system.talents,...cls.system.classAbilities,...(cls.system.startingSpells??[]),...ancestryTalents,...d.classTalents];
   for(const [prefix,refs] of [['class',cls.system.talents],['ancestry',ancestryTalents],['class-choice',d.classTalents]] as [string,string[]][])
    for(const ref of refs){const kind=talentChoiceKind(sources.get(ref));if(kind)d.fixedChoices[`${prefix}:${ref}`]={target:kind==='weapon'?'Club':kind==='armor'?'Leather armor':'Magic Missile'};}
   const languageChoices:any={ancestry:[],class:[],common:[],rare:[]};
   const nativeLanguages=[ancestry.system.languages,cls.system.languages],used=new Set<string>(nativeLanguages.flatMap(l=>l.fixed));
   for(const lang of nativeLanguages){for(let i=0;i<lang.select;i++){const ref=lang.selectOptions.find((r:string)=>!used.has(r));assert.ok(ref,'select language');used.add(ref);d.languages.push(ref);languageChoices[lang===ancestry.system.languages?'ancestry':'class'].push(ref);}}
   for(const rarity of ['common','rare'])for(let i=0;i<nativeLanguages.reduce((sum,l)=>sum+l[rarity],0);i++){const row=rows.find(r=>r.type==='Language'&&r.system.rarity===rarity&&!used.has(r.uuid));assert.ok(row,'language '+rarity);used.add(row.uuid);d.languages.push(row.uuid);languageChoices[rarity].push(row.uuid);}
   const list=cls.system.spellcasting.ability?(cls.system.spellcasting.class||cls.uuid):null;
   const fixedSpells=new Set([...fixed.filter(ref=>sources.get(ref)?.type==='Spell'),...fixed.map(ref=>FIXED_SPELL_GRANTS[ref]).filter(Boolean)]);
   for(let tier=1;tier<=5;tier++){
    const count=level?cls.system.spellcasting.spellsknown[level][tier]??0:0;
    const spells=rows.filter(r=>r.type==='Spell'&&r.system.tier===tier&&r.system.class.includes(list)&&!fixedSpells.has(r.uuid)).slice(0,count);assert.equal(spells.length,count,'native spell pool');
    d.spells.push(...spells.map(r=>({source:r.uuid,castingClass:list!})));
   }
   const ambitious=ancestryTalents.some(ref=>ref==='Compendium.shadowdark.talents.Item.DYWFJu5XeazJYc0P');
   for(let at=1;at<=level;at+=2){
    const tableIds=at===1&&patron?[...Array(cls.system.patron.startingBoons).fill(patron.system.boonTable),...Array(ambitious?1:0).fill(cls.system.classTalentTable)]:Array(1+(at===1&&ambitious?1:0)).fill(cls.system.classTalentTable);
    for(const tableId of tableIds)d.awards.push({id:'award'+d.awards.length,origin:'recorded',level:at,source:awardFor(tableId),choices:{}});
   }
   let plan=await prepareCreator(req({}),d);assert.deepEqual(plan.errors,[],JSON.stringify(plan.errors));d.acknowledgements=plan.warnings.map(w=>w.id);plan=await prepareCreator(req({}),d);assert.equal(plan.ready,true);
   const response=await handleCreatorCreate(req({requestId:'matrix-'+results.length,draft:d,review:plan.review,contextRevision:1}));const body:any=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.operation?.state,'complete',JSON.stringify(body));assert.equal(writes,before+1);
   const actor=actors.get(body.operation.actorId),core=prepareActorCore(actor);
   assert.equal(actor.system.level.value,level);assert.equal(actor.system.class,cls.uuid);assert.equal(actor.system.ancestry,ancestry.uuid);assert.deepEqual(core.hp,{value:4,max:40});
   for(const ref of fixed)assert.ok(actor.items.some((i:any)=>i._stats?.compendiumSource===ref),'missing fixed grant '+ref);
   for(const ref of fixedSpells)assert.equal(actor.items.filter((i:any)=>i._stats?.compendiumSource===ref).length,1,'fixed spell once');
   assert.equal(actor.items.filter((i:any)=>i.type==='Spell').length,d.spells.length+fixedSpells.size);
   assert.equal(new Set(actor.system.languages).size,used.size);assert.ok([...used].every(ref=>actor.system.languages.includes(ref)));
   assert.equal(actor.items.filter((i:any)=>i.flags?.shadowdark?.sheetDelver?.creatorAward?.origin==='recorded').length,d.awards.length);
   assert.ok(!JSON.stringify(actor).includes('REPLACEME'));results.push({label,passed:true});
   if(level<=1)try{
    const input:any={targetLevel:1,classUuid:cls.uuid,ancestryUuid:ancestry.uuid,ancestryTalentChoices:ancestryTalents,backgroundUuid:d.backgroundUuid,patronUuid:d.patronUuid,languageChoices,selectedSpells:d.spells.map(s=>sources.get(s.source)),rolledTalents:d.awards.filter(a=>sources.get(a.source!).type==='Talent').map(a=>sources.get(a.source!)),rolledBoons:d.awards.filter(a=>sources.get(a.source!).type==='Boon').map(a=>sources.get(a.source!)),hpRoll:4,weaponMasterySelection:{required:cls.system.talents.filter((r:string)=>talentChoiceKind(sources.get(r))==='weapon').length,selected:cls.system.talents.filter((r:string)=>talentChoiceKind(sources.get(r))==='weapon').map(()=>'Club')}};
    if(level===1&&ancestry.system.talents.length>ancestry.system.talentChoiceCount){
     for(const invalid of [undefined,[],ancestry.system.talents,[ancestryTalents[0],ancestryTalents[0]],['Compendium.shadowdark.talents.Item.DYWFJu5XeazJYc0P']]){
      const countBefore=writes,invalidResponse=await handleFinalizeLevelUp('new',req({...input,ancestryTalentChoices:invalid}));
      assert.equal(invalidResponse.status,400,'invalid ancestry choice rejected');assert.equal(writes,countBefore);
     }
    }
    let payload:any={actor:clone(actor),languageChoices};delete payload.actor._id;
    if(level===0){
     const context={addedSourceIds:new Set<string>(),addedNames:new Set<string>(),targetLevel:0,actor:null};
     const items=await resolveSubItems(ancestry,async ref=>clone(sources.get(ref)),context);
     for(const ref of ancestryTalents){const item=await enrichItem(clone(sources.get(ref)),{...context,defaultTalentClass:'ancestry'});if(item)items.push(item);}
     payload.actor.items=items.map(item=>ownedCopy(item));
    }
    if(level===1){const r=await handleFinalizeLevelUp('new',req(input));const p:any=await r.json();assert.equal(r.status,200,JSON.stringify(p));payload.actor.items=creationGrants(p.items);payload.creationPlan=p.creationPlan;}
    const writeBefore=writes,r=await handleCreateCharacter(req(payload)),body:any=await r.json();assert.equal(r.status,200,JSON.stringify(body));assert.equal(writes,writeBefore+1);
    const saved=actors.get(body.id);
    for(const ref of ancestry.system.talents)assert.equal(saved.items.filter((i:any)=>i._stats?.compendiumSource===ref).length,ancestryTalents.includes(ref)?1:0,'ancestry choice '+sources.get(ref).name);
    for(const ref of fixedSpells)assert.equal(saved.items.filter((i:any)=>i._stats?.compendiumSource===ref).length,1);
    assert.equal(saved.items.filter((i:any)=>i.type==='Spell').length,d.spells.length+fixedSpells.size);
    generatorResults.push({label,passed:true});
   }catch(error){generatorResults.push({label,passed:false,error:String(error)});}

  }catch(error){results.push({label,passed:false,error:String(error)});}
  actors.clear();
 }
 console.log(cls.name+': '+results.filter(r=>r.label.startsWith(cls.name+' / ')).length+' paths');
}
assert.equal(JSON.stringify(rows),baseline,'source catalog must stay unchanged');
const report={native:CREATOR_NATIVE,classes:classes.length,ancestries:ancestors.length,paths:results.length,writes,failed:results.filter(r=>!r.passed),generatorPaths:generatorResults.length,generatorFailed:generatorResults.filter(r=>!r.passed),generatorResults,results};
if(process.env.SHADOWDARK_MATRIX_REPORT)fs.writeFileSync(process.env.SHADOWDARK_MATRIX_REPORT,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined,generatorResults:undefined},null,2));assert.deepEqual(report.failed,[]);assert.deepEqual(report.generatorFailed,[]);
