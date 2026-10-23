import { prepareActorCore, ABILITY_KEYS, type AbilityKey, type PreparationLookups, type PreparedActorCore, type PreparedItemBasics } from './actor-preparation';
import { buildRoll, listActions, weaponBase, bonusLabel, type PreparedAction } from './actions';
import { UNAVAILABLE_RULE_INPUTS, hasLuckToken, luckMode, type RuleInputs } from './world-settings';
import type { CanonicalEffect } from './effects';
import { documentId, formatUuid, parseUuid, type DocumentRef } from './identity';
import { slugify } from './foundry';
import { grantedSpellSources, prepareSpellModel } from './spell-model';
import { languageRarity } from './languages';
import { isScroll, scrollSpellUuid, scrollSpent } from './scrolls';
import { isWand, wandSpells, wandBroken } from './wands';

/**
 * The single module-prepared Shadowdark view, published as `derived` (with
 * `computed` as an alias of the same object for existing consumers). Sheets,
 * cards, dialogs and server actions read it; React components do not recompute
 * rules. Identities are structured references so host projection cannot turn
 * them into names (SD01-05).
 */
export const VIEW_SCHEMA = 'sheetdelver.shadowdark.prepared/1';

export interface LabelledRef { ref: DocumentRef | null; value: string | null; label: string | null }

export interface ItemView extends PreparedItemBasics {
    img?: string;
    category: string;
    actionIds: string[];
    weapon?: { baseDamage: string | null; baseHandedness: '1h' | '2h'; damagePath: string; baseWarnings: string[] };
    spells?: Array<{ index: number; ref: DocumentRef | null; label: string | null; lost: boolean }>;
    uses?: { limited: boolean; available: number; max: number };
    scroll?: { spent: boolean };
    wand?: boolean;
    innate?: boolean;
    /** Spell class references with exact labels and the native slugified name. */
    spellClasses?: Array<{ ref: DocumentRef | null; label: string | null; slug: string | null }>;
}

export interface EffectView {
    id: string;
    _id: string;
    ref: string;
    owner: CanonicalEffect['owner'];
    sourceName: string;
    isItemEffect: boolean;
    name: string;
    img?: string;
    shape: CanonicalEffect['shape'];
    changes: CanonicalEffect['changes'];
    disabled: boolean;
    transfer: boolean;
    situational: boolean;
    suppressed: boolean;
    suppressionReason: string | null;
    active: boolean;
    applies: boolean;
    diagnostics: string[];
}

export interface ViewLookups extends PreparationLookups {
    /** Exact declared-pack label for a reference; never a suffix or name match. */
    label?: (ref: DocumentRef) => string | null;
    /** Exact documents actually read for a bounded caller operation. */
    dependencies?: readonly string[];
    languageDocument?: (ref: DocumentRef) => any | null;
}

const CATEGORY: Record<string, string> = {
    Weapon: 'weapon', Armor: 'armor', Spell: 'spell', Scroll: 'magic', Wand: 'magic', Potion: 'magic',
    Basic: 'gear', Gem: 'gem', 'Class Ability': 'feature', Talent: 'feature', Boon: 'feature',
    'NPC Attack': 'npc-attack', 'NPC Special Attack': 'npc-attack', 'NPC Feature': 'feature', Effect: 'effect',
    Class: 'identity', Ancestry: 'identity', Background: 'identity', Deity: 'identity', Patron: 'identity', Language: 'identity',
};

function labelled(value: unknown, lookups: ViewLookups, owned?: any): LabelledRef {
    if (value === null || value === undefined || value === '') return { ref: null, value: null, label: null };
    const ref = parseUuid(value);
    if (!ref) return { ref: null, value: String(value), label: null };
    return { ref, value: null, label: owned?.name ?? lookups.label?.(ref) ?? null };
}

function attackRow(item: any, action: PreparedAction) {
    const toHit = typeof action.bonus === 'number' ? bonusLabel(action.bonus) : bonusLabel(action.bonus);
    return {
        ...item, id: documentId(item), actionId: action.id,
        derived: {
            toHit, damage: action.damage?.formula ?? 'Damage unavailable', attackType: action.attack?.type,
            handedness: item?.type === 'NPC Attack' || item?.type === 'NPC Special Attack' ? 'NPC attack'
                : action.attack?.handedness === '2h' ? 'two-handed' : 'one-handed',
            mode: action.attack?.mode ?? null, modes: action.attack?.modes ?? 1,
            range: action.attack?.ranges?.join('/') ?? '', count: action.attack?.count ?? null, special: action.attack?.special ?? null,
            available: action.available, reason: action.reason,
            warnings: [...(action.damage?.warnings ?? []), ...action.diagnostics],
        },
    };
}

