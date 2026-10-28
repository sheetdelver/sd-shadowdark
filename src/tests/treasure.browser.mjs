/** Mounted GM tool → real routes, isolated SDK documents, no live service. Run with tsx. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath,pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { worldSnapshot } from './fixtures/native-406.ts';
import { shadowdarkAdapter as adapter } from '../server/ShadowdarkAdapter.ts';
import { handleTreasureCatalog,handleTreasureDraw,handleTreasureOriginalDraw,handleTreasurePrepare,handleTreasureDeliver,handleTreasureStatus } from '../server/api/treasure.ts';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),core=process.cwd();
const out=process.argv[2]||'/tmp/sd-treasure-browser';fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.SHADOWDARK_PLAYWRIGHT_MODULE||'playwright');
const {compileModuleTailwind}=await import(pathToFileURL(path.join(core,'src/scripts/tools/modules/tailwind-compile.ts')).href);
const css=process.env.SHADOWDARK_TREASURE_CSS?fs.readFileSync(process.env.SHADOWDARK_TREASURE_CSS,'utf8'):await compileModuleTailwind(root,'shadowdark');
const host=(await postcss([tailwind({base:core})]).process(fs.readFileSync(path.join(core,'src/app/globals.css'),'utf8'),{from:path.join(core,'src/app/globals.css')})).css;
const uiImport=process.env.SHADOWDARK_TREASURE_UI ? `import manifest from ${JSON.stringify(process.env.SHADOWDARK_TREASURE_UI)};const Treasure=React.lazy(manifest.tools.treasure);` : `import Treasure from '${root}/src/ui/tools/Treasure';`;
const bundle=await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from'react';import{createRoot}from'react-dom/client';${uiImport}
const listeners=new Map();window.calls=[];window.sdk={isConnected:true,worldId:'offline',currentUser:{id:'gm',role:4},foundryUrl:'',resolveImageUrl:x=>x||'',navigate:x=>window.navigation=x,
 events:{on:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return()=>listeners.get(event).delete(fn);}},
 fetchWithAuth:async(url,options={})=>{const body=options.body?JSON.parse(options.body):null;window.calls.push({url,body});const r=await window.request(url,body);return Response.json(r.body,{status:r.status});}};
window.refreshContext=()=>listeners.get('world:contextChanged')?.forEach(fn=>fn({keys:[]}));
const root=createRoot(document.getElementById('root'));window.mountTool=(visible=true)=>root.render(visible?<React.Suspense fallback={<p>Loading tool…</p>}><Treasure/></React.Suspense>:null);window.mountTool();
`},nodePaths:[path.join(core,'node_modules')],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',plugins:[{name:'sdk',setup(b){
 b.onResolve({filter:/^(?:@sheet-delver\/sdk(?:\/react)?|@shared\/sdk\/react)$/},a=>({path:a.path,namespace:'sdk'}));
 b.onLoad({filter:/.*/,namespace:'sdk'},a=>({loader:'tsx',resolveDir:root,contents:a.path.endsWith('/react')?`import PageHeader from'${core}/src/client/ui/components/PageHeader';import RichTextEditor from'${core}/src/client/ui/components/RichTextEditor';export const useSDK=()=>window.sdk;export const useSDKComponents=()=>({PageHeader,RichTextEditor});`:'export const logger={info(){},warn(){},error(){},debug(){}};export const processHtmlContent=x=>x;export const getErrorMessage=e=>String(e);'}));
}}]});
const table={_id:'Pi9nnnLeXpTKCSMY',uuid:'Compendium.shadowdark.rollable-tables.RollTable.Pi9nnnLeXpTKCSMY',pack:'shadowdark.rollable-tables',name:'Treasure 0–3',formula:'1d100',results:[{_id:'one',range:[1,100],text:'A valuable keepsake. Determine its details manually.'}]};
const spell={_id:'spell1',uuid:'Compendium.shadowdark.spells.Item.spell1',pack:'shadowdark.spells',type:'Spell',name:'Light',img:'icons/magic/light/explosion-star-glow-yellow.webp',system:{tier:1,description:'Test spell.'}};
const bag={_id:'bag',uuid:'Compendium.shadowdark.magic-items.Item.bag',pack:'shadowdark.magic-items',type:'Basic',name:'Bag of Holding',img:'icons/containers/bags/coinpouch-leather-brown.webp',system:{description:'Old template description.',quantity:1,cost:{gp:150,sp:0,cp:0},slots:{slots_used:1,per_slot:1,free_carry:0}},effects:[{name:'Template effect',changes:[]}]};
table.results=[{_id:'linked',range:[1,50],text:'Bag of Holding',documentUuid:bag.uuid},{_id:'text',range:[51,80],text:'Bundle of five red dragon scales (5 gp each)'},{_id:'another',range:[81,100],text:'A silver keepsake (10 gp)'}];
const weapon={_id:'sword',uuid:'Compendium.shadowdark.gear.Item.sword',pack:'shadowdark.gear',type:'Weapon',name:'Longsword',img:'icons/svg/sword.svg',system:{description:'Native longsword.',damage:{oneHanded:'1d8'},quantity:1,cost:{gp:9,sp:0,cp:0},slots:{slots_used:1,per_slot:1,free_carry:0}},effects:[]};
const rows=[table,spell,bag,weapon],sources=new Map(rows.map(d=>[d.uuid,d]));let actor,store,writes,lost,rollCount,library,folders;
const runtime={world:{snapshot:()=>worldSnapshot(1),assertRevision:()=>{}},access:{canReadPack:()=>true,packs:()=>[]},
 compendium:{findAll:async()=>structuredClone(rows),getById:async(_t,u)=>structuredClone(sources.get(u)??null)},
 dataStore:{get:async k=>structuredClone(store.get(k)??null),set:async(k,v)=>store.set(k,structuredClone(v))},
 documents:{fetchByUuid:async u=>structuredClone(sources.get(u)??null),get:async(type,id)=>structuredClone(type==='Item'?library.find(d=>d._id===id)??null:actor),list:async(type)=>({rows:structuredClone(type==='Item'?library:type==='Folder'?folders:[actor]),total:1}),create:async(type,payload)=>{const target=type==='Folder'?folders:library;const doc={...structuredClone(payload),_id:type+'-'+target.length};target.push(doc);return doc;},items:{create:async(_p,item)=>{writes++;const saved={...structuredClone(item),_id:'created-'+writes};actor.items.push(saved);if(lost)throw Error('Lost acknowledgement');return saved;}}},
 rolls:{roll:async(formula)=>({total:formula==='1d100'?([5,61,90][rollCount++]??90):2})}};
