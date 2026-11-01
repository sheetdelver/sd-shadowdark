'use client';
import { useState, useEffect, useRef } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import { canonicalUuid } from '../../logic/identity';
import { languageRarity, languageInventorySections, validateLanguageInventory, allocateLanguageInventory } from '../../logic/languages';
import { spellReview } from '../../logic/spell-review';
import { useLanguagePlan } from '../hooks/useLanguagePlan';
import { CollectionStatus } from './CollectionStatus';
import ModuleDialog from './ModuleDialog';

interface Props {
    isOpen: boolean; onClose: () => void; onSelect: (selected: string[]) => void | Promise<void>;
    actorId: string; actor?: any; currentLanguages: string[]; currentLabels?: Record<string, string>;
}
export default function LanguageSelectionModal({ isOpen, onClose, onSelect, actorId, actor, currentLanguages, currentLabels = {} }: Props) {
    const { fetchWithAuth } = useSDK();
    const data = useLanguagePlan({ actorId, enabled: isOpen, mode: 'inventory', sourceRevision: actor ? spellReview(actor) : JSON.stringify(currentLanguages) });
    const [search, setSearch] = useState('');
    const [draft, setDraft] = useState<{ key: string; selected: string[] }>({ key: '', selected: [] });
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const scope = useRef(data.key); scope.current = data.key;
    useEffect(() => { setFailure(null); setSaving(false); }, [data.key]);
    useEffect(() => { scope.current = data.key; return () => { scope.current = ''; }; }, [data.key]);
    const plan = data.plan;
    const baseline = plan?.current ?? currentLanguages;
    const key = JSON.stringify([data.key, plan?.review]);
    const selected = draft.key === key ? draft.selected : baseline;
    const rows = data.ready ? data.rows : [];
    const byUuid = new Map(rows.map(doc => [canonicalUuid(doc.uuid), doc]).filter(([uuid]) => !!uuid) as Array<[string, any]>);
    const retained = baseline.filter(uuid => !byUuid.has(uuid));
    const unclassified = [...byUuid].filter(([, doc]) => languageRarity(doc) === null);
    const allocation = plan ? allocateLanguageInventory(plan, selected) : null;
    const granted = actor?.derived?.identity?.grantedLanguages ?? [];
    const validation = plan ? validateLanguageInventory(plan, baseline, selected) : null;
    const change = (uuid: string) => selected.includes(uuid) ? selected.filter(value => value !== uuid) : [...selected, uuid];
    const save = async () => {
        if (!data.ready || !plan?.review || saving || failure || !validation?.valid) return;
        if (JSON.stringify(selected) === JSON.stringify(baseline)) { onClose(); return; }
        const requestScope = data.key;
        setSaving(true);
        try {
            const response = await fetchWithAuth('/api/modules/shadowdark/languages/manage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actorId, languages: selected, review: plan.review, contextRevision: plan.contextRevision }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error?.message ?? result.error ?? 'Languages could not be saved.');
            if (scope.current !== requestScope) return;
            onClose(); await onSelect(selected);
        } catch {
            if (scope.current === requestScope) setFailure('Languages could not be confirmed. Refresh to review the character before saving again.');
        } finally { if (scope.current === requestScope) setSaving(false); }
    };
    const choice = (uuid: string, name: string) => {
        const chosen = selected.includes(uuid);
        const fixed = !!plan?.fixed.includes(uuid);
        const blocked = saving || !!failure || !data.ready || (chosen && fixed) || (!chosen && (!plan || !validateLanguageInventory(plan, baseline, change(uuid)).valid));
        return <button type="button" key={uuid} aria-pressed={chosen} disabled={blocked} onClick={() => setDraft({ key, selected: change(uuid) })}
            className={`sd-language-choice min-h-11 border-2 border-black p-2 text-left disabled:cursor-not-allowed ${chosen ? 'bg-black text-white' : 'bg-white text-black'}`}>
            <span>{name}</span>{(fixed || plan?.suggested?.includes(uuid)) && <span className="sd-choice-note">{fixed ? 'Granted' : 'Ancestry / class default'}</span>}
        </button>;
    };
    return <ModuleDialog open={isOpen} title="Select Languages" onClose={() => !saving && onClose()} size="lg" footer={<div className="flex flex-wrap justify-end gap-3">
        <button type="button" disabled={saving} className="min-h-11 border-2 border-black px-4" onClick={onClose}>Cancel</button>
        <button type="button" className="min-h-11 border-2 border-black bg-black text-white px-4 disabled:opacity-50" disabled={!data.ready || !validation?.valid || saving || !!failure} onClick={save}>{saving ? 'Saving…' : 'Save Languages'}</button>
    </div>}>
        <label className="sd-field-label block">Search languages<input data-autofocus placeholder="Search languages..." className="block w-full min-h-11 border-2 border-black p-2" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <p className="sd-form-help">Customize your languages within the Common and Rare allowances. Deselect a language to make room for another.</p>
        <CollectionStatus state={data} label="Loading language allowances…" />
        {failure && <div role="alert" className="sd-form-notice"><p>{failure}</p><button type="button" onClick={() => { setFailure(null); setDraft({ key: '', selected: [] }); data.retry(); }}>Refresh languages</button></div>}
        {data.ready && plan && languageInventorySections(plan, rows, selected).map(({ kind, count, limit }) => {
            const options = [...byUuid].filter(([, doc]) => languageRarity(doc) === kind && String(doc.name).toLowerCase().includes(search.toLowerCase()));
            return <section key={kind} aria-label={`${kind} languages`} className="mt-4">
                <h3>{kind} ({count}/{limit})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{options.map(([uuid, doc]) => choice(uuid, doc.name))}</div>
                {!options.length && <p className="sd-empty">No matching {kind} languages.</p>}
                {limit !== null && count > limit && <p className="sd-form-notice">Existing languages exceed this allowance. Remove a selection before adding another.</p>}
            </section>;
        })}
        {data.ready && plan?.groups.filter(group => ['ancestry', 'class'].includes(group.id) && group.count > 0).map(group =>
            <p key={group.id} className="sd-form-help">{[...(allocation?.assigned ?? [])].filter(([index]) => allocation?.slots[index].id === group.id).length}/{group.count} shared {group.id} choices selected. {group.options.some(uuid => languageRarity(byUuid.get(uuid)) === 'common') && group.options.some(uuid => languageRarity(byUuid.get(uuid)) === 'rare') ? 'This allowance is shared between Common and Rare; choosing one reduces the space available in the other.' : 'Only languages in this ancestry or class choice pool use these slots.'}</p>)}
        {data.ready && unclassified.length > 0 && <section aria-label="Unclassified languages"><h3>Unclassified languages</h3><p className="sd-form-help">These languages have no known rarity. Only explicit ancestry or class choices can grant them.</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{unclassified.map(([uuid, doc]) => choice(uuid, doc.name))}</div></section>}
        {data.ready && retained.length > 0 && <section aria-label="Other known languages"><h3>Other known languages</h3><p className="sd-form-help">These existing languages are kept unless you remove them.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{retained.map(uuid => choice(uuid, currentLabels[uuid] && !canonicalUuid(currentLabels[uuid]) ? currentLabels[uuid] : (canonicalUuid(uuid) ? 'Unavailable language' : uuid)))}</div></section>}
        {granted.length > 0 && <section aria-label="Effect languages"><h3>From effects</h3><p className="sd-form-help">{granted.map((entry: any) => entry.label ?? 'Unavailable language').join(', ')}. These do not use your choices.</p></section>}
    </ModuleDialog>;
}
