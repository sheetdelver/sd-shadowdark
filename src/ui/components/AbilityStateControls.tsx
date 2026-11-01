'use client';

import React, { useState } from 'react';
import { useShadowdarkActor } from '../context/ShadowdarkActorContext';

/** Shared manual state controls for owned native Class Ability Items. */
export default function AbilityStateControls({ itemId }: { itemId: string }) {
    const { actor, updateItem, isActionBusy } = useShadowdarkActor();
    const [saving, setSaving] = useState(false);
    const item = actor.items?.find((entry: any) => String(entry.id ?? entry._id) === itemId);
    const view = actor.derived?.items?.find((entry: any) => entry.id === itemId);
    if (item?.type !== 'Class Ability' || !view) return null;
    const uses = view.uses;
    const validUses = uses?.limited && Number.isSafeInteger(uses.available) && uses.available >= 0
        && Number.isSafeInteger(uses.max) && uses.max >= 0;
    const busy = saving || (view.actionIds ?? []).some((id: string) => isActionBusy(id));
    const save = async (patch: Record<string, unknown>) => {
        setSaving(true);
        try { await updateItem(itemId, patch); }
        finally { setSaving(false); }
    };
    return <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${item.name} state`}>
        {validUses && <span className="flex items-center gap-1" aria-label={`${uses.available} of ${uses.max} uses`}>
            <button type="button" aria-label={`Remove a use of ${item.name}`} className="w-9 h-9 border-2 border-black disabled:opacity-30"
                disabled={busy || uses.available <= 0} onClick={() => save({ 'system.uses.available': uses.available - 1 })}>−</button>
            <span className="font-mono font-bold min-w-[4ch] text-center">{uses.available}/{uses.max}</span>
            <button type="button" aria-label={`Restore a use of ${item.name}`} className="w-9 h-9 border-2 border-black disabled:opacity-30"
                disabled={busy || uses.available >= uses.max} onClick={() => save({ 'system.uses.available': uses.available + 1 })}>+</button>
        </span>}
        <button type="button" aria-pressed={view.lost} disabled={busy} onClick={() => save({ 'system.lost': !view.lost })}
            className="min-h-11 px-3 border-2 border-black text-xs font-bold uppercase disabled:opacity-40">{view.lost ? 'Restore' : 'Mark lost'}</button>
    </div>;
}
