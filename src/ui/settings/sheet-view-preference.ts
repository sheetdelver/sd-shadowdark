import { useSyncExternalStore } from 'react';

export type SheetViewMode = 'simple' | 'advanced';
const KEY = 'shadowdark_view_mode';
const initial = { mode: 'simple' as SheetViewMode, error: null as Error | null };
let snapshot = initial;
const listeners = new Set<() => void>();

function publish(mode: SheetViewMode, error: Error | null = null) {
    if (snapshot.mode === mode && snapshot.error?.message === error?.message) return;
    snapshot = { mode, error };
    listeners.forEach(listener => listener());
}
function read() {
    if (typeof window === 'undefined') return;
    try { publish(window.localStorage.getItem(KEY) === 'advanced' ? 'advanced' : 'simple'); }
    catch { publish(snapshot.mode, new Error('Sheet view preference could not be read in this browser.')); }
}
function change(mode: SheetViewMode, reset = false) {
    try {
        if (reset) window.localStorage.removeItem(KEY);
        else window.localStorage.setItem(KEY, mode);
        publish(mode);
    } catch {
        const error = new Error('Sheet view preference could not be saved in this browser.');
        publish(snapshot.mode, error);
        throw error;
    }
}
function subscribe(listener: () => void) {
    listeners.add(listener);
    const changed = (event: StorageEvent) => { if (event.key === KEY || event.key === null) read(); };
    window.addEventListener('storage', changed);
    read();
    return () => { listeners.delete(listener); window.removeEventListener('storage', changed); };
}
read();

/** Existing site-wide browser key, intentionally independent of world/user. No migration. */
export function useSheetViewPreference() {
    const value = useSyncExternalStore(subscribe, () => snapshot, () => initial);
    return { ...value, set: (mode: SheetViewMode) => change(mode), reset: () => change('simple', true) };
}
