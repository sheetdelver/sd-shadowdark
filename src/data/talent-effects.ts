// TODO: Create tooling to generate custom effects (e.g. valid Item structure) from a schema
// so we can fallback to creating them if a UUID isn't found or for custom homebrew effects.

export interface PredefinedEffect {
    name: string;
    uuid: string;
}

export const BOON_TYPE_MAP: Record<string, string> = {
    "blessing": "Blessing",
    "oath": "Oath",
    "secret": "Secret"
};

// TODO: Move this to a schema
export const VARIABLE_DURATIONS = [
    "days",
    "hours",
    "minutes",
    "realTime",
    "rounds",
    "seconds",
    "turns"
];

// TODO: Move this to a schema
export const EFFECT_DURATION_MAP: Record<string, string> = {
    "instant": "Instant",
    "rounds": "Rounds",
    "turns": "Turns",
    "seconds": "Seconds",
    "minutes": "Minutes",
    "hours": "Hours",
    "days": "Days",
    "focus": "Focus",
    "permanent": "Permanent",
    "unlimited": "Unlimited"
};

// TODO: Move this to a schema
export const SPELL_RANGE_MAP: Record<string, string> = {
    "self": "Self",
    "touch": "Touch",
    "close": "Close",
    "near": "Near",
    "doubleNear": "Double Near",
    "far": "Far",
    "oneMile": "1 Mile",
    "samePlane": "On the same plane",
    "unlimited": "Unlimited"
};

export const WEAPON_TYPE_MAP: Record<string, string> = {
    "melee": "Melee",
    "ranged": "Ranged"
}

export const EFFECT_TRANSLATIONS_MAP: Record<string, string> = {
    "system.abilities.cha.base": "Cha",
    "system.abilities.cha.bonus": "Cha",
    "system.abilities.con.base": "Con",
    "system.abilities.con.bonus": "Con",
    "system.abilities.dex.base": "Dex",
    "system.abilities.dex.bonus": "Dex",
    "system.abilities.int.base": "Int",
    "system.abilities.int.bonus": "Int",
    "system.abilities.str.base": "Str",
    "system.abilities.str.bonus": "Str",
    "system.abilities.wis.base": "Wis",
    "system.abilities.wis.bonus": "Wis",
    "system.bonuses.acBonus": "Armor AC Bonus",
    "system.bonuses.advantage": "Advantage Bonus",
    "system.bonuses.armorMastery": "Armor Mastery",
    "system.bonuses.attackBonus": "Attack Bonus",
    "system.bonuses.backstabDie": "Extra Backstab Die",
    "system.bonuses.critical.failureThreshold": "Higher Critical Failure Threshold",
    "system.bonuses.critical.multiplier": "Critical Multiplier",
    "system.bonuses.critical.successThreshold": "Lower Critical Success Threshold",
    "system.bonuses.damageBonus": "Damage Bonus",
    "system.bonuses.gearSlots": "Slots",
    "system.bonuses.meleeAttackBonus": "Melee Attack Roll Bonus",
    "system.bonuses.meleeDamageBonus": "Melee Damage Roll Bonus",
    "system.bonuses.rangedAttackBonus": "Ranged Attack Roll Bonus",
    "system.bonuses.rangedDamageBonus": "Ranged Damage Roll Bonus",
    "system.bonuses.stoneSkinTalent": "Stone Skin Talent",
    "system.bonuses.spellcastingCheckBonus": "Spellcasting Bonus",
    "system.bonuses.spellcastingClasses": "Bonus Spellcasting Class",
    "system.bonuses.weaponMastery": "Weapon Mastery"
};

// TODO: Create tooling to generate custom effects (e.g. valid Item structure) from a schema
// so we can fallback to creating them if a UUID isn't found or for custom homebrew effects.

