import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import check from '../../migrations/4.0.6/check';
import plan from '../../migrations/4.0.6/plan';
import verify from '../../migrations/4.0.6/verify';
import { slugify } from '../logic/foundry';
import type { MigrationTarget } from '@sheet-delver/sdk';

/**
 * ADR-0001 G8-B: the Shadowdark 4.0 effect-key migration hooks over Core's
 * public `MigrationHookInput` contract (module-api 1.6 declared relations).
 * Expected outputs are hand-derived from native 4.0.6
 * `Update_251001_1.updateEffects` (identical in 4.0.0–4.0.6), Foundry 13/14
 * effect shapes and Foundry's ActorDelta merge rules. Inputs follow Core's
 * documented relation projection: each related row keeps its canonical
 * uuid/kind/pack/base identity, with `source` reduced to the declared fields
 * (absent stays absent, null stays null). The hooks are also bundled in
 * isolation and run with no host globals, clock or random source, as Core runs
 * packaged hooks; the audit records the run through Core's own packager,
 * enumeration and planner.
 */
type Result = { id: string; name: string; ok: boolean; detail?: string };
const results: Result[] = [];
async function test(id: string, name: string, fn: () => unknown | Promise<unknown>) {
    try { await fn(); results.push({ id, name, ok: true }); }
    catch (error) { results.push({ id, name, ok: false, detail: (error as Error).message.split('\n').slice(0, 6).join(' ') }); }
}

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const definition = JSON.parse(readFileSync(join(moduleRoot, 'migrations/4.0.6/definition.json'), 'utf8'));
const [step, packStep] = definition.steps;
const parameters = step.parameters;

const world: any = { identity: { instanceId: 'i', worldId: 'w', systemId: 'shadowdark', systemVersion: '4.0.6', foundryGeneration: 14,
    foundryBuild: '367', runtimeEpoch: 1, contextRevision: 1 }, settings: {} };
const deep = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(deep); Object.freeze(value); } return value; };
type Related = MigrationTarget;
/** Core's hook input for one effect: target, declared relations, declared parameters, no broad references; frozen. */
const input = (uuid: string, source: any, relations: { parent?: Related; baseActor?: Related } = {}, extra: any = {}) =>
    deep(structuredClone({ world, target: { uuid, kind: 'ActiveEffect', source, ...extra }, references: [], relations, parameters }));
/** A related row projected to the declared `type` field; `type: undefined` means the field is absent. */
const related = (uuid: string, kind: Related['kind'], type?: string | null, extra: Partial<Related> = {}): Related =>
    ({ uuid, kind, source: type === undefined ? {} : { type }, ...extra });
const actorRow = (uuid: string, type?: string | null) => related(uuid, 'Actor', type);
const itemRow = (uuid: string, type?: string | null, extra: Partial<Related> = {}) => related(uuid, 'Item', type, extra);
/** Applies an update-only patch whose keys are `changes` or `system.changes` (array replacement). */
function applyPatch(source: any, updates: Record<string, unknown>) {
    const next = structuredClone(source);
    for (const [path, value] of Object.entries(updates)) {
        const parts = path.split('.');
        let cursor = next;
        for (const part of parts.slice(0, -1)) cursor = cursor[part] ??= {};
        cursor[parts.at(-1)!] = structuredClone(value);
    }
    return next;
}
/** check → plan → apply → verify, then check again (idempotent). */
function migrate(hookInput: any) {
    assert.equal(check(hookInput).status, 'migration-needed', JSON.stringify(check(hookInput)));
    const planned = plan(hookInput);
    assert.equal(planned.status, 'patch');
    const after = applyPatch(hookInput.target.source, planned.updates!);
    const next = { ...hookInput, target: { ...hookInput.target, source: after } };
    assert.deepEqual(verify(next), { valid: true });
    assert.equal(check(next).status, 'current', 'a migrated effect is current');
    assert.equal(plan(next).status, 'no-op', 'repeat planning is a no-op');
    return { updates: planned.updates!, after };
}
function blocks(hookInput: any, pattern: RegExp) {
    const result = check(hookInput);
    assert.equal(result.status, 'unresolved');
    assert.match(result.reason!, pattern);
    assert.equal(plan(hookInput).status, 'unresolved');
    assert.equal(verify(hookInput).valid, false, 'an unresolved effect never verifies');
}

