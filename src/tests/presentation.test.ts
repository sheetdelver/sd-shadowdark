import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MockSDKProvider } from '@sheet-delver/sdk/testing';
import manifest from '../../module/ui';
import { shadowdarkTheme as theme } from '../ui/themes/shadowdark';
import ShadowdarkImportPage from '../ui/tools/ShadowdarkImportPage';

assert.equal(manifest.componentStyles, theme, 'UI manifest must own shared styles');
assert.equal(manifest.info.compatibility?.coreVersion, '>=0.14.2');
assert.equal(manifest.info.compatibility?.apiContracts?.['ui-extension-api'], '>=2.0.0 <3.0.0');
assert.deepEqual(manifest.dashboardActions?.map(action => [action.id, action.kind]), [
    ['generator', 'tool'], ['importer', 'tool'],
]);
const generatorAction = manifest.dashboardActions?.find(action => action.id === 'generator');
assert.equal(generatorAction?.kind === 'tool' ? generatorAction.toolId : null, 'generator');
const importerAction = manifest.dashboardActions?.find(action => action.id === 'importer');
assert.equal(importerAction?.kind === 'tool' ? importerAction.toolId : null, 'importer');
assert.equal(typeof manifest.tools?.importer, 'function');
const importerPage = renderToStaticMarkup(
    createElement(MockSDKProvider, null, createElement(ShadowdarkImportPage))
);
assert.match(importerPage, /Import Character/);
assert.match(importerPage, /Shadowdarklings\.net Importer/);
assert.match(importerPage, /Back to Dashboard/);
assert.match(importerPage, /Shadowdark RPG/);
assert.doesNotMatch(importerPage, /Shadowdarklings Export/);
assert.match(importerPage, /&quot;Protect the light!&quot;/);
assert.ok(importerPage.indexOf('<textarea') < importerPage.indexOf('Go to Shadowdarklings.net'));
assert.match(importerPage, /sticky top-\[45px\]/);
assert.match(importerPage, /Paste Character JSON/);
assert.equal('dashboardTools' in manifest, false);
assert.equal(typeof manifest.componentStyles?.chat?.msgContainer, 'function');
assert.equal(typeof manifest.componentStyles?.diceTray?.rollModeBtn, 'function');
assert.notEqual(theme.diceTray.rollModeBtn(true), theme.diceTray.rollModeBtn(false));
assert.notEqual(theme.chat.rollTotal, 'hidden', 'Generic totals and private placeholders must remain visible');
assert.ok(theme.diceTray.container.includes('text-black'), 'Light tray must establish readable foreground');
console.log('shadowdark shared presentation: PASS');
