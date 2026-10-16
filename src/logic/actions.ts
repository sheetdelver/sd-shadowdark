import { ABILITY_KEYS, rollKeyItem, type AbilityKey, type PreparedActorCore, type PreparationLookups, type PreparedItemBasics } from './actor-preparation';
import { finiteNumber, slugify } from './foundry';
import { formatBonus, resolveFormula } from './formula';
import { formatUuid, parseUuid, sourceRef, type DocumentRef } from './identity';
import { getActiveEffectKeys, numericKey, type RollKeyItem, type SituationalOption } from './roll-keys';

/**
 * One typed action preparer for checks, weapon/NPC attacks, spells (owned,
 * scroll, wand, NPC) and Class Abilities, following native 4.0.6 PlayerSD/NpcSD
 * roll-config generators and their pre-roll guards. Both sheet layouts, cards,
 * dialog defaults and the server execute the same preparation. Unsupported
 * situations are explicit (`available: false` with a reason); there is no
 * generic d20 fallback.
 */
export type ActionKind = 'attack' | 'spell' | 'ability' | 'check' | 'potion';

export interface ActionRequest {
    kind: ActionKind;
    itemId?: string;
    /** Wand spell index or scroll (0); owned spells omit it. */
    spellIndex?: number;
    stat?: AbilityKey;
    attackType?: 'melee' | 'ranged';
    handedness?: '1h' | '2h';
    selected?: readonly string[];
}

export interface ActionDamage { formula: string | null; base: string | null; label: 'Damage' | 'Healing'; warnings: string[] }

export interface ActionConsequence {
    when: 'failure' | 'always' | 'critical-failure' | 'before-roll';
    description: string;
}

export interface PreparedAction {
    id: string;
    kind: ActionKind;
    label: string;
    title: string;
    itemId: string | null;
    spell: { ref: DocumentRef | null; itemId: string | null; name: string; tier: number | null; index: number | null } | null;
    available: boolean;
    reason: string | null;
    ability: AbilityKey | null;
    abilityBonus: number;
    itemBonus: number;
    talentBonus: number;
    /** Full main-roll bonus; a string when an effect contributes dice. */
    bonus: number | string;
    advantage: number;
    dc: number | null;
    critical: { success: number; failure: number; multiplier: number };
    damage: ActionDamage | null;
    /**
     * `mode` names this attack among the item's attack modes (Melee, Ranged,
     * Thrown, plus the grip for Versatile weapons); `modes` is how many the item has.
     */
    attack: { type: 'melee' | 'ranged'; handedness: '1h' | '2h' | null; ranges: string[]; count: number | null; special: string | null; mode: string; modes: number } | null;
    situational: SituationalOption[];
    consequences: ActionConsequence[];
    diagnostics: string[];
    request: ActionRequest;
}

const DAMAGE_DICE = ['d2', 'd4', 'd6', 'd8', 'd10', 'd12'];

/** Native dice.upgradeDie over CONFIG.SHADOWDARK.WEAPON_BASE_DAMAGE_DIE_ONLY. */
export function upgradeDie(die: string, modifier: number): string {
    const index = DAMAGE_DICE.indexOf(die);
    if (index === -1) return die;
    return DAMAGE_DICE[Math.max(0, Math.min(DAMAGE_DICE.length - 1, index + modifier))];
}

function empty(kind: ActionKind, id: string, request: ActionRequest, label: string, itemId: string | null = null): PreparedAction {
    return {
        id, kind, label, title: label, itemId, spell: null, available: true, reason: null, ability: null,
        abilityBonus: 0, itemBonus: 0, talentBonus: 0, bonus: 0, advantage: 0, dc: null,
        critical: { success: 20, failure: 1, multiplier: 2 }, damage: null, attack: null, situational: [],
        consequences: [], diagnostics: [], request,
    };
}

/** Native guards stop at the first failure, so the first reason is kept. */
function unavailable(action: PreparedAction, reason: string): PreparedAction {
    action.available = false;
    action.reason ??= reason;
    return action;
}

const basicsFor = (core: PreparedActorCore, item: any): PreparedItemBasics | undefined =>
    core.items.find(entry => entry.id === String(item?._id ?? item?.id ?? ''));