const PLAYER = 'Actor.pc';
const NPC = 'Actor.npc';
const DELTA = 'Scene.s.Token.t.ActorDelta.d';
const LEGACY = { _id: 'e', changes: [{ key: 'system.bonuses.rangedAttackBonus', mode: 2, value: 1 }] };

async function hooks() {
    await test('G8-B', 'current data is a no-op and verifies', () => {
        const source = { _id: 'e', name: 'Modern', changes: [{ key: 'system.attributes.ac.value', mode: 2, value: 1 }] };
        const hookInput = input(`${PLAYER}.ActiveEffect.e`, source, { parent: actorRow(PLAYER, 'Player') });
        assert.equal(check(hookInput).status, 'current');
        assert.equal(plan(hookInput).status, 'no-op');
        assert.deepEqual(verify(hookInput), { valid: true });
    });
    await test('G8-B', 'Foundry 13 shape: renamed in place, unrelated changes and unknown fields kept', () => {
        const source = { _id: 'e', name: 'Mixed bag', disabled: false, flags: { custom: { keep: 1 } }, changes: [
            { key: 'system.bonuses.acBonus', mode: 2, value: '1', priority: 7, customField: 'kept' },
            { key: 'system.roll.ranged.bonus.all', mode: 2, value: 1, note: 'untouched' },
        ] };
        const { updates, after } = migrate(input(`${PLAYER}.ActiveEffect.e`, source, { parent: actorRow(PLAYER, 'Player') }));
        assert.deepEqual(Object.keys(updates), ['changes'], 'only the stored change array is written');
        assert.deepEqual(after.changes, [
            { key: 'system.attributes.ac.value', mode: 2, value: '1', priority: 7, customField: 'kept' },
            { key: 'system.roll.ranged.bonus.all', mode: 2, value: 1, note: 'untouched' },
        ]);
        assert.deepEqual(after.flags, source.flags);
    });
    await test('G8-B', 'Foundry 14 shape on a Weapon: `.this` keys, type/phase/priority preserved', () => {
        const source = { _id: 'e', name: 'Magic', system: { changes: [
            { key: 'system.bonuses.attackBonus', type: 'add', value: 1, phase: 'initial', priority: 25 },
        ] } };
        const item = 'Actor.pc.Item.sword';
        const { updates, after } = migrate(input(`${item}.ActiveEffect.e`, source, { parent: itemRow(item, 'Weapon') }));
        assert.deepEqual(Object.keys(updates), ['system.changes']);
        assert.deepEqual(after.system.changes, [{ key: 'system.roll.attack.bonus.this', type: 'add', value: 1, phase: 'initial', priority: 25 }]);
        const talent = migrate(input('Item.t.ActiveEffect.e', source, { parent: itemRow('Item.t', 'Talent') })).after;
        assert.equal(talent.system.changes[0].key, 'system.roll.attack.bonus.all', 'non-Weapon parents use `.all`');
    });
    await test('G8-B', 'Weapon Mastery appends its damage change after every existing change, as native does', () => {
        const source = { _id: 'e', changes: [
            { key: 'system.bonuses.weaponMastery', mode: 2, value: 'longsword' },
            { key: 'system.roll.melee.bonus.all', mode: 2, value: 1 },
        ] };
        const { after } = migrate(input('Item.t.ActiveEffect.e', source, { parent: itemRow('Item.t', 'Talent') }));
        assert.deepEqual(after.changes.map((change: any) => change.key),
            ['system.roll.melee.bonus.longsword', 'system.roll.melee.bonus.all', 'system.roll.melee.damage.longsword']);
    });
    await test('G8-B', 'scope: NPC Actor-level effects stay as native leaves them; NPC-owned Item effects migrate', () => {
        const source = { _id: 'e', changes: [{ key: 'system.bonuses.acBonus', mode: 2, value: 1 }] };
        const npcLevel = input(`${NPC}.ActiveEffect.e`, source, { parent: actorRow(NPC, 'NPC') });
        assert.equal(check(npcLevel).status, 'current'); assert.deepEqual(verify(npcLevel), { valid: true });
        migrate(input(`${NPC}.Item.claw.ActiveEffect.e`, source, { parent: itemRow(`${NPC}.Item.claw`, 'NPC Feature') }));
    });
    await test('G8-B', 'token delta Actor effects: a null or absent delta type takes the base type; a stored delta type wins', () => {
        const base = actorRow(PLAYER, 'Player');
        for (const deltaType of [null, undefined]) {
            const parent = related(DELTA, 'ActorDelta', deltaType, { baseActorUuid: PLAYER });
            const after = migrate(input(`${DELTA}.ActiveEffect.e`, LEGACY, { parent, baseActor: base }, { baseActorUuid: PLAYER })).after;
            assert.equal(after.changes[0].key, 'system.roll.ranged.bonus.all');
        }
        const npcOverride = input(`${DELTA}.ActiveEffect.e`, LEGACY,
            { parent: related(DELTA, 'ActorDelta', 'NPC', { baseActorUuid: PLAYER }), baseActor: base }, { baseActorUuid: PLAYER });
        assert.equal(check(npcOverride).status, 'current', 'ActorDelta.applyDelta keeps a stored delta type');
        blocks(input(`${DELTA}.ActiveEffect.e`, LEGACY, { parent: related(DELTA, 'ActorDelta', null, { baseActorUuid: PLAYER }) }, { baseActorUuid: PLAYER }),
            /base Actor of token delta .*ActorDelta\.d \(Actor\.pc\) is not available/);
        const partial = input(`${DELTA}.ActiveEffect.p`, { _id: 'p', disabled: true },
            { parent: related(DELTA, 'ActorDelta', null, { baseActorUuid: PLAYER }), baseActor: base }, { baseActorUuid: PLAYER });
        assert.equal(check(partial).status, 'current', 'a partial delta effect without changes is not filled in');
        assert.equal(plan(partial).status, 'no-op');
    });
    await test('G8-B', 'token delta Items use their own stored type; a typeless delta Item blocks instead of borrowing the base Item', () => {
        const bow = `${DELTA}.Item.bow`;
        const weapon = migrate(input(`${bow}.ActiveEffect.e`, LEGACY,
            { parent: itemRow(bow, 'Weapon', { baseActorUuid: PLAYER }), baseActor: actorRow(PLAYER, 'Player') }, { baseActorUuid: PLAYER })).after;
        assert.equal(weapon.changes[0].key, 'system.roll.ranged.bonus.this');
        const onNpc = migrate(input(`${bow}.ActiveEffect.e`, LEGACY,
            { parent: itemRow(bow, 'Talent', { baseActorUuid: NPC }), baseActor: actorRow(NPC, 'NPC') }, { baseActorUuid: NPC })).after;
        assert.equal(onNpc.changes[0].key, 'system.roll.ranged.bonus.all', 'Item effects migrate whatever the Actor type');
        // Foundry replaces the base Item with the whole delta Item and validates it as a full Item.
        blocks(input(`${bow}.ActiveEffect.e`, LEGACY,
            { parent: itemRow(bow, undefined, { baseActorUuid: PLAYER }), baseActor: actorRow(PLAYER, 'Player') }, { baseActorUuid: PLAYER }),
            /Token delta Item Scene\.s\.Token\.t\.ActorDelta\.d\.Item\.bow stores no type.*does not inherit its type.*Repair or restore it in Foundry/);
        blocks(input('Item.loose.ActiveEffect.e', LEGACY, { parent: itemRow('Item.loose', null) }), /Item Item\.loose stores no type/);
    });
    await test('G8-B', 'world-pack documents: same rules with their pack identity', () => {
        const actor = 'Compendium.world.heroes.Actor.hero';
        const item = 'Compendium.world.armory.Item.blade';
        const playerLevel = migrate(input(`${actor}.ActiveEffect.e`, LEGACY, { parent: related(actor, 'Actor', 'Player', { pack: 'world.heroes' }) }, { pack: 'world.heroes' })).after;
        assert.equal(playerLevel.changes[0].key, 'system.roll.ranged.bonus.all');
        const owned = migrate(input(`${actor}.Item.bow.ActiveEffect.e`, LEGACY, { parent: itemRow(`${actor}.Item.bow`, 'Weapon', { pack: 'world.heroes' }) }, { pack: 'world.heroes' })).after;
        assert.equal(owned.changes[0].key, 'system.roll.ranged.bonus.this');
        const loose = migrate(input(`${item}.ActiveEffect.e`, LEGACY, { parent: itemRow(item, 'Weapon', { pack: 'world.armory' }) }, { pack: 'world.armory' })).after;
        assert.equal(loose.changes[0].key, 'system.roll.ranged.bonus.this');
        const monster = input('Compendium.world.foes.Actor.orc.ActiveEffect.e', LEGACY, { parent: related('Compendium.world.foes.Actor.orc', 'Actor', 'NPC', { pack: 'world.foes' }) }, { pack: 'world.foes' });
        assert.equal(check(monster).status, 'current');
    });
    await test('G8-B', 'spell advantage resolves native slugs and 0.9.4 spell names; anything else blocks with a reason', () => {
        const effect = (value: string) => ({ _id: 'e', name: 'Focus', changes: [{ key: 'system.bonuses.advantage', mode: 2, value }] });
        const relations = { parent: actorRow(PLAYER, 'Player') };
        assert.equal(migrate(input(`${PLAYER}.ActiveEffect.e`, effect('magic-missile'), relations)).after.changes[0].key, 'system.roll.spell.advantage.magic-missile');
        assert.equal(migrate(input(`${PLAYER}.ActiveEffect.e`, effect('Magic Missile'), relations)).after.changes[0].key, 'system.roll.spell.advantage.magic-missile');
        assert.equal(migrate(input(`${PLAYER}.ActiveEffect.e`, effect('initiative'), relations)).after.changes[0].key, 'system.roll.initiative.advantage');
        blocks(input(`${PLAYER}.ActiveEffect.e`, effect('Bogus Spell'), relations), /Actor\.pc\.ActiveEffect\.e.*Edit or remove/);
    });
    await test('G8-B', 'a missing parent relation blocks instead of guessing; keys native cannot migrate stay', () => {
        const legacy = { _id: 'e', changes: [{ key: 'system.bonuses.acBonus', mode: 2, value: 1 }] };
        blocks(input(`${PLAYER}.ActiveEffect.e`, legacy), /parent document of ActiveEffect Actor\.pc\.ActiveEffect\.e is not available/);
        blocks(input(`${PLAYER}.ActiveEffect.e`, legacy, { parent: actorRow(PLAYER) }), /Actor type .* not stored on Actor\.pc/);
        const noPath = input(`${PLAYER}.ActiveEffect.e`, { _id: 'e', changes: [{ key: 'system.bonuses.somethingElse', mode: 2, value: 1 }] }, { parent: actorRow(PLAYER, 'Player') });
        assert.equal(check(noPath).status, 'current', 'native logs "No migration path" and leaves the key');
        const noLegacy = input(`${PLAYER}.ActiveEffect.e`, { _id: 'e', changes: [{ key: 'system.roll.melee.bonus.all', mode: 2, value: 1 }] });
        assert.equal(check(noLegacy).status, 'current', 'a current effect never needs its parent');
    });
    await test('G8-B', 'mixed shape: only the authoritative system.changes is rewritten', () => {
        const source = { _id: 'e', changes: [{ key: 'system.bonuses.gearSlots', mode: 2, value: 1 }],
            system: { changes: [{ key: 'system.bonuses.gearSlots', type: 'add', value: 2, phase: 'initial', priority: null }] } };
        const { updates, after } = migrate(input('Item.t.ActiveEffect.e', source, { parent: itemRow('Item.t', 'Talent') }));
        assert.deepEqual(Object.keys(updates), ['system.changes']);
        assert.deepEqual(after.changes, source.changes, 'the ignored legacy copy is preserved, not rewritten');
        assert.equal(after.system.changes[0].key, 'system.slots');
    });
    await test('G8-B', 'non-effect targets (Actors, Items, token deltas, pack documents) are current', () => {
        for (const target of [
            { uuid: PLAYER, kind: 'Actor', source: { _id: 'pc', type: 'Player' } },
            { uuid: 'Item.t', kind: 'Item', source: { _id: 't' } },
            { uuid: DELTA, kind: 'ActorDelta', source: { _id: 'd', items: [{ _id: 'x', _tombstone: true }] }, baseActorUuid: PLAYER },
            { uuid: 'Compendium.world.heroes.Actor.hero', kind: 'Actor', source: { _id: 'hero' }, pack: 'world.heroes' },
        ]) {
            const hookInput = deep({ world, target, references: [], relations: {}, parameters }) as any;
            assert.equal(check(hookInput).status, 'current');
            assert.equal(plan(hookInput).status, 'no-op');
            assert.deepEqual(verify(hookInput), { valid: true });
        }
    });
}

