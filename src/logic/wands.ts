import { LEGACY_WANDS } from '../data/legacy-wands';
import { canonicalUuid, formatUuid, parseUuid, sourceRef } from './identity';

const WAND_STATE = 'flags.shadowdark.sheetDelver.wand';
export function isWand(item: any): boolean {
    if (item?.type === 'Wand') return true;
    if (!['Weapon', 'Basic'].includes(item?.type)) return false;
    const origin = sourceRef(item), uuid = parseUuid(item?.uuid);
    const ref = origin ?? (uuid?.kind === 'compendium' ? uuid : null);
    if (ref) return LEGACY_WANDS.some(row => row.uuid === formatUuid(ref));
    return item.system?.magicItem === true && LEGACY_WANDS.some(row => row.type === item.type
        && row.name === item.name && row.img === item.img && row.description === item.system?.description);
}

export function wandSpells(item: any): Array<{ uuid: string | null; lost: boolean }> {
    if (!isWand(item)) return [];
    if (item.type === 'Wand') return (Array.isArray(item.system?.spells) ? item.system.spells : [])
        .map((entry: any) => ({ ...entry, uuid: canonicalUuid(entry?.uuid), lost: entry?.lost === true }));
    const refs = [...String(item.system?.description ?? '').matchAll(/@UUID\[([^\]]+)\]/g)]
        .map(match => canonicalUuid(match[1]));
    // These exact templates contain only Spell links. Malformed/other-kind links
    // stay unavailable; never substitute a spell name or another source.
    const lost = item.flags?.shadowdark?.sheetDelver?.wand?.lostSpells ?? [];
    return [...new Set(refs)].map(uuid => ({ uuid: uuid && parseUuid(uuid)?.documentType === 'Item' ? uuid : null,
        lost: item.system?.lost === true || (Array.isArray(lost) && lost.includes(uuid)) }));
}

export function wandBroken(item: any): boolean {
    return item.system?.broken === true || (item.type !== 'Wand' && item.flags?.shadowdark?.sheetDelver?.wand?.broken === true);
}

export function wandFailureUpdates(item: any, index: number, critical: boolean): Record<string, unknown> {
    if (item.type === 'Wand') {
        const spells = structuredClone(item.system?.spells ?? []);
        if (spells[index]) spells[index].lost = true;
        return { 'system.spells': spells, 'system.broken': critical || wandBroken(item) };
    }
    const spells = wandSpells(item), uuid = spells[index]?.uuid;
    return { [WAND_STATE]: { ...item.flags?.shadowdark?.sheetDelver?.wand,
        lostSpells: [...new Set([...spells.filter(row => row.lost).map(row => row.uuid), uuid].filter(Boolean))],
        broken: critical || wandBroken(item) } };
}

/** Explicit player acknowledgement of a full rest; never repairs a broken wand. */
export function wandRestUpdates(item: any): Record<string, unknown> | null {
    if (!isWand(item) || wandBroken(item) || !wandSpells(item).some(row => row.lost)) return null;
    if (item.type === 'Wand') return { 'system.spells': item.system.spells.map((row: any) => ({ ...row, lost: false })) };
    return { [WAND_STATE]: { ...item.flags?.shadowdark?.sheetDelver?.wand, lostSpells: [] },
        ...(item.system?.lost === true ? { 'system.lost': false } : {}) };
}
