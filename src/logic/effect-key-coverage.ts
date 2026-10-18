import { nativeKeyMigration, isRejectedBonusesKey } from './legacy-effect-keys';

/**
 * Where each ActiveEffect key is consumed, mirroring native Shadowdark 4.0.6.
 * The conformance test walks every effect key in the pinned native packs and
 * requires each to land in a known category here, and checks that the roll-key
 * bases below equal the `_getActiveEffectKeys` bases native reads. A new native
 * key therefore fails the test until its handling is decided.
 */
export type EffectKeyUse =
    | { kind: 'actor-data'; detail: string }
    | { kind: 'roll-key'; base: string }
    | { kind: 'choice-template'; detail: string }
    | { kind: 'pre-4.0'; detail: string }
    | { kind: 'native-no-op'; detail: string }
    | { kind: 'out-of-scope'; detail: string }
    | { kind: 'unknown' };

const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/**
 * Roll-key bases the module reads (logic/actions.ts, actor-preparation.ts),
 * written as native writes them in PlayerSD/NpcSD/_ActorBaseSD/LevelUpSD.
 * `<attack>` is melee|ranged; `<key>` is an attack type or `spell`.
 */
export const MODULE_ROLL_KEY_BASES = [
    'roll.<attack>.bonus', 'roll.<attack>.advantage',
    'roll.<key>.critical-success', 'roll.<key>.critical-failure', 'roll.<key>.critical-multiplier',
    'roll.<key>.upgrade-damage-die', 'roll.<key>.extra-damage-die', 'roll.<key>.damage',
    'roll.ability.bonus', 'roll.ability.advantage', 'roll.stat.bonus.<stat>', 'roll.stat.advantage.<stat>',
    'roll.spell.bonus', 'roll.spell.advantage', 'roll.hp.advantage',
    'attributes.ac', 'attributes.ac.unarmored', 'attributes.ac.value',
] as const;

/** Concrete `system.` bases, with native `_getActiveEffectKeys` expansions (attack, stat `all`). */
function concreteBases(): string[] {
    const out = new Set<string>();
    for (const pattern of MODULE_ROLL_KEY_BASES) {
        const expand = (value: string) => out.add(`system.${value}`);
        if (pattern.includes('<attack>')) for (const attack of ['melee', 'ranged']) {
            expand(pattern.replace('<attack>', attack));
            expand(pattern.replace('<attack>', 'attack'));
        }
        else if (pattern.includes('<key>')) for (const key of ['melee', 'ranged', 'attack', 'spell']) expand(pattern.replace('<key>', key));
        else if (pattern.includes('<stat>')) for (const stat of [...STATS, 'all']) expand(pattern.replace('<stat>', stat));
        else expand(pattern);
    }
    return [...out].sort((a, b) => b.length - a.length);
}
const BASES = concreteBases();

/** Actor data fields native defines (PlayerSD schema/prepareBaseData) or reads via roll data. */
const ACTOR_DATA = [
    /^system\.abilities\.(str|dex|con|int|wis|cha)\.value$/, /^system\.attributes\.hp\.(max|value)$/,
    /^system\.slots$/, /^system\.languages$/, /^system\.spellcasting\.(classes|allowAllItems|itemAbility)$/,
    /^system\.roll\.initiative\.(bonus|advantage)$/, /^system\.bonus\.[a-z0-9]+$/i,
];

/** Keys present in native data that native 4.0.6 itself never reads. */
export const NATIVE_NO_OP_KEYS: Record<string, string> = {
    'system.roll.dex.advantage': 'Native reads stat check advantage as system.roll.stat.advantage.dex; nothing reads roll.dex.advantage (pack Stone Skin Advantage on Hide).',
    'system.attributes.ac.all': '_getActiveEffectKeys excludes system.attributes.ac.all for armor items, and unarmored AC reads only attributes.ac.unarmored (Wolf / Winter Wolf).',
};

/** Native keys whose consumers SheetDelver deliberately does not run. */
export const OUT_OF_SCOPE_KEYS: Record<string, string> = {
    'system.light.template': 'Native scene lighting (ActorSD.toggleLight, EffectPanelSD); SheetDelver does not run scene light (deferred DW-04).',
};

export function classifyEffectKey(key: string): EffectKeyUse {
    if (OUT_OF_SCOPE_KEYS[key] || key.startsWith('token.')) return { kind: 'out-of-scope', detail: OUT_OF_SCOPE_KEYS[key] ?? 'Token data is applied by Foundry scenes, not Actor preparation.' };
    if (key.includes('REPLACEME')) return { kind: 'choice-template', detail: 'resolved by a declared choice before the effect is created' };
    if (NATIVE_NO_OP_KEYS[key]) return { kind: 'native-no-op', detail: NATIVE_NO_OP_KEYS[key] };
    const migration = nativeKeyMigration({ key, value: 'x' });
    if (migration || isRejectedBonusesKey(key)) return { kind: 'pre-4.0', detail: migration ? `native migration renames it (${migration.changes.map(change => change.key).join(', ')})` : 'rejected by native applyRules' };
    if (ACTOR_DATA.some(pattern => pattern.test(key))) return { kind: 'actor-data', detail: 'applied to prepared actor data by phase and priority' };
    const base = BASES.find(candidate => key === candidate || key.startsWith(`${candidate}.`));
    if (base) return { kind: 'roll-key', base };
    return { kind: 'unknown' };
}
