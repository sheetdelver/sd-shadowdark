/** Bounded native 4.0.6 weapon preparation. No Foundry client globals or writes. */
export const slug = (value: string): string => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const number = (value: unknown): number => Number.isFinite(Number(value)) ? Number(value) : 0;
const signed = (value: number): string => value === 0 ? '' : `${value > 0 ? '+' : ''}${value}`;

/** Deterministic numeric effects such as 1+floor(@level.value/2), never eval. */
export function numericWeaponEffect(value: unknown, actor: any): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || value.length > 256) return null;
    const expression = value.replace(/@(?:system\.)?([a-zA-Z][\w.]*)/g, (_match, path: string) => {
        const parts = path.split('.');
        if (parts.some(part => ['__proto__', 'prototype', 'constructor'].includes(part))) return 'INVALID';
        const source = path.startsWith('abilities.') ? { ...actor.system, abilities: actor.computed?.abilities ?? actor.stats ?? actor.system?.abilities } : actor.system;
        const found = parts.reduce((current: any, part) => current?.[part], source);
        return typeof found === 'number' && Number.isFinite(found) ? `(${found})` : 'INVALID';
    });
    const tokens = expression.match(/floor|ceil|round|abs|\d+(?:\.\d+)?|[()+*/%\-]/g) ?? [];
    if (tokens.join('') !== expression.replace(/\s/g, '') || !tokens.length) return null;
    let index = 0;
    const primary = (depth: number): number => {
        if (depth > 20) throw new Error();
        const token = tokens[index++];
        if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * primary(depth + 1);
        if (token === '(') { const value = add(depth + 1); if (tokens[index++] !== ')') throw new Error(); return value; }
        if (['floor', 'ceil', 'round', 'abs'].includes(token)) {
            if (tokens[index++] !== '(') throw new Error();
            const value = add(depth + 1);
            if (tokens[index++] !== ')') throw new Error();
            return ({ floor: Math.floor, ceil: Math.ceil, round: Math.round, abs: Math.abs } as any)[token](value);
        }
        if (!token || !/^\d/.test(token)) throw new Error();
        return Number(token);
    };
    const multiply = (depth: number): number => {
        let value = primary(depth);
        while (['*', '/', '%'].includes(tokens[index])) {
            const op = tokens[index++], next = primary(depth);
            value = op === '*' ? value * next : op === '/' ? value / next : value % next;
        }
        return value;
    };
    const add = (depth: number): number => {
        let value = multiply(depth);
        while (tokens[index] === '+' || tokens[index] === '-') {
            const op = tokens[index++], next = multiply(depth);
            value += op === '+' ? next : -next;
        }
        return value;
    };
    try { const result = add(0); return index === tokens.length && Number.isFinite(result) ? result : null; }
    catch { return null; }
}

export function weaponProperties(item: any, nameIndex: Record<string, string> = {}): string[] {
    return (Array.isArray(item.system?.properties) ? item.system.properties : []).flatMap((identity: unknown) => {
        if (typeof identity !== 'string') return [];
        // A UUID is resolved by exact identity in the declared pack name index.
        // Bare legacy property slugs remain supported, never UUID substrings.
        const name = nameIndex[identity] ?? (!identity.includes('.') ? identity : null);
        return name ? [slug(name)] : [];
    });
}

/** Native source fields only: no Actor effects, guessed dice or cross-hand fallback. */
export function prepareWeaponBase(item: any, options: { handedness?: string } = {}, nameIndex: Record<string, string> = {}) {
    const system = item.system ?? {};
    const properties = weaponProperties(item, nameIndex);
    const requestedHands = options.handedness ?? system.handedness;
    const handedness = ['2h', 'two-handed'].includes(requestedHands) ? '2h' as const
        : ['1h', 'one-handed'].includes(requestedHands) ? '1h' as const
            : properties.includes('two-handed') || (!system.damage?.oneHanded && system.damage?.twoHanded) ? '2h' as const : '1h' as const;
    const damagePath = item.type === 'NPC Attack' ? 'system.damage.value'
        : `system.damage.${handedness === '2h' ? 'twoHanded' : 'oneHanded'}`;
    const raw = item.type === 'NPC Attack' ? system.damage?.value
        : system.damage?.[handedness === '2h' ? 'twoHanded' : 'oneHanded'];
    const damage = typeof raw === 'string' && raw.trim() ? raw.trim() : null;
    const warnings: string[] = [];
    if (!damage) warnings.push(`Damage unavailable: ${damagePath} is absent or empty on ${item.name || item._id || 'weapon'}.`);
    for (const ref of Array.isArray(system.properties) ? system.properties : []) {
        if (typeof ref === 'string' && ref.includes('.') && !nameIndex[ref]) {
            warnings.push(`Unresolved weapon property: ${ref}; check declared hydrated properties.`);
        }
    }
    return { properties, handedness, damage, damagePath, warnings };
}

function activeChanges(actor: any): Array<{ change: any; item: any }> {
    const entries = [{ effects: actor.computed?.weaponActorEffects ?? actor.effects?.contents ?? actor.effects ?? [], item: null },
        ...(actor.items ?? []).filter((item: any) => !item.system?.stashed
            && !(['Weapon', 'Armor'].includes(item.type) && item.system?.equipped === false)
            && item.system?.identification?.identified !== false)
            .map((item: any) => ({ effects: item.effects ?? [], item }))];
    return entries.flatMap(entry => entry.effects.filter((effect: any) => !effect.disabled && !effect.isSuppressed
        && !effect.flags?.shadowdark?.situational && (!entry.item || effect.transfer !== false))
        .flatMap((effect: any) => (effect.changes ?? []).map((change: any) => ({ change, item: entry.item }))));
}

