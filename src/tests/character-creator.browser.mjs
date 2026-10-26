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
const creatorImport=process.env.SHADOWDARK_CREATOR_UI?`import manifest from ${JSON.stringify(process.env.SHADOWDARK_CREATOR_UI)};const Creator=React.lazy(manifest.tools.creator);const Generator=React.lazy(manifest.tools.generator);`:`import Creator from '${root}/src/ui/tools/CharacterCreator';import Generator from '${root}/src/ui/tools/Generator';`;
const bundle=await build({stdin:{resolveDir:root,loader:'tsx',contents:`
import React from 'react';import{createRoot}from'react-dom/client';${creatorImport}
window.calls=[];window.pending=[];window.pendingStatuses=[];const listeners=new Map();
window.sdk={isConnected:true,worldId:'w',moduleId:'shadowdark',currentUser:{id:'owner',role:1},foundryUrl:'',resolveImageUrl:x=>x||'',navigate:target=>window.testNavigation=target,
 events:{on:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return()=>listeners.get(event).delete(fn)}},
 fetchWithAuth:async(url,options={})=>{const body=options.body?JSON.parse(options.body):null;window.calls.push({url,body});
  if(window.failGoldRoll&&body?.kind==='gold')return Response.json({error:'Starting gold roll unavailable.'},{status:400});
  const result=await window.request(url,body,window.sdk.currentUser.id);if(window.hold&&url.endsWith('/prepare'))await new Promise(resolve=>window.pending.push(resolve));if(window.holdStatuses&&url.endsWith('/status'))await new Promise(resolve=>window.pendingStatuses.push(resolve));return Response.json(result.body,{status:result.status});}};
window.emitContext=()=>listeners.get('world:contextChanged')?.forEach(fn=>fn({keys:[]}));
const app=createRoot(document.getElementById('root'));window.mountKey=0;window.render=()=>app.render(<React.Suspense fallback={<p>Loading creator…</p>}>{window.activeTool==='generator'?<Generator/>:<Creator key={window.mountKey}/>}</React.Suspense>);window.render();
`},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',nodePaths:[path.join(core,'node_modules')],plugins:[{name:'public-sdk-boundary',setup(b){
    b.onResolve({filter:/^(?:@sheet-delver\/sdk(?:\/react)?|@shared\/sdk\/react)$/},a=>({path:a.path,namespace:'stub'}));
    b.onLoad({filter:/.*/,namespace:'stub'},a=>({loader:'tsx',resolveDir:root,contents:a.path.endsWith('/react')?`import PageHeader from '${path.resolve(process.env.SHADOWDARK_CORE||process.cwd())}/src/client/ui/components/PageHeader.tsx';import {ConfirmationModal} from '${core}/src/client/ui/components/ConfirmationModal.tsx';import RichTextEditor from '${core}/src/client/ui/components/RichTextEditor.tsx';export const useSDK=()=>window.sdk;export const useSDKComponents=()=>({PageHeader,ConfirmationModal,RichTextEditor,LoadingModal:()=>null});`:`export const logger={info(){},warn(){},error(){},debug(){}};export const processHtmlContent=x=>x;export const getErrorMessage=e=>String(e);`}));
}}]});
let writes=0,rolls=0,revision=1;
const store=new Map(),actors=new Map();
const runtime={world:{snapshot:()=>worldSnapshot(revision),assertRevision:r=>{if(r!==revision)throw Error('Retired');}},access:{canReadPack:()=>true,packs:()=>[]},
    compendium:{findAll:async type=>structuredClone(rows.filter(d=>type==='RollTable'?d.results:type==='Item'?!d.results:false)),getById:async(type,uuid)=>structuredClone(sources.get(uuid)||null)},
    dataStore:{get:async key=>structuredClone(store.get(key)||null),set:async(key,value)=>{store.set(key,structuredClone(value));},keys:async(prefix='')=>[...store.keys()].filter(k=>k.startsWith(prefix))},
    documents:{get:async(type,id)=>structuredClone(type==='Actor'?actors.get(id)||null:null),list:async()=>({rows:[...actors.values()],total:actors.size}),
        create:async(type,source)=>{writes++;const actor={...structuredClone(source),_id:'created-'+writes};actors.set(actor._id,actor);return actor;}},
    rolls:{roll:async formula=>{rolls++;return{formula,total:formula==='3d6'?11:formula==='2d6 * 5'?35:4};}}};
