'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import ModuleDialog from '../components/ModuleDialog';
import { CardBody } from '../components/ResourceDetailModal';
import { formatUuid, type DocumentRef } from '../../logic/identity';
import type { ResourceCard } from '../../logic/resource-cards';

/**
 * Module bestiary: read-only browsing of Shadowdark NPCs from authorized native
 * Actor data. GMs see the declared monster compendium; everyone sees world NPCs
 * the server returns through their own visibility. Creatures with the same name
 * stay separate entries. There is no spawn, encounter or sharing action.
 */
interface Entry { ref: DocumentRef; name: string; img?: string; source: 'compendium' | 'world'; level: number; alignment: string | null; ac: number | null; hp: number | null }

export default function Bestiary() {
    const { fetchWithAuth, navigate, resolveImageUrl, isConnected } = useSDK();
    const [entries, setEntries] = useState<Entry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [compendiumAvailable, setCompendiumAvailable] = useState(false);
    const [query, setQuery] = useState('');
    const [source, setSource] = useState<'all' | 'compendium' | 'world'>('all');
    const [selected, setSelected] = useState<Entry | null>(null);
    const [card, setCard] = useState<{ state: 'loading' } | { state: 'ready'; card: ResourceCard } | { state: 'error'; message: string } | null>(null);
    const seq = useRef(0);

    useEffect(() => {
        if (!isConnected) return;
        let cancelled = false;
        setError(null);
        fetchWithAuth('/api/modules/shadowdark/bestiary').then(async res => {
            const data = await res.json().catch(() => null);
            if (cancelled) return;
            if (!res.ok || !data?.success) { setError(data?.error ?? 'The bestiary is unavailable.'); setEntries([]); return; }
            setEntries(data.entries.filter((entry: any) => entry.ref));
            setCompendiumAvailable(data.compendiumAvailable === true);
        }).catch(() => { if (!cancelled) { setError('The bestiary is unavailable.'); setEntries([]); } });
        return () => { cancelled = true; };
    }, [fetchWithAuth, isConnected]);

    const open = (entry: Entry) => {
        const current = ++seq.current;
        setSelected(entry);
        setCard({ state: 'loading' });
        fetchWithAuth(`/api/modules/shadowdark/bestiary/${formatUuid(entry.ref)}`).then(async res => {
            const data = await res.json().catch(() => null);
            if (current !== seq.current) return;
            if (!res.ok || !data?.success) setCard({ state: 'error', message: data?.error ?? 'This creature is unavailable or no longer visible.' });
            else setCard({ state: 'ready', card: data.card });
        }).catch(() => current === seq.current && setCard({ state: 'error', message: 'This creature could not be loaded.' }));
    };

    const names = useMemo(() => {
        const counts = new Map<string, number>();
        for (const entry of entries ?? []) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
        return counts;
    }, [entries]);
    const visible = (entries ?? []).filter(entry => (source === 'all' || entry.source === source)
        && entry.name.toLowerCase().includes(query.trim().toLowerCase()));

    return (
        <main className="min-h-screen bg-neutral-100 text-black font-serif pb-24">
            <nav className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
                <button type="button" onClick={() => navigate('/')} className="text-neutral-200 hover:text-amber-400 font-semibold text-sm uppercase tracking-wide min-h-11">← Back to Dashboard</button>
                <h1 className="text-white font-bold uppercase tracking-widest text-sm">Bestiary</h1>
            </nav>
            <div className="max-w-5xl mx-auto p-4 space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <label className="flex-1">
                        <span className="sr-only">Search creatures</span>
                        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search creatures…"
                            className="w-full border-2 border-black px-3 min-h-11 bg-white" />
                    </label>
                    <label className="flex items-center gap-2">
                        <span className="text-xs uppercase font-bold tracking-widest">Source</span>
                        <select value={source} onChange={event => setSource(event.target.value as any)} className="border-2 border-black min-h-11 px-2 bg-white">
                            <option value="all">All</option>
                            {compendiumAvailable && <option value="compendium">Shadowdark monsters</option>}
                            <option value="world">World NPCs</option>
                        </select>
                    </label>
                </div>
                {!compendiumAvailable && entries && <p className="text-sm">Compendium monsters are shown to GMs. You can browse the world NPCs visible to you.</p>}
                {error && <p role="alert" className="text-red-800 font-bold">{error}</p>}
                {entries === null && <p role="status" className="italic">Loading creatures…</p>}
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" aria-label="Creatures">
                    {visible.map(entry => (
                        <li key={formatUuid(entry.ref)}>
                            <button type="button" onClick={() => open(entry)}
                                className="w-full text-left bg-white border-2 border-black p-3 flex gap-3 items-center hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600 shadow-[3px_3px_0_0_rgba(0,0,0,1)] min-h-11">
                                {entry.img && <img src={resolveImageUrl(entry.img)} alt="" className="w-12 h-12 object-cover border border-black bg-neutral-200 shrink-0" />}
                                <span className="min-w-0">
                                    <span className="block font-bold text-lg leading-tight break-words">{entry.name}</span>
                                    <span className="block text-xs uppercase tracking-widest text-neutral-700">
                                        LV {entry.level} · AC {entry.ac ?? '—'} · HP {entry.hp ?? '—'}
                                    </span>
                                    <span className="block text-[11px] text-neutral-600">
                                        {entry.source === 'compendium' ? 'Shadowdark monsters' : 'World NPC'}
                                        {(names.get(entry.name) ?? 0) > 1 ? ` · ${entry.ref.id}` : ''}
                                    </span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                {entries && visible.length === 0 && !error && <p className="italic">No creatures match.</p>}
            </div>
            <ModuleDialog open={!!selected} title={selected?.name ?? ''} subtitle={card?.state === 'ready' ? card.card.subtitle : undefined}
                onClose={() => { seq.current++; setSelected(null); setCard(null); }} size="card">
                {card?.state === 'loading' && <p role="status" className="italic">Loading…</p>}
                {card?.state === 'error' && <p role="alert" className="text-red-800">{card.message}</p>}
                {card?.state === 'ready' && <CardBody card={card.card} />}
            </ModuleDialog>
        </main>
    );
}
