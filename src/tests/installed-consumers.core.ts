/**
 * ADR-0001 real-host presentation review against released Core 0.19.2 (isolated).
 *
 * Real manager/Core/Next (copied released workspace, isolated data) with this
 * branch's packaged v2 module installed, a controlled Foundry upstream serving
 * native 4.0.6 compendium data and native quickstart pregens owned by the
 * Player. Headless Chrome (an isolated development tool) logs in through Core's
 * real login view and reviews the module inside Core's real chrome: paper and
 * tabbed sheets, every tab, resource cards, Core roll dialogs, luck, the
 * bestiary tool and Core's HUD, at 320/390/820/1440 widths in both player
 * appearances, with keyboard checks. Live setting changes are pushed from the
 * upstream while a sheet is open. Not native Foundry evidence.
 *
 * Run from the Core root:
 *   npx tsx <module>/src/tests/installed-consumers.core.ts --run-isolated
 *     --out=<new-dir> --archive=<tgz> [--generation=13|14] [--production]
 *     [--focus-only] (omits the width/theme matrix; recorded separately)
 *     [--presentation-only] (runs the full surface matrix without behavioral follow-ups)
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CORE, Http, Manager, prepareWorkspace, unusedPort, until, isolatedEnv } from './core0191/core';
import { ControlledUpstream, type WorldState } from './core0191/upstream';
import { parityFixtures, proveParityContracts } from './parity-installed';
import { nativePacks, type Doc } from './core0191/world';

const args = new Map(process.argv.slice(2).map(arg => { const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=') || 'true']; }));
if (!args.has('run-isolated') || !args.has('archive') || !args.has('out')) throw new Error('Explicit --run-isolated, --archive and --out required');
const out = path.resolve(args.get('out')!);
const archive = path.resolve(args.get('archive')!);
const generation = Number(args.get('generation') ?? 14) as 13 | 14;
const PASSWORD = 'isolated-acceptance-password';
const PLAYWRIGHT = process.env.SHADOWDARK_PLAYWRIGHT_MODULE || 'playwright';
const mod = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const production = args.has('production');
const core = { version: JSON.parse(fs.readFileSync(path.join(CORE, 'package.json'), 'utf8')).version, commit: spawnSync('git', ['-C',CORE,'rev-parse','HEAD'], {encoding:'utf8'}).stdout.trim() };
assert.ok(['0.19.2','0.19.3','0.19.5','0.19.6','0.19.8'].includes(core.version));
if (!core.commit && fs.existsSync(path.join(CORE,'.source-provenance.json'))) core.commit = JSON.parse(fs.readFileSync(path.join(CORE,'.source-provenance.json'),'utf8')).commit;
fs.mkdirSync(path.join(out, 'shots'), { recursive: true });
const evidence: Record<string, any> = { native: false, generation, core, mode: production ? 'production' : 'development', archive: { file: archive, sha256: createHash('sha256').update(fs.readFileSync(archive)).digest('hex') }, checks: [], cases: [], pageErrors: [], consoleErrors: [] };
const pass = (label: string) => { evidence.checks.push(label); console.log(`  ✓ ${label}`); };

const nativeIds = JSON.parse(fs.readFileSync(path.join(mod, 'info.json'), 'utf8')).compendiumPacks.packs.map((row: Doc) => row.id);
const packs = nativePacks(process.env.SHADOWDARK_NATIVE_REFERENCE || path.join(CORE, 'temp/shadowdark'), [...nativeIds, 'shadowdark.quickstart-pregens']);
const pregens = packs['shadowdark.quickstart-pregens'];
delete packs['shadowdark.quickstart-pregens'];
const WIZARD = pregens.find(row => row.name === 'Zaldini the Red')!;
const FIGHTER = pregens.find(row => row.name === 'Jorbin Ironhelm')!;
for (const actor of [WIZARD, FIGHTER]) actor.ownership = { default: 0, player: 3 };
const monster = structuredClone(packs['shadowdark.monsters'].find(row => row.name === 'Centipede, Giant')!);
monster._id = 'worldCentipede';
const metadata = nativeIds.map((id: string) => ({ id, name: id.split('.')[1], label: id.split('.')[1], packageType: 'system', packageName: 'shadowdark',
    type: id === 'shadowdark.monsters' ? 'Actor' : id === 'shadowdark.rollable-tables' ? 'RollTable' : 'Item', locked: true, ownership: { PLAYER: 'OBSERVER', ASSISTANT: 'OWNER' } }));
const state: WorldState = {
    game: { world: { id: 'w1', title: 'Shadowdark presentation world' }, system: { id: 'shadowdark', version: '4.0.6' },
        release: { generation, build: generation === 13 ? '351' : '367' }, userId: 'service' },
    users: [{ _id: 'service', name: 'service', role: 4 }, { _id: 'player', name: 'Player', role: 1, character: WIZARD._id }],
    actors: [...pregens, monster], items: [], scenes: [],
    settings: [{ _id: 'setCompendium', key: 'core.compendiumConfiguration', value: '{}' }, { _id: 'setPulp', key: 'shadowdark.usePulpMode', value: 'false' },
        { _id: 'setAmmo', key: 'shadowdark.autoConsumeAmmunition', value: 'true' }],
    chat: [], packs, packMetadata: metadata,
};
const parity = parityFixtures(packs, WIZARD); state.actors.push(parity.actor); state.items.push(parity.worldClass, parity.spell);
const catalogWorldSpell = { ...structuredClone(WIZARD.items.find((item:Doc)=>item.type==='Spell' && item.system?.tier===1)), _id:'sd02CatalogWorldSpell', name:'SD02 catalog spell', ownership:{default:0,player:2} }; state.items.push(catalogWorldSpell);
const upstream = new ControlledUpstream(state);
const root = path.join(out, 'run'); fs.rmSync(root, { recursive: true, force: true }); fs.mkdirSync(root, { recursive: true });
const workspace = prepareWorkspace(root, production);
const data = path.join(root, 'data');
fs.mkdirSync(path.join(data, 'config'), { recursive: true }); fs.mkdirSync(path.join(data, 'cache/core'), { recursive: true });
// The configured state an operator's completed world setup leaves (SetupManager cache).
fs.writeFileSync(path.join(data, 'cache/core/worlds.json'), JSON.stringify({ currentWorldId: 'w1', worlds: { w1: { worldId: 'w1', worldTitle: state.game.world.title,
    worldDescription: null, systemId: 'shadowdark', systemVersion: '4.0.6', backgroundUrl: null, lastUpdated: new Date().toISOString(),
    users: state.users.map(({ _id, name, role }) => ({ _id, name, role })) } } }));

async function main() {
    const startedAt = Date.now();
    await upstream.listen();
    const appPort = await unusedPort(); const apiPort = await unusedPort();
    fs.writeFileSync(path.join(data, 'config/settings.yaml'), JSON.stringify({ app: { host: '127.0.0.1', protocol: 'http', port: appPort, 'api-port': apiPort },
        foundry: { host: '127.0.0.1', protocol: 'http', port: upstream.port, username: 'service' }, debug: { level: 3 }, security: { admin: { 'allowed-networks': ['127.0.0.0/8'] } } }));
    if (args.has('focus-only')) evidence.skipped = ['width/theme matrix (--focus-only)'];
    const bootstrap = spawnSync(process.execPath, ['--import','tsx','src/scripts/tools/admin/create-bootstrap.ts','--data-dir',data], {cwd:workspace,env:isolatedEnv(data),encoding:'utf8'});
    assert.equal(bootstrap.status,0,bootstrap.stderr);
    const bootstrapToken=bootstrap.stdout.match(/[A-Za-z0-9_-]{43}/)?.[0]; assert.ok(bootstrapToken);
    if (production) {
        const log = fs.openSync(path.join(root, 'build.log'), 'w');
        const build = spawnSync(process.execPath, ['--import','tsx','src/scripts/start-server.ts','build',`--data-dir=${data}`], {cwd: workspace, env: {...isolatedEnv(data), NODE_ENV:'production'}, stdio:['ignore',log,log]});
        fs.closeSync(log); assert.equal(build.status, 0, `production build: ${root}/build.log`);
    }
    let manager = new Manager(workspace, data, path.join(root, 'manager.log'), production ? 'start' : 'dev');
    const origin = `http://127.0.0.1:${appPort}`; const api = `http://127.0.0.1:${apiPort}`;
    const admin = new Http(api, origin);
    const { chromium } = await import(PLAYWRIGHT);
    const browser = await chromium.launch({ ...(process.env.SHADOWDARK_CHROME ? {executablePath: process.env.SHADOWDARK_CHROME} : {}), headless: true, args: ['--no-sandbox', '--disable-background-networking'] });
    try {
        await until('Core admin ready', async () => (await admin.request('/admin/auth/status')).ok || false, manager);
        assert.equal((await admin.request('/admin/auth/setup',{bootstrapToken,password:PASSWORD})).status,200);
        await admin.adminLogin(PASSWORD);
        await until('full-GM service connected',async()=>(await(await admin.request('/api/status')).json()).connected===true||false,manager);
        const upload = async (operation: string, query: Record<string,string> = {}) => {
            const response = await fetch(`${api}/admin/manager/shadowdark/archive/${operation}?${new URLSearchParams({approveTrustOverride:'true',...query})}`,{
                method:'POST',headers:{Origin:origin,Cookie:admin.cookie,'X-Admin-Csrf-Token':admin.csrf,'Content-Type':'application/gzip'},body:fs.readFileSync(archive)});
            const body = await response.json(); evidence[operation] = {status:response.status,body};
            return {response,body};
        };
        const preview = await upload('dry-run/install');
        fs.writeFileSync(path.join(root,'archive-preview.json'),JSON.stringify(preview.body,null,2));
        assert.equal(preview.response.status,200,JSON.stringify(preview.body));
        assert.equal(preview.body.wouldProceed,true,JSON.stringify(preview.body));
        assert.equal(typeof preview.body.migration.id,'string','public migration preview identity');
        assert.equal((await admin.request('/admin/module-maintenance/enter',{planId:preview.body.migration.id})).status,202);
        const review = await until('authoritative archive review',async()=>{
            const body=await(await admin.request('/admin/module-maintenance')).json();
            return body.mode?.stage==='review'?body:false;
        },manager);
        assert.deepEqual(review.preview.plan.blockers,[]);
        assert.equal(review.preview.plan.operations.length,0,'native current sources need no repairs');
        assert.equal(upstream.writes.length,0,'archive inspection/entry never writes sources');
        assert.equal((await admin.request('/admin/module-maintenance/approve',{planId:review.preview.id,backupAcknowledged:true})).status,202);
        evidence.installation = 'public HTTP archive preview + maintenance enter/review/approve; explicit isolated trust override';
        await until('serving with the candidate module', async () => (await (await admin.request('/api/status')).json()).initialized === true || false, manager, 600_000);
        pass(`candidate v2 module serves a native-pregen world on real Core ${core.version} (bootstrap migration check is a no-op)`);

        // Real login through Core's login view.
        const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const login = await loginContext.newPage();
        await login.goto(origin, { timeout: 300_000 });
        await login.getByLabel('Player', { exact: true }).selectOption('Player', { timeout: 300_000 });
        await login.getByRole('button', { name: 'Login', exact: true }).click();
        await login.waitForFunction(() => !document.querySelector('select'), null, { timeout: 120_000 });
        const storage = await loginContext.storageState();
        await loginContext.close();
        pass('player logged in through Core\'s real login view');

        if (args.has('contracts-only')) {
            evidence.skipped = ['width/theme and legacy UI matrix (--contracts-only)'];
            const context = await browser.newContext({storageState:storage});
            await proveParityContracts({context,api,origin,state,upstream,pass,
                wait:(label,operation)=>until(label,operation,manager,120000), restart:async()=>{
                    await manager.stop(); manager=new Manager(workspace,data,path.join(root,'manager-restarted.log'),production?'start':'dev');
                    await until('restarted public runtime ready',async()=>(await(await admin.request('/api/status')).json()).initialized===true||false,manager,300000);
                }});
            await context.close(); return;
        }
        if (args.has('probe-reconnect-write')) {
            // Minimal public-contract reproduction, independent of sheet/card
            // UI or ownership edits. A failed post is attempted exactly once.
            const context = await browser.newContext({storageState:storage});
            const item = FIGHTER.items.find((row:Doc)=>row.effects?.length)!;
            const effect = item.effects[0], initiallyDisabled = effect.disabled === true;
            const send = async (enabled: boolean) => {
                const status=await(await context.request.get(`${api}/api/status`)).json();
                const response=await context.request.post(`${api}/api/modules/shadowdark/actors/${FIGHTER._id}/effects/toggle`,{
                    headers:{Origin:origin,...(typeof status.runtimeToken==='string'?{'X-SheetDelver-Runtime':status.runtimeToken}:{})},
                    data:{ref:`Item.${item._id}.ActiveEffect.${effect._id}`,enabled}});
                return {status:response.status(),body:await response.json()};
            };
            const initial=await send(initiallyDisabled); assert.equal(initial.status,200,JSON.stringify(initial));
            assert.equal((await send(!initiallyDisabled)).status,200);
            const before=structuredClone(FIGHTER), writes=upstream.writes.length;
            upstream.unavailable=true;
            if (args.has('server-disconnect')) upstream.disconnectAll(); else upstream.interruptTransport();
            await until('public status offline',async()=>(await(await admin.request('/api/status')).json()).connected===false||false,manager);
            upstream.unavailable=false;
            await until('public status ready after recovery',async()=>(await(await admin.request('/api/status')).json()).initialized===true||false,manager);
            const recovered=await send(initiallyDisabled);
            evidence.reconnectWrite={initial,recovered,writesBefore:writes,writesAfter:upstream.writes.length,sourceUnchanged:JSON.stringify(FIGHTER)===JSON.stringify(before)};
            assert.equal(recovered.status,200,JSON.stringify(evidence.reconnectWrite));
            assert.equal((await send(!initiallyDisabled)).status,200);
            assert.deepEqual(FIGHTER,before);
            evidence.reconnectWrite.sourceRestored=true;
            await context.close();
            pass('same-session OWNER mutation recovers after service reconnect');
            return;
        }

        const watch = (page: any, label: string) => {
            page.on('pageerror', (error: Error) => evidence.pageErrors.push(`${label}: ${error.message}`));
            page.on('console', (message: any) => { if (message.type() === 'error') evidence.consoleErrors.push(`${label}: ${message.text().slice(0, 300)}`); });
        };
        const noOverflow = async (page: any, label: string) => {
            const metrics = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
            assert.ok(metrics.scroll <= metrics.inner + 1, `${label}: horizontal overflow ${metrics.scroll} > ${metrics.inner}`);
        };
        const shot = async (page: any, name: string) => page.screenshot({ path: path.join(out, 'shots', `${name}.png`), fullPage: false });
        /**
         * Open a dialog from `trigger` with the keyboard and measure focus entry,
         * Tab containment, Escape and focus return. `strict` asserts them (module
         * dialogs); otherwise the measurement is recorded (Core-owned dialogs).
         */
        const dialogKeyboard = async (page: any, trigger: any, label: string, strict = true) => {
            await trigger.focus();
            const triggerHandle = await trigger.elementHandle();
            await page.keyboard.press('Enter');
            const dialog = page.getByRole('dialog').last();
            await dialog.waitFor({ timeout: 30_000 });
            await page.waitForTimeout(100);
            if (label.endsWith('effect editor')) {
                await dialog.getByRole('combobox', {name:/^template$/i}).selectOption('custom');
                await dialog.getByRole('textbox', {name:/^name$/i}).fill('Custom effect');
            }
            if (label.endsWith('boon editor')) {
                await dialog.getByRole('textbox', {name:/^name$/i}).fill('Custom boon');
                await dialog.locator('fieldset select').selectOption('custom');
            }
            if (label.endsWith('language editor')) await dialog.getByRole('heading', {name:/^Common \(/i}).waitFor();
            if (label.endsWith('spell card')) {
                const title = await dialog.locator('h2').innerText();
                const spell = WIZARD.items.find((item:Doc) => item.name.toUpperCase() === title.toUpperCase());
                assert.ok(spell, 'card title resolves to exact fixture Item');
                assert.equal(await dialog.getByRole('checkbox', { name: /Focus check/ }).count(), spell.system?.duration?.type === 'focus' ? 1 : 0);
            }
            if (await dialog.locator('.sd-resource-card').count() || await dialog.evaluate((el:Element)=>el.classList.contains('sd-resource-card'))) {
                assert.equal(await dialog.locator('.sd-dialog-body .sd-card-notes').count(), 0, 'data notes belong below the body divider');
            }
            if (label.endsWith('effect editor') || label.endsWith('boon editor')) {
                const styles = await dialog.locator('.sd-editor-form select').evaluateAll((selects: Element[]) => selects.map(select => {
                    const style=getComputedStyle(select), rect=select.getBoundingClientRect();
                    return {size:style.fontSize,weight:Number(style.fontWeight),transform:style.textTransform,shadow:style.boxShadow,inside:rect.left>=0&&rect.right<=innerWidth+1};
                }));
                assert.ok(styles.length>0 && styles.every((style:any)=>style.size==='12px'&&style.weight>=800&&style.transform==='uppercase'&&style.shadow!=='none'&&style.inside),`${label}: restored select typography and control bounds`);
            }
            const inside = () => page.evaluate(() => !!document.activeElement?.closest('dialog,[role="dialog"]'));
            const result: Record<string, unknown> = { focusEntered: await inside() };
            await shot(page,`${label.replace(/[^a-z0-9-]/gi,'-')}-dialog`);
            let contained = 0;
            for (let i = 0; i < 20; i++) { await page.keyboard.press('Tab'); if (await inside()) contained++; }
            result.tabContained = `${contained}/20`;
            let reverse = 0; for (let i = 0; i < 20; i++) { await page.keyboard.press('Shift+Tab'); if (await inside()) reverse++; }
            result.reverseTabContained = `${reverse}/20`;
            result.controlsUnclipped = await dialog.locator('button').evaluateAll((buttons: Element[]) => buttons.filter(b => (b as HTMLElement).offsetParent !== null).every(b => { const r=b.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth+1; }));
            await page.keyboard.press('Escape');
            result.escapeCloses = await page.waitForFunction(() => !document.querySelector('dialog[open],[role="dialog"]'), null, { timeout: 3_000 }).then(() => true, () => false);
            if (!result.escapeCloses) {
                const close = dialog.getByRole('button', { name: /close|cancel|✕/i }).first();
                if (await close.count()) await close.click(); else await page.mouse.click(5, 5);
                await page.waitForFunction(() => !document.querySelector('dialog[open],[role="dialog"]'), null, { timeout: 10_000 });
            }
            result.focusReturned = await page.evaluate((element: Element) => document.activeElement === element, triggerHandle);
            if (strict) {
                assert.equal(result.focusEntered, true, `${label}: focus enters the dialog`);
                assert.equal(contained, 20, `${label}: Tab stays in the dialog`);
                assert.equal(reverse, 20, `${label}: reverse Tab stays in the dialog`);
                assert.equal(result.controlsUnclipped, true, `${label}: dialog buttons are within viewport`);
                assert.equal(result.escapeCloses, true, `${label}: Escape closes`);
                assert.equal(result.focusReturned, true, `${label}: focus returns to the trigger`);
            }
            return result;
        };
        const widths = args.has('focus-only') ? [] : (args.get('widths') ?? '360,768,1024,1440').split(',').map(Number);
        for (const width of widths) for (const theme of ['dark', 'light'] as const) {
            const label = `${width}-${theme}`;
            const context = await browser.newContext({ viewport: { width, height: 900 }, storageState: storage });
            try {
            // Static native artwork is served only in this isolated test. Never
            // contact an operator Foundry instance or ship these assets in the module.
            const nativeAssets = path.resolve(process.env.SHADOWDARK_NATIVE_REFERENCE || path.join(CORE, 'temp/shadowdark'), 'system');
            await context.route('**/systems/shadowdark/**', async (route: any) => {
                const relative = decodeURIComponent(new URL(route.request().url()).pathname.split('/systems/shadowdark/')[1] || '');
                const file = path.resolve(nativeAssets, relative);
                if (file.startsWith(nativeAssets + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) await route.fulfill({ path: file });
                else await route.abort();
            });
            await context.addInitScript(([appearance]: string[]) => { localStorage.setItem('sheetdelver-player-appearance', appearance); localStorage.setItem('shadowdark_view_mode', 'simple'); }, [theme]);
            const page = await context.newPage();
            watch(page, label);
            const record: Record<string, unknown> = { width, theme };
            await page.goto(`${origin}/actors/${WIZARD._id}`, { timeout: 300_000 });
            await page.getByRole('button', { name: /Intelligence check|INT check/i }).first().waitFor({ timeout: 300_000 });
            await page.waitForFunction(() => !document.body.innerText.includes('Loading System Data'), null, { timeout: 60_000 });
            assert.equal(await page.locator('body').getAttribute('data-sd-appearance'), theme);
            record.background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
            await noOverflow(page, `${label} paper`);
            assert.equal(await page.locator('input[type="checkbox"][aria-label="Luck token"]').count(), 1, `${label}: standard luck tick box`);
            await shot(page, `paper-${label}`);

            // Core roll dialog from the paper sheet, keyboard only.
            record.coreRollDialog = await dialogKeyboard(page, page.getByRole('button', { name: /Intelligence check|INT check/i }).first(), `${label} paper roll`, true);
            // Resource card (spell) and keyboard dismissal.
            const spell = page.locator('section[aria-label="Spells"] button').first();
            if (await spell.count()) record.spellCard = await dialogKeyboard(page, spell, `${label} spell card`);
            record.attackCard = await dialogKeyboard(page, page.getByRole('button', { name: 'Dagger details' }).first(), `${label} attack card`);
            if (width === 360 || width === 1440) {
                const opener=page.getByRole('button',{name:'Dagger details'}).first(); await opener.focus(); await page.keyboard.press('Enter');
                const card=page.getByRole('dialog').last(); const attack=card.getByRole('button',{name:/^Melee attack$/i});
                await attack.focus(); await page.keyboard.press('Enter');
                const shared=page.getByRole('dialog').last(); await shared.waitFor();
                assert.equal(await shared.getByRole('button',{name:/^Roll normal$/i}).count(),1);
                await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Escape');
                await card.getByRole('button',{name:/^Melee attack$/i}).waitFor();
                assert.equal(await attack.evaluate((element:Element)=>document.activeElement===element),true,'shared roller returns focus to resource action');
                await page.keyboard.press('Escape');
                assert.equal(await opener.evaluate((element:Element)=>document.activeElement===element),true,'resource card returns focus after nested cancellation');
                record.nestedCardRoll=true;
            }
            await noOverflow(page, `${label} paper after dialogs`);

            // Tabbed sheet and every tab.
            await page.getByRole('button', { name: 'Manage Character Sheet' }).click();
            await page.getByRole('button', { name: 'Open dice tray' }).waitFor({ timeout: 60_000 });
            const tabs: string[] = [];
            for (const tab of ['Abilities', 'Details', 'Inventory', 'Spells', 'Talents', 'Effects', 'Notes']) {
                const visible = page.getByRole('button', { name: tab, exact: true });
                if (await visible.count()) await visible.first().click();
                else {
                    const more = page.getByRole('button', { name: 'More sections' });
                    if (!(await more.count())) continue;
                    await more.click();
                    const entry = page.getByRole('button', { name: tab, exact: true });
                    if (!(await entry.count())) { await page.keyboard.press('Escape'); continue; }
                    await entry.last().click();
                }
                await page.waitForTimeout(150);
                await noOverflow(page, `${label} tab ${tab}`);
                await shot(page, `tab-${tab}-${label}`);
                tabs.push(tab);
            }
            record.tabs = tabs;
            assert.ok(tabs.length >= 6, `${label}: tabs reviewed ${tabs.join(',')}`);
            // Presentation review extends to the editors, not just the tab
            // containers and resource card. Open/close only; no fixture writes.
            const selectTab = async (name: string) => {
                const direct = page.getByRole('button', { name, exact: true }).first();
                if (await direct.isVisible().catch(() => false)) await direct.click();
                else {
                    await page.getByRole('button', { name: 'More sections' }).click();
                    await page.getByRole('button', { name, exact: true }).last().click();
                }
            };
            await selectTab('Effects');
            record.effectEditor = await dialogKeyboard(page, page.getByRole('button', { name: 'Add Effect', exact: true }), `${label} effect editor`);
            await selectTab('Details');
            record.boonEditor = await dialogKeyboard(page, page.getByTitle('Add Boon', { exact: true }), `${label} boon editor`);
            record.languageEditor = await dialogKeyboard(page, page.getByRole('button', { name: 'Edit Languages', exact: true }), `${label} language editor`);
            await page.getByRole('button', { name: 'Edit Deity', exact: true }).click();
            const deityHeading = page.getByRole('heading', {name:'Select Deity',exact:true});
            await deityHeading.waitFor(); await noOverflow(page,`${label} deity picker`); await shot(page,`deity-picker-${label}`);
            await deityHeading.locator('..').getByRole('button').click();
            await page.getByRole('button',{name:'Spells',exact:true}).first().click().catch(async()=>{
                await page.getByRole('button',{name:'More sections'}).click(); await page.getByRole('button',{name:'Spells',exact:true}).last().click(); });
            record.spellPicker = await dialogKeyboard(page,page.getByRole('button',{name:/TIER 1/}).first(),`${label} spell picker`);
            // Inventory card from the tabbed sheet.
            await page.getByRole('button', { name: 'Inventory', exact: true }).first().click().catch(async () => {
                await page.getByRole('button', { name: 'More sections' }).click(); await page.getByRole('button', { name: 'Inventory', exact: true }).last().click(); });
            await page.locator('button[aria-expanded="false"]', { hasText: 'Torch' }).first().click();
            record.inventoryCard = await dialogKeyboard(page, page.getByRole('button', { name: 'Open details' }).first(), `${label} inventory card`);
            record.gearPicker = await dialogKeyboard(page,page.getByRole('button',{name:'Add gear',exact:true}),`${label} gear picker`);
            await page.getByRole('button',{name:'Gem Bag',exact:true}).click();
            const gemHeading=page.getByRole('heading',{name:'Gem Bag',exact:true});
            await gemHeading.waitFor(); await noOverflow(page,`${label} gem bag`); await shot(page,`gem-bag-${label}`);
            await page.getByRole('button',{name:'Add New Gem',exact:true}).click();
            await noOverflow(page,`${label} gem form`);await shot(page,`gem-form-${label}`);
            await gemHeading.locator('..').getByRole('button').click();
            // Core HUD: dice tray and chat over the module sheet.
            await page.getByRole('button', { name: 'Open dice tray' }).first().click();
            await page.waitForTimeout(300);
            await noOverflow(page, `${label} dice tray`);
            if (width === 390 || width === 1440) await shot(page, `dice-tray-${label}`);
            await page.keyboard.press('Escape');
            // Core's floating HUD: expand it, open game chat over the sheet, collapse again.
            const closeTray = page.getByRole('button', { name: /close dice tray|close/i }).first();
            if (await page.getByText('Dice Tray', { exact: false }).count() && await closeTray.count()) await closeTray.click().catch(() => undefined);
            const tools = page.getByRole('button', { name: /^(Open tools|Back to tools)$/ });
            if (await tools.count()) await tools.first().click();
            const chat = page.getByRole('button', { name: /^Game Chat/ });
            await chat.first().waitFor({ timeout: 10_000 });
            await chat.first().click();
            await page.waitForTimeout(300);
            await noOverflow(page, `${label} chat`);
            if (width === 390 || width === 1440) await shot(page, `chat-${label}`);
            await page.keyboard.press('Escape');
            record.chat = true;

            // Bestiary tool.
            await page.goto(`${origin}/tools/shadowdark/bestiary`, { timeout: 300_000 });
            await page.getByText('Centipede, Giant').first().waitFor({ timeout: 300_000 });
            await noOverflow(page, `${label} bestiary`);
            await shot(page, `bestiary-${label}`);
            const monsterButton = page.getByRole('button', { name: /Centipede, Giant/ }).first();
            if (await monsterButton.count()) record.monsterCard = await dialogKeyboard(page, monsterButton, `${label} monster card`);
            await page.goto(`${origin}/tools/shadowdark/importer`,{timeout:300000});
            await page.getByLabel('Paste Character JSON').waitFor({timeout:60000});
            await noOverflow(page,`${label} importer`);await shot(page,`importer-${label}`);
            await page.goto(`${origin}/tools/shadowdark/generator`,{timeout:300000});
            await page.getByRole('button',{name:'Create Character',exact:true}).waitFor({timeout:60000});
            const statRows = await page.locator('[data-stat]').evaluateAll((rows: Element[]) => rows.map(row => {
                const cells=[...row.children].map(child=>child.getBoundingClientRect());
                return {stat:row.getAttribute('data-stat'), separated:cells[0].right<=cells[1].left,inside:cells[1].right<=row.getBoundingClientRect().right+1};
            }));
            assert.equal(statRows.length,6);
            assert.ok(statRows.every((row:any)=>row.separated&&row.inside),`${label} generator stats: ${JSON.stringify(statRows)}`);
            await noOverflow(page,`${label} generator`);await shot(page,`generator-${label}`);
            evidence.cases.push(record);
            pass(`${label}: paper + ${tabs.length} tabs, Core roll dialog, cards, HUD, bestiary; no overflow; dialogs keep and return focus`);
            } catch (error) {
                const page = context.pages().at(-1);
                if (page) {
                    await page.screenshot({ path: path.join(out, 'shots', `failure-${label}.png`) }).catch(() => undefined);
                    fs.writeFileSync(path.join(out, `failure-${label}.txt`), `${page.url()}\n${await page.evaluate(() => document.body.innerText).catch(() => '')}`);
                }
                throw error;
            } finally { await context.close(); }
        }
        if(args.has('presentation-only')){
            assert.deepEqual(evidence.pageErrors, [], 'no page errors');
            evidence.skipped=['behavioral follow-ups (--presentation-only); retained separate full run'];
            pass('complete presentation matrix without uncaught page errors');
            return;
        }

        // Live world-setting change reaches open sheets, both layouts.
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: storage });
        await context.addInitScript(() => localStorage.setItem('shadowdark_view_mode', 'simple'));
        const page = await context.newPage();
        watch(page, 'live');
        await page.goto(`${origin}/actors/${WIZARD._id}`);
        await page.locator('input[type="checkbox"][aria-label="Luck token"]').waitFor({ timeout: 300_000 });
        const requests: string[] = [];
        page.on('request', (request: any) => { if (request.url().includes('/api/modules/shadowdark/index')) requests.push(request.url()); });
        // Sample Core's world-work gate overlay while the context refresh runs.
        await page.evaluate(() => { const w = window as any; w.__gate = { samples: 0, visible: 0 };
            w.__gateTimer = setInterval(() => { w.__gate.samples++; if (document.body.innerText.includes('Reconnecting to world')) w.__gate.visible++; }, 25); });
        upstream.setSetting('shadowdark.usePulpMode', true);
        await page.locator('input[type="number"][aria-label="Luck tokens"]').waitFor({ timeout: 60_000 });
        await page.waitForFunction(() => !document.body.innerText.includes('Reconnecting to world'), null, { timeout: 60_000 });
        const gate = await page.evaluate(() => { const w = window as any; clearInterval(w.__gateTimer); return w.__gate; });
        await page.waitForFunction(() => !document.body.innerText.includes('Loading System Data'), null, { timeout: 60_000 });
        await shot(page, 'live-pulp-paper');
        await page.getByRole('button', { name: 'Manage Character Sheet' }).click();
        const abilities = page.getByRole('button', { name: 'Abilities', exact: true });
        if (await abilities.count()) await abilities.first().click();
        await page.locator('input[type="number"][aria-label="Luck tokens"]').waitFor({ timeout: 30_000 });
        upstream.setSetting('shadowdark.usePulpMode', false);
        await page.locator('input[type="checkbox"][aria-label="Luck token"]').waitFor({ timeout: 60_000 });
        assert.ok(requests.length >= 1, 'context change refetched the caller index');
        evidence.liveSetting = { indexRefetches: requests.length, coreGateOverlayApproxMs: gate.visible * 25, gateSamples: gate.samples };
        // Focused corrections inside the installed module and real SDK/events.
        const shards: string[] = [];
        page.on('request', (request: any) => { if (request.url().includes('/fetch-pack/')) shards.push(request.url().split('/').at(-1)!); });
        await page.getByRole('button', { name: 'Inventory', exact: true }).first().click();
        await page.getByRole('button', { name: 'Add gear', exact: true }).click();
        const gear = page.getByRole('dialog', { name: 'Gear Selection' });
        const rope = gear.getByText(/Rope/).first();
        await rope.waitFor({ timeout: 60000 });
        await gear.getByPlaceholder('Search gear...').fill('Rope');
        const before = shards.length;
        upstream.setSetting('core.compendiumConfiguration', {'shadowdark.classes':{ownership:{}}});
        await until('all open gear collections reloaded', async () => ['gear','magic-items','properties'].every(id => shards.slice(before).includes(id)) || false, manager, 60000);
        await rope.waitFor({timeout:60000});
        assert.equal(await gear.getByPlaceholder('Search gear...').inputValue(), 'Rope');
        await shot(page,'rv10-loaded-gear-recovered');
        pass('RV-10 installed UI: open loaded gear refetches all collections on real context event; search preserved');
        await gear.getByRole('button',{name:'Close gear selection'}).click();
        upstream.setSetting('core.compendiumConfiguration', {});
        await page.waitForTimeout(1000);
        let holds = 0; const release: Array<()=>void> = [];
        await page.route('**/api/modules/shadowdark/fetch-pack/*', async (route:any) => {
            if (holds++ < 3) {
                const response = await route.fetch();
                const body = await response.body();
                await new Promise<void>(resolve=>release.push(resolve));
                await route.fulfill({response,body}).catch(()=>undefined);
            } else await route.continue().catch(()=>undefined);
        });
        await page.getByRole('button',{name:'Add gear',exact:true}).click();
        await until('three initial gear requests held', async()=>release.length===3||false,manager,60000);
        upstream.setSetting('core.compendiumConfiguration', {'shadowdark.gear':{ownership:{}}});
        await gear.getByRole('alert').filter({hasText:'gear:'}).waitFor({timeout:60000});
        release.forEach(fn=>fn());
        await page.unroute('**/api/modules/shadowdark/fetch-pack/*');
        await page.waitForTimeout(300);
        assert.equal(await rope.count(),0,'stale privileged success cannot replace current denial');
        upstream.setSetting('core.compendiumConfiguration', {});
        await rope.waitFor({timeout:60000});
        await shot(page,'rv10-pending-gear-recovered');
        pass('RV-10 installed UI: ownership-only change during initial requests rejects held privileged responses; same open picker recovers after override removal');
        await gear.getByRole('button',{name:'Close gear selection'}).click();
        upstream.setSetting('core.compendiumConfiguration', {'shadowdark.classes':{ownership:{}}});
        const caller = {get: async (url: string) => {const response = await context.request.get(`${api}${url}`, {headers:{Origin:origin}}); return {status:response.status()};}};
        await until('fresh classes reads denied', async () => (await caller.get('/api/modules/shadowdark/fetch-pack/classes')).status === 403 || false, manager, 60000);
        await page.getByRole('button',{name:'Spells',exact:true}).first().click();
        await page.getByText('Actor Class is unavailable. Resolve its exact reference; no Class was inferred.',{exact:true}).waitFor({timeout:60000});
        await shot(page,'sd02-exact-class-denied');
        upstream.setSetting('core.compendiumConfiguration', {});
        await page.getByRole('button',{name:/TIER 1/}).first().waitFor({timeout:60000});
        pass('SD02 installed caller Class denial is explicit and exact view recovers without unrelated Class collection loading');
        upstream.setSetting('core.compendiumConfiguration', {'shadowdark.classes':{ownership:{}}});
        const gapStart = {index:requests.length};
        await until('caller Class denied',async()=>(await caller.get('/api/modules/shadowdark/fetch-pack/classes')).status===403||false,manager,60000);
        await page.getByText('Actor Class is unavailable. Resolve its exact reference; no Class was inferred.',{exact:true}).waitFor({timeout:60000});
        assert.equal(await page.getByRole('button',{name:/TIER 1/}).count(),0);
        evidence.ownershipRefresh={indexRefetched:requests.length>gapStart.index,loadedClassesRetired:true};
        await page.goto(`${origin}/tools/shadowdark/generator`, {timeout:300000});
        await page.getByRole('alert').filter({hasText:'classes:'}).waitFor({timeout:60000});
        assert.equal(await page.getByRole('button',{name:'Create Character',exact:true}).count(),0);
        await shot(page,'rv11-generator-partial-failure');
        upstream.setSetting('core.compendiumConfiguration', {});
        await page.getByRole('button',{name:'Create Character',exact:true}).waitFor({timeout:60000});
        await shot(page,'rv11-generator-recovered');
        pass('RV-11 installed UI: generator partial success stays blocked on classes 403 and recovers after a real context change');

        await page.goto(`${origin}/actors/${WIZARD._id}`,{timeout:300000});
        await page.getByRole('button',{name:'Manage Character Sheet'}).click();
        await page.getByRole('button',{name:'Spells',exact:true}).first().click();
        await page.getByRole('button',{name:/TIER 1/}).first().click();
        const spellManager=page.getByRole('dialog',{name:/Manage Wizard Spells/});
        await spellManager.getByPlaceholder('Filter spells by name...').fill('SD02 catalog');
        const worldAddition=spellManager.getByRole('button',{name:'Add SD02 catalog spell',exact:true});await worldAddition.waitFor({timeout:60000});
        upstream.externalUpdate('Item',[{_id:catalogWorldSpell._id,ownership:{default:0,player:0}}]);
        await worldAddition.waitFor({state:'hidden',timeout:60000});
        assert.equal(await spellManager.getByPlaceholder('Filter spells by name...').inputValue(),'SD02 catalog');
        upstream.externalUpdate('Item',[{_id:catalogWorldSpell._id,ownership:{default:0,player:2}}]);
        await worldAddition.waitFor({timeout:60000});await spellManager.getByRole('button',{name:'CANCEL',exact:true}).click();
        pass('SD02 installed world Item permission events retire and restore the loaded spell catalog without losing search');
        await page.goto(`${origin}/tools/shadowdark/generator`,{timeout:300000});
        await page.getByRole('button',{name:'Create Character',exact:true}).waitFor({timeout:60000});

        // Exercise actual packaged managed-JS errors across the SDK loading
        // boundary. The native effect is copied intact from a pinned pregen.
        const effectItem = FIGHTER.items.find((item: Doc) => item.effects?.length);
        assert.ok(effectItem, 'native pregen provides an owned effect');
        const effect = effectItem.effects[0];
        const ref = `Item.${effectItem._id}.ActiveEffect.${effect._id}`;
        const post = async (url: string, body: unknown) => {
            const status = await (await context.request.get(`${api}/api/status`, {headers:{Origin:origin}})).json();
            return context.request.post(`${api}${url}`, {headers:{Origin:origin,...(typeof status.runtimeToken === 'string' ? {'X-SheetDelver-Runtime':status.runtimeToken} : {})},data:body});
        };
        const beforeActor = structuredClone(FIGHTER);
        const beforeWrites = upstream.writes.length;
        const owner = await post(`/api/modules/shadowdark/actors/${FIGHTER._id}/effects/toggle`,{ref,enabled:effect.disabled === true});
        evidence.owner = {status:owner.status(),body:await owner.json()};
        assert.equal(owner.status(),200,JSON.stringify(evidence.owner));
        const restore = await post(`/api/modules/shadowdark/actors/${FIGHTER._id}/effects/toggle`,{ref,enabled:beforeActor.items.find((i:Doc)=>i._id===effectItem._id).effects[0].disabled !== true});
        assert.equal(restore.status(),200,await restore.text());
        assert.deepEqual(FIGHTER,beforeActor);
        const afterOwnerWrites = upstream.writes.length;
        assert.equal(afterOwnerWrites,beforeWrites+2,'one OWNER write and one source restoration');
        for (const [ownership, expectedStatus] of [[2,403],[1,404]] as const) {
            upstream.externalUpdate('Actor',[{_id:FIGHTER._id,ownership:{default:0,player:ownership}}]);
            await until('caller actor ownership changed', async () => {
                const detail = await context.request.get(`${api}/api/modules/shadowdark/document/Actor.${FIGHTER._id}`,{headers:{Origin:origin}});
                return ownership === 1 ? detail.status() === 404 || false : detail.status() === 200 || false;
            },manager);
            const response = await post(`/api/modules/shadowdark/actors/${FIGHTER._id}/effects/toggle`,{ref,enabled:effect.disabled === true});
            assert.equal(response.status(),expectedStatus,await response.text());
            assert.deepEqual(FIGHTER.items,beforeActor.items); assert.equal(upstream.writes.length,afterOwnerWrites);
        }
        upstream.externalUpdate('Actor',[{_id:FIGHTER._id,ownership:beforeActor.ownership}]);
        assert.deepEqual(FIGHTER,beforeActor);
        pass('packaged managed-JS OBSERVER 403 and LIMITED concealment 404 preserve source; OWNER succeeds and source is restored');
        // Reconnect after an ownership-only change. This tests permissions, not
        // arbitrary disconnected pack-content freshness (the separate CG-4).
        upstream.unavailable = true; upstream.interruptTransport();
        await page.getByRole('button',{name:'Create Character',exact:true}).waitFor({state:'hidden',timeout:60000});
        upstream.setSetting('core.compendiumConfiguration', {'shadowdark.classes':{ownership:{}}});
        upstream.unavailable = false;
        await page.getByRole('alert').filter({hasText:'classes:'}).waitFor({timeout:120000});
        upstream.setSetting('core.compendiumConfiguration', {});
        await page.getByRole('button',{name:'Create Character',exact:true}).waitFor({timeout:60000});
        pass('ownership-only denial across disconnect retires loaded data; reconnect and override removal recover the mounted generator');

        await proveParityContracts({context,api,origin,state,upstream,pass,
            wait:(label,operation)=>until(label,operation,manager,120000), restart:async()=>{
                await manager.stop(); manager = new Manager(workspace,data,path.join(root,'manager-restarted.log'),production?'start':'dev');
                await until('restarted public runtime ready',async()=>(await(await admin.request('/api/status')).json()).initialized===true||false,manager,300000);
            }});
        await context.close();
        pass(`live Pulp Mode changes reach the open paper and tabbed sheets without reload; index refetched ${requests.length}x, no stuck loading`);
        assert.deepEqual(evidence.pageErrors, [], 'no page errors');
        pass('no uncaught page errors across all cases');
    } catch (error) {
        for (const context of browser.contexts()) for (const page of context.pages()) {
            await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
            fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText().catch(()=>''));
        }
        throw error;
    } finally {
        await browser.close();
        evidence.unknownUpstreamEvents = Object.fromEntries(upstream.unknownEvents);
        evidence.upstreamFailures = upstream.failures;
        evidence.upstreamWrites = upstream.writes;
        evidence.elapsedMs = Date.now() - startedAt;
        await manager.stop();
        await upstream.close();
        fs.writeFileSync(path.join(out, `ui-evidence-g${generation}.json`), JSON.stringify(evidence, null, 2));
    }
}

main().then(() => console.log(`PASS (${evidence.checks.length} checks). Evidence: ${out}`), async error => {
    await upstream.close();
    evidence.error = String(error);
    fs.writeFileSync(path.join(out, `ui-evidence-g${generation}.json`), JSON.stringify(evidence, null, 2));
    console.error(error); console.error(`Evidence: ${out}`); process.exitCode = 1;
});
