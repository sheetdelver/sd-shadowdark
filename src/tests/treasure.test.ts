/** One useful delivery workflow, native payload parity, and bounded failure checks. */
import { emptyPotionRecipe } from '../logic/potion-treasure';
import { preparePotionAction } from '../logic/actions';
import { armorBases, emptyArmorRecipe, armorName } from '../logic/armor-treasure';
import assert from 'node:assert/strict';
import path from 'node:path';
import { emptyMundaneRecipe, originalSelection, mundaneName, mundaneValueTable, treasureValue } from '../logic/mundane';
import { MUNDANE_TABLES } from '../data/mundane-tables';
import { emptyBoonRecipe, boonName } from '../logic/boons';
import { BOON_EFFECT_PRESETS, buildBoonEffects, boonEffectErrors } from '../logic/boon-effects';
import { buildOwnedItemCard, buildDocumentCard } from '../logic/resource-cards';
import { emptyMagicRecipe, magicFixedFamily, magicTable, magicErrors, magicDescription } from '../logic/magic-attributes';
import { nativePacks } from './core0191/world';
import { DECLARED_PACKS } from '../logic/identity';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { worldSnapshot } from './fixtures/native-406';
import { emptyTreasureDraft, emptyWeaponRecipe, treasureFromTemplate, treasurePayload, treasureErrors, treasureFolder, treasureUnchanged, treasureTemplateAllowed, treasureResultValue } from '../logic/treasure';
import { shadowdarkAdapter as adapter } from '../server/ShadowdarkAdapter';
import { ITEM_NAME_TABLES, handleTreasureName, handleTreasureCatalog, handleTreasureDraw, handleTreasureOriginalDraw, handleTreasurePrepare, handleTreasureDeliver, handleTreasureStatus } from '../server/api/treasure';

assert.deepEqual(treasureResultValue('Bundle of five scales (5 gp each)'),{gp:'5',sp:'0',cp:'0'});
assert.deepEqual(treasureResultValue('Jeweled crown (1,000 gp)'),{gp:'1000',sp:'0',cp:'0'});
assert.deepEqual(treasureResultValue('A keepsake worth 2 gp and 5 sp'),{gp:'2',sp:'5',cp:'0'});
assert.deepEqual(treasureResultValue('10 cp in a wooden box'),{gp:'0',sp:'0',cp:'10'});
for (const text of ['Unpriced keepsake','Worth 10 gp or 20 gp','1d6 gp','Worth 5–10 gp','1d6 × 10 gp','Worth 1.5 gp']) assert.equal(treasureResultValue(text),null,text);
const packs = nativePacks(process.env.SHADOWDARK_NATIVE ?? path.resolve('temp/shadowdark'), DECLARED_PACKS.map(p=>p.id));
const rows: any[] = Object.entries(packs).flatMap(([pack,docs])=>docs.map(doc=>({...doc,pack,uuid:`Compendium.${pack}.${pack.endsWith('tables')?'RollTable':['Player','NPC'].includes(doc.type)?'Actor':'Item'}.${doc._id}`})));
const byUuid = new Map(rows.map(d=>[d.uuid,d]));
const compendium = { findAll:async()=>rows, getById:async(_type:string,uuid:string)=>structuredClone(byUuid.get(uuid)??null) };
const actor:any = {_id:'recipient',name:'Mira',type:'Player',items:[],system:{coins:{gp:5},level:{value:2,xp:3}}};
const library:any[]=[];const folders:any[]=[{_id:'combat-root',name:'SheetDelver',type:'Actor',folder:null}];let libraryWrites=0,folderWrites=0,libraryLost=false,hideAfterSave=false;
const store = new Map<string,any>(); let writes=0, lost=false, hidden=false, allowed=true;
const world={snapshot:()=>worldSnapshot(1),assertRevision:()=>{}};
const runtime:any={world,compendium,access:{canReadPack:()=>allowed,packs:()=>[]},
 dataStore:{get:async(k:string)=>structuredClone(store.get(k)??null),set:async(k:string,v:any)=>{store.set(k,structuredClone(v));}},
 rolls:{roll:async(formula:string,_title:string,options:any)=>{assert.equal(options.displayChat,false);return{total:1,formula};}},
 documents:{get:async(type:string,id:string)=>type==='Item'?structuredClone(library.find(d=>d._id===id)??null):hidden?null:structuredClone(actor),
 create:async(type:string,payload:any)=>{if(type==='Folder'){const doc={...structuredClone(payload),_id:`folder-${++folderWrites}`};folders.push(doc);return doc;}
 const doc={...structuredClone(payload),_id:`world-${++libraryWrites}`};library.push(doc);if(hideAfterSave)hidden=true;if(libraryLost)throw Error('Lost world save acknowledgement');return doc;},fetchByUuid:async(uuid:string)=>structuredClone(byUuid.get(uuid)??null),list:async(type:string)=>({rows:structuredClone(type==='Folder'?folders:type==='Item'?library:[actor]),total:1}),
 items:{create:async(_parent:any,payload:any)=>{writes++;const item={...structuredClone(payload),_id:`item-${writes}`};actor.items.push(item);if(lost)throw Error('Lost acknowledgement');return item;}}}};
