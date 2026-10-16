import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useSDK } from '@sheet-delver/sdk/react';
import ModuleDialog from './ModuleDialog';
import { NATIVE_PREDEFINED_EFFECTS, NATIVE_REJECTED_PREDEFINED } from '../../data/native-predefined-effects';
import { modeToType } from '../../logic/foundry';

/**
 * Lossless ActiveEffect editor.
 *
 * - Edits every change of an effect (not just the first), with type labels from
 *   Foundry 14 change types (DOWNGRADE and UPGRADE are distinct; CUSTOM is kept).
 * - Saving sends only fields the user changed; the server serializes changes in
 *   the effect's own shape and keeps unknown fields of each entry.
 * - Legacy-shape effects cannot take a phase or SUBTRACT; those options are
 *   disabled with an explanation rather than silently dropped.
 * - New effects come from native 4.0.6 predefined definitions (choices resolved
 *   from declared data) or from explicit custom rows. No native alerts.
 */
interface ChangeRow { index?: number; key: string; type: string; value: string; phase: string; priority: string }

interface AddEffectsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate?: (payload: any) => Promise<boolean>;
    onUpdate?: (ref: string, patch: any) => Promise<boolean>;
    /** Canonical effect from actor.derived.effects when editing. */
    initialData?: any;
    actorId?: string;
}

const TYPES: Array<{ value: string; label: string; v14Only?: boolean }> = [
    { value: 'add', label: 'Add' }, { value: 'multiply', label: 'Multiply' }, { value: 'override', label: 'Override' },
    { value: 'upgrade', label: 'Upgrade (keep higher)' }, { value: 'downgrade', label: 'Downgrade (keep lower)' },
    { value: 'subtract', label: 'Subtract', v14Only: true }, { value: 'custom', label: 'Custom (system hook)' },
];

const KEY_SUGGESTIONS = [...new Set([
    ...Object.values(NATIVE_PREDEFINED_EFFECTS).map(entry => entry.key).filter(key => !key.includes('REPLACEME') && !key.startsWith('system.bonuses')),
    'system.roll.melee.bonus', 'system.roll.ranged.bonus', 'system.roll.attack.bonus', 'system.roll.melee.damage', 'system.roll.ranged.damage',
    'system.roll.attack.damage', 'system.roll.spell.bonus', 'system.roll.stat.bonus.all', 'system.roll.initiative.bonus', 'system.attributes.hp.max',
])].sort();

const display = (value: unknown) => typeof value === 'string' ? value : value === null || value === undefined ? '' : JSON.stringify(value);
const parseValue = (text: string, original: unknown): unknown => {
    if (typeof original === 'number' && text.trim() !== '' && Number.isFinite(Number(text))) return Number(text);
    if (typeof original === 'boolean' && (text === 'true' || text === 'false')) return text === 'true';
    if (original !== null && typeof original === 'object') { try { return JSON.parse(text); } catch { return text; } }
    return text;
};