/** Split a numeric bonus into ability + item-owned + other effect contributions. */
function splitBonus(action: PreparedAction, abilityMod: number, result: ReturnType<typeof getActiveEffectKeys>, ownerItemId: string | null) {
    action.abilityBonus = abilityMod;
    action.bonus = result.value;
    const numeric = typeof result.value === 'number';
    const itemPart = ownerItemId ? result.changes.filter(change => change.type === 'add' && change.ownerItemId === ownerItemId
        && typeof change.value === 'number').reduce((sum, change) => sum + (change.value as number), 0) : 0;
    const multiplied = result.changes.some(change => change.type !== 'add');
    if (numeric && !multiplied) {
        action.itemBonus = itemPart;
        action.talentBonus = (result.value as number) - abilityMod - itemPart;
    } else if (numeric) {
        action.talentBonus = (result.value as number) - abilityMod;
    } else {
        // Dice contributions remain in `bonus`; numeric fields hold the deterministic part.
        action.talentBonus = result.changes.filter(change => change.type === 'add' && typeof change.value === 'number')
            .reduce((sum, change) => sum + (change.value as number), 0);
    }
}

function criticalConfig(core: PreparedActorCore, rollData: unknown, key: string, item: RollKeyItem | null, action: PreparedAction, config: { selected?: readonly string[]; thisItemId?: string | null }) {
    const read = (suffix: string, base: number) => {
        const result = getActiveEffectKeys(core.effects, rollData, `roll.${key}.${suffix}`, base, item, config);
        action.diagnostics.push(...result.diagnostics);
        mergeSituational(action, result.situational);
        return numericKey(result, suffix) ?? base;
    };
    action.critical = { success: read('critical-success', 20), failure: read('critical-failure', 1), multiplier: read('critical-multiplier', 2) };
}

function mergeSituational(action: PreparedAction, options: SituationalOption[]) {
    for (const option of options) if (!action.situational.some(existing => existing.ref === option.ref)) action.situational.push(option);
}

/** PlayerSD._calcDamageConfig for weapons and spells. */
function damageConfig(core: PreparedActorCore, rollData: unknown, key: string, base: string, item: RollKeyItem,
    action: PreparedAction, config: { selected?: readonly string[]; thisItemId?: string | null }): ActionDamage {
    const warnings: string[] = [];
    const read = (suffix: string, value: number | string) => {
        const result = getActiveEffectKeys(core.effects, rollData, `roll.${key}.${suffix}`, value, item, config);
        warnings.push(...result.diagnostics);
        mergeSituational(action, result.situational);
        return result;
    };
    let formula = base;
    const upgrade = numericKey(read('upgrade-damage-die', 0), 'upgrade-damage-die');
    if (upgrade) formula = upgradeDie(formula, upgrade);
    const extra = read('extra-damage-die', 0);
    if (extra.value) {
        const die = /^[dD](\d*)/.exec(formula)?.[1];
        if (die) formula = `${formula}+${extra.value}d${die}`;
        else warnings.push(`Extra damage die cannot extend "${formula}"; native requires a base die such as d8.`);
    }
    const damage = read('damage', formula);
    const resolved = resolveFormula(damage.value, rollData);
    if (!resolved.ok) {
        warnings.push(`Damage formula is unsupported: ${resolved.reason}`);
        return { formula: null, base, label: 'Damage', warnings };
    }
    return { formula: String(resolved.value), base, label: 'Damage', warnings };
}

/** WeaponSD.prepareBaseData + getDamageFormula. */
export function weaponBase(item: any, basics: PreparedItemBasics | undefined, handedness?: string) {
    const system = item?.system ?? {};
    const twoHanded = (basics?.propertyNames ?? []).includes('two-handed')
        || (system.damage?.oneHanded === '' && system.damage?.twoHanded !== '' && system.damage?.twoHanded !== undefined);
    const prepared = system.handedness === '1h' || system.handedness === '2h' ? system.handedness : twoHanded ? '2h' : '1h';
    const hands: '1h' | '2h' = (handedness ?? prepared) === '2h' ? '2h' : '1h';
    const path = `system.damage.${hands === '2h' ? 'twoHanded' : 'oneHanded'}`;
    const raw = system.damage?.[hands === '2h' ? 'twoHanded' : 'oneHanded'];
    const damage = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    const warnings = damage ? [] : [`Damage unavailable: ${path} is absent or empty on ${item?.name || 'weapon'}.`];
    return { handedness: hands, preparedHandedness: prepared as '1h' | '2h', damage, damagePath: path, warnings };
}

export interface WeaponAttackMode { attackType: 'melee' | 'ranged'; handedness: '1h' | '2h'; label: string }

/**
 * Attack modes of a Weapon, following native 4.0.6: the weapon's own type
 * (`PlayerSD.getAttacks`), an added ranged attack when it is Thrown, and for a
 * Versatile weapon both grips (`WeaponSD.getDamageFormula`), the stored grip
 * (`system.handedness`) first. Native rolls one grip at a time and toggles it
 * on the sheet; SheetDelver offers each grip as its own labelled attack.
 */