await adapter.initialize({...runtime,logger:console} as any);
const req=(body:any={},gm=true,method='POST'):any=>({method,url:'http://offline/',headers:{},userSession:{userId:'gm',isGM:gm},getAccessContext:()=>({userId:'gm',isGM:gm}),runtime,json:async()=>body});
const call=async(fn:any,body:any={},gm=true,method='POST')=>{const r=await fn(req(body,gm,method));return{status:r.status??200,...await r.json()};};
const spell=rows.find(d=>d.type==='Spell')!;
const template=rows.find(d=>d.type==='Weapon' && d.effects?.length && d.system?.identification?.identified!==false)!;
assert.ok(template);
const draft=treasureFromTemplate(template);const original=structuredClone(template);
const payload=treasurePayload(draft,template,null);
assert.ok(template.img);assert.equal(payload.img,template.img);
assert.equal(treasurePayload({...emptyTreasureDraft(),name:'Keepsake'},null,null).img,'icons/containers/bags/pouch-simple-brown.webp');
assert.equal(treasurePayload({...emptyTreasureDraft(),kind:'Gem',name:'Stone'},null,null).img,'icons/commodities/gems/gem-faceted-navette-red.webp');
assert.deepEqual(payload.effects,template.effects);assert.equal(payload._stats.compendiumSource,template.uuid);assert.equal(payload._id,undefined);assert.deepEqual(template,original);
for(const kind of ['Scroll','Wand'] as const) {
 const d={...emptyTreasureDraft(),kind,name:`${kind} example`,spellUuid:spell.uuid};
 const p=treasurePayload(d,null,spell);
 assert.ok(spell.img);assert.equal(p.img,spell.img,`${kind} retains the selected spell icon`);
 if(kind==='Scroll') assert.equal(p.system.spellUuid,spell.uuid);
 else assert.deepEqual(p.system.spells,[{uuid:spell.uuid,lost:false}]);
}
assert.ok(treasureErrors({...draft,quantity:'0'}).quantity);
assert.ok(treasureErrors({...draft,gp:'1.5'}).gp);
assert.equal((await call(handleTreasureCatalog,{},false,'GET')).status,403);
assert.equal((await call(handleTreasureDeliver,{},false)).status,403);
const catalog=await call(handleTreasureCatalog,{},true,'GET');assert.ok(catalog.items.length>0);assert.ok(catalog.spells.some((s:any)=>s.uuid===spell.uuid));
assert.equal(catalog.namingAvailable,true);
const beforeName=structuredClone(actor), beforeNameStore=store.size;
const name=await call(handleTreasureName);
assert.equal(name.success,true,JSON.stringify(name));assert.equal(name.parts.length,3);
// Independent oracle: native macro concatenates one result from each table in order.
assert.deepEqual(name.parts,ITEM_NAME_TABLES.map(uuid=>{
 const table=byUuid.get(uuid)!;const row=table.results.find((r:any)=>r.range[0]<=1&&r.range[1]>=1);
 return row.description||row.text||row.name;
}));
assert.deepEqual(actor,beforeName);assert.equal(store.size,beforeNameStore);assert.equal(writes,0);assert.equal(libraryWrites,0);
assert.equal((await call(handleTreasureName,{},false)).status,403);
allowed=false;assert.equal((await call(handleTreasureName)).status,403);allowed=true;
const resolveName=adapter.resolveDocumentFor.bind(adapter);
adapter.resolveDocumentFor=async(uuid,caller)=>uuid===ITEM_NAME_TABLES[1]?null:resolveName(uuid,caller);
assert.equal((await call(handleTreasureName)).status,404);adapter.resolveDocumentFor=resolveName;
assert.equal(catalog.spells.find((s:any)=>s.uuid===spell.uuid).img,spell.img);
assert.equal(catalog.spells.find((s:any)=>s.uuid===spell.uuid).type,'Spell');
const table='Compendium.shadowdark.rollable-tables.RollTable.Pi9nnnLeXpTKCSMY';
const draw=await call(handleTreasureDraw,{uuid:table});assert.equal(draw.success,true,JSON.stringify(draw));assert.equal(draw.draw.total,1);assert.ok(draw.draw.results.length);
const manual={...emptyTreasureDraft(),name:'Externally rolled gem',description:'<p>A result entered by the GM.</p>',gp:'25',drawId:draw.draw.id,sourceNote:'Private source reference'};
const prep=await call(handleTreasurePrepare,{draft:manual,actorId:'recipient'});assert.ok(prep.plan.review,JSON.stringify(prep));assert.equal(writes,0);
const body={draft:manual,actorId:'recipient',review:prep.plan.review,requestId:'delivery-test-0001'};
assert.equal((await call(handleTreasureDeliver,{...body,review:'outdated-review'})).reviewChanged,true);assert.equal(writes,0);
const done=await call(handleTreasureDeliver,body);assert.equal(done.operation.state,'complete');assert.equal(writes,1);
await call(handleTreasureDeliver,body);assert.equal(writes,1);
assert.equal(JSON.stringify(actor.items).includes('Private source reference'),false);assert.deepEqual(actor.system,{coins:{gp:5},level:{value:2,xp:3}});
const second={...manual,name:'Wand of a selected spell',kind:'Wand' as const,spellUuid:spell.uuid,drawId:''};
const p2=await call(handleTreasurePrepare,{draft:second,actorId:'recipient'});
lost=true;const b2={...body,draft:second,review:p2.plan.review,requestId:'delivery-test-0002'};
assert.equal((await call(handleTreasureDeliver,b2)).operation.state,'dispatched');assert.equal(writes,2);
hidden=true;assert.equal((await call(handleTreasureStatus,{},true,'GET')).status,404);assert.equal(writes,2);
hidden=false;const recovered=await call(handleTreasureStatus,{},true,'GET');assert.equal(recovered.operation.state,'complete');assert.equal(writes,2);
assert.equal(actor.items[1].img,spell.img,'Delivered item retains its source icon');
await call(handleTreasureDeliver,b2);assert.equal(writes,2);
allowed=false;assert.equal((await call(handleTreasurePrepare,{draft:second,actorId:'recipient'})).status,403);assert.equal(writes,2);
// Status for a particular delivery must not return an older successful operation.
const statusReq=req({},true,'GET');statusReq.url='http://offline/treasure/status?requestId=not-yet-received';
assert.equal((await (await handleTreasureStatus(statusReq)).json() as any).operation,null);
console.log('Treasure: native template/scroll/wand shapes, available table, manual delivery, GM/access gates, and lost-ack recovery passed.');

// One weapon recipe travels through world saving, folder reuse and separate assignment.
allowed=true;lost=false;
const weapon={...treasureFromTemplate(template),category:'weapons' as const,weapon:{...emptyWeaponRecipe(),bonus:'2',feature:'Silver pommel',benefits:['Warns of nearby danger (GM adjudicates)'],virtues:['Protective of its wielder']}};
const wp=treasurePayload(weapon,template,null);
assert.deepEqual(wp.system.damage,template.system.damage);assert.equal(wp.effects.length,template.effects.length+1);
assert.deepEqual(wp.effects.at(-1).changes.map((c:any)=>[c.key,c.value]),[['system.roll.attack.bonus.this','2'],['system.roll.attack.damage.this','2']]);
assert.ok(wp.system.description.includes('Benefit (manual)'));assert.ok(treasureErrors({...weapon,weapon:{...weapon.weapon,benefits:['']}})['benefits.0']);
const saveBody=async(d:any,id:string,actorId='')=>{const p=await call(handleTreasurePrepare,{draft:d,actorId,saveToLibrary:true});assert.ok(p.plan.review,JSON.stringify(p));return{draft:d,actorId,saveToLibrary:true,review:p.plan.review,requestId:id};};
const firstSave=await saveBody(weapon,'world-save-0001');
const saved=await call(handleTreasureDeliver,firstSave);assert.equal(saved.operation.state,'complete',JSON.stringify(saved));assert.equal(libraryWrites,1);assert.equal(folderWrites,2);assert.equal(writes,2);
const root=folders.find(d=>d.type==='Item'&&d.folder===null)!;
const child=folders.find(d=>d.folder===root._id)!;assert.equal(child.name,'Weapons');assert.equal(library[0].folder,child._id);assert.equal(library[0].ownership.default,0);
await call(handleTreasureDeliver,firstSave);assert.equal(libraryWrites,1);
// A lost world-save response is read back and then assignment resumes without another world create.
const secondSave=await saveBody({...weapon,name:'Second weapon'},'world-save-0002','recipient');libraryLost=true;
assert.equal((await call(handleTreasureDeliver,secondSave)).operation.state,'saving');assert.equal(writes,2);
assert.equal((await call(handleTreasureStatus,{},true,'GET')).operation.state,'saved');
libraryLost=false;
const assigned=await call(handleTreasureDeliver,{requestId:secondSave.requestId,resume:true});assert.equal(assigned.operation.state,'complete',JSON.stringify(assigned));
assert.equal(libraryWrites,2);assert.equal(folderWrites,2);assert.equal(writes,3);assert.equal(actor.items.at(-1).folder,undefined);assert.equal(actor.items.at(-1).ownership,undefined);
// A permission failure before assignment preserves the saved original for an authorized retry.
const thirdSave=await saveBody({...weapon,name:'Third weapon'},'world-save-0003','recipient');hideAfterSave=true;
assert.equal((await call(handleTreasureDeliver,thirdSave)).status,404);assert.equal(libraryWrites,3);assert.equal(writes,3);
hidden=false;hideAfterSave=false;lost=true;
assert.equal((await call(handleTreasureDeliver,{requestId:thirdSave.requestId,resume:true})).operation.state,'assigning');
assert.equal((await call(handleTreasureStatus,{},true,'GET')).operation.state,'complete');assert.equal(writes,4);assert.equal(libraryWrites,3);
assert.equal((await call(handleTreasureDeliver,{requestId:thirdSave.requestId,resume:true})).operation.state,'complete');assert.equal(writes,4);
console.log('Library: weapon parts/native bonus, typed folders, save-only, separate assignment, permission retry and lost-ack readback passed.');

