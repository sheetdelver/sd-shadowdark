import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger, parseRollResult } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { prepareActorCore } from '../../logic/actor-preparation';
import {
    actionFormula, evaluateOutcome, planConsequences, prepareRequestedAction,
    type ActionRequest, type ConsequenceWrite, type RollOverrides,
} from '../../logic/actions';
import { documentId, formatUuid, parseUuid } from '../../logic/identity';

/**
 * POST actors/[id]/actions — executes a spell cast, Class Ability or potion with
 * its native consequences (PlayerSD.castSpell / useAbility / usePotion,
 * NpcSD.castSpell). The server re-reads the Actor through the caller, requires
 * owner access, prepares the action with the same shared preparer as the sheets,
 * refuses unavailable actions before rolling, rolls through `req.runtime.rolls`
 * and applies consequences with caller-bound writes. Repeating a request ID
 * returns the first result instead of rolling or consuming again.
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

const RESULTS_TTL_MS = 10 * 60 * 1000;
const results = new Map<string, { at: number; promise: Promise<unknown> }>();

function remember(key: string, run: () => Promise<unknown>): Promise<unknown> {
    const now = Date.now();
    for (const [entry, value] of results) if (now - value.at > RESULTS_TTL_MS) results.delete(entry);
    const existing = results.get(key);
    if (existing) return existing.promise;
    const promise = run();
    results.set(key, { at: now, promise });
    // A request that failed before rolling may be retried with the same ID.
    promise.catch(() => results.delete(key));
    return promise;
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
    try {
        const result = await remember(`${userId}:${actorId}:${body.requestId}`, () => execute(actorId, body, req));
        return json(result);
    } catch (e) {
        if (e instanceof ActionError) return error(e.code, e.message);
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error('[ShadowdarkActions] Action failed:', e);
        return error('internal', getErrorMessage(e));
    }
}

async function execute(actorId: string, body: ActionBody, req: ModuleServerRequest) {
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
        const doc = await shadowdarkAdapter.resolveDocumentFor(formatUuid(ref), req.runtime);
        if (doc?.type === 'Spell') resolvedSpells.set(formatUuid(ref), doc);
    }
    const lookups = { ...baseLookups, spellDocument: (ref: any) => resolvedSpells.get(formatUuid(ref)) ?? baseLookups.spellDocument?.(ref) ?? null };
    const core = prepareActorCore(actor, lookups);
    const request: ActionRequest = { kind: body.kind!, itemId: body.itemId, spellIndex: body.spellIndex, selected: body.selected };
    const action = prepareRequestedAction(core, actor, lookups, request);
    if (!action) throw new ActionError('not_found', 'That action is not available for this item.');
    if (!action.available) throw new ActionError('conflict', action.reason ?? 'The action is unavailable.');

    const speaker = { actor: documentId(actor), alias: actor.name };
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
            await req.runtime.chat.send({ content: `<p><strong>${label}</strong>: ${total} (manual roll)</p>`, speaker }, { rollMode: body.rollMode as any, speaker });
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
    const applied: Array<ConsequenceWrite & { status: 'applied' | 'failed'; error?: string }> = [];
    for (const write of writes) {
        try {
            if (write.op === 'delete') await req.runtime.documents.items.delete({ type: 'Actor', id: actorId }, write.itemId);
            else await req.runtime.documents.items.update({ type: 'Actor', id: actorId }, write.itemId, write.updates ?? {});
            applied.push({ ...write, status: 'applied' });
        } catch (e) {
            applied.push({ ...write, status: 'failed', error: getErrorMessage(e) });
            break;
        }
    }
    return {
        success: true,
        action: { id: action.id, label: action.label, dc: action.dc },
        roll, outcome,
        consequences: applied,
        pending: writes.slice(applied.length).map(write => write.description),
    };
}
