'use client';
import React, { useMemo, useState } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import ArtworkImage from './ArtworkImage';
import type { ResourceCard } from '../../logic/resource-cards';
import { presentDescription, presentReferenceDescription } from '../../logic/description';

function CardArtwork({ card }: { card: ResourceCard }) {
    const [unavailable, setUnavailable] = useState(false);
    return <div className="sd-card-art" aria-hidden="true" hidden={unavailable}>
        <ArtworkImage src={card.img!} fallback={card.fallbackImg} onUnavailable={() => setUnavailable(true)} />
    </div>;
}

export function CardBody({ card, onLink, onRollCheck, onRollFormula, informational = false }: {
    card: ResourceCard;
    informational?: boolean;
    onLink?: (uuid: string) => void;
    onRollCheck?: (stat: string, dc: number) => void;
    onRollFormula?: (formula: string) => void;
}) {
    const { foundryUrl } = useSDK();
    const html = useMemo(() => (informational ? presentReferenceDescription : presentDescription)(card.description, foundryUrl), [card.description, foundryUrl, informational]);
    const onClick = (event: React.MouseEvent) => {
        if (informational) return;
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
        <div className="sd-card-content">
            {card.img && <CardArtwork key={`${card.img}:${card.fallbackImg ?? ''}`} card={card} />}
            <div className="sd-card-title" aria-hidden="true">{card.title}</div>
            <div className="sd-card-copy space-y-3">
            <div className="flex gap-3 items-start">
                <div className="min-w-0 flex-1">
                    {card.states.length > 0 && (
                        <ul className="flex flex-wrap gap-1 mb-2" aria-label="State">
                            {card.states.map(state => <li key={state} className="text-[10px] font-bold uppercase tracking-widest border border-black px-1.5 py-0.5">{state}</li>)}
                        </ul>
                    )}
                    {(card.subtitle || card.facts.length > 0) && (
                        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-sm">
                            {[...(card.subtitle ? [{ label: 'Type', value: card.subtitle, detail: undefined }] : []), ...card.facts].map((fact, index) => (
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
                                {entry.description && <div className="text-sm font-serif mt-1 break-words" dangerouslySetInnerHTML={{ __html: (informational ? presentReferenceDescription : presentDescription)(entry.description, foundryUrl) }} />}
                            </li>
                        ))}
                    </ul>
                </section>
            ))}
            </div>
        </div>
    );
}

/** Notes share the action footer, including read-only preview/bestiary cards. */
export function CardNotes({ card }: { card: ResourceCard }) {
    if (!card.diagnostics.length && !card.artworkCredit) return null;
    return <>{card.artworkCredit && <p className="text-xs text-neutral-600">Artwork: {card.artworkCredit}</p>}
    {card.diagnostics.length > 0 && <details className="sd-card-notes text-xs text-amber-900 border border-amber-700 bg-amber-50 p-2">
        <summary className="cursor-pointer font-bold">Data notes ({new Set(card.diagnostics).size})</summary>
        <ul className="list-disc pl-4 mt-1 space-y-0.5">{[...new Set(card.diagnostics)].map(message => <li key={message}>{message}</li>)}</ul>
    </details>}</>;
}