// Unedited native content is assignment-only, including a weapon with empty recipe parts.
lost=false;
const plain={...treasureFromTemplate(template),category:'weapons' as const,weapon:emptyWeaponRecipe()};
assert.equal(treasureUnchanged(plain,template),true);
assert.equal(treasureUnchanged({...plain,sourceNote:'Private note',drawId:'reference'},template),true);
assert.equal(treasureUnchanged({...plain,gp:String(Number(plain.gp)+1)},template),false);
assert.equal(treasureUnchanged({...plain,name:'Changed'},template),false);
const edited={...plain,name:'Changed'};edited.name=template.name;
assert.equal(treasureUnchanged(edited,template),true);
assert.equal(treasureUnchanged(weapon,template),false);
const priced=rows.filter(d=>['Weapon','Armor','Basic','Potion','Scroll','Wand','Gem'].includes(d.type)&&Object.values(d.system?.cost??{}).some(v=>Number(v)>0));
assert.ok(priced.length);
for(const source of priced) {
 const option=catalog.items.find((d:any)=>d.uuid===source.uuid);if(!option)continue;
 const defaults=treasureFromTemplate(option);
 for(const unit of ['gp','sp','cp'] as const) assert.equal(defaults[unit],String(source.system.cost[unit]??0));
}
const legacyScroll=rows.find(d=>d.uuid==='Compendium.shadowdark.magic-items.Item.N27A6nb0epkHZ3lR')!;
assert.ok(legacyScroll);assert.equal(treasureTemplateAllowed('magic',legacyScroll),false);assert.equal(treasureTemplateAllowed('scrolls',legacyScroll),true);
const legacyWand=rows.find(d=>d.name==='Wand of Unlife')!;
assert.equal(treasureFolder(plain,legacyScroll),'Scrolls');
assert.equal(treasureFolder(plain,legacyWand),'Wands');
assert.ok(legacyWand);assert.equal(treasureTemplateAllowed('magic',legacyWand),false);assert.equal(treasureTemplateAllowed('scrolls',legacyWand),true);
const noRecipient=await call(handleTreasurePrepare,{draft:plain,actorId:'',saveToLibrary:true});
assert.ok(noRecipient.plan.errors.actorId);
const counts={library:libraryWrites,folders:folderWrites,items:writes};
const direct=await saveBody(plain,'unchanged-source-0001','recipient');
lost=true;const pending=await call(handleTreasureDeliver,direct);
assert.equal(pending.operation.unchangedSource,true);assert.equal(pending.operation.state,'assigning');
assert.equal(libraryWrites,counts.library);assert.equal(folderWrites,counts.folders);assert.equal(writes,counts.items+1);
assert.equal((await call(handleTreasureStatus,{},true,'GET')).operation.state,'complete');
assert.equal((await call(handleTreasureDeliver,direct)).operation.state,'complete');assert.equal(writes,counts.items+1);
assert.equal(actor.items.at(-1)._stats.compendiumSource,template.uuid);
assert.deepEqual(actor.items.at(-1).system.cost,treasurePayload(plain,template,null).system.cost);
console.log('Source reuse: unchanged assignment without library/folder writes, modification/reversion, native prices, legacy scroll/wand categories and lost-ack recovery passed.');

// Original tables: representative nested luxury flow, native Gem delivery and jewelry routing.
lost=false;hidden=false;hideAfterSave=false;libraryLost=false;allowed=true;
for(const [id,t] of Object.entries(MUNDANE_TABLES)) {
 assert.equal(new Set(t.rows.map(r=>r.id)).size,t.rows.length,id);
 assert.ok(t.rows.length>1,id);
 for(const row of t.rows)if(row.followUp)assert.ok(MUNDANE_TABLES[row.followUp],row.followUp);
}
const rolled=await call(handleTreasureOriginalDraw,{table:'gem-identity',version:1});
assert.equal(rolled.success,true);assert.equal(rolled.part.text,'Moss agate');assert.equal(rolled.part.source.total,1);
assert.equal((await call(handleTreasureOriginalDraw,{table:'gem-identity',version:1},false)).status,403);
assert.equal((await call(handleTreasureOriginalDraw,{table:'constructor',version:1})).status,400);
let m={...emptyMundaneRecipe(),form:originalSelection('luxury-form','puzzle-casket'),material:originalSelection('workmanship','brass-mesh')};
let md={...emptyTreasureDraft(),category:'mundane' as const,mundane:m,name:mundaneName(m)};
assert.ok(treasureErrors(md)['mundane.detail']);
m={...m,detail:originalSelection('casket-detail','drawers'),detailFor:m.form.text};
md={...md,mundane:m};assert.deepEqual(treasureErrors(md),{});
const luxuryPayload=treasurePayload(md,null,null);assert.equal(luxuryPayload.type,'Basic');assert.match(luxuryPayload.system.description,/Three slender drawers/);
const changedForm={...m,form:originalSelection('luxury-form','seal-press')};
assert.ok(treasureErrors({...md,mundane:changedForm})['mundane.detail'],'changing parent retains but invalidates its old detail');
const gemPrice=await call(handleTreasureOriginalDraw,{table:mundaneValueTable(emptyMundaneRecipe('gemstone')),version:1});
assert.equal(gemPrice.part.text,'40 GP');
const gemRecipe={...emptyMundaneRecipe('gemstone'),form:rolled.part,material:originalSelection('gem-finish','kite'),feature:{text:'A <script> is only literal author text.'}};
const gem={...emptyTreasureDraft(),category:'mundane' as const,kind:'Gem' as const,mundane:gemRecipe,name:mundaneName(gemRecipe),gp:'18',quantity:'3'};
assert.equal(treasureValue(gem,true),'54 GP · 0 SP · 0 CP');
assert.equal(treasureValue({...gem,gp:''},true),'—');
const gemBody=await saveBody(gem,'mundane-gem-0001','recipient');
const gemSaved=await call(handleTreasureDeliver,gemBody);assert.equal(gemSaved.operation.state,'complete');assert.equal(gemSaved.operation.folderName,'Gems & Jewelry');
assert.equal(actor.items.at(-1).type,'Gem');assert.equal(actor.items.at(-1).system.quantity,3);
assert.deepEqual(actor.items.at(-1).system.cost,{gp:18,sp:0,cp:0});assert.match(actor.items.at(-1).system.description,/Unique feature/);
assert.doesNotMatch(actor.items.at(-1).system.description,/<script>/);assert.deepEqual(actor.system,{coins:{gp:5},level:{value:2,xp:3}});
assert.ok([...store.values()].some(v=>v?.provenance?.mundane?.form?.source?.table==='gem-identity'));
const jewelryRecipe={...emptyMundaneRecipe('jewelry'),form:originalSelection('jewelry-form','ear-cuff')};
const jewelry={...emptyTreasureDraft(),category:'mundane' as const,mundane:jewelryRecipe,name:mundaneName(jewelryRecipe)};
const jewelryDone=await call(handleTreasureDeliver,await saveBody(jewelry,'mundane-jewelry-0001'));
assert.equal(jewelryDone.operation.folderName,'Gems & Jewelry');assert.equal(library.at(-1).type,'Basic');
console.log('Mundane Items: original SDK draws, dependent detail validation, native Gem save/assign, descriptive features, quantity totals and jewelry folders passed.');

