'use client';
import { useState, useEffect, useMemo } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import { presentDescription } from '../../logic/description';
import { canonicalUuid } from '../../logic/identity';
import { RANGE_LABELS, spellDuration } from '../../logic/resource-cards';
import { spellReview } from '../../logic/spell-review';
import { useShadowdarkCollections } from '../context/ShadowdarkUIContext';
import { CollectionStatus } from './CollectionStatus';
import ModuleDialog from './ModuleDialog';

export interface SpellIntent { additions: string[]; removals: string[] }
export interface OwnedSpellOption { itemId: string; name: string; tier: number; uuid?: string | null; isInnate?: boolean; unresolved?: boolean; system?: any }
interface Props {
    isOpen: boolean; onClose: () => void; onSave: (intent: SpellIntent) => void;
    title: string; tier?: number; classUuid?: string; knownSpells: OwnedSpellOption[];
    maxSelections?: number; isSaving?: boolean; actor?: any; receipt?: any;
    suspended?: boolean; onOpenDocument?: (uuid: string) => void;
}

/** Ownership and reviewed intent are independent of catalog completeness. */
export default function SpellSelectionModal({ isOpen, onClose, onSave, title, tier, classUuid, knownSpells,
    maxSelections, isSaving = false, actor, receipt, suspended = false, onOpenDocument }: Props) {
    const { resolveImageUrl } = useSDK();
    const data = useShadowdarkCollections(['spells'], isOpen);
    const [search, setSearch] = useState('');
    const [additions, setAdditions] = useState<Set<string>>(new Set());
    const [removals, setRemovals] = useState<Set<string>>(new Set());
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [changed, setChanged] = useState(false);
    const review = actor ? spellReview(actor) : '';
    // Retire intent at a changed authority boundary. Harmless collection retry
    // keeps the generation and manual state; search survives all refreshes.
    useEffect(() => {
        if (receipt) return;
        setAdditions(new Set()); setRemovals(new Set()); setChanged(true);
    }, [data.generation, review, classUuid, tier, receipt]);
    const available = useMemo(() => data.ready ? data.collections.spells.filter((doc: any) => doc.type === 'Spell' || !doc.type)
        .filter((doc: any) => Number(doc.system?.tier ?? doc.tier) === tier && (doc.system?.class ?? []).some((uuid: unknown) => canonicalUuid(uuid) === canonicalUuid(classUuid))) : [],
    [data.ready, data.collections.spells, tier, classUuid]);
    const filtered = available.filter(doc => String(doc.name).toLowerCase().includes(search.toLowerCase()));
    const ownedCount = knownSpells.filter(spell => !spell.isInnate && !removals.has(spell.itemId)).length;
    const count = ownedCount + additions.size;
    const knownLimit = typeof maxSelections === 'number' && Number.isInteger(maxSelections) && maxSelections >= 0;
    const editing = !isSaving && !receipt;
    const uncertain = receipt?.operations?.some((op: any) => op.status === 'uncertain' && op.kind === 'add');
    const toggle = (setter: typeof setAdditions, value: string) => setter(previous => { const next = new Set(previous); next.has(value) ? next.delete(value) : next.add(value); return next; });
    const details = (key: string, doc: any) => expanded.has(key) && <div className="border-t border-dashed border-neutral-400 p-3 text-sm">
        <p>Range: {RANGE_LABELS[doc.system?.range] ?? doc.system?.range ?? 'Unavailable'} · Duration: {doc.system?.duration ? spellDuration(doc.system.duration) : 'Unavailable'}</p>
        <div className="prose prose-sm mt-2" dangerouslySetInnerHTML={{ __html: presentDescription(doc.system?.description ?? '') }} />
    </div>;
    return <ModuleDialog open={isOpen} title={title} size="lg" suspended={suspended} onClose={() => !isSaving && onClose()}
        subtitle={`Selected: ${count} / ${knownLimit ? maxSelections : 'unavailable'}`} footer={<div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="min-h-11 border-2 border-black px-4" disabled={isSaving} onClick={onClose}>CANCEL</button>
            <button type="button" className="min-h-11 border-2 border-black bg-black text-white px-4 disabled:opacity-50"
                disabled={isSaving || !data.ready || uncertain} onClick={() => onSave({ additions: [...additions], removals: [...removals] })}>
                {isSaving ? 'SAVING...' : receipt ? 'Retry remaining operations' : 'SAVE CHANGES'}</button>
        </div>}>
        <label className="block text-sm font-bold">Search spells
            <input data-autofocus placeholder="Filter spells by name..." value={search} onChange={event => setSearch(event.target.value)} className="block w-full min-h-11 border-2 border-black p-2 mt-1" />
        </label>
        <CollectionStatus state={data} label="Loading spells…" />
        {!knownLimit && <p role="status">Progression is unavailable. Additions are disabled; existing spells are preserved.</p>}
        {knownLimit && count > maxSelections! && <p role="status">Existing inventory exceeds this limit. Nothing is removed automatically.</p>}
        {changed && !receipt && <p className="text-xs my-2">Review current choices before saving. Catalog changes never remove owned spells.</p>}
        {receipt && <div role="status" className="border-2 border-amber-800 bg-amber-50 p-3 my-3">
            <p>{receipt.state === 'complete' ? 'Changes completed.' : 'Some operations remain incomplete.'}</p>
            {receipt.operations?.map((op: any, i: number) => <p key={i}>{op.kind} {op.target}: {op.status}{op.error ? ` — ${op.error}` : ''}</p>)}
            {receipt.recovery && <p>{receipt.recovery}</p>}
        </div>}
        <section aria-label="Owned spells" className="mt-4 space-y-2">
            <h3 className="font-bold">Owned spells ({knownSpells.length})</h3>
            {knownSpells.map(spell => <div key={spell.itemId} className="border-2 border-black p-2">
                <div className="flex items-center flex-wrap gap-2">
                    <button type="button" aria-expanded={expanded.has(`owned:${spell.itemId}`)} className="min-h-11 flex-1 text-left" onClick={() => toggle(setExpanded, `owned:${spell.itemId}`)}>{spell.name}</button>
                    <span className="text-xs">{spell.isInnate ? 'Granted' : spell.unresolved ? 'Class unresolved; counted separately' : 'Known'} · Item {spell.itemId}</span>
                    <button type="button" aria-label={`Remove owned ${spell.name} (${spell.itemId})`} aria-pressed={removals.has(spell.itemId)} disabled={!editing || spell.isInnate}
                        className="min-h-11 border-2 border-black px-3 disabled:opacity-50" onClick={() => toggle(setRemovals, spell.itemId)}>{removals.has(spell.itemId) ? 'Keep' : 'Remove'}</button>
                </div>{details(`owned:${spell.itemId}`, spell)}
            </div>)}
            {!knownSpells.length && <p>No owned spells in this tier/list.</p>}
        </section>
        <section aria-label="Available spell additions" className="mt-5 space-y-2">
            <h3 className="font-bold">Available additions</h3>
            {filtered.map(doc => { const uuid = canonicalUuid(doc.uuid)!; const selected = additions.has(uuid); return <div key={uuid} className="border-2 border-black">
                <div className="flex items-center gap-2 p-2">
                    {doc.img && <img src={resolveImageUrl(doc.img)} alt="" className="w-10 h-10 object-cover shrink-0" />}
                    <button type="button" aria-expanded={expanded.has(uuid)} className="min-h-11 flex-1 text-left font-bold break-words" onClick={() => toggle(setExpanded, uuid)}>{doc.name}</button>
                    {onOpenDocument && <button type="button" className="min-h-11 px-2 underline" onClick={() => onOpenDocument(uuid)} aria-label={`${doc.name} resource card`}>Card</button>}
                    <button type="button" aria-label={`Add ${doc.name}`} aria-pressed={selected}
                        disabled={!editing || (!selected && (!knownLimit || count >= maxSelections! || knownSpells.some(spell => spell.unresolved)))}
                        className="min-h-11 border-2 border-black px-3 disabled:opacity-50" onClick={() => toggle(setAdditions, uuid)}>{selected ? 'Undo add' : 'Add'}</button>
                </div>{details(uuid, doc)}
            </div>; })}
            {data.ready && !filtered.length && <p className="p-3 italic">No spells found matching your filter.</p>}
        </section>
    </ModuleDialog>;
}
