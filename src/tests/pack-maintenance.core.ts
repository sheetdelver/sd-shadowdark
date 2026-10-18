/** RV-09: released Core's PUBLIC installed-source/admin workflow, isolated.
 * Run from Core v0.19.1: npx tsx <module>/src/tests/pack-maintenance.core.ts
 *   --run-isolated --archive=<candidate tgz> --out=<dir> [--generation=13|14]
 *   [--inventory=actors,items-per-actor --inventory-only]
 * SHADOWDARK_CORE and SHADOWDARK_NATIVE_REFERENCE select read-only checkouts.
 * No private host imports, native transport or existing settings are used.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { CORE, Http, Manager, prepareWorkspace, isolatedEnv, unusedPort, until, userSession } from './core0191/core';
import { ControlledUpstream, type WorldState } from './core0191/upstream';
import { nativePacks, type Doc } from './core0191/world';

const args = new Map(process.argv.slice(2).map(arg => { const [key, ...v] = arg.replace(/^--/, '').split('='); return [key, v.join('=') || 'true']; }));
if (!args.has('run-isolated') || !args.has('archive')) throw new Error('Explicit --run-isolated and --archive required.');
const out = path.resolve(args.get('out') ?? fs.mkdtempSync('/tmp/sd-pack-maintenance-'));
const archive = path.resolve(args.get('archive')!);
const generation = Number(args.get('generation') ?? 14);
assert.ok([13, 14].includes(generation));
const mod = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ids: string[] = JSON.parse(fs.readFileSync(path.join(mod, 'info.json'), 'utf8')).compendiumPacks.packs.map((p: Doc) => p.id);
const native = nativePacks(path.resolve(process.env.SHADOWDARK_NATIVE_REFERENCE ?? path.join(CORE, 'temp/shadowdark')), ids);
const legacy = () => ({ _id: 'pc', type: 'Player', name: 'Pack only', items: [], flags: { keep: 'root' }, effects: [{ _id: 'legacy', name: 'Legacy', disabled: false, flags: { keep: 'effect' },
    ...(generation === 13 ? { changes: [{ key: 'system.bonuses.rangedAttackBonus', mode: 2, value: '1', priority: 7, keep: true }] }
        : { system: { changes: [{ key: 'system.bonuses.rangedAttackBonus', type: 'add', value: '1', phase: 'initial', priority: 7, keep: true }] } }) }] });
const changes = (doc: Doc) => generation === 13 ? doc.effects[0].changes : doc.effects[0].system.changes;
const [actors, itemsPerActor] = (args.get('inventory') ?? '1,0').split(',').map(Number);
assert.ok(actors > 0 && itemsPerActor >= 0 && Number.isInteger(actors) && Number.isInteger(itemsPerActor));
const inventory = () => Array.from({ length: actors }, (_, n) => {
    const doc: Doc = legacy(); doc._id = n === 0 ? 'pc' : `pc${n}`;
    doc.items = Array.from({ length: itemsPerActor }, (_, i) => ({ _id: `item${i}`, type: 'Basic', name: `Item ${i}`, flags: { keep: true }, effects: structuredClone(doc.effects) }));
    return doc;
});
// Independent oracle: literal native rename, applied to each actor/item effect;
// no planner/hook code is consulted, and every other source value is compared.
const expected = inventory();
for (const actor of expected) for (const doc of [actor, ...actor.items]) changes(doc)[0].key = 'system.roll.ranged.bonus.all';
const expectedWrites = actors * (itemsPerActor + 1);
const evidence: Doc = { nativeAcceptance: false, generation, core: 'v0.19.1', inventory: { actors, itemsPerActor, expectedWrites }, checks: [], cases: {} };
fs.mkdirSync(out, { recursive: true });
const pass = (name: string) => { evidence.checks.push(name); console.log(`✓ ${name}`); };
const managers: Manager[] = [];
const upstreams: ControlledUpstream[] = [];
const PASSWORD = 'isolated-pack-regression-password';

async function setup(name: string, options: { locked?: boolean; unresolved?: boolean; unreadable?: boolean; role?: number } = {}) {
    const root = path.join(out, name); fs.mkdirSync(root, { recursive: true });
    const workspace = prepareWorkspace(root); const data = path.join(root, 'data');
    const state: WorldState = {
        game: { world: { id: 'packworld', title: 'Isolated pack regression' }, system: { id: 'shadowdark', version: '4.0.6' }, release: { generation, build: generation === 13 ? '351' : '367' }, userId: 'service' },
        users: [{ _id: 'service', name: 'service', role: options.role ?? 4 }, { _id: 'player', name: 'Player', role: 1 }],
        actors: [], items: [], scenes: [], chat: [], settings: [{ _id: 'config', key: 'core.compendiumConfiguration', value: '{}' }],
        packs: { ...structuredClone(native), 'world.review': inventory() },
        packMetadata: [...ids.map(id => ({ id, name: id.split('.')[1], packageType: 'system', type: id === 'shadowdark.monsters' ? 'Actor' : id === 'shadowdark.rollable-tables' ? 'RollTable' : 'Item', locked: true })),
            { id: 'world.review', name: 'review', packageType: 'world', type: 'Actor', locked: options.locked ?? false }],
    };
    if (options.unresolved) Object.assign(changes(state.packs['world.review'][0])[0], { key: 'system.bonuses.advantage', value: 'Not A Spell' });
    const upstream = new ControlledUpstream(state); upstreams.push(upstream);
    if (options.unreadable) upstream.deniedPacks.add('world.review');
    await upstream.listen();
    const appPort = await unusedPort(), apiPort = await unusedPort();
    const admin = new Http(`http://127.0.0.1:${apiPort}`, `http://127.0.0.1:${appPort}`);
    fs.mkdirSync(path.join(data, 'config'), { recursive: true }); fs.mkdirSync(path.join(data, 'cache/core'), { recursive: true });
    fs.writeFileSync(path.join(data, 'cache/core/worlds.json'), JSON.stringify({ worlds: {}, currentWorldId: null }));
    fs.writeFileSync(path.join(data, 'config/settings.yaml'), JSON.stringify({ app: { host: '127.0.0.1', protocol: 'http', port: appPort, 'api-port': apiPort },
        foundry: { host: '127.0.0.1', protocol: 'http', port: upstream.port, username: 'service' }, debug: { level: 3 }, security: { admin: { 'allowed-networks': ['127.0.0.0/8'] } } }));
    const installed = path.join(data, 'modules/shadowdark'); fs.mkdirSync(installed, { recursive: true });
    assert.equal(spawnSync('tar', ['-xzf', archive, '-C', installed]).status, 0);
    // Public local bootstrap CLI, then HTTP setup. The disposable token is never
    // written to evidence/logs; no operator credential is read.
    const cli = spawnSync(process.execPath, ['--import', 'tsx', 'src/scripts/tools/admin/create-bootstrap.ts', '--data-dir', data], { cwd: workspace, env: isolatedEnv(data), encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    const bootstrapToken = cli.stdout.match(/[A-Za-z0-9_-]{43}/)?.[0]; assert.ok(bootstrapToken, 'CLI issued bootstrap credential');
    let serial = 0;
    const start = async () => {
        const manager = new Manager(workspace, data, path.join(root, `manager-${++serial}.log`)); managers.push(manager);
        await until('admin reachable', async () => (await admin.request('/admin/auth/status')).ok || false, manager, 120_000);
        return manager;
    };
    const manager = await start();
    const setupResponse = await admin.request('/admin/auth/setup', { bootstrapToken, password: PASSWORD });
    assert.equal(setupResponse.status, 200); await admin.adminLogin(PASSWORD);
    const observe = async () => ({ status: await (await admin.request('/api/status')).json(), migrations: await (await admin.request('/admin/module-migrations')).json(), maintenance: await (await admin.request('/admin/module-maintenance')).json(), diagnostics: await (await admin.request('/admin/module-upgrades')).json() });
    return { state, upstream, manager, admin, start, observe };
}

try {
    const h = await setup('eligible');
    const classified = await until('installed-source migration classification', async () => {
        const s = await h.observe(); return s.migrations.maintenance || s.migrations.sources?.some((r: Doc) => ['up-to-date', 'required', 'blocked'].includes(r.state)) ? s : false;
    }, h.manager, 120_000);
    evidence.cases.packOnly = classified;
    assert.equal(classified.status.initialized, false, 'pack-only legacy data must not serve as Up to date');
    assert.equal(h.upstream.writes.length, 0); assert.deepEqual(h.state.packs['world.review'], inventory());
    pass('installed pack-only legacy world requires maintenance; no write or source change before approval');
    const review = await until('fresh authoritative review', async () => {
        const status = (await h.observe()).maintenance;
        return status.mode?.stage === 'review' ? status : false;
    }, h.manager, 120_000);
    assert.deepEqual(review.preview.plan.blockers, []); assert.equal(review.preview.plan.operations.length, expectedWrites);
    const operation = review.preview.plan.operations.find((row: Doc) => row.uuid === 'Compendium.world.review.Actor.pc.ActiveEffect.legacy');
    assert.ok(operation);
    assert.equal(operation.uuid, 'Compendium.world.review.Actor.pc.ActiveEffect.legacy');
    assert.deepEqual(Object.keys(operation.updates), [generation === 13 ? 'changes' : 'system.changes']);
    assert.equal((await h.admin.request('/admin/module-maintenance/approve', { planId: review.preview.id, backupAcknowledged: true })).status, 202);
    await until('approved pack migration serves', async () => (await h.observe()).status.initialized === true || false, h.manager, 600_000);
    assert.deepEqual(h.state.packs['world.review'], expected); assert.equal(h.upstream.migrationWrites().length, expectedWrites);
    evidence.cases.completed = await h.observe(); evidence.cases.completed.writes = h.upstream.migrationWrites();
    assert.equal(new Set(h.upstream.migrationWrites().map(w => w.uuid)).size, expectedWrites);
    assert.ok(h.upstream.migrationWrites().every(w => w.type === 'ActiveEffect' && w.fields.every(f => ['changes', 'system.changes'].includes(f))));
    pass(`approved eligible pack migration equals independent source oracle; exactly ${expectedWrites} bounded writes`);
    await h.manager.stop(); const restarted = await h.start(); await h.admin.adminLogin(PASSWORD);
    await until('no-op restart serves', async () => (await h.observe()).status.initialized === true || false, restarted, 120_000);
    assert.equal(h.upstream.migrationWrites().length, expectedWrites); assert.deepEqual(h.state.packs['world.review'], expected);
    const noOp = await h.observe(); evidence.cases.noOp = noOp;
    assert.ok(noOp.migrations.sources.some((r: Doc) => r.state === 'up-to-date'), JSON.stringify(noOp.migrations));
    pass('genuine restart is a no-op; public admin reports Up to date after fresh verification');
    // Exercise caller collection routes through the actual Core request runtime.
    const player = await userSession(h.admin.api, h.admin.origin, 'Player');
    assert.equal((await player.get('/api/modules/shadowdark/fetch-pack/classes')).status, 200);
    h.upstream.setSetting('core.compendiumConfiguration', { 'shadowdark.classes': { ownership: {} } });
    await until('caller classes denied', async () => (await player.get('/api/modules/shadowdark/fetch-pack/classes')).status === 403 || false, restarted);
    assert.equal((await player.get('/api/modules/shadowdark/fetch-pack/ancestries')).status, 200);
    h.upstream.setSetting('core.compendiumConfiguration', {});
    await until('caller classes recovered', async () => (await player.get('/api/modules/shadowdark/fetch-pack/classes')).status === 200 || false, restarted);
    pass('real Core caller collections: partial permission denial and successful context recovery');
    await restarted.stop(); h.state.packs['world.review'] = inventory();
    const restored = await h.start(); await h.admin.adminLogin(PASSWORD);
    const fresh = await until('restored pack requires review', async () => {
        const s = await h.observe(); return s.maintenance.mode?.stage === 'review' ? s : false;
    }, restored, 120_000);
    evidence.cases.restored = fresh;
    assert.equal(fresh.status.initialized, false); assert.equal(h.upstream.migrationWrites().length, expectedWrites);
    assert.notEqual(fresh.maintenance.preview.id, review.preview.id); assert.equal(fresh.maintenance.preview.plan.operations.length, expectedWrites);
    assert.equal((await h.admin.request('/admin/module-maintenance/approve', { planId: review.preview.id, backupAcknowledged: true })).status, 409);
    assert.equal((await h.admin.request('/admin/module-maintenance/approve', { planId: fresh.maintenance.preview.id, backupAcknowledged: true })).status, 202);
    await until('fresh approval completes restored pack', async () => (await h.observe()).status.initialized === true || false, restored, 600_000);
    assert.deepEqual(h.state.packs['world.review'], expected); assert.equal(h.upstream.migrationWrites().length, 2 * expectedWrites);
    pass('restored legacy pack requires fresh review/approval; old approval rejected; source reverified');
    await restored.stop();

    for (const [name, options, reason] of (args.has('inventory-only') ? [] : [
        ['unresolved', { unresolved: true }, /Not A Spell|unresolved/i],
        ['locked', { locked: true }, /locked or unreadable/i],
        ['unreadable', { unreadable: true }, /permission denied|unreadable|unavailable/i],
        ['permission', { role: 3 }, /full.*gamemaster|role|service account/i],
    ] as const)) {
        const b = await setup(name, options);
        const blocked = await until(`${name} explanation`, async () => {
            const s = await b.observe(); return reason.test(JSON.stringify(s)) ? s : false;
        }, b.manager, 120_000);
        evidence.cases[name] = blocked;
        assert.equal(blocked.status.initialized, false); assert.equal(b.upstream.writes.length, 0);
        assert.ok(!JSON.stringify(blocked.migrations).includes('"state":"up-to-date"'));
        assert.equal(b.state.packMetadata.at(-1)!.locked, options.locked ?? false);
        if (name !== 'unresolved') assert.deepEqual(b.state.packs['world.review'], inventory());
        pass(`${name}: readiness blocked with public explanation; no writes, unlock or elevation`);
        await b.manager.stop();
    }
} catch (error) { evidence.error = String(error); throw error; }
finally {
    for (const manager of managers) await manager.stop();
    for (const upstream of upstreams) await upstream.close();
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2));
}
