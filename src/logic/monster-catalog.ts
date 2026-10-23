import type { DocumentRef } from './identity';
import { ALIGNMENT_LABELS, MOVE_LABELS } from './resource-cards';

export interface MonsterEntry {
    ref: DocumentRef;
    name: string;
    img?: string;
    fallbackImg?: string;
    source: 'compendium' | 'world';
    sourceId: string;
    sourceLabel: string;
    level: number | null;
    alignment: string | null;
    move: string | null;
    moveNote: string | null;
}
export interface MonsterFilters { source: string; name: string; minLevel: string; maxLevel: string; alignment: string; move: string }
export const EMPTY_MONSTER_FILTERS: MonsterFilters = { source: '', name: '', minLevel: '', maxLevel: '', alignment: '', move: '' };
export function nativeMonsterLevel(value: unknown): number | null {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}
export const alignmentLabel = (value: string | null) => value ? ALIGNMENT_LABELS[value] ?? value : '—';
export const moveLabel = (value: string | null) => value ? MOVE_LABELS[value] ?? value : '—';
export function filterMonsters(entries: MonsterEntry[], filters: MonsterFilters): MonsterEntry[] {
    const min = nativeMonsterLevel(filters.minLevel), max = nativeMonsterLevel(filters.maxLevel);
    return entries.filter(entry => (!filters.source || entry.sourceId === filters.source)
        && entry.name.toLowerCase().includes(filters.name.trim().toLowerCase())
        && (min === null || (entry.level !== null && entry.level >= min))
        && (max === null || (entry.level !== null && entry.level <= max))
        && (!filters.alignment || entry.alignment === filters.alignment)
        && (!filters.move || entry.move === filters.move));
}
