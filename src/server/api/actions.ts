import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger, parseRollResult } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { prepareActorCore } from '../../logic/actor-preparation';
import {
    actionFormula, evaluateOutcome, planConsequences, prepareRequestedAction,
    type ActionRequest, type ConsequenceWrite, type RollOverrides,
} from '../../logic/actions';
import { documentId, formatUuid, parseUuid } from '../../logic/identity';
import { callerOf, contextConflict, requestRevision, requestRules } from '../access';

/**
 * POST actors/[id]/actions — executes a spell cast, Class Ability or potion with
 * its native consequences (PlayerSD.castSpell / useAbility / usePotion,
 * NpcSD.castSpell). The server re-reads the Actor through the caller, requires
 * owner access, prepares the action with the same shared preparer as the sheets,
 * refuses unavailable actions before rolling, rolls through `req.runtime.rolls`
 * and applies consequences with caller-bound writes.
 *
 * Request identity (ADR-0001 RV-03): a request id is bound to the adapter
 * runtime, the user, the Actor and the request body. Repeating it with the same
 * body re-checks owner access and returns the first result (`replayed: true`)
 * instead of rolling or consuming again; reusing it for a different body is a
 * conflict. A failure before a result exists may be retried. Once a roll is
 * evaluated it is never rolled again: a chat failure after that is reported as
 * a warning, and a replay of a `partial` result re-reads the Actor and applies
 * only the consequences not yet reflected there.
 *
 * World context (G8-C): the client sends the Actor's prepared context revision
 * as `X-SheetDelver-Context-Revision`; Core's module router refuses a stale one
 * (409 `world-context-changed`) before this handler runs, and the request
 * runtime fails closed if the context changes during the request. A replay is
 * keyed without the revision, so after a context change the same request id
 * returns the recorded result and never rolls again.
 *
 * Multi-document consequences are sequential, not atomic; each write's outcome
 * is reported.
 */
interface ActionBody {
    requestId?: string;
    kind?: 'spell' | 'ability' | 'potion';
    itemId?: string;
    spellIndex?: number;
    selected?: string[];
    overrides?: RollOverrides & { manualValue?: number };
    focus?: boolean;
    rollMode?: string;
}

type WriteStatus = { status: 'applied' | 'failed' | 'pending'; error?: string };
interface ActionRecord {
    head: { action: { id: string; label: string; dc: number | null }; roll: { formula: string; total: number } | null; outcome: unknown };
    writes: ConsequenceWrite[];
    statuses: WriteStatus[];
    warnings: string[];
}
interface Entry { at: number; generation: number; fingerprint: string; record: Promise<ActionRecord>; lock: Promise<unknown> }

const RESULTS_TTL_MS = 10 * 60 * 1000;
const results = new Map<string, Entry>();

/** Canonical request body (everything but the id), with sorted keys. */
function fingerprint(body: ActionBody): string {
    const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
        : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical((value as any)[key])])) : value;
    const { requestId: _id, ...rest } = body;
    return JSON.stringify(canonical(rest));
}

function prune(now: number, generation: number) {
    for (const [key, entry] of results) if (now - entry.at > RESULTS_TTL_MS || entry.generation !== generation) results.delete(key);
}

function response(record: ActionRecord, replayed = false) {
    const done = record.statuses.every(entry => entry.status === 'applied');
    return {
        success: true, ...record.head,
        state: done ? 'complete' as const : 'partial' as const,
        consequences: record.writes.flatMap((write, index) => {
            const { status, error } = record.statuses[index];
            return status === 'pending' ? [] : [{ ...write, status, ...(error ? { error } : {}) }];
        }),
        pending: record.writes.filter((_, index) => record.statuses[index].status === 'pending').map(write => write.description),
        warnings: record.warnings,
        ...(replayed ? { replayed: true } : {}),
    };
}

const valueAt = (source: any, path: string) => path.split('.').reduce((value, key) => value?.[key], source);

/** Whether the Actor already shows a consequence (item gone, or every updated field equal). */
function reflected(write: ConsequenceWrite, actor: any): boolean {
    const item = (Array.isArray(actor?.items) ? actor.items : []).find((entry: any) => documentId(entry) === write.itemId);
    if (write.op === 'delete') return !item;
    return !!item && Object.entries(write.updates ?? {}).every(([path, value]) => JSON.stringify(valueAt(item, path)) === JSON.stringify(value));
}