// Native BoonSD shape: BaseItemSD description + boonType/level; never physical fields.
const boonDraw=await call(handleTreasureOriginalDraw,{table:'boon-oath',version:1});
assert.equal(boonDraw.success,true);assert.equal(boonDraw.part.source.table,'boon-oath');
const oathRecipe={...emptyBoonRecipe(),oath:boonDraw.part,level:'4'};
const oath={...emptyTreasureDraft(),category:'boons' as const,kind:'Boon' as const,boon:oathRecipe,name:'The ferrymaster’s promise'};
const oathPayload=treasurePayload(oath,null,null);
assert.deepEqual(Object.keys(oathPayload.system).sort(),['boonType','description','level']);
assert.equal(oathPayload.system.boonType,'oath');assert.equal(oathPayload.system.level,4);assert.deepEqual(oathPayload.effects,[]);
assert.equal(treasureFolder(oath,oathPayload),'Boons');
assert.ok(treasureErrors({...oath,boon:{...oathRecipe,path:'secret'}})['boon.detail']);
assert.ok(treasureErrors({...oath,boon:{...oathRecipe,level:'11'}})['boon.level']);
assert.ok(treasureErrors({...oath,category:'mundane'}).kind);
const actorBefore=structuredClone(actor.system), writesBefore=writes, savesBefore=libraryWrites;
const oathBody=await saveBody(oath,'boon-oath-save-0001','recipient');libraryLost=true;
assert.equal((await call(handleTreasureDeliver,oathBody)).operation.state,'saving');
assert.equal((await call(handleTreasureStatus,{},true,'GET')).operation.state,'saved');libraryLost=false;
assert.equal((await call(handleTreasureDeliver,{requestId:oathBody.requestId,resume:true})).operation.state,'complete');
await call(handleTreasureDeliver,{requestId:oathBody.requestId,resume:true});
assert.equal(libraryWrites,savesBefore+1);assert.equal(writes,writesBefore+1);
assert.equal(actor.items.at(-1).type,'Boon');assert.deepEqual(actor.system,actorBefore);
assert.equal(folders.find(f=>f._id===library.at(-1).folder)?.name,'Boons');
const secretRecipe={...emptyBoonRecipe(),path:'secret' as const,detail:originalSelection('boon-secret-detail','ledger'),subject:{text:'the <script>courier</script>'}};
const secret={...oath,boon:secretRecipe,name:boonName(secretRecipe)};
const secretPayload=treasurePayload(secret,null,null);assert.match(secretPayload.system.description,/duplicate ledger/);assert.match(secretPayload.system.description,/&lt;script&gt;/);
assert.equal((await call(handleTreasureDeliver,await saveBody(secret,'boon-secret-save-0001'))).operation.state,'complete');
const blessingRecipe={...emptyBoonRecipe(),path:'blessing' as const,benefit:originalSelection('boon-blessing','thread'),limits:'Until sunrise; adjudicated by the GM.'};
const blessing={...oath,boon:blessingRecipe,name:boonName(blessingRecipe)};
const blessingPayload=treasurePayload(blessing,null,null);assert.match(blessingPayload.system.description,/Until sunrise/);assert.deepEqual(blessingPayload.effects,[]);
const boonCard=buildDocumentCard(blessingPayload,null);assert.ok(boonCard.facts.some(f=>f.label==='Boon'&&f.value==='blessing'));assert.deepEqual(boonCard.actions,[]);
assert.equal((await call(handleTreasureDeliver,await saveBody(blessing,'boon-blessing-save-0001','recipient'))).operation.state,'complete');
assert.equal(actor.items.at(-1).system.boonType,'blessing');assert.deepEqual(actor.system,actorBefore);
console.log('Boons: oath/secret/blessing parts, native nonphysical shape, level validation, escaping, folder/save/assign and lost-ack recovery passed.');

