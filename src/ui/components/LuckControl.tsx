'use client';

import React from 'react';

import { useShadowdarkActor } from '../context/ShadowdarkActorContext';

/**
 * Native PlayerSD luck: standard mode uses the `luck.available` token; Pulp mode
 * (world setting `shadowdark.usePulpMode`) uses the `luck.remaining` count
 * instead. The mode is the prepared Actor's `derived.luck.mode`, prepared from
 * Core's authoritative world context at the same revision as the rest of the
 * sheet, so both layouts change together when the setting changes. Writes go
 * through the context-fenced luck route. Spending luck is not automated.
 *
 * Presentation (user decision): no visible label in either mode. Pulp off shows
 * only the tick box; Pulp on shows only a number input, with −/+ spinner buttons
 * where there is space (not in the compact paper sheet box). When the setting is
 * unavailable no mode is guessed: an inert placeholder explains why on hover and
 * to assistive technology.
 */
export function LuckControl({ compact = false }: { compact?: boolean }) {
    const { actor, updateLuck, getDraftValue } = useShadowdarkActor();
    const luck = actor.derived?.luck ?? {};
    const mode: 'pulp' | 'standard' | null = luck.mode === 'pulp' || luck.mode === 'standard' ? luck.mode : null;
    if (mode === 'pulp') {
        const remaining = Math.max(0, Number(getDraftValue('system.luck.remaining', actor.system?.luck?.remaining ?? 0)) || 0);
        const set = (value: number, immediate = true) => updateLuck('pulp', Math.max(0, value), { immediate });
        const step = 'w-9 h-9 flex items-center justify-center border-2 border-black font-bold disabled:opacity-30 touch-manipulation';
        const input = (
            <input type="number" min={0} step={1} inputMode="numeric" value={remaining} aria-label="Luck tokens"
                className="w-14 h-9 text-center text-xl font-bold border-2 border-black bg-transparent"
                onChange={event => {
                    const value = Math.floor(Number(event.target.value));
                    if (event.target.value !== '' && Number.isFinite(value)) set(value, false);
                }} />
        );
        return (
            <div className={`flex items-center justify-center gap-2 ${compact ? 'flex-1' : 'py-1'}`} role="group" aria-label="Luck tokens">
                {!compact && <button type="button" className={step} aria-label="Spend a luck token" disabled={remaining <= 0} onClick={() => set(remaining - 1)}>−</button>}
                {input}
                {!compact && <button type="button" className={step} aria-label="Gain a luck token" onClick={() => set(remaining + 1)}>+</button>}
            </div>
        );
    }
    if (mode === 'standard') {
        const available = getDraftValue('system.luck.available', actor.system?.luck?.available === true);
        return (
            <div className={`flex w-full items-center justify-center ${compact ? 'flex-1' : 'py-1'}`}>
                <label className="flex items-center justify-center min-h-11 min-w-11 cursor-pointer">
                    <input type="checkbox" className="w-6 h-6 accent-black" checked={available} aria-label="Luck token"
                        onChange={event => updateLuck('standard', event.target.checked, { immediate: true })} />
                </label>
            </div>
        );
    }
    const reason = typeof luck.unavailableReason === 'string' && luck.unavailableReason
        ? `Luck is unavailable: ${luck.unavailableReason}` : 'Luck is unavailable until the world rules load.';
    return (
        <div className={`flex w-full items-center justify-center ${compact ? 'flex-1' : 'py-1'}`}>
            <span className="min-h-11 min-w-11 flex items-center justify-center text-xl font-bold opacity-40"
                role="img" aria-label={reason} title={reason} data-luck-unavailable="">—</span>
        </div>
    );
}
