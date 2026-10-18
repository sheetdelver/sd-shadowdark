/** Mounted resource card + Actor provider action recovery. Controlled SDK boundary, no network/native writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {build} from 'esbuild';
const mod=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(process.argv[2]||path.join(mod,'temp/action-consumers'));fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.SHADOWDARK_PLAYWRIGHT_MODULE||'playwright');
const bundled=await build({stdin:{resolveDir:mod,loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import{ShadowdarkActorProvider,useShadowdarkActor}from'${mod}/src/ui/context/ShadowdarkActorContext';
import{ShadowdarkUIProvider}from'${mod}/src/ui/context/ShadowdarkUIContext';
import Resource from'${mod}/src/ui/components/ResourceDetailModal';
import{prepareShadowdarkView}from'${mod}/src/logic/prepared-view';
import{primLike}from'${mod}/src/tests/fixtures/native-406';
window.bodies=[];window.notices=[];window.refreshes=0;
window.sdk={worldId:'controlled',isConnected:true,currentUser:{id:'p',role:1},foundryUrl:'',resolveImageUrl:x=>x||'',addNotification:(...args)=>window.notices.push(args),events:{on:()=>()=>{}},fetchWithAuth:async()=>Response.json({nameIndex:{}})};
const source=primLike();source._id='controlled';source.system.class='Item.class';source.items=[];source.effects=[];
const classDoc={name:'Wizard',type:'Class',system:{spellcasting:{ability:'int',class:''}}};
if(window.initial.kind==='ability')source.items=[{_id:'resource',name:'Native-shaped ability',type:'Class Ability',system:{ability:'wis',dc:10,limitedUses:true,uses:{available:1,max:1},loseOnFailure:true},effects:[]}];
else{source.items=[{_id:'resource',name:'Controlled spell',type:'Spell',system:{tier:1,class:['Item.class'],lost:false},effects:[]}];
if(window.initial.kind==='npc'){source.type='NPC';source.system.spellcasting={ability:'int',bonus:2,attacks:1};source.system.abilities=Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{mod:0}]));}
else source.effects=[{_id:'grant',changes:[{key:'system.spellcasting.classes',mode:2,value:'wizard'}]}];}
const prepared=()=>({...structuredClone(source),id:source._id,derived:prepareShadowdarkView(source,{classDocument:()=>classDoc,label:()=>classDoc.name})});
function Controls(){const actor=useShadowdarkActor();return <><button onClick={()=>actor.openCard({kind:'item',itemId:'resource'})}>Open resource</button>{actor.rollDialog.open&&<div role="dialog" aria-label="Controlled SDK roller" style={{position:'fixed',inset:0,zIndex:100,background:'white'}}><button onClick={()=>actor.rollDialog.callback?.({manualValue:5})}>Submit prepared roll</button></div>}<Resource/></>;}
const noop=async()=>{};
function App(){const [actor,setActor]=React.useState(prepared);return <ShadowdarkUIProvider><ShadowdarkActorProvider actor={actor} onUpdate={noop} onDeleteItem={noop} onCreateItem={noop} onUpdateItem={noop} onRoll={noop} onToggleEffect={noop} onDeleteEffect={noop} onCreateEffect={noop} onUpdateEffect={noop} onRefresh={async()=>{window.refreshes++;setActor(prepared())}} onAction={async body=>{window.bodies.push(structuredClone(body));if(window.initial.response==='network'&&window.bodies.length===1)throw Error('Controlled lost response');if(window.initial.response==='uncertain'){source.items[0].system.uses.available=0;return{success:true,state:'partial',phase:'result-uncertain',retryable:false,consequences:[{status:'applied',description:'One use spent'}],warnings:['Result receipt unavailable']};}return{success:true,state:'complete',outcome:{total:5,natural:null,success:false,criticalSuccess:false,criticalFailure:false},consequences:[]};}}><Controls/></ShadowdarkActorProvider></ShadowdarkUIProvider>;}
createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',plugins:[{name:'sdk-boundary',setup(b){
 b.onResolve({filter:/^@sheet-delver\/sdk(?:\/react)?$/},a=>({path:a.path,namespace:'sdk'}));
 b.onLoad({filter:/.*/,namespace:'sdk'},a=>({loader:'tsx',contents:a.path.endsWith('/react')?'export const useSDK=()=>window.sdk;':'export const logger={info(){},warn(){},error(){},debug(){}};export const processHtmlContent=x=>x;export const getErrorMessage=e=>String(e);'}));
}}]});
const browser=await chromium.launch({...(process.env.SHADOWDARK_CHROME?{executablePath:process.env.SHADOWDARK_CHROME}:{}),headless:true,args:['--no-sandbox','--disable-background-networking']});const results=[];
async function test(name,initial,run){const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);await page.route('**/*',r=>r.request().url()==='http://shadowdark.test/'?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort());try{await page.goto('http://shadowdark.test/');await page.evaluate(value=>window.initial=value,initial);await page.addScriptTag({content:bundled.outputFiles[0].text});await run(page);assert.deepEqual(errors,[]);results.push({name,passed:true});console.log('✓',name);}catch(e){results.push({name,passed:false,error:e.message,errors,text:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,`${results.length}-failure.png`)});console.error('✗',name,e.message);}finally{await page.close();}}
try{
 await test('SD02-09 actual card/provider retries the identical recorded payload after a lost response',{kind:'ability',response:'network'},async p=>{await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).click();await p.getByRole('button',{name:'Submit prepared roll'}).click();await p.getByRole('button',{name:'Retry recorded action'}).click();await p.waitForFunction(()=>window.bodies.length===2);assert.deepEqual(await p.evaluate(()=>window.bodies[0]),await p.evaluate(()=>window.bodies[1]));});
 await test('SD02-09 uncertain result shows spent state and blocks a fresh action until review',{kind:'ability',response:'uncertain'},async p=>{await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).click();await p.getByRole('button',{name:'Submit prepared roll'}).click();await p.getByText(/result-uncertain/).waitFor();assert.equal(await p.getByRole('button',{name:'Retry recorded action'}).count(),0);await p.getByRole('button',{name:'Review refreshed Actor and close'}).click();await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).isDisabled(),true);assert.equal(await p.evaluate(()=>window.bodies.length),1);});
 for(const kind of ['npc','player'])await test(`SD02-11 actual ${kind} owned resource card focus policy`,{kind},async p=>{await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('dialog').waitFor();assert.equal(await p.getByRole('checkbox',{name:/Focus check/}).count(),kind==='player'?1:0);});
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
console.log(`${results.filter(row=>row.passed).length}/${results.length} passed`);if(results.some(row=>!row.passed))process.exitCode=1;
