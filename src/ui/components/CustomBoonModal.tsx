import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ModuleDialog from './ModuleDialog';
import { NATIVE_PREDEFINED_EFFECTS, NATIVE_REJECTED_PREDEFINED } from '../../data/native-predefined-effects';
import { BOON_TYPE_MAP } from '../../data/talent-effects';
import { createEffect } from '../../utils/Sanitizer';

/**
 * Custom Boon editor.
 *
 * Creating a boon may add changes from native 4.0.6 predefined definitions that
 * need no choice, or explicit custom rows. Editing an existing boon changes only
 * its own fields (name, boon type, level); its ActiveEffects are never rebuilt
 * here — they are edited individually and losslessly from the Effects tab.
 */
interface CustomBoonModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (data: any) => Promise<boolean>;
    onUpdate?: (itemId: string, patch: Record<string, unknown>) => Promise<boolean>;
    initialData?: any;
}

interface Row { key: string; type: number; value: string; label: string; icon: string }

export default function CustomBoonModal({ isOpen, onClose, onCreate, onUpdate, initialData }: CustomBoonModalProps) {
    const editing = !!initialData;
    const [name, setName] = useState('');
    const [boonType, setBoonType] = useState('blessing');
    const [level, setLevel] = useState(1);
    const [rows, setRows] = useState<Row[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setError(null); setSaving(false); setRows([]);
        setName(initialData?.name ?? '');
        setBoonType(initialData?.system?.boonType ?? 'blessing');
        setLevel(Number(initialData?.system?.level ?? 1));
    }, [isOpen, initialData]);

    if (!isOpen) return null;
    const selectable = Object.entries(NATIVE_PREDEFINED_EFFECTS)
        .filter(([key, entry]) => !NATIVE_REJECTED_PREDEFINED[key] && !entry.restriction && !entry.key.includes('REPLACEME') && entry.value !== 'REPLACEME')
        .sort(([, a], [, b]) => a.label.localeCompare(b.label));

    const submit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!name.trim()) { setError('Give the boon a name.'); return; }
        if (rows.some(row => !row.key.trim())) { setError('Every custom change needs a key.'); return; }
        setSaving(true); setError(null);
        let ok: boolean;
        if (editing && onUpdate) {
            const patch: Record<string, unknown> = {};
            if (name !== initialData.name) patch.name = name;
            if (boonType !== initialData.system?.boonType) patch['system.boonType'] = boonType;
            if (level !== Number(initialData.system?.level ?? 0)) patch['system.level'] = level;
            ok = Object.keys(patch).length ? await onUpdate(String(initialData.id ?? initialData._id), patch) : true;
        } else {
            ok = await onCreate({
                name, type: 'Boon', img: 'icons/skills/social/diplomacy-writing-letter.webp',
                system: { boonType, level },
                effects: rows.map(row => createEffect(row.label, row.icon, [{ key: row.key.trim(), mode: row.type, value: row.value }], { sourceName: name })),
            });
        }
        setSaving(false);
        if (ok) onClose(); else setError('The boon was not saved. Check the notification for details.');
    };

    const field = 'w-full bg-white border-2 border-black px-2 py-2 text-sm outline-none focus:bg-neutral-50';
    return (
        <ModuleDialog open title={editing ? 'Edit Boon' : 'Create Custom Boon'} onClose={onClose} size="lg" footer={
            <div className="flex justify-between gap-2">
                <button type="button" onClick={onClose} className="min-h-11 px-6 border-2 border-black bg-neutral-200 font-bold uppercase text-xs">Cancel</button>
                <button type="button" onClick={() => submit()} disabled={saving} className="min-h-11 px-6 bg-black text-white font-bold uppercase text-xs disabled:opacity-40">
                    {saving ? 'Saving…' : editing ? 'Save Boon' : 'Create Boon'}
                </button>
            </div>
        }>
            <form onSubmit={submit} className="space-y-4">
                {error && <p role="alert" className="border-2 border-red-700 bg-red-50 text-red-800 p-2 text-sm font-bold">{error}</p>}
                <label className="block"><span className="block text-xs uppercase tracking-widest font-bold mb-1">Name</span>
                    <input className={field} value={name} data-autofocus onChange={event => setName(event.target.value)} /></label>
                <div className="grid grid-cols-2 gap-3">
                    <label><span className="block text-xs uppercase tracking-widest font-bold mb-1">Boon type</span>
                        <select className={field} value={boonType} onChange={event => setBoonType(event.target.value)}>
                            {Object.entries(BOON_TYPE_MAP).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                        </select></label>
                    <label><span className="block text-xs uppercase tracking-widest font-bold mb-1">Level</span>
                        <input className={field} type="number" min={0} value={level} onChange={event => setLevel(Math.max(0, parseInt(event.target.value) || 0))} /></label>
                </div>
                {editing ? (
                    <p className="text-sm border border-black p-2">This boon has {initialData.effects?.length ?? 0} effect(s). Edit them individually in the Effects tab so their data is preserved.</p>
                ) : (
                    <fieldset className="space-y-2">
                        <legend className="text-xs uppercase tracking-widest font-bold">Effects</legend>
                        <select className={field} value="" onChange={event => {
                            const key = event.target.value;
                            if (key === 'custom') setRows(prev => [...prev, { key: '', type: 2, value: '1', label: 'Custom bonus', icon: 'icons/svg/aura.svg' }]);
                            else if (NATIVE_PREDEFINED_EFFECTS[key]) {
                                const entry = NATIVE_PREDEFINED_EFFECTS[key];
                                setRows(prev => [...prev, { key: entry.key, type: entry.mode, value: String(entry.value), label: entry.label, icon: entry.icon }]);
                            }
                        }}>
                            <option value="">Add an effect…</option>
                            <option value="custom">Custom change</option>
                            {selectable.map(([key, entry]) => <option key={key} value={key}>{entry.label}</option>)}
                        </select>
                        {rows.map((row, position) => (
                            <div key={position} className="grid grid-cols-12 gap-2 items-center border border-neutral-300 p-2">
                                <span className="col-span-12 font-bold text-sm">{row.label}</span>
                                <input className={`${field} col-span-7 font-mono text-xs`} aria-label={`Change ${position + 1} key`} value={row.key}
                                    onChange={event => setRows(prev => prev.map((entry, index) => index === position ? { ...entry, key: event.target.value } : entry))} />
                                <input className={`${field} col-span-3`} aria-label={`Change ${position + 1} value`} value={row.value}
                                    onChange={event => setRows(prev => prev.map((entry, index) => index === position ? { ...entry, value: event.target.value } : entry))} />
                                <button type="button" aria-label={`Remove ${row.label}`} className="col-span-2 min-h-11 border-2 border-black flex items-center justify-center"
                                    onClick={() => setRows(prev => prev.filter((_, index) => index !== position))}><Trash2 size={16} aria-hidden="true" /></button>
                            </div>
                        ))}
                        {rows.length === 0 && <p className="text-xs text-neutral-700 flex items-center gap-1"><Plus size={12} aria-hidden="true" /> A boon may have no mechanical effect.</p>}
                    </fieldset>
                )}
            </form>
        </ModuleDialog>
    );
}