export function prepareWeaponAttack(actor: any, item: any, options: { attackType?: string; handedness?: string } = {},
    nameIndex: Record<string, string> = actor.computed?.weaponPropertyNames ?? {}): {
        attackType: 'melee' | 'ranged'; handedness: '1h' | '2h'; properties: string[];
        abilityBonus: number; itemBonus: number; talentBonus: number; toHit: number;
        damage: string | null; warnings: string[];
    } {
    const system = item.system ?? {}, source = actor.system ?? {};
    const base = prepareWeaponBase(item, options, nameIndex);
    const { properties, handedness } = base;
    const requestedType = options.attackType?.toLowerCase();
    const attackType = requestedType === 'ranged' || requestedType === 'melee' ? requestedType
        : item.type === 'NPC Attack' ? (system.ranges?.[0] && system.ranges[0] !== 'close' ? 'ranged' : 'melee')
            : system.type === 'ranged' ? 'ranged' : 'melee';
    const stats = actor.computed?.abilities ?? actor.stats ?? source.abilities ?? {};
    const str = number(stats.str?.mod ?? stats.STR?.mod), dex = number(stats.dex?.mod ?? stats.DEX?.mod);
    const abilityBonus = actor.type === 'NPC' ? 0 : attackType === 'ranged' ? dex
        : properties.includes('finesse') ? Math.max(str, dex) : str;
    const itemBonus = number(system.bonuses?.attackBonus);
    const warnings = [...base.warnings];
    if (item.type === 'NPC Attack') {
        // NpcSD._generateAttackConfig uses the attack's own bonus and value;
        // it does not apply Player ability/mastery/global weapon modifiers.
        return { attackType, handedness, properties, abilityBonus: 0, itemBonus,
            talentBonus: 0, toHit: itemBonus,
            damage: base.damage ? base.damage + signed(number(system.bonuses?.damageBonus)) : null, warnings };
    }
    const selectors = new Set(['all', ...properties, slug(system.baseWeapon ?? ''), slug(item.name ?? '')]);
    const changes = activeChanges(actor);
    const matching = (suffix: string) => {
        const keys = [`system.roll.${attackType}.${suffix}`, `system.roll.attack.${suffix}`];
        return changes.filter(({ change, item: parent }) => keys.some(key => change.key === key
            || (typeof change.key === 'string' && change.key.startsWith(`${key}.`) && selectors.has(change.key.slice(key.length + 1)))
            || (change.key === `${key}.this` && parent && (parent._id ?? parent.id) === (item._id ?? item.id))));
    };
    const apply = (base: number, suffix: string): number => {
        const selected = matching(suffix).map(({ change }) => ({ change, value: numericWeaponEffect(change.value, actor) }));
        let value = base;
        for (const mode of [2, 1, 5]) for (const entry of selected.filter(entry => Number(entry.change.mode) === mode)) {
            if (entry.value === null) { warnings.push(`Unsupported numeric effect: ${entry.change.key}`); continue; }
            value = mode === 2 ? value + entry.value : mode === 1 ? value * entry.value : entry.value;
        }
        return value;
    };
    const bonuses = actor.computed?.attackBonuses ?? source.bonuses;
    const legacy = number(bonuses?.attackBonus) + number(bonuses?.[`${attackType}AttackBonus`]);
    const toHit = apply(abilityBonus + itemBonus + legacy, 'bonus');
    let damage: string | null = base.damage;
    if (damage) {
        const upgrades = apply(0, 'upgrade-damage-die'), extra = apply(0, 'extra-damage-die');
        if (upgrades && /^[dD]\d+$/.test(damage)) {
            const dice = [4, 6, 8, 10, 12], index = dice.indexOf(Number(damage.slice(1)));
            if (index >= 0) damage = `d${dice[Math.max(0, Math.min(dice.length - 1, index + Math.trunc(upgrades)))]}`;
        }
        if (extra && /^[dD]\d+$/.test(damage)) damage += `+${extra}d${damage.slice(1)}`;
        // Native 4.0.6 _getActiveEffectKeys groups ADD, MULTIPLY, OVERRIDE
        // across all applied effects, not in Item/effect source order.
        let addition = number(system.bonuses?.damageBonus) + number(bonuses?.damageBonus)
            + number(bonuses?.[`${attackType}DamageBonus`]);
        let multiplier = 1;
        const overrides: number[] = [];
        for (const { change } of matching('damage')) {
            const value = numericWeaponEffect(change.value, actor);
            if (value === null) { warnings.push(`Unsupported damage effect: ${change.key}`); continue; }
            if (Number(change.mode) === 2) addition += value;
            else if (Number(change.mode) === 1) multiplier *= value;
            else if (Number(change.mode) === 5) overrides.push(value);
        }
        damage += signed(addition);
        if (multiplier !== 1) damage = `(${damage})*${multiplier}`;
        if (overrides.length) damage = String(overrides[overrides.length - 1]);
    }
    return { attackType, handedness, properties, abilityBonus, itemBonus,
        talentBonus: toHit - abilityBonus - itemBonus, toHit, damage, warnings };
}
