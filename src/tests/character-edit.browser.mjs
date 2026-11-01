/** Mounted sheets/provider/editor with source effects; isolated SDK, no live writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),core=process.cwd();
const out=process.argv[2]||'/tmp/sd-character-edit-browser'; fs.mkdirSync(out,{recursive:true});
const { chromium }=await import(process.env.SHADOWDARK_PLAYWRIGHT_MODULE||'playwright');
const {compileModuleTailwind}=await import(pathToFileURL(path.join(core,'src/scripts/tools/modules/tailwind-compile.ts')).href);
const css=process.env.SHADOWDARK_EDIT_CSS ? fs.readFileSync(process.env.SHADOWDARK_EDIT_CSS,'utf8') : await compileModuleTailwind(root,'shadowdark');
const host=(await postcss([tailwind({base:core})]).process(fs.readFileSync(path.join(core,'src/app/globals.css'),'utf8'),{from:path.join(core,'src/app/globals.css')})).css;
const bundle=await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';
import{ShadowdarkActorProvider}from'${root}/src/ui/context/ShadowdarkActorContext';
import{ShadowdarkUIProvider}from'${root}/src/ui/context/ShadowdarkUIContext';
import Sheet from'${root}/src/ui/ShadowdarkSheet';
import{ShadowdarkNormalizer}from'${root}/src/logic/normalization';
import{primLike}from'${root}/src/tests/fixtures/native-406';
window.calls=[];window.notices=[];
window.sdk={worldId:'offline',isConnected:true,currentUser:{id:'owner',role:1},resolveImageUrl:()=>'',addNotification:(...v)=>window.notices.push(v),events:{on:()=>()=>{}},fetchWithAuth:async()=>Response.json({nameIndex:{}})};
const source=primLike();source.name='Mira';source.system.abilities.str.value=12;source.system.attributes.hp={value:6,max:10};source.items=[];
source.effects=[{_id:'bonus',name:'Existing bonus',disabled:false,changes:[{key:'system.abilities.str.value',mode:2,value:'2'},{key:'system.attributes.hp.max',mode:2,value:'5'}]}];
const prepared=()=>({...source,...ShadowdarkNormalizer.normalizeActorData(source,{}),canEdit:window.initial.owner,type:'Player'});
const noop=async()=>{};
function App(){const[actor,setActor]=React.useState(prepared);window.externalChange=()=>{source.system.abilities.str.value=16;setActor(prepared())};window.source=source;
return <ShadowdarkUIProvider><ShadowdarkActorProvider actor={actor} onUpdate={noop} onPatch={async patch=>{window.calls.push(patch);if(window.fail)throw Error('Controlled rejection');for(const[key,value]of Object.entries(patch)){const keys=key.split('.');let target=source;while(keys.length>1)target=target[keys.shift()];target[keys[0]]=value;}setActor(prepared())}} onDeleteItem={noop} onCreateItem={noop} onUpdateItem={noop} onRoll={noop} onToggleEffect={noop} onDeleteEffect={noop} onCreateEffect={noop} onUpdateEffect={noop} onRefresh={noop}><Sheet/></ShadowdarkActorProvider></ShadowdarkUIProvider>}
createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',plugins:[{name:'sdk',setup(b){
 b.onResolve({filter:/^@sheet-delver\/sdk(?:\/react)?$/},a=>({path:a.path,namespace:'sdk'}));
 b.onLoad({filter:/.*/,namespace:'sdk'},a=>({loader:'tsx',contents:a.path.endsWith('/react')?'export const useSDK=()=>window.sdk;export const useSDKComponents=()=>({LoadingModal:()=>null,RollDialog:()=>null,ConfirmationModal:()=>null,RichTextEditor:()=>null});':'export const logger={info(){},warn(){},error(){},debug(){}};export const processHtmlContent=x=>x;export const getErrorMessage=e=>String(e);'}));
}}]});
const browser=await chromium.launch({executablePath:process.env.SHADOWDARK_CHROME,headless:true,args:['--no-sandbox','--disable-background-networking']});
const results=[];
try{for(const view of ['simple','advanced'])for(const width of [390,1000]){
 const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);
 try{await page.route('**/*',r=>r.request().url()==='http://shadowdark.test/'?r.fulfill({contentType:'text/html',body:'<div class="sdk-module--shadowdark" id="root"></div>'}):r.abort());await page.goto('http://shadowdark.test/');await page.evaluate(view=>{localStorage.setItem('shadowdark_view_mode',view);window.initial={owner:true}},view);
 await page.addStyleTag({content:host});await page.addStyleTag({content:css});await page.addStyleTag({path:path.join(root,'assets/presentation.css')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 const controls=page.getByRole('group',{name:'Character sheet controls'});
 await controls.getByRole('button',{name:view==='simple'?'Tabbed':'Single',exact:true}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('shadowdark_view_mode')),view==='simple'?'advanced':'simple');
 await controls.getByRole('button',{name:view==='simple'?'Single':'Tabbed',exact:true}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('shadowdark_view_mode')),view);
 await page.getByRole('group',{name:'Character sheet controls'}).getByRole('button',{name:'Edit',exact:true}).waitFor();await page.screenshot({path:path.join(out,view+'-'+width+'-header.png')});
 await page.getByRole('group',{name:'Character sheet controls'}).getByRole('button',{name:'Edit',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Edit character',exact:true});await dialog.waitFor();
 assert.equal(await dialog.getByLabel('Strength (base)',{exact:true}).inputValue(),'12');assert.equal(await dialog.getByLabel('Maximum HP (base)',{exact:true}).inputValue(),'10');
 await dialog.getByText('Current sheet total: 14',{exact:true}).waitFor();await dialog.getByText('Current sheet total: 15',{exact:true}).waitFor();
 await dialog.getByLabel('Name',{exact:true}).fill('');assert.equal(await page.getByRole('button',{name:'Save',exact:true}).isDisabled(),true);await dialog.getByLabel('Name',{exact:true}).fill('Changed');await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await page.evaluate(()=>window.calls.length),0);
 await page.getByRole('group',{name:'Character sheet controls'}).getByRole('button',{name:'Edit',exact:true}).click();await dialog.getByLabel('Strength (base)',{exact:true}).fill('13');await dialog.getByLabel('Maximum HP (base)',{exact:true}).fill('11');await dialog.getByLabel('Name',{exact:true}).fill('Mira II');
 await page.screenshot({path:path.join(out,view+'-'+width+'.png')});assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.getByRole('button',{name:'Save',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual(await page.evaluate(()=>window.calls[0]),{name:'Mira II','system.abilities.str.value':13,'system.attributes.hp.max':11});assert.equal(await page.evaluate(()=>window.source.system.attributes.hp.value),6);assert.equal(await page.evaluate(()=>window.source.effects.length),1);
 await page.getByRole('group',{name:'Character sheet controls'}).getByRole('button',{name:'Edit',exact:true}).click();await page.evaluate(()=>window.externalChange());await dialog.getByRole('button',{name:'Reload values'}).click();assert.equal(await dialog.getByLabel('Strength (base)',{exact:true}).inputValue(),'16');
 await dialog.getByLabel('Name',{exact:true}).fill('Reject me');await page.evaluate(()=>window.fail=true);await page.getByRole('button',{name:'Save',exact:true}).click();await dialog.getByText(/Could not confirm the save/).waitFor();assert.equal(await page.evaluate(()=>window.source.name),'Mira II');
 assert.deepEqual(errors,[]);results.push({view,width,passed:true});
 }catch(e){results.push({view,width,passed:false,error:String(e),errors,text:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,view+'-'+width+'-failure.png')});}finally{await page.close();}
}}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));}
console.log(JSON.stringify(results));if(results.some(r=>!r.passed))process.exitCode=1;