const acBoonDefinition=BOON_EFFECT_PRESETS.find(([id])=>id==='acBonus')![1];
const boonEffect={key:acBoonDefinition.key,type:acBoonDefinition.mode,value:'2',label:'Protective blessing',icon:acBoonDefinition.icon};
const effectBoon={...blessing,boon:{...blessing.boon,effects:[boonEffect]}};
const effectBoonPayload=treasurePayload(effectBoon,null,null);
assert.equal(effectBoonPayload.effects[0].changes[0].key,'system.attributes.ac.value');
assert.equal(effectBoonPayload.effects[0].changes[0].value,'2');assert.equal(effectBoonPayload.effects[0].transfer,true);
assert.equal(effectBoonPayload.effects[0].disabled,false);assert.equal(effectBoonPayload.system.magicItem,undefined);
assert.ok(buildDocumentCard(effectBoonPayload,null).sections.some(s=>s.entries.some(e=>e.title==='Protective blessing')));
for(const row of [{...boonEffect,key:'system.REPLACEME'},{...boonEffect,type:99},{...boonEffect,label:''},{...boonEffect,disabled:'yes' as any}]){
 assert.ok(Object.keys(boonEffectErrors([row])).length);assert.throws(()=>buildBoonEffects([row],'Invalid'));
 const rejected=await call(handleTreasurePrepare,{draft:{...effectBoon,boon:{...effectBoon.boon,effects:[row]}},saveToLibrary:true});
 assert.ok(Object.keys(rejected.plan.errors).some(k=>k.startsWith('boon.effects.')));
}
const effectBoonBody=await saveBody(effectBoon,'boon-effects-save-0001','recipient');
const effectSaves=libraryWrites,effectWrites=writes;
await call(handleTreasureDeliver,effectBoonBody);await call(handleTreasureDeliver,effectBoonBody);
assert.equal(libraryWrites,effectSaves+1);assert.equal(writes,effectWrites+1);
assert.deepEqual(library.at(-1).effects,effectBoonPayload.effects);assert.deepEqual(actor.items.at(-1).effects,effectBoonPayload.effects);
const effectActor={_id:'blessed',type:'Player',system:{abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(key=>[key,{value:10}])),attributes:{hp:{value:4,max:4}},level:{value:1}},effects:[],items:[{...effectBoonPayload,_id:'blessing'}]};
assert.equal(prepareShadowdarkView(effectActor).ac,12,'Boon transfers its configured AC bonus without equipment fields');
effectActor.items[0].effects[0].disabled=true;
assert.equal(prepareShadowdarkView(effectActor).ac,10,'Disabled boon effect does not apply');
const changedBoon=structuredClone(effectBoon);changedBoon.boon.effects[0].value='3';
assert.equal((await call(handleTreasureDeliver,{...effectBoonBody,requestId:'boon-effects-stale-review',draft:changedBoon})).reviewChanged,true);
assert.equal(libraryWrites,effectSaves+1);assert.equal(writes,effectWrites+1);

// Shared additives use actual property results, independent switches and native bases.
const propertyRoll=await call(handleTreasureOriginalDraw,{table:'weapon-benefits',version:1});
assert.equal(propertyRoll.success,true);
assert.equal(magicFixedFamily('weapons',template),'weapon');
assert.equal(magicFixedFamily('random',{type:'Armor'}),'armor');
assert.equal(magicFixedFamily('potions'),'potion');
assert.equal(magicFixedFamily('mundane',null,'Gem'),'utility');
assert.equal(magicFixedFamily('random',legacyWand),'wand');
assert.equal(magicFixedFamily('scrolls'),undefined);
assert.equal(magicTable('armor','virtues'),magicTable('weapon','virtues'));
let magic={...emptyMagicRecipe(),attributesEnabled:true,benefits:[originalSelection('weapon-benefits','mark')],curses:[{text:'Cannot be concealed from its former owner.'}]};
assert.ok(magicErrors({...magic,benefits:[{text:''}]})['magic.benefits.0']);
assert.ok(magicErrors({...magic,benefits:[originalSelection('personality-virtues','names')]})['magic.benefits.0']);
assert.deepEqual(magicErrors({...magic,attributesEnabled:false,benefits:[{text:''}]}),{});
magic={...magic,personalityEnabled:true,virtues:[originalSelection('personality-virtues','fairness')],flaws:[{text:'Vain <script>.'}],trait:'Speaks in questions.',alignment:'Neutral'};
assert.deepEqual(magicErrors(magic),{});
assert.ok(magicErrors({...magic,trait:''})['magic.trait']);
assert.doesNotMatch(magicDescription({...magic,attributesEnabled:false}),/identifying mark/);
assert.match(magicDescription({...magic,attributesEnabled:false}),/Speaks in questions/);
assert.doesNotMatch(magicDescription({...magic,personalityEnabled:false}),/Speaks in questions/);
assert.match(magicDescription(magic),/&lt;script&gt;/);
const enchanted={...treasureFromTemplate(template),category:'magic' as const,magic};
const nativeOriginal=structuredClone(template),enchantedPayload=treasurePayload(enchanted,template,null);
assert.deepEqual(enchantedPayload.effects,template.effects);assert.equal(enchantedPayload.img,template.img);assert.deepEqual(template,nativeOriginal);
assert.equal(enchantedPayload.name,template.name);
assert.equal(enchantedPayload.system.magicItem,true);
assert.equal(treasureUnchanged(enchanted,template),false);
assert.equal(treasureUnchanged({...enchanted,magic:{...magic,attributesEnabled:false,personalityEnabled:false}},template),true);
assert.equal(treasureUnchanged({...enchanted,magic:{...emptyMagicRecipe(),attributesEnabled:true}},template),true);
const magicBody=await saveBody(enchanted,'magic-attributes-0001','recipient');
const magicWrites=writes,magicSaves=libraryWrites;
assert.equal((await call(handleTreasureDeliver,magicBody)).operation.state,'complete');await call(handleTreasureDeliver,magicBody);
assert.equal(writes,magicWrites+1);assert.equal(libraryWrites,magicSaves+1);assert.deepEqual(actor.items.at(-1).effects,template.effects);
assert.deepEqual(actor.system,actorBefore);
for (const extra of [magic,{...magic,attributesEnabled:false},{...magic,personalityEnabled:false}]) {
 const invalid={...blessing,magic:extra};
 assert.ok(treasureErrors(invalid)['magic.enabled'],'Boons reject item Attributes and Personality');
 assert.throws(()=>treasurePayload(invalid,null,null));
 const rejected=await call(handleTreasurePrepare,{draft:invalid,saveToLibrary:true});
 assert.ok(rejected.plan.errors['magic.enabled']);
}
assert.deepEqual(treasurePayload({...blessing,magic:{...magic,attributesEnabled:false,personalityEnabled:false}},null,null),blessingPayload,'Disabled legacy item extras never enter a boon description');
console.log('Shared additives: contextual tables, independent sections, validation, native preservation and exact save/assignment passed.');

