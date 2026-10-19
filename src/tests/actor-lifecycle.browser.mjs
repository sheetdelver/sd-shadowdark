/** Actual ActorPage lifecycle with controlled SDK transport/child boundary. No network. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
const mod=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const baseline=process.argv.find(arg=>arg.startsWith('--baseline='))?.split('=')[1];
const bundle=await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';import ActorPage from '${mod}/src/ui/pages/ActorPage';
const listeners=new Map();window.pending=[];window.calls=[];window.hold=false;window.status=200;
const make=(name='Current source')=>({id:'actor',_id:'actor',name,type:'Player',system:{},items:[],derived:{actions:[]}});
window.sdk={worldId:'world',currentUser:{id:'owner',role:1},isConnected:true,foundryUrl:'',addNotification(){},navigate(){},events:{on:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return()=>listeners.get(event).delete(fn)}},
fetchWithAuth:async(url,options={})=>{window.calls.push(url);if(window.hold&&options.method!=='POST')return new Promise(resolve=>window.pending.push({resolve,url}));return Response.json(url.startsWith('/api/actors/')?make():{actor:make(),derived:make().derived},{status:window.status})}};
const root=createRoot(document.getElementById('root'));let mounted=true;
window.render=()=>root.render(mounted?<ActorPage actorId="actor"/>:null);
window.emit=()=>listeners.get('world:contextChanged')?.forEach(fn=>fn({keys:[]}));
window.answer=(index,name,status=200)=>window.pending[index].resolve(Response.json(window.pending[index].url.startsWith('/api/actors/')?make(name):{actor:make(name),derived:make(name).derived},{status}));
window.change=values=>{window.sdk={...window.sdk,...values};window.render()};window.unmount=()=>{mounted=false;window.render()};window.render();
`,resolveDir:mod,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',plugins:[{name:'boundary',setup(b){
if(baseline)b.onLoad({filter:/pages\/ActorPage\.tsx$/},a=>({loader:'tsx',resolveDir:path.dirname(a.path),contents:execFileSync('git',['show',baseline+':src/ui/pages/ActorPage.tsx'],{cwd:mod,encoding:'utf8'})}));
b.onResolve({filter:/^(?:@sheet-delver\/sdk(?:\/react)?|.*ShadowdarkSheet|.*ShadowdarkActorContext|.*ShadowdarkUIContext)$/},a=>({path:a.path,namespace:'stub'}));
b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'tsx',resolveDir:mod,contents:a.path.endsWith('ShadowdarkSheet')?`import React from 'react';export default function Sheet(){const [text,set]=React.useState('');return <><p>Authorized sheet</p><input aria-label="Manual search" value={text} onChange={e=>set(e.target.value)}/></>}`:a.path.endsWith('Context')?`import React from 'react';export const ShadowdarkUIProvider=({children})=>children;export const ShadowdarkActorProvider=({actor,children})=><section aria-label={actor.name}>{children}</section>;`:a.path.endsWith('/react')?`import React from 'react';export const useSDK=()=>window.sdk;export const useSDKComponents=()=>({LoadingModal:({message})=><p>{message}</p>,SharedContentModal:()=>null});`:`export const processHtmlContent=x=>x;export const getErrorMessage=e=>e?.message||String(e);export const logger={info(){},warn(){},error(){}};` }));
}}]});
const {chromium}=await import(process.env.SHADOWDARK_PLAYWRIGHT_MODULE||'playwright');const browser=await chromium.launch({executablePath:process.env.SHADOWDARK_CHROME,headless:true,args:['--no-sandbox','--disable-background-networking']});const results=[];
async function test(name,run){const p=await browser.newPage();p.setDefaultTimeout(3000);await p.route('**/*',r=>r.abort());try{await p.setContent('<div id="root"></div>');await p.addScriptTag({content:bundle.outputFiles[0].text});await p.getByLabel('Manual search').waitFor();await run(p);results.push({name,passed:true});console.log('✓ '+name)}catch(e){results.push({name,passed:false,error:String(e)});console.error(name,e.message)}finally{await p.close()}}
try{
await test('empty-key ownership invalidation immediately retires visibility; authorized recovery preserves mounted search',async p=>{
 await p.getByLabel('Manual search').fill('retained');await p.evaluate(()=>{window.hold=true;window.emit()});await p.waitForFunction(()=>window.pending.length===1);
 assert.equal(await p.getByLabel('Manual search').isVisible(),false);await p.evaluate(()=>{window.hold=false;window.answer(0,'Restored source')});await p.getByRole('region',{name:'Restored source'}).waitFor();assert.equal(await p.getByLabel('Manual search').inputValue(),'retained');
});
await test('pending context request cannot replace newer authorized source',async p=>{
 await p.evaluate(()=>{window.hold=true;window.emit()});await p.waitForFunction(()=>window.pending.length===1);await p.evaluate(()=>window.emit());await p.waitForFunction(()=>window.pending.length===2);
 await p.evaluate(()=>window.answer(1,'Newest source'));await p.getByRole('region',{name:'Newest source'}).waitFor();await p.evaluate(()=>window.answer(0,'Stale privileged source'));await p.waitForTimeout(100);assert.equal(await p.getByRole('region',{name:'Stale privileged source'}).count(),0);
});
await test('denied source clears mounted data; explicit retry and reconnect restore current caller',async p=>{
 await p.evaluate(()=>{window.status=403;window.emit()});await p.getByRole('alert').waitFor();assert.equal(await p.getByLabel('Manual search').count(),0);
 await p.evaluate(()=>window.status=200);await p.getByRole('button',{name:'Retry character'}).click();await p.getByLabel('Manual search').waitFor();
 await p.evaluate(()=>window.change({isConnected:false}));await p.evaluate(()=>window.change({isConnected:true}));await p.getByLabel('Manual search').waitFor();
});
await test('host fetch callback replacement and reconnect preserve mounted manual state behind access revalidation',async p=>{
 await p.getByLabel('Manual search').fill('scope search');
 await p.evaluate(()=>{const previous=window.sdk.fetchWithAuth;window.change({fetchWithAuth:(...args)=>previous(...args)})});await p.waitForTimeout(100);
 assert.equal(await p.getByLabel('Manual search').inputValue(),'scope search');
 await p.evaluate(()=>window.change({isConnected:false}));assert.equal(await p.getByLabel('Manual search').isVisible(),false);
 await p.evaluate(()=>window.change({isConnected:true}));await p.getByLabel('Manual search').waitFor();assert.equal(await p.getByLabel('Manual search').inputValue(),'scope search');
});
await test('caller change retires old pending responses; unmount prevents all late results',async p=>{
 await p.evaluate(()=>{window.hold=true;window.emit()});await p.waitForFunction(()=>window.pending.length===1);await p.evaluate(()=>{window.hold=false;window.change({currentUser:{id:'other',role:1}})});await p.getByLabel('Manual search').waitFor();
 await p.evaluate(()=>window.answer(0,'Retired owner data'));await p.waitForTimeout(100);assert.equal(await p.getByRole('region',{name:'Retired owner data'}).count(),0);
 await p.evaluate(()=>{window.hold=true;window.emit()});await p.waitForFunction(()=>window.pending.length===2);await p.evaluate(()=>{window.unmount();window.answer(1,'After unmount')});await p.waitForTimeout(100);assert.equal(await p.locator('section').count(),0);
});
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
console.log(results.filter(r=>r.passed).length+'/'+results.length+' passed');if(results.some(r=>!r.passed))process.exitCode=1;
