import type { PreparedAction } from './actions';
import { bonusLabel } from './actions';
import { formatUuid, parseUuid, type DocumentRef } from './identity';
import type { ShadowdarkView, ViewLookups } from './prepared-view';

/**
 * Card view models for the module's resource-detail modal. Every card is built
 * from the same prepared view/actions as the sheets: no rules are computed here.
 * Cards carry the current identified presentation only; the native alternate
 * identity (`system.identification.name/description`) is never projected.
 *
 * Display labels follow native 4.0.6 config.mjs enumerations with English text
 * from i18n/en.yaml.
 */
export type CardKind = 'spell' | 'item' | 'magic' | 'feature' | 'npc';

export interface CardFact { label: string; value: string; detail?: string }
export interface CardAction { id: string; label: string; kind: 'cast' | 'use' | 'drink' | 'attack'; available: boolean; reason: string | null; action: PreparedAction }
export interface CardSection { title: string; entries: Array<{ title: string; text?: string; facts?: CardFact[]; description?: string; ref?: DocumentRef | null; itemId?: string }> }

export interface ResourceCard {
    kind: CardKind;
    /** Owned Item id when the card shows an Actor's own copy. */
    itemId: string | null;
    /** Exact document identity for compendium/world previews. */
    ref: DocumentRef | null;
    title: string;
    subtitle: string;
    img?: string;
    facts: CardFact[];
    states: string[];
    description: unknown;
    actions: CardAction[];
    sections: CardSection[];
    diagnostics: string[];
}

export const RANGE_LABELS: Record<string, string> = {
    self: 'Self', touch: 'Touch', close: 'Close', near: 'Near', doubleNear: 'Double Near', far: 'Far',
    oneMile: '1 Mile', samePlane: 'On the same plane', unlimited: 'Unlimited', nearLine: 'Near Line',
};
const DURATION_LABELS: Record<string, string> = {
    focus: 'Focus', instant: 'Instant', rounds: 'Rounds', turns: 'Turns', days: 'Days', realTime: 'Real Time', permanent: 'Permanent',
    seconds: 'Seconds', minutes: 'Minutes', hours: 'Hours', unlimited: 'Unlimited',
};
const VARIABLE_DURATIONS = new Set(['days', 'hours', 'minutes', 'realTime', 'rounds', 'seconds', 'turns']);
export const MOVE_LABELS: Record<string, string> = {
    none: 'None', close: 'Close', near: 'Near', doubleNear: 'Double Near', tripleNear: 'Triple Near', far: 'Far', special: 'Special',
};
const ALIGNMENT_LABELS: Record<string, string> = { lawful: 'Lawful', neutral: 'Neutral', chaotic: 'Chaotic' };
const ABILITY_LABELS: Record<string, string> = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

/** Native getSpellDuration helper. */
export function spellDuration(duration: any): string {
    const type = String(duration?.type ?? '');
    const label = DURATION_LABELS[type] ?? type;
    if (!label) return '';
    return VARIABLE_DURATIONS.has(type) && duration?.value !== undefined && duration.value !== '' ? `${duration.value} ${label}` : label;
}

const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;

function costLabel(cost: any): string | null {
    const parts = (['gp', 'sp', 'cp'] as const).filter(unit => Number(cost?.[unit] ?? 0) > 0).map(unit => `${cost[unit]} ${unit}`);
    return parts.length ? parts.join(' ') : null;
}

function cardActions(actions: PreparedAction[]): CardAction[] {
    return actions.map(action => ({
        id: action.id, action, available: action.available, reason: action.reason,
        kind: action.kind === 'spell' ? 'cast' : action.kind === 'potion' ? 'drink' : action.kind === 'attack' ? 'attack' : 'use',
        label: action.kind === 'spell' ? (action.spell?.name ? `Cast ${action.spell.name}` : 'Cast')
            : action.kind === 'attack' && action.attack ? (action.attack.modes > 1 ? `${action.attack.mode} attack` : 'Attack') : action.label,
    }));
}

