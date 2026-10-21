/** Actual mounted ADR-0002 corrective consumers; controlled SDK, all network blocked. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || path.join(root, 'temp/parity-corrections-browser'));
const baseline = process.argv.find(arg => arg.startsWith('--baseline='))?.slice(11);
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7);
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.SHADOWDARK_PLAYWRIGHT_MODULE || 'playwright');
const bundle = await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
import React from 'react';import {createRoot} from 'react-dom/client';
import {ShadowdarkUIProvider} from '${root}/src/ui/context/ShadowdarkUIContext';
import {useShadowdarkLevelUp} from '${root}/src/ui/hooks/useShadowdarkLevelUp';
import {useLevelUp} from '${root}/src/ui/components/levelup/useLevelUp';
import {AdvancementRecovery} from '${root}/src/ui/components/levelup/AdvancementRecovery';
import {LevelUpModal} from '${root}/src/ui/components/LevelUpModal';
import Spells from '${root}/src/ui/SpellsTab';
let ids=0;Object.defineProperty(window.crypto,'randomUUID',{value:()=> 'offline-request-'+(++ids)});
window.calls=[];window.pending=[];window.pendingReviews=[];window.notices=[];window.completions=[];
const cls={_id:'class',uuid:'Item.class',type:'Class',name:'Wizard',system:{hitPoints:'d4',talents:[],patron:{required:false}}};
window.sdk={isConnected:true,worldId:'offline',currentUser:{id:'owner',role:1},resolveImageUrl:x=>x||'',addNotification:(...v)=>window.notices.push(v),events:{on:()=>()=>{}},
fetchWithAuth:async(url,options={})=>{window.calls.push({url,headers:options.headers,body:options.body?JSON.parse(options.body):null});
 if(url.endsWith('/finalize')||url.endsWith('/manage'))return new Promise(resolve=>window.pending.push(resolve));
 if(url.includes('/document/')&&window.initial.holdClass)return new Promise(()=>{});
 if(url.includes('/document/'))return Response.json(url.endsWith('Actor.actor')?window.actorContext.actor:cls);
 if(url.includes('/level-up/data')&&window.holdReview)return new Promise(resolve=>window.pendingReviews.push(resolve));
 if(url.includes('/level-up/data'))return Response.json({success:true,data:{progressionReady:true,isSpellcaster:false,spellsToChoose:{},availableSpells:[],advancementOperation:window.initial.operation||null}});
 if(url.endsWith('/index'))return Response.json({nameIndex:{}});
 if(url.endsWith('/classes'))return Response.json([cls]);
 if(url.endsWith('/spells'))return Response.json(window.initial.catalog||[]);
 return Response.json([]);
}};
window.actorContext={actor:window.initial.actor,rollDialog:{open:false},refreshActor:async()=>{},isActionBusy:()=>false};
const app=createRoot(document.getElementById('root'));
function Form(props){if(window.initial.actualModal)return <LevelUpModal {...props}/>;const {state,actions}=useLevelUp({...props,skipLanguageSelection:true});window.confirm=()=>actions.handleConfirm();return <><button onClick={()=>actions.handleConfirm()}>Confirm advancement</button><output>{state.error}</output>{state.operation&&<AdvancementRecovery operation={state.operation} busy={state.isSubmitting} refresh={actions.refreshOperation} resume={actions.handleConfirm} onClose={props.onCancel}/>}</>;}
function Advancement(){const flow=useShadowdarkLevelUp(window.actorContext.actor,window.sdk.addNotification);return <><button onClick={flow.triggerLevelUp}>Open advancement</button>{flow.showLevelUpModal&&<section aria-label="Advancement dialog"><Form actorId="actor" {...flow.levelUpData} onComplete={result=>{window.completions.push(result);window.sdk.addNotification('Authoritatively complete','success');flow.closeLevelUp();}} onCancel={flow.closeLevelUp}/></section>}</>;}
window.render=()=>app.render(<ShadowdarkUIProvider>{window.initial.which==='advance'?<Advancement/>:<Spells/>}</ShadowdarkUIProvider>);
window.setActor=actor=>{window.actorContext.actor=actor;window.render()};
window.answer=(index,result,status=200)=>window.pending[index](Response.json(result,{status}));window.render();
` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [{ name: 'controlled-sdk', setup(b) {
    if(baseline)b.onLoad({filter:/(?:LevelUpModal\.tsx|AdvancementRecovery\.tsx|useShadowdarkLevelUp\.ts|useLevelUp\.ts|SpellsTab\.tsx|SpellSelectionModal\.tsx)$/},a=>({loader:a.path.endsWith('.tsx')?'tsx':'ts',resolveDir:path.dirname(a.path),contents:execFileSync('git',['show',`${baseline}:${path.relative(root,a.path)}`],{cwd:root,encoding:'utf8'})}));
    b.onResolve({filter:/^@sheet-delver\/sdk(?:\/react)?$/},a=>({path:a.path,namespace:'sdk'}));
    b.onResolve({filter:/ShadowdarkActorContext$/},()=>({path:'actor',namespace:'sdk'}));
    b.onLoad({filter:/.*/,namespace:'sdk'},a=>({loader:'tsx',resolveDir:root,contents:a.path==='actor'?'export const useShadowdarkActor=()=>window.actorContext;':a.path.endsWith('/react')?`export const useSDK=()=>window.sdk;export const useSDKComponents=()=>({ConfirmationModal:()=>null});`:`export const logger={info(){},error(){},warn(){},debug(){}};export const processHtmlContent=x=>x;`}));
} }] });
const browser = await chromium.launch({ ...(process.env.SHADOWDARK_CHROME ? {executablePath:process.env.SHADOWDARK_CHROME}:{}),headless:true,args:['--no-sandbox','--disable-background-networking'] });
const results=[];
async function test(name,initial,run){if(only&&!name.startsWith(only))return;const page=await browser.newPage();page.setDefaultTimeout(3000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());try{
 await page.setContent('<div id="root"></div>');await page.evaluate(x=>window.initial=x,initial);await page.addScriptTag({content:bundle.outputFiles[0].text});await run(page);assert.deepEqual(errors,[]);results.push({name,pass:true});
}catch(e){results.push({name,pass:false,error:String(e),errors,text:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,`${results.length}-failure.png`)});}finally{await page.close();}}
const actor={_id:'actor',id:'actor',type:'Player',system:{level:{value:1,xp:15},class:'Item.class'},items:[],derived:{identity:{class:{ref:{kind:'world',documentType:'Item',id:'class'}},languages:[]},actions:[],items:[]}};
const A='Item.listA', B='Item.listB';
const catalog=[{_id:'addA',uuid:'Item.addA',name:'List A new',type:'Spell',system:{tier:1,class:[A]}},{_id:'addB',uuid:'Item.addB',name:'List B new',type:'Spell',system:{tier:1,class:[B]}}];
function casting(){const next=structuredClone(actor);next.system.level.value=1;next.spellReviewToken='current-source';
next.items=[{_id:'ownedA',type:'Spell',name:'Owned List A',system:{tier:1,class:[A]}},{_id:'ownedB',type:'Spell',name:'Owned List B',system:{tier:1,class:[B]}}];
next.derived.spellModel={sources:[{classUuid:'Item.class',listUuid:A,name:'Wizard',grant:'wizard',limits:{1:{status:'known',value:3}}}],owned:[{itemId:'ownedA',name:'Owned List A',tier:1,classes:[A],classification:'ordinary',innate:false},{itemId:'ownedB',name:'Owned List B',tier:1,classes:[B],classification:'ordinary',innate:false}]};return next;}
async function openManager(p){await p.getByRole('button',{name:/TIER 1/}).click();await p.getByRole('button',{name:'Add List A new',exact:true}).waitFor();}
try{
await test('R1 Actor target-level event cannot announce completion before final operation response',{which:'advance',actor},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByRole('button',{name:'Confirm advancement'}).click();await p.waitForFunction(()=>window.pending.length===1);
 const body=await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/finalize')).body);
 await p.evaluate(()=>{const next=structuredClone(window.actorContext.actor);next.system.level.value=2;window.setActor(next)});
 await p.waitForTimeout(80);assert.equal(await p.getByRole('region',{name:'Advancement dialog'}).count(),1);assert.deepEqual(await p.evaluate(()=>window.notices),[]);assert.match(body.requestId,/^[\w-]{8,80}$/);assert.equal(typeof body.baseline,'string');
 await p.evaluate(()=>window.answer(0,{success:true,state:'partial',requestId:'same',operations:[{kind:'item',status:'failed',name:'Required grant'}]}));
 await p.getByRole('region',{name:'Advancement recovery'}).waitFor();assert.deepEqual(await p.evaluate(()=>window.completions),[]);
 await p.getByRole('button',{name:'Retry same request'}).click();await p.waitForFunction(()=>window.pending.length===2);
 assert.deepEqual(await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/finalize')).map(c=>c.body)),[body,body]);
 await p.evaluate(()=>window.answer(1,{success:true,state:'complete',items:[],hpRoll:3}));await p.getByRole('region',{name:'Advancement dialog'}).waitFor({state:'detached'});
 assert.equal(await p.evaluate(()=>window.completions.length),1);assert.deepEqual(await p.evaluate(()=>window.notices),[['Authoritatively complete','success']]);
});
await test('R1 reopened advancement presents durable receipts and retries original identity',{which:'advance',actor,operation:{requestId:'saved-request',targetLevel:2,state:'partial',baseline:'reviewed-source',operations:[{kind:'item',name:'Grant',status:'complete',itemId:'confirmed1'},{kind:'advancement',status:'failed'}]}},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByRole('region',{name:'Advancement recovery'}).waitFor();await p.getByText('Grant: complete · Item confirmed1',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Retry same request'}).click();await p.waitForFunction(()=>window.pending.length===1);
 assert.deepEqual(await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/finalize')).body),{requestId:'saved-request'});
 await p.evaluate(()=>window.answer(0,{success:true,state:'partial',requestId:'saved-request',operations:[]}));assert.deepEqual(await p.evaluate(()=>window.completions),[]);
});
await test('N14 unresolved advancement opens the saved request without new-progression collection reads',{which:'advance',actor:{...actor,advancementPending:true,system:{...actor.system,level:{value:3,xp:15}}},operation:{requestId:'saved-final-patch',targetLevel:3,state:'partial',operations:[{kind:'advancement',status:'uncertain'}]}},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByRole('region',{name:'Advancement recovery'}).waitFor();
 assert.equal(await p.evaluate(()=>window.calls.filter(c=>/\/(classes|patrons|languages)$/.test(c.url)).length),0);
 await p.getByRole('button',{name:'Retry same request'}).click();await p.waitForFunction(()=>window.pending.length===1);
 assert.deepEqual(await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/finalize')).body),{requestId:'saved-final-patch'});
 await p.evaluate(()=>window.answer(0,{success:true,state:'complete',requestId:'saved-final-patch',operations:[]}));
 await p.getByRole('region',{name:'Advancement dialog'}).waitFor({state:'detached'});assert.equal(await p.evaluate(()=>window.completions.length),1);
});
await test('N14 saved-operation controls remain interactive while unrelated Class loading is pending',{which:'advance',actualModal:true,holdClass:true,actor:{...actor,advancementPending:true,system:{...actor.system,level:{value:3,xp:15}}},operation:{requestId:'saved-final-patch',targetLevel:3,state:'partial',operations:[{kind:'item',index:0,name:'Unknown Spell',status:'uncertain'},{kind:'advancement',status:'pending'}]}},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByRole('region',{name:'Advancement recovery'}).waitFor();
 await p.getByLabel('Exact owned Item ID after source review').fill('confirmed1');await p.getByRole('checkbox').check();
 assert.equal(await p.getByRole('checkbox').isChecked(),true);await p.getByText('Incomplete advancement to level 3',{exact:true}).waitFor();
 assert.equal(await p.getByText('Consulting the Omens...', {exact:true}).count(),0);
});
await test('N14 already-settled saved review closes without preparing or submitting another advancement',{which:'advance',actualModal:true,holdClass:true,actor:{...actor,advancementPending:true},operation:null},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.waitForFunction(()=>window.calls.some(c=>c.url.includes('/level-up/data')));
 await p.getByRole('region',{name:'Advancement dialog'}).waitFor({state:'detached'});
 assert.equal(await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/finalize')).length),0);assert.deepEqual(await p.evaluate(()=>window.completions),[]);
});
const zeroReceipt={requestId:'saved-retirement',targetLevel:2,state:'partial',baseline:'reviewed-original',contextRevision:2,planRevision:1,canRetireZeroWrite:true,canResolveRestored:false,operations:[{kind:'item',index:0,name:'Required grant',status:'failed',error:'Definitely refused'},{kind:'advancement',status:'pending'}]};
await test('R1a mounted zero-write refusal requires restart without recovery and never reports advancement success',{which:'advance',actor:{...actor,worldContextRevision:1}},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByRole('button',{name:'Confirm advancement'}).click();await p.waitForFunction(()=>window.pending.length===1);
 const original=await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/finalize')).body.requestId);
 await p.evaluate(id=>window.answer(0,{success:true,requestId:id,state:'retired',terminal:{disposition:'zero-write',note:'Definitely refused; no native writes'},operations:[{kind:'item',index:0,name:'Required grant',status:'failed'}],recovery:'Advancement was not applied. No document writes occurred. Start advancement again against current data.'}),original);
 await p.getByText('Advancement was not applied',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Retry same request',exact:true}).count(),0);assert.equal(await p.getByRole('checkbox').count(),0);
 assert.deepEqual(await p.evaluate(()=>window.completions),[]);assert.deepEqual(await p.evaluate(()=>window.notices),[]);
 await p.getByRole('button',{name:'Start advancement again',exact:true}).click();await p.getByRole('region',{name:'Advancement dialog'}).waitFor({state:'detached'});
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByRole('button',{name:'Confirm advancement'}).click();await p.waitForFunction(()=>window.pending.length===2);
 assert.notEqual(await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/finalize')).at(-1).body.requestId),original);
 await p.evaluate(()=>window.answer(1,{success:true,state:'complete'}));await p.waitForFunction(()=>window.completions.length===1);assert.equal((await p.evaluate(()=>window.notices)).length,1);
});
await test('R1a restart after an independent Actor edit uses a fresh request and current baseline', {which:'advance', actor:{...actor,spellReviewToken:'reviewed-before-gm-edit'}}, async p => {
 await p.getByRole('button',{name:'Open advancement'}).click();
 await p.getByRole('button',{name:'Confirm advancement'}).click();
 await p.waitForFunction(()=>window.pending.length===1);
 const original=await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/finalize')).body);
 assert.equal(original.baseline,'reviewed-before-gm-edit');
 await p.evaluate(id=>{
   const current=structuredClone(window.actorContext.actor);
   current.system.level.xp=16;current.system.notes='Independent GM edit';current.spellReviewToken='reviewed-after-gm-edit';
   window.setActor(current);
   window.answer(0,{success:true,requestId:id,state:'retired',baseline:current.spellReviewToken,
     terminal:{disposition:'zero-write',note:'No advancement writes occurred; current Actor changes are preserved'},
     operations:[{kind:'item',name:'Required grant',status:'pending'},{kind:'advancement',status:'pending'}]});
 },original.requestId);
 await p.getByRole('button',{name:'Start advancement again',exact:true}).waitFor();
 assert.equal(await p.getByRole('checkbox').count(),0);
 assert.deepEqual(await p.evaluate(()=>window.completions),[]);
 assert.deepEqual(await p.evaluate(()=>window.notices),[]);
 await p.getByRole('button',{name:'Start advancement again',exact:true}).click();
 await p.getByRole('button',{name:'Open advancement'}).click();
 await p.getByRole('button',{name:'Confirm advancement'}).click();
 await p.waitForFunction(()=>window.pending.length===2);
 const fresh=await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/finalize')).at(-1).body);
 assert.notEqual(fresh.requestId,original.requestId);
 assert.equal(fresh.baseline,'reviewed-after-gm-edit');
 assert.equal(fresh.targetLevel,2);
 assert.deepEqual(await p.evaluate(()=>[window.actorContext.actor.system.level.xp,window.actorContext.actor.system.notes]),[16,'Independent GM edit']);
 await p.evaluate(()=>window.answer(1,{success:true,state:'complete'}));
 await p.waitForFunction(()=>window.completions.length===1);
 assert.equal((await p.evaluate(()=>window.notices)).length,1);
 assert.equal(await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/finalize')).length),2);
});
await test('R1a reopened automatically retired stale operation offers restart with no recovery controls',{which:'advance',actor,operation:{...zeroReceipt,state:'retired',terminal:{disposition:'zero-write',note:'No confirmed, unresolved or in-flight writes'},recovery:'Start advancement again against current data.'}},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByRole('button',{name:'Start advancement again',exact:true}).waitFor();
 assert.equal(await p.getByRole('checkbox').count(),0);assert.equal(await p.getByRole('button',{name:'Reconcile receipts without replay',exact:true}).count(),0);assert.deepEqual(await p.evaluate(()=>window.completions),[]);
});
await test('R1a mounted partial restoration shows exact evidence and resets review before terminal closure',{which:'advance',actor,operation:{...zeroReceipt,canRetireZeroWrite:false,canResolveRestored:false,operations:[{kind:'item',index:0,name:'Grant',status:'complete',itemId:'confirmed1'},{kind:'advancement',status:'pending'}],restoration:{instructions:'Remove only confirmed1 and independently restore reviewed source; no automatic rollback.',values:[{path:'system.level.xp',value:15,absent:false}]}}},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByText('Resolve a partially applied operation after restoration',{exact:true}).click();
 await p.getByText('system.level.xp: 15',{exact:true}).waitFor();await p.getByText('Grant: complete · Item confirmed1',{exact:true}).waitFor();
 const resolve=p.getByRole('button',{name:'Verify restoration and close operation',exact:true});assert.equal(await resolve.isDisabled(),true);
 await p.getByRole('checkbox').check();await p.evaluate(()=>{window.initial.operation={...window.initial.operation,baseline:'independently-restored',canResolveRestored:true};});
 await p.getByRole('button',{name:'Refresh operation review',exact:true}).click();await p.waitForTimeout(80);assert.equal(await p.getByRole('checkbox').isChecked(),false);assert.equal(await resolve.isDisabled(),true);
 await p.getByLabel('Independent restoration evidence').fill('Removed exact confirmed1 and compared original source export');await p.getByRole('checkbox').check();await resolve.click();await p.waitForFunction(()=>window.pending.length===1);
 const body=await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/finalize')).body);assert.equal(body.recovery.action,'resolve-restored');assert.equal(body.recovery.baseline,'independently-restored');assert.match(body.recovery.note,/confirmed1/);
 await p.evaluate(()=>window.answer(0,{success:true,...window.initial.operation,state:'retired',terminal:{disposition:'restored',note:'Independent source restoration verified'}}));
 await p.getByText(/Terminal disposition: restored/).waitFor();await p.getByText('Grant: complete · Item confirmed1',{exact:true}).waitFor();assert.deepEqual(await p.evaluate(()=>window.completions),[]);
});
await test('R1a mounted uncertain outcome blocks retirement and supports receipt-only exact-ID review',{which:'advance',actor,operation:{...zeroReceipt,canRetireZeroWrite:false,operations:[{kind:'item',index:0,name:'Uncertain grant',status:'uncertain'},{kind:'advancement',status:'pending'}]}},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByRole('checkbox').check();assert.equal(await p.getByRole('button',{name:'Start advancement again',exact:true}).count(),0);
 await p.getByLabel('Exact owned Item ID after source review').fill('reviewed-owned-id');await p.getByRole('button',{name:'Reconcile receipts without replay',exact:true}).click();await p.waitForFunction(()=>window.pending.length===1);
 const body=await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/finalize')).body);assert.equal(body.recovery.action,'reconcile');assert.deepEqual(body.recovery.items,{'0':'reviewed-owned-id'});assert.deepEqual(await p.evaluate(()=>window.completions),[]);
});
await test('R1b mounted acknowledged-ID reconciliation preserves receipts on storage failure and completes only after authoritative response',{which:'advance',actor,operation:{...zeroReceipt,operations:[{kind:'item',index:0,name:'Confirmed grant',status:'complete',itemId:'confirmed1',acknowledged:true,receiptPending:true,persistenceError:'Receipt storage unavailable'},{kind:'advancement',status:'pending'}]}},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByText('Upstream write acknowledged as Item confirmed1; receipt storage needs reconciliation. No write will be repeated.',{exact:true}).waitFor();
 const input=p.getByLabel('Exact owned Item ID after source review');assert.equal(await input.inputValue(),'confirmed1');await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Reconcile receipts without replay',exact:true}).click();await p.waitForFunction(()=>window.pending.length===1);
 const first=await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/finalize')).at(-1));assert.equal(first.headers['X-SheetDelver-Context-Revision'],'2');assert.equal(first.body.requestId,'saved-retirement');assert.equal(first.body.recovery.action,'reconcile');
 await p.evaluate(()=>window.answer(0,{error:'Receipt storage unavailable'},500));await p.getByText(/Receipt storage unavailable/).first().waitFor();assert.equal(await input.inputValue(),'confirmed1');assert.deepEqual(await p.evaluate(()=>window.completions),[]);
 await p.getByRole('button',{name:'Continue reviewed operation',exact:true}).click();await p.waitForFunction(()=>window.pending.length===2);
 const next=await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/finalize')).at(-1).body);assert.equal(next.requestId,'saved-retirement');assert.equal(next.recovery.reviewed,true);
 await p.evaluate(()=>{window.setActor({...window.actorContext.actor,system:{...window.actorContext.actor.system,level:{value:2,xp:0}}});window.initial.operation={success:true,...window.initial.operation,operations:[{kind:'item',name:'Confirmed grant',status:'complete',itemId:'confirmed1',acknowledged:true},{kind:'advancement',status:'complete',acknowledged:true,verificationPending:true}],state:'partial'};window.answer(1,window.initial.operation);});
 await p.getByText('Acknowledged write needs primary-source review; it will not repeat.',{exact:true}).waitFor();assert.deepEqual(await p.evaluate(()=>window.completions),[]);
 await p.getByRole('button',{name:'Continue reviewed operation',exact:true}).click();await p.waitForFunction(()=>window.pending.length===3);await p.evaluate(()=>window.answer(2,{success:true,state:'complete'}));await p.waitForFunction(()=>window.completions.length===1);
});
await test('R1b late pre-write review cannot erase a newer acknowledged ID',{which:'advance',actor,operation:{...zeroReceipt,operations:[{kind:'item',index:0,name:'Grant',status:'uncertain'},{kind:'advancement',status:'pending'}]}},async p=>{
 await p.getByRole('button',{name:'Open advancement'}).click();await p.getByRole('region',{name:'Advancement recovery'}).waitFor();
 await p.evaluate(()=>{window.holdReview=true;});await p.getByRole('button',{name:'Refresh operation review',exact:true}).click();await p.waitForFunction(()=>window.pendingReviews.length>=1);
 await p.getByRole('button',{name:'Retry same request',exact:true}).click();await p.waitForFunction(()=>window.pending.length===1);
 await p.evaluate(()=>{window.initial.operation={...window.initial.operation,operations:[{kind:'item',index:0,name:'Grant',status:'complete',itemId:'confirmed1',acknowledged:true,receiptPending:true},{kind:'advancement',status:'pending'}]};window.answer(0,{success:true,...window.initial.operation});});
 await p.getByText(/Grant: complete · Item confirmed1/).first().waitFor();
 await p.evaluate(()=>{for(const resolve of window.pendingReviews)resolve(Response.json({success:true,data:{advancementOperation:{requestId:'saved-retirement',state:'partial',operations:[{kind:'item',name:'Grant',status:'uncertain'}]},progressionReady:false}}));window.holdReview=false;});
 await p.waitForTimeout(100);await p.getByText(/Grant: complete · Item confirmed1/).first().waitFor();assert.equal(await p.getByLabel('Exact owned Item ID after source review').inputValue(),'confirmed1');assert.deepEqual(await p.evaluate(()=>window.completions),[]);
});
for(const changeLevel of [true,false])await test(`R3 same-Class ${changeLevel?'level':'progression-only'} refresh updates limit and retires intent`,{actor:casting(),catalog},async p=>{
 await openManager(p);await p.getByPlaceholder('Filter spells by name...').fill('List');await p.getByRole('button',{name:'Add List A new',exact:true}).click();
 await p.getByText('Spells known: 2 / 3',{exact:true}).waitFor();
 await p.evaluate(level=>{const next=structuredClone(window.actorContext.actor);if(level)next.system.level.value=2;next.derived.spellModel.sources[0].limits[1].value=4;window.setActor(next);},changeLevel);
 await p.getByText('Spells known: 1 / 4',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Add List A new',exact:true}).getAttribute('aria-pressed'),'false');
 assert.equal(await p.getByPlaceholder('Filter spells by name...').inputValue(),'List');
 await p.getByRole('button',{name:'Add List A new',exact:true}).click();await p.getByRole('button',{name:'SAVE CHANGES',exact:true}).click();await p.waitForFunction(()=>window.pending.length===1);
 const body=await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/manage')).body);assert.equal(body.listUuid,A);assert.deepEqual(body.additions,['Item.addA']);assert.deepEqual(body.removals,[]);
});
await test('R3 same-Class alternate list refreshes owned/catalog/request identity and retires stale additions/removals',{actor:casting(),catalog},async p=>{
 await openManager(p);await p.getByPlaceholder('Filter spells by name...').fill('List');await p.getByRole('button',{name:'Remove Owned List A',exact:true}).click();await p.getByRole('button',{name:'Add List A new',exact:true}).click();
 await p.evaluate(()=>{const next=structuredClone(window.actorContext.actor);next.derived.spellModel.sources[0].listUuid='Item.listB';next.derived.spellModel.sources[0].limits[1].value=2;window.setActor(next);});
 await p.getByRole('button',{name:'Add List B new',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Add List A new',exact:true}).count(),0);
 await p.getByRole('button',{name:'Remove Owned List B',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Remove Owned List A',exact:true}).count(),0);
 assert.equal(await p.getByPlaceholder('Filter spells by name...').inputValue(),'List');await p.getByText('Spells known: 1 / 2',{exact:true}).waitFor();
 await p.getByRole('button',{name:'Add List B new',exact:true}).click();await p.getByRole('button',{name:'SAVE CHANGES',exact:true}).click();await p.waitForFunction(()=>window.pending.length===1);
 const body=await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/manage')).body);assert.equal(body.listUuid,B);assert.equal(body.baseline,'current-source');assert.deepEqual(body.additions,['Item.addB']);assert.deepEqual(body.removals,[]);
});
await test('R3 source change during an operation preserves original request and exact confirmed receipts after retry refusal',{actor:casting(),catalog},async p=>{
 await openManager(p);await p.getByRole('button',{name:'Add List A new',exact:true}).click();await p.getByRole('button',{name:'SAVE CHANGES',exact:true}).click();await p.waitForFunction(()=>window.pending.length===1);
 const body=await p.evaluate(()=>window.calls.find(c=>c.url.endsWith('/manage')).body);
 await p.evaluate(()=>{const next=structuredClone(window.actorContext.actor);next.derived.spellModel.sources[0].listUuid='Item.listB';window.setActor(next);window.answer(0,{success:true,state:'partial',operations:[{kind:'add',target:'Item.addA',status:'complete',itemId:'confirmedA'},{kind:'remove',target:'old',status:'failed'}]});});
 await p.getByText('Learn spell: saved',{exact:true}).waitFor();assert.doesNotMatch(await p.getByRole('dialog').innerText(),/Item\.addA|confirmedA|Operation /);
 await p.getByRole('button',{name:'Retry remaining operations',exact:true}).click();await p.waitForFunction(()=>window.pending.length===2);
 assert.deepEqual(await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/manage')).map(c=>c.body)),[body,body]);
 await p.evaluate(()=>window.answer(1,{error:'Current list changed'},409));await p.getByText('Learn spell: saved',{exact:true}).waitFor();await p.getByText(/No complete response: Current list changed/).waitFor();
});
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Actual React consumers, controlled SDK; all network blocked; no native acceptance',baseline,results},null,2));}
console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.pass))process.exitCode=1;
