'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import { presentDescription } from '../../logic/description';
import { canonicalUuid } from '../../logic/identity';
import { RANGE_LABELS, spellDuration } from '../../logic/resource-cards';
import { spellReview } from '../../logic/spell-review';
import { useShadowdarkCollections } from '../context/ShadowdarkUIContext';
import { CollectionStatus } from './CollectionStatus';
import ModuleDialog from './ModuleDialog';

export interface SpellIntent { additions: string[]; removals: string[] }
export interface OwnedSpellOption { itemId: string; name: string; tier: number; uuid?: string | null; isInnate?: boolean; unresolved?: boolean; system?: any; img?: string }
interface Props {
    isOpen: boolean; onClose: () => void; onSave: (intent: SpellIntent) => void;
    title: string; tier?: number; classUuid?: string; knownSpells: OwnedSpellOption[];
    intentRevision?: string; maxSelections?: number; isSaving?: boolean; actor?: any; receipt?: any;
    suspended?: boolean; onOpenDocument?: (uuid: string) => void;
}

/** Ownership and reviewed intent are independent of catalog completeness. */
export default function SpellSelectionModal({ isOpen, onClose, onSave, title, tier, classUuid, knownSpells,
    maxSelections, intentRevision, isSaving = false, actor, receipt, suspended = false, onOpenDocument }: Props) {
    const { resolveImageUrl } = useSDK();
    const data = useShadowdarkCollections(['spells'], isOpen);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [changed, setChanged] = useState(false);
    const review = actor ? spellReview(actor) : '';
    const intentKey = JSON.stringify([data.generation, review, classUuid, tier, maxSelections, intentRevision]);
    const [intent, setIntent] = useState<{ key: string; additions: Set<string>; removals: Set<string> }>({ key: intentKey, additions: new Set(), removals: new Set() });
    // Mask stale intent in the render that receives new facts, before effects
    // run. Search and expanded details are harmless and keep their state.
    const additions = intent.key === intentKey && !receipt ? intent.additions : new Set<string>();
    const removals = intent.key === intentKey && !receipt ? intent.removals : new Set<string>();
    const previousKey = useRef(intentKey);
    useEffect(() => {
        if (previousKey.current === intentKey) return;
        previousKey.current = intentKey;
        if (intent.additions.size || intent.removals.size) setChanged(true);
        setIntent({ key: intentKey, additions: new Set(), removals: new Set() });
    }, [intentKey]);
    const toggleIntent = (kind: 'additions' | 'removals', value: string) => setIntent(previous => {
        const current = previous.key === intentKey ? previous : { key: intentKey, additions: new Set<string>(), removals: new Set<string>() };
        const next = new Set(current[kind]); next.has(value) ? next.delete(value) : next.add(value);
        return { ...current, [kind]: next };
    });
    const available = useMemo(() => data.ready ? data.collections.spells.filter((doc: any) => doc.type === 'Spell' || !doc.type)
        .filter((doc: any) => Number(doc.system?.tier ?? doc.tier) === tier && (doc.system?.class ?? []).some((uuid: unknown) => canonicalUuid(uuid) === canonicalUuid(classUuid))) : [],
    [data.ready, data.collections.spells, tier, classUuid]);
    const filtered = available.filter(doc => String(doc.name).toLowerCase().includes(search.toLowerCase()));
    const ownedCount = knownSpells.filter(spell => !spell.isInnate && !removals.has(spell.itemId)).length;
    const count = ownedCount + additions.size;
    const knownLimit = typeof maxSelections === 'number' && Number.isInteger(maxSelections) && maxSelections >= 0;
    const editing = !isSaving && !receipt;
    const uncertain = receipt?.operations?.some((op: any) => op.status === 'uncertain' && op.kind === 'add');
    const toggle = (setter: typeof setExpanded, value: string) => setter(previous => { const next = new Set(previous); next.has(value) ? next.delete(value) : next.add(value); return next; });
    const details = (key: string, doc: any) => expanded.has(key) && <div className="border-t border-dashed border-neutral-400 p-3 text-sm">
        <p>Range: {RANGE_LABELS[doc.system?.range] ?? doc.system?.range ?? 'Unavailable'} · Duration: {doc.system?.duration ? spellDuration(doc.system.duration) : 'Unavailable'}</p>
        <div className="prose prose-sm mt-2" dangerouslySetInnerHTML={{ __html: presentDescription(doc.system?.description ?? '') }} />
    </div>;
    return <ModuleDialog open={isOpen} title={title} size="picker" suspended={suspended} onClose={() => !isSaving && onClose()}
        subtitle={`Spells known: ${count} / ${knownLimit ? maxSelections : 'unavailable'}`} footer={<div className="flex flex-wrap justify-end gap-3">
            <button type="button" className="min-h-11 border-2 border-black px-4" disabled={isSaving} onClick={onClose}>CANCEL</button>
            <button type="button" className="min-h-11 border-2 border-black bg-black text-white px-4 disabled:opacity-50"
                disabled={isSaving || !data.ready || uncertain} onClick={() => onSave({ additions: [...additions], removals: [...removals] })}>
                {isSaving ? 'SAVING...' : receipt ? 'Retry remaining operations' : 'SAVE CHANGES'}</button>
        </div>}>
        <label className="sd-field-label block">Search spells
            <input data-autofocus placeholder="Filter spells by name..." value={search} onChange={event => setSearch(event.target.value)} className="block w-full min-h-11 border-2 border-black p-2 mt-1" />
        </label>
        <CollectionStatus state={data} label="Loading spells…" />
        {!knownLimit && <p role="status" className="sd-form-notice">Spell allowance unavailable. You can review your known spells, but cannot learn new ones yet.</p>}
        {knownLimit && count > maxSelections! && <p role="status" className="sd-form-notice">You know more spells than this class allowance. Remove a spell before learning another.</p>}
        {changed && !receipt && <p className="text-xs my-2">Spell choices changed. Review your selection before saving.</p>}
        {receipt && <div role="status" className="border-2 border-amber-800 bg-amber-50 p-3 my-3">
            <h3 className="font-bold">Spell changes</h3>
            <p>{receipt.state === 'complete' ? 'Changes completed.' : 'Some operations remain incomplete.'}</p>
            {receipt.operations?.map((op: any, i: number) => <p key={i}>{op.kind === 'add' ? 'Learn' : 'Remove'} {knownSpells.find(spell => spell.itemId === op.target)?.name ?? available.find(doc => canonicalUuid(doc.uuid) === op.target)?.name ?? 'spell'}: {op.status === 'complete' ? 'saved' : op.status === 'uncertain' ? 'needs review' : 'not saved'}</p>)}
            {receipt.recovery && <p>{receipt.recovery}</p>}
        </div>}
        <section aria-label="Owned spells" className="mt-4 space-y-2">
            <h3 className="font-bold">Known spells ({knownSpells.length})</h3>
            {knownSpells.map(spell => { const copies = knownSpells.filter(row => row.name === spell.name); const copyLabel = copies.length > 1 ? ` (copy ${copies.indexOf(spell) + 1} of ${copies.length})` : ''; return <div key={spell.itemId} data-removing={removals.has(spell.itemId)} className="sd-spell-row border-2 border-black p-2">
                <div className="sd-spell-line flex items-center gap-2">
                    {spell.img && <img src={resolveImageUrl(spell.img)} alt="" className="w-10 h-10 object-cover shrink-0" />}
                    <button type="button" aria-expanded={expanded.has(`owned:${spell.itemId}`)} className="min-h-11 flex-1 text-left" onClick={() => toggle(setExpanded, `owned:${spell.itemId}`)}>{spell.name}{copyLabel}</button>
                    {(spell.isInnate || spell.unresolved) && <span className="sd-choice-note">{spell.isInnate ? 'Granted' : 'Class unavailable'}</span>}
                    <button type="button" aria-label={`Remove ${spell.name}${copyLabel}`} aria-pressed={removals.has(spell.itemId)} disabled={!editing || spell.isInnate}
                        className="sd-choice-action min-h-11 border-2 border-black px-3 disabled:opacity-50" onClick={() => toggleIntent('removals', spell.itemId)}>{removals.has(spell.itemId) ? 'Keep' : 'Remove'}</button>
                </div>{details(`owned:${spell.itemId}`, spell)}
            </div>; })}
            {!knownSpells.length && <p>No known spells at this tier.</p>}
        </section>
        <section aria-label="Available spell additions" className="mt-5 space-y-2">
            <h3 className="font-bold">Available spells</h3>
            {filtered.map(doc => { const uuid = canonicalUuid(doc.uuid)!; const selected = additions.has(uuid); return <div key={uuid} data-selected={selected} className="sd-spell-row border-2 border-black">
                <div className="sd-spell-line flex items-center gap-2 p-2">
                    {doc.img && <img src={resolveImageUrl(doc.img)} alt="" className="w-10 h-10 object-cover shrink-0" />}
                    <button type="button" aria-expanded={expanded.has(uuid)} className="min-h-11 flex-1 text-left font-bold break-words" onClick={() => toggle(setExpanded, uuid)}>{doc.name}</button>
                    {onOpenDocument && <button type="button" className="sd-choice-action min-h-11 border-2 border-black px-3" onClick={() => onOpenDocument(uuid)} aria-label={`${doc.name} resource card`}>Details</button>}
                    <button type="button" aria-label={`Add ${doc.name}`} aria-pressed={selected}
                        disabled={!editing || (!selected && (!knownLimit || count >= maxSelections! || knownSpells.some(spell => spell.unresolved)))}
                        className="sd-choice-action min-h-11 border-2 border-black px-3 disabled:opacity-50" onClick={() => toggleIntent('additions', uuid)}>{selected ? 'Undo add' : 'Add'}</button>
                </div>{details(uuid, doc)}
            </div>; })}
            {data.ready && !filtered.length && <p className="p-3 italic">No spells found matching your filter.</p>}
        </section>
    </ModuleDialog>;
}