function spellFacts(spell: any, lookups: ViewLookups, action?: PreparedAction): CardFact[] {
    const system = spell?.system ?? {};
    const classes = (Array.isArray(system.class) ? system.class : []).map((value: unknown) => {
        const ref = parseUuid(value);
        return ref ? lookups.label?.(ref) ?? null : null;
    });
    const facts: CardFact[] = [];
    const tier = Number(system.tier ?? (system.dc !== undefined ? Number(system.dc) - 10 : NaN));
    if (Number.isFinite(tier)) facts.push({ label: 'Tier', value: String(tier) }, { label: 'DC', value: String(tier + 10) });
    if (classes.length) facts.push({ label: 'Class', value: classes.map((name: string | null) => name ?? 'Unavailable class').join(', ') });
    if (system.range) facts.push({ label: 'Range', value: RANGE_LABELS[system.range] ?? system.range });
    const duration = spellDuration(system.duration);
    if (duration) facts.push({ label: 'Duration', value: duration });
    if (action?.damage?.formula) facts.push({ label: action.damage.label, value: action.damage.formula });
    else if (system.formula && system.damageType && system.damageType !== 'none') facts.push({ label: system.damageType === 'healing' ? 'Healing' : 'Damage', value: system.formula });
    if (action?.ability) facts.push({ label: 'Casting', value: `${ABILITY_LABELS[action.ability]} ${bonusLabel(action.bonus)}${action.advantage > 0 ? ', advantage' : action.advantage < 0 ? ', disadvantage' : ''}` });
    else if (action && action.kind === 'spell' && action.available) facts.push({ label: 'Casting', value: bonusLabel(action.bonus) });
    return facts;
}

