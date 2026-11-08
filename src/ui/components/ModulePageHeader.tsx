import React, { type ReactNode } from 'react';
import { useSDKComponents, type PageHeaderTheme } from '@sheet-delver/sdk/react';

/** Module content/theme only. Core owns navigation and both header rows. */
const theme: PageHeaderTheme = {
    background:'#171717', foreground:'#fff', muted:'#a3a3a3', border:'#262626',
    accent:'#f59e0b', iconBackground:'#262626',
    fontFamily:'Arial, Helvetica, sans-serif', headingFontFamily:'Georgia, serif',
};
export default function ModulePageHeader({title,context,onBack,actions,icon}: {
    title?:string; context?:string; onBack?:()=>void; actions?:ReactNode; icon?:ReactNode;
}) {
    const { PageHeader } = useSDKComponents();
    return <PageHeader context={context} onBack={onBack} theme={theme} heading={title ? {
        title, subtitle:'Shadowdark RPG', actions,
        icon:icon ?? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5.25 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM2.25 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM18.75 7.5a.75.75 0 00-1.5 0v2.25H15a.75.75 0 000 1.5h2.25v2.25a.75.75 0 001.5 0v-2.25H21a.75.75 0 000-1.5h-2.25V7.5z" /></svg>,
    } : undefined} />;
}