/** Bundle each hook on its own (relative pure imports only) and run it as Core does: no host globals. */
async function bundled() {
    const outputs: Record<string, string> = {};
    const inputs = new Set<string>();
    for (const hook of ['check', 'plan', 'verify'] as const) {
        const built = await esbuild.build({ entryPoints: [join(moduleRoot, `migrations/4.0.6/${step.hooks[hook]}`)], bundle: true, write: false,
            platform: 'browser', format: 'cjs', target: 'es2022', logLevel: 'silent', metafile: true });
        outputs[hook] = built.outputFiles[0].text;
        for (const file of Object.keys(built.metafile!.inputs)) inputs.add(resolve(file));
    }
    const run = (hook: string, hookInput: unknown) => {
        const context = vm.createContext(Object.create(null), { codeGeneration: { strings: false, wasm: false } });
        const script = new vm.Script(`"use strict";const module={exports:{}};const exports=module.exports;
            Object.defineProperty(globalThis,'Date',{value:undefined});Object.defineProperty(globalThis,'Intl',{value:undefined});
            Math.random=()=>{throw Error('Random is forbidden')};
            ${outputs[hook]}
            const fn=module.exports.default??module.exports;JSON.stringify(fn(JSON.parse(${JSON.stringify(JSON.stringify(hookInput))})));`);
        return JSON.parse(script.runInContext(context, { timeout: 1000 }) as string);
    };
    await test('G8-B', 'each hook bundles from confined module files only', () => {
        for (const file of inputs) assert.ok(file.startsWith(moduleRoot + '/'), `${file} is inside the module`);
        assert.ok([...inputs].every(file => !file.includes('node_modules')), 'no package imports');
    });
    await test('G8-B', 'bundled hooks without host globals return exactly the direct results', () => {
        const cases = [
            input(`${PLAYER}.ActiveEffect.e`, { _id: 'e', changes: [{ key: 'system.bonuses.acBonus', mode: 2, value: '1', extra: 1 }] }, { parent: actorRow(PLAYER, 'Player') }),
            input('Actor.pc.Item.w.ActiveEffect.e', { _id: 'e', system: { changes: [{ key: 'system.bonuses.damageBonus', type: 'add', value: 1, phase: 'initial', priority: null }] } },
                { parent: itemRow('Actor.pc.Item.w', 'Weapon') }),
            input(`${PLAYER}.ActiveEffect.e`, { _id: 'e', changes: [{ key: 'system.bonuses.advantage', mode: 2, value: 'Nope' }] }, { parent: actorRow(PLAYER, 'Player') }),
            input(`${NPC}.ActiveEffect.e`, { _id: 'e', changes: [{ key: 'system.bonuses.acBonus', mode: 2, value: 1 }] }, { parent: actorRow(NPC, 'NPC') }),
            input(`${DELTA}.Item.bow.ActiveEffect.e`, LEGACY, { parent: itemRow(`${DELTA}.Item.bow`, undefined, { baseActorUuid: PLAYER }), baseActor: actorRow(PLAYER, 'Player') }, { baseActorUuid: PLAYER }),
        ];
        const direct = { check, plan, verify } as const;
        for (const hookInput of cases) for (const hook of ['check', 'plan', 'verify'] as const) {
            assert.deepEqual(run(hook, hookInput), JSON.parse(JSON.stringify(direct[hook](hookInput as any))), `${hook} matches`);
        }
    });
}

