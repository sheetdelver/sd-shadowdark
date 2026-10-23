/** Archived ESM + CSS in the actual Core settings host and actual module actor page. No live services. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as tar from 'tar';

const core = path.resolve(process.env.SHADOWDARK_CORE || process.cwd());
const archive = process.argv.find(arg => arg.startsWith('--archive='))?.slice(10);
if (!archive) throw Error('Pass --archive=/absolute/path/to/shadowdark.tgz');
const output = await fs.mkdtemp('/tmp/shadowdark-settings-');
await tar.x({ file: path.resolve(archive), cwd: output });
const { settingsFixture, mountSettingsFixture } = await import(pathToFileURL(path.join(core, 'src/tests/acceptance/module-settings.browser.mjs')));
const { rewriteImportsForBrowser } = await import(pathToFileURL(path.join(core, 'src/server/routes/modules/rewriteModuleImports.ts')));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const info = JSON.parse(await fs.readFile(path.join(output, 'info.json'), 'utf8'));
const raw = await fs.readFile(path.join(output, info.manifest.ui), 'utf8');
assert.match(raw, /init_SheetSettings/, 'packaged panel retains deferred initialization');
const css = await fs.readFile(path.join(output, 'assets/presentation.css'), 'utf8');
assert.doesNotMatch(css, /sd-settings-panel/, 'settings presentation belongs to Core');
const compiledCss = await fs.readFile(path.join(output, info.compiledStyles), 'utf8');
const fixture = await settingsFixture();
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ['--no-sandbox', '--disable-background-networking'] });
try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
    const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    const setup = async () => {
        await mountSettingsFixture(page, fixture);
        await page.route('http://settings.fixture/pilot-ui.js', route => route.fulfill({ contentType: 'text/javascript', body: rewriteImportsForBrowser(raw) }));
        await page.addStyleTag({ content: `${compiledCss}\n${css}` });
        await page.evaluate(async () => {
            window.manifest = (await import('/pilot-ui.js')).default;
            window.state.system = { id: 'shadowdark' };
            window.render();
            window.requests = [];
            window.sdkOverrides = {
                currentUser: { id: 'user', name: 'Fixture', role: 4, isGM: true }, isConnected: true,
                foundryUrl: '', isDiceTrayOpen: false, toggleDiceTray() {}, navigate() {},
                resolveImageUrl: () => '', assetUrl: () => '', addNotification() {},
                events: { on: () => () => {} },
                fetchWithAuth: async (url, init = {}) => {
                    window.requests.push({ url, method: init.method || 'GET' });
                    if (init.method && init.method !== 'GET') throw Error('Unexpected fixture write');
                    if (url.endsWith('/actors/pilot/view')) return Response.json({ actor: {
                        id: 'pilot', _id: 'pilot', name: 'Settings Pilot', type: 'Player', isOwner: false,
                        items: [], effects: [], details: {}, system: { level: { value: 1 }, attributes: {} },
                        derived: { items: [], actions: [], abilities: {}, attacks: { melee: [], ranged: [] } },
                    } });
                    if (url.endsWith('/index')) return Response.json({ nameIndex: {}, collections: {} });
                    return Response.json([]);
                },
            };
            window.mountPilot((await window.manifest.actorPage()).default);
        });
    };
    await setup();
    await page.getByRole('button', { name: 'Manage Character Sheet', exact: true }).waitFor();
    const open = () => page.getByRole('button', { name: 'Open settings', exact: true }).click();
    const sheetTab = () => page.getByRole('tab', { name: 'Shadowdark', exact: true }).click();
    await open(); await sheetTab();
    await page.getByLabel('Sheet view', { exact: true }).selectOption('advanced');
    assert.equal(await page.evaluate(() => localStorage.getItem('shadowdark_view_mode')), 'advanced');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: 'View Single Page Sheet' }).waitFor();
    await page.getByRole('button', { name: 'View Single Page Sheet' }).click();
    await open(); await sheetTab();
    assert.equal(await page.getByLabel('Sheet view', { exact: true }).inputValue(), 'simple', 'existing sheet button changes same preference');
    await page.evaluate(() => {
        localStorage.setItem('unrelated-preference', 'keep');
        localStorage.setItem('sheetdelver:settings:world:shadowdark:other', 'true');
        window.originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) { if (key === 'shadowdark_view_mode') throw Error('denied'); return window.originalSetItem.call(this, key, value); };
    });
    await page.getByLabel('Sheet view', { exact: true }).selectOption('advanced');
    await page.getByRole('alert').filter({ hasText: 'could not be saved' }).waitFor();
    assert.equal(await page.getByLabel('Sheet view', { exact: true }).inputValue(), 'simple', 'failed persistence keeps actual value');
    await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
    await page.getByLabel('Sheet view', { exact: true }).selectOption('advanced');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await setup(); // Real reload, preserving only browser storage.
    await page.getByRole('button', { name: 'View Single Page Sheet' }).waitFor();
    await open(); await sheetTab();
    assert.equal(await page.getByLabel('Sheet view', { exact: true }).inputValue(), 'advanced');
    await page.getByRole('button', { name: 'Reset sheet view' }).click();
    assert.equal(await page.getByLabel('Sheet view', { exact: true }).inputValue(), 'simple');
    assert.deepEqual(await page.evaluate(() => [localStorage.getItem('shadowdark_view_mode'), localStorage.getItem('unrelated-preference'), localStorage.getItem('sheetdelver:settings:world:shadowdark:other')]), [null, 'keep', 'true']);
    for (const theme of ['dark', 'light']) {
        await page.evaluate(theme => document.body.dataset.sdAppearance = theme, theme);
        await page.setViewportSize({ width: 320, height: 700 });
        await page.getByRole('tab', { name: 'Shadowdark', exact: true }).focus();
        await page.keyboard.press('Home'); await page.keyboard.press('End'); await page.keyboard.press('Space');
        const panel = page.locator('[data-sd-surface="settingsTab"]');
        assert.equal(await panel.evaluate(el => el.classList.contains('sdk-module--shadowdark')), false);
        assert.equal(await page.locator('[id$="-module-title"]').count(), 0, 'one module tab needs no duplicate caption');
        const styles = await panel.evaluate(el => {
            const reference = document.createElement('select'); reference.className='sd-ui-control'; document.body.appendChild(reference);
            const select = getComputedStyle(el.querySelector('select'));
            const expected = getComputedStyle(reference);
            const values = {color:select.color, background:select.backgroundColor, border:select.borderRadius,
                expectedColor:expected.color, expectedBackground:expected.backgroundColor, expectedBorder:expected.borderRadius,
                headingFont:getComputedStyle(el.querySelector('h3')).fontFamily, coreFont:getComputedStyle(el.closest('dialog')).fontFamily,
                panelBackground:getComputedStyle(el.querySelector('section')).backgroundColor};
            reference.remove(); return values;
        });
        assert.equal(styles.color, styles.expectedColor);
        assert.equal(styles.background, styles.expectedBackground);
        assert.equal(styles.border, styles.expectedBorder);
        assert.equal(styles.headingFont, styles.coreFont);
        assert.equal(styles.panelBackground, 'rgba(0, 0, 0, 0)');
        assert.ok(await panel.evaluate(el => el.getBoundingClientRect().right <= innerWidth));
        await page.screenshot({ path: `${output}/${theme}-320.png` });
    }
    await page.getByLabel('Sheet view', { exact: true }).selectOption('advanced');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.evaluate(() => { window.state.worldId = 'different-world'; window.state.currentUser = { id: 'different-account', role: 2 }; window.render(); });
    await open(); await sheetTab();
    assert.equal(await page.getByLabel('Sheet view', { exact: true }).inputValue(), 'advanced', 'original site-wide scope is preserved across worlds/accounts');
    assert.equal(await page.evaluate(() => window.requests.every(request => request.method === 'GET')), true);
    assert.deepEqual(errors, []);
    console.log(`Packaged Shadowdark settings + actual sheet preference, reset, errors, reload, scope, keyboard and theme checks passed: ${output}`);
    console.log('Packager retains one UI ESM bundle; panel initialization/mount is deferred, separate network chunks are not emitted.');
} finally { await browser.close(); }
