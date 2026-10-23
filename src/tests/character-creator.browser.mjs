/** Mounted seven-stage creator + real server routes. Controlled public SDK
 * boundary, blocked network, no host/Foundry processes. Run via tsx. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { creatorRows as rows, creatorSources as sources } from './fixtures/creator.ts';
import { worldSnapshot } from './fixtures/native-406.ts';
import { shadowdarkAdapter as adapter } from '../server/ShadowdarkAdapter.ts';
import { handleCreatorPrepare,handleCreatorCreate,handleCreatorStatus,handleCreatorRoll,handleCreatorHP } from '../server/api/character-creator.ts';
const { chromium }=await import(process.env.SHADOWDARK_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),core=path.resolve(process.env.SHADOWDARK_CORE||process.cwd());
const out=path.resolve(process.argv[2]||path.join(root,'temp/creator-browser'));fs.mkdirSync(out,{recursive:true});
const hostCss=(await postcss([tailwind({base:core})]).process(fs.readFileSync(path.join(core,'src/app/globals.css'),'utf8'),{from:path.join(core,'src/app/globals.css')})).css;
const {compileModuleTailwind}=await import(pathToFileURL(path.join(core,'src/scripts/tools/modules/tailwind-compile.ts')).href);
const previousDirectory=process.cwd();process.chdir(core);
const moduleCss=process.env.SHADOWDARK_CREATOR_CSS?fs.readFileSync(process.env.SHADOWDARK_CREATOR_CSS,'utf8'):await compileModuleTailwind(root,'shadowdark');process.chdir(previousDirectory);
const creatorImport=process.env.SHADOWDARK_CREATOR_UI?`import manifest from ${JSON.stringify(process.env.SHADOWDARK_CREATOR_UI)};const Creator=React.lazy(manifest.tools.creator);`:`import Creator from '${root}/src/ui/tools/CharacterCreator';`;
const bundle=await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';${creatorImport}
window.calls=[];window.pending=[];window.pendingStatuses=[];const listeners=new Map();
window.sdk={isConnected:true,worldId:'w',moduleId:'shadowdark',currentUser:{id:'owner',role:1},foundryUrl:'',resolveImageUrl:x=>x||'',navigate:target=>window.testNavigation=target,
 events:{on:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return()=>listeners.get(event).delete(fn)}},
 fetchWithAuth:async(url,options={})=>{const body=options.body?JSON.parse(options.body):null;window.calls.push({url,body});
  const result=await window.request(url,body,window.sdk.currentUser.id);if(window.hold&&url.endsWith('/prepare'))await new Promise(resolve=>window.pending.push(resolve));if(window.holdStatuses&&url.endsWith('/status'))await new Promise(resolve=>window.pendingStatuses.push(resolve));return Response.json(result.body,{status:result.status});}};
window.emitContext=()=>listeners.get('world:contextChanged')?.forEach(fn=>fn({keys:[]}));
const app=createRoot(document.getElementById('root'));window.render=()=>app.render(<React.Suspense fallback={<p>Loading creator…</p>}><Creator/></React.Suspense>);window.render();
`},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',nodePaths:[path.join(core,'node_modules')],plugins:[{name:'public-sdk-boundary',setup(b){
    b.onResolve({filter:/^(?:@sheet-delver\/sdk(?:\/react)?|@shared\/sdk\/react)$/},a=>({path:a.path,namespace:'stub'}));
    b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'tsx',resolveDir:root,contents:a.path.endsWith('/react')?`import PageHeader from '${path.resolve(process.env.SHADOWDARK_CORE||process.cwd())}/src/client/ui/components/PageHeader.tsx';import {ConfirmationModal} from '${core}/src/client/ui/components/ConfirmationModal.tsx';export const useSDK=()=>window.sdk;export const useSDKComponents=()=>({PageHeader,ConfirmationModal});`:`export const logger={info(){},warn(){},error(){},debug(){}};export const processHtmlContent=x=>x;export const getErrorMessage=e=>String(e);`}));
}}]});
let writes=0,rolls=0,revision=1;
const store=new Map(),actors=new Map();
const runtime={world:{snapshot:()=>worldSnapshot(revision),assertRevision:r=>{if(r!==revision)throw Error('Retired');}},access:{canReadPack:()=>true,packs:()=>[]},
    compendium:{findAll:async type=>structuredClone(rows.filter(d=>type==='RollTable'?d.results:type==='Item'?!d.results:false)),getById:async(type,uuid)=>structuredClone(sources.get(uuid)||null)},
    dataStore:{get:async key=>structuredClone(store.get(key)||null),set:async(key,value)=>{store.set(key,structuredClone(value));},keys:async(prefix='')=>[...store.keys()].filter(k=>k.startsWith(prefix))},
    documents:{get:async(type,id)=>structuredClone(type==='Actor'?actors.get(id)||null:null),list:async()=>({rows:[...actors.values()],total:actors.size}),
        create:async(type,source)=>{writes++;const actor={...structuredClone(source),_id:'created-'+writes};actors.set(actor._id,actor);return actor;}},
    rolls:{roll:async formula=>{rolls++;return{formula,total:11};}}};
await adapter.initialize({...runtime,logger:console});
const handlers={prepare:handleCreatorPrepare,create:handleCreatorCreate,status:handleCreatorStatus,roll:handleCreatorRoll,hp:handleCreatorHP};
const browser=await chromium.launch({...(process.env.SHADOWDARK_CHROME?{executablePath:process.env.SHADOWDARK_CHROME}:{}),headless:true,args:['--no-sandbox','--disable-background-networking']});
const results=[];
async function test(name,width,run){
    store.clear();actors.clear();const page=await browser.newPage({viewport:{width,height:1100}}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
    await page.exposeFunction('request',async(url,body,userId)=>{
        if(url.endsWith('/index'))return{status:200,body:await adapter.getSystemDataForUser(runtime)};
        if(url.includes('/fetch-pack/'))return{status:200,body:await adapter.getCollection(url.split('/').at(-1),{caller:{runtime,isGM:false}})};
        const handler=handlers[url.split('/').at(-1)];if(!handler)throw Error('Unexpected route '+url);
        const response=await handler({runtime,userSession:{userId},json:async()=>structuredClone(body)});return{status:response.status,body:await response.json()};
    });
    try{
        await page.setContent('<div id="root" class="sdk-module--shadowdark"></div>');await page.addStyleTag({content:hostCss});await page.addStyleTag({content:moduleCss});await page.addStyleTag({path:process.env.SHADOWDARK_CREATOR_PRESENTATION||path.join(root,'assets/presentation.css')});await page.addScriptTag({content:bundle.outputFiles[0].text});
        await run(page);assert.deepEqual(errors,[]);results.push({name,pass:true});console.log('✓ '+name);
    }catch(e){results.push({name,pass:false,error:String(e),errors,text:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'failure-'+results.length+'.png')});console.error('✗ '+name+': '+e.message);}finally{await page.close();}
}
const waitPlan=async p=>{await p.waitForFunction(()=>window.calls.some(c=>c.url.endsWith('/prepare')));await p.waitForTimeout(450);};
const step=async(p,name)=>{await p.getByRole('button',{name:new RegExp('^\\d\\. '+name+'$')}).click();};
const pick=async(p,title,name)=>{
    const field=p.locator('.sd-creator-field').filter({has:p.locator('span',{hasText:new RegExp('^'+title+'(?: \\*)?$')})});await field.getByRole('button').first().click();
    await p.getByRole('button',{name:new RegExp('^'+name+' —')}).click();await waitPlan(p);
};
try{
    for(const width of [390,1280])await test(`manual wizard ${width}px: paper entries, Back, prepared review and single creation`,width,async p=>{
        const before=writes,beforeRolls=rolls;await p.getByLabel('Name',{exact:true}).fill('Paper hero');await p.getByLabel('Level',{exact:true}).selectOption('20');
        await pick(p,'Class','Wizard');await pick(p,'Ancestry','Human');
        await p.screenshot({path:path.join(out,`identity-${width}.png`),fullPage:true});
        await step(p,'Ability scores');
        for(const stat of ['STR','DEX','CON','INT','WIS','CHA'])await p.locator('label').filter({has:p.locator('span',{hasText:new RegExp('^'+stat+'$')})}).locator('input').fill(stat==='STR'?'16':'12');
        await step(p,'Identity');assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Paper hero');await step(p,'Ability scores');assert.equal(await p.locator('label').filter({has:p.locator('span',{hasText:/^STR$/})}).locator('input').inputValue(),'16');
        await waitPlan(p);await p.screenshot({path:path.join(out,`scores-${width}.png`),fullPage:true});
        await step(p,'Talents and boons');await waitPlan(p);assert.equal(writes,before);assert.equal(rolls,beforeRolls);
        await p.screenshot({path:path.join(out,`grants-${width}.png`),fullPage:true});
        await step(p,'Languages and spells');await step(p,'Hit points');await p.locator('label').filter({has:p.locator('span',{hasText:/^Current HP$/})}).locator('input').fill('0');await p.locator('label').filter({has:p.locator('span',{hasText:/^Maximum HP$/})}).locator('input').fill('29');
        await step(p,'Equipment and money');await p.getByLabel('GP',{exact:true}).fill('17');await p.getByRole('button',{name:'Add equipment',exact:true}).click();await p.getByPlaceholder('Search gear...').fill('Rope');
        // The real gear selector's Add callback is exercised, retaining its exact origin.
        const add=p.getByRole('button',{name:/Add Rope/});if(await add.count())await add.first().click();else {await p.keyboard.press('Escape');}
        await step(p,'Review and create');await waitPlan(p);await p.getByText('No spell allowance is defined for this level; enter the spells on your sheet. No progression is extrapolated.',{exact:true}).waitFor();
        while(await p.locator('.sd-creator-notice input[type=checkbox]:not(:checked)').count()){await p.locator('.sd-creator-notice input[type=checkbox]:not(:checked)').first().check();await waitPlan(p);}
        await p.getByRole('button',{name:'Create character',exact:true}).waitFor();await p.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Create character')?.disabled);
        assert.equal(writes,before);assert.equal(rolls,beforeRolls);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await p.screenshot({path:path.join(out,`review-${width}.png`),fullPage:true});
        await p.getByRole('button',{name:'Create character',exact:true}).click();await p.getByRole('alertdialog',{name:'Create this character?'}).getByRole('button',{name:'Continue'}).click();await p.getByRole('button',{name:'Open character',exact:true}).waitFor();assert.equal(writes,before+1);
        const source=[...actors.values()][0];assert.equal(source.system.level.value,20);assert.equal(source.system.attributes.hp.value,0);assert.equal(source.system.attributes.hp.max,29);assert.equal(source.system.coins.gp,17);
        if(width===390){
            await p.evaluate(()=>window.holdStatuses=true);await p.getByRole('button',{name:'Check creation',exact:true}).click();await p.waitForFunction(()=>window.pendingStatuses.length>0);
            await p.evaluate(()=>{window.sdk.currentUser={id:'new-caller',role:1};window.render();});await p.waitForFunction(()=>document.querySelector('input')?.value==='');
            await p.evaluate(()=>{window.holdStatuses=false;window.pendingStatuses.splice(0).forEach(fn=>fn());});await p.waitForTimeout(300);assert.equal(await p.getByRole('button',{name:'Open character',exact:true}).count(),0,'retired explicit status must not publish another caller’s receipt');
        }
    });
    await test('explicit rolls ask before replacing typed scores; no navigation rolls',900,async p=>{
        await step(p,'Ability scores');await p.locator('label').filter({has:p.locator('span',{hasText:/^STR$/})}).locator('input').fill('16');const before=rolls;
        await p.getByRole('button',{name:'Roll STR',exact:true}).click();await p.getByRole('alertdialog',{name:'Replace entered scores?'}).getByRole('button',{name:'Cancel'}).click();assert.equal(rolls,before);
        await p.getByRole('button',{name:'Roll STR',exact:true}).click();await p.getByRole('alertdialog',{name:'Replace entered scores?'}).getByRole('button',{name:'Continue'}).click();await p.waitForFunction(()=>document.querySelector('input[type=number]')?.value==='11');assert.equal(rolls,before+1);
        await p.getByRole('button',{name:'Next',exact:true}).click();assert.equal(rolls,before+1);
        await p.getByRole('button',{name:'Back to Dashboard'}).click();await p.getByRole('alertdialog',{name:'Leave Character Creator?'}).getByRole('button',{name:'Cancel'}).click();assert.equal(await p.evaluate(()=>window.testNavigation),undefined);
        await p.getByRole('button',{name:'Back to Dashboard'}).click();await p.getByRole('alertdialog',{name:'Leave Character Creator?'}).getByRole('button',{name:'Continue'}).click();assert.equal(await p.evaluate(()=>window.testNavigation),'/');
    });
    await test('independent repeat awards and fixed mastery reach prepared review with keyboard source selection',900,async p=>{
        const before=writes;await p.getByLabel('Name',{exact:true}).fill('Repeated awards');await p.getByLabel('Level',{exact:true}).selectOption('3');await pick(p,'Class','Fighter');await pick(p,'Ancestry','Human');
        await step(p,'Ability scores');for(const stat of ['STR','DEX','CON','INT','WIS','CHA'])await p.getByLabel(stat,{exact:true}).fill(stat==='STR'?'16':'12');
        await step(p,'Talents and boons');await waitPlan(p);await p.locator('.sd-creator-award').filter({has:p.getByRole('heading',{name:'Weapon Mastery',exact:true})}).locator('select').selectOption('Club');
        for(let i=0;i<2;i++){
            await p.getByRole('button',{name:'Add recorded award',exact:true}).click();const dialog=p.getByRole('dialog',{name:'Select Recorded Talent or Boon',exact:true});await dialog.getByPlaceholder('Search Recorded Talent or Boon...').fill('+2 to Strength');
            const button=dialog.getByRole('button',{name:/^\+2 to Strength —/});await button.focus();await p.keyboard.press('Enter');await waitPlan(p);
        }
        const fields=p.getByLabel('Acquisition level (leave empty if unknown)',{exact:true});assert.equal(await fields.count(),2);await fields.nth(0).fill('1');await fields.nth(1).fill('3');
        await step(p,'Hit points');await p.getByLabel('Current HP',{exact:true}).fill('0');await p.getByLabel('Maximum HP',{exact:true}).fill('17');await step(p,'Review and create');await waitPlan(p);
        const strength=p.getByRole('row').filter({has:p.getByRole('rowheader',{name:'STR',exact:true})});assert.deepEqual(await strength.getByRole('cell').allTextContents(),['16 (paper)','12','16']);
        const submitted=await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/prepare')).at(-1).body.draft);assert.equal(submitted.awards.length,2);assert.notEqual(submitted.awards[0].id,submitted.awards[1].id);assert.equal(submitted.fixedChoices['class:Compendium.shadowdark.talents.Item.5bpWuaT0KTNzuzCu'].target,'Club');assert.equal(writes,before);
    });
    await test('context/identity retires delayed reviews while manual input survives; caller retirement clears draft',900,async p=>{
        const before=writes;
        await p.getByLabel('Name',{exact:true}).fill('Keep my paper');await p.evaluate(()=>window.hold=true);await p.getByLabel('Current XP',{exact:true}).fill('2');await p.waitForFunction(()=>window.pending.length>0);
        revision++;await p.evaluate(()=>window.emitContext());await p.getByLabel('Current XP',{exact:true}).fill('3');await p.evaluate(()=>{window.hold=false;window.pending.splice(0).forEach(fn=>fn());});await waitPlan(p);assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Keep my paper');
        await p.evaluate(()=>{window.sdk.currentUser={id:'different-user',role:1};window.render();});await p.waitForFunction(()=>document.querySelector('input')?.value==='');assert.equal(writes,before);
    });
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Offline mounted creator + real planner/routes; controlled SDK, no native acceptance',results},null,2));}
if(results.some(r=>!r.pass))process.exitCode=1;