/** Applies the consequences not yet applied, stopping at the first failure. */
async function applyOutstanding(record: ActionRecord, actorId: string, req: ModuleServerRequest, actor: any | null) {
    for (const [index, write] of record.writes.entries()) {
        if (record.statuses[index].status === 'applied') continue;
        if (actor && reflected(write, actor)) { record.statuses[index] = { status: 'applied' }; continue; }
        try {
            if (write.op === 'delete') await req.runtime.documents.items.delete({ type: 'Actor', id: actorId }, write.itemId);
            else await req.runtime.documents.items.update({ type: 'Actor', id: actorId }, write.itemId, write.updates ?? {});
            record.statuses[index] = { status: 'applied' };
        } catch (e) {
            record.statuses[index] = { status: 'failed', error: getErrorMessage(e) };
            break;
        }
    }
}

/** A repeated identical request: current owner access first, then reconcile a partial result. */
async function replay(record: ActionRecord, actorId: string, req: ModuleServerRequest) {
    const actor: any = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
    if (!actor) throw new ActionError('permission_denied', 'The Actor is not available to you as an owner.');
    if (record.statuses.some(entry => entry.status !== 'applied')) await applyOutstanding(record, actorId, req, actor);
    return response(record, true);
}

/** First d20 kept by the main roll (RollSD criticals use dice[0].total). */
function naturalResult(raw: unknown): number | null {
    const parsed = parseRollResult(raw);
    const first = (parsed.terms ?? []).find((term: any) => term && Array.isArray(term.results) && Number(term.faces) === 20) as any;
    if (!first) return null;
    const kept = first.results.filter((result: any) => result.active !== false && !result.discarded);
    if (kept.length !== 1) return null;
    const value = Number(kept[0].result);
    return Number.isFinite(value) ? value : null;
}

class ActionError extends Error {
    constructor(readonly code: 'validation' | 'not_found' | 'permission_denied' | 'conflict', message: string) { super(message); }
}

export async function handleActorAction(actorId: string, req: ModuleServerRequest) {
    let body: ActionBody;
    try { body = await req.json<ActionBody>(); }
    catch { return error('validation', 'Invalid JSON body'); }
    if (!body.requestId || !/^[\w-]{8,80}$/.test(body.requestId)) return error('validation', 'A requestId is required');
    if (!['spell', 'ability', 'potion'].includes(body.kind ?? '')) return error('validation', 'kind must be spell, ability or potion');
    const userId = req.userSession?.userId ?? req.getAccessContext?.().userId ?? 'anonymous';
    const generation = shadowdarkAdapter.runtimeGeneration;
    const key = `${generation}:${userId}:${actorId}:${body.requestId}`;
    const print = fingerprint(body);
    const revision = requestRevision(req.runtime);
    try {
        const now = Date.now();
        prune(now, generation);
        const existing = results.get(key);
        if (existing) {
            if (existing.fingerprint !== print) throw new ActionError('conflict', 'This request id was already used for a different action.');
            // Replays of one request run one at a time, after the first execution.
            const run = existing.lock.then(async () => replay(await existing.record, actorId, req));
            existing.lock = run.catch(() => undefined);
            return json(await run);
        }
        const record = execute(actorId, body, req);
        const entry: Entry = { at: now, generation, fingerprint: print, record, lock: record.catch(() => undefined) };
        results.set(key, entry);
        // No result exists yet (refused, unavailable, or the roll itself failed): retryable.
        record.catch(() => { if (results.get(key) === entry) results.delete(key); });
        return json(response(await record));
    } catch (e) {
        if (e instanceof ActionError) return error(e.code, e.message);
        if (isSdkError(e)) return error(e.code, e.message);
        const conflict = contextConflict(req.runtime, revision);
        if (conflict) return conflict;
        logger.error('[ShadowdarkActions] Action failed:', e);
        return error('internal', getErrorMessage(e));
    }
}

