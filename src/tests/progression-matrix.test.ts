/** Real existing-Actor progression, 0 -> 10, for every pinned class/ancestry
 * path. Public SDK writes are isolated. Source tables, not planner output,
 * supply expected quotas. This does not claim live Foundry/UI acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setModuleLogSink } from '@sheet-delver/sdk';
import { createMockModuleRuntime } from '@sheet-delver/sdk/testing';
import { creatorRows as rows, creatorSources as sources, CREATOR_NATIVE } from './fixtures/creator';
import { worldSnapshot } from './fixtures/native-406';
import { emptyCharacterDraft } from '../logic/character-creation';
import { prepareCreator, LEVEL_ZERO_CLASS } from '../server/character-creation';
import { handleCreatorCreate } from '../server/api/character-creator';
import { handleFinalizeLevelUp, handleGetLevelUpData, handleRollHP } from '../server/api/level-up';
import { shadowdarkAdapter as adapter } from '../server/ShadowdarkAdapter';
import { reviewToken } from '../server/source-review';
import { prepareActorCore } from '../logic/actor-preparation';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { talentChoiceKind } from '../logic/talent-choices';
import { statChoiceRule } from '../logic/stat-choices';
import { spellChoiceGrant, FIXED_SPELL_GRANTS } from '../logic/spell-grants';
import { NONREPEATABLE_CREATOR_AWARDS } from '../logic/creator-awards';

const clone=structuredClone,actors=new Map<string,any>(),events:any[]=[],results:any[]=[];
let itemSequence=0,actorSequence=0,rolls=0,transitions=0,replays=0,rejections=0,skipRejections=0,knownSpellRejections=0;
const runtime:any=createMockModuleRuntime({moduleId:'shadowdark',world:worldSnapshot(1) as any,compendium:{Item:rows.filter(r=>!r.results),RollTable:rows.filter(r=>r.results)}});
runtime.access={canReadPack:()=>true,packs:()=>[]};
runtime.compendium={findAll:async()=>clone(rows),getById:async(_type:string,id:string)=>clone(sources.get(id)??null)};
runtime.documents.get=async(type:string,id:string)=>type==='Actor'?clone(actors.get(id)??null):null;
runtime.documents.list=async(type:string,query:any)=>{const found=type==='Actor'?[...actors.values()].filter(a=>!query?.filter||a.flags?.shadowdark?.sheetDelver?.creatorOperation===query.filter['flags.shadowdark.sheetDelver.creatorOperation']):[];return{rows:clone(found),total:found.length};};
runtime.documents.create=async(type:string,payload:any)=>{assert.equal(type,'Actor');const actor={...clone(payload),_id:'journey'+(++actorSequence),items:payload.items.map((i:any)=>({...clone(i),_id:'item'+(++itemSequence)}))};actors.set(actor._id,actor);events.push({kind:'actor'});return clone(actor);};
runtime.documents.items.create=async(parent:any,item:any)=>{assert.equal(parent.type,'Actor');const actor=actors.get(parent.id);assert.ok(actor);const saved={...clone(item),_id:'item'+(++itemSequence)};actor.items.push(saved);events.push({kind:'item',id:saved._id});return clone(saved);};
runtime.documents.patch=async(type:string,id:string,patch:any)=>{assert.equal(type,'Actor');const actor=actors.get(id);assert.ok(actor);for(const [path,value] of Object.entries(patch)){const parts=path.split('.');let target=actor;for(const part of parts.slice(0,-1))target=target[part]??={};target[parts.at(-1)!]=clone(value);}events.push({kind:'patch',patch:clone(patch)});return clone(actor);};
runtime.rolls={roll:async(formula:string)=>{rolls++;return{formula,total:4};}};
await adapter.initialize({...runtime,logger:console});
// Keep CI output to journey summaries; warnings/errors still remain visible.
setModuleLogSink({debug(){},info(){},warn:console.warn,error:console.error});
const req=(body:any,cls?:any,patron?:any):any=>({runtime,userSession:{userId:'progression-owner'},url:'http://offline/level-up/data?'+new URLSearchParams({classId:cls?.uuid??'',patronId:patron?.uuid??''}),json:async()=>clone(body)});
function combinations<T>(pool:T[],count:number):T[][]{if(!count)return[[]];return pool.flatMap((item,i)=>combinations(pool.slice(i+1),count-1).map(rest=>[item,...rest]));}
function awardFor(tableId:string){
 const table=sources.get(tableId);assert.ok(table,'missing native award table');
 const eligible=table.results.map((r:any)=>sources.get(r.documentUuid)).filter((r:any)=>r&&['Talent','Boon'].includes(r.type)&&!NONREPEATABLE_CREATOR_AWARDS.has(r.uuid)&&!talentChoiceKind(r)&&!statChoiceRule(r)&&!spellChoiceGrant(r));
 assert.ok(eligible.length,'simple repeated award required for this matrix');
 return eligible.find((r:any)=>r.effects?.some((e:any)=>e.changes?.some((c:any)=>Number.isFinite(Number(c.value)))))??eligible[0];
}
function languageChoices(docs:any[],existing:string[]=[]){
 const selected:any={ancestry:[],class:[],common:[],rare:[]},used=new Set<string>([...existing,...docs.flatMap(d=>d?.system.languages.fixed??[])]);
 docs.forEach((doc,index)=>{const l=doc?.system.languages;if(!l)return;for(let i=0;i<l.select;i++){const ref=l.selectOptions.find((r:string)=>!used.has(r));assert.ok(ref,'restricted language choice');used.add(ref);selected[index===0?'ancestry':'class'].push(ref);}});
 for(const rarity of ['common','rare'])for(let i=0;i<docs.reduce((sum,d)=>sum+(d?.system.languages[rarity]??0),0);i++){const row=rows.find(r=>r.type==='Language'&&r.system.rarity===rarity&&!used.has(r.uuid));assert.ok(row);used.add(row.uuid);selected[rarity].push(row.uuid);}
 return {selected,all:[...used]};
}
const source=(item:any)=>item._stats?.compendiumSource??item.flags?.core?.sourceId;
const classes=rows.filter(r=>r.type==='Class'&&r.uuid!==LEVEL_ZERO_CLASS),ancestors=rows.filter(r=>r.type==='Ancestry'),patrons=rows.filter(r=>r.type==='Patron'),catalogBefore=JSON.stringify(rows);
assert.equal(classes.length,15);assert.equal(ancestors.length,7);assert.equal(patrons.length,6);
for(const cls of classes){
 for(const ancestry of ancestors)for(const selectedAncestry of combinations<string>(ancestry.system.talents,ancestry.system.talentChoiceCount))for(const patron of cls.system.patron.required?patrons:[null])for(const route of patron?['talent-first','boon-first']:['talent-first']){
  const label=`${cls.name} / ${ancestry.name} / ${selectedAncestry.map(r=>sources.get(r).name).join(', ')}${patron?' / '+patron.name+' / '+route:''}`;
  const completed:number[]=[];let at=0;
  try{
   const draft=emptyCharacterDraft(),ancestryLanguages=languageChoices([ancestry]);
   Object.assign(draft,{name:label,level:0,ancestryUuid:ancestry.uuid,ancestryTalents:selectedAncestry,backgroundUuid:rows.find(r=>r.type==='Background').uuid,alignment:'neutral',languages:Object.values(ancestryLanguages.selected).flat()});
   for(const key of Object.keys(draft.abilities))draft.abilities[key as keyof typeof draft.abilities]={value:12,basis:'base'};
   draft.hp={value:{value:3,basis:'effective'},max:{value:3,basis:'effective'}};
   let plan=await prepareCreator(req({}),draft);assert.deepEqual(plan.errors,[]);draft.acknowledgements=plan.warnings.map(w=>w.id);plan=await prepareCreator(req({}),draft);assert.equal(plan.ready,true);
   const created=await handleCreatorCreate(req({requestId:'progression-seed-'+actorSequence,draft,review:plan.review,contextRevision:1}));const createdBody:any=await created.json();assert.equal(created.status,200,JSON.stringify(createdBody));assert.equal(createdBody.operation?.state,'complete',JSON.stringify(createdBody));
   const actor=actors.get(createdBody.operation.actorId);actor.flags.custom={preserve:'journey'};actor.system.coins={gp:37,sp:4,cp:2};actor.system.notes='Preserve these notes';
   const cumulativeSpells=new Set<string>(),grantLedger:any[]=[],ambitious=selectedAncestry.includes('Compendium.shadowdark.talents.Item.DYWFJu5XeazJYc0P');
   const classFixed=[...cls.system.talents,...cls.system.classAbilities,...(cls.system.startingSpells??[])];
   const fixedSpells=new Set<string>([...classFixed.filter(r=>sources.get(r)?.type==='Spell'),...classFixed.map(r=>FIXED_SPELL_GRANTS[r]).filter(Boolean)]);
   const list=cls.system.spellcasting.ability?(cls.system.spellcasting.class||cls.uuid):null;
   const seedBefore=clone(actor),seedWrites=events.length;
   const skipped=await handleFinalizeLevelUp(actor._id,req({requestId:'skip-'+actor._id,baseline:reviewToken(actor),targetLevel:2,classUuid:cls.uuid,hpRoll:4}));
   assert.equal(skipped.status,400);assert.equal(events.length,seedWrites);assert.deepEqual(actor,seedBefore);skipRejections++;
   let expectedBaseMax=0;
   for(at=1;at<=10;at++){
    actor.system.level.xp=at===1?7:(at-1)*10+3;
    if(at>1&&at%2===0)actor.system.attributes.hp.value=Math.max(0,prepareActorCore(actor).hp.max-2);
    if(at>1){
     const ability=actor.items.find((i:any)=>i.type==='Class Ability'&&i.system?.limitedUses);if(ability)ability.system.uses.available=0;
     const spell=actor.items.find((i:any)=>i.type==='Spell');if(spell)spell.system.lost=true;
    }
    const before=clone(actor),beforeEvents=events.length;
    const dataResponse=await handleGetLevelUpData(actor._id,req({},cls,patron)),dataBody:any=await dataResponse.json();assert.equal(dataResponse.status,200,JSON.stringify(dataBody));const data=dataBody.data;assert.equal(data.progressionReady,true);assert.equal(data.currentLevel,at-1);assert.equal(data.targetLevel,at);assert.equal(data.classHitDie,cls.system.hitPoints);assert.deepEqual(data.diagnostics,[]);
    const selectedSpells:any[]=[];
    for(let tier=1;tier<=5;tier++){
     const expected=(cls.system.spellcasting.spellsknown[at][tier]??0)-(cls.system.spellcasting.spellsknown[at-1]?.[tier]??0);
     assert.equal(data.spellsToChoose[tier]??0,expected,'tier quota');
     const picked=rows.filter(r=>r.type==='Spell'&&r.system.tier===tier&&r.system.class.includes(list)&&!cumulativeSpells.has(r.uuid)&&!fixedSpells.has(r.uuid)).slice(0,expected);assert.equal(picked.length,expected);selectedSpells.push(...picked);
    }
    for(const spell of data.availableSpells)if(cumulativeSpells.has(spell.uuid)||fixedSpells.has(spell.uuid)&&at>1)assert.equal(spell.isKnown,true,'owned spells marked known');
    const hpResponse=await handleRollHP(actor._id,req({classId:cls.uuid})),hp:any=await hpResponse.json();assert.equal(hpResponse.status,200);const sides=Number(cls.system.hitPoints.match(/d(\d+)/)[1]);assert.equal(hp.formula,ancestry.name==='Dwarf'?`2d${sides}kh`:`1d${sides}`);assert.equal(hp.total,4);
    const newAwards:any[]=[];
    if(at%2){
     if(at===1&&patron)for(let i=0;i<cls.system.patron.startingBoons;i++)newAwards.push(awardFor(patron.system.boonTable));
     else newAwards.push(awardFor(patron&&((at===3||at===7)===(route==='boon-first'))?patron.system.boonTable:cls.system.classTalentTable));
     if(at===1&&ambitious)newAwards.push(awardFor(cls.system.classTalentTable));
    }
    const leveled=newAwards.map(doc=>({...clone(doc),system:{...doc.system,level:at}})),langs=at===1?languageChoices([null,cls],actor.system.languages):{selected:{ancestry:[],class:[],common:[],rare:[]},all:actor.system.languages};
    const input:any={requestId:`advance-${actor._id}-${at}`,baseline:reviewToken(actor),targetLevel:at,classUuid:cls.uuid,ancestryUuid:ancestry.uuid,patronUuid:patron?.uuid??'',rolledTalents:leveled.filter(r=>r.type==='Talent'),rolledBoons:leveled.filter(r=>r.type==='Boon'),selectedSpells,hpRoll:hp.total,languageChoices:langs.selected,languages:langs.all,
     weaponMasterySelection:{required:at===1?cls.system.talents.filter((r:string)=>talentChoiceKind(sources.get(r))==='weapon').length:0,selected:at===1?cls.system.talents.filter((r:string)=>talentChoiceKind(sources.get(r))==='weapon').map(()=>'Club'):[]}};
    // Exact ownership, not current names, must retain the level-zero choice.
    assert.equal(input.ancestryTalentChoices,undefined);
    if(selectedSpells.length&&cumulativeSpells.size){
     const known=sources.get([...cumulativeSpells][0]),invalid={...input,requestId:'known-'+actor._id+'-'+at,selectedSpells:[known,...selectedSpells.slice(1)]};
     const denied=await handleFinalizeLevelUp(actor._id,req(invalid));assert.equal(denied.status,400);assert.match((await denied.json() as any).error,/already know/);assert.equal(events.length,beforeEvents);assert.deepEqual(actor,before);knownSpellRejections++;
    }
    const finalResponse=await handleFinalizeLevelUp(actor._id,req(input)),finalBody:any=await finalResponse.json();assert.equal(finalResponse.status,200,JSON.stringify(finalBody));assert.equal(finalBody.state,'complete',JSON.stringify(finalBody));
    const after=prepareActorCore(actor);
    if(at===1)expectedBaseMax=Math.max(1,4+after.abilities.con.mod);else expectedBaseMax+=4;
    assert.equal(actor.system.attributes.hp.max,expectedBaseMax,'stored HP accumulates die gains only');
    const hpEffects=actor.items.flatMap((i:any)=>i.effects??[]).flatMap((e:any)=>e.changes??[]).filter((c:any)=>c.key==='system.attributes.hp.max');
    assert.ok(hpEffects.every((c:any)=>c.mode===2&&Number.isFinite(Number(c.value))),'HP oracle requires constant additive native effects');
    assert.equal(after.hp.max,expectedBaseMax+hpEffects.reduce((sum:number,c:any)=>sum+Number(c.value),0),'permanent HP effects apply once');
    assert.equal(after.hp.value,at===1?expectedBaseMax:before.system.attributes.hp.value+4,'wounds preserved after first level');
    assert.deepEqual(actor.system.level,{value:at,xp:at===1?0:3});assert.deepEqual(actor.system.coins,{gp:37,sp:4,cp:2});assert.equal(actor.system.notes,'Preserve these notes');assert.deepEqual(actor.flags.custom,{preserve:'journey'});
    for(const old of before.items)assert.deepEqual(actor.items.find((i:any)=>i._id===old._id),old,'existing source, uses, effects and IDs stay intact');
    for(const ref of ancestry.system.talents)assert.equal(actor.items.filter((i:any)=>source(i)===ref).length,selectedAncestry.includes(ref)?1:0,'ancestry remains exclusive');
    for(const ref of classFixed)assert.ok(actor.items.some((i:any)=>source(i)===ref),'fixed class grant');
    selectedSpells.forEach(s=>cumulativeSpells.add(s.uuid));
    for(const ref of new Set([...cumulativeSpells,...fixedSpells]))assert.equal(actor.items.filter((i:any)=>i.type==='Spell'&&source(i)===ref).length,1,'exact spell owned once');
    assert.equal(actor.items.filter((i:any)=>i.type==='Spell').length,cumulativeSpells.size+fixedSpells.size);
    assert.deepEqual(new Set(actor.system.languages),new Set(langs.all));
    for(const doc of leveled)grantLedger.push({source:doc.uuid,level:at});
    for(const entry of grantLedger){const expected=grantLedger.filter(g=>g.source===entry.source&&g.level===entry.level).length;assert.equal(actor.items.filter((i:any)=>source(i)===entry.source&&i.system.level===entry.level).length,expected,'independent acquisition levels');}
    assert.ok(!JSON.stringify(actor).includes('REPLACEME'));assert.ok(events.length>beforeEvents);
    const writesAfter=events.length,savedAfter=clone(actor);const replay=await handleFinalizeLevelUp(actor._id,req(input));assert.equal((await replay.json() as any).state,'complete');assert.equal(events.length,writesAfter,'same request replay never writes');assert.deepEqual(actor,savedAfter);replays++;
    transitions++;completed.push(at);
   }
   const saved=clone(actor),writesBefore=events.length,rollsBefore=rolls;
   const capped=await handleFinalizeLevelUp(actor._id,req({requestId:'cap-'+actor._id,baseline:reviewToken(actor),classUuid:cls.uuid,targetLevel:11,hpRoll:4}));assert.equal(capped.status,400);assert.equal((await handleGetLevelUpData(actor._id,req({},cls,patron))).status,400);assert.equal((await handleRollHP(actor._id,req({classId:cls.uuid}))).status,400);assert.equal(events.length,writesBefore);assert.equal(rolls,rollsBefore);assert.deepEqual(actor,saved);assert.equal(prepareShadowdarkView(actor).levelUp,false);rejections+=3;
   results.push({label,passed:true,completed});
  }catch(error){results.push({label,passed:false,at,completed,error:String(error)});}
  actors.clear();
 }
 console.log(cls.name+': '+results.filter(r=>r.label.startsWith(cls.name+' / ')).length+' journeys');
}
assert.equal(JSON.stringify(rows),catalogBefore);
const report={native:CREATOR_NATIVE,journeys:results.length,transitions,replays,capRejections:rejections,skipRejections,knownSpellRejections,failed:results.filter(r=>!r.passed),results};
if(process.env.SHADOWDARK_PROGRESSION_REPORT)fs.writeFileSync(process.env.SHADOWDARK_PROGRESSION_REPORT,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined},null,2));assert.deepEqual(report.failed,[]);assert.equal(report.journeys,234);assert.equal(report.transitions,2340);assert.equal(report.replays,2340);
