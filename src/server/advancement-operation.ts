import { createHash } from 'node:crypto';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError } from '@sheet-delver/sdk';
import { callerOf, contextConflict, requireOwnedActor } from './access';
import { shadowdarkAdapter } from './ShadowdarkAdapter';
import { documentId } from '../logic/identity';
import { reviewToken, reviewMatches } from './source-review';
import { operationProcess } from './operation-lock';

const hash = (value: any) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Status = 'pending' | 'started' | 'complete' | 'failed' | 'uncertain';
type Grant = { item: any; status: Status; itemId?: string; error?: string };
type Journal = { requestId: string; fingerprint: string; process: string; revision: number; review: string; initialReview: string; finalReview?: string;
    targetLevel: number; grants: Grant[]; patch: any; advancement: { status: Status; error?: string };
    dependencies: { uuid: string; hash: string }[]; result: any };
function scope(req: ModuleServerRequest, actorId: string) {
    const world = req.runtime.world?.snapshot().identity;
    const caller = req.userSession?.userId ?? req.getAccessContext?.().userId;
    return world && caller && req.runtime.dataStore ? hash([world.instanceId, world.worldId, actorId, caller]) : null;
}
const activeKey = (req: ModuleServerRequest, actorId: string) => {
    const world = req.runtime.world!.snapshot().identity;
    return `advancement-active-${hash([world.instanceId, world.worldId, actorId])}`;
};
const keyFor = (scope: string, id: string) => `advancement-${scope}-${id}`;
const fingerprint = (body: any) => { const { recovery: _recovery, ...intent } = body; return hash(intent); };
function receipt(journal: Journal, actor: any) {
    return { requestId: journal.requestId, targetLevel: journal.targetLevel, state: journal.advancement.status === 'complete' ? 'complete' : 'partial',
        baseline: reviewToken(actor), operations: [...journal.grants.map((op, index) => ({ index, kind: 'item', name: op.item.name, status: op.status, itemId: op.itemId, error: op.error })),
            { kind: 'advancement', ...journal.advancement }],
        recovery: 'Retry confirmed refusals with this request. After restart, review the current source and explicitly continue. For an uncertain Item, supply its exact owned Item ID after independent source review; it is never recreated automatically. An uncertain final patch can be confirmed only against its complete expected source. Unresolved outcomes require exact-source operator remediation; do not start a replacement advancement.' };
}
export async function pendingAdvancement(req: ModuleServerRequest, actor: any) {
    const id = scope(req, documentId(actor)); if (!id) return null;
    const active = await req.runtime.dataStore.get<{ requestId: string; key: string }>(activeKey(req, documentId(actor)));
    const journal = active && await req.runtime.dataStore.get<Journal>(active.key);
    return journal && journal.advancement.status !== 'complete' ? receipt(journal, actor) : null;
}