// Armor uses native gear types, not invented AC/slots or a second AC effect.
const bases=armorBases(rows);assert.equal(bases.length,7);
const plate=bases.find(d=>d._id==='o0261gnDqGC5hQB1')!;
const shield=bases.find(d=>d._id==='UWp4WkkiaBMSXYPE')!;
const mithral=bases.find(d=>d._id==='UDyHeJCreIFZ9y2I')!;
const nativeArmor=rows.find(d=>d.name==='Ophidian Armor')!;
assert.equal(armorBases([nativeArmor]).length,0);
const armorRoll=await call(handleTreasureOriginalDraw,{table:'armor-type',version:1});
assert.equal(armorRoll.armorType.uuid,bases[0].uuid);
assert.equal((await call(handleTreasureOriginalDraw,{table:'armor-type',version:1},false)).status,403);
const recipe={...emptyArmorRecipe(),bonus:'2',feature:originalSelection('armor-feature','map')};
const armorDraft={...treasureFromTemplate(plate),category:'armor' as const,armor:recipe,name:armorName(plate,recipe.bonus)};
const plateBefore=structuredClone(plate),armorPayload=treasurePayload(armorDraft,plate,null);
assert.equal(armorPayload.system.ac.base,15);assert.equal(armorPayload.system.ac.attribute,'');assert.equal(armorPayload.system.ac.modifier,2);
assert.equal(armorPayload.system.baseArmor,'plate-mail');assert.equal(armorPayload.system.magicItem,true);
assert.deepEqual(armorPayload.system.properties,plate.system.properties);assert.deepEqual(armorPayload.system.slots,plate.system.slots);
assert.deepEqual(armorPayload.effects,plate.effects);assert.equal(armorPayload.img,plate.img);assert.deepEqual(plate,plateBefore);
assert.equal(buildDocumentCard(armorPayload,null).facts.find(f=>f.label==='AC')?.value,'15 +2');
assert.equal(armorPayload.system.cost.gp,130);assert.match(armorPayload.system.description,/vanished city/);
const shieldPayload=treasurePayload({...armorDraft,...treasureFromTemplate(shield),name:armorName(shield,'2')},shield,null);
assert.equal(shieldPayload.system.ac.modifier,4,'native shield +2 plus the selected +2, without adding a second effect');
assert.deepEqual(shieldPayload.effects,shield.effects);
const mithralPayload=treasurePayload({...armorDraft,...treasureFromTemplate(mithral)},mithral,null);
assert.equal(mithralPayload.system.baseArmor,'chainmail');assert.equal(mithralPayload.system.slots.slots_used,1);
const nativeDraft={...treasureFromTemplate(nativeArmor),category:'armor' as const,armor:emptyArmorRecipe('existing')};
assert.equal(treasureUnchanged(nativeDraft,nativeArmor),true);
assert.deepEqual(treasurePayload(nativeDraft,nativeArmor,null).effects,nativeArmor.effects);
assert.deepEqual(treasurePayload(nativeDraft,nativeArmor,null).system.ac,nativeArmor.system.ac);
assert.throws(()=>treasurePayload({...nativeDraft,armor:recipe},nativeArmor,null),/available armor type/);
assert.ok(treasureErrors({...armorDraft,armor:{...recipe,bonus:'4'}})['armor.bonus']);
assert.ok(treasureErrors({...armorDraft,armor:{...recipe,feature:{text:''}}})['armor.feature']);
const beforeArmorWrites=writes,beforeArmorSaves=libraryWrites;
const armorBody=await saveBody(armorDraft,'armor-library-0001','recipient');
assert.equal((await call(handleTreasureDeliver,armorBody)).operation.state,'complete');await call(handleTreasureDeliver,armorBody);
assert.equal(writes,beforeArmorWrites+1);assert.equal(libraryWrites,beforeArmorSaves+1);
assert.equal(actor.items.at(-1).system.ac.modifier,2);assert.equal(actor.items.at(-1).img,plate.img);
assert.deepEqual(actor.system,actorBefore);
console.log('Armor: native type rolls, AC/shield bonus, mithral fields, native reuse, validation and exact library/assignment passed.');

// New potions have the native consumable type; appearance never creates mechanics.
const potionRecipe={...emptyPotionRecipe(),first:originalSelection('potion-feature-first','pearl'),second:originalSelection('potion-feature-second','key'),third:{text:'Label <script>.'}};
const newPotion={...emptyTreasureDraft(),category:'potions' as const,kind:'Potion' as const,name:'Wayfarer’s Draught',potion:potionRecipe,
 magic:{...emptyMagicRecipe(),attributesEnabled:true,family:'potion' as const,benefits:[originalSelection('potion-benefits','thread')]}};
const potionPayload=treasurePayload(newPotion,null,null);
assert.equal(potionPayload.type,'Potion');assert.equal(potionPayload.system.magicItem,true);
assert.equal(potionPayload.img,'icons/consumables/potions/bottle-corked-red.webp');assert.deepEqual(potionPayload.effects,[]);
assert.equal(potionPayload.system.formula,undefined);assert.equal(potionPayload.system.spellUuid,undefined);
assert.match(potionPayload.system.description,/Potion feature 3/);assert.match(potionPayload.system.description,/&lt;script&gt;/);assert.match(potionPayload.system.description,/silver thread/);
assert.equal(preparePotionAction({kind:'Player'} as any,{...potionPayload,_id:'made-potion'}).kind,'potion');
assert.ok(treasureErrors({...newPotion,potion:{...potionRecipe,second:{text:''}}})['potion.second']);
assert.ok(treasureErrors({...newPotion,potion:{...potionRecipe,first:originalSelection('armor-feature','map')}})['potion.first']);
assert.ok(treasureErrors({...newPotion,category:'random'})['potion.mode']);
const potionBefore=writes,potionSaves=libraryWrites;
const potionBody=await saveBody(newPotion,'potion-library-0001','recipient');
assert.equal((await call(handleTreasureDeliver,potionBody)).operation.state,'complete');await call(handleTreasureDeliver,potionBody);
assert.equal(writes,potionBefore+1);assert.equal(libraryWrites,potionSaves+1);
assert.equal(actor.items.at(-1).type,'Potion');assert.deepEqual(actor.system,actorBefore);
const nativePotion=rows.find(d=>d.type==='Potion'&&d.effects.length)??rows.find(d=>d.type==='Potion');assert.ok(nativePotion);
const reusedPotion={...treasureFromTemplate(nativePotion),category:'potions' as const,potion:emptyPotionRecipe('existing')};
assert.equal(treasureUnchanged(reusedPotion,nativePotion),true);
const reusedPayload=treasurePayload(reusedPotion,nativePotion,null);
assert.equal(reusedPayload.img,nativePotion.img);assert.deepEqual(reusedPayload.effects,nativePotion.effects);
assert.deepEqual(reusedPayload.system.cost,nativePotion.system.cost);assert.equal(reusedPayload.system.formula,nativePotion.system.formula);
console.log('Potions: independent features, native consumable payload/icon, manual properties, exact reuse and save/assignment passed.');

// Remaining procedures resolve exact native bases/spells and persistent modifiers.
const { emptyUtilityRecipe, emptySpellItemRecipe, weaponBases, tierSpells }=await import('../logic/treasure-procedures');
const { prepareActorCore }=await import('../logic/actor-preparation');
const { prepareWeaponAttack }=await import('../logic/weapon-rules');
const { modifierErrors }=await import('../logic/treasure-modifiers');
const utilityDraft={...emptyTreasureDraft(),category:'utility' as const,name:'Surveyor’s compass',
 utility:{...emptyUtilityRecipe(),form:originalSelection('utility-form','compass'),feature:originalSelection('utility-feature','seams')},
 modifiers:[{id:'acBonus' as const,value:'2'},{id:'abilityImprovementStr' as const,value:'2'},{id:'initAdvantage' as const,value:'1'}]};
