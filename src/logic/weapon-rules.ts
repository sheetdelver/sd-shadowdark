import { prepareActorCore, prepareItemBasics, type PreparationLookups } from './actor-preparation';
import { prepareNpcAttackAction, prepareWeaponAction, weaponBase } from './actions';
import { slugify } from './foundry';
import { resolveFormula } from './formula';

/**
 * Compatibility facade for callers that hold a raw Actor and one weapon. It runs
 * the same shared preparation as the adapter (actor-preparation + actions); it
 * does not implement separate rules. UI components read the prepared view instead.
 */
export const slug = slugify;

/** Deterministic numeric formula, e.g. 1+floor(@level.value/2); null when unsupported. */
export function numericWeaponEffect(value: unknown, actor: any): number | null {
    const result = resolveFormula(value, actor?.system ?? {});
    return result.ok && result.deterministic ? result.value : null;
}

const lookupsFor = (nameIndex: Record<string, string>): PreparationLookups => ({ propertyName: uuid => nameIndex[uuid] ?? null });

export function weaponProperties(item: any, nameIndex: Record<string, string> = {}): string[] {
    return prepareItemBasics(item, lookupsFor(nameIndex)).propertyNames;
}

/** Native source fields only: no Actor effects, guessed dice or cross-hand fallback. */
export function prepareWeaponBase(item: any, options: { handedness?: string } = {}, nameIndex: Record<string, string> = {}) {
    const basics = prepareItemBasics(item, lookupsFor(nameIndex));
    const base = weaponBase(item, basics, item?.type === 'NPC Attack' ? undefined : options.handedness);
    if (item?.type === 'NPC Attack') {
        const raw = item?.system?.damage?.value;
        const damage = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
        return { properties: basics.propertyNames, handedness: '1h' as const, damage, damagePath: 'system.damage.value',
            warnings: damage ? [] : [`Damage unavailable: system.damage.value is absent or empty on ${item?.name || 'attack'}.`] };
    }
    return { properties: basics.propertyNames, handedness: base.handedness, damage: base.damage, damagePath: base.damagePath,
        warnings: [...base.warnings, ...basics.diagnostics] };
}

export function prepareWeaponAttack(actor: any, item: any, options: { attackType?: string; handedness?: string } = {},
    nameIndex: Record<string, string> = {}) {
    // Preview helper: an item not (yet) on the Actor is evaluated as if owned.
    // Server actions use prepareRequestedAction, which requires the owned item.
    const items: any[] = Array.isArray(actor?.items) ? actor.items : [];
    const id = String(item?._id ?? item?.id ?? '');
    const owner = items.some(entry => String(entry?._id ?? entry?.id ?? '') === id) ? actor : { ...actor, items: [...items, item] };
    const core = prepareActorCore(owner, lookupsFor(nameIndex));
    const action = item?.type === 'NPC Attack' || item?.type === 'NPC Special Attack'
        ? prepareNpcAttackAction(core, item)
        : prepareWeaponAction(core, item, {
            attackType: options.attackType === 'ranged' || options.attackType === 'melee' ? options.attackType : undefined,
            handedness: options.handedness === '2h' || options.handedness === 'two-handed' ? '2h'
                : options.handedness === '1h' || options.handedness === 'one-handed' ? '1h' : undefined,
        });
    const toHit = typeof action.bonus === 'number' ? action.bonus : action.abilityBonus + action.itemBonus + action.talentBonus;
    return {
        attackType: action.attack?.type ?? 'melee', handedness: action.attack?.handedness ?? '1h',
        properties: prepareItemBasics(item, lookupsFor(nameIndex)).propertyNames,
        abilityBonus: action.abilityBonus, itemBonus: action.itemBonus, talentBonus: action.talentBonus, toHit,
        damage: action.damage?.formula ?? null,
        warnings: [...(action.damage?.warnings ?? []), ...action.diagnostics, ...(action.reason ? [action.reason] : [])],
    };
}
