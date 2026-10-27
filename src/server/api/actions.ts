import { recordSpellLoss } from '../spell-loss';
import { createHash } from 'node:crypto';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, parseRollResult } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { prepareActorCore } from '../../logic/actor-preparation';
import { actionFormula, evaluateOutcome, planConsequences, planPrerequisites, prepareRequestedAction,
    type ActionRequest, type ConsequenceWrite, type RollOverrides } from '../../logic/actions';
import { documentId } from '../../logic/identity';
import { spellReview } from '../../logic/spell-review';
import { callerOf, contextConflict, requestRevision, requestRules, requireOwnedActor } from '../access';
import { operationProcess, withActorLock } from '../operation-lock';
import { rollSpellMishap, type MishapReceipt } from '../spell-mishaps';

/** Native ordered operation: prerequisites → one result attempt → consequences.
 * Receipts are caller/Actor/world/request-bound. SDK writes are sequential, not
 * atomic/CAS. A lost result is uncertain and is never requested again. Durable
 * receipts survive restart; incomplete records require fresh review then. */
interface ActionBody {
    requestId?: string; kind?: 'spell' | 'ability' | 'potion'; itemId?: string;
    spellIndex?: number; selected?: string[]; overrides?: RollOverrides & { manualValue?: number };
    focus?: boolean; rollMode?: string;
}
type WriteStatus = { status: 'applied' | 'failed' | 'pending' | 'started' | 'uncertain'; error?: string };
type Phase = 'prerequisites' | 'result-pending' | 'result-uncertain' | 'consequences' | 'complete' | 'review-required';
interface ActionRecord {
    head: { action: { id: string; label: string; dc: number | null }; roll: { formula: string; total: number } | null; outcome: unknown };
    writes: ConsequenceWrite[]; statuses: WriteStatus[]; warnings: string[];
    phase: Phase; prerequisiteCount: number; retryable: boolean; review: string; dependencies: string[];
    mishap?: MishapReceipt;
    presentation?: { speaker: Record<string, unknown>; rollMode?: string };
}
interface Entry { at: number; generation: number; fingerprint: string; process: string; record: ActionRecord }
type Save = (record: ActionRecord) => Promise<void>;
const results = new Map<string, Entry>();
const continuations = new WeakMap<ActionRecord, (req: ModuleServerRequest, save: Save) => Promise<void>>();
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const fingerprint = ({ requestId: _id, ...body }: ActionBody) => digest(JSON.stringify(canonical(body)));
const review = (actor: any) => digest(spellReview(actor));
const valueAt = (source: any, path: string) => path.split('.').reduce((value, key) => value?.[key], source);
const itemFor = (actor: any, id: string) => (actor.items ?? []).find((item: any) => documentId(item) === id);

function response(record: ActionRecord, replayed = false) {
    return { success: true, ...record.head, phase: record.phase,
        state: record.phase === 'complete' ? 'complete' : 'partial', retryable: record.retryable,
        consequences: record.writes.flatMap((write, i) => record.statuses[i].status === 'pending' ? [] : [{ ...write, ...record.statuses[i] }]),
        pending: record.writes.filter((_, i) => record.statuses[i].status === 'pending').map(write => write.description),
        warnings: record.warnings, ...(record.mishap ? { mishap: record.mishap } : {}), ...(replayed ? { replayed: true } : {}) };
}
async function finishConsequences(record: ActionRecord, actorId: string, req: ModuleServerRequest, actor: any, save: Save) {
    if (!await applyWrites(record, actorId, req, actor, save, record.prerequisiteCount, record.writes.length)) return;
    if (record.mishap) await rollSpellMishap(record.mishap, req, record.presentation?.speaker ?? { actor: actorId },
        record.presentation?.rollMode, record.warnings, record.dependencies, () => save(record));
    record.phase = 'complete';
}
function reflected(write: ConsequenceWrite, actor: any) {
    let target = itemFor(actor, write.itemId);
    if (write.op === 'delete') return !target;
    if (write.op === 'effect-update') target = target?.effects?.find((effect: any) => documentId(effect) === write.effectId);
    return !!target && Object.entries(write.updates ?? {}).every(([path, value]) => JSON.stringify(valueAt(target, path)) === JSON.stringify(value));
}
function applyLocal(actor: any, write: ConsequenceWrite) {
    if (write.op === 'delete') { actor.items = (actor.items ?? []).filter((item: any) => documentId(item) !== write.itemId); return; }
    let target = itemFor(actor, write.itemId);
    if (write.op === 'effect-update') target = target?.effects?.find((effect: any) => documentId(effect) === write.effectId);
    if (!target) return;
    for (const [path, value] of Object.entries(write.updates ?? {})) {
        const keys = path.split('.'); const leaf = keys.pop()!;
        let owner = target; for (const key of keys) owner = owner[key] ??= {};
        owner[leaf] = structuredClone(value);
    }
}
async function ownerActor(actorId: string, req: ModuleServerRequest): Promise<any> {
    const actor = await requireOwnedActor(req.runtime, actorId);
    return structuredClone(actor);
}
/** Confirmed source projections can reconcile idempotent post-result patches;
 * an uncertain prerequisite never authorizes a result. */
