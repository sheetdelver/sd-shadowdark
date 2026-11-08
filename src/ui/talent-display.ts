import { grantSource } from '../logic/spell-grants';
import { readEffect } from '../logic/effects';

export function talentLevelLabel(items: any[]): string {
    const earned = items.filter(item => ['level', 'patronboon'].includes(String(item?.system?.talentClass).toLowerCase()));
    if (!earned.length) return '';
    const levels = [...new Set<number>(earned.map(item => item.system.level).filter(level => Number.isInteger(level) && level >= 0))].sort((a, b) => a - b);
    const unknown = earned.some(item => !Number.isInteger(item.system.level) || item.system.level < 0);
    return `Level${levels.length > 1 ? 's' : ''} gained: ${[...levels, ...(unknown ? ['unknown'] : [])].join(', ')}`;
}

/** Display grouping only. Owned documents/effects and their independent IDs stay intact.
 * Exact native origins and matching choices/effects are required; a shared name
 * alone never merges custom talents. Limited-use abilities remain individual. */
export function groupPaperTalents(views: any[], items: any[]) {
    const groups: { view: any; items: any[] }[] = [];
    const indices = new Map<string, number>();
    for (const view of views) {
        const item = items.find(item => String(item.id ?? item._id) === view.id);
        const source = item && grantSource(item);
        const system = { ...item?.system }; delete system.level;
        const effects = (item?.effects ?? []).map((effect: any) => {
            const normalized = readEffect(effect, { kind: 'item', itemId: view.id }, item);
            return { disabled: normalized.disabled, transfer: normalized.transfer, situational: normalized.situational,
                duration: effect.duration, flags: effect.flags,
                changes: normalized.changes.map(({ key, type, value, phase, priority }) => ({ key, type, value, phase, priority })) };
        });
        const key = source && ['Talent', 'Boon'].includes(view.type) && !view.uses?.limited
            ? JSON.stringify([source, view.name, view.type, view.lost, system, effects]) : null;
        const existing = key ? indices.get(key) : undefined;
        if (existing !== undefined) groups[existing].items.push(item);
        else { if (key) indices.set(key, groups.length); groups.push({ view, items: item ? [item] : [] }); }
    }
    return groups;
}
