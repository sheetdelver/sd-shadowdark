'use client';

import React from 'react';

import { useState } from 'react';
import { useSDK, useSDKComponents } from '@sheet-delver/sdk/react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import AddEffectsModal from './components/AddEffectsModal';
import { useShadowdarkActor } from './context/ShadowdarkActorContext';

/**
 * Effects tab over the prepared canonical effect list (`actor.derived.effects`):
 * Actor and Item effects appear once each with their owner, native state and
 * changes. Toggle/edit/delete address the owner-qualified reference.
 */
const status = (effect: any): string => {
    if (effect.disabled) return 'Disabled';
    if (effect.suppressed) return `Suppressed (${effect.suppressionReason})`;
    if (!effect.applies) return 'Not transferred';
    return effect.situational ? 'Active (situational)' : 'Active';
};

export default function EffectsTab() {
    const { resolveImageUrl } = useSDK();
    const { ConfirmationModal } = useSDKComponents();
    const { actor, toggleEffect, deleteEffect, createEffect, updateEffect } = useShadowdarkActor();
    const [effectToDelete, setEffectToDelete] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEffect, setEditingEffect] = useState<any>(null);
    const effects: any[] = [...(actor.derived?.effects ?? [])].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const actorId = String(actor.id ?? actor._id);

    return (
        <div className="space-y-6 pb-20">
            <div className="flex items-center justify-between gap-2 bg-black text-white p-2 shadow-md">
                <h3 className="font-serif font-bold text-xl uppercase tracking-wider">Effects</h3>
                <button type="button" onClick={() => { setEditingEffect(null); setIsModalOpen(true); }}
                    className="flex items-center gap-2 bg-white text-black px-4 min-h-11 font-black uppercase text-xs tracking-wider hover:bg-neutral-200">
                    <Plus size={16} strokeWidth={3} aria-hidden="true" /> Add Effect
                </button>
            </div>
            <ul className="border border-black bg-white divide-y divide-neutral-200">
                {effects.map(effect => (
                    <li key={effect.ref} className="p-2 flex flex-wrap items-start gap-2">
                        <img src={resolveImageUrl(effect.img)} className="w-8 h-8 border border-neutral-400 shrink-0" alt="" />
                        <div className="flex-1 min-w-[12rem]">
                            <div className="font-bold break-words">{effect.name}</div>
                            <div className="text-xs text-neutral-700">{effect.isItemEffect ? `From ${effect.sourceName}` : 'On the character'} · {status(effect)}</div>
                            <ul className="mt-1 text-xs font-mono text-neutral-800 space-y-0.5">
                                {(effect.changes ?? []).map((change: any) => (
                                    <li key={change.index} className="break-all">{change.key} {change.type} {typeof change.value === 'string' ? change.value : JSON.stringify(change.value)}{change.phase !== 'initial' ? ` (${change.phase})` : ''}</li>
                                ))}
                            </ul>
                            {effect.diagnostics?.length > 0 && <p className="text-xs text-amber-900 mt-1">{effect.diagnostics.join(' ')}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                            <button type="button" onClick={() => { setEditingEffect(effect); setIsModalOpen(true); }} aria-label={`Edit ${effect.name}`}
                                className="w-11 h-11 flex items-center justify-center text-neutral-600 hover:text-blue-700"><Edit2 className="w-5 h-5" aria-hidden="true" /></button>
                            <button type="button" onClick={() => toggleEffect(effect.ref, effect.disabled)} aria-pressed={!effect.disabled}
                                aria-label={effect.disabled ? `Enable ${effect.name}` : `Disable ${effect.name}`}
                                className={`w-11 h-11 flex items-center justify-center border-2 font-bold text-xs ${!effect.disabled ? 'bg-black text-white border-black' : 'bg-white text-neutral-600 border-neutral-400'}`}>
                                {effect.disabled ? 'Off' : 'On'}
                            </button>
                            <button type="button" onClick={() => setEffectToDelete(effect)} aria-label={`Delete ${effect.name}`}
                                className="w-11 h-11 flex items-center justify-center text-neutral-600 hover:text-red-700"><Trash2 className="w-5 h-5" aria-hidden="true" /></button>
                        </div>
                    </li>
                ))}
                {effects.length === 0 && <li className="p-4 text-center text-neutral-600 italic">No effects.</li>}
            </ul>

            <ConfirmationModal
                isOpen={!!effectToDelete}
                title="Delete Effect"
                message={effectToDelete ? `Remove "${effectToDelete.name}"${effectToDelete.isItemEffect ? ` from ${effectToDelete.sourceName}` : ''}?` : ''}
                confirmLabel="Delete"
                isDanger
                onConfirm={async () => {
                    const target = effectToDelete;
                    setEffectToDelete(null);
                    if (target) await deleteEffect(target.ref);
                }}
                onCancel={() => setEffectToDelete(null)}
            />

            <AddEffectsModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingEffect(null); }}
                onCreate={createEffect}
                onUpdate={updateEffect}
                initialData={editingEffect}
                actorId={actorId}
            />
        </div>
    );
}
