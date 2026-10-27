'use client';

import React, { useState } from 'react';
import { manualSpellLoss } from '../../logic/spell-loss';
import { useShadowdarkActor } from '../context/ShadowdarkActorContext';

/** Same explicit manual state control on the spell list and owned spell cards. */
export default function SpellLossControl({ itemId }: { itemId: string }) {
    const { actor, updateItem } = useShadowdarkActor();
    const [saving, setSaving] = useState(false);
    const item = actor?.items?.find((entry: any) => String(entry.id ?? entry._id) === itemId);
    if (item?.type !== 'Spell') return null;
    const lost = item.system?.lost === true;
    return <button type="button" aria-pressed={lost} disabled={saving}
        onClick={async () => {
            setSaving(true);
            try { await updateItem(itemId, manualSpellLoss(!lost)); }
            finally { setSaving(false); }
        }}
        className={`min-h-11 px-3 border-2 border-black text-xs font-bold uppercase disabled:opacity-40 ${lost ? 'bg-red-100 text-red-800' : 'bg-white'}`}>
        {saving ? 'Saving…' : lost ? 'Restore' : 'Mark lost'}
    </button>;
}
