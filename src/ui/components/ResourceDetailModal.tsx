'use client';

import React from 'react';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import ModuleDialog from './ModuleDialog';
import ItemStateControls from './ItemStateControls';
import { itemControls } from '../../logic/inventory-controls';
import { useShadowdarkActor, type ActionResponse, type CardTarget } from '../context/ShadowdarkActorContext';
import { useShadowdarkUI } from '../context/ShadowdarkUIContext';
import { buildDocumentCard, buildOwnedItemCard, type CardAction, type ResourceCard } from '../../logic/resource-cards';
import { presentDescription } from '../../logic/description';
import { canonicalUuid, formatUuid, parseUuid } from '../../logic/identity';

/**
 * The module's resource-detail controller. Owned items render from the current
 * prepared Actor view (so a cast or use reconciles with the next prepared
 * revision); linked documents are read through the caller-bound document route.
 * Casting delegates to the shared action flow (SDK RollDialog); the card is inert
 * while the host dialog is open and restored on cancel.
 */
type Loaded = { state: 'loading' } | { state: 'ready'; card: ResourceCard } | { state: 'error'; message: string };

export function CardBody({ card, onLink, onRollCheck, onRollFormula }: {
    card: ResourceCard;
    onLink?: (uuid: string) => void;
    onRollCheck?: (stat: string, dc: number) => void;
    onRollFormula?: (formula: string) => void;
}) {
    const { foundryUrl, resolveImageUrl } = useSDK();
    const html = useMemo(() => presentDescription(card.description, foundryUrl), [card.description, foundryUrl]);
    const onClick = (event: React.MouseEvent) => {
        const target = event.target as HTMLElement;
        const link = target.closest('[data-uuid]') as HTMLElement | null;
        if (link && onLink) { event.preventDefault(); onLink(link.dataset.uuid!); return; }
        const button = target.closest('button[data-action]') as HTMLElement | null;
        if (!button) return;
        event.preventDefault();
        if (button.dataset.action === 'roll-check' && onRollCheck) onRollCheck(String(button.dataset.stat), Number(button.dataset.dc));
        if (button.dataset.action === 'roll-formula' && onRollFormula && button.dataset.formula) onRollFormula(button.dataset.formula);
    };
    return (
        <div className="space-y-3">
            <div className="flex gap-3 items-start">
                {card.img && <img src={resolveImageUrl(card.img)} alt="" className="w-11 h-11 object-cover border-2 border-black bg-neutral-200 shrink-0" />}
                <div className="min-w-0 flex-1">
                    {card.states.length > 0 && (
                        <ul className="flex flex-wrap gap-1 mb-2" aria-label="State">
                            {card.states.map(state => <li key={state} className="text-[10px] font-bold uppercase tracking-widest border border-black px-1.5 py-0.5">{state}</li>)}
                        </ul>
                    )}
                    {card.facts.length > 0 && (
                        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-sm">
                            {card.facts.map((fact, index) => (
                                <div key={`${fact.label}-${index}`} className="contents">
                                    <dt className="font-bold uppercase text-[11px] tracking-widest text-neutral-600 pt-0.5">{fact.label}</dt>
                                    <dd className="break-words" title={fact.detail}>{fact.value}{fact.detail && <span className="block text-xs text-amber-800">{fact.detail}</span>}</dd>
                                </div>
                            ))}
                        </dl>
                    )}
                </div>
            </div>
            {html.trim() && (
                <div className="prose prose-sm max-w-none font-serif break-words [&_a.content-link]:underline [&_a.content-link]:cursor-pointer [&_button]:border [&_button]:border-black [&_button]:px-1 [&_button]:text-xs [&_button]:font-bold"
                    onClick={onClick} onKeyDown={event => { if (event.key === 'Enter') onClick(event as any); }}
                    dangerouslySetInnerHTML={{ __html: html }} />
            )}
            {card.sections.map(section => (
                <section key={section.title} aria-label={section.title} className="border-t-2 border-black pt-2">
                    <h3 className="font-serif font-bold text-base uppercase">{section.title}</h3>
                    <ul className="divide-y divide-neutral-200">
                        {section.entries.map((entry, index) => (
                            <li key={`${entry.title}-${index}`} className="py-2">
                                <div className="font-bold">{entry.title}</div>
                                {entry.facts && <div className="text-sm text-neutral-700">{entry.facts.map(fact => `${fact.label}: ${fact.value}`).join(' · ')}</div>}
                                {entry.description && <div className="text-sm font-serif mt-1 break-words" dangerouslySetInnerHTML={{ __html: presentDescription(entry.description, foundryUrl) }} />}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
            {card.diagnostics.length > 0 && (
                <details className="text-xs text-amber-900 border border-amber-700 bg-amber-50 p-2">
                    <summary className="cursor-pointer font-bold">Data notes ({card.diagnostics.length})</summary>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5">{[...new Set(card.diagnostics)].map(message => <li key={message}>{message}</li>)}</ul>
                </details>
            )}
        </div>
    );
}

export default function ResourceDetailModal() {
    const { actor, card: target, openCard, closeCard, startAction, isActionBusy, rollDialog, pendingConfirmation, performRoll } = useShadowdarkActor();
    const { fetchWithAuth } = useSDK();
    const { systemData } = useShadowdarkUI();
    const [documentState, setDocumentState] = useState<Loaded>({ state: 'loading' });
    const [history, setHistory] = useState<CardTarget[]>([]);
    const [focus, setFocus] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const requestSeq = useRef(0);

    const lookups = useMemo(() => ({
        label: (ref: any) => systemData?.nameIndex?.[formatUuid(ref)] ?? null,
    }), [systemData]);

    useEffect(() => { setFocus(false); setResult(null); }, [target]);

    useEffect(() => {
        if (target?.kind !== 'document') return;
        const seq = ++requestSeq.current;
        const uuid = canonicalUuid(target.uuid);
        if (!uuid) { setDocumentState({ state: 'error', message: 'This link is not a supported document reference.' }); return; }
        setDocumentState({ state: 'loading' });
        fetchWithAuth(`/api/modules/shadowdark/document/${uuid}`).then(async res => {
            const data = await res.json().catch(() => null);
            if (seq !== requestSeq.current) return;
            if (!res.ok || !data || data.error) {
                setDocumentState({ state: 'error', message: res.status === 403 ? 'You cannot view this document.' : 'This document is unavailable or not visible to you.' });
                return;
            }
            setDocumentState({ state: 'ready', card: buildDocumentCard(data, parseUuid(uuid), lookups) });
        }).catch(() => seq === requestSeq.current && setDocumentState({ state: 'error', message: 'The document could not be loaded.' }));
    }, [target, fetchWithAuth, lookups]);

    if (!target || !actor) return null;
    let loaded: Loaded;
    if (target.kind === 'item') {
        const item = (actor.items ?? []).find((entry: any) => String(entry.id ?? entry._id) === target.itemId);
        const card = item && actor.derived ? buildOwnedItemCard(actor.derived, item, lookups) : null;
        loaded = card ? { state: 'ready', card } : { state: 'error', message: result ?? 'This item is no longer on the character.' };
    } else loaded = documentState;

    const close = () => { setHistory([]); closeCard(); };
    const open = (next: CardTarget) => { setHistory(prev => [...prev, target]); openCard(next); };
    const back = history.length ? () => { const previous = history[history.length - 1]; setHistory(history.slice(0, -1)); openCard(previous); } : null;
    const title = loaded.state === 'ready' ? loaded.card.title : loaded.state === 'loading' ? 'Loading…' : 'Unavailable';

    const run = (entry: CardAction) => {
        setResult(null);
        startAction(entry.action, {
            focus,
            onSettled: (response: ActionResponse | null) => {
                if (!response?.outcome) return;
                const outcome = response.outcome;
                const verdict = outcome.success === null ? `Total ${outcome.total}` : `${outcome.success ? 'Success' : 'Failure'} (${outcome.total})`;
                const notes = (response.consequences ?? []).map(entry => entry.status === 'applied' ? entry.description : `Not saved: ${entry.description}`);
                setResult([verdict, ...notes].join(' — '));
            },
        });
    };

    const ownedItemId = target.kind === 'item' && loaded.state === 'ready' ? target.itemId : null;
    const hasControls = !!ownedItemId && itemControls(actor.derived?.items ?? [], actor.items ?? [], ownedItemId).length > 0;
    const hasActions = loaded.state === 'ready' && loaded.card.actions.length > 0;
    const footer = loaded.state === 'ready' && (hasActions || hasControls) ? (
        <div className="space-y-2">
            {hasControls && <ItemStateControls itemId={ownedItemId!} />}
            {loaded.card.kind === 'spell' && loaded.card.itemId && (
                <label className="flex items-center gap-2 text-sm min-h-11">
                    <input type="checkbox" className="w-5 h-5" checked={focus} onChange={event => setFocus(event.target.checked)} />
                    Focus check (a failed focus check does not lose the spell)
                </label>
            )}
            {hasActions && <div className="flex flex-wrap gap-2">
                {loaded.card.actions.map(entry => (
                    <button key={entry.id} type="button" data-autofocus={entry.available || undefined}
                        disabled={!entry.available || isActionBusy(entry.id)} title={entry.reason ?? undefined}
                        onClick={() => run(entry)}
                        className="min-h-11 sm:min-h-9 px-3 bg-black text-white font-bold uppercase tracking-wider text-xs disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500">
                        {isActionBusy(entry.id) ? 'Working…' : entry.label}
                    </button>
                ))}
            </div>}
            {loaded.card.actions.filter(entry => !entry.available && entry.reason).map(entry => (
                <p key={entry.id} className="text-xs text-red-800" role="note">{entry.label}: {entry.reason}</p>
            ))}
            {loaded.card.actions.flatMap(entry => entry.action.situational).length > 0 && (
                <p className="text-xs text-neutral-700" role="note">Situational effects ({[...new Set(loaded.card.actions.flatMap(entry => entry.action.situational.map(option => option.name)))].join(', ')}) are not included; add them as a manual adjustment.</p>
            )}
            {result && <p className="text-sm font-bold" role="status">{result}</p>}
        </div>
    ) : result ? <p className="text-sm font-bold" role="status">{result}</p> : null;

    return (
        <ModuleDialog open title={title} subtitle={loaded.state === 'ready' ? loaded.card.subtitle : undefined}
            onClose={close} suspended={rollDialog.open || !!pendingConfirmation} footer={footer} size="card">
            {back && <button type="button" onClick={back} className="mb-3 text-xs font-bold uppercase tracking-widest underline min-h-11">← Back</button>}
            {loaded.state === 'loading' && <p role="status" className="italic">Loading…</p>}
            {loaded.state === 'error' && <p role="alert" className="text-red-800">{loaded.message}</p>}
            {loaded.state === 'ready' && (
                <CardBody card={loaded.card}
                    onLink={uuid => open({ kind: 'document', uuid })}
                    onRollCheck={(stat) => {
                        const action = (actor.derived?.actions ?? []).find((entry: any) => entry.kind === 'check' && entry.request.stat === stat);
                        if (action) startAction(action);
                    }}
                    onRollFormula={formula => performRoll('formula', formula)} />
            )}
        </ModuleDialog>
    );
}
