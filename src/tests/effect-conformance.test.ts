import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import snapshot from './fixtures/native-406-effect-keys.json';
import { classifyEffectKey, MODULE_ROLL_KEY_BASES } from '../logic/effect-key-coverage';
import { nativeKeyMigration } from '../logic/legacy-effect-keys';
import { NATIVE_PREDEFINED_EFFECTS, NATIVE_REJECTED_PREDEFINED } from '../data/native-predefined-effects';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { prepareActorCore } from '../logic/actor-preparation';
import { hitPointRollFormula, prepareRequestedAction } from '../logic/actions';
import { modeToType } from '../logic/foundry';
import { TALENT_HANDLERS } from '../logic/talent-handlers';
import { TALENT_EFFECTS_MAP } from '../data/talent-effects';
import { actorEffectsInScope, planEffectMigration } from '../logic/effect-key-migration';
import { serializeChanges } from '../logic/effects';
import { apiRoutes } from '../server/index';

/**
 * Effect conformance against native Shadowdark 4.0.6 (release-4.0.6,
 * 9677d16b3903b3b640f00d4efd48249142ac8334). This keeps the module from drifting
 * away from native effect data:
 *
 * 1. Every effect key in the native packs (tracked snapshot) has a known consumer.
 * 2. With the native reference checked out (SHADOWDARK_NATIVE_REF or Core
 *    temp/shadowdark), the snapshot, roll-key bases and predefined effects are
 *    re-derived from native source and must match.
 * 3. Representative native effects produce native-expected results in both the
 *    Foundry 13 and Foundry 14 serialized shapes (expected values worked from
 *    native PlayerSD/_ActorBaseSD/LevelUpSD code, not module output).
 * 4. Keys the module itself writes are native 4.0 keys; pre-4.0 keys are
 *    reported with native's own migration replacement and never applied.
 * 5. The migration planner and effect serializer, called directly: renames,
 *    multi-change replacements, unknown fields, idempotency and unresolved keys.
 */
type Result = { id: string; name: string; ok: boolean; detail?: string };
const results: Result[] = [];
function check(id: string, name: string, fn: () => void) {
    try { fn(); results.push({ id, name, ok: true }); }
    catch (error) { results.push({ id, name, ok: false, detail: (error as Error).message.split('\n')[0] }); }
}

type Change = { key: string; mode: number; value: string };
const rows = (snapshot as any).keys as Array<{ key: string; mode: number; value: unknown; parentType: string | null; source: string }>;

// 1. Coverage of every native key.
check('EC-1', `all ${rows.length} native 4.0.6 effect keys have a known consumer`, () => {
    const unknown = rows.filter(row => classifyEffectKey(row.key).kind === 'unknown').map(row => `${row.key} (${row.source})`);
    assert.deepEqual(unknown, []);
});
check('EC-1', 'native 4.0.6 data carries no pre-4.0 keys (only orphaned pack files did)', () => {
    assert.deepEqual(rows.filter(row => classifyEffectKey(row.key).kind === 'pre-4.0').map(row => row.key), []);
});

