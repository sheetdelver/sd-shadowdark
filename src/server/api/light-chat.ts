import { createHash } from 'node:crypto';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { SdkError, getErrorMessage, isSdkError } from '@sheet-delver/sdk';
import { requireOwnedActor, requestRevision, contextConflict } from '../access';
import { withActorLock } from '../operation-lock';
import { documentId } from '../../logic/identity';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
interface Receipt { itemId: string; active: boolean; posted: boolean }

/** Notification after confirmed inventory writes. Never toggles a light or retries chat. */
export async function handleLightChat(actorId: string, req: ModuleServerRequest) {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 });
    const revision = requestRevision(req.runtime);
    try {
        const body = await req.json<{ requestId?: unknown; itemId?: unknown; active?: unknown }>();
        if (typeof body.requestId !== 'string' || !/^[\w-]{8,80}$/.test(body.requestId)
            || typeof body.itemId !== 'string' || !body.itemId || body.itemId.length > 100 || typeof body.active !== 'boolean')
            throw new SdkError('validation', 'Invalid light notification.');
        const world = req.runtime.world?.snapshot().identity;
        const user = req.userSession?.userId ?? req.getAccessContext?.().userId;
        if (!world || !req.runtime.dataStore || !user) throw new SdkError('not_ready', 'Light notification is unavailable.');
        const scope = `${world.instanceId}:${world.worldId}:${actorId}`;
        const key = 'light-chat-' + createHash('sha256').update(JSON.stringify([scope, user, body.requestId])).digest('hex');
        return await withActorLock(scope, async () => {
            const actor = await requireOwnedActor(req.runtime, actorId);
            const receipt = await req.runtime.dataStore.get<Receipt>(key);
            if (receipt && (receipt.itemId !== body.itemId || receipt.active !== body.active))
                throw new SdkError('conflict', 'Light notification request changed.');
            const retired = contextConflict(req.runtime, revision); if (retired) return retired;
            if (receipt) return json({ posted: receipt.posted, replayed: true,
                ...(!receipt.posted ? { warning: 'The light changed, but its chat card could not be confirmed. Check chat; it will not be posted again automatically.' } : {}) });
            const item = (actor.items ?? []).find((entry: any) => documentId(entry) === body.itemId);
            if (item?.system?.light?.isSource !== true || item.system.light.active !== body.active)
                throw new SdkError('conflict', 'The light state changed. No chat card was posted.');
            const setting = req.runtime.world!.snapshot().settings['shadowdark.playerShowLightRemaining'];
            const seconds = item.system.light.remainingSecs;
            const showTime = (setting?.status === 'world' || setting?.status === 'registered-default') && setting.value === 2;
            const time = showTime && typeof seconds === 'number' && Number.isFinite(seconds) && seconds >= 0
                ? `<p>${seconds < 60 ? 'Less than 1 minute' : `${Math.floor(seconds / 60)} min`} remaining</p>` : '';
            const record: Receipt = { itemId: body.itemId as string, active: body.active as boolean, posted: false };
            // Save before dispatch so an uncertain acknowledgement cannot duplicate the card.
            await req.runtime.dataStore.set(key, record);
            const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
            try {
                await req.runtime.chat.card({ title: `${item.name ?? 'Light source'} ${body.active ? 'lit' : 'extinguished'}`,
                    content: `<p>${escapeHtml(actor.name)} ${body.active ? 'lights' : 'extinguishes'} ${escapeHtml(item.name ?? 'a light source')}.</p>${time}` },
                    { rollMode: 'publicroll', speaker: { actor: actorId, alias: actor.name } });
                await req.runtime.dataStore.set(key, { ...record, posted: true });
                return json({ posted: true });
            } catch {
                return json({ posted: false, warning: 'The light changed, but its chat card could not be confirmed. Check chat; it will not be posted again automatically.' });
            }
        });
    } catch (e) {
        return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e));
    }
}
