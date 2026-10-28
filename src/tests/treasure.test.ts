/** One useful delivery workflow, native payload parity, and bounded failure checks. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { emptyMundaneRecipe, originalSelection, mundaneName, mundaneValueTable, treasureValue } from '../logic/mundane';
import { MUNDANE_TABLES } from '../data/mundane-tables';
import { emptyBoonRecipe, boonName } from '../logic/boons';
import { buildDocumentCard } from '../logic/resource-cards';
import { nativePacks } from './core0191/world';
import { DECLARED_PACKS } from '../logic/identity';
import { worldSnapshot } from './fixtures/native-406';
import { emptyTreasureDraft, emptyWeaponRecipe, treasureFromTemplate, treasurePayload, treasureErrors, treasureFolder, treasureUnchanged, treasureTemplateAllowed, treasureResultValue } from '../logic/treasure';
import { shadowdarkAdapter as adapter } from '../server/ShadowdarkAdapter';
import { handleTreasureCatalog, handleTreasureDraw, handleTreasureOriginalDraw, handleTreasurePrepare, handleTreasureDeliver, handleTreasureStatus } from '../server/api/treasure';

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
assert.equal(catalog.spells.find((s:any)=>s.uuid===spell.uuid).img,spell.img);
assert.equal(catalog.spells.find((s:any)=>s.uuid===spell.uuid).type,'Spell');
const table='Compendium.shadowdark.rollable-tables.RollTable.Pi9nnnLeXpTKCSMY';
const draw=await call(handleTreasureDraw,{uuid:table});assert.equal(draw.success,true,JSON.stringify(draw));assert.equal(draw.draw.total,1);assert.ok(draw.draw.results.length);
const manual={...emptyTreasureDraft(),name:'Externally rolled gem',description:'<p>A result entered by the GM.</p>',gp:'25',drawId:draw.draw.id,sourceNote:'Private source reference'};
const prep=await call(handleTreasurePrepare,{draft:manual,actorId:'recipient'});assert.ok(prep.plan.review,JSON.stringify(prep));assert.equal(writes,0);
const body={draft:manual,actorId:'recipient',review:prep.plan.review,disclosed:true,requestId:'delivery-test-0001'};
assert.equal((await call(handleTreasureDeliver,{...body,disclosed:false})).status,400);assert.equal(writes,0);
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
const saveBody=async(d:any,id:string,actorId='')=>{const p=await call(handleTreasurePrepare,{draft:d,actorId,saveToLibrary:true});assert.ok(p.plan.review,JSON.stringify(p));return{draft:d,actorId,saveToLibrary:true,review:p.plan.review,requestId:id,disclosed:!!actorId};};
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
