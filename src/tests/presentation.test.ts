import assert from 'node:assert/strict';
import manifest from '../../module/ui';
import { shadowdarkTheme as theme } from '../ui/themes/shadowdark';

assert.equal(manifest.componentStyles, theme, 'UI manifest must own shared styles');
assert.equal(manifest.info.compatibility?.coreVersion, '>=0.14.2');
assert.equal(manifest.info.compatibility?.apiContracts?.['ui-extension-api'], '>=2.0.0 <3.0.0');
assert.deepEqual(manifest.dashboardActions?.map(action => [action.id, action.kind]), [
    ['generator', 'tool'], ['importer', 'dialog'],
]);
const generatorAction = manifest.dashboardActions?.find(action => action.id === 'generator');
assert.equal(generatorAction?.kind === 'tool' ? generatorAction.toolId : null, 'generator');
const importerAction = manifest.dashboardActions?.find(action => action.id === 'importer');
assert.equal(importerAction?.kind === 'dialog' ? typeof importerAction.dialog : null, 'function');
assert.equal('dashboardTools' in manifest, false);
assert.equal(typeof manifest.componentStyles?.chat?.msgContainer, 'function');
assert.equal(typeof manifest.componentStyles?.diceTray?.rollModeBtn, 'function');
assert.notEqual(theme.diceTray.rollModeBtn(true), theme.diceTray.rollModeBtn(false));
assert.notEqual(theme.chat.rollTotal, 'hidden', 'Generic totals and private placeholders must remain visible');
assert.ok(theme.diceTray.container.includes('text-black'), 'Light tray must establish readable foreground');
console.log('shadowdark shared presentation: PASS');
