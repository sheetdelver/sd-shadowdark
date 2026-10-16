/**
 * Native Shadowdark 4.0.6 ActiveEffect key migration, ported from
 * `src/migrations/updates/Update_251001_1.mjs` (`updateEffects`) at tag
 * release-4.0.6. Native runs it once when a world upgrades; documents written
 * afterwards with pre-4.0 keys (including effects created by SheetDelver 0.9.4
 * and earlier) keep keys that native 4.0.6 does not use.
 *
 * SheetDelver does not apply these keys at read time, because native Foundry would
 * not either. `nativeKeyMigration` names the exact native replacement so the sheet
 * can say what is wrong. It is data from the pinned release, not a module rule.
 */
export interface LegacyChange { key: string; mode?: number | null; value?: unknown }
export interface KeyMigration {
    /** Replacement changes in native order (Weapon Mastery becomes two changes). */
    changes: LegacyChange[];
    /** Present when native needs data SheetDelver cannot see to choose the mapping. */
    note?: string;
}

const ADD = 2;
const MULTIPLY = 1;
const ABILITY = /^system\.abilities\.(str|dex|con|int|wis|cha)\.(bonus|base)$/;

/** Keys native treats as already migrated (Update_251001_1 `NEW_KEYS`). */
export const NATIVE_4_KEY_PREFIXES = [
    'system.abilities.cha.value', 'system.abilities.con.value', 'system.abilities.dex.value', 'system.abilities.int.value',
    'system.abilities.str.value', 'system.abilities.wis.value', 'system.attributes.ac.', 'system.attributes.hp.max',
    'system.attributes.hp.value', 'system.bonus.', 'system.roll.', 'system.slots', 'system.spellcasting.classes',
    'system.spellcasting.allowAllItems', 'system.spellcasting.itemAbility',
] as const;

/**
 * The native 4.0 replacement for a pre-4.0 change, or null when native has no
 * migration case for the key (it is either current or unknown to the migration).
 * `parentType` is the owning Item type (`Weapon` selects `.this`).
 */
export function nativeKeyMigration(change: LegacyChange, parentType?: string): KeyMigration | null {
    const scope = parentType === 'Weapon' ? '.this' : '.all';
    const value = change.value;
    const rename = (key: string, extra: Partial<LegacyChange> = {}): KeyMigration => ({ changes: [{ key, mode: change.mode, value, ...extra }] });
    const ability = change.key.match(ABILITY);
    if (ability) return rename(`system.abilities.${ability[1]}.value`);
    switch (change.key) {
        case 'system.bonuses.advantage':
            if (value === 'initiative') return rename('system.roll.initiative.advantage', { value: 1 });
            if (value === 'hp') return rename('system.roll.hp.advantage', { mode: ADD, value: 1 });
            // Native checks the spell compendium for a matching slug, then falls
            // through to the armorMastery case when none matches.
            return {
                changes: [{ key: `system.roll.spell.advantage.${String(value)}`, mode: ADD, value: 1 }],
                note: `when "${String(value)}" is a native spell slug; otherwise native falls through to system.attributes.ac.${String(value)} = 1`,
            };
        case 'system.bonuses.armorMastery': return rename(`system.attributes.ac.${String(value)}`, { mode: ADD, value: 1 });
        case 'system.bonuses.hauler': return rename('system.slots', { mode: ADD, value: 'max(@abilities.con.mod, 0)' });
        case 'system.bonuses.weaponMastery': return {
            changes: [
                { key: `system.roll.melee.bonus.${String(value)}`, mode: ADD, value: '1+floor(@level.value/2)' },
                { key: `system.roll.melee.damage.${String(value)}`, mode: ADD, value: '1+floor(@level.value/2)' },
            ],
        };
        case 'system.attributes.hp.bonus': return rename('system.attributes.hp.max');
        case 'system.bonuses.acBonus': return rename('system.attributes.ac.value');
        case 'system.attributes.ac.override': return rename('system.attributes.ac.value');
        case 'system.bonuses.acBonusFromAttribute': return rename('system.attributes.ac.value', { value: `@attributes.${String(value)}.mod` });
        case 'system.bonuses.gearSlots': return rename('system.slots');
        case 'system.bonuses.meleeAttackBonus': return rename(`system.roll.melee.bonus${scope}`);
        case 'system.bonuses.meleeDamageBonus': return rename(`system.roll.melee.damage${scope}`);
        case 'system.bonuses.rangedAttackBonus': return rename(`system.roll.ranged.bonus${scope}`);
        case 'system.bonuses.rangedDamageBonus': return rename(`system.roll.ranged.damage${scope}`);
        case 'system.bonuses.damageBonus': return rename(`system.roll.attack.damage${scope}`);
        case 'system.bonuses.spellcastingCheckBonus': return rename('system.roll.spell.bonus.all');
        case 'system.bonuses.unarmoredAcBonus': return rename('system.attributes.ac.unarmored');
        case 'system.bonuses.attackBonus': return rename(`system.roll.attack.bonus${scope}`);
        case 'system.bonuses.critical.multiplier': return rename(`system.roll.attack.critical-multiplier${scope}`);
        case 'system.bonuses.stoneSkinTalent': return rename('system.attributes.ac.value', { mode: ADD, value: '2+floor(@level.value/2)' });
        case 'system.bonuses.backstabDie': return rename('system.roll.attack.extra-damage-die.all', { value: '1+floor(@level.value/2)' });
        case 'system.bonuses.critical.failureThreshold': return rename(`system.roll.attack.critical-failure${scope}`);
        case 'system.bonuses.critical.successThreshold': return rename(`system.roll.attack.critical-success${scope}`);
        case 'system.bonuses.weaponDamageDieD12': return rename(`system.roll.attack.upgrade-damage-die.${String(value)}`, { value: 5 });
        case 'system.bonuses.damageMultiplier': return rename(`system.roll.attack.damage${scope}`, { mode: MULTIPLY });
        case 'system.bonuses.weaponDamageDieImprovementByProperty': return rename(`system.roll.attack.upgrade-damage-die.${String(value)}`, { value: 1 });
        case 'system.bonuses.weaponDamageExtraDieByProperty': return rename(`system.roll.attack.extra-damage-die.${String(value)}`, { value: 1 });
        case 'system.bonuses.spellcastingClasses': return rename('system.spellcasting.classes');
        case 'system.attackBonus': return rename(`system.roll.attack.bonus${scope}`);
        case 'system.damage.bonus': return rename(`system.roll.attack.damage${scope}`);
        case 'system.damage.critMultiplier': return rename(`system.roll.attack.critical-multiplier${scope}`);
        default: return null;
    }
}

/** True for any `system.bonuses.*` key, which native `applyRules` also rejects. */
export const isRejectedBonusesKey = (key: string) => key.startsWith('system.bonuses');

/** One-line description of the native replacement, for diagnostics. */
export function describeMigration(migration: KeyMigration): string {
    const parts = migration.changes.map(change => `${change.key} = ${JSON.stringify(change.value)}`);
    return `${parts.join(' and ')}${migration.note ? ` (${migration.note})` : ''}`;
}