/** Card for an Item owned by the prepared Actor. */
export function buildOwnedItemCard(view: ShadowdarkView, item: any, lookups: ViewLookups = {}): ResourceCard | null {
    const itemId = String(item?._id ?? item?.id ?? '');
    const itemView = view.items.find(entry => entry.id === itemId);
    if (!itemView) return null;
    const system = item.system ?? {};
    const actions = view.actions.filter(action => action.itemId === itemId);
    const states: string[] = [];
    if (itemView.lost) states.push('Lost');
    if (itemView.broken) states.push('Broken');
    if (!itemView.identified) states.push('Unidentified');
    if (itemView.physical) states.push(itemView.stashed ? 'Stashed' : itemView.equipped ? 'Equipped' : 'Carried');
    const facts: CardFact[] = [];
    const diagnostics = [...itemView.diagnostics];
    let kind: CardKind = 'item';
    let subtitle = item.type;

    if (item.type === 'Spell') {
        kind = 'spell';
        const spellAction = actions.find(action => action.kind === 'spell');
        facts.push(...spellFacts(item, lookups, spellAction));
        subtitle = 'Spell';
    } else if (['Talent', 'Boon', 'Class Ability', 'NPC Feature'].includes(item.type)) {
        kind = 'feature';
        if (item.type === 'Talent' && system.talentClass) facts.push({ label: 'Source', value: system.talentClass === 'patronBoon' ? 'Patron boon' : `${system.talentClass[0].toUpperCase()}${system.talentClass.slice(1)} talent` });
        if (item.type === 'Boon' && system.boonType) facts.push({ label: 'Boon', value: String(system.boonType) });
        if (item.type === 'Class Ability') {
            if (system.group) facts.push({ label: 'Group', value: String(system.group) });
            if (system.ability) facts.push({ label: 'Check', value: `${ABILITY_LABELS[system.ability] ?? system.ability} DC ${system.dc ?? 10}` });
            if (itemView.uses?.limited) facts.push({ label: 'Uses', value: `${itemView.uses.available} / ${itemView.uses.max}` });
            if (system.loseOnFailure ?? true) facts.push({ label: 'On failure', value: 'Lost' });
        }
    } else {
        if (itemView.magicItem || ['Scroll', 'Wand', 'Potion'].includes(item.type)) kind = 'magic';
        if (itemView.properties.length) facts.push({ label: 'Properties', value: itemView.properties.map(property => property.name ?? 'Unresolved property').join(', ') });
        if (item.type === 'Weapon') {
            facts.push({ label: 'Type', value: `${system.type === 'ranged' ? 'Ranged' : 'Melee'}, ${RANGE_LABELS[system.range] ?? system.range ?? 'Close'}` });
            const grips = new Set(actions.filter(entry => entry.kind === 'attack').map(entry => entry.attack?.handedness));
            const dice = (hands: 'oneHanded' | 'twoHanded') => typeof system.damage?.[hands] === 'string' && system.damage[hands].trim() ? system.damage[hands].trim() : 'unavailable';
            facts.push(grips.size > 1
                ? { label: 'Base damage', value: `${dice('oneHanded')} one-handed, ${dice('twoHanded')} two-handed` }
                : { label: 'Base damage', value: itemView.weapon?.baseDamage ?? 'Damage unavailable', detail: itemView.weapon?.baseWarnings.join(' ') });
            for (const action of actions.filter(entry => entry.kind === 'attack')) {
                facts.push({ label: `${action.attack?.mode ?? 'Melee'} attack`, value: `${bonusLabel(action.bonus)} to hit, ${action.damage?.formula ?? 'Damage unavailable'}`,
                    detail: [...(action.available ? [] : [action.reason ?? '']), ...(action.damage?.warnings ?? []), ...action.diagnostics].filter(Boolean).join(' ') || undefined });
            }
        }
        if (item.type === 'NPC Attack' || item.type === 'NPC Special Attack') {
            for (const action of actions.filter(entry => entry.kind === 'attack')) {
                facts.push({ label: 'Attack', value: `${action.attack?.count && action.attack.count > 1 ? `${action.attack.count} × ` : ''}${bonusLabel(action.bonus)}` });
                facts.push({ label: 'Range', value: (action.attack?.ranges ?? []).map(range => RANGE_LABELS[range] ?? range).join('/') || 'Close' });
                if (action.damage) facts.push({ label: 'Damage', value: action.damage.formula ?? 'Damage unavailable', detail: action.damage.warnings.join(' ') || undefined });
                if (action.attack?.special) facts.push({ label: 'Special', value: action.attack.special });
            }
        }
        if (item.type === 'Armor') {
            const ac = system.ac ?? {};
            const base = Number(ac.base ?? 0), modifier = Number(ac.modifier ?? 0);
            facts.push({ label: 'AC', value: base ? `${base}${ac.attribute ? ` + ${ABILITY_LABELS[ac.attribute] ?? ac.attribute}` : ''}${modifier ? ` ${signed(modifier)}` : ''}` : signed(modifier) });
        }
        if (item.type === 'Wand' || item.type === 'Scroll') {
            for (const spell of itemView.spells ?? []) facts.push({ label: item.type === 'Wand' ? `Spell ${spell.index + 1}` : 'Spell',
                value: `${spell.label ?? (spell.ref ? formatUuid(spell.ref) : 'No linked spell')}${spell.lost ? ' (lost)' : ''}` });
        }
        if (itemView.physical) {
            facts.push({ label: 'Quantity', value: String(itemView.quantity) }, { label: 'Slots', value: String(itemView.slotsUsed) });
            const cost = costLabel(system.cost);
            if (cost) facts.push({ label: 'Cost', value: cost });
        }
        if (itemView.lightSource && system.light) facts.push({ label: 'Light', value: `${Math.ceil(Number(system.light.remainingSecs ?? 0) / 60)} of ${system.light.longevityMins ?? 0} min${system.light.active ? ', lit' : ''}` });
    }
    return {
        kind, itemId, ref: itemView.source, title: item.name, subtitle, img: item.img, facts, states,
        // Native sheets show the current description; the alternate identity is GM data.
        description: system.description ?? '',
        actions: cardActions(actions.filter(action => action.kind !== 'attack' || kind === 'item')),
        sections: [], diagnostics: [...diagnostics, ...actions.flatMap(action => action.reason ? [action.reason] : [])],
    };
}

/** Preview card for a document without an Actor (compendium/world); never offers actions. */
export function buildDocumentCard(doc: any, ref: DocumentRef | null, lookups: ViewLookups = {}): ResourceCard {
    const system = doc?.system ?? {};
    const kind: CardKind = doc?.type === 'Spell' ? 'spell'
        : ['Talent', 'Boon', 'Class Ability', 'NPC Feature'].includes(doc?.type) ? 'feature'
            : system.magicItem || ['Scroll', 'Wand', 'Potion'].includes(doc?.type) ? 'magic' : 'item';
    const facts = kind === 'spell' ? spellFacts(doc, lookups) : [];
    if (doc?.type === 'Weapon') {
        facts.push({ label: 'Damage', value: [system.damage?.oneHanded && `1H ${system.damage.oneHanded}`, system.damage?.twoHanded && `2H ${system.damage.twoHanded}`].filter(Boolean).join(', ') || 'Damage unavailable' });
    }
    const cost = costLabel(system.cost);
    if (cost) facts.push({ label: 'Cost', value: cost });
    return {
        kind, itemId: null, ref, title: doc?.name ?? 'Document', subtitle: doc?.type ?? '', img: doc?.img, facts,
        states: system.identification?.identified === false ? ['Unidentified'] : [], description: system.description ?? '',
        actions: [], sections: [], diagnostics: ref ? [] : ['This preview has no exact document identity.'],
    };
}