export function weaponAttackModes(core: PreparedActorCore, item: any): WeaponAttackMode[] {
    const basics = basicsFor(core, item);
    const properties = basics?.propertyNames ?? [];
    const own: 'melee' | 'ranged' = item?.system?.type === 'ranged' ? 'ranged' : 'melee';
    const types: Array<'melee' | 'ranged'> = own === 'melee' && properties.includes('thrown') ? ['melee', 'ranged'] : [own];
    const stored = weaponBase(item, basics).handedness;
    const versatile = properties.includes('versatile');
    const grips: Array<'1h' | '2h'> = versatile ? [stored, stored === '1h' ? '2h' : '1h'] : [stored];
    const typeLabel = (type: 'melee' | 'ranged') => type === 'melee' ? 'Melee' : own === 'melee' ? 'Thrown' : 'Ranged';
    return types.flatMap(attackType => grips.map(handedness => ({
        attackType, handedness,
        label: versatile ? `${typeLabel(attackType)}, ${handedness === '2h' ? 'two-handed' : 'one-handed'}` : typeLabel(attackType),
    })));
}

export function prepareWeaponAction(core: PreparedActorCore, item: any, request: Partial<ActionRequest> = {}): PreparedAction {
    const basics = basicsFor(core, item);
    const itemId = basics?.id ?? String(item?._id ?? item?.id ?? '');
    const type: 'melee' | 'ranged' = request.attackType ?? (item?.system?.type === 'ranged' ? 'ranged' : 'melee');
    const base = weaponBase(item, basics, request.handedness);
    const modes = weaponAttackModes(core, item);
    const mode = modes.find(entry => entry.attackType === type && entry.handedness === base.handedness);
    const name = item?.name ?? 'Weapon';
    const full: ActionRequest = { kind: 'attack', itemId, attackType: type, handedness: base.handedness, selected: request.selected };
    const action = empty('attack', `attack:${itemId}:${type}:${base.handedness}`, full,
        modes.length > 1 && mode ? `${name} (${mode.label})` : `${name} Attack`, itemId);
    action.attack = { type, handedness: base.handedness, ranges: item?.system?.range ? [item.system.range] : [], count: null, special: null,
        mode: mode?.label ?? (type === 'ranged' ? 'Ranged' : 'Melee'), modes: modes.length };
    if (core.kind !== 'Player') return unavailable(action, 'Weapon items are Player attacks; NPCs attack with NPC Attack items.');
    if (!basics) return unavailable(action, 'The weapon is not on this Actor.');
    if (!mode) return unavailable(action, `${name} has no ${type} ${base.handedness === '2h' ? 'two-handed' : 'one-handed'} attack.`);
    const shield = core.items.find(entry => entry.type === 'Armor' && entry.equipped && entry.propertyNames.includes('shield'));
    if (base.handedness === '2h' && modes.some(entry => entry.handedness === '1h') && shield) {
        return unavailable(action, `A two-handed grip needs both hands; ${shield.name || 'a shield'} is equipped.`);
    }
    const rollData = buildRoll(core);
    const keyItem = rollKeyItem(item, basics);
    const config = { selected: request.selected, thisItemId: itemId };
    const str = core.abilities.str.mod, dex = core.abilities.dex.mod;
    const ability: AbilityKey = type === 'ranged' ? 'dex' : basics.propertyNames.includes('finesse') && dex > str ? 'dex' : 'str';
    action.ability = ability;
    const bonus = getActiveEffectKeys(core.effects, rollData, `roll.${type}.bonus`, core.abilities[ability].mod, keyItem, config);
    action.diagnostics.push(...bonus.diagnostics);
    mergeSituational(action, bonus.situational);
    splitBonus(action, core.abilities[ability].mod, bonus, itemId);
    criticalConfig(core, rollData, type, keyItem, action, config);
    const advantage = getActiveEffectKeys(core.effects, rollData, `roll.${type}.advantage`, 0, keyItem, config);
    mergeSituational(action, advantage.situational);
    action.advantage = numericKey(advantage, 'advantage') ?? 0;
    action.damage = base.damage
        ? damageConfig(core, rollData, type, base.damage, keyItem, action, config)
        : { formula: null, base: null, label: 'Damage', warnings: base.warnings };
    if (!basics.equipped) action.diagnostics.push('Native attack lists include equipped weapons only.');
    if (item?.system?.ammoClass) {
        action.consequences.push({ when: 'before-roll', description:
            'Native automatic ammunition use depends on the world setting autoConsumeAmmunition, which SheetDelver cannot read; ammunition is not consumed.' });
    }
    return action;
}