export default function AddEffectsModal({ isOpen, onClose, onCreate, onUpdate, initialData, actorId }: AddEffectsModalProps) {
    const { resolveImageUrl, fetchWithAuth } = useSDK();
    const editing = !!initialData;
    const legacy = initialData?.shape === 'legacy';
    const [name, setName] = useState('');
    const [img, setImg] = useState('icons/svg/aura.svg');
    const [disabled, setDisabled] = useState(false);
    const [situational, setSituational] = useState(false);
    const [rows, setRows] = useState<ChangeRow[]>([]);
    const [template, setTemplate] = useState('');
    const [choices, setChoices] = useState<Array<{ value: string; label: string }> | null>(null);
    const [choice, setChoice] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const original = useMemo(() => (initialData?.changes ?? []).map((change: any) => ({
        index: change.index, key: change.key, type: change.type, value: display(change.value), phase: change.phase ?? 'initial',
        priority: change.storedPriority === null || change.storedPriority === undefined ? '' : String(change.storedPriority),
    })) as ChangeRow[], [initialData]);

    useEffect(() => {
        if (!isOpen) return;
        setError(null); setSaving(false); setTemplate(''); setChoices(null); setChoice('');
        setName(initialData?.name ?? ''); setImg(initialData?.img ?? 'icons/svg/aura.svg');
        setDisabled(initialData?.disabled === true); setSituational(initialData?.situational === true);
        setRows(editing ? original : []);
    }, [isOpen, initialData, editing, original]);

    const definition = template && template !== 'custom' ? NATIVE_PREDEFINED_EFFECTS[template] : null;
    const needsChoice = !!definition && (definition.key.includes('REPLACEME') || definition.value === 'REPLACEME');

    useEffect(() => {
        if (!needsChoice || !actorId) { setChoices(null); return; }
        let cancelled = false;
        fetchWithAuth(`/api/modules/shadowdark/actors/${actorId}/effects/choices?key=${encodeURIComponent(template)}`)
            .then(res => res.json()).then(data => !cancelled && setChoices(Array.isArray(data?.options) ? data.options : []))
            .catch(() => !cancelled && setChoices([]));
        return () => { cancelled = true; };
    }, [needsChoice, template, actorId, fetchWithAuth]);

    if (!isOpen) return null;

    const updateRow = (position: number, patch: Partial<ChangeRow>) => setRows(prev => prev.map((row, index) => index === position ? { ...row, ...patch } : row));
    const originalValue = (row: ChangeRow) => row.index !== undefined ? initialData?.changes?.find((change: any) => change.index === row.index)?.value : undefined;
    const serializeRows = () => rows.map(row => ({
        ...(row.index !== undefined ? { index: row.index } : {}), key: row.key.trim(), type: row.type,
        value: parseValue(row.value, originalValue(row)), phase: legacy ? undefined : row.phase,
        priority: row.priority.trim() === '' ? null : Number(row.priority),
    }));
    const validate = (): string | null => {
        if (!name.trim() && !definition) return 'Give the effect a name.';
        if (template === 'custom' || editing) {
            if (!rows.length) return 'Add at least one change.';
            for (const [index, row] of rows.entries()) {
                if (!row.key.trim()) return `Change ${index + 1} needs a key.`;
                if (row.key.includes('REPLACEME')) return `Change ${index + 1} still needs a choice.`;
                if (row.priority.trim() && !Number.isFinite(Number(row.priority))) return `Change ${index + 1} has an invalid priority.`;
            }
        }
        if (needsChoice && !choice) return 'Choose a value for this effect.';
        return null;
    };

    const submit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        const problem = validate();
        if (problem) { setError(problem); return; }
        setSaving(true); setError(null);
        let ok = false;
        if (editing && onUpdate) {
            const patch: Record<string, unknown> = {};
            if (name !== initialData.name) patch.name = name;
            if (disabled !== (initialData.disabled === true)) patch.disabled = disabled;
            if (situational !== (initialData.situational === true)) patch.situational = situational;
            if (JSON.stringify(rows) !== JSON.stringify(original)) patch.changes = serializeRows();
            ok = Object.keys(patch).length ? await onUpdate(initialData.ref, patch) : true;
        } else if (onCreate) {
            ok = definition
                ? await onCreate({ predefined: { key: template, choice: choice || undefined }, effect: { name: name || undefined, disabled, situational } })
                : await onCreate({ effect: { name, img, disabled, situational, changes: serializeRows() } });
        }
        setSaving(false);
        if (ok) onClose();
        else setError('The effect was not saved. Check the notification for details.');
    };

    const field = 'w-full bg-white border-2 border-black px-2 py-2 text-sm outline-none focus:bg-neutral-50';
    const showRows = editing || template === 'custom';
    return (
        <ModuleDialog open title={editing ? 'Edit Effect' : 'Add Effect'} subtitle={editing ? `${initialData.sourceName ?? ''}${legacy ? ' · legacy effect shape' : ''}` : undefined}
            onClose={onClose} size="lg" footer={
                <div className="flex flex-wrap justify-between gap-2">
                    <button type="button" onClick={onClose} className="min-h-11 px-6 border-2 border-black bg-neutral-200 font-bold uppercase text-xs">Cancel</button>
                    <button type="button" onClick={() => submit()} disabled={saving || (!editing && !template)}
                        className="min-h-11 px-6 bg-black text-white font-bold uppercase text-xs disabled:opacity-40">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Effect'}</button>
                </div>
            }>
            <form onSubmit={submit} className="space-y-4">
                {error && <p role="alert" className="border-2 border-red-700 bg-red-50 text-red-800 p-2 text-sm font-bold">{error}</p>}
                {!editing && (
                    <label className="block">
                        <span className="block text-xs uppercase tracking-widest font-bold mb-1">Template</span>
                        <select className={field} value={template} data-autofocus onChange={event => {
                            setTemplate(event.target.value); setChoice('');
                            const next = NATIVE_PREDEFINED_EFFECTS[event.target.value];
                            if (next) { setName(next.label); setImg(next.icon); }
                            if (event.target.value === 'custom') setRows([{ key: '', type: 'add', value: '1', phase: 'initial', priority: '' }]);
                        }}>
                            <option value="">Select an effect…</option>
                            <option value="custom">Custom effect</option>
                            <optgroup label="Shadowdark 4.0.6 predefined">
                                {Object.entries(NATIVE_PREDEFINED_EFFECTS).sort(([, a], [, b]) => a.label.localeCompare(b.label)).map(([key, entry]) => (
                                    <option key={key} value={key} disabled={!!NATIVE_REJECTED_PREDEFINED[key] || !!entry.restriction}>
                                        {entry.label}{NATIVE_REJECTED_PREDEFINED[key] ? ' (not supported natively)' : entry.restriction ? ` (${entry.restriction} items only)` : ''}
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                    </label>
                )}
                {definition && (
                    <div className="border-2 border-black p-2 text-sm">
                        <div className="font-mono text-xs break-all">{definition.key} · {modeToType(definition.mode)} · {String(definition.value)}</div>
                        {needsChoice && (
                            <label className="block mt-2">
                                <span className="block text-xs uppercase tracking-widest font-bold mb-1">Choice</span>
                                {choices === null ? <span role="status" className="italic">Loading choices…</span>
                                    : choices.length === 0 ? <span role="alert" className="text-red-800">No choices are available from declared Shadowdark data; this effect cannot be created.</span>
                                        : <select className={field} value={choice} onChange={event => setChoice(event.target.value)}>
                                            <option value="">Choose…</option>
                                            {choices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                                        </select>}
                            </label>
                        )}
                    </div>
                )}
                {(editing || template) && (
                    <div className="flex items-center gap-3">
                        <img src={resolveImageUrl(img)} alt="" className="w-12 h-12 border-2 border-black object-cover" />
                        <label className="flex-1">
                            <span className="block text-xs uppercase tracking-widest font-bold mb-1">Name</span>
                            <input className={field} value={name} onChange={event => setName(event.target.value)} />
                        </label>
                    </div>
                )}
                {(editing || template) && (
                    <div className="flex flex-wrap gap-4">
                        <label className="flex items-center gap-2 min-h-11"><input type="checkbox" className="w-5 h-5" checked={!disabled} onChange={event => setDisabled(!event.target.checked)} /> Enabled</label>
                        <label className="flex items-center gap-2 min-h-11"><input type="checkbox" className="w-5 h-5" checked={situational} onChange={event => setSituational(event.target.checked)} /> Situational (applies to rolls only when selected)</label>
                    </div>
                )}
                {editing && initialData?.suppressionReason && (
                    <p className="text-sm border border-black p-2">Suppressed while its item is {initialData.suppressionReason}; native Shadowdark does not apply it.</p>
                )}
                {showRows && (
                    <fieldset className="space-y-2">
                        <legend className="text-xs uppercase tracking-widest font-bold">Changes</legend>
                        <datalist id="sd-effect-keys">{KEY_SUGGESTIONS.map(key => <option key={key} value={key} />)}</datalist>
                        {rows.map((row, position) => (
                            <div key={position} className="grid grid-cols-1 sm:grid-cols-12 gap-2 border border-neutral-300 p-2">
                                <label className="sm:col-span-5"><span className="sr-only">Key {position + 1}</span>
                                    <input className={`${field} font-mono text-xs`} list="sd-effect-keys" value={row.key} placeholder="system.…" onChange={event => updateRow(position, { key: event.target.value })} /></label>
                                <label className="sm:col-span-3"><span className="sr-only">Type {position + 1}</span>
                                    <select className={field} value={TYPES.some(type => type.value === row.type) ? row.type : row.type} onChange={event => updateRow(position, { type: event.target.value })}>
                                        {TYPES.map(type => <option key={type.value} value={type.value} disabled={type.v14Only && legacy}>{type.label}{type.v14Only && legacy ? ' (Foundry 14 shape only)' : ''}</option>)}
                                        {!TYPES.some(type => type.value === row.type) && <option value={row.type}>{row.type}</option>}
                                    </select></label>
                                <label className="sm:col-span-2"><span className="sr-only">Value {position + 1}</span>
                                    <input className={field} value={row.value} onChange={event => updateRow(position, { value: event.target.value })} /></label>
                                <button type="button" onClick={() => setRows(prev => prev.filter((_, index) => index !== position))}
                                    className="sm:col-span-2 min-h-11 flex items-center justify-center border-2 border-black hover:bg-red-50" aria-label={`Remove change ${position + 1}`}>
                                    <Trash2 size={16} aria-hidden="true" />
                                </button>
                                <label className="sm:col-span-6 text-xs flex items-center gap-2"><span>Phase</span>
                                    <select className={field} disabled={legacy} value={row.phase} onChange={event => updateRow(position, { phase: event.target.value })}>
                                        <option value="initial">Initial</option><option value="final">Final (after derived data)</option>
                                    </select></label>
                                <label className="sm:col-span-6 text-xs flex items-center gap-2"><span>Priority</span>
                                    <input className={field} inputMode="numeric" placeholder="type default" value={row.priority} onChange={event => updateRow(position, { priority: event.target.value })} /></label>
                            </div>
                        ))}
                        {legacy && <p className="text-xs">This effect uses the legacy (Foundry 13) shape, which has no phase or Subtract type.</p>}
                        <button type="button" onClick={() => setRows(prev => [...prev, { key: '', type: 'add', value: '1', phase: 'initial', priority: '' }])}
                            className="min-h-11 px-3 border-2 border-black flex items-center gap-2 text-xs font-bold uppercase"><Plus size={14} aria-hidden="true" /> Add change</button>
                    </fieldset>
                )}
            </form>
        </ModuleDialog>
    );
}
