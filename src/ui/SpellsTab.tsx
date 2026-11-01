'use client';
import SpellLossControl from './components/SpellLossControl';

import React from 'react';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useSDK } from '@sheet-delver/sdk/react';
import SpellSelectionModal from './components/SpellSelectionModal';
import { useShadowdarkActor } from './context/ShadowdarkActorContext';
import { bonusLabel, type PreparedAction } from '../logic/actions';
import { RANGE_LABELS, spellDuration } from '../logic/resource-cards';
import { formatUuid } from '../logic/identity';
import { spellReview } from '../logic/spell-review';
import type { SpellIntent } from './components/SpellSelectionModal';

/**
 * Spells tab. Casting facts come from the prepared spell actions shared with the
 * paper sheet and cards. Spell-list management uses exact Class UUIDs: a class
 * is a spellcasting source when its slugified name is in the prepared native
 * `spellcasting.classes` (PlayerSD semantics), and limits come only from that
 * class's native `spellsknown` table.
 */
interface SpellSource { classUuid: string; listUuid: string; name: string; grant: string; limits: Record<number, any> }

export default function SpellsTab() {
    const { resolveImageUrl, addNotification, fetchWithAuth } = useSDK();
    const { actor, deleteItem, startAction, openCard, isActionBusy, refreshActor, card, rollDialog, pendingConfirmation } = useShadowdarkActor();
    const [manage, setManage] = useState<{ classUuid: string; tier: number } | null>(null);
    const [saving, setSaving] = useState(false);
    const [submission, setSubmission] = useState<any>(null);
    const [receipt, setReceipt] = useState<any>(null);
    const derived = actor.derived ?? {};
    const actions: PreparedAction[] = derived.actions ?? [];
    const views: any[] = derived.items ?? [];
    const itemById = (id: string) => (actor.items ?? []).find((item: any) => String(item.id ?? item._id) === id);

    const sources: SpellSource[] = derived.spellModel?.sources ?? [];
    const owned = derived.spellModel?.owned ?? [];
    const managedSource = sources.find(source => source.classUuid === manage?.classUuid);
    const intentRevision = managedSource ? JSON.stringify([managedSource.classUuid, managedSource.listUuid, managedSource.grant, managedSource.limits]) : '';
    const knownFor = (source: SpellSource, tier: number) => owned.filter((row: any) => row.tier === tier
        && (row.classes.includes(source.listUuid) || row.classification === 'unresolved'));
    const limitFor = (source: SpellSource, tier: number) => source.limits[tier]?.status === 'known' ? source.limits[tier].value : undefined;
    const tiersFor = (source: SpellSource) => [1,2,3,4,5].filter(tier => (limitFor(source, tier) ?? 0) > 0 || knownFor(source,tier).length);

    const spellRows = actions.filter(action => action.kind === 'spell' && itemById(action.itemId ?? '')?.type === 'Spell');
    const itemRows = actions.filter(action => action.kind === 'spell' && itemById(action.itemId ?? '')?.type !== 'Spell');

    useEffect(() => {
        if (manage && !saving && !submission && !receipt && !managedSource) {
            setManage(null); setSubmission(null); setReceipt(null);
            addNotification('Casting source changed. Review the current character before managing spells.', 'info');
        }
    }, [manage, saving, managedSource, submission, receipt, addNotification]);

    const saveSelection = async (intent: SpellIntent) => {
        if (!manage || saving || (!managedSource && !submission)) return;
        if (!submission && !intent.additions.length && !intent.removals.length) { setManage(null); return; }
        const body = submission ?? { requestId: globalThis.crypto.randomUUID(), baseline: actor.spellReviewToken ?? spellReview(actor),
            listUuid: managedSource!.listUuid, tier: manage.tier, ...intent };
        setSubmission(body); setSaving(true);
        try {
            const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actor.id ?? actor._id}/spells/manage`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', ...(typeof actor.worldContextRevision === 'number' ? { 'X-SheetDelver-Context-Revision': String(actor.worldContextRevision) } : {}) }, body: JSON.stringify(body),
            });
            const result = await res.json();
            if (!res.ok || !result.success) throw new Error(result.error?.message ?? result.error ?? `HTTP ${res.status}`);
            setReceipt({ ...result, requestId: body.requestId, listUuid: body.listUuid });
            if (result.state === 'complete') { setManage(null); setSubmission(null); setReceipt(null); addNotification('Spell changes completed.', 'success'); }
        } catch (e) {
            // Keep the exact request for a lost response. A retry never invents
            // new identity or a catalog-derived removal set.
            setReceipt((previous: any) => ({ ...(previous ?? { state: 'partial', operations: [] }), requestId: body.requestId, listUuid: body.listUuid, recovery: `No complete response: ${(e as Error).message}. Retry this same request to reconcile receipts, or close and review actual inventory.` }));
        } finally { await refreshActor(); setSaving(false); }
    };

    const castRow = (action: PreparedAction, item: any, label: string, spellItem: any | null, lostPath: boolean) => {
        const lost = !!action.reason && action.reason.includes('lost');
        const spent = views.find(view => view.id === action.itemId)?.scroll?.spent === true;
        const system = spellItem?.system ?? {};
        return (
            <li key={action.id} className="bg-white border-black border-2 p-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => openCard({ kind: 'item', itemId: String(item.id ?? item._id) })} className="flex items-center gap-2 flex-1 min-w-[12rem] text-left min-h-11" aria-label={`${label} details`}>
                    <img src={resolveImageUrl(item.img)} alt="" className="w-10 h-10 border border-black object-cover bg-black shrink-0" />
                    <span className="min-w-0">
                        <span className={`block font-serif font-bold text-lg uppercase leading-tight break-words ${lost || spent ? 'line-through text-neutral-500' : ''}`}>{label}</span>
                        {spent && <span className="text-xs font-bold uppercase">Spent</span>}
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
                {lostPath && <SpellLossControl itemId={String(item.id ?? item._id)} />}
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
                {(derived.spellModel?.diagnostics ?? []).map((message: string) => <p key={message} role="status">{message}</p>)}
                {sources.length === 0 && (
                    <p className="text-sm">No spellcasting class progression is available for management. Owned spells remain visible above.</p>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sources.map(source => (
                        <div key={source.classUuid} className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="bg-black text-white p-2 font-serif font-bold text-sm uppercase tracking-widest">{source.name}</div>
                            <div className="p-3 flex flex-wrap gap-2">
                                {tiersFor(source).map(tier => {
                                    const limit = limitFor(source, tier);
                                    const known = knownFor(source, tier).filter((view: any) => !view.innate).length;
                                    return (
                                        <button type="button" key={tier} onClick={() => { setSubmission(null); setReceipt(null); setManage({ classUuid: source.classUuid, tier }); }}
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

            {manage && !managedSource && (submission || receipt) && <section role="status" className="sd-operation-review">
                <p>The casting source is unavailable. Saved operation {submission?.requestId} still belongs to list {submission?.listUuid}; review actual inventory before another request.</p>
                {receipt?.operations?.map((op: any, index: number) => <p key={index}>{op.kind} {op.itemId ?? op.target}: {op.status}</p>)}
                <button type="button" disabled={saving} onClick={() => saveSelection({ additions: [], removals: [] })}>Retry saved operation</button>
                <button type="button" disabled={saving} onClick={() => { setManage(null); setSubmission(null); setReceipt(null); }}>Close operation review</button>
            </section>}
            {manage && managedSource && (
                <SpellSelectionModal
                    isOpen
                    title={`Manage ${managedSource.name} Spells - Tier ${manage.tier}`}
                    tier={manage.tier}
                    key={`${actor.id ?? actor._id}:${manage.classUuid}:${manage.tier}`}
                    intentRevision={intentRevision}
                    classUuid={managedSource.listUuid}
                    knownSpells={knownFor(managedSource, manage.tier).map((row: any) => ({
                        itemId: row.itemId, name: row.name, tier: row.tier, uuid: row.source ? formatUuid(row.source) : null,
                        isInnate: row.innate, unresolved: row.classification === 'unresolved', system: itemById(row.itemId)?.system, img: itemById(row.itemId)?.img,
                    }))}
                    onSave={saveSelection}
                    onClose={() => { if (!saving) { setManage(null); setSubmission(null); setReceipt(null); } }}
                    receipt={receipt}
                    suspended={!!card || rollDialog.open || !!pendingConfirmation}
                    onOpenDocument={uuid => openCard({ kind: 'document', uuid })}
                    maxSelections={limitFor(managedSource, manage.tier)}
                    isSaving={saving}
                    actor={actor}
                />
            )}
        </div>
    );
}