/** NpcSD._generateAttackConfig: the attack's own bonus/damage, no Player modifiers. */
export function prepareNpcAttackAction(core: PreparedActorCore, item: any): PreparedAction {
    const system = item?.system ?? {};
    const itemId = String(item?._id ?? item?.id ?? '');
    const ranges: string[] = Array.isArray(system.ranges) ? system.ranges : [];
    const type: 'melee' | 'ranged' = (ranges[0] ?? 'close') === 'close' ? 'melee' : 'ranged';
    const request: ActionRequest = { kind: 'attack', itemId, attackType: type };
    const action = empty('attack', `attack:${itemId}:${type}`, request, `${item?.name ?? 'Attack'} Attack`, itemId);
    const count = finiteNumber(system.attack?.num);
    action.attack = { type, handedness: null, ranges, count, special: system.damage?.special || null, mode: type === 'ranged' ? 'Ranged' : 'Melee', modes: 1 };
    if (item?.type === 'NPC Special Attack') {
        action.itemBonus = finiteNumber(system.bonuses?.attackBonus) ?? 0;
        action.bonus = action.itemBonus;
        action.damage = null;
        return action;
    }
    action.itemBonus = finiteNumber(system.bonuses?.attackBonus) ?? 0;
    action.bonus = action.itemBonus;
    const critical = system.bonuses?.critical;
    if (critical) action.critical = {
        success: finiteNumber(critical.successThreshold) ?? 20, failure: finiteNumber(critical.failureThreshold) ?? 1,
        multiplier: finiteNumber(critical.multiplier) ?? 2,
    };
    const value = typeof system.damage?.value === 'string' && system.damage.value.trim() ? system.damage.value.trim() : null;
    action.damage = value
        ? { formula: `${value}${formatBonus(finiteNumber(system.bonuses?.damageBonus) ?? 0)}`, base: value, label: 'Damage', warnings: [] }
        : { formula: null, base: null, label: 'Damage', warnings: [`Damage unavailable: system.damage.value is absent or empty on ${item?.name || 'attack'}.`] };
    return action;
}

const buildRoll = (core: PreparedActorCore) => ({
    ...core.effective,
    abilities: Object.fromEntries(ABILITY_KEYS.map(key => [key, { ...(core.effective.abilities?.[key] ?? {}), ...core.abilities[key] }])),
});

/** ActorBaseSD._generateStatCheckConfig. */
export function prepareCheckAction(core: PreparedActorCore, stat: AbilityKey, request: Partial<ActionRequest> = {}): PreparedAction {
    const full: ActionRequest = { kind: 'check', stat, selected: request.selected };
    const action = empty('check', `check:${stat}`, full, `${stat.toUpperCase()} Check`);
    if (!ABILITY_KEYS.includes(stat)) return unavailable(action, `Unknown ability ${stat}.`);
    const rollData = buildRoll(core);
    const config = { selected: request.selected };
    action.ability = stat;
    const bonus = getActiveEffectKeys(core.effects, rollData, `roll.stat.bonus.${stat}`, core.abilities[stat].mod, null, config);
    action.diagnostics.push(...bonus.diagnostics);
    mergeSituational(action, bonus.situational);
    splitBonus(action, core.abilities[stat].mod, bonus, null);
    const advantage = getActiveEffectKeys(core.effects, rollData, `roll.stat.advantage.${stat}`, 0, null, config);
    mergeSituational(action, advantage.situational);
    action.advantage = numericKey(advantage, 'advantage') ?? 0;
    return action;
}

export interface SpellSource { spell: any | null; ref: DocumentRef | null; itemId: string | null; lost: boolean; index: number | null }

/** Spells a triggering item can cast: an owned Spell, a Scroll's spellUuid or each Wand entry. */
export function spellSources(item: any, lookups: PreparationLookups): SpellSource[] {
    const system = item?.system ?? {};
    const itemId = String(item?._id ?? item?.id ?? '');
    if (item?.type === 'Spell') return [{ spell: item, ref: sourceRef(item), itemId, lost: system.lost === true, index: null }];
    const resolve = (value: unknown) => {
        const ref = parseUuid(value);
        return { ref, spell: ref ? lookups.spellDocument?.(ref) ?? null : null };
    };
    if (item?.type === 'Scroll') {
        const { ref, spell } = resolve(system.spellUuid);
        return [{ spell, ref, itemId: null, lost: false, index: 0 }];
    }
    if (item?.type === 'Wand') {
        return (Array.isArray(system.spells) ? system.spells : []).map((entry: any, index: number) => {
            const { ref, spell } = resolve(entry?.uuid);
            return { spell, ref, itemId: null, lost: entry?.lost === true, index };
        });
    }
    return [];
}

