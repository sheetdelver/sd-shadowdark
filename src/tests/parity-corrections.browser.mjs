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
import Spells from '${root}/src/ui/SpellsTab';
let ids=0;Object.defineProperty(window.crypto,'randomUUID',{value:()=> 'offline-request-'+(++ids)});
window.calls=[];window.pending=[];window.notices=[];window.completions=[];
const cls={_id:'class',uuid:'Item.class',type:'Class',name:'Wizard',system:{hitPoints:'d4',talents:[],patron:{required:false}}};
window.sdk={isConnected:true,worldId:'offline',currentUser:{id:'owner',role:1},resolveImageUrl:x=>x||'',addNotification:(...v)=>window.notices.push(v),events:{on:()=>()=>{}},
fetchWithAuth:async(url,options={})=>{window.calls.push({url,body:options.body?JSON.parse(options.body):null});
 if(url.endsWith('/finalize')||url.endsWith('/manage'))return new Promise(resolve=>window.pending.push(resolve));
 if(url.includes('/document/'))return Response.json(url.endsWith('Actor.actor')?window.actorContext.actor:cls);
 if(url.includes('/level-up/data'))return Response.json({success:true,data:{progressionReady:true,isSpellcaster:false,spellsToChoose:{},availableSpells:[],advancementOperation:window.initial.operation||null}});
 if(url.endsWith('/index'))return Response.json({nameIndex:{}});
 if(url.endsWith('/classes'))return Response.json([cls]);
 if(url.endsWith('/spells'))return Response.json(window.initial.catalog||[]);
 return Response.json([]);
}};
window.actorContext={actor:window.initial.actor,rollDialog:{open:false},refreshActor:async()=>{},isActionBusy:()=>false};
const app=createRoot(document.getElementById('root'));
function Form(props){const {state,actions}=useLevelUp({...props,skipLanguageSelection:true});window.confirm=()=>actions.handleConfirm();return <><button onClick={()=>actions.handleConfirm()}>Confirm advancement</button><output>{state.error}</output>{state.operation&&<AdvancementRecovery operation={state.operation} busy={state.isSubmitting} refresh={actions.refreshOperation} resume={actions.handleConfirm}/>}</>;}
function Advancement(){const flow=useShadowdarkLevelUp(window.actorContext.actor,window.sdk.addNotification);return <><button onClick={flow.triggerLevelUp}>Open advancement</button>{flow.showLevelUpModal&&<section aria-label="Advancement dialog"><Form actorId="actor" {...flow.levelUpData} onComplete={result=>{window.completions.push(result);window.sdk.addNotification('Authoritatively complete','success');flow.closeLevelUp();}} onCancel={flow.closeLevelUp}/></section>}</>;}
window.render=()=>app.render(<ShadowdarkUIProvider>{window.initial.which==='advance'?<Advancement/>:<Spells/>}</ShadowdarkUIProvider>);
window.setActor=actor=>{window.actorContext.actor=actor;window.render()};
window.answer=(index,result,status=200)=>window.pending[index](Response.json(result,{status}));window.render();
` }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [{ name: 'controlled-sdk', setup(b) {
    if(baseline)b.onLoad({filter:/(?:useShadowdarkLevelUp\.ts|useLevelUp\.ts|SpellsTab\.tsx|SpellSelectionModal\.tsx)$/},a=>({loader:a.path.endsWith('.tsx')?'tsx':'ts',resolveDir:path.dirname(a.path),contents:execFileSync('git',['show',`${baseline}:${path.relative(root,a.path)}`],{cwd:root,encoding:'utf8'})}));
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
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Actual React consumers, controlled SDK; all network blocked; no native acceptance',baseline,results},null,2));}
console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.pass))process.exitCode=1;