const utilityPayload=treasurePayload(utilityDraft,null,null);
assert.equal(utilityPayload.type,'Basic');assert.equal(utilityPayload.system.treasure,false);assert.equal(utilityPayload.system.magicItem,true);
assert.equal(utilityPayload.img,'icons/tools/navigation/compass-brass-blue-red.webp');
assert.equal(utilityPayload.effects.length,3);assert.equal(utilityPayload.effects[0].changes[0].key,'system.attributes.ac.value');
assert.equal(utilityPayload.effects[0].changes[0].value,'2');assert.equal(utilityPayload.effects[0].transfer,true);
assert.equal(utilityPayload.effects[0].duration.seconds,null);
assert.ok(treasureErrors({...utilityDraft,utility:{...utilityDraft.utility,feature:originalSelection('weapon-feature','wax')}})['utility.feature']);
const editedForm=treasurePayload({...utilityDraft,utility:{...utilityDraft.utility,form:{...utilityDraft.utility.form,text:'Custom form'}}},null,null);
assert.equal(editedForm.img,'icons/containers/bags/pouch-simple-brown.webp','edited form must not claim a mismatched generated icon');
const mechanicalActor={_id:'mechanical',type:'Player',system:{abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(key=>[key,{value:10}])),attributes:{hp:{value:4,max:4}},level:{value:1}},effects:[],items:[{...utilityPayload,_id:'utility'}]};
let preparedUtility=prepareActorCore(mechanicalActor);
assert.equal(preparedUtility.ac,12);assert.equal(preparedUtility.abilities.str.value,12);assert.equal(preparedUtility.initiative.advantage,1);
for(const system of [{stashed:true},{identification:{identified:false}}]){
 const inactive=prepareActorCore({...mechanicalActor,items:[{...utilityPayload,system:{...utilityPayload.system,...system},_id:'utility'}]});
 assert.equal(inactive.ac,10);assert.equal(inactive.abilities.str.value,10);assert.equal(inactive.initiative.advantage,0);
}
assert.ok(modifierErrors([{id:'acBonus',value:'0'}],'Basic')['modifiers.0']);
assert.ok(modifierErrors([{id:'acBonus',value:'2'},{id:'acBonus',value:'1'}],'Basic')['modifiers.1']);
assert.ok(modifierErrors([{id:'arbitrary.key' as any,value:'2'}],'Basic')['modifiers.0']);
assert.ok(treasureErrors({...newPotion,modifiers:utilityDraft.modifiers}).modifiers);
assert.throws(()=>treasurePayload({...reusedPotion,modifiers:utilityDraft.modifiers},nativePotion,null),/permanent modifiers/);
const utilityWrite=await saveBody(utilityDraft,'utility-built-0001','recipient');const uWrites=writes,uSaves=libraryWrites;
await call(handleTreasureDeliver,utilityWrite);await call(handleTreasureDeliver,utilityWrite);
assert.equal(writes,uWrites+1);assert.equal(libraryWrites,uSaves+1);assert.equal(actor.items.at(-1).effects.length,3);assert.deepEqual(actor.system,actorBefore);

const weaponBaseRows=weaponBases(rows);assert.ok(weaponBaseRows.some(i=>i.type==='Weapon'));assert.ok(weaponBaseRows.some(i=>i.system.isAmmunition));
const weaponBase=weaponBaseRows.find(i=>i.type==='Weapon'&&i.system.damage.oneHanded==='d8')??weaponBaseRows.find(i=>i.type==='Weapon');
const builtWeapon={...treasureFromTemplate(weaponBase),category:'weapons' as const,name:'Etched weapon',weapon:{...emptyWeaponRecipe(),mode:'build' as const,bonus:'2',featurePart:originalSelection('weapon-feature','script')}};
const builtWeaponPayload=treasurePayload(builtWeapon,weaponBase,null);
assert.deepEqual(builtWeaponPayload.system.damage,weaponBase.system.damage);assert.equal(builtWeaponPayload.img,weaponBase.img);assert.ok(builtWeaponPayload.system.baseWeapon);
assert.equal(builtWeaponPayload.effects.at(-1).changes.length,2);
const ownedWeapon={...builtWeaponPayload,_id:'weapon',system:{...builtWeaponPayload.system,equipped:true}};
const plainWeapon={...structuredClone(ownedWeapon),effects:weaponBase.effects};
const baseAttack=prepareWeaponAttack({...mechanicalActor,items:[plainWeapon]},plainWeapon);
const boostedAttack=prepareWeaponAttack({...mechanicalActor,items:[ownedWeapon]},ownedWeapon);
assert.equal(boostedAttack.toHit-baseAttack.toHit,2);assert.match(boostedAttack.damage!,/2/);
const armored=treasurePayload({...armorDraft,modifiers:[{id:'acBonus',value:'2'}]},plate,null);
const equippedArmor={...armored,_id:'armor',system:{...armored.system,equipped:true}};
assert.equal(prepareActorCore({...mechanicalActor,items:[equippedArmor]}).ac,19,'native plate 15 + armor bonus2 + separately selected effect2, each once');
assert.equal(prepareActorCore({...mechanicalActor,items:[{...equippedArmor,system:{...equippedArmor.system,equipped:false}}]}).ac,10);
const ammo=weaponBaseRows.find(i=>i.type==='Basic'&&i.system.isAmmunition);const ammoDraft={...treasureFromTemplate(ammo),category:'weapons' as const,weapon:builtWeapon.weapon,quantity:'7'};
const ammoPayload=treasurePayload(ammoDraft,ammo,null);assert.equal(ammoPayload.system.quantity,7);assert.deepEqual(ammoPayload.effects,ammo.effects);assert.match(ammoPayload.system.description,/Ammunition bonus \(manual\)/);
assert.equal(treasureFolder(ammoDraft,ammoPayload),'Weapons');
assert.ok(treasureErrors({...builtWeapon,weapon:{...builtWeapon.weapon,featurePart:{text:''}}})['weapon.feature']);
const weaponDraw=await call(handleTreasureOriginalDraw,{version:1,table:'weapon-type'});assert.equal(weaponDraw.weaponType.uuid,weaponBaseRows[0].uuid);
const savedRoll=runtime.rolls.roll;runtime.rolls.roll=async()=>({total:7});
const ammoDraw=await call(handleTreasureOriginalDraw,{version:1,table:'ammunition-quantity',uuid:ammo.uuid});assert.equal(ammoDraw.quantity,7);runtime.rolls.roll=savedRoll;

