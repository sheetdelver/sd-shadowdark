'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import ModulePageHeader from '../components/ModulePageHeader';
import ModuleDialog from '../components/ModuleDialog';
import ArtworkImage from '../components/ArtworkImage';
import { CardBody, CardNotes } from '../components/ResourceDetailModal';
import { formatUuid } from '../../logic/identity';
import type { ResourceCard } from '../../logic/resource-cards';

import { alignmentLabel, moveLabel, filterMonsters, EMPTY_MONSTER_FILTERS, type MonsterEntry as Entry, type MonsterFilters } from '../../logic/monster-catalog';

/** Read-only native monster catalog; exact references keep same-name rows separate. */
export default function Bestiary() {
    const { fetchWithAuth, navigate, isConnected, worldId, currentUser, events } = useSDK();
    const scope = JSON.stringify([worldId, currentUser?.id, currentUser?.role, isConnected]);
    const [refresh, setRefresh] = useState(0);
    const [entries, setEntries] = useState<Entry[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState<MonsterFilters>({ ...EMPTY_MONSTER_FILTERS });
    const changeFilter = (key: keyof MonsterFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
    const [selected, setSelected] = useState<Entry | null>(null);
    const [card, setCard] = useState<{ state: 'loading' } | { state: 'ready'; card: ResourceCard } | { state: 'error'; message: string } | null>(null);
    const seq = useRef(0);
    const [loadedScope, setLoadedScope] = useState<string | null>(null);

    useEffect(() => {
        const reload = () => { seq.current++; setSelected(null); setCard(null); setEntries(null); setLoadedScope(null); setRefresh(value => value + 1); };
        // Optional newer SDK signal: older hosts simply never emit it.
        const offPackages = events.on('world:packagesChanged' as Parameters<typeof events.on>[0], reload);
        const offContext = events.on('world:contextChanged', reload);
        return () => { offPackages(); offContext(); };
    }, [events]);

    useEffect(() => {
        seq.current++; setSelected(null); setCard(null); setEntries(null); setLoadedScope(null);
        if (!isConnected) return;
        let cancelled = false;
        const controller = new AbortController();
        setError(null);
        fetchWithAuth('/api/modules/shadowdark/bestiary', { signal: controller.signal }).then(async res => {
            const data = await res.json().catch(() => null);
            if (cancelled) return;
            setLoadedScope(scope);
            if (!res.ok || !data?.success) { setError(data?.error ?? 'Monster Stats is unavailable.'); setEntries([]); return; }
            setEntries(data.entries.filter((entry: any) => entry.ref));
        }).catch(() => { if (!cancelled) { setError('Monster Stats is unavailable.'); setEntries([]); } });
        return () => { cancelled = true; controller.abort(); seq.current++; };
    }, [fetchWithAuth, isConnected, scope, refresh]);

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

    const currentEntries = useMemo(() => loadedScope === scope ? entries ?? [] : [], [entries, loadedScope, scope]);
    const sources = useMemo(() => [...new Map(currentEntries.map(entry => [entry.sourceId, entry.sourceLabel])).entries()]
        .sort((a, b) => a[1].localeCompare(b[1])), [currentEntries]);
    const alignments = useMemo(() => [...new Set(currentEntries.map(entry => entry.alignment).filter((value): value is string => !!value))]
        .sort((a, b) => alignmentLabel(a).localeCompare(alignmentLabel(b))), [currentEntries]);
    const moves = useMemo(() => [...new Set(currentEntries.map(entry => entry.move).filter((value): value is string => !!value))]
        .sort((a, b) => moveLabel(a).localeCompare(moveLabel(b))), [currentEntries]);
    const visible = filterMonsters(currentEntries, filters);
    const invalidRange = filters.minLevel !== '' && filters.maxLevel !== '' && Number(filters.minLevel) > Number(filters.maxLevel);

    return (
        <main className="sd-monster-catalog min-h-screen font-serif pb-24">
            <ModulePageHeader title="Monster Stats" context="Monster reference" onBack={()=>navigate('/')} />
            <div className="max-w-6xl mx-auto p-4 space-y-4">
                <section className="sd-monster-filters" aria-label="Filter monsters">
                    <label className="sd-monster-source">
                        <span>Data source</span>
                        <select aria-label="Data source" value={filters.source} onChange={event => changeFilter('source', event.target.value)}>
                            <option value="">All Monsters</option>
                            {sources.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            {filters.source && !sources.some(([id]) => id === filters.source) && <option value={filters.source}>Source unavailable</option>}
                        </select>
                    </label>
                    <div className="sd-monster-filter-fields">
                        <label><span>Monster name</span>
                            <input type="search" value={filters.name} onChange={event => changeFilter('name', event.target.value)} placeholder="Search monsters…" />
                        </label>
                        <fieldset><legend>Level range</legend><div className="sd-monster-level-range">
                            <input type="number" aria-label="Minimum level" placeholder="Min" value={filters.minLevel} onChange={event => changeFilter('minLevel', event.target.value)} />
                            <span aria-hidden="true">–</span>
                            <input type="number" aria-label="Maximum level" placeholder="Max" value={filters.maxLevel} onChange={event => changeFilter('maxLevel', event.target.value)} />
                        </div></fieldset>
                        <label><span>Alignment</span><select aria-label="Alignment" value={filters.alignment} onChange={event => changeFilter('alignment', event.target.value)}>
                            <option value="">Any alignment</option>{alignments.map(value => <option key={value} value={value}>{alignmentLabel(value)}</option>)}
                        </select></label>
                        <label><span>Move</span><select aria-label="Move" value={filters.move} onChange={event => changeFilter('move', event.target.value)}>
                            <option value="">Any move</option>{moves.map(value => <option key={value} value={value}>{moveLabel(value)}</option>)}
                        </select></label>
                    </div>
                    <div className="sd-monster-filter-footer">
                        <p aria-live="polite">{currentEntries.length ? `${visible.length} of ${currentEntries.length} monsters` : '0 monsters'}</p>
                        <button type="button" onClick={() => setFilters({ ...EMPTY_MONSTER_FILTERS })}>Reset filters</button>
                    </div>
                    {invalidRange && <p role="alert">Minimum level must not exceed maximum level.</p>}
                </section>
                {error && <p role="alert" className="bg-white border-2 border-black p-3 text-red-800 font-bold">{error}</p>}
                {entries === null && <p role="status" className="italic">Loading monsters…</p>}
                <div className="sd-monster-columns" aria-hidden="true"><span>Monster name / source</span><span>Level</span><span>Alignment</span><span>Move</span></div>
                <ul className="sd-monster-list" aria-label="Monsters">
                    {visible.map(entry => (
                        <li key={formatUuid(entry.ref)}>
                            <button type="button" onClick={() => open(entry)} className="sd-monster-row" aria-label={`View ${entry.name} — ${entry.sourceLabel}`}>
                                <span className="sd-monster-identity">
                                    {entry.img && <ArtworkImage key={`${entry.img}:${entry.fallbackImg ?? ''}`} src={entry.img} fallback={entry.fallbackImg} className="sd-monster-thumbnail" />}
                                    <span><strong>{entry.name}</strong><small>{entry.sourceLabel}</small></span>
                                </span>
                                <span><span className="sd-monster-mobile-label">Level </span>{entry.level ?? '—'}</span>
                                <span><span className="sd-monster-mobile-label">Alignment </span>{alignmentLabel(entry.alignment)}</span>
                                <span><span className="sd-monster-mobile-label">Move </span>{moveLabel(entry.move)}{entry.moveNote ? ` (${entry.moveNote})` : ''}</span>
                            </button>
                        </li>
                    ))}
                </ul>
                {entries && visible.length === 0 && !error && <p className="sd-monster-empty">No monsters match your filters.</p>}
            </div>
            <ModuleDialog open={loadedScope === scope && !!selected} title={selected?.name ?? ''} subtitle={card?.state === 'ready' ? card.card.subtitle : undefined}
                onClose={() => { seq.current++; setSelected(null); setCard(null); }} size="card"
                footer={card?.state === 'ready' && (card.card.diagnostics.length > 0 || card.card.artworkCredit) ? <CardNotes card={card.card} /> : undefined}>
                {card?.state === 'loading' && <p role="status" className="italic">Loading…</p>}
                {card?.state === 'error' && <p role="alert" className="text-red-800">{card.message}</p>}
                {card?.state === 'ready' && <CardBody card={card.card} informational />}
            </ModuleDialog>
        </main>
    );
}
