'use client';

import React, { useState } from 'react';
import { useShadowdarkActor } from '../context/ShadowdarkActorContext';

// User-selected control floor: lowest starting CHA modifier. Cursed Scroll 6
// does not specify a Renown floor or ceiling. Never rewrite existing values on render.
const MIN_RENOWN = -4;

export function RenownControl({ compact = false }: { compact?: boolean }) {
    const { actor, updateActor, getDraftValue } = useShadowdarkActor();
    const [editing, setEditing] = useState<string | null>(null);
    const value = Number(getDraftValue('system.renown', actor.system?.renown ?? 0));
    const set = (next: number, immediate = true) => {
        if (!Number.isSafeInteger(next) || next < MIN_RENOWN) return;
        void updateActor('system.renown', next, { immediate });
    };
    const step = 'w-9 h-9 shrink-0 flex items-center justify-center border-2 border-black font-bold disabled:opacity-30 touch-manipulation';
    return <div className={`sd-renown-control ${compact ? 'flex-1' : 'py-1'}`} role="group" aria-label="Renown">
        <button type="button" className={step} aria-label="Decrease renown" disabled={value <= MIN_RENOWN}
            onClick={() => { setEditing(null); set(value - 1); }}>−</button>
        <input type="text" inputMode="text" aria-label="Renown score" value={editing ?? String(value)}
            className="w-14 h-9 text-center text-xl font-bold border-2 border-black bg-transparent"
            onChange={event => {
                const text = event.target.value;
                if (text === '' || text === '-') { setEditing(text); return; }
                if (!/^-?\d+$/.test(text)) return;
                const next = Number(text);
                if (!Number.isSafeInteger(next) || next < MIN_RENOWN) return;
                setEditing(null); set(next, false);
            }}
            onBlur={() => setEditing(null)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} />
        <button type="button" className={step} aria-label="Increase renown" disabled={!Number.isSafeInteger(value + 1)}
            onClick={() => { setEditing(null); set(value + 1); }}>+</button>
    </div>;
}
