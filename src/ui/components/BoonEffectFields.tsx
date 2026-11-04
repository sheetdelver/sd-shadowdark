import React from 'react';
import { Trash2 } from 'lucide-react';
import { BOON_EFFECT_PRESETS, type BoonEffectRow } from '../../logic/boon-effects';
import { MODE_TO_TYPE } from '../../logic/foundry';

/** The same optional effect rows in custom-boon creation and the treasure builder. */
export default function BoonEffectFields({ value, onChange, errors = {} }: {
    value: BoonEffectRow[]; onChange: (rows: BoonEffectRow[]) => void; errors?: Record<string, string>;
}) {
    const field = 'sd-form-field w-full bg-white border-2 border-black px-2 py-2 text-sm outline-none focus:bg-neutral-50';
    const error = (key: string) => errors[key] ? <p role="alert">{errors[key]}</p> : null;
    const update = (index: number, patch: Partial<BoonEffectRow>) => onChange(value.map((row, i) => i === index ? { ...row, ...patch } : row));
    return <section aria-label="Boon effects" className="space-y-3">
        <h3>Effects</h3>
        <p>Optional mechanical changes. Choose a preset or enter a custom change. Duration and limits remain GM-managed.</p>
        <select aria-label="Add boon effect" className={field} value="" disabled={value.length >= 20} onChange={event => {
            if (event.target.value === 'custom') onChange([...value, { key: '', type: 2, value: '1', label: 'Custom bonus', icon: 'icons/svg/aura.svg' }]);
            else {
                const definition = BOON_EFFECT_PRESETS.find(([id]) => id === event.target.value)?.[1];
                if (definition) onChange([...value, { key: definition.key, type: definition.mode, value: String(definition.value), label: definition.label, icon: definition.icon }]);
            }
        }}>
            <option value="">Add an effect…</option><option value="custom">Custom change</option>
            {BOON_EFFECT_PRESETS.map(([id, definition]) => <option key={id} value={id}>{definition.label}</option>)}
        </select>{error('boon.effects')}
        {value.map((row, index) => {
            const prefix = `boon.effects.${index}`;
            return <div key={index} className="space-y-2 border border-neutral-400 p-3">
                <label className="block">Effect name<input aria-label={`Effect ${index + 1} name`} className={field} value={row.label} maxLength={200} onChange={e => update(index, { label: e.target.value })}/></label>{error(`${prefix}.label`)}
                <label className="block">Key<input aria-label={`Change ${index + 1} key`} className={`${field} font-mono`} value={row.key} maxLength={200} onChange={e => update(index, { key: e.target.value })}/></label>{error(`${prefix}.key`)}
                <label className="block">Operation<select aria-label={`Change ${index + 1} operation`} className={field} value={row.type} onChange={e => update(index, { type: Number(e.target.value) })}>
                    {Object.entries(MODE_TO_TYPE).map(([mode, name]) => <option key={mode} value={mode}>{name[0].toUpperCase() + name.slice(1)}</option>)}
                </select></label>{error(`${prefix}.type`)}
                <label className="block">Value<input aria-label={`Change ${index + 1} value`} className={field} value={row.value} maxLength={1000} onChange={e => update(index, { value: e.target.value })}/></label>{error(`${prefix}.value`)}
                <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center gap-2"><input type="checkbox" aria-label={`Effect ${index + 1} enabled`} checked={!row.disabled} onChange={e => update(index, { disabled: !e.target.checked })}/> Enabled</label>
                    <button type="button" aria-label={`Remove ${row.label}`} className="min-h-11 px-3 border-2 border-black inline-flex items-center gap-2" onClick={() => onChange(value.filter((_, i) => i !== index))}><Trash2 size={16} aria-hidden="true"/>Remove</button>
                </div>{error(prefix)}
            </div>;
        })}
        {!value.length && <p className="text-sm">No mechanical effects configured.</p>}
    </section>;
}