async function catalog() {
    await test('G8-B', 'the root catalog is active and names the native 4.0.6 milestone', () => {
        const root = JSON.parse(readFileSync(join(moduleRoot, 'migration.json'), 'utf8'));
        assert.deepEqual(root, { schemaVersion: 'sheet-delver-migrations.v1', systemVersions: { '4.0.6': 'migrations/4.0.6' } });
        assert.equal(existsSync(join(moduleRoot, 'migrations/migration.json')), false, 'no second, staged catalog remains');
        assert.equal(definition.schemaVersion, 'sheet-delver-migration-definition.v1');
        assert.equal(definition.dataReadVersion, '>=4.0.0 <=4.0.6');
    });
    await test('G8-B', 'world step: required, targets effects and token deltas, reads only declared relations', () => {
        assert.deepEqual([step.id, step.revision, step.required, step.targets, step.paths, step.foundryGenerations, step.systemVersion, step.dependencies],
            ['shadowdark-effect-keys-4.0', 1, true, ['ActiveEffect', 'ActorDelta'], ['changes', 'system.changes'], [13, 14], '>=4.0.0 <=4.0.6', []]);
        // ActorDelta is a target kind so Core enumerates unlinked token deltas without a whole-kind read.
        assert.deepEqual(step.reads, { relations: [
            { relation: 'parent', forKinds: ['ActiveEffect'], fields: ['type'] },
            { relation: 'baseActor', forKinds: ['ActiveEffect'], fields: ['type'] },
        ] }, 'no reads.targets / reads.packs: no broad references');
    });
    await test('RV-09', 'world-pack step: required, WorldPack targets, same hooks and parameters', () => {
        assert.deepEqual([packStep.id, packStep.revision, packStep.required, packStep.targets, packStep.paths, packStep.foundryGenerations, packStep.systemVersion, packStep.dependencies],
            ['shadowdark-effect-keys-4.0-world-packs', 1, true, ['WorldPack'], ['changes', 'system.changes'], [13, 14], '>=4.0.0 <=4.0.6', []]);
        assert.deepEqual(packStep.reads, { relations: [{ relation: 'parent', forKinds: ['ActiveEffect'], fields: ['type'] }] });
        assert.deepEqual(packStep.hooks, step.hooks);
        assert.deepEqual(packStep.parameters, step.parameters);
        assert.deepEqual(definition.steps.length, 2);
    });
    await test('G8-B', 'relations fit Core 1.6 bounds; the manifest excludes hosts without relations', () => {
        for (const entry of definition.steps) {
            const relations = entry.reads.relations;
            assert.ok(relations.length <= 3 && new Set(relations.map((row: any) => row.relation)).size === relations.length);
            for (const relation of relations) {
                assert.ok(['parent', 'ancestors', 'baseActor'].includes(relation.relation));
                assert.ok(relation.fields.every((field: string) => !['items', 'effects'].includes(field.split('.')[0])), 'no whole child collections');
            }
        }
        const info = JSON.parse(readFileSync(join(moduleRoot, 'info.json'), 'utf8'));
        assert.equal(info.migrations ?? info.migration, undefined, 'no migration maps in info.json');
        assert.equal(info.compatibility.apiContracts['module-api'], '>=1.6.0 <2.0.0');
        assert.equal(info.compatibility.coreVersion, '>=0.19.1');
    });
    const nativeRoot = process.env.SHADOWDARK_NATIVE_REF ?? join(process.cwd(), 'temp/shadowdark');
    const spells = join(nativeRoot, 'data/packs/spells.db');
    if (existsSync(spells)) {
        await test('G8-B', 'nativeSpellSlugs equals the native spells pack (Update_251001_1 spell lookup)', () => {
            const names = readdirSync(spells).filter(file => file.endsWith('.json')).map(file => JSON.parse(readFileSync(join(spells, file), 'utf8')))
                .filter(doc => doc.type === 'Spell').map(doc => doc.name);
            assert.deepEqual(parameters.nativeSpellSlugs, [...new Set(names.map(slugify))].sort());
        });
    } else {
        console.log('SKIP native spell slug drift check: native reference not present');
    }
}

async function run() {
    await hooks();
    await bundled();
    await catalog();
    for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.id} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
    const failed = results.filter(result => !result.ok);
    console.log(`shadowdark migration hooks: ${results.length - failed.length}/${results.length} passed`);
    if (failed.length) process.exitCode = 1;
}

run().catch(error => { console.error(error); process.exitCode = 1; });