await adapter.initialize({...runtime,logger:console});
const handlers={prepare:handleCreatorPrepare,create:handleCreatorCreate,status:handleCreatorStatus,roll:handleCreatorRoll,hp:handleCreatorHP};
const browser=await chromium.launch({...(process.env.SHADOWDARK_CHROME?{executablePath:process.env.SHADOWDARK_CHROME}:{}),headless:true,args:['--no-sandbox','--disable-background-networking']});
const results=[];
async function test(name,width,run){
    if(process.env.SHADOWDARK_CREATOR_CASE&&!new RegExp(process.env.SHADOWDARK_CREATOR_CASE).test(name))return;
    store.clear();actors.clear();const page=await browser.newPage({viewport:{width,height:1100}}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
    await page.exposeFunction('request',async(url,body,userId)=>{
        if(url.endsWith('/actors/randomize/name')){assert.ok(body.ancestryUuid);return{status:200,body:{name:'Ancestry name'}};}
        if(url.includes('/document/'))return {status:200,body:sources.get(url.split('/document/')[1])??null};
        if(url.endsWith('/index'))return{status:200,body:await adapter.getSystemDataForUser(runtime)};
        if(url.includes('/fetch-pack/'))return{status:200,body:await adapter.getCollection(url.split('/').at(-1),{caller:{runtime,isGM:false}})};
        const handler=handlers[url.split('/').at(-1)];if(!handler)throw Error('Unexpected route '+url);
        const response=await handler({runtime,userSession:{userId},json:async()=>structuredClone(body)});return{status:response.status,body:await response.json()};
    });
    try{
        await page.setContent('<div id="root" class="sdk-module--shadowdark"></div>');await page.addStyleTag({content:hostCss});await page.addStyleTag({content:moduleCss});await page.addStyleTag({path:process.env.SHADOWDARK_CREATOR_PRESENTATION||path.join(root,'assets/presentation.css')});await page.addScriptTag({content:bundle.outputFiles[0].text});
        await run(page);assert.deepEqual(errors,[]);results.push({name,pass:true});console.log('✓ '+name);
    }catch(e){results.push({name,pass:false,error:e.stack??String(e),errors,text:await page.locator('body').innerText()});await page.screenshot({path:path.join(out,'failure-'+results.length+'.png')});console.error('✗ '+name+': '+e.message);}finally{await page.close();}
}
const waitPlan=async p=>{await p.waitForFunction(()=>window.calls.some(c=>c.url.endsWith('/prepare')));await p.waitForTimeout(450);};
const step=async(p,name)=>{await waitPlan(p);await p.getByRole('button',{name:new RegExp('^\\d\\. '+name+'$')}).click();};
const pick=async(p,title,name)=>{
    const field=p.locator('.sd-creator-field').filter({has:p.locator('span',{hasText:new RegExp('^'+title+'(?: \\*)?$')})});await field.getByRole('button').first().click();
    await p.getByRole('button',{name:new RegExp('^'+name+' —')}).click();await waitPlan(p);
};
const finishIdentity=async p=>{await pick(p,'Background',rows.find(r=>r.type==='Background').name);await p.getByLabel('Alignment',{exact:true}).selectOption('neutral');await waitPlan(p);};
try{
    await test('required steps cannot be skipped; Level 0 Class is excluded from adventuring choices',900,async p=>{
        await waitPlan(p);await p.locator('.sd-creator-name').getByRole('alert').filter({hasText:'Enter the character’s name.'}).waitFor();assert.equal(await p.getByRole('button',{name:'Next',exact:true}).isDisabled(),true);assert.equal(await p.getByRole('button',{name:'7. Review and create',exact:true}).isDisabled(),true);
        await p.getByLabel('Current XP',{exact:true}).fill('-1');assert.equal(await p.getByLabel('Current XP',{exact:true}).inputValue(),'0');await p.getByLabel('Current XP',{exact:true}).fill('0');await p.getByLabel('Name',{exact:true}).fill('Novice');await pick(p,'Ancestry','Dwarf');await finishIdentity(p);
        assert.equal(await p.getByRole('button',{name:'Next',exact:true}).isDisabled(),true);
        const field=p.locator('.sd-creator-field').filter({has:p.locator('span',{hasText:/^Class \*$/})});await field.getByRole('button').first().click();
        assert.equal(await p.getByRole('dialog',{name:'Select Class',exact:true}).getByRole('button',{name:/^Level 0 —/}).count(),0);await p.keyboard.press('Escape');
        await pick(p,'Deity','Saint Terragnis');await p.getByRole('button',{name:'Clear Deity selection',exact:true}).click();await waitPlan(p);assert.equal(await p.getByRole('button',{name:'Clear Deity selection',exact:true}).count(),0);await p.getByLabel('Level',{exact:true}).selectOption('0');await waitPlan(p);assert.equal(await p.getByRole('button',{name:'Next',exact:true}).isDisabled(),false);
        await p.getByRole('button',{name:'Next',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Next',exact:true}).isDisabled(),true);
        assert.equal(await p.getByRole('button',{name:'7. Review and create',exact:true}).isDisabled(),true);
        await step(p,'Identity');await p.getByLabel('Name',{exact:true}).fill('');await waitPlan(p);assert.equal(await p.getByRole('button',{name:'2. Ability scores',exact:true}).isDisabled(),true);
    });
    for(const width of [390,1280])await test(`manual fighter ${width}px: paper entries, Back, prepared review and single creation`,width,async p=>{
        const before=writes,beforeRolls=rolls;assert.equal(await p.getByRole('button',{name:'Randomize Name',exact:true}).isDisabled(),true);await p.getByLabel('Name',{exact:true}).fill('Paper hero');await p.getByLabel('Level',{exact:true}).selectOption('3');
        await pick(p,'Class','Fighter');await pick(p,'Ancestry','Dwarf');await finishIdentity(p);
        assert.equal(await p.getByRole('button',{name:'Reviewed',exact:true}).count(),0);await p.getByRole('button',{name:'Randomize Name',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#creator-name')?.value==='Ancestry name');await p.getByLabel('Name',{exact:true}).fill('Paper hero');
        await p.screenshot({path:path.join(out,`identity-${width}.png`),fullPage:true});
        await step(p,'Ability scores');await p.getByRole('heading',{name:'Key abilities for Fighter',exact:true}).waitFor();assert.match(await p.getByRole('region',{name:'Ability guidance'}).innerText(),/Strength \(STR\).*Melee attacks/);assert.equal(await p.getByLabel('STR',{exact:true}).getAttribute('type'),'text');assert.equal(await p.getByLabel('STR basis',{exact:true}).count(),0);
        for(const stat of ['STR','DEX','CON','INT','WIS','CHA'])await p.getByLabel(stat,{exact:true}).fill(stat==='STR'?'16':'12');
        await step(p,'Identity');assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Paper hero');await step(p,'Ability scores');assert.equal(await p.getByLabel('STR',{exact:true}).inputValue(),'16');
        await waitPlan(p);await p.screenshot({path:path.join(out,`scores-${width}.png`),fullPage:true});
        await step(p,'Talents and boons');await waitPlan(p);assert.equal(writes,before);assert.equal(rolls,beforeRolls);
        await p.locator('.sd-creator-award').filter({has:p.getByRole('heading',{name:'Weapon Mastery',exact:true})}).locator('select').selectOption('Club');await waitPlan(p);
        await p.getByText('Choose or roll a native table result',{exact:true}).click();await p.getByLabel('Award table',{exact:true}).selectOption(sources.get('Compendium.shadowdark.classes.Item.hO7KrvqDRH6kvftJ').system.classTalentTable);await p.getByRole('button',{name:'Roll table',exact:true}).click();await p.getByText('Table total: 4',{exact:true}).waitFor();assert.equal(await p.getByLabel('Native result group',{exact:true}).inputValue(),'3');await p.getByRole('button',{name:'Add table award',exact:true}).click();await waitPlan(p);
        for(const level of [3]){await p.getByRole('button',{name:`Choose level ${level} talent`,exact:true}).click();await p.getByRole('button',{name:/^\+1 to Melee and Ranged Attacks —/}).click();await waitPlan(p);}
        assert.equal(await p.getByRole('button',{name:'All level awards selected',exact:true}).isDisabled(),true);
        await p.screenshot({path:path.join(out,`grants-${width}.png`),fullPage:true});
        await step(p,'Languages and spells');await step(p,'Hit points');assert.equal(await p.getByLabel('Current HP',{exact:true}).count(),0);await waitPlan(p);assert.equal(await p.getByText('Enter or roll 1–8 HP for this level.',{exact:true}).count(),3);await p.getByLabel('Level 1 HP roll',{exact:true}).fill('12');assert.equal(await p.getByLabel('Level 1 HP roll',{exact:true}).inputValue(),'');await p.locator('.sd-creator-hp-levels > .sd-creator-score').first().getByRole('alert').filter({hasText:'Enter a whole number from 1 to 8.'}).waitFor();await p.screenshot({path:path.join(out,`hp-validation-${width}.png`),fullPage:true});
        const cards=p.locator('.sd-creator-hp-levels > .sd-creator-score');const first=await cards.nth(0).boundingBox(),second=await cards.nth(1).boundingBox();assert.equal(first.x,second.x);assert.ok(second.y>=first.y+first.height);
        const hpInput=await cards.nth(0).locator('input').boundingBox(),hpDie=await cards.nth(0).getByRole('button',{name:'Roll level 1 HP',exact:true}).boundingBox();assert.ok(Math.abs(hpInput.y+hpInput.height/2-hpDie.y-hpDie.height/2)<2);await p.getByText('Fighter hit die: d8',{exact:true}).waitFor();await p.getByRole('button',{name:'Max level 1 HP',exact:true}).click();assert.equal(await p.getByLabel('Level 1 HP roll',{exact:true}).inputValue(),'8');for(const [i,total] of [5,6,7].entries())await p.getByLabel(`Level ${i+1} HP roll`,{exact:true}).fill(String(total));await p.getByText('Total HP: 21',{exact:true}).waitFor();await p.screenshot({path:path.join(out,`hp-${width}.png`),fullPage:true});
        await step(p,'Equipment and money');await p.getByLabel('GP',{exact:true}).fill('17');await p.getByRole('button',{name:'Add starting gold',exact:true}).click();let gold=p.getByRole('dialog',{name:'Starting gold',exact:true});await gold.getByRole('button',{name:'MAX',exact:true}).click();await p.keyboard.press('Escape');assert.equal(await p.getByLabel('GP',{exact:true}).inputValue(),'17');await p.getByRole('button',{name:'Add starting gold',exact:true}).click();await p.evaluate(()=>window.failGoldRoll=true);await p.getByRole('dialog',{name:'Starting gold',exact:true}).getByRole('button',{name:'Roll',exact:true}).click();await p.getByText('Starting gold roll unavailable.',{exact:true}).waitFor();await p.keyboard.press('Escape');await p.evaluate(()=>window.failGoldRoll=false);await waitPlan(p);assert.equal(await p.getByRole('button',{name:'Next',exact:true}).isEnabled(),true);await p.getByRole('button',{name:'Add starting gold',exact:true}).click();gold=p.getByRole('dialog',{name:'Starting gold',exact:true});await gold.getByRole('button',{name:'Roll',exact:true}).click();await gold.getByRole('button',{name:'Add 35 GP',exact:true}).waitFor();await gold.getByRole('button',{name:'MAX',exact:true}).click();await p.screenshot({path:path.join(out,`starting-gold-${width}.png`)});await gold.getByRole('button',{name:'Add 60 GP',exact:true}).click();assert.equal(await p.getByLabel('GP',{exact:true}).inputValue(),'77');await p.getByRole('button',{name:'Add equipment',exact:true}).click();await p.getByPlaceholder('Search gear...').fill('Rope');
        // The real gear selector's Add callback is exercised, retaining its exact origin.
        const add=p.getByRole('button',{name:/Add Rope/});if(await add.count())await add.first().click();else {await p.keyboard.press('Escape');}
        await p.getByRole('button',{name:'Add treasure',exact:true}).click();await p.getByPlaceholder('e.g. Golden Idol').fill('Golden idol');await p.getByRole('button',{name:'Create',exact:true}).click();
        await p.getByRole('button',{name:'Gem Bag',exact:true}).click();await p.getByRole('button',{name:'Add New Gem',exact:true}).click();await p.getByPlaceholder('e.g. Ruby').fill('Ruby');await p.getByRole('button',{name:'Add Gem',exact:true}).click();assert.equal(await p.getByTitle('Sell Gem',{exact:true}).count(),0);await p.getByRole('button',{name:'Close',exact:true}).click();
        await step(p,'Review and create');await waitPlan(p);await p.getByText('Required choices are complete.',{exact:true}).waitFor();
        await p.getByRole('button',{name:'Edit Notes',exact:true}).click();await p.locator('[contenteditable=true]').fill('Character history');await p.getByRole('button',{name:'Save',exact:true}).click();await waitPlan(p);
        while(await p.locator('.sd-creator-notice input[type=checkbox]:not(:checked)').count()){await p.locator('.sd-creator-notice input[type=checkbox]:not(:checked)').first().check();await waitPlan(p);}
        await p.getByRole('button',{name:'Create character',exact:true}).waitFor();await p.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Create character')?.disabled);
        assert.equal(writes,before);assert.equal(rolls,beforeRolls+2);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await p.screenshot({path:path.join(out,`review-${width}.png`),fullPage:true});
        await p.getByRole('button',{name:'Create character',exact:true}).click();await p.getByRole('alertdialog',{name:'Create this character?'}).getByRole('button',{name:'Continue'}).click();await p.getByRole('button',{name:'Open character',exact:true}).waitFor();assert.equal(writes,before+1);
        const source=[...actors.values()][0];assert.equal(await p.evaluate(()=>window.testNavigation),`/actors/${source._id}`);assert.equal(source.system.level.value,3);assert.equal(source.system.attributes.hp.value,21);assert.equal(source.system.attributes.hp.max,19);assert.equal(source.items.some(i=>i.name==='Stout'),true);assert.equal(source.system.coins.gp,77);assert.match(source.system.notes,/<p>Character history<\/p>/);assert.equal(source.items.find(i=>i.name==='Ruby').type,'Gem');assert.equal(source.items.find(i=>i.name==='Golden idol').system.treasure,true);
        if(width===1280){
            // Model a saved dispatch whose native result differs before confirmation.
            for(const saved of store.values())if(saved?.payload&&saved?.state==='complete')saved.state='dispatched';
            await p.evaluate(()=>delete window.testNavigation);source.system.coins.gp++;await p.getByRole('button',{name:'Check creation',exact:true}).click();await p.getByRole('button',{name:'Review created character',exact:true}).waitFor();
            assert.equal(await p.evaluate(()=>window.testNavigation),undefined);await p.getByText('Verification details',{exact:true}).click();await p.getByText('system.coins.gp',{exact:true}).waitFor();assert.equal(writes,before+1);
            await p.getByRole('button',{name:'Review created character',exact:true}).click();assert.equal(await p.evaluate(()=>window.testNavigation),`/actors/${source._id}`);
            await p.evaluate(()=>delete window.testNavigation);source.system.coins.gp--;await p.getByRole('button',{name:'Check creation',exact:true}).click();await p.getByRole('button',{name:'Open character',exact:true}).waitFor();
            assert.equal(await p.evaluate(()=>window.testNavigation),`/actors/${source._id}`);await p.evaluate(()=>{delete window.testNavigation;window.mountKey++;window.render();});await p.getByLabel('Name',{exact:true}).fill('Next character');await waitPlan(p);
            assert.equal(await p.getByRole('region',{name:'Creation outcome'}).count(),0,'a confirmed earlier creation must not lock a fresh Creator visit');
            assert.equal(await p.evaluate(()=>window.testNavigation),undefined);assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Next character');assert.equal(writes,before+1);

        }
        if(width===390){
            await p.evaluate(()=>window.holdStatuses=true);await p.getByRole('button',{name:'Check creation',exact:true}).click();await p.waitForFunction(()=>window.pendingStatuses.length>0);
            await p.evaluate(()=>{window.sdk.currentUser={id:'new-caller',role:1};window.render();});await p.waitForFunction(()=>document.querySelector('input')?.value==='');
            await p.evaluate(()=>{window.holdStatuses=false;window.pendingStatuses.splice(0).forEach(fn=>fn());});await p.waitForTimeout(300);assert.equal(await p.getByRole('button',{name:'Open character',exact:true}).count(),0,'retired explicit status must not publish another caller’s receipt');
        }
    });
    await test('explicit score rolls replace immediately; navigation never rolls',900,async p=>{
        await p.getByLabel('Name',{exact:true}).fill('Roller');await p.getByLabel('Level',{exact:true}).selectOption('0');await pick(p,'Ancestry','Dwarf');await finishIdentity(p);
        await step(p,'Ability scores');await p.getByLabel('STR',{exact:true}).fill('16');const before=rolls;
        await p.getByRole('button',{name:'Roll STR',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#creator-score-str')?.value==='11');assert.equal(rolls,before+1);assert.equal(await p.getByRole('alertdialog').count(),0);
        await p.getByRole('button',{name:'Roll all scores',exact:true}).click();await p.waitForFunction(()=>Array.from(document.querySelectorAll('[id^=creator-score-]')).every(i=>i.value==='11'));assert.equal(rolls,before+7);assert.equal(await p.getByRole('alertdialog').count(),0);
        await waitPlan(p);await p.getByRole('button',{name:'Next',exact:true}).click();assert.equal(rolls,before+7);
        await step(p,'Hit points');await p.getByText('Total HP: 3',{exact:true}).waitFor();assert.equal(rolls,before+7);assert.equal(await p.getByRole('alertdialog').count(),0);
        await p.getByRole('button',{name:'Back to Dashboard'}).click();await p.getByRole('alertdialog',{name:'Leave Character Creator?'}).getByRole('button',{name:'Cancel'}).click();assert.equal(await p.evaluate(()=>window.testNavigation),undefined);
        await p.getByRole('button',{name:'Back to Dashboard'}).click();await p.getByRole('alertdialog',{name:'Leave Character Creator?'}).getByRole('button',{name:'Continue'}).click();assert.equal(await p.evaluate(()=>window.testNavigation),'/');
    });
    await test('independent repeat awards and fixed mastery reach prepared review with keyboard source selection',900,async p=>{
        const before=writes;await p.getByLabel('Name',{exact:true}).fill('Repeated awards');await p.getByLabel('Level',{exact:true}).selectOption('3');await pick(p,'Class','Fighter');await pick(p,'Ancestry','Dwarf');await finishIdentity(p);
        await step(p,'Ability scores');for(const stat of ['STR','DEX','CON','INT','WIS','CHA'])await p.getByLabel(stat,{exact:true}).fill(stat==='STR'?'16':'12');
        await step(p,'Talents and boons');await waitPlan(p);await p.locator('.sd-creator-award').filter({has:p.getByRole('heading',{name:'Weapon Mastery',exact:true})}).locator('select').selectOption('Club');
        for(let i=0;i<2;i++){
            await p.getByRole('button',{name:new RegExp('^Choose level '+(i===0?'1':'3')+' talent$')}).click();const dialog=p.getByRole('dialog',{name:'Select Recorded Talent or Boon',exact:true});await dialog.getByPlaceholder('Search Recorded Talent or Boon...').fill('+2 to Strength');
            const button=dialog.getByRole('button',{name:/^\+2 to Strength —/});await button.focus();await p.keyboard.press('Enter');await waitPlan(p);
        }
        const fields=p.getByLabel('Gained at level',{exact:true});assert.equal(await fields.count(),2);assert.equal(await fields.nth(0).inputValue(),'1');assert.equal(await fields.nth(1).inputValue(),'3');
        await step(p,'Hit points');const beforeHP=rolls;await p.getByRole('button',{name:'Roll all HP',exact:true}).click();await p.getByText('Total HP: 15',{exact:true}).waitFor();assert.equal(rolls,beforeHP+3);assert.equal(await p.getByRole('alertdialog').count(),0);
        await p.getByLabel('Level 2 HP roll',{exact:true}).fill('5');await p.getByText('Total HP: 16',{exact:true}).waitFor();await p.getByRole('button',{name:'Roll level 2 HP',exact:true}).click();await p.getByText('Total HP: 15',{exact:true}).waitFor();assert.equal(rolls,beforeHP+4);
        await step(p,'Identity');await p.getByLabel('Level',{exact:true}).selectOption('4');await step(p,'Hit points');assert.equal(await p.getByLabel('Level 1 HP roll',{exact:true}).inputValue(),'4');assert.equal(await p.getByLabel('Level 4 HP roll',{exact:true}).inputValue(),'');assert.equal(await p.getByRole('button',{name:'Next',exact:true}).isDisabled(),true);await p.getByLabel('Level 4 HP roll',{exact:true}).fill('5');await p.getByText('Total HP: 20',{exact:true}).waitFor();
        await step(p,'Review and create');await waitPlan(p);
        const strength=p.getByRole('row').filter({has:p.getByRole('rowheader',{name:'STR',exact:true})});assert.deepEqual(await strength.getByRole('cell').allTextContents(),['16','3']);
        const submitted=await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/prepare')).at(-1).body.draft);assert.equal(submitted.awards.length,2);assert.notEqual(submitted.awards[0].id,submitted.awards[1].id);assert.equal(submitted.fixedChoices['class:Compendium.shadowdark.talents.Item.5bpWuaT0KTNzuzCu'].target,'Club');assert.equal(writes,before);
    });
    for(const width of [390,900])await test(`wizard ${width}px: progressive tiers, spell grants and language limits without duplicates`,width,async p=>{
        const wizard='Compendium.shadowdark.classes.Item.035nuVkU9q2wtMPs';
        await p.getByLabel('Name',{exact:true}).fill('Wizard');await p.getByLabel('Level',{exact:true}).selectOption('3');await pick(p,'Class','Wizard');await pick(p,'Ancestry','Dwarf');await finishIdentity(p);await step(p,'Ability scores');for(const stat of ['STR','DEX','CON','INT','WIS','CHA'])await p.getByLabel(stat,{exact:true}).fill('12');await step(p,'Talents and boons');await waitPlan(p);
        await p.getByRole('button',{name:'Choose level 1 talent',exact:true}).click();await p.getByRole('button',{name:/^Learn Wizard Spell —/}).click();await waitPlan(p);
        await p.getByRole('button',{name:'Choose granted Spell…',exact:true}).click();
        const dialog=p.getByRole('dialog',{name:'Select Spell for Learn Wizard Spell',exact:true});await dialog.getByRole('button').filter({hasText:' — '}).first().click();await waitPlan(p);
        const grant=await p.evaluate(()=>Object.values(window.calls.filter(c=>c.url.endsWith('/prepare')).at(-1).body.draft.awards[0].choices)[0].spell);
        await p.getByRole('button',{name:'Choose level 3 talent',exact:true}).click();await p.getByRole('button',{name:/^\+1 on Spellcasting Checks —/}).click();await waitPlan(p);
        await step(p,'Languages and spells');
        const level=p.getByLabel('Spell selection level',{exact:true});
        assert.equal(await level.inputValue(),'1');assert.equal(await level.locator('option[value="2"]').evaluate(option=>option.disabled),true);assert.equal(await level.locator('option[value="3"]').evaluate(option=>option.disabled),true);
        const selected=[grant];
        for(const [at,tier,count] of [[1,1,3],[2,1,1],[3,2,1]]){
            assert.equal(await level.inputValue(),String(at));
            for(let i=0;i<count;i++){
                assert.equal(await p.getByRole('button',{name:'Choose tier 3 spell',exact:true}).isDisabled(),true);
                if(at<3)assert.equal(await p.getByRole('button',{name:'Choose tier 2 spell',exact:true}).isDisabled(),true);
                await p.getByRole('button',{name:`Choose tier ${tier} spell`,exact:true}).click();
                const picker=p.getByRole('dialog',{name:`Select Level ${at} · Tier ${tier} spells`,exact:true});
                for(const ref of selected){const known=rows.find(r=>r.uuid===ref);if(known.system.tier===tier)assert.equal(await picker.getByRole('button').filter({hasText:known.name+' —'}).isDisabled(),true);}
                await picker.locator('button:enabled').filter({hasText:' — '}).first().click();await waitPlan(p);
                const picks=await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/prepare')).at(-1).body.draft.spells);selected.push(picks.at(-1).source);
            }
        }
        await p.screenshot({path:path.join(out,`spell-tiers-${width}.png`),fullPage:true});
        // Reopening an earlier level shows its choices; removing one reopens its first unmet allowance.
        await level.selectOption('1');await p.getByRole('button',{name:'Remove Spell',exact:true}).first().click();await waitPlan(p);assert.equal(await level.inputValue(),'2');assert.equal(await level.locator('option[value="3"]').evaluate(option=>option.disabled),true);
        await p.getByRole('button',{name:'Choose tier 1 spell',exact:true}).click();await p.getByRole('dialog',{name:'Select Level 2 · Tier 1 spells',exact:true}).locator('button:enabled').filter({hasText:' — '}).first().click();await waitPlan(p);
        const grantName=rows.find(r=>r.uuid===grant).name;await p.getByRole('button',{name:grantName,exact:true}).click();
        const grantPicker=p.getByRole('dialog',{name:'Select Spell for Learn Wizard Spell',exact:true});
        const ordinary=await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/prepare')).at(-1).body.draft.spells[0].source);
        assert.equal(await grantPicker.getByRole('button').filter({hasText:rows.find(r=>r.uuid===ordinary).name+' —'}).isDisabled(),true);
        await p.screenshot({path:path.join(out,`known-spell-picker-${width}.png`),fullPage:true});await p.keyboard.press('Escape');
        for(let i=0;i<4;i++){await p.getByRole('button',{name:'Add Language',exact:true}).click();await p.getByRole('dialog',{name:'Select Language on your sheet',exact:true}).getByRole('button').filter({hasText:' — '}).first().click();await waitPlan(p);}
        assert.equal(await p.getByRole('button',{name:'Add Language',exact:true}).isDisabled(),true);
        const draft=await p.evaluate(()=>window.calls.filter(c=>c.url.endsWith('/prepare')).at(-1).body.draft);assert.equal(draft.spells.length,5);assert.ok(draft.spells.every(s=>s.source!==grant&&s.castingClass===wizard));assert.equal(draft.languages.length,4);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    });
    for(const width of [390,1280])await test(`generator ${width}px: connected paper surface`,width,async p=>{
        await p.evaluate(()=>{window.activeTool='generator';window.render();});
        const sheet=p.getByRole('region',{name:'Character generation',exact:true});await sheet.waitFor();
        await sheet.getByPlaceholder('Character Name').fill('Generator hero');
        assert.equal(await sheet.getByRole('button',{name:'Create Character',exact:true}).count(),1);
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        const surface=await sheet.evaluate(el=>({background:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderTopWidth}));
        assert.deepEqual(surface,{background:'rgb(250, 250, 250)',border:'2px'});
        await p.screenshot({path:path.join(out,`generator-${width}.png`),fullPage:true});
    });
    await test('context/identity retires delayed reviews while manual input survives; caller retirement clears draft',900,async p=>{
        const before=writes;
        await p.getByLabel('Name',{exact:true}).fill('Keep my paper');await p.evaluate(()=>window.hold=true);await p.getByLabel('Current XP',{exact:true}).fill('2');await p.waitForFunction(()=>window.pending.length>0);
        revision++;await p.evaluate(()=>window.emitContext());await p.getByLabel('Current XP',{exact:true}).fill('3');await p.evaluate(()=>{window.hold=false;window.pending.splice(0).forEach(fn=>fn());});await waitPlan(p);assert.equal(await p.getByLabel('Name',{exact:true}).inputValue(),'Keep my paper');
        await p.evaluate(()=>{window.sdk.currentUser={id:'different-user',role:1};window.render();});await p.waitForFunction(()=>document.querySelector('input')?.value==='');assert.equal(writes,before);
    });
}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({scope:'Offline mounted creator + real planner/routes; controlled SDK, no native acceptance',results},null,2));}
if(results.some(r=>!r.pass))process.exitCode=1;
