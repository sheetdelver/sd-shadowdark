'use client';

import React, { useRef, useState } from 'react';
import ModuleDialog from './ModuleDialog';
import { ABILITY_KEYS } from '../../logic/actor-preparation';
import { characterEditValues, characterEditPatch, characterEditErrors } from '../../logic/character-edit';

const names: Record<string, string> = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const button = 'min-h-11 border-2 border-black px-4 py-2 font-serif font-bold shadow-[3px_3px_0_0_black] disabled:opacity-40';

/** Deliberate source edits; derived values are context, never input defaults. */
export default function EditCharacterModal({ actor, onClose, onSave }: {
    actor: any;
    onClose: () => void;
    onSave: (patch: Record<string, unknown>) => Promise<boolean>;
}) {
    const [baseline, setBaseline] = useState(() => characterEditValues(actor));
    const [draft, setDraft] = useState(baseline);
    const [saving, setSaving] = useState(false);
    const inFlight = useRef(false);
    const [failure, setFailure] = useState('');
    const latest = characterEditValues(actor);
    const changedElsewhere = JSON.stringify(latest) !== JSON.stringify(baseline);
    const errors = characterEditErrors(draft);
    const patch = characterEditPatch(baseline, draft);
    const allowed = actor.canEdit === true && actor.type === 'Player';
    const close = () => { if (!inFlight.current) onClose(); };
    const save = async () => {
        if (inFlight.current || !allowed || changedElsewhere || Object.keys(errors).length || !Object.keys(patch).length) return;
        inFlight.current = true; setSaving(true); setFailure('');
        try {
            if (await onSave(patch)) onClose();
            else setFailure('Could not confirm the save. Check the current character values before trying again.');
        } catch {
            setFailure('Could not confirm the save. Check the current character values before trying again.');
        } finally { inFlight.current = false; setSaving(false); }
    };
    const input = (key: string, label: string, total?: number) => <div key={key} className="min-w-0">
        <label htmlFor={`sd-edit-${key}`} className="block font-serif font-bold mb-1">{label}</label>
        <input id={`sd-edit-${key}`} type="text" inputMode={key === 'name' ? 'text' : 'numeric'}
            value={draft[key]} disabled={saving || !allowed} data-autofocus={key === 'name' ? true : undefined}
            aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `sd-edit-${key}-error` : undefined}
            className="w-full min-w-0 min-h-11 border-2 border-black bg-white px-2 font-serif font-bold"
            onChange={event => {
                const value = event.target.value;
                if (key !== 'name' && !/^\d*$/.test(value)) return;
                setDraft(previous => ({ ...previous, [key]: value }));
            }} />
        {total !== undefined && <p className="mt-1 text-xs text-neutral-600">Current sheet total: {total}</p>}
        {errors[key] && <p id={`sd-edit-${key}-error`} role="alert" className="text-sm text-red-700 mt-1">{errors[key]}</p>}
    </div>;
    return <ModuleDialog open title="Edit character" onClose={close} footer={<div className="flex flex-wrap gap-3">
        <button type="button" className={button} disabled={saving} onClick={close}>Cancel</button>
        <button type="submit" form="sd-edit-character-form" className={`${button} bg-black text-white`}
            disabled={saving || !allowed || changedElsewhere || !!Object.keys(errors).length || !Object.keys(patch).length}>{saving ? 'Saving…' : 'Save'}</button>
    </div>}>
        <form id="sd-edit-character-form" className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
            {input('name', 'Name')}
            <p className="text-sm">Edit saved base values. Talent, boon and effect bonuses remain separate and are applied to the sheet totals.</p>
            <div className="grid grid-cols-2 gap-4">{ABILITY_KEYS.map(key => input(key, `${names[key]} (base)`, actor.derived?.abilities?.[key]?.value))}</div>
            {input('hp', 'Maximum HP (base)', actor.derived?.hp?.max)}
            <p className="text-sm">Current HP is unchanged. Saving does not heal or damage the character.</p>
            {changedElsewhere && !saving && <div role="alert" className="border-l-4 border-red-600 pl-3 text-sm">
                <p>These character values changed elsewhere. Reload them before saving.</p>
                <button type="button" className={`${button} mt-2`} onClick={() => { setBaseline(latest); setDraft(latest); setFailure(''); }}>Reload values</button>
            </div>}
            {!allowed && <p role="alert">You no longer have permission to edit this character.</p>}
            {failure && <p role="alert" className="text-red-700">{failure}</p>}
        </form>
    </ModuleDialog>;
}
