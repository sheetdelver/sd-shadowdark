import { createHash } from 'node:crypto';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError } from '@sheet-delver/sdk';
import { callerOf, contextConflict, requestRevision, requireOwnedActor } from '../access';
import { documentId, sourceRef, formatUuid } from '../../logic/identity';
import { spellReview } from '../../logic/spell-review';
import { withActorLock } from '../operation-lock';
import { hasUnfinishedAdvancement } from '../advancement-operation';
import { missingSpellGrants, resolveSpellGrants } from '../spell-grants';

type Receipt = { status: 'started' | 'complete' | 'failed'; itemId?: string };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Automatic fixed grants: owner-only POST, exact sources, actor-wide durable deduplication. */
export async function handleSpellGrants(actorId: string, req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
        const world = req.runtime.world?.snapshot().identity;
        if (!world || revision === null || !req.runtime.dataStore) return error('not_ready', 'Spell grants need the current world and saved operation receipts.');
        const scope = `${world.instanceId}:${world.worldId}:${actorId}`;
        return await withActorLock(scope, async () => {
            let actor = await requireOwnedActor(req.runtime, actorId);
            if (actor.type !== 'Player') return json({ success: true, added: 0 });
            if (await hasUnfinishedAdvancement(req, actorId)) return error('conflict', 'Finish the pending advancement before applying other spell grants.');
            const missing = missingSpellGrants(actor.items ?? []);
            if (!missing.length) return json({ success: true, added: 0 });
            const reviewed = spellReview(actor);
            const grants = await resolveSpellGrants(actor.items ?? [], callerOf(req));
            actor = await requireOwnedActor(req.runtime, actorId);
            if (spellReview(actor) !== reviewed) return error('conflict', 'Character changed while loading granted spells. Refresh and retry.');
            let added = 0;
            for (const grant of grants) {
                const uuid = formatUuid(sourceRef(grant)!);
                // Shared across callers and reloads: a lost response never creates a new operation.
                const key = `fixed-spell-grant-${hash(`${scope}:${uuid}`)}`;
                const receipt = await req.runtime.dataStore.get<Receipt>(key);
                if (receipt && receipt.status !== 'failed') return error('conflict', 'A granted spell has a previous write receipt but is missing from the character. Review its saved Item in Foundry before retrying; it will not be duplicated.');
                const current = await requireOwnedActor(req.runtime, actorId);
                if (spellReview(current) !== spellReview(actor)) return error('conflict', 'Character changed before applying a spell grant. Refresh and retry.');
                const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
                await req.runtime.dataStore.set(key, { status: 'started' } satisfies Receipt);
                let created: any;
                try {
                    created = await req.runtime.documents.items.create({ type: 'Actor', id: actorId }, grant);
                } catch (e) {
                    // Only proven refusals can be retried. Unknown outcomes retain the write-ahead fence.
                    if (isSdkError(e) && ['permission_denied', 'validation', 'not_found'].includes(e.code)) await req.runtime.dataStore.set(key, { status: 'failed' } satisfies Receipt);
                    throw e;
                }
                const itemId = documentId(created);
                if (!itemId) return error('conflict', 'The granted spell was sent but its saved Item could not be confirmed. Refresh to review the character; it will not be created again.');
                await req.runtime.dataStore.set(key, { status: 'complete', itemId } satisfies Receipt);
                actor = { ...actor, items: [...(actor.items ?? []), created] };
                added++;
            }
            return json({ success: true, added });
        });
    } catch (e) {
        return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e));
    }
}