/** PlayerSD._getSpellcastingAbility over declared class documents. */
function spellcastingAbility(core: PreparedActorCore, spell: any, viaItem: boolean, lookups: PreparationLookups, ownedClasses: any[]): { ability: AbilityKey | null; reason: string | null } {
    const spellcasting = core.spellcasting as { classes: string[]; allowAllItems: boolean; itemAbility: string };
    if (viaItem && spellcasting.itemAbility) return { ability: spellcasting.itemAbility as AbilityKey, reason: null };
    const classRefs: unknown[] = Array.isArray(spell?.system?.class) ? spell.system.class : [];
    const unresolved: string[] = [];
    let classes = classRefs.flatMap(value => {
        const ref = parseUuid(value);
        if (!ref) { unresolved.push(String(value)); return []; }
        const doc = lookups.classDocument?.(ref) ?? ownedClasses.find(owned => {
            const source = sourceRef(owned);
            return source && formatUuid(source) === formatUuid(ref);
        }) ?? null;
        if (!doc) { unresolved.push(formatUuid(ref)); return []; }
        const ability = doc.system?.spellcasting?.ability;
        return ability ? [{ name: slugify(doc.name ?? ''), ability: ability as AbilityKey }] : [];
    });
    if (!classes.length) {
        return { ability: null, reason: unresolved.length
            ? `Spell class ${unresolved.join(', ')} is not available from declared Shadowdark data.`
            : 'The spell names no casting class.' };
    }
    const allowAll = viaItem && spellcasting.allowAllItems;
    if (!allowAll) {
        classes = classes.filter(entry => spellcasting.classes.includes(entry.name));
        if (!classes.length) return { ability: null, reason: 'None of the spell\'s classes is one of this character\'s spellcasting classes.' };
        if (classes.length === 1) return { ability: classes[0].ability, reason: null };
    }
    let best = classes[0];
    for (const entry of classes) if ((core.abilities[entry.ability]?.mod ?? -99) > (core.abilities[best.ability]?.mod ?? -99)) best = entry;
    return { ability: best.ability, reason: null };
}

