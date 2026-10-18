/**
 * RV-08: the caller-scoped system index must follow world-context invalidation.
 *
 * Drives `createSystemIndexStore` (the lifecycle behind ShadowdarkUIProvider)
 * with controlled responses and timers. The original defect: an invalidation
 * while the first index request was pending discarded that response but started
 * no replacement, leaving the provider loading forever.
 *
 * Run: npx tsx data/local/modules/shadowdark/src/tests/system-index.test.ts
 */
import assert from 'node:assert/strict';
import { createSystemIndexStore, type SystemIndexScope } from '../ui/context/system-index-store';

interface Call { url: string; signal: AbortSignal; resolve: (response: Response) => void; reject: (error: unknown) => void }

function harness(retries = 2) {
    const calls: Call[] = [];
    const timers = new Map<number, () => void>();
    let nextTimer = 1;
    const errors: string[] = [];
    const request = (url: string, signal: AbortSignal) => new Promise<Response>((resolve, reject) => {
        calls.push({ url, signal, resolve, reject });
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
    const store = createSystemIndexStore({
        fetchIndex: signal => request('index', signal),
        fetchCollection: (packId, signal) => request(`pack:${packId}`, signal),
        retries, retryDelayMs: 10,
        setTimer: callback => { const id = nextTimer++; timers.set(id, callback); return id; },
        clearTimer: handle => { timers.delete(handle as number); },
        onError: message => errors.push(message),
    });
    const indexCalls = () => calls.filter(call => call.url === 'index');
    const flush = () => new Promise(resolve => setImmediate(resolve));
    const fire = async () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); await flush(); };
    return { store, calls, timers, errors, indexCalls, flush, fire };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const scope = (overrides: Partial<SystemIndexScope> = {}): SystemIndexScope => ({ worldId: 'w1', userId: 'u1', role: 1, connected: true, ...overrides });

let passed = 0;
async function test(name: string, run: () => Promise<void>) {
    try { await run(); passed++; console.log(`  ✓ ${name}`); }
    catch (error) { console.error(`  ✗ ${name}`); throw error; }
}

console.log('system-index (RV-08)');

await test('invalidation while the first index request is pending starts a replacement and ignores the old response', async () => {
    const { store, indexCalls, flush } = harness();
    store.setScope(scope());
    assert.equal(store.getSnapshot().status, 'loading');
    assert.equal(indexCalls().length, 1);
    const first = indexCalls()[0];
    store.invalidate();
    assert.equal(first.signal.aborted, true, 'the retired request is aborted');
    assert.equal(indexCalls().length, 2, 'a replacement request starts while systemData is still null');
    first.resolve(json({ nameIndex: { old: 'Stale' } }));
    await flush();
    assert.equal(store.getSnapshot().systemData, null, 'a retired response is never published');
    assert.equal(store.getSnapshot().status, 'loading');
    indexCalls()[1].resolve(json({ nameIndex: { current: 'Current' } }));
    await flush();
    assert.deepEqual(store.getSnapshot(), { status: 'ready', systemData: { nameIndex: { current: 'Current' } }, collections: {}, error: null, generation: 2, collectionStates: {} });
});

await test('invalidation after a load drops the index and caller collections, then reloads', async () => {
    const { store, calls, indexCalls, flush } = harness();
    store.setScope(scope());
    indexCalls()[0].resolve(json({ nameIndex: { a: 'A' } }));
    await flush();
    const shard = store.fetchCollection('spells');
    calls.find(call => call.url === 'pack:spells')!.resolve(json([{ uuid: 'Compendium.shadowdark.spells.Item.light', name: 'Light' }]));
    assert.equal((await shard)?.length, 1);
    assert.ok(store.getSnapshot().collections.spells);
    store.invalidate();
    assert.equal(store.getSnapshot().status, 'loading');
    assert.equal(store.getSnapshot().systemData, null);
    assert.deepEqual(store.getSnapshot().collections, {}, 'caller-scoped shards do not survive a context change');
    indexCalls()[1].resolve(json({ nameIndex: { b: 'B' } }));
    await flush();
    assert.deepEqual(store.getSnapshot().systemData, { nameIndex: { b: 'B' } });
});

await test('rapid invalidations leave exactly one live request and publish only the newest response', async () => {
    const { store, indexCalls, flush } = harness();
    store.setScope(scope());
    store.invalidate(); store.invalidate(); store.invalidate();
    const all = indexCalls();
    assert.equal(all.length, 4);
    assert.deepEqual(all.map(call => call.signal.aborted), [true, true, true, false]);
    all.forEach((call, index) => call.resolve(json({ generation: index })));
    await flush();
    assert.deepEqual(store.getSnapshot().systemData, { generation: 3 });
});

await test('a collection response from before a context change is discarded', async () => {
    const { store, calls, indexCalls, flush } = harness();
    store.setScope(scope());
    indexCalls()[0].resolve(json({}));
    await flush();
    const late = store.fetchCollection('gear');
    const call = calls.find(entry => entry.url === 'pack:gear')!;
    store.invalidate();
    assert.equal(call.signal.aborted, true);
    call.resolve(json([{ name: 'Revoked pack row' }]));
    assert.equal(await late, null);
    assert.deepEqual(store.getSnapshot().collections, {});
});

await test('user, role and world changes each retire the previous caller data', async () => {
    const { store, indexCalls, flush } = harness();
    store.setScope(scope());
    indexCalls()[0].resolve(json({ caller: 'u1' }));
    await flush();
    for (const [index, change] of [{ userId: 'u2' }, { role: 4 }, { worldId: 'w2' }].entries()) {
        store.setScope(scope(change));
        assert.equal(store.getSnapshot().systemData, null, `scope change ${JSON.stringify(change)} clears data`);
        assert.equal(store.getSnapshot().status, 'loading');
        assert.equal(indexCalls().length, index + 2);
        assert.equal(indexCalls()[index].signal.aborted, true);
    }
    store.setScope(scope({ worldId: 'w2' }));
    assert.equal(indexCalls().length, 4, 'an unchanged scope does not refetch');
});

await test('disconnect is offline without stale data; recovery loads current data', async () => {
    const { store, indexCalls, flush } = harness();
    store.setScope(scope());
    const pending = indexCalls()[0];
    store.setScope(scope({ connected: false }));
    assert.equal(pending.signal.aborted, true);
    assert.deepEqual(store.getSnapshot(), { status: 'offline', systemData: null, collections: {}, error: null, generation: 2, collectionStates: {} });
    assert.equal(await store.fetchCollection('spells'), null, 'no collection request while offline');
    store.setScope(scope());
    indexCalls()[1].resolve(json({ recovered: true }));
    await flush();
    assert.deepEqual(store.getSnapshot().systemData, { recovered: true });
});

await test('503 and network failures retry, then end in an explicit failure', async () => {
    const { store, indexCalls, timers, flush, fire } = harness(2);
    store.setScope(scope());
    indexCalls()[0].resolve(json({}, 503));
    await flush();
    assert.equal(timers.size, 1);
    await fire();
    indexCalls()[1].reject(new TypeError('network down'));
    await flush();
    await fire();
    indexCalls()[2].resolve(json({}, 503));
    await flush();
    assert.equal(timers.size, 0);
    assert.equal(store.getSnapshot().status, 'failed');
    assert.match(store.getSnapshot().error!, /HTTP 503/);
    store.retry();
    assert.equal(store.getSnapshot().status, 'loading');
    indexCalls()[3].resolve(json({ ok: true }));
    await flush();
    assert.equal(store.getSnapshot().status, 'ready');
});

await test('a 409 (world context changed while the request ran) is retried, then loads', async () => {
    const { store, indexCalls, timers, flush, fire } = harness(2);
    store.setScope(scope());
    indexCalls()[0].resolve(json({ code: 'conflict' }, 409));
    await flush();
    assert.equal(timers.size, 1, 'a context conflict is a refresh, not a failure');
    await fire();
    indexCalls()[1].resolve(json({ refreshed: true }));
    await flush();
    assert.deepEqual(store.getSnapshot().systemData, { refreshed: true });
});

await test('a client error fails at once without retrying', async () => {
    const { store, indexCalls, timers, flush } = harness(3);
    store.setScope(scope());
    indexCalls()[0].resolve(json({ error: 'denied' }, 403));
    await flush();
    assert.equal(timers.size, 0);
    assert.equal(indexCalls().length, 1);
    assert.equal(store.getSnapshot().status, 'failed');
    assert.match(store.getSnapshot().error!, /HTTP 403/);
});

await test('invalidation during a retry delay cancels the old timer', async () => {
    const { store, indexCalls, timers, flush, fire } = harness(2);
    store.setScope(scope());
    indexCalls()[0].resolve(json({}, 503));
    await flush();
    assert.equal(timers.size, 1);
    store.invalidate();
    assert.equal(timers.size, 0, 'the retired retry timer is cleared');
    await fire();
    assert.equal(indexCalls().length, 2, 'only the replacement request runs');
    indexCalls()[1].resolve(json({ fresh: true }));
    await flush();
    assert.deepEqual(store.getSnapshot().systemData, { fresh: true });
});

await test('release (unmount) aborts work, clears timers and publishes nothing later', async () => {
    const { store, indexCalls, timers, flush } = harness(2);
    let notifications = 0;
    store.subscribe(() => notifications++);
    store.setScope(scope());
    indexCalls()[0].resolve(json({}, 503));
    await flush();
    const before = notifications;
    store.release();
    assert.equal(timers.size, 0);
    store.invalidate();
    assert.equal(indexCalls().length, 1, 'a released store starts nothing');
    assert.equal(notifications, before);
    store.setScope(scope());
    assert.equal(indexCalls().length, 2, 'remounting (React StrictMode) restarts the same scope');
});

await test('concurrent requests for one shard share a single fetch', async () => {
    const { store, calls, indexCalls, flush } = harness();
    store.setScope(scope());
    indexCalls()[0].resolve(json({}));
    await flush();
    const a = store.fetchCollection('classes');
    const b = store.fetchCollection('classes');
    assert.equal(calls.filter(call => call.url === 'pack:classes').length, 1);
    calls.find(call => call.url === 'pack:classes')!.resolve(json([{ name: 'Fighter' }]));
    assert.deepEqual(await a, await b);
    const cached = await store.fetchCollection('classes');
    assert.equal(calls.filter(call => call.url === 'pack:classes').length, 1, 'cached for the generation');
    assert.equal(cached?.[0].name, 'Fighter');
});

await test('RV-10: demand before readiness starts once and automatically reloads after pending/loaded invalidation', async () => {
    const { store, calls, indexCalls, flush } = harness();
    const stop = store.retainCollections(['gear', 'gear']);
    store.setScope(scope());
    assert.equal(calls.filter(c => c.url === 'pack:gear').length, 0);
    indexCalls()[0].resolve(json({})); await flush();
    assert.deepEqual(store.getSnapshot().collectionStates.gear, { status: 'loading' });
    const first = calls.find(c => c.url === 'pack:gear')!;
    store.invalidate(); assert.equal(first.signal.aborted, true);
    indexCalls()[1].resolve(json({})); await flush();
    const gear = calls.filter(c => c.url === 'pack:gear'); assert.equal(gear.length, 2);
    gear[1].resolve(json([{ name: 'Current' }])); await flush();
    assert.deepEqual(store.getSnapshot().collectionStates.gear, { status: 'ready' });
    store.invalidate(); indexCalls()[2].resolve(json({})); await flush();
    const third = calls.filter(c => c.url === 'pack:gear')[2]; third.resolve(json([])); await flush();
    assert.deepEqual(store.getSnapshot().collections.gear, []);
    stop(); store.release();
});

await test('RV-11: independent collection states, valid empty, denied/invalid/unavailable/network failures and selective retry', async () => {
    const { store, calls, indexCalls, flush } = harness();
    store.setScope(scope()); indexCalls()[0].resolve(json({})); await flush();
    const stop = store.retainCollections(['ancestries', 'classes']);
    calls.find(c => c.url === 'pack:ancestries')!.resolve(json([]));
    calls.find(c => c.url === 'pack:classes')!.resolve(json({ error: 'Unavailable to this role' }, 403)); await flush();
    assert.equal(store.getSnapshot().status, 'ready', 'index readiness is independent');
    assert.deepEqual(store.getSnapshot().collections.ancestries, [], 'successful empty is cached');
    assert.equal(store.getSnapshot().collectionStates.ancestries.status, 'ready');
    assert.equal(store.getSnapshot().collectionStates.classes.status, 'failed');
    assert.match((store.getSnapshot().collectionStates.classes as any).error, /classes.*Access denied.*403.*role/);
    assert.equal(await store.fetchCollection('classes'), null); assert.equal(calls.filter(c => c.url === 'pack:classes').length, 1, 'no denial retry loop');
    for (const [response, expectedStatus] of [[json({}, 503), 'failed'], [json({}), 'failed'], [new TypeError('network lost'), 'failed'], [json([]), 'ready']] as const) {
        store.retryCollection('classes');
        const call = calls.filter(c => c.url === 'pack:classes').at(-1)!;
        if (response instanceof Error) call.reject(response); else call.resolve(response);
        await flush();
        assert.equal(store.getSnapshot().collectionStates.classes.status, expectedStatus);
    }
    assert.equal(calls.filter(c => c.url === 'pack:ancestries').length, 1, 'retry preserves successful shards');
    stop(); store.release();
});

await test('RV-10: shared demand deduplicates; last consumer unmount retires an uncooperative request and a remount refetches', async () => {
    const calls: Array<{ signal: AbortSignal; resolve: (r: Response) => void }> = [];
    const store = createSystemIndexStore({ fetchIndex: async () => json({}), fetchCollection: (_id, signal) => new Promise(resolve => calls.push({ signal, resolve })) });
    store.setScope(scope()); await new Promise(resolve => setImmediate(resolve));
    const a = store.retainCollections(['gear']), b = store.retainCollections(['gear']);
    const old = store.fetchCollection('gear'); assert.equal(calls.length, 1);
    a(); assert.equal(calls[0].signal.aborted, false); b(); assert.equal(calls[0].signal.aborted, true);
    assert.equal(await old, null, 'consumer promises settle on retirement even if transport ignores abort');
    const c = store.retainCollections(['gear']); calls[0].resolve(json([{ name: 'stale' }])); calls[1].resolve(json([{ name: 'current' }]));
    await new Promise(resolve => setImmediate(resolve)); assert.equal(store.getSnapshot().collections.gear[0].name, 'current');
    c(); store.release();
});

console.log(`\n${passed} passed`);