const oneTier=String(spell.system.tier),nativeSpells=tierSpells(rows,oneTier);
for(const kind of ['Scroll','Wand'] as const){
 const draft={...emptyTreasureDraft(),category:'scrolls' as const,kind,name:`Built ${kind}`,spellUuid:spell.uuid,
  spellItem:{...emptySpellItemRecipe(),tier:oneTier,feature:originalSelection(`${kind.toLowerCase()}-feature`,kind==='Scroll'?'ribbon':'chime')}};
 const payload=treasurePayload(draft,null,spell);assert.equal(payload.img,spell.img);assert.equal(payload.system.magicItem,true);
 if(kind==='Scroll')assert.equal(payload.system.spellUuid,spell.uuid);else assert.deepEqual(payload.system.spells,[{uuid:spell.uuid,lost:false}]);
 assert.match(payload.system.description,new RegExp(`${kind} feature`));
 const mismatch=await call(handleTreasurePrepare,{draft:{...draft,spellItem:{...draft.spellItem,tier:oneTier==='1'?'2':'1'}},saveToLibrary:true});
 assert.match(mismatch.plan.errors.spellUuid,/selected tier/);
 assert.ok(treasureErrors({...draft,spellItem:{...draft.spellItem,feature:originalSelection('utility-feature','seams')}})['spellItem.feature']);
 const body=await saveBody(draft,`built-${kind}-0001`,'recipient');const beforeSpellWrite:number=writes;await call(handleTreasureDeliver,body);await call(handleTreasureDeliver,body);assert.equal(writes,beforeSpellWrite+1);
}
const spellDraw=await call(handleTreasureOriginalDraw,{version:1,table:'tier-spell',tier:oneTier});assert.equal(spellDraw.spell.uuid,nativeSpells[0].uuid);
assert.equal((await call(handleTreasureOriginalDraw,{version:1,table:'tier-spell',tier:'6'})).status,400);
allowed=false;const beforeDenied=writes;assert.ok((await call(handleTreasureOriginalDraw,{version:1,table:'tier-spell',tier:oneTier})).status>=400);assert.equal(writes,beforeDenied);allowed=true;
console.log('Remaining procedures: tier-bound scroll/wand links, utility forms/artwork, native weapons/ammunition, permanent effect application/suppression, exact save/replay and source access passed.');

// Spell choices expose exact native class labels, not guessed spell-name matches.
const labeledCatalog=await call(handleTreasureCatalog,{},true,'GET');
const nativeLights=rows.filter(d=>d.type==='Spell'&&d.name==='Light');
assert.ok(nativeLights.length>=2);
for(const nativeSpell of nativeLights){
 const expected=nativeSpell.system.class.map((uuid:string)=>byUuid.get(uuid)?.name??'Class unavailable');
 assert.deepEqual(labeledCatalog.spells.find((s:any)=>s.uuid===nativeSpell.uuid).classes,expected);
}
assert.ok(labeledCatalog.spells.some((s:any)=>s.name==='Light'&&s.classes.includes('Wizard')));
assert.ok(labeledCatalog.spells.some((s:any)=>s.name==='Light'&&s.classes.includes('Priest')));
console.log('Treasure spell picker: exact casting-class labels distinguish native same-name spells.');

// Spell-item properties use their own contextual original alternatives.
assert.equal(magicFixedFamily('scrolls',null,'Scroll'),'scroll');
assert.equal(magicFixedFamily('scrolls',null,'Wand'),'wand');
for(const kind of ['Scroll','Wand'] as const){
 const family=kind==='Scroll'?'scroll':'wand';
 const rolled=await call(handleTreasureOriginalDraw,{table:`${family}-benefits`,version:1});
 assert.equal(rolled.part.source.table,`${family}-benefits`);
 const magic:ReturnType<typeof emptyMagicRecipe>={...emptyMagicRecipe(),family:kind==='Scroll'?'scroll':'wand',attributesEnabled:true,benefits:[rolled.part],curses:[originalSelection(`${family}-curses`,kind==='Scroll'?'stain':'ink')]};
 assert.deepEqual(magicErrors(magic),{});
 const draft={...emptyTreasureDraft(),kind,name:`${kind} of Light`,spellUuid:spell.uuid,magic};
 const made=treasurePayload(draft,null,spell);
 assert.match(made.system.description,/casting|cast/);
 assert.deepEqual(made.effects,[],'conditional properties remain descriptive, not passive effects');
 if(kind==='Scroll')assert.equal(made.system.spellUuid,spell.uuid);else assert.deepEqual(made.system.spells,[{uuid:spell.uuid,lost:false}]);
}
console.log('Spell-item tables: dedicated Wand/Scroll families, valid rolls/manual properties and native casting links retained.');


// Cards expose changes for the exact owned Item, with canonical v14 precedence
// and current suppression; preview cards never imply an active Actor effect.
const cardItem:any={_id:'card-armor',type:'Armor',name:'Test armor',system:{equipped:true,ac:{base:12},quantity:1},effects:[
    {_id:'shared-id',name:'Protection',changes:[{key:'system.attributes.ac.value',mode:2,value:99}],system:{changes:[{key:'system.attributes.ac.value',type:'add',value:2}]}},
    {_id:'disabled',name:'Dormant strength',disabled:true,changes:[{key:'system.abilities.str.value',mode:2,value:1}]},
    {_id:'local',name:'Local effect',transfer:false,changes:[]},
    {_id:'situational',name:'Situational effect',flags:{shadowdark:{situational:true}},changes:[{key:'system.custom.extension',mode:5,value:'@abilities.cha.mod'}]},
]};
const cardActor:any={_id:'card-owner',type:'Player',system:{},effects:[{_id:'shared-id',name:'Actor-only effect',changes:[]}],items:[cardItem,{_id:'other-item',type:'Basic',name:'Other item',effects:[{_id:'shared-id',name:'Other item effect',changes:[]}]}]};
const ownCard=()=>buildOwnedItemCard(prepareShadowdarkView(cardActor),cardItem)!;
const entries=ownCard().sections.find(s=>s.title==='Effects')!.entries;
assert.deepEqual(entries.map(e=>e.title),['Protection','Dormant strength','Local effect','Situational effect']);
assert.deepEqual(entries[0].facts,[{label:'Status',value:'Active'},{label:'AC Bonus',value:'Add 2'}]);
assert.equal(entries[1].facts![0].value,'Disabled');assert.equal(entries[2].facts![0].value,'Not transferred');
assert.equal(entries[3].facts![0].value,'Active (situational)');
assert.deepEqual(entries[3].facts![1],{label:'system.custom.extension',value:'Set to @abilities.cha.mod'});
cardItem.system.equipped=false;
assert.equal(ownCard().sections[0].entries[0].facts![0].value,'Suppressed (unequipped)');
cardItem.system.stashed=true;
assert.equal(ownCard().sections[0].entries[0].facts![0].value,'Suppressed (stashed)');
const previewEffects=buildDocumentCard(cardItem,null).sections[0].entries;
assert.equal(previewEffects[0].facts![0].value,'Enabled');assert.equal(previewEffects[0].facts![1].value,'Add 2');
assert.equal(previewEffects[1].facts![0].value,'Disabled');
assert.deepEqual(buildDocumentCard({...cardItem,effects:[]},null).sections,[]);
console.log('Item cards: exact-owner effects, readable changes, v14 precedence, suppression and preview state verified.');