export function prepareSpellAction(core: PreparedActorCore, triggering: any, source: SpellSource, lookups: PreparationLookups,
    ownedItems: any[] = [], request: Partial<ActionRequest> = {}): PreparedAction {
    const itemId = String(triggering?._id ?? triggering?.id ?? '');
    const spell = source.spell;
    const name = spell?.name ?? (source.ref ? formatUuid(source.ref) : 'Unknown spell');
    const full: ActionRequest = { kind: 'spell', itemId, spellIndex: source.index ?? undefined, selected: request.selected };
    const action = empty('spell', `spell:${itemId}${source.index !== null ? `:${source.index}` : ''}`, full, `Cast ${name}`, itemId);
    const tier = finiteNumber(spell?.system?.tier) ?? (finiteNumber(spell?.system?.dc) !== null ? Number(spell.system.dc) - 10 : null);
    action.spell = { ref: source.ref, itemId: source.itemId, name, tier, index: source.index };
    if (!spell) {
        return unavailable(action, source.ref
            ? `Spell ${formatUuid(source.ref)} is not available from declared Shadowdark data.`
            : 'This item has no linked spell.');
    }
    action.dc = tier !== null ? tier + 10 : null;
    if (action.dc === null) action.diagnostics.push('The spell has no tier, so its DC is unavailable.');
    const triggerType = triggering?.type;
    if (triggerType === 'Wand' && triggering?.system?.broken) return unavailable(action, 'The wand is broken.');
    if (spell.system?.lost === true || source.lost) unavailable(action, 'The spell is lost.');
    const rollData = buildRoll(core);
    const keyItem: RollKeyItem = { id: source.itemId ?? itemId, name: spell.name ?? '', propertyNames: [] };
    const config = { selected: request.selected, thisItemId: itemId };
    const formula = typeof spell.system?.formula === 'string' ? spell.system.formula.trim() : '';
    const damageType = spell.system?.damageType ?? 'none';

    if (core.kind === 'NPC') {
        const spellcasting = core.spellcasting as { bonus: number };
        const bonus = getActiveEffectKeys(core.effects, rollData, 'system.roll.spell.bonus', spellcasting.bonus, keyItem, config);
        action.diagnostics.push(...bonus.diagnostics);
        mergeSituational(action, bonus.situational);
        action.abilityBonus = 0;
        action.bonus = bonus.value;
        action.talentBonus = typeof bonus.value === 'number' ? bonus.value : spellcasting.bonus;
        const advantage = getActiveEffectKeys(core.effects, rollData, 'system.roll.spell.advantage', 0, keyItem, config);
        action.advantage = numericKey(advantage, 'advantage') ?? 0;
        if (formula && damageType !== 'none') action.damage = { formula, base: formula, label: damageType === 'healing' ? 'Healing' : 'Damage', warnings: [] };
        action.consequences.push({ when: 'failure', description: 'On failure the spell is lost.' });
        return action;
    }
    if (core.kind !== 'Player') return unavailable(action, 'Only Player and NPC Actors cast spells.');

    const spellcasting = core.spellcasting as { classes: string[]; allowAllItems: boolean };
    let canCast = spellcasting.classes.length > 0;
    if (triggerType !== 'Spell' && spellcasting.allowAllItems) canCast = true;
    if (!canCast) return unavailable(action, 'This character is not a spellcaster.');
    const owned = ownedItems.filter(entry => entry?.type === 'Class');
    const casting = spellcastingAbility(core, spell, true, lookups, owned);
    if (!casting.ability) return unavailable(action, casting.reason ?? 'Unable to determine the casting ability.');
    action.ability = casting.ability;
    if (formula && damageType !== 'none') {
        action.damage = damageConfig(core, rollData, 'spell', formula, keyItem, action, config);
        if (damageType === 'healing') action.damage.label = 'Healing';
    }
    const bonus = getActiveEffectKeys(core.effects, rollData, 'system.roll.spell.bonus', core.abilities[casting.ability].mod, keyItem, config);
    action.diagnostics.push(...bonus.diagnostics);
    mergeSituational(action, bonus.situational);
    splitBonus(action, core.abilities[casting.ability].mod, bonus, itemId);
    const advantage = getActiveEffectKeys(core.effects, rollData, 'system.roll.spell.advantage', 0, keyItem, config);
    mergeSituational(action, advantage.situational);
    action.advantage = numericKey(advantage, 'advantage') ?? 0;
    criticalConfig(core, rollData, 'spell', keyItem, action, config);
    if (triggerType === 'Spell') action.consequences.push({ when: 'failure', description: 'On failure the spell is lost unless this is a focus check.' });
    else if (triggerType === 'Scroll') action.consequences.push({ when: 'always', description: 'The scroll is consumed whatever the result.' });
    else if (triggerType === 'Wand') {
        action.consequences.push({ when: 'failure', description: 'On failure this wand spell is lost.' });
        action.consequences.push({ when: 'critical-failure', description: 'A critical failure also breaks the wand.' });
    }
    return action;
}

/** PlayerSD.useAbility + _generateAbilityConfig for Class Abilities. */
export function prepareAbilityAction(core: PreparedActorCore, item: any, request: Partial<ActionRequest> = {}): PreparedAction {
    const system = item?.system ?? {};
    const itemId = String(item?._id ?? item?.id ?? '');
    const full: ActionRequest = { kind: 'ability', itemId, selected: request.selected };
    const action = empty('ability', `ability:${itemId}`, full, `Use ${item?.name ?? 'Ability'}`, itemId);
    if (core.kind !== 'Player') return unavailable(action, 'Class Abilities are used by Player Actors.');
    if (system.lost === true) return unavailable(action, 'The ability is lost.');
    if (system.limitedUses === true) {
        if ((finiteNumber(system.uses?.available) ?? 0) <= 0) return unavailable(action, 'No uses remain.');
        action.consequences.push({ when: 'before-roll', description: 'Uses one of the remaining uses.' });
    }
    const ability = system.ability as AbilityKey;
    if (!ability) {
        action.dc = null;
        action.diagnostics.push('This ability has no check; using it posts it to chat.');
        return action;
    }
    if (!ABILITY_KEYS.includes(ability)) return unavailable(action, `Unknown ability ${String(system.ability)}.`);
    const rollData = buildRoll(core);
    const basics = basicsFor(core, item);
    const keyItem: RollKeyItem = { id: itemId, name: item?.name ?? '', propertyNames: basics?.propertyNames ?? [] };
    const config = { selected: request.selected, thisItemId: itemId };
    action.ability = ability;
    action.dc = finiteNumber(system.dc) ?? 10;
    const bonus = getActiveEffectKeys(core.effects, rollData, 'roll.ability.bonus', core.abilities[ability].mod, keyItem, config);
    action.diagnostics.push(...bonus.diagnostics);
    mergeSituational(action, bonus.situational);
    splitBonus(action, core.abilities[ability].mod, bonus, itemId);
    const advantage = getActiveEffectKeys(core.effects, rollData, 'system.roll.ability.advantage', 0, keyItem, config);
    action.advantage = numericKey(advantage, 'advantage') ?? 0;
    if (system.loseOnFailure ?? true) action.consequences.push({ when: 'failure', description: 'On failure the ability is lost.' });
    return action;
}

