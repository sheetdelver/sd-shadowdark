import { creatorSpellProgression } from '../logic/creator-spell-progression';
import { creatorAbilityGuidance } from '../logic/creator-ability-guidance';
/** Real creator planner/routes/journal with pinned sources and public runtime
 * contracts. All storage/transport is isolated; this is not native acceptance. */
import assert from 'node:assert/strict';
import { createMockModuleRuntime } from '@sheet-delver/sdk/testing';
import { SdkError } from '@sheet-delver/sdk';
import { creatorRows as rows, creatorSources as sources } from './fixtures/creator';
import { worldSnapshot } from './fixtures/native-406';
import { emptyCharacterDraft, type CharacterDraft } from '../logic/character-creation';
import { prepareCreator, LEVEL_ZERO_CLASS } from '../server/character-creation';
import { creatorOperationStatus, dispatchCreator, creationSourceMatches } from '../server/creation-operation';
import { handleCreatorCreate, handleCreatorPrepare, handleCreatorHP, handleCreatorRoll } from '../server/api/character-creator';
import { shadowdarkAdapter as adapter } from '../server/ShadowdarkAdapter';
import { ownedCopy } from '../logic/identity';
import { NONREPEATABLE_CREATOR_AWARDS } from '../logic/creator-awards';
const copy=structuredClone;
const WIZARD='Compendium.shadowdark.classes.Item.035nuVkU9q2wtMPs',FIGHTER='Compendium.shadowdark.classes.Item.hO7KrvqDRH6kvftJ';
const DWARF='Compendium.shadowdark.ancestries.Item.80h0XXptGDZvGAIZ';
let revision=1,deny=false,transport:'ok'|'timeout'|'missing-id'='ok',writeCount=0,rollCount=0,failReceipt=false;
const actors=new Map<string,any>(),store=new Map<string,any>();
const runtime:any=createMockModuleRuntime({moduleId:'shadowdark',world:worldSnapshot(1) as any,compendium:{Item:rows.filter(r=>!r.results),RollTable:rows.filter(r=>r.results)}});
runtime.world={snapshot:()=>worldSnapshot(revision),assertRevision:(r:number)=>{if(r!==revision)throw new Error('Retired');}};
runtime.access={canReadPack:()=>!deny,packs:()=>[]};
runtime.compendium={findAll:async()=>copy(rows),getById:async(_type:string,uuid:string)=>copy(sources.get(uuid)??null)};
runtime.documents.get=async(type:string,id:string,opts:any)=>type==='Actor'?copy(deny?null:actors.get(id)??null):copy(rows.find(r=>r._id===id&&r.uuid.startsWith(type+'.'))??null);
runtime.documents.list=async(type:string,query:any)=>{const result=type==='Actor'&&!deny?[...actors.values()].filter(a=>!query?.filter||a.flags?.shadowdark?.sheetDelver?.creatorOperation===query.filter['flags.shadowdark.sheetDelver.creatorOperation']):[];return {rows:copy(result),total:result.length};};
runtime.dataStore={get:async(key:string)=>copy(store.get(key)??null),set:async(key:string,value:any)=>{if(failReceipt&&value.actorId)throw new Error('Receipt failure');store.set(key,copy(value));},keys:async(prefix='')=>[...store.keys()].filter(k=>k.startsWith(prefix)),delete:async(key:string)=>{store.delete(key);},has:async(key:string)=>store.has(key)};
runtime.documents.create=async(type:string,payload:any)=>{assert.equal(type,'Actor');writeCount++;const created={...copy(payload),_id:`actor${writeCount}`,items:payload.items.map((i:any,n:number)=>({...copy(i),_id:`item${n}`}))};actors.set(created._id,created);if(transport==='timeout')throw new Error('Acknowledgement lost');return transport==='missing-id'?{}:copy(created);};
runtime.documents.items.create=async()=>{throw new Error('Creator must never create embedded Items separately');};
runtime.rolls={roll:async(formula:string)=>{rollCount++;return {formula,total:formula==='3d6'?11:4};}};
await adapter.initialize({...runtime,logger:console});
const req=(body:any,user='creator-owner'):any=>({runtime,userSession:{userId:user},json:async()=>copy(body)});
const base=(level=3,cls=FIGHTER):CharacterDraft=>{
    const d=emptyCharacterDraft();d.name='Paper character';d.backgroundUuid=rows.find(r=>r.type==='Background')!.uuid;d.alignment='neutral';d.level=level;d.classUuid=cls;d.ancestryUuid=DWARF;
    for(const k of Object.keys(d.abilities))d.abilities[k as keyof typeof d.abilities]={value:12,basis:'effective'};
    d.hp={value:{value:0,basis:'effective'},max:{value:17,basis:'effective'}};
    d.fixedChoices[`class:Compendium.shadowdark.talents.Item.5bpWuaT0KTNzuzCu`]={target:'Club'};
    const c=sources.get(cls),spellcaster=!!c?.system?.spellcasting?.ability;
    for(let at=1;at<=level;at+=2)d.awards.push({id:`level-${at}`,origin:'recorded',level:at,source:spellcaster?(sources.get(c.system.classTalentTable)?.results.find((r:any)=>/Spellcasting Check/.test(r.name))?.documentUuid??'Compendium.shadowdark.talents.Item.0WmG5j0Wv685YTqO'):'Compendium.shadowdark.talents.Item.WSm6JESNoyFBnkW2',choices:{}});
    if(spellcaster&&level>0){
        const fixed=sources.get(DWARF).system.languages.fixed;
        for(const rarity of ['common','rare'])d.languages.push(...rows.filter(r=>r.type==='Language'&&r.system.rarity===rarity&&!fixed.includes(r.uuid)).slice(0,c.system.languages[rarity]??0).map(r=>r.uuid));
        d.languages.push(...(c.system.languages.selectOptions??[]).slice(0,c.system.languages.select??0));
        for(let tier=1;tier<=5;tier++)d.spells.push(...rows.filter(r=>r.type==='Spell'&&r.system.tier===tier&&r.system.class.includes(cls)&&r.uuid!=='Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH').slice(0,c.system.spellcasting.spellsknown[level]?.[tier]??0).map(r=>({source:r.uuid,castingClass:cls})));
    }
    return d;
};
const checks:any[]=[];
async function check(name:string,run:()=>Promise<void>){try{await run();checks.push({name,pass:true});}catch(e){checks.push({name,pass:false,error:String(e)});}}
async function ready(d:CharacterDraft){let p=await prepareCreator(req({}),d);assert.deepEqual(p.errors,[],JSON.stringify(p.errors));d.acknowledgements=p.warnings.map(w=>w.id);p=await prepareCreator(req({}),d);assert.equal(p.ready,true);return p;}
await check('native spell allowances fill consecutive levels and reopen earlier missing choices',async()=>{
    const wizard=sources.get(WIZARD),d=base(3,WIZARD);
    const stages=creatorSpellProgression(wizard,3,d.spells,rows);
    assert.deepEqual(stages.map(s=>s.tiers.map(t=>t.required)),[[3,0,0,0,0],[1,0,0,0,0],[0,1,0,0,0]]);
    assert.ok(stages.every(s=>s.complete));
    assert.deepEqual(creatorSpellProgression(wizard,3,[],rows).map(s=>s.complete),[false,false,false]);
    const partial=d.spells.filter(s=>sources.get(s.source).system.tier===1).slice(0,3);
    assert.equal(creatorSpellProgression(wizard,3,partial,rows).find(s=>!s.complete)?.level,2);
    partial.pop();assert.equal(creatorSpellProgression(wizard,3,partial,rows).find(s=>!s.complete)?.level,1);
    assert.deepEqual(creatorSpellProgression(wizard,0,[],rows),[]);
    assert.deepEqual(creatorSpellProgression(sources.get(FIGHTER),3,[],rows),[]);
    for(const cls of rows.filter(r=>r.type==='Class'&&r.system?.spellcasting?.ability)){
        const all=creatorSpellProgression(cls,10,[],rows);
        for(let tier=1;tier<=5;tier++)assert.equal(all.reduce((sum,s)=>sum+s.tiers[tier-1].required,0),cls.system.spellcasting.spellsknown[10][tier]??0);
    }
});
await check('Knight of St. Ydris keeps its own progression and the Witch casting list',async()=>{
    const knight='Compendium.shadowdark.classes.Item.0uVUOXKuX9xfJ600',witch='Compendium.shadowdark.classes.Item.KGnBAFiTiLHZJUND';
    const d=base(10,knight),cls=sources.get(knight);
    d.spells=[];
    for(let tier=1;tier<=5;tier++)d.spells.push(...rows.filter(r=>r.type==='Spell'&&r.system.tier===tier&&r.system.class.includes(witch)).slice(0,cls.system.spellcasting.spellsknown[10][tier]??0).map(r=>({source:r.uuid,castingClass:witch})));
    const p=await prepareCreator(req({}),d);
    assert.deepEqual(p.errors.filter(e=>e.step===4),[]);
    assert.equal(p.listUuid,witch);
    assert.deepEqual(p.preview.spellModel.sources.map(s=>[s.classUuid,s.listUuid]),[[knight,witch]]);
    assert.deepEqual(creatorSpellProgression(cls,10,d.spells,rows).at(-1)!.tiers.map(t=>t.limit.value),[3,3,2,0,0]);
});
await check('mismatched cached Knight casting grant is diagnosed at identity before spell selection',async()=>{
    const original=adapter.resolveDocumentFor;
    adapter.resolveDocumentFor=async function(uuid,caller){
        const doc=await original.call(this,uuid,caller);
        if(uuid!=='Compendium.shadowdark.talents.Item.XRW3jhpTni15hwFc')return doc;
        const changed=copy(doc);
        changed.effects[0].changes[0].value='knight-of-st.-ydris';
        return changed;
    };
    try {
        const p=await prepareCreator(req({}),base(10,'Compendium.shadowdark.classes.Item.0uVUOXKuX9xfJ600'));
        assert.equal(p.ready,false);
        const error=p.errors.find(e=>e.field==='classUuid');
        assert.equal(error?.step,1);
        assert.match(error!.message,/Knight of St. Ydris.*knight-of-st.-ydris.*Witch spell list/);
        assert.equal(p.source.items.find((i:any)=>i._stats?.compendiumSource==='Compendium.shadowdark.talents.Item.XRW3jhpTni15hwFc').effects[0].changes[0].value,'knight-of-st.-ydris');
    }finally{adapter.resolveDocumentFor=original;}
});
await check('missing intermediate progression blocks creation even with valid final totals',async()=>{
    const original=adapter.resolveDocumentFor;
    adapter.resolveDocumentFor=async function(uuid,caller){const doc=await original.call(this,uuid,caller);if(uuid!==WIZARD)return doc;const changed=copy(doc);delete changed.system.spellcasting.spellsknown[2];return changed;};
    try{const p=await prepareCreator(req({}),base(3,WIZARD));assert.equal(p.ready,false);assert.ok(p.errors.some(e=>e.message.startsWith('Level 2: native spell progression')));}
    finally{adapter.resolveDocumentFor=original;}
});
await check('ordinary duplicates and future-tier grant choices fail server validation',async()=>{
    const d=base(3,WIZARD);d.spells[1]={...d.spells[0]};assert.ok((await prepareCreator(req({}),d)).errors.some(e=>e.message.includes('distinct')));
    const fresh=base(3,WIZARD),grant='Compendium.shadowdark.talents.Item.T5nkdUM75LSnDpu5';
    const future=rows.find(r=>r.type==='Spell'&&r.system.tier===2&&r.system.class.includes(WIZARD)&&!fresh.spells.some(s=>s.source===r.uuid));
    fresh.awards[0]={id:'early-grant',origin:'recorded',source:grant,level:1,choices:{[grant]:{spell:future.uuid}}};
    assert.ok((await prepareCreator(req({}),fresh)).errors.some(e=>e.message.includes('acquisition level 1')));
    fresh.awards[0].choices[grant].spell=fresh.spells[0].source;
    assert.ok((await prepareCreator(req({}),fresh)).errors.some(e=>e.message.includes('distinct Spell')));
});
await check('ability guidance follows selected native casting/check data and exact core identities',async()=>{
    assert.equal(creatorAbilityGuidance(sources.get(FIGHTER),[],1)[0].ability,'str');
    assert.equal(creatorAbilityGuidance(sources.get(WIZARD),[],1)[0].ability,'int');
    const cls={uuid:'Item.custom',name:'Fighter',system:{spellcasting:{ability:'cha'},classAbilities:['Item.check']}};
    const checks=[{uuid:'Item.check',name:'Omen',system:{ability:'wis'}},{uuid:'Item.other',name:'Unrelated',system:{ability:'str'}}];
    assert.deepEqual(creatorAbilityGuidance(cls,checks,1).map(r=>r.ability),['cha','wis']);
    cls.system.spellcasting.ability='dex';assert.equal(creatorAbilityGuidance(cls,checks,1)[0].ability,'dex');
    assert.deepEqual(creatorAbilityGuidance(cls,checks,0),[]);
    assert.deepEqual(creatorAbilityGuidance({uuid:'Item.unknown',name:'Fighter'},[],1),[]);
});
await check('manual levels 0,1,2,3,10 prepare without writes or advancement replay',async()=>{
    const before=writeCount;for(const level of [0,1,2,3,10]){const d=base(level);const p=await ready(d);assert.equal(p.source.system.level.value,level);assert.equal(p.source.system.level.xp,0);assert.equal(p.source.system.attributes.hp.value,0);if(level===0){assert.equal(p.source.system.class,LEVEL_ZERO_CLASS);assert.ok(!p.source.items.some((i:any)=>i._stats?.compendiumSource==='Compendium.shadowdark.talents.Item.5bpWuaT0KTNzuzCu'));}}assert.equal(writeCount,before);
});
await check('repeated independent stat awards subtract exactly once per native effect',async()=>{
    const d=base();d.abilities.str.value=16;const source='Compendium.shadowdark.talents.Item.6t06nSjj1hd6o5SV';d.awards=[{id:'repeat-a',origin:'recorded',source,level:1,choices:{}},{id:'repeat-b',origin:'recorded',source,level:3,choices:{}}];
    const p=await ready(d);assert.equal(p.source.system.abilities.str.value,12);assert.equal(p.preview.abilities.str.value,16);assert.equal(p.source.items.filter((i:any)=>i._stats?.compendiumSource===source).length,2);
});
await check('fixed Player source matches full prepared review with injured HP and quantities',async()=>{
    const d=base();const gear=rows.find(r=>r.type==='Weapon'&&r.name==='Club');d.gear=[{id:'weapon',source:gear.uuid,quantity:2,equipped:true,stashed:false}];d.coins={gp:17,sp:4,cp:9};d.notes='<script>plain paper notes</script>';
    const p=await ready(d);assert.equal(p.source.system.attributes.hp.value,0);assert.equal(p.source.items.at(-1).system.quantity,2);assert.deepEqual(p.source.items.at(-1).effects,gear.effects);assert.ok(!p.source.system.notes.includes('<script>'));
});
await check('levels above the rules cap reject caster and noncaster creation before writes',async()=>{
    const before=writeCount;
    for(const cls of [FIGHTER,WIZARD])for(const level of [11,20])
        await assert.rejects(()=>prepareCreator(req({}),base(level,cls)),/level from 0 to 10/);
    assert.equal(writeCount,before);
});
await check('Priest fixed Turn Undead is actual owned inventory and cannot fill ordinary selections twice',async()=>{
    const d=base(1,'Compendium.shadowdark.classes.Item.oZWzXx1WRLg286zD'),p=await ready(d),ref='Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH';
    assert.equal(p.source.items.filter((i:any)=>i._stats?.compendiumSource===ref).length,1);d.spells=[{source:ref,castingClass:'Compendium.shadowdark.classes.Item.oZWzXx1WRLg286zD'}];assert.ok((await prepareCreator(req({}),d)).errors.some(e=>e.message.includes('distinct')));
});
await check('Shune uses acquisition level for a noncaster, retaining casting source and no Wizard progression',async()=>{
    const d=base(10),grant='Compendium.shadowdark.talents.Item.mgRrWET5MEaGLVNo';const spell=rows.find(r=>r.type==='Spell'&&r.system.tier===2&&r.system.class.includes(WIZARD));
    d.awards=[{id:'shune',origin:'recorded',source:grant,level:4,choices:{[grant]:{spell:spell.uuid}}}];const p=await prepareCreator(req({}),d),owned=p.source.items.find((i:any)=>i.type==='Spell');assert.ok(p.errors.some(e=>e.message.includes('Class/Patron table')));assert.equal(owned.flags.shadowdark.spellGrant.level,4);assert.equal(owned.flags.shadowdark.spellGrant.classUuid,WIZARD);
    assert.ok(p.preview.spellModel.sources.every(s=>s.classUuid!==FIGHTER));d.awards[0].level=9;assert.ok((await prepareCreator(req({}),d)).errors.some(e=>e.message.includes('acquisition level 9')));
    d.awards[0].level=null;assert.ok((await prepareCreator(req({}),d)).errors.some(e=>e.message.includes('acquisition level')));
});
await check('native table OR choices retain exact result IDs and independent stat allocations',async()=>{
    const d=base(1),table=sources.get('Compendium.shadowdark.rollable-tables.RollTable.dExHo4P85MgpwHd9');
    d.awards=[{id:'table-grant',origin:'table',table:table.uuid,total:8,results:['Pz3scmVvkfGW86Qt'],level:1,choices:{}}];const p=await ready(d);const owned=p.source.items.find((i:any)=>i.flags?.shadowdark?.sheetDelver?.creatorAward?.id==='table-grant');assert.equal(owned.system.level,1);assert.equal(owned.flags.shadowdark.sheetDelver.creatorAward.table,table.uuid);assert.deepEqual(owned.flags.shadowdark.sheetDelver.creatorAward.results,['Pz3scmVvkfGW86Qt']);
    d.awards[0].results!.push('ShfsugAB4FBHqExq');assert.ok((await prepareCreator(req({}),d)).errors.some(e=>e.message.includes('bundle')));
});
await check('each native extra-Spell family is validated and preserves its exact casting source',async()=>{
    for(const [grant,cls] of [['T5nkdUM75LSnDpu5',WIZARD],['ZYZkbENdQAiNsEL6','Compendium.shadowdark.classes.Item.KGnBAFiTiLHZJUND'],['LaRNVk9FZkrM1nSJ','Compendium.shadowdark.classes.Item.xdjod5gPhNPIkLth'],['Ey3P0EplF5SHIdey',WIZARD]]) {
        const d=base(3,cls),source='Compendium.shadowdark.talents.Item.'+grant,spell=rows.find(r=>r.type==='Spell'&&r.system.tier===1&&r.system.class.includes(cls)&&!d.spells.some(s=>s.source===r.uuid));
        d.awards=[{id:'family',origin:'recorded',source,level:1,choices:{[source]:{spell:spell.uuid,castingClass:cls}}}];const p=await prepareCreator(req({}),d);
        assert.ok(p.source.items.some((i:any)=>i.flags?.shadowdark?.spellGrant?.source===source&&i.flags.shadowdark.spellGrant.classUuid===cls));
    }
});
await check('two independent stat distributions enforce each allocation and the Warlock restriction',async()=>{
    const d=base(3),table='Compendium.shadowdark.rollable-tables.RollTable.xM3hghlK5nvo46Vo';
    d.awards=[{id:'one-stats',origin:'table',table,total:4,results:[],level:1,choices:{stats:{stats:{str:1,dex:1}}}},{id:'two-stats',origin:'table',table,total:4,results:[],level:3,choices:{stats:{stats:{con:1,wis:1}}}}];
    const p=await prepareCreator(req({}),d);assert.ok(p.errors.some(e=>e.message.includes('Class/Patron table')));assert.equal(p.source.system.abilities.str.value,11);assert.equal(p.source.system.abilities.con.value,11);
    d.awards[0].choices.stats.stats={str:2};assert.ok((await prepareCreator(req({}),d)).errors.some(e=>e.message.includes('Allocate')));
});
await check('native equipment overrides demand base entry and stashing changes the prepared review',async()=>{
    const gear=sources.get('Compendium.shadowdark.magic-items.Item.qHyL2dlqQaxwMzKX');assert.equal(gear.name,'Amulet of Vitality');
    const d=base();d.abilities.con.value=18;d.gear=[{id:'bonus-gear',source:gear.uuid,quantity:1,equipped:false,stashed:false}];
    assert.ok((await prepareCreator(req({}),d)).errors.some(e=>e.message.includes('non-additive')));
    d.abilities.con={value:12,basis:'base'};const p=await ready(d);assert.equal(p.source.system.abilities.con.value,12);assert.equal(p.preview.abilities.con.value,18);
    d.gear[0].stashed=true;const changed=await ready(d);assert.equal(changed.preview.abilities.con.value,12);assert.notEqual(p.review,changed.review);
});
await check('legacy scrolls/wands retain types, origins, effects and current spent/lost/broken states',async()=>{
    const d=base(),scroll='Compendium.shadowdark.magic-items.Item.N27A6nb0epkHZ3lR';
    const wand=rows.find(r=>r.name==='Wand of Blind/Deafen');assert.ok(wand);const spell=[...String(wand.system.description).matchAll(/@UUID\[([^\]]+)\]/g)][0][1];
    d.gear=[{id:'scroll',source:scroll,quantity:1,equipped:false,stashed:false,spent:true},{id:'wand',source:wand.uuid,quantity:2,equipped:false,stashed:true,broken:true,lostSpells:[spell.startsWith('Compendium.')&&spell.split('.').length===4?spell.replace(/\.([^.]+)$/,'.Item.$1'):spell]}];
    const p=await ready(d),owned=p.source.items.at(-1);assert.equal(owned.type,wand.type);assert.equal(owned.flags.shadowdark.sheetDelver.wand.broken,true);assert.equal(owned._stats.compendiumSource,wand.uuid);assert.deepEqual(owned.effects,wand.effects);assert.ok(p.source.items.some((i:any)=>i.flags?.shadowdark?.sheetDelver?.scrollSpent));
});
await check('unresolved mastery/stat choices cannot be acknowledged away',async()=>{
    const d=base();d.fixedChoices={};let p=await prepareCreator(req({}),d);assert.ok(p.errors.some(e=>e.message.includes('weapon')));d.acknowledgements=p.warnings.map(w=>w.id);p=await prepareCreator(req({}),d);assert.equal(p.ready,false);
});
await check('only exact native nonrepeatable awards block duplicates; repeatable sources remain independent',async()=>{
    for(const source of NONREPEATABLE_CREATOR_AWARDS){const d=base();d.awards=[{id:'first',origin:'recorded',source,level:1,choices:{}},{id:'second',origin:'recorded',source,level:3,choices:{}}];assert.ok((await prepareCreator(req({}),d)).errors.some(e=>e.message.includes('cannot repeat')));}
    const d=base(),source='Compendium.shadowdark.talents.Item.WSm6JESNoyFBnkW2';d.awards=[{id:'first',origin:'recorded',source,level:1,choices:{}},{id:'second',origin:'recorded',source,level:3,choices:{}}];const p=await ready(d);assert.equal(p.source.items.filter((i:any)=>i._stats?.compendiumSource===source).length,2);
});
await check('invalid shapes and forged document bodies fail before all writes',async()=>{
    const before=writeCount;for(const change of [(d:any)=>d.level=21,(d:any)=>d.hp.value.value=NaN,(d:any)=>d.gear=[{id:'bad',source:'Item.fake',quantity:-1}],(d:any)=>d.effects=[],(d:any)=>d.abilities.str.value=Infinity]){const d=base();change(d);await assert.rejects(()=>prepareCreator(req({}),d));}assert.equal(writeCount,before);
});
await check('final malformed preflight proves zero writes and remains editable',async()=>{
    const before=writeCount,d=base();(d as any).level=21;const response=await handleCreatorCreate(req({requestId:'bad-preflight',draft:d,review:'none',contextRevision:revision}));assert.equal(response.status,400);assert.equal((await response.json() as any).creationWrites,'none');assert.equal(writeCount,before);
});
await check('caller permission revocation blocks preparation; no warmed registry bypass',async()=>{deny=true;try{await assert.rejects(()=>prepareCreator(req({}),base()));}finally{deny=false;}});
await check('optional rolls are explicit and use public runtime only',async()=>{const before=rollCount;await prepareCreator(req({}),base());assert.equal(rollCount,before);const r=await handleCreatorRoll(req({kind:'score'}));assert.equal(r.status,200);assert.equal(rollCount,before+1);const gold=await handleCreatorRoll(req({kind:'gold'}));assert.equal(gold.status,200);assert.equal((await gold.json() as any).formula,'2d6 * 5');assert.equal(rollCount,before+2);});
await check('optional HP gains use first-level prepared CON and later die totals',async()=>{
    const d=base(3,FIGHTER);
    const response=await handleCreatorHP(req({draft:d,gains:[5,3,4]})),body:any=await response.json();assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.hp.max,15);assert.equal((await handleCreatorHP(req({draft:d,gains:[9,3,4]}))).status,400);const roll=await handleCreatorRoll(req({kind:'hp',draft:d,classUuid:FIGHTER,level:1}));assert.equal(roll.status,200);assert.match((await roll.json() as any).formula,/2d8kh/);
});
await check('full review changes on inventory, notes, numbers and exact acknowledgements',async()=>{const d=base(),p=await ready(d);for(const change of [(d:CharacterDraft)=>d.coins.gp++,(d:CharacterDraft)=>d.notes='Changed',(d:CharacterDraft)=>d.hp.value.value=1]){const next=copy(d);change(next);assert.notEqual((await prepareCreator(req({}),next)).review,p.review);}});
await check('fresh final review rejects a changed source or stale context without dispatch',async()=>{
    const d=base(),p=await ready(d),before=writeCount;d.coins.gp++;let response=await handleCreatorCreate(req({requestId:'stale-review',draft:d,review:p.review,contextRevision:revision}));assert.equal(response.status,200);assert.equal((await response.json() as any).reviewChanged,true);revision++;response=await handleCreatorCreate(req({requestId:'stale-context',draft:d,review:p.review,contextRevision:revision-1}));assert.equal((await response.json() as any).reviewChanged,true);assert.equal(writeCount,before);
});
await check('double submit and same-ID replay dispatch exactly one complete Actor payload',async()=>{
    const d=base(),p=await ready(d),before=writeCount;const [a,b]=await Promise.all([dispatchCreator(req({}),'same-submit',d,p),dispatchCreator(req({}),'same-submit',d,p)]);assert.equal(writeCount,before+1);assert.equal(a.state,'complete');assert.equal(a.actorId,b.actorId);const actual=actors.get(a.actorId!);assert.ok(actual.flags.shadowdark.sheetDelver.creatorOperation);assert.ok(creationSourceMatches(actual,p.source));assert.equal(actual.items.length,p.source.items.length);await assert.rejects(()=>dispatchCreator(req({}),'same-submit',{...d,notes:'changed'},p),/different character/);
});
await check('lost acknowledgement settles only from a unique exact marked primary source',async()=>{
    const d=base(),p=await ready(d),before=writeCount;transport='timeout';const r=await dispatchCreator(req({}),'timeout-test',d,p);transport='ok';assert.equal(r.state,'uncertain');const settled=await creatorOperationStatus(req({}),'timeout-test');assert.equal(settled?.state,'complete');assert.equal(writeCount,before+1);await dispatchCreator(req({}),'timeout-test',d,p);assert.equal(writeCount,before+1);
});
await check('unknown outcomes: absent cached/primary evidence, ambiguity and source edits never recreate',async()=>{
    const d=base(),p=await ready(d);transport='timeout';const r=await dispatchCreator(req({}),'ambiguous-test',d,p);transport='ok';const before=writeCount,actual=copy(actors.get(`actor${writeCount}`));actors.delete(actual._id);
    assert.equal((await creatorOperationStatus(req({}),r.requestId))?.state,'uncertain');await assert.rejects(()=>dispatchCreator(req({}),'replacement-test',d,p),/previous creation/);assert.equal(writeCount,before);
    actors.set(actual._id,actual);actors.set('duplicate',{...copy(actual),_id:'duplicate'});assert.equal((await creatorOperationStatus(req({}),r.requestId))?.state,'uncertain');actors.delete('duplicate');actual.system.coins.gp++;const mismatch:any=await creatorOperationStatus(req({}),r.requestId);assert.equal(mismatch.state,'uncertain');assert.equal(mismatch.actorId,actual._id);assert.deepEqual(mismatch.differences,['system.coins.gp']);assert.equal(writeCount,before);actual.system.coins.gp--;assert.equal((await creatorOperationStatus(req({}),r.requestId))?.state,'complete');
});
await check('receipt save failure preserves exact acknowledged ID and dispatched fence',async()=>{
    const d=base(),p=await ready(d),before=writeCount;failReceipt=true;const r=await dispatchCreator(req({}),'receipt-test',d,p);assert.equal(r.state,'uncertain');failReceipt=false;assert.equal((await creatorOperationStatus(req({}),'receipt-test'))?.state,'complete');assert.equal(writeCount,before+1);
});
await check('operation records are caller/world bound and permission loss reveals no replacement',async()=>{
    const before=writeCount;assert.equal(await creatorOperationStatus(req({},'different-owner'),'receipt-test'),null);deny=true;try{const result=await creatorOperationStatus(req({}),'receipt-test');assert.equal(result?.state,'complete');assert.equal(result?.actorId,undefined);}finally{deny=false;}assert.equal(writeCount,before);
});
await check('proven completion survives ordinary later edits and replay still returns the exact original Actor',async()=>{
    const before=writeCount,old=await creatorOperationStatus(req({}),'receipt-test'),actor=actors.get(old!.actorId!);actor.system.attributes.hp.value=3;
    const checked=await creatorOperationStatus(req({}),'receipt-test');assert.equal(checked?.state,'complete');assert.equal(checked?.actorId,old?.actorId);assert.equal(writeCount,before);
});
await check('source comparison preserves native nested UUIDs and order while allowing generated document IDs',async()=>{
    const expected={type:'Player',items:[{name:'Same',system:{quantity:1}},{name:'Same',system:{quantity:2}}],effects:[]},actual={...copy(expected),_id:'native',system:{default:true}};
    assert.ok(creationSourceMatches(actual,expected));actual.items[1].system.quantity=1;assert.equal(creationSourceMatches(actual,expected),false);assert.equal(creationSourceMatches({...actual,items:[]},expected),false);
    const wand={type:'Player',items:[{type:'Wand',system:{spells:[{uuid:'Item.first',lost:false},{uuid:'Item.second',lost:true}]}}]},changed=copy(wand);
    changed.items[0].system.spells[0].uuid='Item.wrong';assert.equal(creationSourceMatches(changed,wand),false);
    const reordered=copy(wand);reordered.items[0].system.spells.reverse();assert.equal(creationSourceMatches(reordered,wand),false);
});
await check('recovery normalizes native v13/v14 effect shape while preserving authored extra change fields',async()=>{
    const expected={type:'Player',effects:[{name:'Native grant',changes:[{key:'system.abilities.str.value',mode:2,value:'2',priority:null,extra:'preserve'}]}]},actual={type:'Player',effects:[{_id:'nativeEffect',name:'Native grant',system:{changes:[{key:'system.abilities.str.value',type:'add',value:'2',priority:20,phase:'initial',extra:'preserve'}]}}]};
    assert.ok(creationSourceMatches(actual,expected));actual.effects[0].system.changes[0].extra='changed';assert.equal(creationSourceMatches(actual,expected),false);
});
await check('native v14 permanent duration migration settles saved creation without replay',async()=>{
    const d=base(),p=await ready(d);
    const legacy={combat:null,rounds:null,seconds:null,startRound:null,startTime:null,startTurn:null,turns:null};
    const effect=p.source.items.flatMap((item:any)=>item.effects??[])[0];assert.ok(effect);
    effect.duration=copy(legacy);
    const before=writeCount;transport='timeout';const dispatched=await dispatchCreator(req({}),'duration-migration',d,p);transport='ok';
    const actual=actors.get(`actor${writeCount}`);
    const saved=actual.items.flatMap((item:any)=>item.effects??[])[0];
    saved.duration={value:null,units:'seconds',expiry:null,expired:false};saved.start=null;
    assert.ok(creationSourceMatches(actual,p.source));
    for(const change of [{value:1},{units:'rounds'},{expiry:'turnStart'},{expired:true}]){
        const altered=copy(actual);Object.assign(altered.items.flatMap((item:any)=>item.effects??[])[0].duration,change);
        assert.equal(creationSourceMatches(altered,p.source),false);
    }
    const timed=copy(p.source);timed.items.flatMap((item:any)=>item.effects??[])[0].duration.rounds=1;
    assert.equal(creationSourceMatches(actual,timed),false);
    const started=copy(actual);started.items.flatMap((item:any)=>item.effects??[])[0].start={time:1};
    assert.equal(creationSourceMatches(started,p.source),false);
    assert.equal((await creatorOperationStatus(req({}),dispatched.requestId))?.state,'complete');
    await dispatchCreator(req({}),dispatched.requestId,d,p);assert.equal(writeCount,before+1);
    const next=await dispatchCreator(req({}),'after-duration-migration',d,p);assert.equal(next.state,'complete');assert.equal(writeCount,before+2);
});
await check('level awards and language/spell limits cannot be waived; no writes on invalid creation',async()=>{
    const before=writeCount;
    for(const mutate of [(d:CharacterDraft)=>d.backgroundUuid='',(d:CharacterDraft)=>d.alignment='',(d:CharacterDraft)=>d.classUuid=LEVEL_ZERO_CLASS,(d:CharacterDraft)=>d.awards.pop(),(d:CharacterDraft)=>d.awards.push({...d.awards[0],id:'extra'}),(d:CharacterDraft)=>d.awards[0].level=2,(d:CharacterDraft)=>d.languages.push(rows.find(r=>r.type==='Language'&&!sources.get(DWARF).system.languages.fixed.includes(r.uuid)).uuid)]){
        const d=base();mutate(d);let p=await prepareCreator(req({}),d);d.acknowledgements=p.warnings.map(w=>w.id);p=await prepareCreator(req({}),d);assert.equal(p.ready,false);assert.ok(p.errors.length>0);
        const response=await handleCreatorCreate(req({requestId:'invalid-rules',draft:d,review:p.review,contextRevision:revision}));assert.equal(response.status,400);
    }
    const zero=base(0);zero.backgroundUuid='';zero.alignment='';assert.ok((await prepareCreator(req({}),zero)).errors.filter(e=>e.step===1).length>=2);
    const wizard=base(1,WIZARD);await ready(wizard);wizard.spells.pop();assert.ok((await prepareCreator(req({}),wizard)).errors.some(e=>e.message.includes('Tier 1')));
    wizard.spells.push(...rows.filter(r=>r.type==='Spell'&&r.system.tier===1&&r.system.class.includes(WIZARD)&&!wizard.spells.some(s=>s.source===r.uuid)).slice(0,2).map(r=>({source:r.uuid,castingClass:WIZARD})));assert.ok((await prepareCreator(req({}),wizard)).errors.some(e=>e.message.includes('Tier 1')));
    assert.equal(writeCount,before);
});
await check('treasure/gems use bounded native shapes and notes retain sanitized rich text',async()=>{
    const d=base();d.valuables=[{id:'gem',kind:'gem',name:'Ruby',quantity:1,cost:{gp:50,sp:0,cp:0}},{id:'treasure',kind:'treasure',name:'Idol',quantity:1,cost:{gp:20,sp:5,cp:0}}];d.notes='<p><strong>History</strong></p><script>bad()</script>';
    const p=await ready(d);assert.equal(p.source.items.find((i:any)=>i.name==='Ruby').type,'Gem');assert.equal(p.source.items.find((i:any)=>i.name==='Idol').system.treasure,true);assert.match(p.source.system.notes,/<strong>History<\/strong>/);assert.doesNotMatch(p.source.system.notes,/script|bad\(\)/);
});
console.log(JSON.stringify({scope:'Offline real creator routes, planner, journal + public SDK/testing; not native acceptance',checks},null,2));
if(checks.some(c=>!c.pass))process.exitCode=1;
