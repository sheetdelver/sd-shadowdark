'use client';

import React from 'react';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useSDK } from '@sheet-delver/sdk/react';
import SpellSelectionModal from './components/SpellSelectionModal';
import { useShadowdarkUI } from './context/ShadowdarkUIContext';
import { useShadowdarkActor } from './context/ShadowdarkActorContext';
import { bonusLabel, type PreparedAction } from '../logic/actions';
import { RANGE_LABELS, spellDuration } from '../logic/resource-cards';
import { canonicalUuid, formatUuid } from '../logic/identity';
import { slugify } from '../logic/foundry';

/**
 * Spells tab. Casting facts come from the prepared spell actions shared with the
 * paper sheet and cards. Spell-list management uses exact Class UUIDs: a class
 * is a spellcasting source when its slugified name is in the prepared native
 * `spellcasting.classes` (PlayerSD semantics), and limits come only from that
 * class's native `spellsknown` table.
 */
interface SpellSource { classUuid: string; name: string; slug: string; spellsknown: any | null }

export default function SpellsTab() {
    const { systemData, collections, fetchPack } = useShadowdarkUI();
    const { resolveImageUrl, addNotification, fetchWithAuth } = useSDK();
    const { actor, updateItem, deleteItem, startAction, openCard, isActionBusy, refreshActor } = useShadowdarkActor();
    const [manage, setManage] = useState<{ source: SpellSource; tier: number } | null>(null);
    const [saving, setSaving] = useState(false);
    const derived = actor.derived ?? {};
    const actions: PreparedAction[] = derived.actions ?? [];
    const views: any[] = derived.items ?? [];
    const itemById = (id: string) => (actor.items ?? []).find((item: any) => String(item.id ?? item._id) === id);

    useEffect(() => {
        if (!collections?.classes) fetchPack('classes');
    }, [collections?.classes, fetchPack]);

    const sources: SpellSource[] = useMemo(() => {
        const classes: string[] = derived.spellcasting?.classes ?? [];
        const classDocs: any[] = collections?.classes ?? [];
        const ownedClass = (actor.items ?? []).find((item: any) => item.type === 'Class');
        const primary = derived.identity?.class?.ref ? formatUuid(derived.identity.class.ref) : null;
        return classes.flatMap(slug => {
            const doc = classDocs.find(entry => slugify(entry.name ?? '') === slug && entry.system?.spellcasting?.ability);
            if (!doc) return [];
            const uuid = canonicalUuid(doc.uuid)!;
            const isPrimary = uuid === primary;
            return [{ classUuid: uuid, name: doc.name, slug, spellsknown: (isPrimary ? ownedClass?.system?.spellcasting?.spellsknown : null) ?? doc.system?.spellcasting?.spellsknown ?? null }];
        });
    }, [derived.spellcasting, derived.identity, collections?.classes, actor.items]);

    const knownFor = (source: SpellSource, tier: number) => views.filter(view => view.type === 'Spell'
        && Number(itemById(view.id)?.system?.tier) === tier && (view.spellClasses ?? []).some((entry: any) => entry.slug === source.slug));
    const limitFor = (source: SpellSource, tier: number): number | undefined => {
        const value = source.spellsknown?.[String(derived.level ?? 0)]?.[String(tier)];
        return value === null || value === undefined ? undefined : Number(value);
    };
    const tiersFor = (source: SpellSource) => [1, 2, 3, 4, 5].filter(tier => (limitFor(source, tier) ?? 0) > 0 || knownFor(source, tier).length > 0);

    const spellRows = actions.filter(action => action.kind === 'spell' && itemById(action.itemId ?? '')?.type === 'Spell');
    const itemRows = actions.filter(action => action.kind === 'spell' && ['Scroll', 'Wand'].includes(itemById(action.itemId ?? '')?.type));

    /** Sequential learn/remove with an explicit result; nothing is reported as done unless it was. */
    const saveSelection = async (selected: any[]) => {
        if (!manage) return;
        setSaving(true);
        const owned = knownFor(manage.source, manage.tier).filter(view => !view.innate && view.source);
        const ownedSources = new Map(owned.map(view => [formatUuid(view.source), view]));
        const selectedUuids = new Set(selected.filter(spell => !spell.isInnate).map(spell => canonicalUuid(spell.uuid)).filter(Boolean) as string[]);
        const toAdd = [...selectedUuids].filter(uuid => !ownedSources.has(uuid));
        const toRemove = [...ownedSources.entries()].filter(([uuid]) => !selectedUuids.has(uuid)).map(([, view]) => view);
        const failed: string[] = [];
        for (const uuid of toAdd) {
            try {
                const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actor.id}/spells/learn`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spellUuid: uuid }),
                });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.success) failed.push(`${uuid}: ${data?.error ?? `HTTP ${res.status}`}`);
            } catch (error) { failed.push(`${uuid}: ${(error as Error).message}`); }
        }
        for (const view of toRemove) if (!(await deleteItem(view.id))) failed.push(`${view.name}: not removed`);
        await refreshActor();
        setSaving(false);
        if (failed.length) addNotification(`Spell changes were partly applied. Not saved: ${failed.join('; ')}`, 'error');
        else { addNotification(`Updated ${manage.source.name} tier ${manage.tier} spells.`, 'success'); setManage(null); }
    };

    const castRow = (action: PreparedAction, item: any, label: string, spellItem: any | null, lostPath: boolean) => {
        const lost = !!action.reason && action.reason.includes('lost');
        const system = spellItem?.system ?? {};
        return (
            <li key={action.id} className="bg-white border-black border-2 p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => openCard({ kind: 'item', itemId: String(item.id) })} className="flex items-center gap-2 flex-1 min-w-[12rem] text-left min-h-11" aria-label={`${label} details`}>
                    <img src={resolveImageUrl(item.img)} alt="" className="w-10 h-10 border border-black object-cover bg-black shrink-0" />
                    <span className="min-w-0">
                        <span className={`block font-serif font-bold text-lg uppercase leading-tight break-words ${lost ? 'line-through text-neutral-500' : ''}`}>{label}</span>
                        <span className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600">
                            {action.spell?.tier !== null && action.spell?.tier !== undefined ? `Tier ${action.spell.tier} · DC ${action.dc}` : 'Tier unavailable'}
                            {system.duration ? ` · ${spellDuration(system.duration)}` : ''}{system.range ? ` · ${RANGE_LABELS[system.range] ?? system.range}` : ''}
                            {action.ability ? ` · ${action.ability.toUpperCase()} ${bonusLabel(action.bonus)}` : action.available ? ` · ${bonusLabel(action.bonus)}` : ''}
                        </span>
                        {!action.available && action.reason && <span className="block text-xs text-red-800">{action.reason}</span>}
                    </span>
                </button>
                <button type="button" onClick={() => startAction(action)} disabled={!action.available || isActionBusy(action.id)}
                    className="min-h-11 px-4 flex items-center gap-2 border-2 border-black bg-black text-white disabled:bg-neutral-300 disabled:text-neutral-700 font-serif font-bold uppercase text-sm"
                    title={action.reason ?? undefined}>
                    <Sparkles className="w-4 h-4" aria-hidden="true" /> {isActionBusy(action.id) ? 'Casting…' : 'Cast'}
                </button>
                {lostPath && (
                    <button type="button" onClick={() => updateItem(String(item.id), { 'system.lost': !item.system?.lost })} aria-pressed={item.system?.lost === true}
                        className={`min-h-11 px-3 border-2 border-black text-xs font-bold uppercase ${item.system?.lost ? 'bg-red-100 text-red-800' : 'bg-white'}`}>
                        {item.system?.lost ? 'Restore' : 'Mark lost'}
                    </button>
                )}
            </li>
        );
    };

    return (
        <div className="space-y-8 pb-20">
            <section className="space-y-3" aria-label="Spells known">
                <h3 className="bg-black text-white p-2 font-serif font-bold text-xl uppercase tracking-wider shadow-md">Spells Known</h3>
                <ul className="space-y-2">
                    {spellRows.sort((a, b) => (a.spell?.tier ?? 0) - (b.spell?.tier ?? 0) || String(a.spell?.name).localeCompare(String(b.spell?.name)))
                        .map(action => { const item = itemById(action.itemId!); return castRow(action, item, item.name, item, true); })}
                    {spellRows.length === 0 && <li className="text-center text-neutral-600 italic py-8 border-2 border-dashed border-neutral-300">No spells known.</li>}
                </ul>
            </section>

            <section className="space-y-3" aria-label="Spells from items">
                <h3 className="bg-black text-white p-2 font-serif font-bold text-xl uppercase tracking-wider shadow-md">Spells From Items</h3>
                <ul className="space-y-2">
                    {itemRows.map(action => {
                        const item = itemById(action.itemId!);
                        return castRow(action, item, `${action.spell?.name ?? 'Unlinked spell'} (${item.name})`, null, false);
                    })}
                    {itemRows.length === 0 && <li className="text-center text-neutral-600 italic py-6 border-2 border-dashed border-neutral-300">No scrolls or wands.</li>}
                </ul>
            </section>

            <section className="space-y-3" aria-label="Manage spells">
                <h3 className="bg-black text-white p-2 font-serif font-bold text-xl uppercase tracking-wider shadow-md">Manage Spells</h3>
                {!collections?.classes && <p role="status" className="italic flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading classes…</p>}
                {collections?.classes && sources.length === 0 && (
                    <p className="text-sm">No spellcasting class from the character's native spellcasting classes ({(derived.spellcasting?.classes ?? []).join(', ') || 'none'}) is available in declared Shadowdark data.</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sources.map(source => (
                        <div key={source.classUuid} className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="bg-black text-white p-2 font-serif font-bold text-sm uppercase tracking-widest">{source.name}</div>
                            <div className="p-3 flex flex-wrap gap-2">
                                {tiersFor(source).map(tier => {
                                    const limit = limitFor(source, tier);
                                    const known = knownFor(source, tier).filter(view => !view.innate).length;
                                    return (
                                        <button type="button" key={tier} onClick={async () => { if (!collections?.spells) await fetchPack('spells'); setManage({ source, tier }); }}
                                            className="min-h-11 px-4 py-2 bg-white border-2 border-black font-serif font-bold text-sm hover:bg-black hover:text-white flex flex-col items-center min-w-[100px]">
                                            <span>TIER {tier}</span>
                                            <span className="text-[10px] font-sans">{known} / {limit ?? '—'}</span>
                                        </button>
                                    );
                                })}
                                {tiersFor(source).length === 0 && <span className="text-sm">No native spells-known entries at level {derived.level ?? 0}.</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {manage && (
                <SpellSelectionModal
                    isOpen
                    title={`Manage ${manage.source.name} Spells - Tier ${manage.tier}`}
                    tier={manage.tier}
                    classUuid={manage.source.classUuid}
                    knownSpells={knownFor(manage.source, manage.tier).filter(view => view.source).map(view => ({
                        name: view.name, uuid: formatUuid(view.source), tier: manage.tier, img: view.img, isInnate: view.innate === true,
                    } as any))}
                    onSave={saveSelection}
                    onClose={() => setManage(null)}
                    maxSelections={limitFor(manage.source, manage.tier)}
                    isSaving={saving}
                    actor={actor}
                />
            )}
        </div>
    );
}