// Map of descriptive keys to Shadowdark Compendium UUIDs
// Keys are derived from filenames/concepts for easier lookup
export const TALENT_EFFECTS_MAP: Record<string, string> = {
    // Stat Improvements
    '+1 Strength': 'Compendium.shadowdark.talents.IDGFaxKnYJWWuWQ7',
    '+1 Dexterity': 'Compendium.shadowdark.talents.eJHwfYQZ9LmLQeSn',
    '+1 Constitution': 'Compendium.shadowdark.talents.8SXPsiWvG2UcXGgW',
    '+1 Intelligence': 'Compendium.shadowdark.talents.LDJCx5syOcenLMZf',
    '+1 Wisdom': 'Compendium.shadowdark.talents.vRW8GSIKWXyOAKbw',
    '+1 Charisma': 'Compendium.shadowdark.talents.5INkcbMVFxK6cW5Z',

    '+2 Strength': 'Compendium.shadowdark.talents.6t06nSjj1hd6o5SV',
    '+2 Dexterity': 'Compendium.shadowdark.talents.vIbwotCa1eqCVZMU',
    '+2 Constitution': 'Compendium.shadowdark.talents.ZfaFn8TDum3NXYZN',
    '+2 Intelligence': 'Compendium.shadowdark.talents.aRY0hjpvzYpdRbfR',
    '+2 Wisdom': 'Compendium.shadowdark.talents.excvhYcpm1qd09IV',
    '+2 Charisma': 'Compendium.shadowdark.talents.UE2xABVKD0oCDtdx',

    // Combat Bonuses
    '+1 Melee Attacks': 'Compendium.shadowdark.talents.93QoQQ6cI7xa4TCm',
    '+1 Melee Damage': 'Compendium.shadowdark.talents.S4zOvXqPlLLNmGKl',
    '+1 Ranged Attacks': 'Compendium.shadowdark.talents.Y3Ytsye5zrP43w70',
    '+1 Melee and Ranged Attacks': 'Compendium.shadowdark.talents.WSm6JESNoyFBnkW2',
    'Advantage on Melee Attacks': 'Compendium.shadowdark.talents.6iJ6ETUAKC7DR0aT',
    'Backstab +1 Dice': 'Compendium.shadowdark.talents.HzzgAIdhoAyfeItJ',
    'Backstab': 'Compendium.shadowdark.talents.KLDZKFY6SrqQKSva',
    'Armor Mastery': 'Compendium.shadowdark.talents.BsRPGhKXYwJBI9ex',
    'Shield Wall': 'Compendium.shadowdark.talents.KMMpRWDsIybiDW7u',
    'Weapon Mastery': 'Compendium.shadowdark.talents.5bpWuaT0KTNzuzCu',
    'Grit (Strength)': 'Compendium.shadowdark.talents.F0NXUJcnBOYKzhMi',
    'Grit (Dexterity)': 'Compendium.shadowdark.talents.DGZqkVUtcmxejdm1',

    // Spellcasting
    '+1 Spellcasting Checks': 'Compendium.shadowdark.talents.0WmG5j0Wv685YTqO', // _1_on_spellcasting_checks
    'Spellcasting Advantage': 'Compendium.shadowdark.talents.IZZnFjWhZurAIZPP',
    'Magic Resistance': 'Compendium.shadowdark.talents.52dWOJ8zzxCwfM1B',
    'Magical Dabbler': 'Compendium.shadowdark.talents.Om7QWre7U4Tbh84B',
    'Learn Extra Spell': 'Compendium.shadowdark.talents.Ey3P0EplF5SHIdey',
    'Wizard Spellcasting': 'Compendium.shadowdark.talents.Td6iQW4hVJLZLVLi',
    'Priest Spellcasting': 'Compendium.shadowdark.talents.EYRxfb5BUEzH1w3b',
    'Seer Spellcasting': 'Compendium.shadowdark.talents.Qu0KqU3KzzRS1oer',
    'Witch Spellcasting': 'Compendium.shadowdark.talents.7XtnCM9VdxVmh6D3',

    // HP & Misc
    'Additional HP': 'Compendium.shadowdark.talents.Z7og9OPv8PKFuWmQ',
    'Stout': 'Compendium.shadowdark.talents.MW43tnJr6lqE1Ty8',
    '+1 AC': 'Compendium.shadowdark.talents.aFltU1eRz4bmIlbj',

    // Thief/Class Specific
    'Thievery': 'Compendium.shadowdark.talents.TiaXUSTLoJpjfyxD',
    'Stealthy': 'Compendium.shadowdark.talents.zkOiprnKS5uttiO6',
    'Ambush': 'Compendium.shadowdark.talents.pOuKrF2CMkxt7EQG', // trained_assassin

    // Generic Ability Improvements (likely from Boons or other sources)
    'Ability Score Improvement (Str)': 'Compendium.shadowdark.talents.IDGFaxKnYJWWuWQ7',
    'Ability Score Improvement (Dex)': 'Compendium.shadowdark.talents.eJHwfYQZ9LmLQeSn',
    'Ability Score Improvement (Con)': 'Compendium.shadowdark.talents.8SXPsiWvG2UcXGgW',
    'Ability Score Improvement (Int)': 'Compendium.shadowdark.talents.LDJCx5syOcenLMZf',
    'Ability Score Improvement (Wis)': 'Compendium.shadowdark.talents.vRW8GSIKWXyOAKbw',
    'Ability Score Improvement (Cha)': 'Compendium.shadowdark.talents.5INkcbMVFxK6cW5Z',
};

// Mapping of Talent UUIDs to Spell UUIDs they grant (to be excluded from spell count)
// Note: We use the tail of the UUID for matching if needed, but primary check should be full UUID.
export const TALENT_GRANTED_SPELLS: Record<string, string> = {
    "LfHTnYW8I65x8Y31": "mByUvcHIVEPWscfH" // Turn Undead Talent -> Turn Undead Spell
};

// Helper to find partial matches
export const findEffectUuid = (text: string): string | null => {
    const normalized = text.toLowerCase();
    for (const [key, uuid] of Object.entries(TALENT_EFFECTS_MAP)) {
        if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
            return uuid;
        }
    }
    return null;
};
