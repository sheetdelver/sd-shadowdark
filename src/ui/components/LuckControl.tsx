'use client';

import React from 'react';

import { useShadowdarkActor } from '../context/ShadowdarkActorContext';
import { worldSetting } from '../../logic/world-settings';

/**
 * Native PlayerSD luck: standard mode uses the `luck.available` token; Pulp mode
 * (world setting `shadowdark.usePulpMode`) uses the `luck.remaining` count
 * instead. The mode comes from `worldSetting('usePulpMode')`, which is the native
 * default (off) until Core exposes world settings. Spending luck is not automated.
 */
export function LuckControl({ compact = false, pulpMode }: { compact?: boolean; pulpMode?: boolean }) {
    const { actor, updateActor, getDraftValue } = useShadowdarkActor();
    const pulp = pulpMode ?? worldSetting('usePulpMode').value;
    if (pulp) {
        const remaining = Math.max(0, Number(getDraftValue('system.luck.remaining', actor.system?.luck?.remaining ?? 0)) || 0);
        const set = (value: number) => updateActor('system.luck.remaining', Math.max(0, value), { immediate: true });
        const step = 'w-9 h-9 flex items-center justify-center border-2 border-black font-bold disabled:opacity-30 touch-manipulation';
        return (
            <div className={`flex items-center justify-center gap-2 ${compact ? '' : 'py-1'}`} role="group" aria-label="Luck tokens">
                <button type="button" className={step} aria-label="Spend a luck token" disabled={remaining <= 0} onClick={() => set(remaining - 1)}>−</button>
                <span className="min-w-[2ch] text-center text-xl font-bold" aria-live="polite" aria-label={`${remaining} luck tokens`}>{remaining}</span>
                <button type="button" className={step} aria-label="Gain a luck token" onClick={() => set(remaining + 1)}>+</button>
            </div>
        );
    }
    const available = getDraftValue('system.luck.available', actor.system?.luck?.available === true);
    return (
        <div className={`flex w-full items-center justify-center ${compact ? 'flex-1' : 'py-1'}`}>
            <label className="flex items-center justify-center min-h-11 min-w-11 cursor-pointer">
                <input type="checkbox" className="w-6 h-6 accent-black" checked={available} aria-label="Luck token"
                    onChange={event => updateActor('system.luck.available', event.target.checked, { immediate: true })} />
            </label>
        </div>
    );
}