/** Read-only NPC card from the prepared NPC view. No spawn/encounter/share actions. */
export function buildNpcCard(view: ShadowdarkView, source: any, ref: DocumentRef | null): ResourceCard {
    const system = source?.system ?? {};
    const items: any[] = Array.isArray(source?.items) ? source.items : [];
    const facts: CardFact[] = [
        { label: 'Level', value: String(view.level) },
        { label: 'Alignment', value: ALIGNMENT_LABELS[system.alignment] ?? String(system.alignment ?? '') },
        { label: 'AC', value: String(view.ac) },
        { label: 'HP', value: `${view.hp.value} / ${view.hp.max}` },
        { label: 'Abilities', value: Object.entries(view.abilities).map(([key, ability]) => `${ABILITY_LABELS[key]} ${signed(ability.mod)}`).join(', ') },
        { label: 'Move', value: `${MOVE_LABELS[view.npc?.move ?? 'near'] ?? view.npc?.move}${view.npc?.moveNote ? ` (${view.npc.moveNote})` : ''}` },
    ];
    if (view.npc?.darkAdapted) facts.push({ label: 'Senses', value: 'Dark-adapted' });
    const spellcasting = view.npc?.spellcasting as { ability: string; bonus: number; attacks: number } | undefined;
    if (spellcasting && (spellcasting.ability || spellcasting.attacks)) {
        facts.push({ label: 'Spellcasting', value: `${spellcasting.ability ? ABILITY_LABELS[spellcasting.ability] ?? spellcasting.ability : '—'} ${signed(spellcasting.bonus)}${spellcasting.attacks ? `, ${spellcasting.attacks} per turn` : ''}` });
    }
    const attacks = view.actions.filter(action => action.kind === 'attack').map(action => ({
        title: `${action.attack?.count && action.attack.count > 1 ? `${action.attack.count} × ` : ''}${items.find(item => (item._id ?? item.id) === action.itemId)?.name ?? action.label}`,
        itemId: action.itemId ?? undefined,
        facts: [
            { label: 'To hit', value: bonusLabel(action.bonus) },
            { label: 'Range', value: (action.attack?.ranges ?? []).map(range => RANGE_LABELS[range] ?? range).join('/') || 'Close' },
            ...(action.damage ? [{ label: 'Damage', value: action.damage.formula ?? 'Damage unavailable', detail: action.damage.warnings.join(' ') || undefined }] : []),
            ...(action.attack?.special ? [{ label: 'Special', value: action.attack.special }] : []),
        ],
        description: items.find(item => (item._id ?? item.id) === action.itemId)?.system?.description,
    }));
    const features = items.filter(item => item?.type === 'NPC Feature').map(item => ({ title: item.name, description: item.system?.description ?? '', itemId: item._id ?? item.id }));
    const spells = view.actions.filter(action => action.kind === 'spell').map(action => {
        const item = items.find(entry => (entry._id ?? entry.id) === action.itemId);
        return { title: item?.name ?? action.label, itemId: action.itemId ?? undefined, facts: spellFacts(item, {}, action), description: item?.system?.description };
    });
    const sections: CardSection[] = [];
    if (attacks.length) sections.push({ title: 'Attacks', entries: attacks });
    if (features.length) sections.push({ title: 'Features', entries: features });
    if (spells.length) sections.push({ title: 'Spells', entries: spells });
    return {
        kind: 'npc', itemId: null, ref, title: source?.name ?? 'Creature', subtitle: `Level ${view.level} creature`, img: source?.img,
        facts, states: [], description: system.notes ?? '', actions: [], sections, diagnostics: view.diagnostics,
    };
}
