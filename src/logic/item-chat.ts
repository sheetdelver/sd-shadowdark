import { processHtmlContent, type ChatCard } from '@sheet-delver/sdk';
import type { ResourceCard } from './resource-cards';
import { presentReferenceDescription } from './description';

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Informational snapshot only: no actions, alternate identities or diagnostics. */
export function itemChatCard(card: ResourceCard): ChatCard {
    const unidentified = card.states.includes('Unidentified');
    const facts = unidentified ? [] : card.facts;
    const sections = unidentified ? [] : card.sections;
    const content = `${card.img ? `<img src="${escape(card.img)}" alt="" width="48" height="48">` : ''}
        <h3>${escape(card.title)}</h3><p>${escape(card.subtitle)}</p>
        ${facts.length ? `<dl>${facts.map(f => `<dt>${escape(f.label)}</dt><dd>${escape(f.value)}</dd>`).join('')}</dl>` : ''}
        ${presentReferenceDescription(card.description, undefined, card.rollData)}
        ${sections.map(s => `<h4>${escape(s.title)}</h4><ul>${s.entries.map(e => `<li><strong>${escape(e.title)}</strong>${e.facts?.length ? `<p>${e.facts.map(f => `${escape(f.label)}: ${escape(f.value)}`).join(' · ')}</p>` : ''}${e.description ? presentReferenceDescription(e.description, undefined, card.rollData) : ''}</li>`).join('')}</ul>`).join('')}`;
    return { title: card.title, content: String(processHtmlContent(content)) };
}
