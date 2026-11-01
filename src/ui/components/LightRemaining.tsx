import React from 'react';

/** Display native tracker state; never advance or persist a second timer. */
export function LightRemaining({ light }: { light: { active?: boolean; remainingSecs?: unknown } | undefined }) {
    if (light?.active !== true) return null;
    const value = light.remainingSecs;
    let label = 'Time remaining unavailable';
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
        const seconds = Math.ceil(value);
        const minutes = Math.floor(seconds / 60);
        const remainder = seconds % 60;
        label = `${minutes ? `${minutes} min${remainder ? ` ${remainder} sec` : ''}` : `${remainder} sec`} remaining`;
    }
    return <span className="block normal-case font-normal" title="Remaining time reported by Foundry's light tracker">{label}</span>;
}
