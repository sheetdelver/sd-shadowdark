import assert from 'node:assert/strict';
import manifest from '../../module/ui';
import { shadowdarkTheme as theme } from '../ui/themes/shadowdark';

assert.equal(manifest.componentStyles, theme, 'UI manifest must own shared styles');
assert.equal(manifest.info.compatibility?.apiContracts?.['ui-extension-api'], '>=1.3.0 <2.0.0');
assert.equal(typeof manifest.componentStyles?.chat?.msgContainer, 'function');
assert.equal(typeof manifest.componentStyles?.diceTray?.rollModeBtn, 'function');
assert.notEqual(theme.diceTray.rollModeBtn(true), theme.diceTray.rollModeBtn(false));
assert.notEqual(theme.chat.rollTotal, 'hidden', 'Generic totals and private placeholders must remain visible');
assert.ok(theme.diceTray.container.includes('text-black'), 'Light tray must establish readable foreground');
console.log('shadowdark shared presentation: PASS');