// 2. Drift checks against the pinned native source, when present.
const nativeRoot = process.env.SHADOWDARK_NATIVE_REF ?? join(process.cwd(), 'temp/shadowdark');
const haveNative = existsSync(join(nativeRoot, 'system/src/config.mjs')) && existsSync(join(nativeRoot, 'data/packs'));
if (!haveNative) {
    results.push({ id: 'EC-2', name: 'native source drift checks (skipped: native 4.0.6 reference not present)', ok: true });
} else {
    check('EC-2', 'tracked key snapshot equals the native packs (listed effects only)', () => {
        const packs = join(nativeRoot, 'data/packs');
        const docs: any[] = [];
        for (const pack of readdirSync(packs).sort()) for (const file of readdirSync(join(packs, pack)).sort()) docs.push(JSON.parse(readFileSync(join(packs, pack, file), 'utf8')));
        const listed = new Map<string, Set<string>>();
        for (const doc of docs) {
            const key = String(doc._key ?? '');
            if (!key.includes('.effects!') && key.split('!').length >= 3) listed.set(key.split('!')[2], new Set(doc.effects ?? []));
        }
        const keys = new Set<string>();
        for (const doc of docs) {
            const key = String(doc._key ?? '');
            if (!key.includes('.effects!')) continue;
            const full = key.split('!')[2];
            const at = full.lastIndexOf('.');
            if (!listed.get(full.slice(0, at))?.has(full.slice(at + 1))) continue;
            for (const change of doc.changes ?? []) keys.add(change.key);
        }
        assert.deepEqual([...keys].sort(), rows.map(row => row.key));
    });
    check('EC-2', 'module roll-key bases equal native _getActiveEffectKeys bases', () => {
        const bases = new Set<string>();
        const walk = (dir: string) => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
                const path = join(dir, entry.name);
                if (entry.isDirectory()) walk(path);
                else if (entry.name.endsWith('.mjs')) {
                    for (const match of readFileSync(path, 'utf8').matchAll(/_getActiveEffectKeys\(\s*([`"])([^`"]+)\1/g)) {
                        bases.add(match[2].replace(/^system\./, '').replace('${config.attack.type}', '<attack>').replace('${key}', '<key>').replace('${ability}', '<stat>'));
                    }
                }
            }
        };
        walk(join(nativeRoot, 'system/src'));
        assert.deepEqual([...bases].sort(), [...MODULE_ROLL_KEY_BASES].sort());
    });
    check('EC-2', 'every importer talent mapping points at an existing native Talent', () => {
        const talents = new Set(readdirSync(join(nativeRoot, 'data/packs/talents.db')).map(file => JSON.parse(readFileSync(join(nativeRoot, 'data/packs/talents.db', file), 'utf8')))
            .filter((doc: any) => doc.type === 'Talent').map((doc: any) => doc._id));
        const missing = Object.entries(TALENT_EFFECTS_MAP).filter(([, uuid]) => !talents.has(uuid.split('.').pop()!)).map(([name]) => name);
        assert.deepEqual(missing, []);
    });
    check('EC-2', 'generated predefined effects match native config.mjs', () => {
        const config = readFileSync(join(nativeRoot, 'system/src/config.mjs'), 'utf8');
        const native = [...config.matchAll(/^\t([A-Za-z0-9]+): \{[^}]*?effectKey: "([^"]+)"[^}]*?mode: "CONST\.ACTIVE_EFFECT_MODES\.([A-Z]+)"/gms)]
            .map(match => `${match[1]} ${match[2]} ${match[3].toLowerCase()}`).sort();
        const module = Object.entries(NATIVE_PREDEFINED_EFFECTS).map(([name, entry]) => `${name} ${entry.key} ${modeToType(entry.mode)}`).sort();
        assert.ok(native.length >= 30, `parsed ${native.length} native entries`);
        assert.deepEqual(module, native);
    });
}

// 3. Native-expected behaviour for representative effects, in both shapes.
const WIZ = 'Compendium.shadowdark.classes.Item.wiz';
const lookups: any = {
    classDocument: (ref: any) => ref.id === 'wiz' ? { name: 'Wizard', type: 'Class', system: { spellcasting: { ability: 'int' } } } : null,
    spellDocument: () => null, propertyName: () => null, label: () => null,
};
const weapon = (id: string, name: string, system: any) => ({ _id: id, name, type: 'Weapon', effects: [] as any[], system: { equipped: true, stashed: false, quantity: 1,
    slots: { slots_used: 1, per_slot: 1, free_carry: 0 }, properties: [], baseWeapon: '', identification: { identified: true }, ...system } });
const effectOf = (changes: Change[], shape: 'legacy' | 'v14', name = 'Carrier') => shape === 'legacy'
    ? { _id: 'e1', name, disabled: false, transfer: true, changes, system: {} }
    : { _id: 'e1', name, disabled: false, transfer: true, system: { changes: changes.map(change => ({ key: change.key, type: modeToType(change.mode), value: change.value, phase: 'initial', priority: null })) } };
function probeActor(changes: Change[], shape: 'legacy' | 'v14', options: { noArmor?: boolean; weaponEffect?: Change[]; spellClassKey?: string } = {}) {
    const longsword = weapon('ls', 'Longsword', { type: 'melee', range: 'close', damage: { oneHanded: 'd8', twoHanded: '' } });
    if (options.weaponEffect) longsword.effects = [effectOf(options.weaponEffect, shape, 'Weapon AE')];
    return { _id: 'p', name: 'Probe', type: 'Player', effects: [],
        system: { abilities: { str: { base: 14 }, dex: { base: 12 }, con: { base: 9 }, int: { base: 10 }, wis: { base: 10 }, cha: { base: 10 } },
            attributes: { hp: { value: 10, base: 10 }, ac: { value: 10 } }, level: { value: 3, xp: 0 }, class: WIZ, languages: [] },
        items: [longsword,
            weapon('bow', 'Shortbow', { type: 'ranged', range: 'far', damage: { oneHanded: '', twoHanded: 'd4' } }),
            ...(options.noArmor ? [] : [{ _id: 'leather', name: 'Leather Armor', type: 'Armor', effects: [], system: { equipped: true, ac: { base: 11, attribute: 'dex', modifier: 0 }, properties: [], baseArmor: '', slots: { slots_used: 1, per_slot: 1 } } }]),
            { _id: 'mm', name: 'Magic Missile', type: 'Spell', effects: [], system: { tier: 1, class: [WIZ], lost: false, range: 'far', formula: '1d4', damageType: 'damage' } },
            { _id: 'sc', name: 'Spellcasting', type: 'Talent', system: {}, effects: [effectOf([{ key: options.spellClassKey ?? 'system.spellcasting.classes', mode: 2, value: 'wizard' }], shape, 'Spell Class')] },
            { _id: 'carrier', name: 'Carrier', type: 'Talent', system: {}, effects: [effectOf(changes, shape)] }] };
}
const view = (changes: Change[], shape: 'legacy' | 'v14', options = {}) => prepareShadowdarkView(probeActor(changes, shape, options), lookups) as any;
const action = (v: any, predicate: (entry: any) => boolean) => v.actions.find(predicate);
const melee = (v: any) => action(v, entry => entry.kind === 'attack' && entry.itemId === 'ls');
const ranged = (v: any) => action(v, entry => entry.kind === 'attack' && entry.itemId === 'bow');
const statCheck = (v: any, stat: string) => action(v, entry => entry.kind === 'check' && entry.request.stat === stat);
const spell = (v: any) => action(v, entry => entry.kind === 'spell' && entry.itemId === 'mm');
const notes = (v: any) => [...v.diagnostics, ...v.effects.flatMap((effect: any) => effect.diagnostics)].join(' | ');

// Baseline (no effects): STR 14 (+2), DEX 12 (+1), CON 9 (-1), Leather 11 + DEX = AC 12,
// slots 10 + (14 - 10) = 14, Longsword +2 d8, Shortbow +1 d4, Magic Missile INT +0.
const cases: Array<[string, Change[], (v: any) => unknown, unknown, any?]> = [
    ['+2 CON talent (ADD "2")', [{ key: 'system.abilities.con.value', mode: 2, value: '2' }], v => `${v.abilities.con.value}/${v.abilities.con.mod}`, '11/0'],
    ['Disease (ADD "-2")', [{ key: 'system.abilities.con.value', mode: 2, value: '-2' }], v => `${v.abilities.con.value}/${v.abilities.con.mod}`, '7/-2'],
    ['Permanent Ability STR (OVERRIDE 18)', [{ key: 'system.abilities.str.value', mode: 5, value: '18' }], v => `${v.abilities.str.value} ${melee(v).bonus} ${v.maxSlots}`, '18 4 18'],
    ['Feeble STR (DOWNGRADE 3)', [{ key: 'system.abilities.str.value', mode: 3, value: '3' }], v => `${v.abilities.str.value}/${v.abilities.str.mod}`, '3/-4'],
    ['AC Bonus (ac.value ADD 1)', [{ key: 'system.attributes.ac.value', mode: 2, value: '1' }], v => v.ac, 13],
    ['AC OVERRIDE 17', [{ key: 'system.attributes.ac.value', mode: 5, value: '17' }], v => v.ac, 17],
    ['Armor Mastery (ac.leather-armor ADD 1)', [{ key: 'system.attributes.ac.leather-armor', mode: 2, value: '1' }], v => v.ac, 13],
    ['Stone Skin while armored', [{ key: 'system.attributes.ac.unarmored', mode: 2, value: '2+floor(@level.value/2)' }], v => v.ac, 12],
    ['Stone Skin unarmored (10 + 1 + 3)', [{ key: 'system.attributes.ac.unarmored', mode: 2, value: '2+floor(@level.value/2)' }], v => v.ac, 14, { noArmor: true }],
    ['Wolf ac.all (native no-op)', [{ key: 'system.attributes.ac.all', mode: 5, value: '12' }], v => v.ac, 12],
    ['Extra HP Max (ADD 2)', [{ key: 'system.attributes.hp.max', mode: 2, value: '2' }], v => v.hp.max, 12],
    ['Additional Gear Slots (ADD 10)', [{ key: 'system.slots', mode: 2, value: '10' }], v => v.maxSlots, 24],
    ['Hauler (max(@abilities.con.mod, 0) at CON 9)', [{ key: 'system.slots', mode: 2, value: 'max(@abilities.con.mod, 0)' }], v => v.maxSlots, 14],
    ['attack.bonus.all ADD 1', [{ key: 'system.roll.attack.bonus.all', mode: 2, value: '1' }], v => `${melee(v).bonus}/${ranged(v).bonus}`, '3/2'],
    ['attack.damage.all ADD 1', [{ key: 'system.roll.attack.damage.all', mode: 2, value: '1' }], v => `${melee(v).damage.formula}/${ranged(v).damage.formula}`, 'd8+1/d4+1'],
    ['critical-success.all OVERRIDE 18', [{ key: 'system.roll.attack.critical-success.all', mode: 5, value: '18' }], v => `${melee(v).critical.success}/${ranged(v).critical.success}`, '18/18'],
    ['critical-failure.all OVERRIDE 3', [{ key: 'system.roll.attack.critical-failure.all', mode: 5, value: '3' }], v => melee(v).critical.failure, 3],
    ['critical-multiplier.this on the Longsword', [], v => `${melee(v).critical.multiplier}/${ranged(v).critical.multiplier}`, '4/2', { weaponEffect: [{ key: 'system.roll.attack.critical-multiplier.this', mode: 5, value: '4' }] }],
    ['upgrade-damage-die.longsword ADD 1', [{ key: 'system.roll.attack.upgrade-damage-die.longsword', mode: 2, value: '1' }], v => melee(v).damage.formula, 'd10'],
    ['Backstab extra dice (1 + backstabdice 1 + floor(3/2))', [{ key: 'system.bonus.backstabdice', mode: 2, value: '1' }, { key: 'system.roll.attack.extra-damage-die.all', mode: 2, value: '1+@bonus.backstabdice+floor(@level.value/2)' }], v => melee(v).damage.formula, 'd8+3d8'],
    ['melee.advantage.all ADD 1', [{ key: 'system.roll.melee.advantage.all', mode: 2, value: '1' }], v => `${melee(v).advantage}/${ranged(v).advantage}`, '1/0'],
    ['ranged.bonus.all ADD 1', [{ key: 'system.roll.ranged.bonus.all', mode: 2, value: '1' }], v => `${melee(v).bonus}/${ranged(v).bonus}`, '2/2'],
    ['spell.bonus.all ADD 1', [{ key: 'system.roll.spell.bonus.all', mode: 2, value: '1' }], v => spell(v).bonus, 1],
    ['spell.advantage.magic-missile ADD 1', [{ key: 'system.roll.spell.advantage.magic-missile', mode: 2, value: '1' }], v => spell(v).advantage, 1],
    ['Destined spell damage d@bonus.destineddie', [{ key: 'system.bonus.destineddie', mode: 2, value: '2' }, { key: 'system.roll.spell.damage.all', mode: 2, value: 'd@bonus.destineddie' }], v => spell(v).damage?.formula, '1d4+d2'],
    ['stat.advantage.dex ADD 1', [{ key: 'system.roll.stat.advantage.dex', mode: 2, value: '1' }], v => `${statCheck(v, 'dex').advantage}/${statCheck(v, 'str').advantage}`, '1/0'],
    ['stat.bonus.all ADD 1', [{ key: 'system.roll.stat.bonus.all', mode: 2, value: '1' }], v => `${statCheck(v, 'dex').bonus}/${statCheck(v, 'con').bonus}`, '2/0'],
    ['roll.dex.advantage (native no-op)', [{ key: 'system.roll.dex.advantage', mode: 2, value: '1' }], v => statCheck(v, 'dex').advantage, 0],
    ['initiative.advantage ADD 1', [{ key: 'system.roll.initiative.advantage', mode: 2, value: '1' }], v => v.initiative.advantage, 1],
    ['allowAllItems ADD true', [{ key: 'system.spellcasting.allowAllItems', mode: 2, value: 'true' }], v => v.spellcasting.allowAllItems, true],
    ['itemAbility ADD cha', [{ key: 'system.spellcasting.itemAbility', mode: 2, value: 'cha' }], v => v.spellcasting.itemAbility, 'cha'],
    ['Speak Goblin (languages ADD uuid) shown as granted', [{ key: 'system.languages', mode: 2, value: 'Compendium.shadowdark.languages.Item.b5yBrLaRIl7ZEWKu' }],
        v => `${v.identity.languages.length}:${v.identity.grantedLanguages.map((entry: any) => entry.ref?.id).join(',')}`, '0:b5yBrLaRIl7ZEWKu'],
    // 4. Pre-4.0 keys written by SheetDelver 0.9.4 and earlier: not applied, explained.
    ['SheetDelver 0.9.4 "+2 CON" (con.bonus) is reported, not applied', [{ key: 'system.abilities.con.bonus', mode: 2, value: '2' }],
        v => `${v.abilities.con.value} ${/con\.bonus: pre-4\.0 key.*system\.abilities\.con\.value = "2"/.test(notes(v))}`, '9 true'],
    ['pre-4.0 wis.base is reported with its 4.0 key', [{ key: 'system.abilities.wis.base', mode: 5, value: '18' }],
        v => `${v.abilities.wis.value} ${/system\.abilities\.wis\.value = "18"/.test(notes(v))}`, '10 true'],
    ['pre-4.0 bonuses.attackBonus is reported with its 4.0 key', [{ key: 'system.bonuses.attackBonus', mode: 2, value: '1' }],
        v => `${melee(v).bonus} ${/system\.roll\.attack\.bonus\.all/.test(notes(v))}`, '2 true'],
    ['SheetDelver 0.9.4 spellcasting class (bonuses.spellcastingClasses) gives no caster class', [],
        v => `${v.spellcasting.classes.join(',') || 'none'} ${spell(v).available} ${/system\.spellcasting\.classes = "wizard"/.test(notes(v))}`, 'none false true',
        { spellClassKey: 'system.bonuses.spellcastingClasses' }],
];
for (const shape of ['legacy', 'v14'] as const) {
    for (const [name, changes, read, expected, options] of cases) {
        check('EC-3', `[${shape}] ${name}`, () => assert.deepEqual(read(view(changes, shape, options)), expected));
    }
}
check('EC-3', 'the pre-4.0 note is attached to the effect shown on the Effects tab', () => {
    const v = view([{ key: 'system.abilities.con.bonus', mode: 2, value: '2' }], 'v14');
    const carrier = v.effects.find((effect: any) => effect.name === 'Carrier');
    assert.match(carrier.diagnostics.join(' '), /con\.bonus: pre-4\.0 key; native Shadowdark 4\.0\.6 ignores it\. Its 4\.0 equivalent is system\.abilities\.con\.value = "2"/);
});
if (haveNative) for (const shape of ['legacy', 'v14'] as const) {
    check('EC-3', `[${shape}] two native Backstab awards stack at level4`, () => {
        const pack = join(nativeRoot, 'data/packs/talents.db');
        const talent = JSON.parse(readFileSync(join(pack, 'backstab__1_damage_dice__HzzgAIdhoAyfeItJ.json'), 'utf8'));
        const effect = JSON.parse(readFileSync(join(pack, 'additional_backstab_die__AmcPerJgnykmMwVA.json'), 'utf8'));
        const actor: any = probeActor([], shape); actor.system.level.value = 4;
        actor.items.push(...[1,3].map(level => ({ ...structuredClone(talent), _id: `backstab-${level}`, system: { ...talent.system, level }, effects: [effectOf(effect.changes, shape, effect.name)] })));
        assert.equal(prepareActorCore(actor, lookups).effective.bonus.backstabdice, 2);
    });
    check('EC-3', `[${shape}] native Destined references resolve after its later die effect, including upgrades`, () => {
        const pack = join(nativeRoot, 'data/packs/talents.db');
        const talent = JSON.parse(readFileSync(join(pack, 'destined__Az2fXCwgo5C3x2X7.json'), 'utf8'));
        const files = readdirSync(pack).map(file => JSON.parse(readFileSync(join(pack, file), 'utf8')));
        talent.effects = talent.effects.map((id: string) => {
            const effect = files.find(doc => doc._id === id);
            return { ...effect, ...effectOf(effect.changes, shape, effect.name), _id: id };
        });
        const actor: any = probeActor([], shape); actor.items.push(talent);
        const original = structuredClone(actor);
        for (const upgraded of [false, true]) {
            const source = structuredClone(actor);
            if (upgraded) source.items.push({ _id: 'upgrade', type: 'Talent', name: 'Upgrade Destined Die', system: {},
                effects: [effectOf([{ key: 'system.bonus.destineddie', mode: 2, value: '2' }], shape)] });
            const core = prepareActorCore(source, lookups);
            assert.equal(core.effective.bonus.destineddie, upgraded ? 8 : 6);
            assert.equal(core.effects.flatMap(effect => effect.diagnostics).filter(note => note.includes('@bonus.destineddie')).length, 0);
            assert.equal(core.diagnostics.filter(note => note.includes('@bonus.destineddie')).length, 0);
            const selected = core.effects.filter(effect => effect.situational).map(effect => effect.ref);
            for (const request of [{ kind: 'check', stat: 'str' }, { kind: 'attack', itemId: 'ls' }, { kind: 'spell', itemId: 'mm' }] as const) {
                const base = prepareRequestedAction(core, source, lookups, request)!;
                const action = prepareRequestedAction(core, source, lookups, { ...request, selected })!;
                assert.ok(String(action.bonus).includes(upgraded ? 'd8' : 'd6'), String(action.bonus));
                assert.ok(!String(base.bonus).includes('d6'), String(base.bonus));
                if (request.kind !== 'check') assert.ok(String(action.damage?.formula).includes(upgraded ? '+d8' : '+d6'), String(action.damage?.formula));
                assert.ok(!action.diagnostics.some(note => note.includes('@bonus.destineddie')));
            }
        }
        assert.deepEqual(actor, original);
        // Disabling the actual supplier must still report a real missing value.
        talent.effects.find((effect: any) => effect.name === 'Destined Die').disabled = true;
        const missing = prepareActorCore(actor, lookups);
        assert.ok(missing.effects.find(effect => effect.name === 'Destined')?.diagnostics.some(note => note.includes('@bonus.destineddie')));
    });
}
check('EC-3', 'HP Roll Advantage turns the level-up hit die into 2dNkh (LevelUpSD + dice.applyAdvantage)', () => {
    const source = probeActor([{ key: 'system.roll.hp.advantage', mode: 2, value: '1' }], 'v14');
    assert.equal(hitPointRollFormula(prepareActorCore(source, lookups), '1d8').formula, '2d8kh');
    assert.equal(hitPointRollFormula(prepareActorCore(probeActor([], 'v14'), lookups), '1d8').formula, '1d8');
});

// 4. Keys the module writes are native 4.0 keys.
check('EC-4', 'every module predefined effect uses a native 4.0 key with a consumer (scene light explicitly out of scope)', () => {
    const kinds = Object.entries(NATIVE_PREDEFINED_EFFECTS).filter(([name]) => !NATIVE_REJECTED_PREDEFINED[name])
        .map(([name, entry]) => [name, classifyEffectKey(entry.key.replace('REPLACEME', 'longsword')).kind] as const);
    assert.deepEqual(kinds.filter(([, kind]) => !['actor-data', 'roll-key'].includes(kind)), [['lightSource', 'out-of-scope']]);
});
check('EC-4', 'stat improvement handlers write system.abilities.<stat>.value', () => {
    const handler = TALENT_HANDLERS.find(entry => entry.id === 'stat-improvement')!;
    const item: any = { name: 'Stat Improvement', type: 'Talent', system: {}, effects: [] };
    handler.mutateItem!(item, { statSelection: { selected: ['con', 'wis'] } });
    const keys = item.effects.flatMap((effect: any) => (effect.changes ?? effect.system?.changes ?? []).map((change: any) => change.key));
    assert.deepEqual(keys, ['system.abilities.con.value', 'system.abilities.wis.value']);
});
check('EC-4', 'native migration table covers every pre-4.0 key SheetDelver 0.9.4 wrote', () => {
    const written = ['system.abilities.con.bonus', 'system.abilities.str.base', 'system.bonuses.spellcastingClasses', 'system.bonuses.weaponMastery',
        'system.bonuses.armorMastery', 'system.bonuses.gearSlots', 'system.bonuses.backstabDie', 'system.bonuses.critical.multiplier',
        'system.bonuses.meleeAttackBonus', 'system.bonuses.rangedDamageBonus', 'system.bonuses.unarmoredAcBonus', 'system.bonuses.stoneSkinTalent'];
    assert.deepEqual(written.filter(key => !nativeKeyMigration({ key, value: 'x' })), []);
});

// 5. The migration planner and serializer, called directly (review RV-02). Expected
// replacements come from native Update_251001_1.updateEffects (see section 4).
const applyPlan = (effect: any, changes: any[]) => {
    const written = serializeChanges(effect, changes);
    return 'changes' in written ? { ...effect, changes: written.changes } : { ...effect, system: { ...effect.system, changes: written['system.changes'] } };
};
const spells = new Set(['magic-missile']);
check('EC-5', 'legacy shape: a renamed key keeps its mode, value, position and unknown fields', () => {
    const effect = { _id: 'e', name: 'Stat Improvement', flags: { core: { note: 'keep' } }, changes: [
        { key: 'system.abilities.con.bonus', mode: 2, value: '2', priority: null, custom: 'kept' },
        { key: 'system.attributes.hp.max', mode: 2, value: '1' },
    ] };
    const plan = planEffectMigration(effect, 'Talent', spells);
    assert.deepEqual(plan.migrated, [{ from: 'system.abilities.con.bonus', to: ['system.abilities.con.value'] }]);
    assert.deepEqual(plan.unresolved, []);
    const migrated = applyPlan(effect, plan.changes!);
    assert.deepEqual(migrated.changes, [
        { key: 'system.abilities.con.value', mode: 2, value: '2', priority: null, custom: 'kept' },
        { key: 'system.attributes.hp.max', mode: 2, value: '1' },
    ]);
    assert.equal(migrated.flags.core.note, 'keep'); assert.equal(migrated.system, undefined);
});
// Update_251001_1 rewrites the Weapon Mastery change in place and pushes its damage
// change onto the end of effect.changes, after every existing change.
check('EC-5', 'Foundry 14 shape: one change can become several, in native order, keeping phase', () => {
    const effect = { _id: 'e', name: 'Weapon Mastery', system: { changes: [
        { key: 'system.bonuses.weaponMastery', type: 'add', value: 'longsword', phase: 'initial', priority: null },
        { key: 'system.roll.ranged.bonus.all', type: 'add', value: 1, phase: 'final', priority: 30 },
    ] } };
    const plan = planEffectMigration(effect, 'Talent', spells);
    const changes = applyPlan(effect, plan.changes!).system.changes;
    assert.deepEqual(changes.map((change: any) => [change.key, change.type, change.value, change.phase]), [
        ['system.roll.melee.bonus.longsword', 'add', '1+floor(@level.value/2)', 'initial'],
        ['system.roll.ranged.bonus.all', 'add', 1, 'final'],
        ['system.roll.melee.damage.longsword', 'add', '1+floor(@level.value/2)', 'initial'],
    ]);
    assert.equal(changes[1].priority, 30, 'an unrelated change keeps its stored priority');
    assert.equal(changes[2].priority, null, 'the appended change takes the type default');
});
check('EC-5', 'planning a migrated effect again changes nothing (idempotent)', () => {
    const effect = { _id: 'e', changes: [{ key: 'system.bonuses.gearSlots', mode: 2, value: '2' }, { key: 'system.bonuses.advantage', mode: 2, value: 'Magic Missile' }] };
    const once = applyPlan(effect, planEffectMigration(effect, 'Talent', spells).changes!);
    assert.deepEqual(once.changes.map((change: any) => change.key), ['system.slots', 'system.roll.spell.advantage.magic-missile']);
    assert.deepEqual(planEffectMigration(once, 'Talent', spells), { changes: null, migrated: [], unresolved: [] });
});
check('EC-5', 'unresolvable keys stay unchanged and are reported', () => {
    const effect = { _id: 'e', changes: [{ key: 'system.bonuses.advantage', mode: 2, value: 'Not A Spell' }, { key: 'system.bonuses.somethingElse', mode: 2, value: '1' }] };
    const plan = planEffectMigration(effect, 'Talent', spells);
    assert.equal(plan.changes, null, 'nothing to write');
    assert.deepEqual(plan.unresolved.map(entry => entry.key), ['system.bonuses.advantage', 'system.bonuses.somethingElse']);
});
check('EC-5', 'weapon-owned keys scope to .this; Actor-level effects migrate for Players only', () => {
    const effect = { _id: 'e', changes: [{ key: 'system.bonuses.meleeAttackBonus', mode: 2, value: '1' }] };
    assert.equal(planEffectMigration(effect, 'Weapon', spells).changes![0].key, 'system.roll.melee.bonus.this');
    assert.equal(planEffectMigration(effect, 'Talent', spells).changes![0].key, 'system.roll.melee.bonus.all');
    assert.equal(actorEffectsInScope({ type: 'Player' }), true); assert.equal(actorEffectsInScope({ type: 'NPC' }), false);
});
check('EC-5', 'no caller migration route is registered (retired until Core runs migrations)', () => {
    assert.equal(Object.keys(apiRoutes).some(route => route.startsWith('migrations')), false);
});

const failed = results.filter(result => !result.ok);
for (const result of results) if (!result.ok || process.argv.includes('--report')) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.id} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
console.log(`shadowdark effect conformance: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
