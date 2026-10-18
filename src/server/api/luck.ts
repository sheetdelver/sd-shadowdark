import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { contextConflict, requestRevision, requestRules } from '../access';
import { luckMode } from '../../logic/world-settings';

/**
 * POST actors/[id]/luck — sets a Player's luck in the world's luck mode.
 *
 * Native PlayerSD keeps luck in `system.luck.remaining` (a count) when the world
 * setting `shadowdark.usePulpMode` is on, and in `system.luck.available` (one
 * token) when it is off. The field written therefore depends on a world setting:
 *
 * - The client states the mode it showed and sends the Actor's prepared context
 *   revision (`X-SheetDelver-Context-Revision`); Core's module router refuses a
 *   stale revision before this handler runs.
 * - The mode is re-read from the request's world context. An unavailable setting
 *   or a different mode is a conflict; no mode is guessed and nothing is written.
 * - The write is the caller's own (Core's owner check applies).
 */
export async function handleLuck(actorId: string, req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        let body: { mode?: unknown; value?: unknown };
        try { body = await req.json(); }
        catch { return error('validation', 'Invalid JSON body'); }
        const rules = requestRules(req.runtime);
        const mode = luckMode(rules);
        const retired = contextConflict(req.runtime, revision);
        if (retired) return retired;
        if (mode === null) {
            return error('conflict', `Luck cannot be changed while the Pulp Mode setting is unavailable: ${rules.usePulpMode.status === 'unavailable' ? rules.usePulpMode.reason : ''}`.trim());
        }
        if (body.mode !== mode) {
            return error('conflict', `World rules changed: luck is now ${mode === 'pulp' ? 'a Pulp Mode count' : 'a single token'}. Refresh and try again.`);
        }
        let updates: Record<string, unknown>;
        if (mode === 'pulp') {
            if (typeof body.value !== 'number' || !Number.isInteger(body.value) || body.value < 0) return error('validation', 'Luck tokens must be a whole number of 0 or more.');
            updates = { 'system.luck.remaining': body.value };
        } else {
            if (typeof body.value !== 'boolean') return error('validation', 'The luck token is either available or not.');
            updates = { 'system.luck.available': body.value };
        }
        const actor: any = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
        if (!actor) return error('permission_denied', 'The Actor is not available to you as an owner.');
        if (actor.type !== 'Player') return error('validation', 'Only Player characters have luck.');
        await req.runtime.documents.patch('Actor', actorId, updates);
        return json({ success: true, mode, updates });
    } catch (e: unknown) {
        if (isSdkError(e)) return error(e.code, e.message);
        const conflict = contextConflict(req.runtime, revision);
        if (conflict) return conflict;
        logger.error('[ShadowdarkLuck] Update failed:', e);
        return error('internal', getErrorMessage(e));
    }
}