/** PlayerSD.usePotion: identify if needed, post, then delete. No roll. */
export function preparePotionAction(core: PreparedActorCore, item: any): PreparedAction {
    const itemId = String(item?._id ?? item?.id ?? '');
    const action = empty('potion', `potion:${itemId}`, { kind: 'potion', itemId }, `Drink ${item?.name ?? 'Potion'}`, itemId);
    if (core.kind !== 'Player') return unavailable(action, 'Potions are used from Player inventories.');
    if (item?.system?.identification?.identified === false) {
        action.consequences.push({ when: 'before-roll', description: 'The potion becomes identified.' });
    }
    action.consequences.push({ when: 'always', description: 'The potion is consumed.' });
    return action;
}

/** Every default action an Actor exposes, in sheet order. */
export function listActions(core: PreparedActorCore, source: any, lookups: PreparationLookups): PreparedAction[] {
    const items: any[] = Array.isArray(source?.items) ? source.items : [];
    const actions: PreparedAction[] = ABILITY_KEYS.map(stat => prepareCheckAction(core, stat));
    for (const item of items) {
        if (item?.type === 'Weapon' && core.kind === 'Player') {
            for (const mode of weaponAttackModes(core, item)) {
                actions.push(prepareWeaponAction(core, item, { attackType: mode.attackType, handedness: mode.handedness }));
            }
        } else if ((item?.type === 'NPC Attack' || item?.type === 'NPC Special Attack') && core.kind === 'NPC') {
            actions.push(prepareNpcAttackAction(core, item));
        } else if (['Spell', 'Scroll', 'Wand'].includes(item?.type)) {
            for (const source of spellSources(item, lookups)) actions.push(prepareSpellAction(core, item, source, lookups, items));
        } else if (item?.type === 'Class Ability') {
            actions.push(prepareAbilityAction(core, item));
        } else if (item?.type === 'Potion') {
            actions.push(preparePotionAction(core, item));
        }
    }
    return actions;
}

/** Resolve one requested action against current source; null when the item is absent. */
export function prepareRequestedAction(core: PreparedActorCore, source: any, lookups: PreparationLookups, request: ActionRequest): PreparedAction | null {
    const items: any[] = Array.isArray(source?.items) ? source.items : [];
    if (request.kind === 'check') return request.stat ? prepareCheckAction(core, request.stat, request) : null;
    const item = items.find(entry => String(entry?._id ?? entry?.id ?? '') === request.itemId);
    if (!item) return null;
    if (request.kind === 'attack') {
        if (item.type === 'Weapon') return prepareWeaponAction(core, item, request);
        if (item.type === 'NPC Attack' || item.type === 'NPC Special Attack') return prepareNpcAttackAction(core, item);
        return null;
    }
    if (request.kind === 'spell') {
        const sources = spellSources(item, lookups);
        const source = item.type === 'Spell' ? sources[0] : sources.find(entry => entry.index === (request.spellIndex ?? 0));
        return source ? prepareSpellAction(core, item, source, lookups, items, request) : null;
    }
    if (request.kind === 'ability') return item.type === 'Class Ability' ? prepareAbilityAction(core, item, request) : null;
    if (request.kind === 'potion') return item.type === 'Potion' ? preparePotionAction(core, item) : null;
    return null;
}

export interface RollOverrides {
    abilityBonus?: number;
    itemBonus?: number;
    talentBonus?: number;
    advantageMode?: 'normal' | 'advantage' | 'disadvantage';
}

/**
 * Main-roll formula: default components, replaced individually by explicit user
 * overrides. Dice-valued effect parts are kept as written.
 */
export function actionFormula(action: PreparedAction, overrides: RollOverrides = {}): string {
    const advantage = overrides.advantageMode === 'advantage' ? 1 : overrides.advantageMode === 'disadvantage' ? -1
        : overrides.advantageMode === 'normal' ? 0 : action.advantage;
    const die = advantage > 0 ? '2d20kh' : advantage < 0 ? '2d20kl' : '1d20';
    const numeric = (overrides.abilityBonus ?? action.abilityBonus) + (overrides.itemBonus ?? action.itemBonus) + (overrides.talentBonus ?? action.talentBonus);
    const diceParts = typeof action.bonus === 'string'
        ? (action.bonus.match(/[+-]?[^+-]*\d*d\d+[^+-]*/gi) ?? []).map(part => part.startsWith('+') || part.startsWith('-') ? part : `+${part}`).join('')
        : '';
    return `${die}${numeric >= 0 ? '+' : ''}${numeric}${diceParts}`;
}

