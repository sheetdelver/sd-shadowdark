
/**
 * Common sanitization for Shadowdark items to ensure they are compatible
 * with the UI and don't cause Foundry errors during import/update.
 */
export function sanitizeItem(item: any): any {
    if (!item) return item;
    
    const clean = { ...item };

    // These fields drive Sheet Delver's level-up UI and are not Foundry Item data.
    delete clean.action;
    delete clean.config;

    // Standardize internal types to 'Talent' for consistent UI categorization if required 
    // (Existing logic: keeps it for now for compatibility with non-Foundry source data)
    if (clean.type === 'text' || clean.type === 0 || clean.type === 'PatronBoon' || clean.type === 'PatronBoonTwice' || clean.type === 'synthetic') {
        clean.type = 'Talent';
    }

    // Trust the hydrated cache data. Do not strip system fields.
    return clean;
}

/**
 * New ActiveEffect data in the legacy `changes` shape, which Foundry 13 stores and
 * Foundry 14 migrates losslessly to `system.changes`. Foundry assigns the id.
 */
export function createEffect(name: string, icon: string, changes: any[], options: any = {}): any {
    return {
        ...(options._id ? { _id: options._id } : {}),
        name: name,
        img: icon || "icons/svg/aura.svg",
        changes: changes.map(c => ({
            key: c.key,
            mode: c.mode ?? 2, // ADD
            value: String(c.value),
            // null means the change type's default priority, as in native pack data.
            priority: c.priority ?? null
        })),
        disabled: !!options.disabled,
        duration: options.duration || { startTime: null, seconds: null, combat: null, rounds: null, turns: null, startRound: null, startTurn: null },
        origin: options.origin || null,
        transfer: options.transfer !== false,
        flags: {
            shadowdark: {
                sourceName: options.sourceName || "System",
                ...options.flags
            },
            ...options.rootFlags
        },
        statuses: options.statuses || []
    };
}

export function sanitizeItems(items: any[]): any[] {
    if (!Array.isArray(items)) return [];
    return items.map(sanitizeItem);
}