/** Operation-local plans/receipts, not an Actor cache. Caller must hold the Actor queue. */
export async function resumeAdvancement(req: ModuleServerRequest, actor: any, body: any, revision: number | null,
    plan?: { items: any[]; patch: any; dependencies: string[]; result: any }) {
    const id = scope(req, documentId(actor));
    if (!id || revision === null) return error('not_ready', 'Advancement requires caller/world identity and durable operation receipts.');
    if (!/^[\w-]{8,80}$/.test(body.requestId ?? '')) return error('validation', 'Advancement requires a stable requestId for safe continuation.');
    const store = req.runtime.dataStore, key = keyFor(id, body.requestId);
    let journal = await store.get<Journal>(key);
    if (!journal && !plan) return body.targetLevel === undefined ? error('not_found', 'No saved advancement exists for this caller and requestId.') : null;
    if (journal && body.targetLevel !== undefined && journal.fingerprint !== fingerprint(body)) return error('conflict', 'This requestId already identifies a different advancement plan.');
    const active = await store.get<{ requestId: string; key: string }>(activeKey(req, documentId(actor)));
    if (active && active.key !== key) {
        const prior = await store.get<Journal>(active.key);
        if (prior && prior.advancement.status !== 'complete') return error('conflict', `Advancement ${prior.requestId} is incomplete. Reopen and review its receipts before any new advancement.`);
    }
    if (!journal) {
        if (typeof body.baseline !== 'string' || !reviewMatches(actor, body.baseline)) return error('conflict', 'Review the current Actor before advancing.');
        const dependencies = [];
        for (const uuid of [...new Set(plan!.dependencies)]) {
            const doc = await shadowdarkAdapter.resolveDocumentFor(uuid, callerOf(req));
            if (!doc) return error('conflict', `Required advancement source ${uuid} is unavailable.`);
            dependencies.push({ uuid, hash: hash(doc) });
        }
        journal = { requestId: body.requestId, fingerprint: fingerprint(body), revision, process: operationProcess, review: reviewToken(actor), initialReview: reviewToken(actor),
            targetLevel: plan!.result.targetLevel, grants: plan!.items.map(item => ({ item, status: 'pending' })), patch: plan!.patch,
            advancement: { status: 'pending' }, dependencies, result: plan!.result };
        await store.set(key, journal); await store.set(activeKey(req, documentId(actor)), { requestId: body.requestId, key });
    }
    const result = async () => { actor = await requireOwnedActor(req.runtime, documentId(actor)); return json({ success: true, ...journal!.result, ...receipt(journal!, actor) }); };
    if (journal.advancement.status === 'complete') return result();
    for (const op of [...journal.grants, journal.advancement]) if (op.status === 'started') op.status = 'uncertain';
    const recovery = body.recovery;
    const reviewed = recovery?.reviewed === true && recovery.baseline === reviewToken(actor);
    if ((journal.process !== operationProcess || journal.review !== reviewToken(actor)) && !reviewed) return result();
    if (journal.revision !== revision) return error('conflict', 'World context changed. Review and remediate the saved advancement; its old rules cannot be replayed.');
    for (const dependency of journal.dependencies) {
        const doc = await shadowdarkAdapter.resolveDocumentFor(dependency.uuid, callerOf(req));
        if (!doc || hash(doc) !== dependency.hash) return error('conflict', `Advancement source ${dependency.uuid} changed or became unavailable. Review the saved plan before remediation.`);
    }
    // Explicit reconciliation uses exact IDs and full planned source fields,
    // never names/origins as an inferred write acknowledgement.
    if (reviewed) {
        const confirmations = recovery.items ?? {};
        const used = new Set(journal.grants.map(op => op.itemId).filter(Boolean));
        const uncertain = journal.grants.filter(op => op.status === 'uncertain');
        const withoutIds = (value: any): any => Array.isArray(value) ? value.map(withoutIds) : value && typeof value === 'object'
            ? Object.fromEntries(Object.entries(value).filter(([key]) => !['_id', 'id', 'uuid'].includes(key)).map(([key, val]) => [key, key === '_stats' ? { compendiumSource: (val as any)?.compendiumSource } : withoutIds(val)])) : value;
        const includes = (actual: any, expected: any): boolean => Array.isArray(expected) ? Array.isArray(actual) && actual.length === expected.length && expected.every((val, i) => includes(actual[i], val))
            : expected && typeof expected === 'object' ? actual && Object.entries(expected).every(([key, val]) => includes(actual[key], val)) : actual === expected;
        for (const op of uncertain) {
            const index = journal.grants.indexOf(op), itemId = confirmations[index];
            if (!itemId) continue;
            const owned = actor.items?.find((item: any) => documentId(item) === itemId);
            if (!owned || used.has(itemId) || !includes(withoutIds(owned), withoutIds(op.item))) return error('validation', `Item ${index + 1} needs an unused exact owned ID matching its complete planned source.`);
            op.itemId = itemId; op.status = 'complete'; delete op.error; used.add(itemId);
        }
        if (journal.advancement.status === 'uncertain') {
            if (journal.grants.every(op => op.status === 'complete') && journal.finalReview === reviewToken(actor)) {
                journal.advancement.status = 'complete'; delete journal.advancement.error;
                await store.set(key, journal);
            }
            return result();
        }
        // Subtract only confirmed IDs. No fresh review can bless unrelated edits
        // or attribute an unconfirmed Item to this operation by name/origin.
        const before = { ...actor, items: (actor.items ?? []).filter((item: any) => !used.has(documentId(item))) };
        if (reviewToken(before) !== journal.initialReview) return error('conflict', 'Actor differs from the reviewed plan beyond confirmed grants. Explicit exact-source remediation is required.');
        journal.review = reviewToken(actor); journal.process = operationProcess;
        await store.set(key, journal);
    }
    if (journal.grants.some(op => op.status === 'uncertain') || journal.advancement.status === 'uncertain') return result();
    if (reviewToken(actor) !== journal.review) return result();
    const apply = (source: any) => {
        const copy = structuredClone(source);
        for (const [path, value] of Object.entries(journal!.patch)) { const parts = path.split('.'); let target = copy;
            for (const part of parts.slice(0, -1)) target = target[part] ??= {}; target[parts.at(-1)!] = value; }
        return copy;
    };
    const refuse = async (op: Grant | Journal['advancement'], e: unknown) => {
        op.status = isSdkError(e) && ['permission_denied', 'validation', 'not_found'].includes(e.code) ? 'failed' : 'uncertain';
        op.error = getErrorMessage(e); await store.set(key, journal); return result();
    };
    for (const op of journal.grants) {
        if (op.status === 'complete') continue;
        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        const current = await requireOwnedActor(req.runtime, documentId(actor));
        if (reviewToken(current) !== journal.review) return result();
        actor = current; op.status = 'started'; delete op.error; await store.set(key, journal);
        try {
            const created = await req.runtime.documents.items.create({ type: 'Actor', id: documentId(actor) }, op.item);
            const itemId = documentId(created); if (!itemId) throw new Error('Item creation returned no authoritative embedded ID.');
            op.itemId = itemId; op.status = 'complete';
            actor = { ...actor, items: [...(actor.items ?? []), created] }; journal.review = reviewToken(actor);
            await store.set(key, journal);
        } catch (e) { return refuse(op, e); }
    }
    const current = await requireOwnedActor(req.runtime, documentId(actor)); actor = current;
    if (reviewToken(actor) !== journal.review) return result();
    const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
    journal.advancement.status = 'started'; journal.finalReview = reviewToken(apply(actor)); await store.set(key, journal);
    try {
        await req.runtime.documents.patch('Actor', documentId(actor), journal.patch);
        actor = await requireOwnedActor(req.runtime, documentId(actor));
        if (reviewToken(actor) !== journal.finalReview) throw new Error('Final Actor source does not match the complete planned advancement.');
        journal.advancement.status = 'complete'; delete journal.advancement.error; await store.set(key, journal); return result();
    } catch (e) {
        return refuse(journal.advancement, e);
    }
}
