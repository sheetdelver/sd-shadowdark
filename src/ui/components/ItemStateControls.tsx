'use client';

import React from 'react';
import { useShadowdarkActor } from '../context/ShadowdarkActorContext';
import { QuantityControl } from '../InventoryComponents';
import { itemControls } from '../../logic/inventory-controls';

/**
 * Equip / stash / light and quantity controls for an owned physical Item, shown
 * on its resource card. Rules and side effects come from `itemControls` (native
 * PlayerSheetSD handlers); writes address the exact embedded Item.
 */
const LABELS = { equip: ['Equip', 'Unequip'], stash: ['Stash', 'Retrieve'], light: ['Light', 'Put out'], 'restore-wand': ['Restore after rest', 'Restore after rest'] } as const;

export default function ItemStateControls({ itemId }: { itemId: string }) {
    const { actor, runItemControl, isActionBusy } = useShadowdarkActor();
    const items = actor?.derived?.items ?? [];
    const sourceItems = actor?.items ?? [];
    const view = items.find((entry: any) => entry.id === itemId);
    const item = sourceItems.find((entry: any) => String(entry.id ?? entry._id) === itemId);
    const controls = itemControls(items, sourceItems, itemId);
    if (!view || !item || !controls.length) return null;
    return (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Item state">
            {controls.map(control => (
                <button key={control.id} type="button" aria-pressed={control.pressed} aria-label={control.label} title={control.title}
                    disabled={isActionBusy(`control:${itemId}:${control.id}`)} onClick={() => runItemControl(control)}
                    className={`min-h-11 sm:min-h-9 px-3 border-2 border-black font-bold uppercase tracking-wider text-xs disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 ${control.pressed ? (control.id === 'light' ? 'bg-amber-600 text-white' : 'bg-black text-white') : 'bg-white text-black hover:bg-neutral-200'}`}>
                    {LABELS[control.id][control.pressed ? 1 : 0]}
                </button>
            ))}
            <span className="flex items-center gap-1 ml-auto text-xs font-bold uppercase tracking-wider">
                Qty <QuantityControl itemId={itemId} value={view.quantity} label={item.name} />
            </span>
        </div>
    );
}
