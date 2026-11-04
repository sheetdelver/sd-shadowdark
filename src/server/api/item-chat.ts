import { createHash } from 'node:crypto';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { SdkError, getErrorMessage, isSdkError } from '@sheet-delver/sdk';
import { callerOf, requireOwnedActor, requestRevision, requestRules, contextConflict } from '../access';
import { withActorLock } from '../operation-lock';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { documentId } from '../../logic/identity';
import { prepareShadowdarkView } from '../../logic/prepared-view';
import { buildOwnedItemCard } from '../../logic/resource-cards';
import { itemChatCard } from '../../logic/item-chat';

interface Receipt { itemId: string; posted: boolean }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const uncertain = 'Sharing could not be confirmed. Check chat before sharing again.';

/** Posts a current, owner-authorized item snapshot. Never uses or changes the item. */
export async function handleItemChat(actorId: string, req: ModuleServerRequest) {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
    const revision = requestRevision(req.runtime);
    try {
        const body = await req.json<{ requestId?: unknown; itemId?: unknown }>();
        if (typeof body?.requestId !== 'string' || !/^[\w-]{8,80}$/.test(body.requestId)
            || typeof body.itemId !== 'string' || !body.itemId || body.itemId.length > 100)
            throw new SdkError('validation', 'Choose an owned item to share.');
        const world = req.runtime.world?.snapshot().identity;
        const user = req.userSession?.userId ?? req.getAccessContext?.().userId;
        if (!world || !user || !req.runtime.dataStore) throw new SdkError('not_ready', 'Chat is unavailable.');
        const scope = `${world.instanceId}:${world.worldId}:${actorId}`;
        const key = `item-chat-${hash([scope, user, body.requestId])}`;
        return await withActorLock(scope, async () => {
            const actor = await requireOwnedActor(req.runtime, actorId);
            const receipt = await req.runtime.dataStore.get<Receipt>(key);
            if (receipt && receipt.itemId !== body.itemId) throw new SdkError('conflict', 'The shared item changed.');
            const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
            if (receipt) return json({ posted: receipt.posted, replayed: true, ...(!receipt.posted ? { warning: uncertain } : {}) });
            const item = (actor.items ?? []).find((i: any) => documentId(i) === body.itemId);
            if (!item) throw new SdkError('not_found', 'This item is no longer on the character.');
            const lookups = await shadowdarkAdapter.callerLookups(actor, callerOf(req));
            const latest = await requireOwnedActor(req.runtime, actorId);
            if (hash(actor) !== hash(latest)) throw new SdkError('conflict', 'The character changed. Reopen the item and share again.');
            const card = buildOwnedItemCard(prepareShadowdarkView(latest, lookups, requestRules(req.runtime)), item, lookups);
            if (!card) throw new SdkError('not_found', 'This item cannot be shared.');
            const message = itemChatCard(card);
            const record: Receipt = { itemId: body.itemId as string, posted: false };
            // Record before posting: a lost acknowledgement must not duplicate chat on retry.
            await req.runtime.dataStore.set(key, record);
            const dispatchActor = await requireOwnedActor(req.runtime, actorId);
            if (hash(dispatchActor) !== hash(latest)) throw new SdkError('conflict', 'The character changed. Reopen the item and share again.');
            const retired = contextConflict(req.runtime, revision); if (retired) return retired;
            try {
                await req.runtime.chat.card(message, { rollMode: 'publicroll', speaker: { actor: actorId, alias: latest.name } });
                await req.runtime.dataStore.set(key, { ...record, posted: true });
                return json({ posted: true });
            } catch { return json({ posted: false, warning: uncertain }); }
        });
    } catch (e) { return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e)); }
}