async function applyWrites(record: ActionRecord, actorId: string, req: ModuleServerRequest, actor: any, save: Save, start: number, end: number) {
    for (let i = start; i < end; i++) {
        const write = record.writes[i];
        if (record.statuses[i].status === 'applied') continue;
        if (write.op === 'effect-update') {
            // Native toggleIdentified enables every effect with Promise.all.
            // Dispatch the complete group; one refusal cannot hide the other
            // effects' actual outcomes, and no result follows a failed group.
            let stop = i; while (stop < end && record.writes[stop].op === 'effect-update') stop++;
            const indices = Array.from({ length: stop - i }, (_, offset) => i + offset).filter(index => {
                if (record.statuses[index].status === 'applied') return false;
                if (reflected(record.writes[index], actor)) { record.statuses[index] = { status: 'applied' }; return false; }
                return true;
            });
            for (const index of indices) record.statuses[index] = { status: 'started' };
            await save(record);
            const outcomes = await Promise.allSettled(indices.map(index => { const effect = record.writes[index];
                return req.runtime.documents.effects.update({ type: `Actor.${actorId}.Item`, id: effect.itemId }, effect.effectId!, effect.updates ?? {}); }));
            let failed = false;
            outcomes.forEach((outcome, offset) => {
                const index = indices[offset];
                if (outcome.status === 'fulfilled') { applyLocal(actor, record.writes[index]); record.statuses[index] = { status: 'applied' }; }
                else {
                    failed = true;
                    const refused = isSdkError(outcome.reason) && ['permission_denied', 'validation', 'not_found'].includes(outcome.reason.code);
                    record.statuses[index] = { status: refused ? 'failed' : 'uncertain', error: getErrorMessage(outcome.reason) };
                    if (!refused) record.retryable = false;
                }
            });
            record.review = review(actor);
            if (failed) record.warnings.push('Potion fields were identified, but not every effect activation has a confirmed receipt. No chat/use/delete followed.');
            await save(record); if (failed) return false;
            i = stop - 1; continue;
        }
        if (reflected(write, actor)) { record.statuses[i] = { status: 'applied' }; await save(record); continue; }
        record.statuses[i] = { status: 'started' }; await save(record);
        try {
            if (write.op === 'delete') await req.runtime.documents.items.delete({ type: 'Actor', id: actorId }, write.itemId);
            else await req.runtime.documents.items.update({ type: 'Actor', id: actorId }, write.itemId, write.updates ?? {});
            applyLocal(actor, write); record.review = review(actor);
            record.statuses[i] = { status: 'applied' }; await save(record);
            if(write.op==='update') await recordSpellLoss(req,actorId,write.itemId,write.updates??{});
        } catch (e) {
            const refused = isSdkError(e) && ['permission_denied', 'validation', 'not_found'].includes(e.code);
            const prerequisite = i < record.prerequisiteCount;
            record.statuses[i] = { status: prerequisite && !refused ? 'uncertain' : 'failed', error: getErrorMessage(e) };
            if (prerequisite && !refused) record.retryable = false;
            if (prerequisite) record.warnings.push('The result was not requested because a prerequisite write was refused or uncertain. Review actual source state before starting another action.');
            await save(record); return false;
        }
    }
    return true;
}
function requireReview(record: ActionRecord, message: string) {
    record.phase = 'review-required'; record.retryable = false;
    if (!record.warnings.includes(message)) record.warnings.push(message);
}
async function replay(entry: Entry, actorId: string, req: ModuleServerRequest, save: Save) {
    const actor = await ownerActor(actorId, req), record = entry.record;
    for (const uuid of record.dependencies ?? []) if (!await shadowdarkAdapter.resolveDocumentFor(uuid, callerOf(req)))
        throw new ActionError('permission_denied', 'An action dependency is no longer readable. Review current data; its result will not be repeated.');
    if (record.phase === 'complete') return response(record, true);
    if (entry.process !== operationProcess || !continuations.has(record)) {
        requireReview(record, 'Incomplete receipts survived a restart or expired execution lease. Review actual inventory/results; this request will not spend, post or roll again.');
        await save(record); return response(record, true);
    }
    if (!record.retryable || ['result-pending','result-uncertain','review-required'].includes(record.phase)) return response(record, true);
    if (record.phase === 'consequences') {
        const outstanding = record.writes.slice(record.prerequisiteCount).filter((_, i) => record.statuses[i + record.prerequisiteCount].status !== 'applied');
        if (review(actor) !== record.review && !outstanding.every(write => reflected(write, actor))) {
            requireReview(record, 'Actor source changed after the result. Review actual outstanding consequences; the result will not be repeated.'); await save(record); return response(record, true);
        }
        // Reconcile only the known outcome's remaining consequences. Never re-enter
        // prerequisites or the result call, even after a world-context change.
        await finishConsequences(record, actorId, req, actor, save);
        await save(record);
    } else {
        if (review(actor) !== record.review) { requireReview(record, 'Actor source changed before the result. Review the actual spent/identified state.'); await save(record); }
        else if (await applyWrites(record, actorId, req, actor, save, 0, record.prerequisiteCount)) await continuations.get(record)!(req, save);
    }
    return response(record, true);
}
function naturalResult(raw: unknown): number | null {
    const first = (parseRollResult(raw).terms ?? []).find((term: any) => Array.isArray(term?.results) && Number(term.faces) === 20) as any;
    const kept = first?.results.filter((r: any) => r.active !== false && !r.discarded);
    return kept?.length === 1 && Number.isFinite(Number(kept[0].result)) ? Number(kept[0].result) : null;
}
class ActionError extends Error {
    constructor(readonly code: 'validation' | 'not_found' | 'permission_denied' | 'conflict', message: string) { super(message); }
}
export async function handleActorAction(actorId: string, req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const body = await req.json<ActionBody>();
        if (!/^[\w-]{8,80}$/.test(body.requestId ?? '')) return error('validation', 'A requestId is required');
        if (!['spell','ability','potion'].includes(body.kind ?? '')) return error('validation', 'kind must be spell, ability or potion');
        const generation = shadowdarkAdapter.runtimeGeneration;
        const userId = req.userSession?.userId ?? req.getAccessContext?.().userId ?? 'anonymous';
        const world = req.runtime.world?.snapshot().identity;
        const actorScope = world ? `${world.instanceId}:${world.worldId}:${actorId}` : `${generation}:${actorId}`;
        const key = `${generation}:${userId}:${actorId}:${body.requestId}`;
        const durableKey = world ? `action-operation-${digest(`${actorScope}:${userId}:${body.requestId}`)}` : null;
        const print = fingerprint(body);
        return await withActorLock(actorScope, async () => {
            for (const [id, entry] of results) if (entry.generation !== generation || Date.now() - entry.at > 600_000) results.delete(id);
            let entry = results.get(key);
            // Receipts never bypass a current owner read, including after restart.
            if (!entry && durableKey && req.runtime.dataStore) {
                await ownerActor(actorId, req);
                entry = await req.runtime.dataStore.get<Entry>(durableKey) ?? undefined;
            }
            const save: Save = async record => {
                const saved = { at: Date.now(), generation, fingerprint: print, process: operationProcess, record };
                results.set(key, saved);
                if (durableKey && req.runtime.dataStore) await req.runtime.dataStore.set(durableKey, saved);
            };
            if (entry) {
                if (entry.fingerprint !== print) return error('conflict', 'This request id was already used for a different action.');
                return json(await replay(entry, actorId, req, save));
            }
            const record = await execute(actorId, body, req, save);
            return json(response(record));
        });
    } catch (e) {
        return contextConflict(req.runtime, revision) ?? error(e instanceof ActionError || isSdkError(e) ? e.code : 'internal', getErrorMessage(e));
    }
}
async function execute(actorId: string, body: ActionBody, req: ModuleServerRequest, save: Save): Promise<ActionRecord> {
    const actor = await ownerActor(actorId, req);
    const triggering = itemFor(actor, body.itemId ?? '');
    if (!triggering) throw new ActionError('not_found', 'The item is no longer on this Actor.');
    const lookups = body.kind === 'spell' ? await shadowdarkAdapter.callerLookups(actor, callerOf(req)) : shadowdarkAdapter.lookups();
    const core = prepareActorCore(actor, lookups, requestRules(req.runtime));
    const request: ActionRequest = { kind: body.kind!, itemId: body.itemId, spellIndex: body.spellIndex, selected: body.selected };
    const action = prepareRequestedAction(core, actor, lookups, request);
    if (!action?.available) throw new ActionError('conflict', action?.reason ?? 'That action is unavailable.');
    let prerequisites: ConsequenceWrite[];
    try { prerequisites = planPrerequisites(action, triggering); } catch (e) { throw new ActionError('validation', getErrorMessage(e)); }
    const manual = body.overrides?.manualValue;
    const total = manual === undefined || manual === null ? null : Number(manual) + (body.overrides?.abilityBonus ?? action.abilityBonus)
        + (body.overrides?.itemBonus ?? action.itemBonus) + (body.overrides?.talentBonus ?? action.talentBonus);
    if (total !== null && !Number.isFinite(total)) throw new ActionError('validation', 'The manual roll is not a number.');
    const record: ActionRecord = { head: { action: { id: action.id, label: action.label, dc: action.dc }, roll: null, outcome: null },
        writes: prerequisites, statuses: prerequisites.map(() => ({ status: 'pending' })), warnings: [], phase: 'prerequisites', prerequisiteCount: prerequisites.length, retryable: true, review: review(actor), dependencies: [...(lookups.dependencies ?? [])] };
    const revision = requestRevision(req.runtime);
    const continueResult = async (runtimeReq: ModuleServerRequest, persist: Save) => {
        const fresh = await ownerActor(actorId, runtimeReq);
        if (review(fresh) !== record.review || contextConflict(runtimeReq.runtime, revision)) {
            requireReview(record, 'Character or world context changed before the result; review actual prerequisite state.'); await persist(record); return;
        }
        // Persist before attempting a result. Any interrupted/failed call is
        // uncertain; its roll/chat may already exist upstream.
        record.phase = 'result-pending'; await persist(record);
        const speaker = { actor: actorId, alias: actor.name };
        let outcome = null;
        try {
            if (action.kind !== 'potion' && action.dc !== null) {
                if (total !== null) {
                    outcome = evaluateOutcome(action, total, null); // a manual total establishes no natural die
                    record.head.roll = { formula: `${manual} (manual)`, total }; record.head.outcome = outcome;
                    try { await runtimeReq.runtime.chat.send({ content: `<p><strong>${escapeHtml(action.label)}</strong>: ${total} (manual roll)</p>`, speaker }, { rollMode: body.rollMode as any, speaker }); }
                    catch (e) { record.warnings.push(`The final manual result was not posted to chat: ${getErrorMessage(e)}`); }
                } else {
                    const formula = actionFormula(action, body.overrides ?? {});
                    const result = await runtimeReq.runtime.rolls.roll(formula, action.label, { displayChat: true, rollMode: body.rollMode as any, speaker, flags: { shadowdark: { actionId: action.id, dc: action.dc } } });
                    const parsed = parseRollResult(result, formula);
                    if (!Number.isFinite(parsed.total)) throw new Error('The result returned no valid total.');
                    outcome = evaluateOutcome(action, parsed.total, naturalResult(result));
                    record.head.roll = { formula, total: parsed.total }; record.head.outcome = outcome;
                }
            } else {
                const currentName = itemFor(fresh, action.itemId!)?.name ?? triggering.name;
                await runtimeReq.runtime.chat.send({ content: `<p><strong>${action.kind === 'potion' ? 'Drinks' : 'Uses'} ${escapeHtml(currentName)}</strong></p>`, speaker }, { rollMode: body.rollMode as any, speaker });
            }
        } catch (e) {
            record.phase = 'result-uncertain'; record.retryable = false;
            record.warnings.push(`Prerequisites remain applied. The result call failed or has no confirmed receipt (${getErrorMessage(e)}); this request will not spend, post or roll again.`);
            await persist(record); return;
        }
        if (body.focus && !action.focusAllowed) record.warnings.push('Focus is unavailable for this action. Its normal failure rules apply.');
        const writes = planConsequences(action, triggering, outcome, { focus: body.focus === true && action.focusAllowed });
        if (outcome?.criticalFailure && action.mishap) {
            record.mishap = { rule: action.mishap, status: 'pending' };
            record.presentation = { speaker, rollMode: body.rollMode };
        }
        record.writes.push(...writes); record.statuses.push(...writes.map(() => ({ status: 'pending' as const })));
        record.phase = 'consequences'; await persist(record);
        await finishConsequences(record, actorId, runtimeReq, fresh, persist);
        await persist(record);
    };
    continuations.set(record, continueResult);
    await save(record);
    if (await applyWrites(record, actorId, req, actor, save, 0, record.prerequisiteCount)) await continueResult(req, save);
    return record;
}
const escapeHtml = (value: unknown) => String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!));
