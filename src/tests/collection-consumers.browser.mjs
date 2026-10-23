/** Actual React consumers, controlled SDK boundary; no Core/Foundry service.
 * Run from the pinned Core toolchain: SHADOWDARK_PLAYWRIGHT_MODULE=<playwright import>
 * node data/local/modules/shadowdark/src/tests/collection-consumers.browser.mjs [output-dir]
 * Browser tooling is development-only. All outgoing browser traffic is blocked.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
const parityOnly = process.argv.includes('--parity-only');
const baseline = process.argv.find(arg => arg.startsWith('--baseline='))?.slice(11);
const providerBaseline=process.argv.find(arg=>arg.startsWith('--provider-baseline='))?.split('=')[1];
const languageBaseline = process.argv.find(arg => arg.startsWith('--language-baseline='))?.split('=')[1];
const { chromium } = await import(process.env.SHADOWDARK_PLAYWRIGHT_MODULE || 'playwright');
const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || path.join(moduleRoot, 'temp/collection-consumers'));
fs.mkdirSync(out, { recursive: true });
const bundled = await build({ stdin: { contents: `
import {useAutomaticSpellGrants} from '${moduleRoot}/src/ui/hooks/useAutomaticSpellGrants';
import React from 'react'; import {createRoot} from 'react-dom/client';
import {ShadowdarkUIProvider} from '${moduleRoot}/src/ui/context/ShadowdarkUIContext';
import Gear from '${moduleRoot}/src/ui/components/GearSelectionModal';
import Spells from '${moduleRoot}/src/ui/SpellsTab';
import {ItemRow} from '${moduleRoot}/src/ui/InventoryComponents';
import Generator from '${moduleRoot}/src/ui/tools/Generator';
import Importer from '${moduleRoot}/src/ui/tools/ShadowdarkImportPage';
import Bestiary from '${moduleRoot}/src/ui/tools/Bestiary';
import Details from '${moduleRoot}/src/ui/DetailsTab';
import SpellPicker from '${moduleRoot}/src/ui/components/SpellSelectionModal';
import LanguagePicker from '${moduleRoot}/src/ui/components/LanguageSelectionModal';
import {ExtraSpellSelectionSection} from '${moduleRoot}/src/ui/components/levelup/sections/ExtraSpellSelectionSection';
import {SpellAdvantageSelectionSection} from '${moduleRoot}/src/ui/components/levelup/sections/SpellAdvantageSelectionSection';
import {StatPoolSelectionSection} from '${moduleRoot}/src/ui/components/levelup/sections/StatPoolSelectionSection';
import {statChoiceRule} from '${moduleRoot}/src/logic/stat-choices';
import {useLevelUp} from '${moduleRoot}/src/ui/components/levelup/useLevelUp';
import ModuleDialog from '${moduleRoot}/src/ui/components/ModuleDialog';
import ResourceDetailModal from '${moduleRoot}/src/ui/components/ResourceDetailModal';
import {prepareShadowdarkView} from '${moduleRoot}/src/logic/prepared-view';
import {WeaponSelectionSection} from '${moduleRoot}/src/ui/components/levelup/sections/WeaponSelectionSection';
import {ArmorSelectionSection} from '${moduleRoot}/src/ui/components/levelup/sections/ArmorSelectionSection';
const listeners=new Map();const emit=(event,payload)=>listeners.get(event)?.forEach(fn=>fn(payload)); window.calls=[]; window.pending=[];
window.policy=window.initial.policy||{};
const rope={_id:'rope',uuid:'Compendium.shadowdark.gear.Item.rope',name:'Current Rope',type:'Basic',pack:'shadowdark.gear',system:{cost:{gp:1}}};
window.sdk={isConnected:true,worldId:'w',currentUser:{id:'p',role:1},foundryUrl:'',
 events:{on:(event,fn)=>{if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return ()=>listeners.get(event).delete(fn)}},resolveImageUrl:x=>x||'',addNotification:()=>{},navigate:()=>{},
 fetchWithAuth:async (url,options={})=>{
  const key=url.split('/').at(-1).split('?')[0];const call={key,signal:options.signal,body:options.body};window.calls.push(call);
  const reference=url.includes('/document/')?decodeURIComponent(url.split('/document/')[1]):url.includes('uuid=')?decodeURIComponent(url.split('uuid=')[1]):null;
  if(reference&&window.initial.documents)return Response.json(window.initial.documents[reference]||{error:'Not found'},{status:window.initial.documents[reference]?200:404});
  const p=window.policy[key]||{};
  const emptyPlan={fixed:[],groups:[],errors:[],rows:[],current:window.initial.current||[],review:'review1',contextRevision:1};
  if(p.hold)return new Promise(resolve=>window.pending.push({call,resolve}));
  if(p.network)throw new TypeError('Connection interrupted');
  return Response.json(p.body??(key==='index'?{nameIndex:{}}:key==='data'?{success:true,data:{isSpellcaster:false,spellsToChoose:{},availableSpells:[],progressionReady:true}}:key==='gear'?[rope]:key==='plan'?emptyPlan:key==='manage'?{success:true}:[]),{status:p.status||200});
 }};
window.actorContext={actor:window.initial.actor||{id:'a',items:[],derived:{actions:[],items:[],spellcasting:{classes:[]}}},isActionBusy:()=>false,getDraftValue:(_,value)=>value};
const root=createRoot(document.getElementById('root')); let mounted=true, show=true;
const advancementClass={uuid:'Compendium.shadowdark.classes.Item.thief',name:'Thief',system:{hitPoints:'d4',patron:{required:false},talents:['Compendium.shadowdark.talents.Item.backstab']}};
const advancementProps={actorId:'',currentLevel:0,targetLevel:1,classObj:advancementClass,classUuid:advancementClass.uuid,ancestry:null,abilities:{},spells:[],skipLanguageSelection:true,onComplete:()=>{},onCancel:()=>{}};
function AutoGrants(){const sync=useAutomaticSpellGrants(window.initial.actor,async()=>{window.refreshes=(window.refreshes||0)+1;if(window.initial.afterSync){window.initial.actor=window.initial.afterSync;window.render()}});return <div>{sync.error&&<p role="alert">{sync.error}</p>}<button onClick={sync.retry}>Retry granted spells</button></div>}
function Advancement(){const {state,actions}=useLevelUp(advancementProps);window.completeAdvancement=()=>{actions.setHpRoll(4);actions.setGoldRoll(60);actions.setRolledTalents([{name:'Native rolled talent',type:'Talent',system:{},effects:[]}]);};return <><output>{state.error||'No error'}</output><button disabled={!actions.isComplete()}>Finish advancement</button></>;}
function BonusAdvancement(){const {state,actions}=useLevelUp({...advancementProps,currentLevel:window.initial.level-1,targetLevel:window.initial.level});
 window.setBonusGrants=()=>actions.setRolledBoons(window.initial.grants);window.bonusState=state.extraSpellSelection;
 return <ExtraSpellSelectionSection active={state.extraSpellSelection.active} maxTier={state.extraSpellSelection.maxTier} source={state.extraSpellSelection.source}
 requiredCount={state.extraSpellRequired} availableSpells={state.extraSpellsList} selectedSpells={state.extraSpellSelection.selected} status={state.extraSpellData.ready?'READY':'LOADING'}
 onSelectionChange={selected=>actions.setExtraSpellSelection({...state.extraSpellSelection,selected})}/>;}
const effectProps={...advancementProps,classObj:{...advancementClass,system:{...advancementClass.system,talents:[]}}};
function EffectAdvancement(){const {state,actions}=useLevelUp(effectProps);
 window.prepareEffectTest=()=>{actions.setHpRoll(4);actions.setGoldRoll(60);actions.setSelectedSpells(window.initial.learned||[]);if(window.initial.grants)actions.setRolledTalents(window.initial.grants)};
 window.replaceLearned=spells=>actions.setSelectedSpells(spells);window.effectSelection=state.spellAdvantageSelection;
 return <><button onClick={actions.handleRollTalent}>Roll talent</button><output>{state.error||'No error'}</output>
 {state.spellEffectData.ready&&<SpellAdvantageSelectionSection required={state.spellAdvantageSelection.required} selected={state.spellAdvantageSelection.selected} options={state.spellEffectOptions}
 onSelectionChange={selected=>actions.setSpellAdvantageSelection({...state.spellAdvantageSelection,selected})}/>}
 {state.statGrants.map((grant,index)=><div data-stat-grant={index} key={index}><StatPoolSelectionSection title={grant.name} total={statChoiceRule(grant).total} maxPerStat={statChoiceRule(grant).maxPerStat}
 allocated={state.statChoices[index]||{}} onChange={(stat,delta)=>actions.changeStatChoice(index,stat,delta)}/></div>)}
 <button disabled={!actions.isComplete()} onClick={()=>actions.handleConfirm()}>Finish effect advancement</button></>;}
function ParityPicker(){const [open,setOpen]=React.useState(false);return <><button onClick={()=>setOpen(true)}>Open spell manager</button><SpellPicker isOpen={open} onClose={()=>setOpen(false)} onSave={intent=>window.saved=intent} title="Manage spells" tier={1} classUuid={window.initial.listUuid||"Compendium.shadowdark.classes.Item.wizard"} knownSpells={window.initial.owned||[]} maxSelections={window.initial.limit} actor={window.initial.actor}/></>;}
function Consumer(){switch(window.initial.which){
case 'item-spells': {
 const source=window.initial.actor;
 const derived=prepareShadowdarkView(source,{classDocument:()=>({name:'Wizard',type:'Class',system:{spellcasting:{ability:'int'}}}),
 spellDocument:ref=>window.initial.spells[ref.id]||null,label:ref=>window.initial.spells[ref.id]?.name||null});
 window.actorContext={actor:{...source,derived},card:null,rollDialog:{open:false},isActionBusy:()=>false,
 startAction:action=>window.lastAction=action,openCard:card=>window.lastCard=card,deleteItem:id=>window.discarded=id};
 window.markSpent=()=>{source.items[0].flags={shadowdark:{sheetDelver:{scrollSpent:true}}};window.render()};
 return <><Spells/><section aria-label="Inventory"><ItemRow item={source.items[0]} expandedItems={new Set()} toggleItem={()=>{}}/></section></>;
}
case 'importer':return <Importer/>;
case 'bestiary':return <Bestiary/>;
case 'wand-card':
case 'resource-card': {
 const source=window.initial.actor;
 const wand=window.initial.which==='wand-card';
 const derived=prepareShadowdarkView(source,{classDocument:()=>({name:wand?'Priest':'Wizard',type:'Class',system:{spellcasting:{ability:wand?'wis':'int'}}}),spellDocument:ref=>window.initial.spells?.[ref.id]||null,label:ref=>window.initial.spells?.[ref.id]?.name||null});
 const selected=wand?source.items[0]._id:'spell';
 if(!wand)derived.items.find(item=>item.id==='spell').diagnostics=['Fixture source note'];
 window.actorContext={actor:{...source,derived},card:{kind:'item',itemId:selected},rollDialog:{open:false},isActionBusy:()=>false,startAction:(action,options)=>window.lastAction={action,options},closeCard:()=>{},openCard:()=>{},performRoll:()=>{},
 runItemControl:control=>{window.lastControl=control;for(const write of control.writes){const item=source.items.find(row=>row._id===write.itemId);for(const [path,value]of Object.entries(write.patch)){const parts=path.split('.');let target=item;for(const key of parts.slice(0,-1))target=target[key]??={};target[parts.at(-1)]=value}}window.render()}};
 window.failWand=broken=>{source.items[0].flags={shadowdark:{sheetDelver:{wand:{lostSpells:['Compendium.shadowdark.spells.Item.ItoZZ0nli29N5d7G'],broken}}}};window.render()};
 return <ResourceDetailModal/>;
}
case 'auto-grants':return <React.StrictMode><AutoGrants/></React.StrictMode>;
case 'parity-picker':return <ParityPicker/>;
case 'advancement':return <Advancement/>;
case 'bonus-advancement':return <BonusAdvancement/>;
case 'effect-advancement':return <EffectAdvancement/>;
case 'dialog':return <><button style={{position:'fixed',bottom:0,left:0,width:'100%',height:80,zIndex:150}}>Host tools</button><ModuleDialog open title="Resource card" suspended={!!window.suspendDialog} onClose={()=>{}} footer={<button onClick={()=>window.cardClicked=true}>Use resource</button>}>Resource details</ModuleDialog>{window.suspendDialog&&<div style={{position:'fixed',inset:0,zIndex:100}}><button onClick={()=>window.hostClicked=true}>Shared host action</button></div>}</>;
case 'gear':return <Gear isOpen onClose={()=>{}} onCreate={async item=>{window.addedGear=item}}/>;
case 'spell-picker':return <SpellPicker isOpen onClose={()=>{}} onSave={()=>{}} title="Manage spells" tier={1} classUuid="Compendium.shadowdark.classes.Item.wizard" knownSpells={[]}/>;
case 'native-language-edit':return <LanguagePicker isOpen onClose={()=>{}} onSelect={selected=>window.savedLanguages=selected} currentLanguages={window.initial.current||[]} actorId="a"/>;
case 'languages':return <LanguagePicker isOpen onClose={()=>{}} onSelect={()=>{}} currentLanguages={[]} actorId="a"/>;
case 'mastery':return <><WeaponSelectionSection required={1} selected={[]} onSelectionChange={()=>{}}/><ArmorSelectionSection required={1} selected={[]} onSelectionChange={()=>{}}/></>;
case 'details':return <Details/>;
default:return <Spells/>;}}
function Delayed(){const [ready,setReady]=React.useState(!window.initial.delay);React.useEffect(()=>{const timer=setTimeout(()=>setReady(true),window.initial.delay||0);return ()=>clearTimeout(timer)},[]);return ready&&show?<Consumer/>:null;}
window.render=()=>root.render(mounted?(window.initial.which==='generator'?<Generator/>:<ShadowdarkUIProvider><Delayed key={show?'open':'closed'}/></ShadowdarkUIProvider>):null);
window.retire=()=>emit('world:contextChanged',{keys:[],identity:{worldId:'w',contextRevision:2}});window.sourceChanged=()=>{emit('document:changed',{type:'Item',id:'worldSpell',action:'delete'});emit('document:listInvalidated',{type:'Item',reason:'changed'});}; window.consumerUnmount=()=>{show=false;window.render()};window.unmount=()=>{mounted=false;window.render()};
window.change=values=>{window.sdk={...window.sdk,...values};window.render()};
window.answer=(index,body,status=200)=>window.pending[index].resolve(Response.json(body,{status}));
window.render();
`, resolveDir: moduleRoot, loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [{ name: 'sdk-test-boundary', setup(b) {
    if(providerBaseline)b.onLoad({filter:/ShadowdarkUIContext\.tsx$/},a=>({loader:'tsx',resolveDir:path.dirname(a.path),contents:execFileSync('git',['show',providerBaseline+':src/ui/context/ShadowdarkUIContext.tsx'],{cwd:moduleRoot,encoding:'utf8'})}));
    if(languageBaseline)b.onLoad({filter:/(?:LanguageSelectionModal\.tsx|Generator\.tsx|logic\/rules\.ts)$/},a=>({loader:a.path.endsWith('.tsx')?'tsx':'ts',resolveDir:path.dirname(a.path),contents:execFileSync('git',['show',languageBaseline+':'+path.relative(moduleRoot,a.path)],{cwd:moduleRoot,encoding:'utf8'})}));
    if(baseline)b.onLoad({filter:/SpellSelectionModal\.tsx$/},a=>({loader:'tsx',resolveDir:path.dirname(a.path),contents:execFileSync('git',['show',baseline+':src/ui/components/SpellSelectionModal.tsx'],{cwd:moduleRoot,encoding:'utf8'})}));
    b.onResolve({ filter: /^@sheet-delver\/sdk(?:\/react)?$/ }, a => ({ path: a.path, namespace: 'stub' }));
    b.onResolve({ filter: /ShadowdarkActorContext$/ }, () => ({ path: 'actor', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ loader: 'tsx', resolveDir: moduleRoot, contents: a.path === 'actor' ? 'export const useShadowdarkActor=()=>window.actorContext;' : a.path.endsWith('/react') ? `import React from 'react';export const useSDK=()=>window.sdk;export const useSDKComponents=()=>({ConfirmationModal:()=>null,LoadingModal:({message})=><div role="status">{message}</div>});` : `export const logger={info(){},warn(){},error(){},debug(){}};export const processHtmlContent=x=>x;export const getErrorMessage=e=>String(e);` }));
} }] });
const browser = await chromium.launch({ ...(process.env.SHADOWDARK_CHROME ? { executablePath: process.env.SHADOWDARK_CHROME } : {}), headless: true, args: ['--no-sandbox', '--disable-background-networking'] });
const results = [];
async function test(name, initial, run) {
    const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice(7);if(only&&!name.startsWith(only))return;
    if(process.argv.includes('--backgrounds-only')&&!name.startsWith('SD-UI13'))return;
    if(process.argv.includes('--cards-only')&&!name.startsWith('SD-UI10/11'))return;
    if(providerBaseline&&!name.startsWith('SD02-06') )return;
    if((languageBaseline||process.argv.includes('--language-only'))&&!name.startsWith('SD02-12'))return;
    if(parityOnly&&!name.startsWith('SD02'))return;
    if(baseline&&name.startsWith('SD02-12'))return;
    const page = await browser.newPage(); const errors = []; page.setDefaultTimeout(3000);
    page.on('pageerror', e => errors.push(e.message)); await page.route('**/*', r => r.abort());
    try {
        await page.setContent('<div id="root" class="sdk-module--shadowdark"></div>');
        if(name.startsWith('SD-UI13')) { assert.ok(process.env.SHADOWDARK_HOST_CSS, 'Core CSS including preflight is required'); await page.addStyleTag({path:process.env.SHADOWDARK_HOST_CSS}); await page.addStyleTag({path:path.join(moduleRoot,'assets/presentation.css')}); }
        if(['resource-card','wand-card'].includes(initial.which)) { await page.setViewportSize({width:initial.width,height:900}); if(process.env.SHADOWDARK_CARD_TAILWIND)await page.addStyleTag({path:process.env.SHADOWDARK_CARD_TAILWIND});await page.addStyleTag({path:path.join(moduleRoot,'assets/presentation.css')}); } await page.evaluate(x => window.initial = x, initial);
        await page.addScriptTag({ content: bundled.outputFiles[0].text });
        await run(page); assert.deepEqual(errors, []); results.push({ name, ok: true }); console.log(`✓ ${name}`);
    } catch (e) {
        results.push({ name, ok: false, error: String(e), text: await page.locator('body').innerText(), calls: await page.evaluate(() => window.calls.map(c => ({ key: c.key, aborted: c.signal?.aborted }))), errors }); console.error(`✗ ${name}: ${e.message}`);
        await page.screenshot({ path: path.join(out, `${results.length}-failure.png`) });
    } finally { await page.close(); }
}
const text = (p, value) => p.getByText(value, { exact: true }).waitFor({ timeout: 3000 });
const count = (p, key) => p.evaluate(k => window.calls.filter(c => c.key === k).length, key);
const settled = p => p.waitForTimeout(100);
try {
    if(process.argv.includes('--backgrounds-only') || process.env.SHADOWDARK_HOST_CSS) {
    for (const which of ['generator', 'importer', 'bestiary']) for (const width of [390, 1280]) {
        await test(`SD-UI13: ${which} exposes host canvas at ${width}px`, {which, policy:{bestiary:{body:{success:true,entries:[{ref:{documentType:'Actor',id:'npc'},name:'Visible monster',source:'world',level:1,ac:10,hp:4}],compendiumAvailable:true}}}}, async p=>{
            await p.setViewportSize({width,height:900});
            assert.ok(process.env.SHADOWDARK_CARD_TAILWIND, 'compiled module CSS is required');
            await p.addStyleTag({path:process.env.SHADOWDARK_CARD_TAILWIND});
            await p.addStyleTag({content:'#root{min-height:100vh;background:rgb(16,32,55);color:rgb(241,245,251)}'});
            await p.getByText('Back to Dashboard',{exact:false}).waitFor();
            const pageRoot=p.locator('#root > :first-child');
            assert.equal(await pageRoot.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
            assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'tool must fit the viewport');
            if(which==='bestiary') {
                const card=p.getByRole('button',{name:/Visible monster/});
                assert.equal(await card.evaluate(e=>getComputedStyle(e).color),'rgb(0, 0, 0)');
                assert.equal(await card.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
            }
            await p.screenshot({path:path.join(out,`background-${which}-${width}.png`),animations:'disabled'});
            await p.addStyleTag({content:'#root{background:rgb(234,241,248);color:rgb(23,41,63)}'});
            assert.equal(await pageRoot.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
        });
    }
    await test('SD-UI13: generator failure keeps the canvas and a readable error panel', {which:'generator',policy:{classes:{status:503}}},async p=>{
        await p.getByRole('alert').first().waitFor();
        assert.ok(process.env.SHADOWDARK_CARD_TAILWIND);
        await p.addStyleTag({path:process.env.SHADOWDARK_CARD_TAILWIND});
        assert.equal(await p.locator('#root > :first-child').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
        assert.equal(await p.locator('#root > :first-child > :first-child').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
    });
    }
    await test('RV-16: advancement consumes a bare document response and completes native fixed grants', {which:'advancement',documents:{'Compendium.shadowdark.talents.Item.backstab':{_id:'backstab',name:'Backstab',type:'Talent',system:{},effects:[]}}}, async p=>{
        await p.waitForFunction(()=>typeof window.completeAdvancement==='function');
        await p.evaluate(()=>window.completeAdvancement());
        await p.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Finish advancement').disabled);
        assert.equal(await p.getByText('No error',{exact:true}).count(),1);
    });
    await test('RV-16: an unavailable required fixed grant still blocks advancement', {which:'advancement',documents:{}}, async p=>{
        await p.waitForFunction(()=>typeof window.completeAdvancement==='function');await p.evaluate(()=>window.completeAdvancement());
        await p.getByText(/Required class or ancestry talents are unavailable/).waitFor();
        assert.equal(await p.getByRole('button',{name:'Finish advancement'}).isDisabled(),true);
    });
    await test('R19: resource footer clears host tools; suspension yields to shared host dialog', { which: 'dialog' }, async p => {
        await p.setViewportSize({width:320,height:900});
        await p.addStyleTag({content:'.fixed{position:fixed}.inset-0{inset:0}.flex{display:flex}.items-end{align-items:flex-end}.justify-center{justify-content:center}.relative{position:relative}.flex-col{flex-direction:column}.w-full{width:100%}'});
        await p.getByRole('button',{name:'Use resource'}).click({timeout:1500});
        assert.equal(await p.evaluate(()=>window.cardClicked),true);
        await p.evaluate(()=>{window.suspendDialog=true;window.render()});
        await p.getByRole('button',{name:'Shared host action'}).click({timeout:1500});
        assert.equal(await p.evaluate(()=>window.hostClicked),true);
        await p.evaluate(()=>{window.suspendDialog=false;window.cardClicked=false;window.render()});
        await p.getByRole('button',{name:'Use resource'}).click({timeout:1500});
        assert.equal(await p.evaluate(()=>window.cardClicked),true);
    });
    await test('RV-10/R19: empty-key context event refetches loaded open gear and preserves search', { which: 'gear', delay: 50 }, async p => {
        await text(p, 'Current Rope'); await p.getByPlaceholder('Search gear...').fill('Rope');
        await p.evaluate(() => window.retire()); await text(p, 'Current Rope'); await settled(p);
        assert.equal(await p.getByPlaceholder('Search gear...').inputValue(), 'Rope');
        for (const key of ['gear', 'magic-items', 'properties']) assert.equal(await count(p, key), 2, key);
    });
    await test('RV-10: consumer mounted before provider readiness loads', { which: 'gear', policy: { index: { hold: true } } }, async p => {
        await p.waitForFunction(() => window.pending.length === 1); await p.evaluate(() => window.answer(0, { nameIndex: {} })); await text(p, 'Current Rope');
    });
    await test('RV-10: context invalidation while initial gear requests are pending retires stale results', { which: 'gear', delay: 50, policy: { gear: { hold: true }, 'magic-items': { hold: true }, properties: { hold: true } } }, async p => {
        await p.waitForFunction(() => window.pending.length === 3);
        await p.evaluate(() => { window.policy = {}; window.retire(); }); await text(p, 'Current Rope');
        await p.evaluate(() => window.pending.forEach((_, i) => window.answer(i, [{ name: 'Stale Rope', type: 'Basic', pack: 'shadowdark.gear', _id: 'stale' }])));
        await settled(p); assert.equal(await p.getByText('Stale Rope', { exact: true }).count(), 0);
        assert.equal(await p.evaluate(() => window.pending.every(p => p.call.signal.aborted)), true);
        for (const key of ['gear', 'magic-items', 'properties']) assert.equal(await count(p, key), 2);
    });
    for (const change of [{ worldId: 'w2' }, { currentUser: { id: 'u2', role: 1 } }, { currentUser: { id: 'p', role: 4 } }]) {
        await test(`RV-10: open gear follows scope ${JSON.stringify(change)}`, { which: 'gear', delay: 50 }, async p => {
            await text(p, 'Current Rope'); await p.evaluate(x => window.change(x), change); await text(p, 'Current Rope'); await settled(p); assert.equal(await count(p, 'gear'), 2);
        });
        await test(`RV-10: pending gear retires across scope ${JSON.stringify(change)}`, { which: 'gear', policy: { gear: { hold: true } } }, async p => {
            await p.waitForFunction(() => window.pending.length === 1);
            await p.evaluate(x => { window.policy = {}; window.change(x); }, change); await text(p, 'Current Rope');
            assert.equal(await p.evaluate(() => window.pending[0].call.signal.aborted), true);
            await p.evaluate(() => window.answer(0, [{ name: 'Stale Rope', type: 'Basic', pack: 'shadowdark.gear', _id: 'stale' }]));
            await settled(p); assert.equal(await p.getByText('Stale Rope', { exact: true }).count(), 0); assert.equal(await count(p, 'gear'), 2);
        });
    }
    await test('RV-10: disconnect clears rows and reconnect recovers the open picker', { which: 'gear', delay: 50 }, async p => {
        await text(p, 'Current Rope'); await p.evaluate(() => window.change({ isConnected: false }));
        await p.getByRole('alert').waitFor(); assert.equal(await p.getByText('Current Rope', { exact: true }).count(), 0);
        await p.evaluate(() => window.change({ isConnected: true })); await text(p, 'Current Rope'); assert.equal(await count(p, 'gear'), 2);
    });
    await test('RV-10/11: caller change cannot reuse loaded gear after permission denial', { which: 'gear', delay: 50 }, async p => {
        await text(p, 'Current Rope');
        await p.evaluate(() => { window.policy = { gear: { status: 403 } }; window.change({ currentUser: { id: 'restricted', role: 1 } }); });
        await p.getByRole('alert').waitFor(); assert.equal(await p.getByText('Current Rope', { exact: true }).count(), 0); assert.equal(await count(p, 'gear'), 2);
        await p.evaluate(() => window.policy = {}); await p.getByRole('button', { name: 'Retry', exact: true }).click(); await text(p, 'Current Rope');
    });
    await test('RV-10: consumer unmount aborts unused pending collection reads', { which: 'gear', delay: 50, policy: { gear: { hold: true } } }, async p => {
        await p.waitForFunction(() => window.pending.length === 1); await p.evaluate(() => window.consumerUnmount());
        await p.waitForFunction(() => window.pending[0].call.signal.aborted); await p.evaluate(() => window.answer(0, []));
    });
    await test('RV-11: partial gear success shows denied magic items and retries only the failed shard', { which: 'gear', delay: 50, policy: { 'magic-items': { status: 403, body: { error: 'Pack not available to you' } } } }, async p => {
        await p.getByRole('alert').waitFor(); assert.match(await p.getByRole('alert').innerText(), /magic-items.*403/i);
        await settled(p); assert.equal(await count(p, 'magic-items'), 1, 'no automatic denial loop');
        await p.evaluate(() => window.policy = {}); await p.getByRole('button', { name: 'Retry', exact: true }).click(); await text(p, 'Current Rope');
        assert.equal(await count(p, 'magic-items'), 2); assert.equal(await count(p, 'gear'), 1);
    });
    for (const policy of [{ status: 403 }, { status: 503 }, { status: 404 }, { network: true }, { body: {} }]) {
        await test(`RV-11: Generator classes failure ${JSON.stringify(policy)} is explicit and recovers to valid empty`, { which: 'generator', delay: 50, policy: { classes: policy } }, async p => {
            await p.getByRole('alert').waitFor(); assert.match(await p.getByRole('alert').innerText(), /classes/i);
            assert.equal(await p.getByText('Loading classes…', { exact: true }).count(), 0);
            await p.evaluate(() => window.policy = {}); await p.getByRole('button', { name: 'Retry', exact: true }).click();
            await p.getByRole('button',{name:'Create Character',exact:true}).waitFor(); assert.equal(await p.getByRole('alert').count(), 0); assert.equal(await count(p, 'classes'), 2);
        });
    }
    await test('RV-11: valid empty gear is ready and explains the empty result', { which: 'gear', delay: 50, policy: { gear: { body: [] } } }, async p => {
        await p.getByText(/No gear/).waitFor(); assert.equal(await p.getByRole('alert').count(), 0); assert.equal(await count(p, 'gear'), 1);
    });
    await test('RV-11: Generator partial success cannot hide failed classes; retry recovers', { which: 'generator', policy: { classes: { status: 403 } } }, async p => {
        await p.getByRole('alert').waitFor(); assert.match(await p.getByRole('alert').innerText(), /classes.*403/i);
        assert.equal(await p.getByRole('button', { name: 'Create Character', exact: true }).count(), 0);
        await p.evaluate(() => window.policy = {}); await p.getByRole('button', { name: 'Retry', exact: true }).click();
        await p.getByRole('button', { name: 'Create Character', exact: true }).waitFor(); assert.equal(await count(p, 'classes'), 2); assert.equal(await count(p, 'ancestries'), 1);
    });
    await test('RV-11: Generator selected level 1 mode requires patrons and recovers', { which: 'generator', policy: { patrons: { status: 503 } } }, async p => {
        await p.getByRole('button', { name: 'Create Character', exact: true }).waitFor();
        await p.locator('input[name="level0"]').nth(1).evaluate(el => el.click()); await p.getByRole('alert').waitFor(); assert.match(await p.getByRole('alert').innerText(), /patrons.*503/i);
        await p.evaluate(() => window.policy = {}); await p.getByRole('button', { name: 'Retry', exact: true }).click(); await p.getByRole('button', { name: 'Create Character', exact: true }).waitFor();
        assert.equal(await p.locator('input[name="level0"]').nth(1).isChecked(), true);
    });
    await test('RV-10: provider unmount retires pending requests', { which: 'gear', policy: { gear: { hold: true } } }, async p => {
        await p.waitForFunction(() => window.pending.length === 1); await p.evaluate(() => window.unmount()); await p.waitForFunction(() => window.pending[0].call.signal.aborted);
        await p.evaluate(() => window.answer(0, [])); await settled(p); assert.equal(await p.locator('#root').innerText(), '');
    });
    await test('RV-11: spell picker failure cannot save; retry and loaded invalidation preserve search', { which: 'spell-picker', policy: { spells: { status: 403 } } }, async p => {
        await p.getByRole('alert').waitFor(); assert.equal(await p.getByRole('button', { name: 'SAVE CHANGES' }).isDisabled(), true);
        await p.evaluate(() => window.policy = { spells: { body: [{ uuid: 'Compendium.shadowdark.spells.Item.light', name: 'Light', system: { tier: 1, class: ['Compendium.shadowdark.classes.Item.wizard'] } }] } });
        await p.getByRole('button', { name: 'Retry', exact: true }).click(); await text(p, 'Light');
        await p.getByPlaceholder('Filter spells by name...').fill('Light'); await p.evaluate(() => window.retire()); await text(p, 'Light');
        assert.equal(await p.getByPlaceholder('Filter spells by name...').inputValue(), 'Light'); assert.equal(await count(p, 'spells'), 3);
    });
    await test('RV-11: language picker denial and recovery keep save gated', { which: 'languages', policy: { plan: { status: 403 } } }, async p => {
        await p.getByRole('alert').waitFor(); assert.equal(await p.getByRole('button', { name: 'Save Languages' }).isDisabled(), true);
        await p.evaluate(() => window.policy = {}); await p.getByRole('button', { name: 'Retry', exact: true }).click();
        await text(p, 'No matching common languages.'); assert.equal(await p.getByRole('button', { name: 'Save Languages' }).isDisabled(), false);
    });
    await test('RV-11: mastery consumers share failed reads, expose retry and accept valid empty options', { which: 'mastery', policy: { gear: { status: 503 } } }, async p => {
        await p.getByRole('alert').first().waitFor(); assert.equal(await count(p, 'gear'), 1);
        await p.evaluate(() => window.policy = { gear: { body: [] } }); await p.getByRole('button', { name: 'Retry', exact: true }).first().click();
        await p.getByText(/No weapon options/).waitFor(); await p.getByText(/No armor options/).waitFor(); assert.equal(await count(p, 'gear'), 2);
    });
    await test('RV-10/11: Details picker recovers from denial and invalidation while preserving search', { which: 'details', policy: { backgrounds: { status: 403 } } }, async p => {
        await p.getByText('Background', { exact: true }).waitFor();
        await p.getByText('Background', { exact: true }).locator('..').locator('..').getByRole('button', { name: 'Edit', exact: true }).click();
        await p.getByRole('alert').waitFor(); await p.evaluate(() => window.policy = { backgrounds: { body: [{ uuid: 'Compendium.shadowdark.backgrounds.Item.sailor', name: 'Sailor' }] } });
        await p.getByRole('button', { name: 'Retry', exact: true }).click(); await p.getByRole('button', { name: 'Sailor', exact: true }).waitFor();
        await p.getByPlaceholder('Search Background...').fill('Sailor'); await p.evaluate(() => window.retire());
        await p.getByRole('button', { name: 'Sailor', exact: true }).waitFor(); assert.equal(await p.getByPlaceholder('Search Background...').inputValue(), 'Sailor'); assert.equal(await count(p, 'backgrounds'), 3);
    });
    await test('SD02-02 Spells uses its exact caller-derived world Class without unrelated catalog demand', {which:'spells',actor:{id:'a',items:[],derived:{actions:[],items:[],spellModel:{owned:[],sources:[{classUuid:'Item.worldClass',listUuid:'Item.worldClass',name:'Exact world Class',grant:'wizard',limits:{1:{status:'known',value:1}}}]}}},policy:{classes:{status:403}}},async p=>{
        await p.getByRole('button',{name:/TIER 1/}).waitFor(); assert.equal(await count(p,'classes'),0);
        await p.evaluate(()=>window.retire()); await p.getByRole('button',{name:/TIER 1/}).waitFor();
        assert.equal(await p.getByText('Loading classes…',{exact:true}).count(),0);
    });
    const worldSpell={uuid:'Item.worldSpell',name:'World-only spell',type:'Spell',system:{tier:1,class:['Compendium.shadowdark.classes.Item.wizard']}};
    await test('SD02-06 loaded world spell catalog follows public Item events once and preserves search',{which:'parity-picker',owned:[],limit:3,policy:{spells:{body:[worldSpell]}}},async p=>{
        await p.getByRole('button',{name:'Open spell manager'}).click();await p.getByRole('button',{name:'Add World-only spell',exact:true}).waitFor();await p.getByPlaceholder('Filter spells by name...').fill('World');
        await p.evaluate(()=>{window.policy.spells={body:[]};window.sourceChanged()});await p.getByText(/No spells found/).waitFor();assert.equal(await p.getByPlaceholder('Filter spells by name...').inputValue(),'World');assert.equal(await count(p,'spells'),2);assert.equal(await count(p,'index'),2);
    });
    await test('SD02-06 Item source change retires a pending catalog response',{which:'parity-picker',owned:[],limit:3,policy:{spells:{hold:true}}},async p=>{
        await p.getByRole('button',{name:'Open spell manager'}).click();await p.waitForFunction(()=>window.pending.length===1);
        await p.evaluate(()=>{window.policy.spells={body:[]};window.sourceChanged()});await p.getByText(/No spells found/).waitFor();await p.evaluate(row=>window.answer(0,[row]),worldSpell);await settled(p);assert.equal(await p.getByRole('button',{name:'Add World-only spell',exact:true}).count(),0);assert.equal(await count(p,'spells'),2);
    });
    const spell = {type:'Spell', uuid:'Compendium.shadowdark.spells.Item.light',name:'Light',system:{tier:1,class:['Compendium.shadowdark.classes.Item.wizard'],duration:{type:'rounds',value:2}}};
    const nativeWand=JSON.parse(fs.readFileSync(path.resolve(process.env.SHADOWDARK_NATIVE||'temp/shadowdark','data/packs/magic-items.db/wand_of_blind_deafen__yyUwr6H9imWcJ9YS.json'),'utf8'));
    for(const sourced of [true,false]) for(const caster of [true,false]) await test(`SD-UI22 legacy wand card source=${sourced} caster=${caster}`,{
        which:'wand-card',width:768,actor:{_id:'wandActor',type:'Player',system:{abilities:{wis:{value:14}}},effects:caster?[{_id:'casting',changes:[{key:'system.spellcasting.classes',mode:2,value:'priest'}]}]:[],
            items:[{_id:'wand',name:nativeWand.name,type:nativeWand.type,img:nativeWand.img,system:nativeWand.system,...(sourced?{_stats:{compendiumSource:'Compendium.shadowdark.magic-items.Item.yyUwr6H9imWcJ9YS'}}:{})}]},
        spells:{ItoZZ0nli29N5d7G:{...spell,name:'Blind/Deafen',system:{tier:2,class:['Compendium.shadowdark.classes.Item.oZWzXx1WRLg286zD']}}}
    },async p=>{
        const cast=p.getByRole('button',{name:'Cast Blind/Deafen',exact:true});await cast.waitFor();
        assert.equal(await cast.isEnabled(),caster);assert.equal(await p.getByText('Wand',{exact:true}).count(),1);
        assert.equal(await p.getByText(/Damage unavailable/).count(),0);assert.equal(await p.getByRole('button',{name:/Equip/}).count(),0);
        if(!caster){assert.ok(await p.getByText(/not a spellcaster/).count());return;}
        await cast.click();assert.equal(await p.evaluate(()=>window.lastAction.action.kind),'spell');
        await p.evaluate(()=>window.failWand(false));await settled(p);assert.equal(await cast.isDisabled(),true);
        await p.getByRole('button',{name:'Restore Wand of Blind/Deafen after a full rest',exact:true}).click();
        await settled(p);assert.equal(await cast.isEnabled(),true);
        await p.evaluate(()=>window.failWand(true));await settled(p);assert.equal(await cast.isDisabled(),true);
        assert.equal(await p.getByRole('button',{name:/Restore .*after a full rest/}).count(),0);
    });
    const sourceGear={_id:'N27A6nb0epkHZ3lR',uuid:'Compendium.shadowdark.magic-items.Item.N27A6nb0epkHZ3lR',pack:'shadowdark.magic-items',name:'Scroll of Burning Hands',type:'Basic',
        img:'icons/sundries/scrolls/scroll-writing-orange-black.webp',system:{magicItem:true,description:'<p>@UUID[Compendium.shadowdark.spells.ItN82uLU3PhJFLNm]{Burning Hands}</p>'},
        flags:{fixture:{preserve:true}},effects:[{_id:'effect',name:'Preserved effect',changes:[]}],custom:{preserve:true}};
    await test('SD-UI20 Gear Add preserves exact source and native Item content', {which:'gear',policy:{'magic-items':{body:[sourceGear]}}},async p=>{
        await p.getByPlaceholder('Search gear...').fill('Burning Hands');
        const add=p.getByRole('button',{name:'Add Scroll of Burning Hands to inventory'});
        if(!await add.isVisible())await p.getByRole('button',{name:/Magic Items/}).click();
        await add.click();const copy=await p.evaluate(()=>window.addedGear);
        assert.equal(copy._stats.compendiumSource,sourceGear.uuid);assert.equal(copy._id,undefined);assert.equal(copy.uuid,undefined);
        assert.deepEqual(copy.effects,sourceGear.effects);assert.deepEqual(copy.flags,sourceGear.flags);assert.deepEqual(copy.system,sourceGear.system);assert.deepEqual(copy.custom,sourceGear.custom);
    });
    for (const sourced of [true, false]) await test('SD-UI20 legacy scrolls appear and remain spent with source identity '+sourced, {
        which:'item-spells', actor:{_id:'scrollActor',type:'Player',system:{abilities:{int:{value:14}}},effects:[{_id:'casting',changes:[{key:'system.spellcasting.classes',mode:2,value:'wizard'}]}],
            items:[{_id:'scroll',name:'Scroll of Burning Hands',img:'icons/sundries/scrolls/scroll-writing-orange-black.webp',type:'Basic',_stats:sourced?{compendiumSource:'Compendium.shadowdark.magic-items.Item.N27A6nb0epkHZ3lR'}:undefined,system:{magicItem:true,quantity:1,description:'<p>@UUID[Compendium.shadowdark.spells.ItN82uLU3PhJFLNm]{Burning Hands}</p>'}}]},
        spells:{ItN82uLU3PhJFLNm:{...spell,name:'Burning Hands'}}
    }, async p=>{
        const section=p.getByRole('region',{name:'Spells from items'}),cast=section.getByRole('button',{name:'Cast',exact:true});
        await cast.waitFor();assert.equal(await cast.isEnabled(),true);assert.equal(await section.getByText('No scrolls or wands.').count(),0);
        await section.getByRole('button',{name:/Burning Hands.*details/}).click();assert.deepEqual(await p.evaluate(()=>window.lastCard),{kind:'item',itemId:'scroll'});
        await cast.click();assert.equal(await p.evaluate(()=>window.lastAction.itemId),'scroll');
        await p.evaluate(()=>window.markSpent());await section.getByText('Spent',{exact:true}).waitFor();assert.equal(await cast.isDisabled(),true);
        await p.getByRole('region',{name:'Inventory'}).getByText('Spent',{exact:true}).waitFor();
        assert.equal(await p.evaluate(()=>window.initial.actor.items.length),1);
    });
    const effectSpells=['A','B','C'].map(letter=>({uuid:'Item.spell'+letter,type:'Spell',name:'Learned '+letter,system:{tier:1,class:['Item.wizard']}}));
    const advantage={uuid:'Compendium.shadowdark.talents.Item.IZZnFjWhZurAIZPP',name:'Spellcasting Advantage',type:'Talent',effects:[{name:'Spellcasting Advantage on Spell',changes:[{key:'system.roll.spell.advantage.REPLACEME',mode:2,value:'1'}]}]};
    const effectData={success:true,data:{isSpellcaster:true,spellsToChoose:{1:2},availableSpells:effectSpells,progressionReady:true,talentTable:'Item.table'}};
    await test('SD-UI18 rolled advantage requires a known spell, submits its target and retires an invalidated choice',
        {which:'effect-advancement',learned:effectSpells.slice(0,2),policy:{data:{body:effectData},spells:{body:effectSpells},'roll-talent':{body:{item:advantage}},finalize:{body:{success:true,items:[]}}}},async p=>{
        await p.waitForFunction(()=>typeof window.prepareEffectTest==='function');await p.evaluate(()=>window.prepareEffectTest());
        await p.getByRole('button',{name:'Roll talent',exact:true}).click();
        const select=p.getByLabel('Spell for advantage',{exact:true}),finish=p.getByRole('button',{name:'Finish effect advancement'});
        await select.waitFor();assert.equal(await finish.isDisabled(),true);assert.equal(await select.locator('option').count(),3);
        await select.selectOption('Learned A');assert.equal(await finish.isDisabled(),false);
        await p.evaluate(spells=>window.replaceLearned(spells),effectSpells.slice(1));assert.equal(await finish.isDisabled(),true);
        await select.selectOption('Learned B');assert.equal(await finish.isDisabled(),false);await finish.click();
        await p.waitForFunction(()=>window.calls.some(call=>call.key==='finalize'));
        assert.deepEqual(await p.evaluate(()=>JSON.parse(window.calls.find(call=>call.key==='finalize').body).spellAdvantageSelection),{required:1,selected:['Learned B']});
    });
    await test('SD-UI18 separate stat grants enforce Warlock distinct choices and ordinary two-point allocation',
        {which:'effect-advancement',grants:[{type:'synthetic',name:'Distribute to Stats (Warlock)'},{type:'synthetic',name:'Distribute to Stats'}],policy:{finalize:{body:{success:true,items:[]}}}},async p=>{
        await p.waitForFunction(()=>typeof window.prepareEffectTest==='function');await p.evaluate(()=>window.prepareEffectTest());
        const first=p.locator('[data-stat-grant="0"]'), second=p.locator('[data-stat-grant="1"]'),finish=p.getByRole('button',{name:'Finish effect advancement'});
        await first.waitFor();assert.equal(await finish.isDisabled(),true);
        await first.getByRole('button',{name:'Increase Strength'}).click();assert.equal(await first.getByRole('button',{name:'Increase Strength'}).isDisabled(),true);
        await first.getByRole('button',{name:'Increase Dexterity'}).click();assert.equal(await finish.isDisabled(),true);
        await second.getByRole('button',{name:'Increase Strength'}).click();await second.getByRole('button',{name:'Increase Strength'}).click();
        assert.equal(await finish.isDisabled(),false);await finish.click();await p.waitForFunction(()=>window.calls.some(call=>call.key==='finalize'));
        assert.deepEqual(await p.evaluate(()=>JSON.parse(window.calls.find(call=>call.key==='finalize').body).statChoices),[{str:1,dex:1},{str:2}]);
    });
    const shune={uuid:'Compendium.shadowdark.talents.Item.mgRrWET5MEaGLVNo',type:'Talent',name:'Learn a Wizard Spell',system:{}};
    const wizardList='Compendium.shadowdark.classes.Item.035nuVkU9q2wtMPs';
    const bonusSpells=[1,2,3].flatMap(tier=>['A','B','C'].map(letter=>({uuid:'Item.bonus'+tier+letter,type:'Spell',name:'Bonus '+tier+letter,system:{tier,class:[wizardList]}})));
    for(const [level,tier] of [[3,1],[5,2]]) await test('SD-UI16d bonus picker rounds Shune down at level '+level+' and collects two independent grants',
        {which:'bonus-advancement',level,grants:[shune,shune],policy:{spells:{body:bonusSpells}}},async p=>{
        await p.waitForFunction(()=>typeof window.setBonusGrants==='function');await p.evaluate(()=>window.setBonusGrants());
        await text(p,'0 / 2 Selected');await p.getByRole('button',{name:'Bonus '+tier+'A',exact:true}).waitFor();
        for(const other of [1,2,3].filter(t=>t!==tier)) assert.equal(await p.getByRole('button',{name:'Bonus '+other+'A',exact:true}).count(),0);
        await p.getByRole('button',{name:'Bonus '+tier+'A',exact:true}).click();await text(p,'1 / 2 Selected');
        await p.getByRole('button',{name:'Bonus '+tier+'B',exact:true}).click();await text(p,'2 / 2 Selected');
        assert.equal(await p.getByRole('button',{name:'Bonus '+tier+'C',exact:true}).isDisabled(),true);
        await p.getByRole('button',{name:'Bonus '+tier+'A',exact:true}).click();await text(p,'1 / 2 Selected');
        assert.equal(await p.getByRole('button',{name:'Bonus '+tier+'C',exact:true}).isDisabled(),false);
        assert.deepEqual(await p.evaluate(()=>window.bonusState.selected.map(s=>s.name)),['Bonus '+tier+'B']);
    });
    for(const isInnate of [false,true]) await test('SD-UI16 known '+(isInnate?'granted':'ordinary')+' spell stays visible and disabled with spare capacity', {which:'parity-picker',owned:[{itemId:'known',name:spell.name,tier:1,uuid:spell.uuid,isInnate}],limit:3,policy:{spells:{body:[spell,worldSpell]}}},async p=>{
        await p.getByRole('button',{name:'Open spell manager'}).click();
        const add=p.getByRole('button',{name:'Add Light',exact:true});await add.waitFor();assert.equal(await add.isDisabled(),true);
        assert.equal(await p.getByRole('button',{name:'Add World-only spell',exact:true}).isEnabled(),true);
        await p.getByRole('button',{name:'SAVE CHANGES',exact:true}).click();assert.deepEqual(await p.evaluate(()=>window.saved),{additions:[],removals:[]});
    });
    const turnUuid='Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH';
    const missingGrantActor={items:[{type:'Talent',_stats:{compendiumSource:'Compendium.shadowdark.talents.Item.LfHTnYW8I65x8Y31'}}]};
    await test('SD-UI16c missing fixed grant stays disabled until the automatic saved Item arrives',{which:'parity-picker',actor:missingGrantActor,owned:[{itemId:'owned',name:'Ordinary spell',tier:1,uuid:'Item.owned'}],limit:1,policy:{spells:{body:[{...spell,uuid:turnUuid,name:'Turn Undead'}]}}},async p=>{
        await p.getByRole('button',{name:'Open spell manager'}).click();const add=p.getByRole('button',{name:'Add Turn Undead',exact:true});await add.waitFor();
        assert.equal(await add.isDisabled(),true);await p.getByText('Granted automatically',{exact:true}).waitFor();
        await p.evaluate(uuid=>{window.initial.owned.push({itemId:'granted',name:'Turn Undead',tier:1,uuid,isInnate:true});window.initial.actor.items.push({type:'Spell',_id:'granted',_stats:{compendiumSource:uuid}});window.render()},turnUuid);
        await p.getByRole('region',{name:'Owned spells',exact:true}).getByRole('button',{name:'Turn Undead',exact:true}).waitFor();
        assert.equal(await add.isDisabled(),true);await p.getByText('Spells known: 1 / 1',{exact:true}).waitFor();
    });
    const automaticActor={id:'a',worldContextRevision:1,spellReviewToken:'before',spellGrants:{missing:true,canApply:true}};
    await test('SD-UI16c sheet automatically requests grants once under strict effects and refreshes owned inventory',{which:'auto-grants',actor:automaticActor,afterSync:{...automaticActor,spellReviewToken:'after',spellGrants:{missing:false,canApply:false}},policy:{grants:{body:{success:true}}}},async p=>{
        await p.waitForFunction(()=>window.refreshes===1);await p.evaluate(()=>window.render());
        assert.equal(await p.evaluate(()=>window.calls.filter(c=>c.key==='grants').length),1);
    });
    await test('SD-UI16c automatic grant error is visible without repeated writes; retry uses the same route',{which:'auto-grants',actor:automaticActor,policy:{grants:{status:403,body:{error:{message:'Spell compendium unavailable'}}}}},async p=>{
        await p.getByRole('alert').getByText('Spell compendium unavailable').waitFor();await p.evaluate(()=>window.render());
        assert.equal(await p.evaluate(()=>window.calls.filter(c=>c.key==='grants').length),1);
        await p.evaluate(()=>{window.policy.grants={body:{success:true}}});await p.getByRole('button',{name:'Retry granted spells'}).click();await p.waitForFunction(()=>window.refreshes===2);
        assert.equal(await p.evaluate(()=>window.calls.filter(c=>c.key==='grants').length),2);
    });
    await test('SD-UI16c observer sheet never requests automatic writes',{which:'auto-grants',actor:{...automaticActor,spellGrants:{missing:true,canApply:false}}},async p=>{
        await p.getByRole('button',{name:'Retry granted spells'}).waitFor();assert.equal(await p.evaluate(()=>window.calls.filter(c=>c.key==='grants').length),0);
    });
    for(const list of ['priest','wizard','witch']) await test('SD-UI16b exact owned origin is disabled on '+list+' list',{which:'parity-picker',listUuid:'Item.'+list,owned:[{itemId:'known',uuid:spell.uuid,name:'Shared spell',tier:1}],limit:2,policy:{spells:{body:[{...spell,name:'Shared spell',system:{...spell.system,class:['Item.'+list]}}]}}},async p=>{
        await p.getByRole('button',{name:'Open spell manager'}).click();const add=p.getByRole('button',{name:'Add Shared spell',exact:true});await add.waitFor();assert.equal(await add.isDisabled(),true);
    });
    const owned = [{itemId:'customA',name:'Source-less spell',tier:1,uuid:null},{itemId:'customB',name:'Source-less spell',tier:1,uuid:null}];
    await test('SD02-04/05 loaded picker preserves source-less duplicate Item IDs and unchanged save has empty intent', {which:'parity-picker',owned,limit:3,policy:{spells:{body:[]}}},async p=>{
        await p.getByRole('button',{name:'Open spell manager'}).click();
        await p.getByRole('button',{name:'Remove Source-less spell (copy 1 of 2)',exact:true}).waitFor();
        await p.getByRole('button',{name:'Remove Source-less spell (copy 2 of 2)',exact:true}).waitFor();
        assert.doesNotMatch(await p.locator('body').innerText(),/customA|customB|Spell choices changed/);
        await p.getByRole('button',{name:'SAVE CHANGES',exact:true}).click();
        assert.deepEqual(await p.evaluate(()=>window.saved),{additions:[],removals:[]});
    });
    await test('SD02-04/05 explicit removal identifies only the reviewed duplicate; catalog denial never removes', {which:'parity-picker',owned,limit:3,policy:{spells:{status:403}}},async p=>{
        await p.getByRole('button',{name:'Open spell manager'}).click();await p.getByRole('alert').waitFor();
        assert.equal(await p.getByRole('button',{name:'SAVE CHANGES',exact:true}).isDisabled(),true);
        await p.evaluate(()=>window.policy={spells:{body:[]}});await p.getByRole('button',{name:'Retry',exact:true}).click();
        await p.getByRole('button',{name:'Remove Source-less spell (copy 2 of 2)',exact:true}).click();
        await p.getByRole('button',{name:'SAVE CHANGES',exact:true}).click();
        assert.deepEqual(await p.evaluate(()=>window.saved),{additions:[],removals:['customB']});
    });
    await test('SD02-07/08 zero quota disables additions and keyboard details use shared duration/range', {which:'parity-picker',owned:[],limit:0,policy:{spells:{body:[spell]}}},async p=>{
        const opener=p.getByRole('button',{name:'Open spell manager'});await opener.focus();await p.keyboard.press('Enter');
        await p.getByRole('dialog',{name:'Manage spells'}).waitFor();
        assert.equal(await p.getByRole('button',{name:'Add Light',exact:true}).isDisabled(),true);
        await p.getByRole('button',{name:'Light',exact:true}).focus();await p.keyboard.press('Enter');
        await p.getByText('Range: Unavailable · Duration: 2 Rounds',{exact:true}).waitFor();
        const save=p.getByRole('button',{name:'SAVE CHANGES',exact:true});await save.focus();await p.keyboard.press('Tab');
        assert.equal(await p.evaluate(()=>document.querySelector('[role=dialog]').contains(document.activeElement)),true);
        await p.keyboard.press('Escape');await p.getByRole('dialog').waitFor({state:'hidden'});assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
    });
    await test('SD02-06/08 partial source failure remains explicit with owned rows and working recovery', {which:'parity-picker',owned,limit:3,policy:{spells:{body:{rows:[spell],state:'partial',sources:[{source:'world Items',status:'failed',reason:'permission denied'}]}}}},async p=>{
        await p.getByRole('button',{name:'Open spell manager'}).click();await p.getByText(/Partial catalog/).waitFor();
        await p.getByRole('button',{name:'Remove Source-less spell (copy 1 of 2)',exact:true}).waitFor();
        await p.evaluate(()=>window.policy={spells:{body:[]}});await p.getByRole('button',{name:'Retry unavailable sources',exact:true}).click();
        await p.getByText('No spells found matching your filter.',{exact:true}).waitFor();
        assert.equal(await count(p,'spells'),2);
    });
    await test('SD02-04/08 pending context change retires late catalog, preserves owned rows/search and requires new intent', {which:'parity-picker',owned,limit:3,policy:{spells:{hold:true}}},async p=>{
        await p.getByRole('button',{name:'Open spell manager'}).click();await p.waitForFunction(()=>window.pending.length===1);
        await p.getByPlaceholder('Filter spells by name...').fill('Light');await p.evaluate(()=>{window.policy={spells:{body:[]}};window.retire()});
        await p.getByText('No spells found matching your filter.',{exact:true}).waitFor();
        await p.evaluate(spell=>window.answer(0,[spell]),spell);
        assert.equal(await p.getByPlaceholder('Filter spells by name...').inputValue(),'Light');
        assert.equal(await p.getByRole('button',{name:'Add Light',exact:true}).count(),0);
        await p.getByRole('button',{name:'Remove Source-less spell (copy 1 of 2)',exact:true}).waitFor();
        await p.getByRole('button',{name:'SAVE CHANGES',exact:true}).click();assert.deepEqual(await p.evaluate(()=>window.saved),{additions:[],removals:[]});
    });
    const rare={_id:'r',uuid:'Compendium.shadowdark.languages.Item.r',name:'Star Tongue',type:'Language',system:{rarity:'rare'}};
    const common={_id:'c',uuid:'Compendium.shadowdark.languages.Item.c',name:'Draconic',type:'Language',system:{rarity:'common'}};
    const unknown={_id:'u',uuid:'Compendium.shadowdark.languages.Item.u',name:'Celestial',type:'Language',system:{rarity:'invalid'}};
    await test('SD02-12 ordinary picker uses source rarity and retains unavailable/custom extras with reviewed native allowances',{which:'native-language-edit',current:['Item.unreadable','Old custom tongue'],policy:{languages:{body:[rare,common,unknown]},plan:{body:{fixed:[],groups:[{id:'rare',label:'Rare Languages',count:1,options:[rare.uuid]}],errors:[],rows:[rare,common,unknown],current:['Item.unreadable','Old custom tongue'],review:'review1',contextRevision:1}}}},async p=>{
        await p.getByRole('region',{name:'rare languages',exact:true}).getByRole('button',{name:'Star Tongue',exact:true}).waitFor();
        await p.getByRole('region',{name:'common languages',exact:true}).getByRole('button',{name:'Draconic',exact:true}).waitFor();
        await p.getByRole('region',{name:'Unclassified languages',exact:true}).getByRole('button',{name:'Celestial',exact:true}).waitFor();
        assert.equal(await p.getByRole('button',{name:'Draconic',exact:true}).isDisabled(),true);assert.equal(await p.getByRole('button',{name:'Celestial',exact:true}).isDisabled(),true);
        await p.getByRole('heading',{name:'rare (0/1)',exact:true}).waitFor();await p.getByRole('button',{name:'Star Tongue',exact:true}).click();await p.getByRole('heading',{name:'rare (1/1)',exact:true}).waitFor();await p.getByRole('button',{name:'Save Languages',exact:true}).click();
        await p.waitForFunction(()=>!!window.savedLanguages);assert.deepEqual(await p.evaluate(()=>window.savedLanguages),['Item.unreadable','Old custom tongue',rare.uuid]);
        assert.deepEqual(await p.evaluate(()=>JSON.parse(window.calls.find(c=>c.key==='manage').body)),{actorId:'a',languages:['Item.unreadable','Old custom tongue',rare.uuid],review:'review1',contextRevision:1});
    });
    await test('SD02-12 unchanged language inventory save is a genuine no-op',{which:'native-language-edit',current:['Item.unreadable','Old custom tongue'],policy:{languages:{body:[]}}},async p=>{
        await p.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Save Languages'&&!b.disabled));
        await p.getByRole('button',{name:'Save Languages',exact:true}).click();assert.equal(await p.evaluate(()=>window.savedLanguages),undefined);
    });
    await test('SD-UI09 fixed defaults can be replaced from the complete catalog without adding slots',{which:'native-language-edit',current:[common.uuid],policy:{plan:{body:{fixed:[],suggested:[common.uuid],groups:[{id:'common',label:'Common Languages',count:1,options:[common.uuid,'Item.alternative']},{id:'rare',label:'Rare Languages',count:0,options:[rare.uuid]}],errors:[],rows:[common,{uuid:'Item.alternative',name:'Alternative tongue',type:'Language',system:{rarity:'common'}},rare],current:[common.uuid],review:'review1',contextRevision:1}}}},async p=>{
        await p.getByRole('heading',{name:'common (1/1)',exact:true}).waitFor();
        const alternative=p.getByRole('button',{name:'Alternative tongue',exact:true});
        assert.equal(await alternative.isVisible(),true);assert.equal(await alternative.isDisabled(),true);
        assert.equal(await p.getByRole('button',{name:'Star Tongue',exact:true}).isVisible(),true);
        assert.equal(await p.getByRole('button',{name:'Star Tongue',exact:true}).isDisabled(),true);
        await p.getByRole('button',{name:/Draconic.*default/}).click();
        await alternative.click();await p.getByRole('heading',{name:'common (1/1)',exact:true}).waitFor();
        await p.getByRole('button',{name:'Save Languages',exact:true}).click();await p.waitForFunction(()=>!!window.savedLanguages);
        assert.deepEqual(await p.evaluate(()=>window.savedLanguages),['Item.alternative']);
    });
    for (const width of [360,768,1024,1440]) for(const duration of ['instant','focus']) {
        const art='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#ddd"/><path d="M0 600 L200 30 L400 500 L600 10 L800 600" fill="#222"/></svg>');
        const cardActor={_id:'a',type:'Player',system:{abilities:{int:{value:14}},level:{value:1}},effects:[{_id:'grant',changes:[{key:'system.spellcasting.classes',mode:2,value:'wizard'}]}],items:[{_id:'spell',type:'Spell',name:'Fixture spell',img:art,system:{tier:1,class:['Item.wizard'],duration:{type:duration},description:'<p>Readable spell description across faded artwork.</p>'},effects:[]}]};
        await test(`SD-UI10/11 ${width} ${duration}: native focus, artwork, notes footer and missing-image fallback`,{which:'resource-card',width,actor:cardActor},async p=>{
            const dialog=p.getByRole('dialog');await dialog.waitFor();
            const focus=dialog.getByRole('checkbox',{name:/Focus check/});assert.equal(await focus.count(),duration==='focus'?1:0);
            if(duration==='focus')await focus.check();
            const action=dialog.getByRole('button',{name:'Cast Fixture spell',exact:true});await action.click();
            assert.equal(await p.evaluate(()=>window.lastAction.options.focus),duration==='focus');
            assert.equal(await dialog.locator('.sd-dialog-body .sd-card-notes').count(),0);
            assert.equal(await dialog.locator('.sd-card-title').innerText(),'FIXTURE SPELL');
            assert.equal(await dialog.locator('.sd-dialog-header p').count(),0);
            assert.equal(await dialog.locator('dt').filter({hasText:/^Type$/}).count(),1);
            assert.equal(await dialog.locator('.sd-dialog-footer .sd-card-notes').count(),1);
            await dialog.getByText('Data notes (1)',{exact:true}).click();await dialog.getByText('Fixture source note',{exact:true}).waitFor();
            if(process.env.SHADOWDARK_CARD_TAILWIND){
                const metrics=await dialog.evaluate(el=>{const body=el.querySelector('.sd-dialog-body'),art=el.querySelector('.sd-card-art'),copy=el.querySelector('.sd-card-copy'),notes=el.querySelector('.sd-card-notes'),button=Array.from(el.querySelectorAll('button')).find(b=>b.textContent==='Cast Fixture spell');return{bodyWidth:body.clientWidth,artWidth:art.getBoundingClientRect().width,fade:getComputedStyle(art,'::after').backgroundImage,padding:parseFloat(getComputedStyle(copy).paddingTop),notesBottom:notes.getBoundingClientRect().bottom,buttonTop:button.getBoundingClientRect().top,scroll:document.documentElement.scrollWidth,width:innerWidth};});
                assert.ok(Math.abs(metrics.bodyWidth-metrics.artWidth)<=1);assert.match(metrics.fade,/linear-gradient/);assert.ok(metrics.padding>=150);assert.ok(metrics.notesBottom<=metrics.buttonTop);assert.ok(metrics.scroll<=metrics.width+1);
                await p.screenshot({path:path.join(out,`card-${width}-${duration}.png`)});
            }
            await p.evaluate(()=>{window.initial.actor.items[0].system.duration={type:'instant'};window.render()});
            await focus.waitFor({state:'detached'});await action.click();assert.equal(await p.evaluate(()=>window.lastAction.options.focus),false,'retired focus cannot affect instant casting');
            await p.evaluate(()=>{window.initial.actor.items[0].img='https://blocked.invalid/missing.webp';window.render()});
            await p.waitForFunction(()=>document.querySelector('.sd-card-art')?.hidden===true);
            assert.equal(await action.isEnabled(),true);
            if(process.env.SHADOWDARK_CARD_TAILWIND)assert.ok(await dialog.locator('.sd-card-copy').evaluate(el=>parseFloat(getComputedStyle(el).paddingTop)<30));
        });
    }
    await test('SD-UI17 actor spell card uses labeled inline text and prepared healing dice', {which:'resource-card',width:768,actor:{_id:'a',type:'Player',system:{abilities:{int:{value:14}},level:{value:3}},effects:[{_id:'grant',changes:[{key:'system.spellcasting.classes',mode:2,value:'wizard'}]}],items:[{_id:'spell',type:'Spell',name:'Cure Wounds',system:{tier:1,class:['Item.wizard'],duration:{type:'instant'},damageType:'healing',formula:'(1 + (floor(@level.value/2)))d6',description:'<p>Roll [[/roll (1 + (floor(@level.value/2)))d6]]{1 + half your level (rounded down)}.</p>'},effects:[]}]}}, async p=>{
        const dialog=p.getByRole('dialog');await dialog.waitFor();
        await dialog.getByRole('button',{name:'1 + half your level (rounded down)',exact:true}).waitFor();
        assert.equal(await dialog.locator('[data-formula]').getAttribute('data-formula'),'2d6');
        assert.match(await dialog.innerText(),/Healing[\s\S]*2d6/i);assert.doesNotMatch(await dialog.innerText(),/@level|\[\[|\{1/);
        if(process.env.SHADOWDARK_CARD_TAILWIND) await p.screenshot({path:path.join(out,'inline-spell-label.png')});
    });
    await test('SD-UI14 mixed class choices keep numeric coupled language totals', {which:'native-language-edit',current:[rare.uuid],policy:{plan:{body:{fixed:[],groups:[{id:'class',label:'Class Languages',count:1,options:[rare.uuid,common.uuid]}],errors:[],rows:[rare,common],current:[rare.uuid],review:'mixed-review',contextRevision:1}}}}, async p=>{
        await p.getByRole('heading',{name:'common (0/0)',exact:true}).waitFor();await p.getByRole('heading',{name:'rare (1/1)',exact:true}).waitFor();
        assert.equal(await p.getByRole('button',{name:'Draconic',exact:true}).isDisabled(),true);
        await p.getByRole('button',{name:'Star Tongue',exact:true}).click();await p.getByRole('heading',{name:'common (0/1)',exact:true}).waitFor();
        await p.getByRole('button',{name:'Draconic',exact:true}).click();await p.getByRole('heading',{name:'common (1/1)',exact:true}).waitFor();await p.getByRole('heading',{name:'rare (0/0)',exact:true}).waitFor();
        assert.doesNotMatch(await p.locator('body').innerText(),/choose from/);
    });
    const editorPlan={fixed:[common.uuid],groups:[{id:'class',label:'Class Languages',count:1,options:[rare.uuid]}],errors:[],rows:[common,rare,unknown],current:[common.uuid],review:'review1',contextRevision:1};
    await test('SD03 language counts and fixed grants stay intact through context refresh',{which:'native-language-edit',current:[common.uuid],policy:{plan:{body:editorPlan}}},async p=>{
        await p.getByRole('heading',{name:'common (1/1)',exact:true}).waitFor();
        assert.equal(await p.getByRole('button',{name:/Draconic.*Granted/}).isDisabled(),true);
        await p.getByRole('button',{name:'Star Tongue',exact:true}).click();
        await p.getByRole('heading',{name:'rare (1/1)',exact:true}).waitFor();
        await p.evaluate(()=>window.retire());await p.getByRole('heading',{name:'rare (0/1)',exact:true}).waitFor();
        assert.equal(await p.getByRole('button',{name:'Star Tongue',exact:true}).getAttribute('aria-pressed'),'false');
    });
    await test('SD03 a failed language write requires review and never retries automatically',{which:'native-language-edit',current:[common.uuid],policy:{plan:{body:editorPlan},manage:{network:true}}},async p=>{
        await p.getByRole('button',{name:'Star Tongue',exact:true}).click();await p.getByRole('button',{name:'Save Languages',exact:true}).click();
        await p.getByRole('button',{name:'Refresh languages',exact:true}).waitFor();assert.equal(await count(p,'manage'),1);
        assert.equal(await p.getByRole('button',{name:'Save Languages',exact:true}).isDisabled(),true);
        await p.getByRole('button',{name:'Refresh languages',exact:true}).click();await p.getByRole('heading',{name:'rare (0/1)',exact:true}).waitFor();
        assert.equal(await count(p,'manage'),1);
    });
    const ancestry={_id:'ancestry',uuid:'Compendium.shadowdark.ancestries.Item.ancestry',type:'Ancestry',name:'Controlled ancestry',system:{languages:{common:0,rare:0,select:1,selectOptions:[rare.uuid],fixed:[]},talents:[],talentChoiceCount:0}};
    const groups=[{id:'ancestry',label:'Ancestry Languages',count:1,options:[rare.uuid]},{id:'class',label:'Class Languages',count:0,options:[]},{id:'common',label:'Common Languages',count:0,options:[]},{id:'rare',label:'Rare Languages',count:0,options:[]}];
    const plan={fixed:[],groups,errors:[],rows:[rare],contextRevision:1};
    await test('SD02-12 actual Generator uses an explicit restricted pool and shared keyboard dialog',{which:'generator',policy:{ancestries:{body:[ancestry]},languages:{body:[rare,common,unknown]},plan:{body:plan}}},async p=>{
        await p.locator('select').filter({has:p.locator('option').filter({hasText:'Select Ancestry...'})}).selectOption(ancestry.uuid);
        await p.getByRole('button',{name:'Select (0/1)',exact:true}).click();await p.getByRole('dialog',{name:'Select Languages',exact:true}).waitFor();
        const choice=p.getByRole('button',{name:'Ancestry Languages: Star Tongue',exact:true});await choice.focus();await p.keyboard.press('Space');assert.equal(await choice.getAttribute('aria-pressed'),'true');
        assert.equal(await p.getByRole('region',{name:'Common Languages',exact:true}).count(),0);await p.keyboard.press('Escape');await p.getByRole('dialog',{name:'Select Languages'}).waitFor({state:'hidden'});
        assert.equal(await p.getByRole('button',{name:'Edit Languages',exact:true}).evaluate(el=>el===document.activeElement),true);
    });
    await test('SD02-12 actual Generator retires an initial pending plan after context replacement',{which:'generator',policy:{ancestries:{body:[ancestry]},languages:{body:[rare]},plan:{hold:true}}},async p=>{
        await p.locator('select').filter({has:p.locator('option').filter({hasText:'Select Ancestry...'})}).selectOption(ancestry.uuid);await p.waitForFunction(()=>window.pending.some(row=>row.call.key==='plan'));
        await p.evaluate(({ancestry,plan})=>{window.policy={ancestries:{body:[{...ancestry,system:{...ancestry.system,languages:{...ancestry.system.languages,select:0}}}]},languages:{body:[]},plan:{body:{...plan,groups:plan.groups.map(group=>({...group,count:0})),rows:[]}}};window.retire();},{ancestry,plan});
        await p.getByRole('combobox',{name:'Ancestry',exact:true}).waitFor();await p.waitForFunction(()=>window.calls.filter(row=>row.key==='plan').length>=2);
        const index=await p.evaluate(()=>window.pending.findIndex(row=>row.call.key==='plan'));await p.evaluate(({index,plan})=>window.answer(index,plan),{index,plan});await settled(p);
        assert.equal(await p.getByRole('button',{name:'Select (0/1)',exact:true}).count(),0);assert.equal(await p.getByText('Loading native language choices…',{exact:true}).count(),0);
    });
} finally { await browser.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2)); }
console.log(`${results.filter(r => r.ok).length}/${results.length} passed`);
if (results.some(r => !r.ok)) process.exitCode = 1;