async function execute(actorId: string, body: ActionBody, req: ModuleServerRequest): Promise<ActionRecord> {
    const actor: any = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
    if (!actor) throw new ActionError('permission_denied', 'The Actor is not available to you as an owner.');
    const items: any[] = Array.isArray(actor.items) ? actor.items : [];
    const triggering = items.find(item => documentId(item) === body.itemId);
    if (!triggering) throw new ActionError('not_found', 'The item is no longer on this Actor.');

    const baseLookups = shadowdarkAdapter.lookups();
    // Scroll/wand spells may be world documents: resolve them through the caller.
    const spellRefs = triggering.type === 'Scroll' ? [triggering.system?.spellUuid]
        : triggering.type === 'Wand' ? (triggering.system?.spells ?? []).map((entry: any) => entry?.uuid) : [];
    const resolvedSpells = new Map<string, any>();
    for (const value of spellRefs) {
        const ref = parseUuid(value);
        if (!ref) continue;
        const doc = await shadowdarkAdapter.resolveDocumentFor(formatUuid(ref), callerOf(req));
        if (doc?.type === 'Spell') resolvedSpells.set(formatUuid(ref), doc);
    }
    const lookups = { ...baseLookups, spellDocument: (ref: any) => resolvedSpells.get(formatUuid(ref)) ?? baseLookups.spellDocument?.(ref) ?? null };
    // Rule inputs from the request's world context; Core pins its revision for this request.
    const core = prepareActorCore(actor, lookups, requestRules(req.runtime));
    const request: ActionRequest = { kind: body.kind!, itemId: body.itemId, spellIndex: body.spellIndex, selected: body.selected };
    const action = prepareRequestedAction(core, actor, lookups, request);
    if (!action) throw new ActionError('not_found', 'That action is not available for this item.');
    if (!action.available) throw new ActionError('conflict', action.reason ?? 'The action is unavailable.');

    const speaker = { actor: documentId(actor), alias: actor.name };
    const warnings: string[] = [];
    let outcome = null;
    let roll: { formula: string; total: number } | null = null;
    // Native useAbility checks uses after the dialog and before rolling.
    if (action.kind !== 'potion' && action.dc !== null) {
        const manual = body.overrides?.manualValue;
        if (manual !== undefined && manual !== null) {
            const total = Number(manual) + (body.overrides?.abilityBonus ?? action.abilityBonus) + (body.overrides?.itemBonus ?? action.itemBonus)
                + (body.overrides?.talentBonus ?? action.talentBonus);
            if (!Number.isFinite(total)) throw new ActionError('validation', 'The manual roll is not a number.');
            outcome = evaluateOutcome(action, total, Number(manual));
            roll = { formula: `${manual} (manual)`, total };
            const label = String(action.label).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!));
            // The result is final from here: a chat failure is reported, not retried.
            try {
                await req.runtime.chat.send({ content: `<p><strong>${label}</strong>: ${total} (manual roll)</p>`, speaker }, { rollMode: body.rollMode as any, speaker });
            } catch (e) {
                warnings.push(`The roll was not posted to chat: ${getErrorMessage(e)}`);
            }
        } else {
            const formula = actionFormula(action, body.overrides ?? {});
            const result = await req.runtime.rolls.roll(formula, action.label, {
                displayChat: true, rollMode: body.rollMode as any, speaker,
                flags: { shadowdark: { actionId: action.id, dc: action.dc } },
            });
            const parsed = parseRollResult(result, formula);
            outcome = evaluateOutcome(action, parsed.total, naturalResult(result));
            roll = { formula, total: parsed.total };
        }
    } else {
        // Drinking an unidentified potion reveals it (native toggleIdentified).
        const name = action.kind === 'potion' && triggering.system?.identification?.identified === false && triggering.system.identification.name
            ? triggering.system.identification.name : triggering.name;
        const escaped = String(name).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!));
        await req.runtime.chat.send({ content: `<p><strong>${action.kind === 'potion' ? 'Drinks' : 'Uses'} ${escaped}</strong></p>`, speaker }, { rollMode: body.rollMode as any, speaker });
    }

    const writes: ConsequenceWrite[] = planConsequences(action, triggering, outcome, { focus: body.focus === true });
    // Native usePotion identifies the potion before consuming it.
    if (action.kind === 'potion' && triggering.system?.identification?.identified === false) {
        writes.unshift({ op: 'update', itemId: documentId(triggering), updates: { 'system.identification.identified': true }, description: `${triggering.name} is identified.` });
    }
    const record: ActionRecord = {
        head: { action: { id: action.id, label: action.label, dc: action.dc }, roll, outcome },
        writes, statuses: writes.map(() => ({ status: 'pending' as const })), warnings,
    };
    await applyOutstanding(record, actorId, req, null);
    return record;
}
