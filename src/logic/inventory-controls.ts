import type { ItemView } from './prepared-view';
import { isWand, wandRestUpdates } from './wands';

/**
 * Inventory state controls for an owned Item, following native 4.0.6
 * PlayerSheetSD handlers. The first write targets the item itself; any further
 * writes are the native side effects on other items. Both the inventory row and
 * the resource card use these, so neither re-derives the rules.
 *
 * - Equip (`_onToggleEquipped`): Weapon/Armor only (`canBeEquipped`); toggles
 *   `equipped` and clears `stashed`. Equipping a shield (ArmorSD `isAShield`)
 *   switches equipped two-handed Versatile weapons to one hand and unequips other
 *   two-handed weapons.
 * - Stash (`_onToggleStashed`): physical items; toggles `stashed`, clears `equipped`.
 * - Light (`_toggleLightSource`): native light sources (`system.light.isSource`);
 *   lighting one puts out any other lit source and marks `hasBeenUsed`. Native
 *   scene light, chat card and the light tracker are not run by SheetDelver.
 */
export interface ItemWrite { itemId: string; patch: Record<string, unknown> }
export interface ItemControl { id: 'equip' | 'stash' | 'light' | 'restore-wand'; label: string; pressed: boolean; writes: ItemWrite[]; title?: string }

const idOf = (item: any) => String(item?._id ?? item?.id ?? '');

export function itemControls(items: ItemView[], sourceItems: any[], itemId: string): ItemControl[] {
    const view = items.find(entry => entry.id === itemId);
    const item = sourceItems.find(entry => idOf(entry) === itemId);
    if (!view || !item || !view.physical) return [];
    const controls: ItemControl[] = [];
    const name = item.name ?? 'item';

    const rest = wandRestUpdates(item);
    if (rest) controls.push({ id: 'restore-wand', label: `Restore ${name} after a full rest`, pressed: false,
        writes: [{itemId, patch: rest}], title: 'Restore lost wand spells after completing a full rest. This does not repair a broken wand.' });

    if ((item.type === 'Weapon' && !isWand(item)) || item.type === 'Armor') {
        const equipping = !view.equipped;
        const writes: ItemWrite[] = [{ itemId, patch: { 'system.equipped': equipping, 'system.stashed': false } }];
        if (equipping && item.type === 'Armor' && view.propertyNames.includes('shield')) {
            for (const other of items) {
                const source = sourceItems.find(entry => idOf(entry) === other.id);
                if (other.id === itemId || source?.type !== 'Weapon' || !other.equipped || other.weapon?.baseHandedness !== '2h') continue;
                writes.push({ itemId: other.id, patch: other.propertyNames.includes('versatile') ? { 'system.handedness': '1h' } : { 'system.equipped': false } });
            }
        }
        controls.push({ id: 'equip', label: view.equipped ? `Unequip ${name}` : `Equip ${name}`, pressed: view.equipped, writes,
            title: writes.length > 1 ? 'Native Shadowdark also frees your hands: two-handed weapons switch to one hand (Versatile) or are unequipped.' : undefined });
    }

    controls.push({ id: 'stash', label: view.stashed ? `Retrieve ${name}` : `Stash ${name}`, pressed: view.stashed,
        writes: [{ itemId, patch: { 'system.stashed': !view.stashed, 'system.equipped': false } }] });

    if (view.lightSource) {
        const lit = item.system?.light?.active === true;
        const writes: ItemWrite[] = [];
        if (!lit) {
            for (const other of sourceItems) {
                if (idOf(other) !== itemId && other?.system?.light?.isSource === true && other.system.light.active === true) {
                    writes.push({ itemId: idOf(other), patch: { 'system.light.active': false } });
                }
            }
        }
        const patch: Record<string, unknown> = { 'system.light.active': !lit };
        if (!lit && item.system?.light?.hasBeenUsed !== true) patch['system.light.hasBeenUsed'] = true;
        controls.push({ id: 'light', label: lit ? `Extinguish ${name}` : `Light ${name}`, pressed: lit, writes: [{ itemId, patch }, ...writes],
            title: 'Marks the light lit or unlit (other lit sources go out). SheetDelver does not run native scene light, chat or timers.' });
    }
    return controls;
}
