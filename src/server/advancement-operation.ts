import { createHash } from 'node:crypto';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, SdkError } from '@sheet-delver/sdk';
import { callerOf, contextConflict, requireOwnedActor } from './access';
import { shadowdarkAdapter } from './ShadowdarkAdapter';
import { documentId } from '../logic/identity';
import { reviewToken, reviewMatches } from './source-review';
import { operationProcess } from './operation-lock';

const hash = (value: any) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
type Status = 'pending' | 'started' | 'complete' | 'failed' | 'uncertain';
type WriteState = { status: Status; error?: string; acknowledged?: boolean; sourceVerified?: boolean; verificationPending?: boolean; receiptPending?: boolean; persistenceError?: string };
type Grant = WriteState & { item: any; itemId?: string };
type Terminal = { disposition: 'zero-write' | 'restored'; baseline: string; revision: number; callerId: string; at: string; note: string };
type Journal = { actorScope?: string; terminal?: Terminal; initialPatch?: { path: string; value?: unknown; absent: boolean }[]; requestId: string; fingerprint: string; process: string; revision: number; review: string; initialReview: string; finalReview?: string;
    targetLevel: number; grants: Grant[]; patch: any; advancement: WriteState;
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
const settledWithoutWrite = (op: WriteState & { itemId?: string }) => ['pending', 'failed'].includes(op.status) && !op.itemId && !op.acknowledged;
const unsettled = (journal: Journal) => [...journal.grants, journal.advancement].some(op => ['started', 'uncertain'].includes(op.status) || op.receiptPending || op.verificationPending);
const isComplete = (journal: Journal) => journal.advancement.status === 'complete' && !journal.advancement.receiptPending && !journal.advancement.verificationPending
    && journal.grants.every(op => op.status === 'complete' && !op.receiptPending && !op.verificationPending);
const isTerminal = (journal: Journal) => !!journal.terminal || isComplete(journal);
function receipt(journal: Journal, actor: any, revision: number | null) {
    const originalSource = reviewToken(actor) === journal.initialReview;
    const zeroWrite = journal.grants.every(settledWithoutWrite) && settledWithoutWrite(journal.advancement);
    return { requestId: journal.requestId, targetLevel: journal.targetLevel,
        state: journal.terminal ? 'retired' : isComplete(journal) ? 'complete' : 'partial', terminal: journal.terminal,
        contextRevision: revision, planRevision: journal.revision,
        canResolveRestored: !isTerminal(journal) && !zeroWrite && !unsettled(journal) && originalSource
            && journal.grants.every(op => !op.itemId || !(actor.items ?? []).some((item: any) => documentId(item) === op.itemId)),
        restoration: { values: journal.initialPatch ?? null,
            instructions: 'To close a partial operation after independent restoration: first reconcile every uncertain write to an exact owned ID or the exact final Actor outcome. Using ordinary authorized document controls, remove only the confirmed grants listed here and restore the original Actor values/source from your reviewed export. Refresh this review, record the restoration evidence, then verify and close the restored operation. This control performs no document writes. Unknown absent/in-flight outcomes cannot be declared restored.' },
        baseline: reviewToken(actor), operations: [...journal.grants.map((op, index) => ({ index, kind: 'item', name: op.item.name, status: op.status, itemId: op.itemId, error: op.error, acknowledged: op.acknowledged, receiptPending: op.receiptPending, verificationPending: op.verificationPending, persistenceError: op.persistenceError })),
            { kind: 'advancement', ...journal.advancement }],
        recovery: journal.terminal?.disposition === 'zero-write' ? 'Advancement was not applied. No document writes occurred. Start advancement again against current data; this saved request can never resume.'
            : journal.terminal ? 'Independent restoration verified. This saved request can never resume. Close this review and prepare a fresh advancement.'
            : 'Retry known refusals under the same rules. Review exact IDs to reconcile uncertain writes; they are never recreated automatically. Changed rules block replay. Zero-write rejections restart automatically; a settled partial plan can be closed after verified restoration using the controls below.' };
}
async function retireZeroWrite(req: ModuleServerRequest, journal: Journal, key: string, actor: any, revision: number | null) {
    if (isTerminal(journal) || !journal.grants.every(settledWithoutWrite) || !settledWithoutWrite(journal.advancement)) return false;
    const current = await requireOwnedActor(req.runtime, documentId(actor));
    if (contextConflict(req.runtime, revision)) return false;
    // These receipts prove this operation made no writes. Independent Actor
    // edits must survive retirement; only partial writes require restoration.
    journal.terminal = { disposition: 'zero-write', baseline: reviewToken(current), revision: revision!,
        callerId: (req.userSession?.userId ?? req.getAccessContext?.().userId)!, at: new Date().toISOString(),
        note: 'Advancement was not applied. Current character changes are preserved; start advancement again with current data.' };
    await req.runtime.dataStore.set(key, journal);
    return true;
}
/** Settle bookkeeping only when the entire dispatched operation is already present.
 * Caller holds the Actor queue. Never replay a write or infer an unknown Item ID. */
async function settleCompleted(req: ModuleServerRequest, journal: Journal, key: string, actor: any, revision: number | null) {
    if (isTerminal(journal) || !journal.finalReview || !['started', 'uncertain', 'complete'].includes(journal.advancement.status)
        || !journal.grants.every(op => op.status === 'complete' && op.itemId && !op.receiptPending && !op.verificationPending)) return false;
    const current = await requireOwnedActor(req.runtime, documentId(actor));
    if (contextConflict(req.runtime, revision)) throw new SdkError('conflict', 'World context changed while checking advancement completion.');
    if (reviewToken(current) !== journal.finalReview) return false;
    const ids = new Set<string>();
    for (const op of journal.grants) {
        const owned = current.items?.find((item: any) => documentId(item) === op.itemId);
        if (!owned || ids.has(op.itemId!) || (typeof owned.uuid === 'string' && owned.uuid.startsWith('Actor.')
            && owned.uuid !== `Actor.${documentId(current)}.Item.${op.itemId}`)) return false;
        ids.add(op.itemId!);
    }
    const completed = structuredClone(journal);
    completed.advancement = { ...completed.advancement, status: 'complete', sourceVerified: true, receiptPending: false, verificationPending: false };
    delete completed.advancement.error; delete completed.advancement.persistenceError;
    await req.runtime.dataStore.set(key, completed);
    Object.assign(journal, completed);
    return true;
}
export async function pendingAdvancement(req: ModuleServerRequest, actor: any) {
    const id = scope(req, documentId(actor)); if (!id) return null;
    const active = await req.runtime.dataStore.get<{ requestId: string; key: string }>(activeKey(req, documentId(actor)));
    // The Actor-wide fence must not expose a different caller's receipt.
    if (!active || active.key !== keyFor(id, active.requestId)) return null;
    const journal = await req.runtime.dataStore.get<Journal>(active.key);
    if (journal && active!.key === keyFor(id, journal.requestId)) {
        const revision = req.runtime.world!.snapshot().identity.contextRevision;
        if (await settleCompleted(req, journal, active.key, actor, revision)) return null;
        const retired = await retireZeroWrite(req, journal, active.key, actor, revision);
        if (retired) return receipt(journal, actor, req.runtime.world!.snapshot().identity.contextRevision);
    }
    return journal && !isTerminal(journal) ? receipt(journal, actor, req.runtime.world!.snapshot().identity.contextRevision) : null;
}

/** Shared caller projection refresh; no Foundry writes, only proven receipt completion/retirement. */
export async function advancementNeedsReview(req: ModuleServerRequest, actorId: string) {
    if (!scope(req, actorId)) return false;
    const owned = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
    if (!owned) return false;
    return (await pendingAdvancement(req, owned))?.state === 'partial';
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
    const result = async () => { actor = await requireOwnedActor(req.runtime, documentId(actor)); return json({ success: true, ...journal!.result, ...receipt(journal!, actor, revision) }); };
    if (journal && isTerminal(journal)) return result();
    if (journal && await settleCompleted(req, journal, key, actor, revision)) return result();
    if (journal && await retireZeroWrite(req, journal, key, actor, revision)) return result();
    const active = await store.get<{ requestId: string; key: string }>(activeKey(req, documentId(actor)));
    if (active && active.key !== key) {
        const prior = await store.get<Journal>(active.key);
        if (prior && active.key === keyFor(id, prior.requestId)) {
            await settleCompleted(req, prior, active.key, actor, revision);
            await retireZeroWrite(req, prior, active.key, actor, revision);
        }
        if (prior && !isTerminal(prior)) return error('conflict', `Advancement ${prior.requestId} is incomplete. Reopen and review its receipts before any new advancement.`);
    }
    if (!journal) {
        if (typeof body.baseline !== 'string' || !reviewMatches(actor, body.baseline)) return error('conflict', 'Review the current Actor before advancing.');
        const dependencies = [];
        for (const uuid of [...new Set(plan!.dependencies)]) {
            const doc = await shadowdarkAdapter.resolveDocumentFor(uuid, callerOf(req));
            if (!doc) return error('conflict', `Required advancement source ${uuid} is unavailable.`);
            dependencies.push({ uuid, hash: hash(doc) });
        }
        journal = { actorScope: activeKey(req, documentId(actor)), requestId: body.requestId, fingerprint: fingerprint(body), revision, process: operationProcess, review: reviewToken(actor), initialReview: reviewToken(actor),
            targetLevel: plan!.result.targetLevel, grants: plan!.items.map(item => ({ item, status: 'pending' })), patch: plan!.patch,
            advancement: { status: 'pending' }, dependencies, result: plan!.result,
            initialPatch: Object.keys(plan!.patch).map(path => { const value = path.split('.').reduce((obj, key) => obj?.[key], actor); return { path, absent: value === undefined, ...(value !== undefined ? { value: structuredClone(value) } : {}) }; }) };
        await store.set(key, journal); await store.set(activeKey(req, documentId(actor)), { requestId: body.requestId, key });
    }

    for (const op of [...journal.grants, journal.advancement]) if (op.status === 'started') op.status = 'uncertain';
    const recovery = body.recovery;
    if (recovery?.action && !['resolve-restored', 'reconcile'].includes(recovery.action)) return error('validation', 'Unknown advancement recovery action.');
    const reviewed = recovery?.reviewed === true && recovery.baseline === reviewToken(actor);
    if (recovery?.action === 'resolve-restored') {
        if (!reviewed) return error('conflict', 'Refresh and explicitly review the current Actor before retiring this operation.');
        const current = await requireOwnedActor(req.runtime, documentId(actor));
        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        if (reviewToken(current) !== recovery.baseline || reviewToken(current) !== journal.initialReview)
            return error('conflict', 'Retirement requires the exact original Actor source, independently restored when necessary. Refresh the review.');
        const zeroWrite = journal.grants.every(settledWithoutWrite) && settledWithoutWrite(journal.advancement);
        if (unsettled(journal)) return error('conflict', 'An uncertain or in-flight outcome remains. Reconcile its exact receipt before terminal resolution.');
        if (zeroWrite || journal.grants.some(op => op.itemId && current.items?.some((item: any) => documentId(item) === op.itemId)))
            return error('conflict', 'Verify removal of every exact confirmed grant and restoration of the original Actor before closing this partial operation.');
        if (typeof recovery.note !== 'string' || !recovery.note.trim() || recovery.note.length > 1000)
            return error('validation', 'Record the independent restoration evidence (1–1000 characters).');
        journal.terminal = { disposition: 'restored', baseline: recovery.baseline, revision: revision!,
            callerId: (req.userSession?.userId ?? req.getAccessContext?.().userId)!, at: new Date().toISOString(),
            note: recovery.note.trim() };
        // Keep the original journal and pointer. A replacement reads the durable
        // terminal disposition before releasing exclusion; no delete/save gap.
        await store.set(key, journal);
        return result();
    }
    if ((journal.process !== operationProcess || journal.review !== reviewToken(actor)) && !reviewed) return result();
    // Explicit reconciliation uses exact IDs and full planned source fields,
    // never names/origins as an inferred write acknowledgement.
    if (reviewed) {
        const confirmations = recovery.items ?? {};
        const used = new Set(journal.grants.map(op => op.itemId).filter(Boolean));
        const uncertain = journal.grants.filter(op => op.status === 'uncertain' || op.receiptPending || op.verificationPending);
        const withoutIds = (value: any): any => {
            const doc = structuredClone(value);
            delete doc._id; delete doc.id; delete doc.uuid;
            if (doc._stats) doc._stats = { compendiumSource: doc._stats.compendiumSource };
            if (Array.isArray(doc.effects)) doc.effects = doc.effects.map(withoutIds);
            return doc;
        };
        const includes = (actual: any, expected: any): boolean => Array.isArray(expected) ? Array.isArray(actual) && actual.length === expected.length && expected.every((val, i) => includes(actual[i], val))
            : expected && typeof expected === 'object' ? actual && Object.entries(expected).every(([key, val]) => includes(actual[key], val)) : actual === expected;
        for (const op of uncertain) {
            const index = journal.grants.indexOf(op), itemId = confirmations[index] ?? (op.acknowledged ? op.itemId : undefined);
            if (!itemId) continue;
            const owned = actor.items?.find((item: any) => documentId(item) === itemId);
            const ownUuid = `Actor.${documentId(actor)}.Item.${itemId}`;
            if ((op.itemId && op.itemId !== itemId) || journal.grants.some((other, otherIndex) => otherIndex !== index && other.itemId === itemId)
                || !owned || (typeof owned.uuid === 'string' && owned.uuid.startsWith('Actor.') && owned.uuid !== ownUuid)
                || !includes(withoutIds(owned), withoutIds(op.item)))
                return error('validation', `Item ${index + 1} requires its own exact owned ID matching the complete planned source and Actor parent.`);
            // Receipt history is not world data. Check IDs already assigned to
            // another operation via the public DataStore contract. Legacy
            // journals can be identified exactly within this caller's scope.
            for (const otherKey of await store.keys('advancement-')) {
                if (otherKey === key || otherKey.startsWith('advancement-active-')) continue;
                const other = await store.get<Journal>(otherKey);
                const sameActor = other?.actorScope === activeKey(req, documentId(actor))
                    || (!other?.actorScope && otherKey.startsWith(`advancement-${id}-`));
                if (sameActor && other?.grants?.some(grant => grant.itemId === itemId))
                    return error('validation', 'That exact Item ID is assigned to another advancement operation.');
            }
            op.itemId = itemId; op.status = 'complete'; op.sourceVerified = true; op.receiptPending = false; op.verificationPending = false; delete op.error; used.add(itemId);
        }
        if (journal.advancement.status === 'uncertain' || journal.advancement.receiptPending || journal.advancement.verificationPending) {
            if (journal.grants.every(op => op.status === 'complete') && journal.finalReview === reviewToken(actor)) {
                journal.advancement.status = 'complete'; journal.advancement.sourceVerified = true; journal.advancement.receiptPending = false; journal.advancement.verificationPending = false; delete journal.advancement.error;
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
    if (recovery?.action === 'reconcile') return result();
    if (journal.revision !== revision) return error('conflict', 'World context changed. Review and remediate the saved advancement; its old rules cannot be replayed.');
    for (const dependency of journal.dependencies) {
        const doc = await shadowdarkAdapter.resolveDocumentFor(dependency.uuid, callerOf(req));
        if (!doc || hash(doc) !== dependency.hash) return error('conflict', `Advancement source ${dependency.uuid} changed or became unavailable. Review the saved plan before remediation.`);
    }
    if (journal.grants.some(op => op.status === 'uncertain' || op.receiptPending || op.verificationPending) || journal.advancement.status === 'uncertain' || journal.advancement.receiptPending || journal.advancement.verificationPending) return result();
    if (reviewToken(actor) !== journal.review) return result();
    const apply = (source: any) => {
        const copy = structuredClone(source);
        for (const [path, value] of Object.entries(journal!.patch)) { const parts = path.split('.'); let target = copy;
            for (const part of parts.slice(0, -1)) target = target[part] ??= {}; target[parts.at(-1)!] = value; }
        return copy;
    };
    const refuse = async (op: Grant | Journal['advancement'], e: unknown) => {
        op.status = isSdkError(e) && ['permission_denied', 'validation', 'not_found'].includes(e.code) ? 'failed' : 'uncertain';
        op.error = getErrorMessage(e); await store.set(key, journal);
        await retireZeroWrite(req, journal!, key, actor, revision); return result();
    };
    const persistAcknowledgement = async (op: WriteState) => {
        try { await store.set(key, journal); return true; }
        catch (e) {
            // The upstream result is already known. A storage error must never
            // relabel it refused/unknown or authorize another document write.
            op.receiptPending = true; op.persistenceError = getErrorMessage(e);
            try { await store.set(key, journal); } catch { /* durable started fence remains; exact client ID can reconcile after recovery */ }
            return false;
        }
    };
    for (const op of journal.grants) {
        if (op.status === 'complete') continue;
        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        const current = await requireOwnedActor(req.runtime, documentId(actor));
        if (reviewToken(current) !== journal.review) {
            await retireZeroWrite(req, journal, key, current, revision);
            return result();
        }
        actor = current; op.status = 'started'; delete op.error; await store.set(key, journal);
        let created: any;
        try { created = await req.runtime.documents.items.create({ type: 'Actor', id: documentId(actor) }, op.item); }
        catch (e) { return refuse(op, e); }
        op.acknowledged = true;
        const itemId = documentId(created);
        if (!itemId) {
            op.status = 'uncertain'; op.error = 'Item creation was acknowledged without an authoritative embedded ID.';
            await persistAcknowledgement(op); return result();
        }
        op.itemId = itemId; op.status = 'complete';
        const expected = reviewToken({ ...actor, items: [...(actor.items ?? []), created] });
        journal.review = expected;
        try {
            const primary = await requireOwnedActor(req.runtime, documentId(actor));
            if (!primary.items?.some((item: any) => documentId(item) === itemId) || reviewToken(primary) !== expected)
                throw new Error(`Acknowledged Item ${itemId} needs exact primary-source review; creation will not repeat.`);
            actor = primary; op.sourceVerified = true;
        } catch (e) { op.verificationPending = true; op.error = getErrorMessage(e); }
        if (!await persistAcknowledgement(op) || op.verificationPending) return result();
    }
    const current = await requireOwnedActor(req.runtime, documentId(actor)); actor = current;
    if (reviewToken(actor) !== journal.review) {
        await retireZeroWrite(req, journal, key, actor, revision);
        return result();
    }
    const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
    journal.advancement.status = 'started'; journal.finalReview = reviewToken(apply(actor)); await store.set(key, journal);
    try { await req.runtime.documents.patch('Actor', documentId(actor), journal.patch); }
    catch (e) { return refuse(journal.advancement, e); }
    journal.advancement.acknowledged = true;
    try {
        actor = await requireOwnedActor(req.runtime, documentId(actor));
        if (reviewToken(actor) !== journal.finalReview) throw new Error('Final Actor source does not match the complete planned advancement.');
        journal.advancement.status = 'complete'; journal.advancement.sourceVerified = true; delete journal.advancement.error;
    } catch (e) {
        journal.advancement.status = 'complete'; journal.advancement.verificationPending = true; journal.advancement.error = getErrorMessage(e);
    }
    await persistAcknowledgement(journal.advancement);
    return result();
}
