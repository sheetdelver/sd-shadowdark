import React from 'react';

/** Presentation only: zero HP is not a persisted death condition or name edit. */
export function SheetCharacterName({ hp, dark = false, className = '', children }: {
    hp: unknown;
    dark?: boolean;
    className?: string;
    children: React.ReactNode;
}) {
    const atZero = hp === 0;
    return <span className={`sd-sheet-character-name ${className}${atZero ? ` sd-sheet-character-name-zero${dark ? ' sd-sheet-character-name-dark' : ''}` : ''}`}>
        {children}
        {atZero && <span className="shrink-0" role="img" aria-label="At 0 hit points" title="At 0 hit points">(💀)</span>}
    </span>;
}
