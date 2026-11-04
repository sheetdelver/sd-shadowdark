/** Mounted resource card + Actor provider action recovery. Controlled SDK boundary, no network/native writes. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const baseline=process.argv.find(arg=>arg.startsWith('--baseline='))?.split('=')[1];
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';import {build} from 'esbuild';
const mod=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.resolve(process.argv[2]||path.join(mod,'temp/action-consumers'));fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(process.env.SHADOWDARK_PLAYWRIGHT_MODULE||'playwright');
const bundled=await build({stdin:{resolveDir:mod,loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import{ShadowdarkActorProvider,useShadowdarkActor}from'${mod}/src/ui/context/ShadowdarkActorContext';
import{ShadowdarkUIProvider}from'${mod}/src/ui/context/ShadowdarkUIContext';
import Resource from'${mod}/src/ui/components/ResourceDetailModal';
import CustomBoonModal from'${mod}/src/ui/components/CustomBoonModal';
import{prepareShadowdarkView}from'${mod}/src/logic/prepared-view';
import{primLike}from'${mod}/src/tests/fixtures/native-406';
const listeners=new Set();window.retire=()=>listeners.forEach(fn=>fn({keys:[]}));
window.bodies=[];window.notices=[];window.refreshes=0;window.shares=[];
window.sdk={worldId:'controlled',isConnected:true,currentUser:{id:'p',role:1},foundryUrl:'',resolveImageUrl:x=>x||'',addNotification:(...args)=>window.notices.push(args),events:{on:(_,fn)=>{listeners.add(fn);return()=>listeners.delete(fn)}},fetchWithAuth:async(url,options={})=>{if(url.endsWith('/items/chat')){window.shares.push(JSON.parse(options.body));if(window.initial.share==='pending')return new Promise(resolve=>window.resolveShare=()=>resolve(Response.json({posted:true})));if(window.initial.share==='network'&&window.shares.length===1)throw Error('Lost response');return Response.json({posted:true});}return Response.json({nameIndex:{}});}};
const source=primLike();source._id='controlled';source.system.class='Item.class';source.items=[];source.effects=[];
const classDoc={name:'Wizard',type:'Class',system:{spellcasting:{ability:'int',class:''}}};
if(window.initial.kind==='ability')source.items=[{_id:'resource',name:'Native-shaped ability',type:'Class Ability',system:{ability:'wis',dc:10,limitedUses:true,uses:{available:1,max:1},loseOnFailure:true},effects:[]}];
else{source.items=[{_id:'resource',name:'Controlled spell',type:'Spell',system:{tier:1,class:['Item.class'],lost:false,duration:{type:window.initial.duration??'instant'}},effects:[]}];
if(window.initial.kind==='npc'){source.type='NPC';source.system.spellcasting={ability:'int',bonus:2,attacks:1};source.system.abilities=Object.fromEntries(['str','dex','con','int','wis','cha'].map(k=>[k,{mod:0}]));}
else source.effects=[{_id:'grant',changes:[{key:'system.spellcasting.classes',mode:2,value:'wizard'}]}];}
const prepared=()=>({...structuredClone(source),id:source._id,canEdit:window.initial.owner!==false,derived:prepareShadowdarkView(source,{classDocument:()=>classDoc,label:()=>classDoc.name})});
function Controls(){const actor=useShadowdarkActor();return <><button onClick={()=>actor.openCard({kind:'item',itemId:'resource'})}>Open resource</button>{actor.rollDialog.open&&<div role="dialog" aria-label="Controlled SDK roller" style={{position:'fixed',inset:0,zIndex:100,background:'white'}}><button onClick={()=>actor.rollDialog.callback?.({manualValue:5})}>Submit prepared roll</button></div>}<Resource/></>;}
const noop=async()=>{};
function App(){const [actor,setActor]=React.useState(prepared);if(window.initial.customBoon)return <CustomBoonModal isOpen onClose={()=>window.boonClosed=true} onCreate={async data=>{window.createdBoon=data;return true}} onUpdate={async(id,patch)=>{window.updatedBoon={id,patch};return true}} initialData={window.initial.customBoon==='edit'?{_id:'old-boon',name:'Old boon',system:{boonType:'blessing',level:1},effects:[{_id:'preserved',name:'Existing effect',changes:[{key:'system.attributes.ac.value',mode:2,value:'3'}]}]}:undefined}/>;return <ShadowdarkUIProvider><ShadowdarkActorProvider actor={actor} onUpdate={noop} onDeleteItem={noop} onCreateItem={noop} onUpdateItem={noop} onRoll={noop} onToggleEffect={noop} onDeleteEffect={noop} onCreateEffect={noop} onUpdateEffect={noop} onRefresh={async()=>{window.refreshes++;setActor(prepared())}} onAction={async body=>{window.bodies.push(structuredClone(body));if(window.initial.response==='pending')return new Promise(resolve=>window.resolveAction=resolve);if(window.initial.response==='network'&&window.bodies.length===1)throw Error('Controlled lost response');if(window.initial.response==='uncertain'){source.items[0].system.uses.available=0;return{success:true,state:'partial',phase:'result-uncertain',retryable:false,consequences:[{status:'applied',description:'One use spent'}],warnings:['Result receipt unavailable']};}return{success:true,state:'complete',outcome:{total:5,natural:null,success:false,criticalSuccess:false,criticalFailure:false},consequences:[]};}}><Controls/></ShadowdarkActorProvider></ShadowdarkUIProvider>;}
createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',plugins:[{name:'sdk-boundary',setup(b){
 if(baseline)b.onLoad({filter:/ShadowdarkActorContext\.tsx$/},a=>({loader:'tsx',resolveDir:path.dirname(a.path),contents:execFileSync('git',['show',baseline+':src/ui/context/ShadowdarkActorContext.tsx'],{cwd:mod,encoding:'utf8'})}));
 b.onResolve({filter:/^@sheet-delver\/sdk(?:\/react)?$/},a=>({path:a.path,namespace:'sdk'}));
 b.onLoad({filter:/.*/,namespace:'sdk'},a=>({loader:'tsx',contents:a.path.endsWith('/react')?'export const useSDK=()=>window.sdk;':'export const logger={info(){},warn(){},error(){},debug(){}};export const processHtmlContent=x=>x;export const getErrorMessage=e=>String(e);'}));
}}]});
const browser=await chromium.launch({...(process.env.SHADOWDARK_CHROME?{executablePath:process.env.SHADOWDARK_CHROME}:{}),headless:true,args:['--no-sandbox','--disable-background-networking']});const results=[];
async function test(name,initial,run){const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(5000);await page.route('**/*',r=>r.request().url()==='http://shadowdark.test/'?r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}):r.abort());try{await page.goto('http://shadowdark.test/');await page.evaluate(value=>window.initial=value,initial);await page.addScriptTag({content:bundled.outputFiles[0].text});await run(page);assert.deepEqual(errors,[]);results.push({name,passed:true});console.log('✓',name);}catch(e){results.push({name,passed:false,error:e.message,errors,text:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,`${results.length}-failure.png`)});console.error('✗',name,e.message);}finally{await page.close();}}
try{
 await test('Shared custom-boon editor builds native effect rows',{customBoon:'create'},async p=>{
  await p.getByRole('textbox',{name:'Name',exact:true}).fill('Ward');
  await p.getByLabel('Add boon effect',{exact:true}).selectOption('acBonus');
  await p.getByLabel('Effect 1 name',{exact:true}).fill('Ward armor');await p.getByLabel('Change 1 value',{exact:true}).fill('2');
  await p.getByLabel('Change 1 operation',{exact:true}).selectOption('4');await p.getByLabel('Effect 1 enabled',{exact:true}).uncheck();
  await p.getByRole('button',{name:'Create Boon',exact:true}).click();await p.waitForFunction(()=>window.boonClosed===true);
  const item=await p.evaluate(()=>window.createdBoon);assert.equal(item.type,'Boon');assert.equal(item.effects[0].name,'Ward armor');assert.equal(item.effects[0].disabled,true);assert.equal(item.effects[0].changes[0].key,'system.attributes.ac.value');assert.equal(item.effects[0].changes[0].mode,4);assert.equal(item.effects[0].changes[0].value,'2');
 });
 await test('Existing-boon editing preserves effects instead of rebuilding them',{customBoon:'edit'},async p=>{
  assert.equal(await p.getByLabel('Add boon effect',{exact:true}).count(),0);await p.getByRole('textbox',{name:'Name',exact:true}).fill('Renamed boon');
  await p.getByRole('button',{name:'Save Boon',exact:true}).click();await p.waitForFunction(()=>window.boonClosed===true);
  assert.deepEqual(await p.evaluate(()=>window.updatedBoon),{id:'old-boon',patch:{name:'Renamed boon'}});
 });
 for(const width of [390,1000])await test(`Shared card action at ${width}px is informational and preserves retry identity`,{kind:'ability',share:'network'},async p=>{
  await p.setViewportSize({width,height:900});
  const {compileModuleTailwind}=await import(pathToFileURL(path.join(process.cwd(),'src/scripts/tools/modules/tailwind-compile.ts')).href);
  await p.addStyleTag({content:await compileModuleTailwind(mod,'shadowdark')});
  await p.addStyleTag({path:path.join(mod,'assets/presentation.css')});
  await p.evaluate(()=>document.getElementById('root').classList.add('sdk-module--shadowdark'));
  await p.getByRole('button',{name:'Open resource'}).click();
  await p.getByRole('button',{name:'Share to chat',exact:true}).click();
  await p.getByText('Sharing could not be confirmed. Check chat before trying again.',{exact:true}).waitFor();
  await p.getByRole('button',{name:'Share to chat',exact:true}).click();
  await p.getByText('Shared to chat.',{exact:true}).waitFor();
  assert.deepEqual(await p.evaluate(()=>window.shares[0]),await p.evaluate(()=>window.shares[1]));
  assert.equal(await p.evaluate(()=>window.bodies.length),0);
  await p.screenshot({path:path.join(out,`share-card-${width}.png`),fullPage:true});
  const bounds=await p.getByRole('button',{name:'Share to chat',exact:true}).boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=width);
 });
 await test('Observer cards omit sharing',{kind:'ability',owner:false},async p=>{await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('dialog').waitFor();assert.equal(await p.getByRole('button',{name:'Share to chat',exact:true}).count(),0);});
 await test('Sharing retires on context change and suppresses late success',{kind:'ability',share:'pending'},async p=>{
  await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('button',{name:'Share to chat',exact:true}).click();
  await p.waitForFunction(()=>typeof window.resolveShare==='function');await p.evaluate(()=>window.retire());await p.evaluate(()=>window.resolveShare());
  await p.getByText('Refresh the character before sharing.',{exact:true}).waitFor();assert.equal(await p.getByText('Shared to chat.',{exact:true}).count(),0);assert.equal(await p.evaluate(()=>window.shares.length),1);
 });
 await test('SD02-09 actual card/provider retries the identical recorded payload after a lost response',{kind:'ability',response:'network'},async p=>{await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).click();await p.getByRole('button',{name:'Submit prepared roll'}).click();await p.getByRole('button',{name:'Retry recorded action'}).click();await p.waitForFunction(()=>window.bodies.length===2);assert.deepEqual(await p.evaluate(()=>window.bodies[0]),await p.evaluate(()=>window.bodies[1]));});
 await test('SD02-09 uncertain result shows spent state and blocks a fresh action until review',{kind:'ability',response:'uncertain'},async p=>{await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).click();await p.getByRole('button',{name:'Submit prepared roll'}).click();await p.getByText(/result-uncertain/).waitFor();assert.equal(await p.getByRole('button',{name:'Retry recorded action'}).count(),0);await p.getByRole('button',{name:'Review refreshed Actor and close'}).click();await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).isDisabled(),true);assert.equal(await p.evaluate(()=>window.bodies.length),1);});
 await test('SD02 pending action retires on empty-key context without publishing stale result or enabling replay',{kind:'ability',response:'pending'},async p=>{
  await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).click();await p.getByRole('button',{name:'Submit prepared roll'}).click();await p.waitForFunction(()=>typeof window.resolveAction==='function');
  await p.evaluate(()=>window.retire());await p.getByText(/Character context changed/).waitFor();
  await p.evaluate(()=>window.resolveAction({success:true,state:'partial',phase:'Stale response must not render',retryable:true,warnings:['Stale notice must not publish']}));await p.waitForTimeout(100);
  assert.equal(await p.getByText('Stale response must not render',{exact:false}).count(),0);assert.equal(await p.getByRole('button',{name:'Retry recorded action'}).count(),0);assert.equal(await p.evaluate(()=>window.bodies.length),1);assert.equal(await p.evaluate(()=>window.notices.some(row=>String(row[0]).includes('Stale notice'))),false);
 });
 await test('SD02 context change cancels a mounted roller callback before any request',{kind:'ability'},async p=>{
  await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('button',{name:'Use Native-shaped ability',exact:true}).click();await p.getByRole('button',{name:'Submit prepared roll'}).waitFor();await p.evaluate(()=>window.retire());await p.getByRole('button',{name:'Submit prepared roll'}).waitFor({state:'hidden'});assert.equal(await p.evaluate(()=>window.bodies.length),0);
 });
 for(const kind of ['npc','player'])for(const duration of ['focus','instant'])await test(`SD02-11 actual ${kind} ${duration} owned resource card focus policy`,{kind,duration},async p=>{await p.getByRole('button',{name:'Open resource'}).click();await p.getByRole('dialog').waitFor();assert.equal(await p.getByRole('checkbox',{name:/Focus check/}).count(),kind==='player'&&duration==='focus'?1:0);});
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
console.log(`${results.filter(row=>row.passed).length}/${results.length} passed`);if(results.some(row=>!row.passed))process.exitCode=1;