export function prepareShadowdarkView(source: any, lookups: ViewLookups = {}, rules: RuleInputs = UNAVAILABLE_RULE_INPUTS) {
    const core: PreparedActorCore = prepareActorCore(source, lookups, rules);
    const items: any[] = Array.isArray(source?.items) ? source.items : [];
    const actions = listActions(core, source, lookups);
    const byItem = new Map<string, PreparedAction[]>();
    for (const action of actions) if (action.itemId) byItem.set(action.itemId, [...(byItem.get(action.itemId) ?? []), action]);

    const grantedSpells = grantedSpellSources(items);

    const itemViews: ItemView[] = core.items.map(basics => {
        const item = items.find(entry => documentId(entry) === basics.id);
        const view: ItemView = {
            ...basics, img: item?.img, category: CATEGORY[basics.type] ?? 'other',
            actionIds: (byItem.get(basics.id) ?? []).map(action => action.id),
        };
        if (basics.type === 'Weapon' && !isWand(item)) {
            const base = weaponBase(item, basics);
            view.weapon = { baseDamage: base.damage, baseHandedness: base.handedness, damagePath: base.damagePath, baseWarnings: base.warnings };
        }
        if (isWand(item)) {
            view.wand = true; view.category = 'magic'; view.broken = wandBroken(item);
            view.spells = wandSpells(item).map((entry, index) => {
                const ref = parseUuid(entry?.uuid);
                return { index, ref, label: ref ? lookups.label?.(ref) ?? null : null, lost: entry?.lost === true };
            });
        }
        if (isScroll(item)) {
            view.scroll = { spent: scrollSpent(item) };
            const ref = parseUuid(scrollSpellUuid(item));
            view.spells = [{ index: 0, ref, label: ref ? lookups.label?.(ref) ?? null : null, lost: false }];
        }
        if (basics.type === 'Class Ability') {
            view.uses = { limited: item?.system?.limitedUses === true, available: Number(item?.system?.uses?.available ?? 0), max: Number(item?.system?.uses?.max ?? 0) };
        }
        if (basics.type === 'Spell' && basics.source && grantedSpells.has(formatUuid(basics.source))) view.innate = true;
        if (basics.type === 'Spell') {
            view.spellClasses = (Array.isArray(item?.system?.class) ? item.system.class : []).map((value: unknown) => {
                const ref = parseUuid(value);
                const label = ref ? lookups.label?.(ref) ?? null : null;
                return { ref, label, slug: label ? slugify(label) : null };
            });
        }
        return view;
    });

    const melee: any[] = [], ranged: any[] = [];
    for (const action of actions.filter(entry => entry.kind === 'attack')) {
        const item = items.find(entry => documentId(entry) === action.itemId);
        const view = itemViews.find(entry => entry.id === action.itemId);
        // Native getAttacks lists equipped weapons; NPC attacks are always listed.
        // An unavailable mode (e.g. a two-handed grip with a shield) is not listed.
        if (item?.type === 'Weapon' && !view?.equipped) continue;
        if (item?.type === 'Weapon' && !action.available) continue;
        (action.attack?.type === 'ranged' ? ranged : melee).push(attackRow(item, action));
    }

    const effects: EffectView[] = core.effects.map(effect => ({
        id: effect.id, _id: effect.id, ref: effect.ref, owner: effect.owner,
        sourceName: effect.owner.kind === 'item' ? effect.owner.itemName ?? 'Item' : source?.name ?? 'Actor',
        isItemEffect: effect.owner.kind === 'item', name: effect.name, img: effect.img, shape: effect.shape,
        changes: effect.changes, disabled: effect.disabled, transfer: effect.transfer, situational: effect.situational,
        suppressed: effect.suppressed, suppressionReason: effect.suppressionReason, active: effect.active,
        applies: effect.applies, diagnostics: effect.diagnostics,
    }));

    const system = source?.system ?? {};
    const ownedOf = (type: string, value: unknown) => {
        const ref = parseUuid(value);
        return ref?.kind === 'embedded' && ref.parentType === 'Actor' && ref.parentId === documentId(source)
            ? items.find(item => item?.type === type && documentId(item) === ref.id) : undefined;
    };
    const languageRef = (value: unknown) => {
        const entry = labelled(value, lookups);
        return { ...entry, rarity: entry.ref ? languageRarity(lookups.languageDocument?.(entry.ref)) : null };
    };
    const identity = {
        class: labelled(system.class, lookups, ownedOf('Class', system.class)),
        ancestry: labelled(system.ancestry, lookups, ownedOf('Ancestry', system.ancestry)),
        background: labelled(system.background, lookups, ownedOf('Background', system.background)),
        deity: labelled(system.deity, lookups, ownedOf('Deity', system.deity)),
        patron: labelled(system.patron, lookups, ownedOf('Patron', system.patron)),
        languages: (Array.isArray(system.languages) ? system.languages : []).map(languageRef),
        // Languages added by effects (e.g. "Speak Goblin"): shown, never written back.
        grantedLanguages: (Array.isArray(core.effective?.languages) ? core.effective.languages : [])
            .filter((value: unknown) => !(Array.isArray(system.languages) && system.languages.includes(value)))
            .map(languageRef),
    };

    const isSpellcaster = core.kind === 'Player'
        ? (core.spellcasting as { classes: string[] }).classes.length > 0
        : items.some(item => item?.type === 'Spell');
    const canUseMagicItems = core.kind === 'Player' && (isSpellcaster || (core.spellcasting as { allowAllItems: boolean }).allowAllItems);
    const xpNextLevel = core.level * 10;
    const physical = itemViews.filter(view => view.physical);
    const abilities = Object.fromEntries(ABILITY_KEYS.map(key => [key, { ...core.abilities[key] }])) as Record<AbilityKey, typeof core.abilities[AbilityKey]>;

    return {
        schema: VIEW_SCHEMA,
        provenance: { preparedBy: 'SheetDelver Shadowdark module', nativeRelease: '4.0.6', nativeBrowserPrepared: false },
        kind: core.kind,
        rollData: buildRoll(core),
        level: core.level,
        abilities,
        hp: core.hp,
        maxHp: core.hp.max,
        ac: core.ac,
        acSource: core.acSource,
        initiative: core.initiative,
        spellcasting: core.spellcasting,
        spellcastingAbility: null,
        isSpellcaster,
        canUseMagicItems,
        showSpellsTab: isSpellcaster || canUseMagicItems || items.some(item => item.type === 'Spell' || isScroll(item) || isWand(item)),
        spellModel: prepareSpellModel(source, core, lookups),
        maxSlots: core.maxSlots,
        gearSlots: core.maxSlots,
        slotsUsed: core.slotUsage?.total ?? null,
        slotBreakdown: core.slotUsage ? { gear: core.slotUsage.gear, treasure: core.slotUsage.treasure, gems: core.slotUsage.gems, coins: core.slotUsage.coins } : null,
        xpNextLevel,
        levelUp: core.kind === 'Player' && (Number(system.level?.xp ?? 0) >= xpNextLevel),
        identity,
        items: itemViews,
        actions,
        attacks: { melee, ranged },
        inventory: {
            equipped: physical.filter(view => view.equipped && !view.stashed).map(view => view.id),
            carried: physical.filter(view => !view.equipped && !view.stashed).map(view => view.id),
            stashed: physical.filter(view => view.stashed).map(view => view.id),
        },
        effects,
        // Native PlayerSD luck: the Pulp world setting selects `remaining` over `available`.
        // `mode` is null when the setting is unavailable; no mode is guessed.
        luck: {
            mode: luckMode(rules), available: system.luck?.available === true, remaining: Number(system.luck?.remaining ?? 0),
            hasLuckToken: hasLuckToken(rules, system.luck),
            unavailableReason: rules.usePulpMode.status === 'unavailable' ? rules.usePulpMode.reason : null,
        },
        ruleInputs: rules,
        npc: core.kind === 'NPC' ? {
            move: String(system.move ?? 'near'), moveNote: String(system.moveNote ?? ''), darkAdapted: system.darkAdapted === true,
            spellcasting: core.spellcasting,
        } : null,
        diagnostics: [...new Set(core.diagnostics)],
    };
}

export type ShadowdarkView = ReturnType<typeof prepareShadowdarkView>;