await adapter.initialize({...runtime,logger:console});
const handlers={'original-draw':handleTreasureOriginalDraw,catalog:handleTreasureCatalog,draw:handleTreasureDraw,prepare:handleTreasurePrepare,deliver:handleTreasureDeliver,status:handleTreasureStatus};
const browser=await chromium.launch({executablePath:process.env.SHADOWDARK_CHROME,headless:true,args:['--no-sandbox','--disable-background-networking']});
const results=[];
try{for(const width of [390,1000]){
 store=new Map();library=[];folders=[];actor={_id:'mira',name:'Mira',type:'Player',items:[]};writes=0;lost=false;rollCount=0;
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.route('**/*',r=>{
   const asset=new URL(r.request().url()).pathname;
   if(asset==='/icons/dice-d6.svg')return r.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(core,'public/icons/dice-d6.svg'))});
   if(asset.startsWith('/icons/')){
     const file=process.env.SHADOWDARK_FOUNDRY_PUBLIC&&path.join(process.env.SHADOWDARK_FOUNDRY_PUBLIC,asset);
     if(file&&fs.existsSync(file))return r.fulfill({path:file});
     return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><path fill="purple" d="M32 4 60 32 32 60 4 32Z"/></svg>'});
   }
   return r.abort();
 });await page.exposeFunction('request',async(url,body)=>{if(url.endsWith('/index'))return{status:200,body:{}};const r=await handlers[url.split('?')[0].split('/').at(-1)]({runtime,method:body?'POST':'GET',url,headers:{},userSession:{userId:'gm',isGM:true},getAccessContext:()=>({userId:'gm',isGM:true}),json:async()=>body});return{status:r.status??200,body:await r.json()};});
 await page.setContent('<base href="https://shadowdark.test/"><div class="sdk-module--shadowdark" id="root"></div>');await page.addStyleTag({content:host});await page.addStyleTag({content:css});await page.addStyleTag({path:process.env.SHADOWDARK_TREASURE_PRESENTATION||path.join(root,'assets/presentation.css')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.getByRole('button',{name:'Roll table',exact:true}).click();await page.getByText('Treasure 0–3 · Rolled 5',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Use Bag of Holding',exact:true}).click();
 assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'Bag of Holding');
 assert.equal(await page.getByLabel('GP',{exact:true}).inputValue(),'150');
 assert.equal(await page.getByRole('region',{name:'Item card preview'}).locator('img').getAttribute('src'),bag.img);
 await page.getByRole('button',{name:'Roll table',exact:true}).click();await page.getByText('Treasure 0–3 · Rolled 61',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Apply to item details',exact:true}).click();
 assert.equal(await page.getByLabel('Create from',{exact:true}).inputValue(),'Basic');
 assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'Bundle of five red dragon scales (5 gp each)');
 assert.equal(await page.getByLabel('GP',{exact:true}).inputValue(),'5');
 await page.locator('.tiptap').getByText('Bundle of five red dragon scales (5 gp each)',{exact:true}).waitFor();
 await page.getByLabel('Assign to character (optional)',{exact:true}).selectOption('mira');await page.getByRole('button',{name:'Review item',exact:true}).click();
 await page.getByRole('heading',{name:'Review and save'}).waitFor();assert.equal(await page.getByText('Template effects retained',{exact:true}).count(),0);
 await page.getByRole('button',{name:'Roll table',exact:true}).click();await page.getByText('Treasure 0–3 · Rolled 90',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Apply to item details',exact:true}).click();
 assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'A silver keepsake (10 gp)');
 assert.equal(await page.getByLabel('GP',{exact:true}).inputValue(),'10');
 await page.locator('.tiptap').getByText('A silver keepsake (10 gp)',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Save and assign',exact:true}).count(),0);assert.equal(writes,0);
 await page.getByLabel('Name *',{exact:true}).fill('Keepsake');await page.getByLabel('Assign to character (optional)',{exact:true}).selectOption('mira');
 await page.getByRole('button',{name:'Review item',exact:true}).click();await page.getByRole('heading',{name:'Review and save'}).waitFor();assert.equal(writes,0);
 assert.equal(await page.getByRole('button',{name:'Save and assign',exact:true}).isDisabled(),true);
 await page.screenshot({path:path.join(out,'manual-'+width+'.png'),fullPage:true});
 // Retired reviews do not lose manual text or silently retain write permission.
 await page.evaluate(()=>window.refreshContext());await page.getByRole('button',{name:'Review item',exact:true}).waitFor();assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'Keepsake');assert.equal(await page.getByRole('button',{name:'Save and assign',exact:true}).count(),0);

 // A dedicated weapon recipe retains independent parts and other tabs' drafts.
 await page.getByRole('button',{name:'Weapons',exact:true}).click();
 await page.getByRole('button',{name:'Choose weapon base',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Longsword/}).click();
 await page.getByLabel('Weapon feature',{exact:true}).fill('Silver pommel');
 await page.getByLabel('Additional weapon bonus',{exact:true}).selectOption('2');
 await page.getByRole('button',{name:'Add benefit',exact:true}).click();
 await page.getByRole('button',{name:'Review item',exact:true}).click();
 await page.getByText('Enter this result, including any required follow-up choices (up to 1,000 characters).',{exact:true}).waitFor();
 await page.getByLabel('benefits 1',{exact:true}).fill('Warns of danger; GM determines range.');
 await page.getByLabel('Personality trait',{exact:true}).fill('Watchful');
 await page.getByRole('button',{name:'Random Treasure',exact:true}).click();
 assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'Keepsake');
 await page.getByRole('button',{name:'Weapons',exact:true}).click();
 assert.equal(await page.getByLabel('Weapon feature',{exact:true}).inputValue(),'Silver pommel');
 assert.equal(await page.getByLabel('benefits 1',{exact:true}).inputValue(),'Warns of danger; GM determines range.');
 await page.getByLabel('Weapon feature',{exact:true}).fill('Gold pommel');
 assert.equal(await page.getByLabel('Personality trait',{exact:true}).inputValue(),'Watchful');
 await page.getByRole('button',{name:'Review item',exact:true}).click();await page.getByRole('heading',{name:'Review and save'}).waitFor();
 assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=window.innerWidth),true);
 await page.screenshot({path:path.join(out,'weapon-'+width+'.png'),fullPage:true});
 await page.getByRole('button',{name:'Save item',exact:true}).click();
 await page.getByText('Saved Longsword to SheetDelver / Weapons.',{exact:false}).waitFor();
 assert.equal(library.length,1);assert.equal(writes,0);assert.equal(folders.length,2);
 assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('Weapon feature',{exact:true}).inputValue(),'');
 await page.getByRole('button',{name:'Random Treasure',exact:true}).click();assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'Keepsake');
 await page.getByRole('button',{name:'Scrolls / Wands',exact:true}).click();
 await page.getByLabel('Create from',{exact:true}).selectOption('Wand');await page.getByRole('button',{name:'Choose spell',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Light/}).click();assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'Wand of Light');
 assert.equal(await page.getByRole('region',{name:'Item card preview'}).locator('img').getAttribute('src'),spell.img);
 await page.getByLabel('Assign to character (optional)',{exact:true}).selectOption('mira');
 await page.getByRole('button',{name:'Review item',exact:true}).click();await page.getByRole('heading',{name:'Review and save'}).waitFor();
 await page.screenshot({path:path.join(out,'wand-'+width+'.png'),fullPage:true});
 await page.getByLabel('All item details may be shared with the recipient.').check();lost=true;await page.getByRole('button',{name:'Save and assign',exact:true}).click();await page.getByRole('button',{name:'Check save',exact:true}).waitFor();assert.equal(writes,1);
 await page.getByRole('button',{name:'Check save',exact:true}).click();await page.getByText('Saved Wand of Light to SheetDelver / Wands.',{exact:false}).waitFor();assert.equal(writes,1);assert.deepEqual(actor.items[0].system.spells,[{uuid:spell.uuid,lost:false}]);
 assert.equal(library.length,2);assert.equal(folders.length,3);assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'');
 await page.getByRole('button',{name:'Open character',exact:true}).click();assert.equal(await page.evaluate(()=>window.navigation),'/actors/mira');assert.deepEqual(errors,[]);
 // Unchanged source assignment, price prefill, modification/revert and category separation.
 await page.getByRole('button',{name:'Magic Items / Attributes',exact:true}).click();
 await page.getByLabel('Create from',{exact:true}).waitFor();
 assert.deepEqual(await page.getByLabel('Create from',{exact:true}).locator('option').evaluateAll(rows=>rows.map(r=>r.value)),['Basic','template']);
 await page.getByRole('button',{name:'Weapons',exact:true}).click();
 await page.getByRole('button',{name:'Choose weapon base',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/Longsword/}).click();
 assert.equal(await page.getByLabel('GP',{exact:true}).inputValue(),'9');
 await page.getByText('Unchanged from the original source.',{exact:false}).waitFor();
 await page.getByLabel('Name *',{exact:true}).fill('Silver sword');
 await page.getByText('Modified from the original source.',{exact:false}).waitFor();
 await page.getByLabel('Name *',{exact:true}).fill('Longsword');
 await page.getByRole('button',{name:'Review item',exact:true}).click();
 await page.getByText('Choose a character to receive this unchanged item.',{exact:true}).waitFor();
 await page.getByLabel('Assign to character',{exact:true}).selectOption('mira');
 await page.getByRole('button',{name:'Review item',exact:true}).click();await page.getByRole('heading',{name:'Review and assign'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Save and assign',exact:true}).count(),0);
 await page.screenshot({path:path.join(out,'unchanged-'+width+'.png'),fullPage:true});
 await page.getByLabel('All item details may be shared with the recipient.').check();lost=true;
 await page.getByRole('button',{name:'Assign to character',exact:true}).click();
 await page.getByRole('button',{name:'Check assignment',exact:true}).click();
 await page.getByText('Assigned Longsword to the character. No library copy was created.',{exact:false}).waitFor();
 assert.equal(writes,2);assert.equal(library.length,2);assert.equal(folders.length,3);
 assert.equal(actor.items[1].system.cost.gp,9);assert.deepEqual(errors,[]);
 // Mundane paths: assembled drafts, field-level follow-ups, reroll isolation and native Gem save.
 lost=false;
 await page.getByRole('button',{name:'Mundane Items',exact:true}).click();
 await page.getByLabel('Choose object form',{exact:true}).selectOption('puzzle-casket');
 await page.getByRole('button',{name:'Review item',exact:true}).click();
 await page.getByText('Resolve the detail for this form.',{exact:false}).waitFor();
 await page.getByRole('button',{name:'Roll casket interior',exact:true}).click();
 await page.getByLabel('Choose material and workmanship',{exact:true}).selectOption('brass-mesh');
 await page.getByLabel('Unique feature',{exact:true}).fill('An old ownership tag remains attached.');
 await page.getByRole('button',{name:'Roll object',exact:true}).click();
 await page.getByLabel('GP',{exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('#mundane-material')?.value==='Blue-enamelled');
 assert.equal(await page.getByLabel('Unique feature',{exact:true}).inputValue(),'An old ownership tag remains attached.');
 assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'Blue-enamelled puzzle casket');
 assert.equal(await page.getByLabel('GP',{exact:true}).inputValue(),'18');
 await page.getByRole('button',{name:'Review item',exact:true}).click();await page.getByRole('heading',{name:'Review and save'}).waitFor();
 assert.match(await page.getByRole('region',{name:'Review item'}).innerText(),/Three slender drawers/);
 await page.screenshot({path:path.join(out,'mundane-luxury-'+width+'.png'),fullPage:true});
 await page.getByRole('button',{name:'Save item',exact:true}).click();await page.getByText('Saved Blue-enamelled puzzle casket',{exact:false}).waitFor();
 assert.equal(library.at(-1).type,'Basic');assert.equal(await page.getByLabel('Object form *',{exact:true}).inputValue(),'');
 await page.getByLabel('Item path',{exact:true}).selectOption('gemstone');
 await page.getByRole('button',{name:'Roll object',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#mundane-form')?.value==='Carnelian');
 await page.getByLabel('Name *',{exact:true}).fill('The steward’s stone');
 await page.getByLabel('Quantity',{exact:true}).fill('3');
 await page.getByRole('button',{name:'Roll unique feature',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#mundane-feature')?.value.includes('spice'));
 await page.getByLabel('Unique feature',{exact:true}).fill('A distinctive white band runs through it.');
 await page.getByRole('button',{name:'Roll cut and appearance',exact:true}).click();
 await page.getByText('Total value (3):',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'The steward’s stone');
 assert.equal(await page.getByLabel('Unique feature',{exact:true}).inputValue(),'A distinctive white band runs through it.');
 await page.getByRole('button',{name:'Random Treasure',exact:true}).click();
 await page.getByRole('button',{name:'Mundane Items',exact:true}).click();
 assert.equal(await page.getByLabel('Name *',{exact:true}).inputValue(),'The steward’s stone');
 await page.getByLabel('Assign to character (optional)',{exact:true}).selectOption('mira');
 await page.getByRole('button',{name:'Review item',exact:true}).click();await page.getByRole('heading',{name:'Review and save'}).waitFor();
 const gemReview=page.getByRole('region',{name:'Review item'});
 const gemPreview=gemReview.getByRole('region',{name:'Item card preview'});
 const gemImage=await gemPreview.locator('img').getAttribute('src');
 assert.equal(gemImage,'icons/commodities/gems/gem-faceted-navette-red.webp');
 await gemPreview.locator('img').evaluate(img=>img.decode());
 assert.equal(await gemPreview.locator('img').evaluate(img=>img.naturalWidth>0),true);
 assert.match(await gemPreview.innerText(),/The steward’s stone/i);
 await gemPreview.screenshot({path:path.join(out,'item-card-'+width+'.png')});
 assert.match(await gemReview.innerText(),/225 GP/);assert.match(await gemReview.innerText(),/white band/);
 assert.equal(await page.locator('body').evaluate(e=>e.scrollWidth<=window.innerWidth),true);
 assert.equal(await page.getByRole('button',{name:'Roll unique feature',exact:true}).locator('img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
 const inputBox=await page.locator('#mundane-feature').boundingBox(), diceBox=await page.getByRole('button',{name:'Roll unique feature',exact:true}).boundingBox();
 assert.ok(Math.abs((inputBox.y+inputBox.height/2)-(diceBox.y+diceBox.height/2))<3,'roller stays beside input');
 await page.screenshot({path:path.join(out,'mundane-gem-'+width+'.png'),fullPage:true});
 await page.getByLabel('All item details may be shared with the recipient.').check();
 await page.getByRole('button',{name:'Save and assign',exact:true}).click();await page.getByText('Saved The steward’s stone',{exact:false}).waitFor();
 assert.equal(actor.items.at(-1).type,'Gem');assert.equal(actor.items.at(-1).system.quantity,3);assert.equal(actor.items.at(-1).system.cost.gp,75);
 assert.equal(actor.items.at(-1).img,gemImage,'saved item uses the preview artwork');
 await page.getByLabel('Item path',{exact:true}).selectOption('jewelry');
 await page.getByLabel('Choose jewelry form',{exact:true}).selectOption('ear-cuff');
 await page.getByLabel('Material and workmanship',{exact:true}).fill('Hand-woven bronze');
 await page.getByLabel('Unique feature',{exact:true}).fill('One strand has been replaced with green cord.');
 await page.getByLabel('GP',{exact:true}).fill('25');
 await page.getByRole('button',{name:'Review item',exact:true}).click();await page.getByRole('heading',{name:'Review and save'}).waitFor();
 await page.screenshot({path:path.join(out,'mundane-jewelry-'+width+'.png'),fullPage:true});
 await page.getByRole('button',{name:'Save item',exact:true}).click();await page.getByText('Saved Hand-woven bronze ear cuff',{exact:false}).waitFor();
 assert.equal(library.at(-1).type,'Basic');assert.match(library.at(-1).system.description,/green cord/);
 assert.equal(folders.find(f=>f._id===library.at(-1).folder)?.name,'Gems & Jewelry');
 assert.deepEqual(errors,[]);
 const catalogCalls=()=>page.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/treasure/catalog')).length);
 const before=await catalogCalls();assert.equal(before,2,'one initial catalog and one explicit context refresh, despite tab changes');
 await page.evaluate(()=>window.mountTool(false));await page.locator('#root').filter({has:page.locator('main')}).waitFor({state:'hidden'});
 await page.evaluate(()=>window.mountTool());await page.getByRole('button',{name:'Roll table',exact:true}).waitFor();
 assert.equal(await catalogCalls(),before,'reopening the page reuses the catalog');
 results.push({width,passed:true,catalogRequests:before});
 }catch(e){results.push({width,passed:false,error:String(e),errors,text:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'failure-'+width+'.png'),fullPage:true});}finally{await page.close();}
}}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
console.log(JSON.stringify(results));if(results.some(r=>!r.passed))process.exitCode=1;