export interface ActionOutcome { total: number; natural: number | null; success: boolean | null; criticalSuccess: boolean; criticalFailure: boolean }

/** RollSD.success / criticalSuccess / criticalFailure. */
export function evaluateOutcome(action: PreparedAction, total: number, natural: number | null): ActionOutcome {
    return {
        total, natural,
        success: action.dc === null ? null : total >= action.dc,
        criticalSuccess: natural !== null && natural >= action.critical.success,
        criticalFailure: natural !== null && natural <= action.critical.failure,
    };
}

export interface ConsequenceWrite {
    op: 'update' | 'delete';
    itemId: string;
    updates?: Record<string, unknown>;
    description: string;
}

/** Post-result writes for an action, following native castSpell/useAbility/usePotion. */
export function planConsequences(action: PreparedAction, triggering: any, outcome: ActionOutcome | null, options: { focus?: boolean } = {}): ConsequenceWrite[] {
    const itemId = action.itemId;
    if (!itemId) return [];
    const writes: ConsequenceWrite[] = [];
    if (action.kind === 'spell') {
        if (triggering?.type === 'Spell') {
            if (outcome?.success === false && !options.focus) writes.push({ op: 'update', itemId, updates: { 'system.lost': true }, description: `${action.spell?.name} is lost.` });
        } else if (triggering?.type === 'Scroll') {
            writes.push({ op: 'delete', itemId, description: `${triggering.name} is consumed.` });
        } else if (triggering?.type === 'Wand' && outcome?.success === false) {
            const spells = (Array.isArray(triggering.system?.spells) ? triggering.system.spells : []).map((entry: any) => ({ ...entry }));
            if (action.spell?.index !== null && action.spell?.index !== undefined && spells[action.spell.index]) spells[action.spell.index].lost = true;
            // WandSD.setSpellLost writes broken: criticalFailure.
            writes.push({ op: 'update', itemId, updates: { 'system.spells': spells, 'system.broken': outcome.criticalFailure },
                description: outcome.criticalFailure ? `${action.spell?.name} is lost and ${triggering.name} breaks.` : `${action.spell?.name} is lost from ${triggering.name}.` });
        }
    }
    if (action.kind === 'ability') {
        const system = triggering?.system ?? {};
        if (system.limitedUses === true) {
            const available = Math.max(0, (finiteNumber(system.uses?.available) ?? 0) - 1);
            writes.push({ op: 'update', itemId, updates: { 'system.uses.available': available }, description: `${triggering.name}: ${available} uses remain.` });
        }
        if (outcome?.success === false && (system.loseOnFailure ?? true) && system.ability) {
            writes.push({ op: 'update', itemId, updates: { 'system.lost': true }, description: `${triggering.name} is lost.` });
        }
    }
    if (action.kind === 'potion') writes.push({ op: 'delete', itemId, description: `${triggering?.name ?? 'Potion'} is consumed.` });
    return writes;
}

/** Display string for a numeric/string main-roll bonus. */
export function bonusLabel(bonus: number | string): string {
    if (typeof bonus === 'number') return `${bonus >= 0 ? '+' : ''}${bonus}`;
    return formatBonus(bonus) || '+0';
}

/** Native dice.applyAdvantage: the leading die term becomes 2dNkh / 2dNkl. */
export function applyAdvantage(formula: string, advantage: number): string {
    return formula.replace(/^(\d*)d(\d+)/, (match, _dice, sides) => sides ? (advantage > 0 ? `2d${sides}kh` : advantage < 0 ? `2d${sides}kl` : match) : match);
}

/**
 * Level-up hit point roll (native LevelUpSD: `_getActiveEffectKeys("system.roll.hp.advantage", 0)`
 * then `rollFromConfig` with that advantage on the class hit die).
 */
export function hitPointRollFormula(core: PreparedActorCore | null, hitDie: string): { formula: string; advantage: number; diagnostics: string[] } {
    if (!core) return { formula: hitDie, advantage: 0, diagnostics: [] };
    const key = getActiveEffectKeys(core.effects, buildRoll(core), 'system.roll.hp.advantage', 0);
    const advantage = numericKey(key, 'HP roll advantage') ?? 0;
    return { formula: advantage ? applyAdvantage(hitDie, advantage) : hitDie, advantage, diagnostics: key.diagnostics };
}
