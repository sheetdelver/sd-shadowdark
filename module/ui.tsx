import type { ModuleInfo, UIModuleManifest } from '@sheet-delver/sdk';
import { shadowdarkTheme } from '../src/ui/themes/shadowdark';
import infoJson from '../info.json';

const info = infoJson as ModuleInfo;

// Optional declaration uses structural types to preserve the released SDK floor.
const referenceViewer = {
    load: () => import('../src/ui/components/CompendiumReferenceView'),
    dialog: {
        overlay: 'absolute inset-0 bg-black/70 backdrop-blur-[2px]',
        container: 'sd-dialog-panel sd-resource-card relative flex w-full sm:max-w-[34rem] flex-col bg-white text-black border-2 border-black shadow-[8px_8px_0_0_black] outline-none',
        header: 'sd-dialog-header flex justify-end bg-black text-white pl-3 pr-1 py-1.5',
        title: 'sr-only',
        closeBtn: 'p-1 text-white hover:opacity-70',
        body: 'sd-dialog-body p-3',
        footer: 'hidden',
    },
};
// Placement is an optional enhancement: older supported Core hosts keep this in Tools.
const bestiaryAction = { id: 'bestiary', label: 'Monster Stats', section: 'gm' as const, kind: 'tool' as const, toolId: 'bestiary' };
const settingsTabs = [{ id: 'sheet', label: 'Shadowdark', load: () => import('../src/ui/settings/SheetSettings') }];
const uiManifest: UIModuleManifest & {
    referenceViews?: Record<'Actor' | 'Item', typeof referenceViewer>;
    settingsTabs?: typeof settingsTabs;
} = {
    settingsTabs,
    referenceViews: { Actor: referenceViewer, Item: referenceViewer },
    info,
    stylesheet: 'assets/presentation.css',
    componentStyles: shadowdarkTheme,
    theme: shadowdarkTheme.colors,
    sheet: () => import('../src/ui/ShadowdarkSheet'),
    rollModal: () => import('../src/ui/components/ShadowdarkInitiativeModal'),
    tools: {
        'generator': () => import('../src/ui/tools/Generator'),
        'importer': () => import('../src/ui/tools/ShadowdarkImportPage'),
        'bestiary': () => import('../src/ui/tools/Bestiary'),
    },
    dashboardActions: [
        { id: 'generator', label: 'Character Generator', kind: 'tool', toolId: 'generator' },
        { id: 'importer', label: 'Import From Shadowdarklings.net', kind: 'tool', toolId: 'importer' },
        bestiaryAction,
    ],
    actorPage: () => import('../src/ui/pages/ActorPage')
};

export default uiManifest;
