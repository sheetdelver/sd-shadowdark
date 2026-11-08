import React, { useEffect, useState } from 'react';
import ModuleDialog from './ModuleDialog';
import { BOON_TYPE_MAP } from '../../data/talent-effects';
import { buildBoonEffects, boonEffectErrors, type BoonEffectRow } from '../../logic/boon-effects';
import BoonEffectFields from './BoonEffectFields';

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

export default function CustomBoonModal({ isOpen, onClose, onCreate, onUpdate, initialData }: CustomBoonModalProps) {
    const editing = !!initialData;
    const [name, setName] = useState('');
    const [boonType, setBoonType] = useState('blessing');
    const [level, setLevel] = useState(1);
    const [rows, setRows] = useState<BoonEffectRow[]>([]);
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
    const submit = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!name.trim()) { setError('Give the boon a name.'); return; }
        const effectError = Object.values(boonEffectErrors(rows))[0];
        if (!editing && effectError) { setError(effectError); return; }
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
                effects: buildBoonEffects(rows, name),
            });
        }
        setSaving(false);
        if (ok) onClose(); else setError('The boon was not saved. Check the notification for details.');
    };

    const field = 'sd-form-field w-full bg-white border-2 border-black px-2 py-2 text-sm outline-none focus:bg-neutral-50';
    return (
        <ModuleDialog open title={editing ? 'Edit Boon' : 'Create Custom Boon'} onClose={onClose} size="lg" footer={
            <div className="flex justify-between gap-2">
                <button type="button" onClick={onClose} className="min-h-11 px-6 border-2 border-black bg-neutral-200 font-bold uppercase text-xs">Cancel</button>
                <button type="button" onClick={() => submit()} disabled={saving} className="min-h-11 px-6 bg-black text-white font-bold uppercase text-xs disabled:opacity-40">
                    {saving ? 'Saving…' : editing ? 'Save Boon' : 'Create Boon'}
                </button>
            </div>
        }>
            <form onSubmit={submit} className="sd-editor-form space-y-4">
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
                    <BoonEffectFields value={rows} onChange={setRows} errors={boonEffectErrors(rows)} />
                )}
            </form>
        </ModuleDialog>
    );
}
