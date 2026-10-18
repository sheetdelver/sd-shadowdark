'use client';
import { useState, useEffect } from 'react';
import { canonicalUuid } from '../../logic/identity';
import { languageRarity } from '../../logic/languages';
import { useShadowdarkCollections } from '../context/ShadowdarkUIContext';
import { CollectionStatus } from './CollectionStatus';
import ModuleDialog from './ModuleDialog';

interface Props {
    isOpen: boolean; onClose: () => void; onSelect: (selected: string[]) => void;
    currentLanguages: string[]; currentLabels?: Record<string, string>; availableLanguages?: any[];
    /** Ordinary inventory editing has no creation quota. Retained for old callers only. */
    maxCommon?: number; maxRare?: number;
}
export default function LanguageSelectionModal({ isOpen, onClose, onSelect, currentLanguages, currentLabels = {}, availableLanguages }: Props) {
    const data = useShadowdarkCollections(['languages'], isOpen);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState([...currentLanguages]);
    const baseline = JSON.stringify(currentLanguages);
    useEffect(() => { setSelected([...JSON.parse(baseline)]); }, [baseline, data.generation]);
    const rows: any[] = data.ready ? availableLanguages ?? data.collections.languages : [];
    const byUuid = new Map(rows.map(doc => [canonicalUuid(doc.uuid), doc]).filter(([uuid]) => !!uuid) as Array<[string, any]>);
    const retained = selected.filter(uuid => !byUuid.has(uuid));
    const toggle = (uuid: string) => setSelected(previous => previous.includes(uuid) ? previous.filter(value => value !== uuid) : [...previous, uuid]);
    const save = () => { if (!data.ready) return; if (JSON.stringify(selected) !== baseline) onSelect(selected); onClose(); };
    const choice = (uuid: string, name: string) => <button type="button" key={uuid} title={uuid} aria-pressed={selected.includes(uuid)} onClick={() => toggle(uuid)}
        className={`min-h-11 border-2 border-black p-2 text-left ${selected.includes(uuid) ? 'bg-black text-white' : 'bg-white text-black'}`}>{name}</button>;
    return <ModuleDialog open={isOpen} title="Edit Languages" onClose={onClose} size="lg" footer={<div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="min-h-11 border-2 border-black px-4" onClick={onClose}>Cancel</button>
        <button type="button" className="min-h-11 border-2 border-black bg-black text-white px-4 disabled:opacity-50" disabled={!data.ready} onClick={save}>Save Languages</button>
    </div>}>
        <p className="text-sm mb-3">Edit the Actor’s language inventory. Creation choice counts do not limit ordinary editing. Existing custom or unavailable entries are preserved until explicitly removed.</p>
        <label className="font-bold text-sm">Search languages<input data-autofocus placeholder="Search languages..." className="block w-full min-h-11 border-2 border-black p-2" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <CollectionStatus state={data} label="Loading languages…" />
        {retained.length > 0 && <section className="mt-4" aria-label="Retained language entries"><h3 className="font-bold">Retained entries without a readable catalog row</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{retained.map(uuid => choice(uuid, currentLabels[uuid] ?? (canonicalUuid(uuid) ? 'Unavailable language' : uuid)))}</div></section>}
        {(['common','rare',null] as const).map(rarity => {
            const options = [...byUuid].filter(([,doc]) => languageRarity(doc) === rarity && String(doc.name).toLowerCase().includes(search.toLowerCase()));
            return options.length > 0 && <section key={rarity ?? 'unresolved'} className="mt-4" aria-label={`${rarity ?? 'Unclassified'} languages`}>
                <h3 className="font-bold capitalize">{rarity ?? 'Rarity unavailable'}</h3><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{options.map(([uuid,doc]) => choice(uuid, doc.name))}</div></section>;
        })}
        {data.ready && ![...byUuid.values()].some(doc => String(doc.name).toLowerCase().includes(search.toLowerCase())) && <p className="mt-3 italic">No languages matched.</p>}
    </ModuleDialog>;
}
