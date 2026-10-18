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
const { chromium } = await import(process.env.SHADOWDARK_PLAYWRIGHT_MODULE || 'playwright');
const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.resolve(process.argv[2] || path.join(moduleRoot, 'temp/collection-consumers'));
fs.mkdirSync(out, { recursive: true });
const bundled = await build({ stdin: { contents: `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {ShadowdarkUIProvider} from '${moduleRoot}/src/ui/context/ShadowdarkUIContext';
import Gear from '${moduleRoot}/src/ui/components/GearSelectionModal';
import Spells from '${moduleRoot}/src/ui/SpellsTab';
import Generator from '${moduleRoot}/src/ui/tools/Generator';
import Details from '${moduleRoot}/src/ui/DetailsTab';
import SpellPicker from '${moduleRoot}/src/ui/components/SpellSelectionModal';
import LanguagePicker from '${moduleRoot}/src/ui/components/LanguageSelectionModal';
import {useLevelUp} from '${moduleRoot}/src/ui/components/levelup/useLevelUp';
import ModuleDialog from '${moduleRoot}/src/ui/components/ModuleDialog';
import {WeaponSelectionSection} from '${moduleRoot}/src/ui/components/levelup/sections/WeaponSelectionSection';
import {ArmorSelectionSection} from '${moduleRoot}/src/ui/components/levelup/sections/ArmorSelectionSection';
const listeners=new Set(); window.calls=[]; window.pending=[];
window.policy=window.initial.policy||{};
const rope={_id:'rope',uuid:'Compendium.shadowdark.gear.Item.rope',name:'Current Rope',type:'Basic',pack:'shadowdark.gear',system:{cost:{gp:1}}};
window.sdk={isConnected:true,worldId:'w',currentUser:{id:'p',role:1},foundryUrl:'',
 events:{on:(_,fn)=>{listeners.add(fn);return ()=>listeners.delete(fn)}},resolveImageUrl:x=>x||'',addNotification:()=>{},navigate:()=>{},
 fetchWithAuth:async (url,options={})=>{
  const key=url.split('/').at(-1);const call={key,signal:options.signal};window.calls.push(call);
  const reference=url.includes('/document/')?decodeURIComponent(url.split('/document/')[1]):url.includes('uuid=')?decodeURIComponent(url.split('uuid=')[1]):null;
  if(reference&&window.initial.documents)return Response.json(window.initial.documents[reference]||{error:'Not found'},{status:window.initial.documents[reference]?200:404});
  const p=window.policy[key]||{};
  if(p.hold)return new Promise(resolve=>window.pending.push({call,resolve}));
  if(p.network)throw new TypeError('Connection interrupted');
  return Response.json(p.body??(key==='index'?{nameIndex:{}}:key==='gear'?[rope]:[]),{status:p.status||200});
 }};
window.actorContext={actor:{id:'a',items:[],derived:{actions:[],items:[],spellcasting:{classes:[]}}},isActionBusy:()=>false,getDraftValue:(_,value)=>value};
const root=createRoot(document.getElementById('root')); let mounted=true, show=true;
const advancementClass={uuid:'Compendium.shadowdark.classes.Item.thief',name:'Thief',system:{hitPoints:'d4',patron:{required:false},talents:['Compendium.shadowdark.talents.Item.backstab']}};
const advancementProps={actorId:'',currentLevel:0,targetLevel:1,classObj:advancementClass,classUuid:advancementClass.uuid,ancestry:null,abilities:{},spells:[],skipLanguageSelection:true,onComplete:()=>{},onCancel:()=>{}};
function Advancement(){const {state,actions}=useLevelUp(advancementProps);window.completeAdvancement=()=>{actions.setHpRoll(4);actions.setGoldRoll(60);actions.setRolledTalents([{name:'Native rolled talent',type:'Talent',system:{},effects:[]}]);};return <><output>{state.error||'No error'}</output><button disabled={!actions.isComplete()}>Finish advancement</button></>;}
function Consumer(){switch(window.initial.which){
case 'advancement':return <Advancement/>;
case 'dialog':return <><button style={{position:'fixed',bottom:0,left:0,width:'100%',height:80,zIndex:150}}>Host tools</button><ModuleDialog open title="Resource card" suspended={!!window.suspendDialog} onClose={()=>{}} footer={<button onClick={()=>window.cardClicked=true}>Use resource</button>}>Resource details</ModuleDialog>{window.suspendDialog&&<div style={{position:'fixed',inset:0,zIndex:100}}><button onClick={()=>window.hostClicked=true}>Shared host action</button></div>}</>;
case 'gear':return <Gear isOpen onClose={()=>{}} onCreate={async()=>{}}/>;
case 'spell-picker':return <SpellPicker isOpen onClose={()=>{}} onSave={()=>{}} title="Manage spells" tier={1} classUuid="Compendium.shadowdark.classes.Item.wizard" knownSpells={[]}/>;
case 'languages':return <LanguagePicker isOpen onClose={()=>{}} onSelect={()=>{}} currentLanguages={[]} maxCommon={1} maxRare={1}/>;
case 'mastery':return <><WeaponSelectionSection required={1} selected={[]} onSelectionChange={()=>{}}/><ArmorSelectionSection required={1} selected={[]} onSelectionChange={()=>{}}/></>;
case 'details':return <Details/>;
default:return <Spells/>;}}
function Delayed(){const [ready,setReady]=React.useState(!window.initial.delay);React.useEffect(()=>{const timer=setTimeout(()=>setReady(true),window.initial.delay||0);return ()=>clearTimeout(timer)},[]);return ready&&show?<Consumer/>:null;}
window.render=()=>root.render(mounted?(window.initial.which==='generator'?<Generator/>:<ShadowdarkUIProvider><Delayed key={show?'open':'closed'}/></ShadowdarkUIProvider>):null);
window.retire=()=>listeners.forEach(fn=>fn({keys:[],identity:{worldId:'w',contextRevision:2}})); window.consumerUnmount=()=>{show=false;window.render()};window.unmount=()=>{mounted=false;window.render()};
window.change=values=>{window.sdk={...window.sdk,...values};window.render()};
window.answer=(index,body,status=200)=>window.pending[index].resolve(Response.json(body,{status}));
window.render();
`, resolveDir: moduleRoot, loader: 'tsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', plugins: [{ name: 'sdk-test-boundary', setup(b) {
    b.onResolve({ filter: /^@sheet-delver\/sdk(?:\/react)?$/ }, a => ({ path: a.path, namespace: 'stub' }));
    b.onResolve({ filter: /ShadowdarkActorContext$/ }, () => ({ path: 'actor', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ loader: 'tsx', resolveDir: moduleRoot, contents: a.path === 'actor' ? 'export const useShadowdarkActor=()=>window.actorContext;' : a.path.endsWith('/react') ? `import React from 'react';export const useSDK=()=>window.sdk;export const useSDKComponents=()=>({ConfirmationModal:()=>null,LoadingModal:({message})=><div role="status">{message}</div>});` : `export const logger={info(){},warn(){},error(){},debug(){}};export const processHtmlContent=x=>x;export const getErrorMessage=e=>String(e);` }));
} }] });
const browser = await chromium.launch({ ...(process.env.SHADOWDARK_CHROME ? { executablePath: process.env.SHADOWDARK_CHROME } : {}), headless: true, args: ['--no-sandbox', '--disable-background-networking'] });
const results = [];
async function test(name, initial, run) {
    const page = await browser.newPage(); const errors = []; page.setDefaultTimeout(3000);
    page.on('pageerror', e => errors.push(e.message)); await page.route('**/*', r => r.abort());
    try {
        await page.setContent('<div id="root"></div>'); await page.evaluate(x => window.initial = x, initial);
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
        await test(`RV-11: Spells classes failure ${JSON.stringify(policy)} is explicit and recovers to valid empty`, { which: 'spells', delay: 50, policy: { classes: policy } }, async p => {
            await p.getByRole('alert').waitFor(); assert.match(await p.getByRole('alert').innerText(), /classes/i);
            assert.equal(await p.getByText('Loading classes…', { exact: true }).count(), 0);
            await p.evaluate(() => window.policy = {}); await p.getByRole('button', { name: 'Retry', exact: true }).click();
            await p.getByText(/No spellcasting class/).waitFor(); assert.equal(await p.getByRole('alert').count(), 0); assert.equal(await count(p, 'classes'), 2);
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
    await test('RV-11: language picker denial and recovery keep save gated', { which: 'languages', policy: { languages: { status: 403 } } }, async p => {
        await p.getByRole('alert').waitFor(); assert.equal(await p.getByRole('button', { name: 'Save Languages' }).isDisabled(), true);
        await p.evaluate(() => window.policy = {}); await p.getByRole('button', { name: 'Retry', exact: true }).click();
        await text(p, 'No languages matched.'); assert.equal(await p.getByRole('button', { name: 'Save Languages' }).isDisabled(), false);
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
} finally { await browser.close(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2)); }
console.log(`${results.filter(r => r.ok).length}/${results.length} passed`);
if (results.some(r => !r.ok)) process.exitCode = 1;
