import type { ModuleInfo, UIModuleManifest } from '@sheet-delver/sdk';
import { shadowdarkTheme } from '../src/ui/themes/shadowdark';
import infoJson from '../info.json';

const info = infoJson as ModuleInfo;

const uiManifest: UIModuleManifest = {
    info,
    componentStyles: shadowdarkTheme,
    theme: shadowdarkTheme.colors,
    sheet: () => import('../src/ui/ShadowdarkSheet'),
    rollModal: () => import('../src/ui/components/ShadowdarkInitiativeModal'),
    tools: {
        'generator': () => import('../src/ui/tools/Generator')
    },
    dashboardActions: [
        { id: 'generator', label: 'Character Generator', kind: 'tool', toolId: 'generator' },
        { id: 'importer', label: 'Import From Shadowdarklings.net', kind: 'dialog',
            dialog: () => import('../src/ui/components/ShadowdarkImportDashboardDialog') },
    ],
    actorPage: () => import('../src/ui/pages/ActorPage')
};

export default uiManifest;
