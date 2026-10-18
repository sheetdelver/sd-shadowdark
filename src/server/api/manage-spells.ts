import { createHash } from 'node:crypto';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { SdkError, getErrorMessage, isSdkError } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { callerOf, contextConflict, requestRevision, requestRules } from '../access';
import { canonicalUuid, documentId, formatUuid, ownedCopy } from '../../logic/identity';
import { prepareShadowdarkView } from '../../logic/prepared-view';
import { spellReview } from '../../logic/spell-review';
import { withActorLock, operationProcess } from '../operation-lock';
import { sourceAllowed } from '../../logic/world-settings';

type Op = { kind: 'add' | 'remove'; target: string; status: 'pending' | 'started' | 'complete' | 'failed' | 'uncertain'; itemId?: string; error?: string };
type Journal = { fingerprint: string; review: string; revision: number; process: string; operations: Op[] };
type Body = { requestId: string; baseline: string; listUuid: string; tier: number; additions: string[]; removals: string[] };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Explicit inventory intent. Durable receipts contain identities/hashes, never a second world store. */
export async function handleManageSpells(actorId: string, req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const body = await req.json<Body>();
        const world = req.runtime.world?.snapshot().identity;
        if (!world || revision === null || !req.runtime.dataStore) return error('not_ready', 'Spell management needs the current world context and durable operation receipts.');
        if (!/^[\w-]{8,80}$/.test(body.requestId ?? '') || typeof body.baseline !== 'string' || !Array.isArray(body.additions) || !Array.isArray(body.removals)
            || body.additions.some(uuid => canonicalUuid(uuid) !== uuid) || body.removals.some(id => typeof id !== 'string' || !/^[\w-]+$/.test(id))
            || new Set(body.additions).size !== body.additions.length || new Set(body.removals).size !== body.removals.length || body.additions.length + body.removals.length > 100)
            return error('validation', 'Provide unique exact Spell additions and owned Item-ID removals with a requestId and reviewed baseline.');
        const callerId = req.userSession?.userId ?? req.getAccessContext?.().userId;
        if (!callerId) return error('permission_denied', 'A caller identity is required.');
        const actorScope = `${world.instanceId}:${world.worldId}:${actorId}`;
        const key = `spell-operation-${digest(`${actorScope}:${callerId}:${body.requestId}`)}`;
        const print = digest(JSON.stringify(body));
        return await withActorLock(actorScope, async () => {
            let actor: any = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
            if (!actor) return error('not_found', 'Actor not found or not owned');
            const store = req.runtime.dataStore;
            let journal = await store.get<Journal>(key);
            if (journal && journal.fingerprint !== print) return error('conflict', 'This requestId already identifies different spell changes.');
            const replayed = !!journal;
            // An interrupted create has no authoritative receipt. Never guess its
            // identity from a name/source, repeat it, or proceed to removals.
            if (journal) for (const op of journal.operations) if (op.status === 'started') op.status = 'uncertain';
            const result = () => json({ success: true, replayed, state: journal!.operations.every(op => op.status === 'complete') ? 'complete' : 'partial',
                operations: journal!.operations, baseline: spellReview(actor),
                recovery: journal!.operations.some(op => op.status === 'uncertain' && op.kind === 'add')
                    ? 'An addition has no confirmed receipt. Review the Actor in Foundry before submitting any new replacement; this request will not create again or remove spells.'
                    : journal!.process !== operationProcess ? 'Saved receipts survived a server restart. Refresh and review actual inventory before submitting remaining changes as a new operation. This request will not write again.' : null });
            if (journal?.operations.every(op => op.status === 'complete')) return result();
            if (journal && journal.process !== operationProcess) return result();
            if (journal?.operations.some(op => op.status === 'uncertain' && op.kind === 'add')) return result();
            const reviewed = digest(spellReview(actor));
            if (journal ? journal.review !== reviewed || journal.revision !== revision : digest(body.baseline) !== reviewed)
                return error('conflict', 'Character or world rules changed. Refresh and review actual results before changing more spells.');
            const lookups = await shadowdarkAdapter.callerLookups(actor, callerOf(req));
            const view = prepareShadowdarkView(actor, lookups, requestRules(req.runtime));
            const source = view.spellModel.sources.find(row => row.listUuid === body.listUuid);
            if (!source || !Number.isInteger(body.tier) || body.tier < 1 || body.tier > 5) return error('validation', 'The selected native casting list is unavailable.');
            const limit = source.limits[body.tier];
            if (body.additions.length && limit.status !== 'known') return error('validation', limit.reason);
            const operations = journal?.operations ?? [...body.additions.map(target => ({ kind: 'add' as const, target, status: 'pending' as const })),
                ...body.removals.map(target => ({ kind: 'remove' as const, target, status: 'pending' as const }))];
            const additions = new Map<string, any>();
            const filters = requestRules(req.runtime).sourceFilters;
            if (!filters || filters.value === null) return error('not_ready', 'Native source filters are unavailable. Refresh before reviewing additions.');
            for (const op of operations.filter(op => op.kind === 'add' && op.status !== 'complete')) {
                const doc = await shadowdarkAdapter.resolveDocumentFor(op.target, callerOf(req));
                if (!doc || doc.type !== 'Spell' || doc.system?.tier !== body.tier || !(doc.system?.class ?? []).some((uuid: unknown) => canonicalUuid(uuid) === source.listUuid))
                    return error('validation', 'An addition is unavailable or does not match the selected list and tier.');
                if (!sourceAllowed(doc, filters.value)) return error('conflict', 'An addition is hidden by the current native source filters. Review the refreshed catalog.');
                additions.set(op.target, ownedCopy(doc, op.target));
            }
            const owned = view.spellModel.owned;
            for (const op of operations.filter(op => op.kind === 'remove' && op.status !== 'complete')) {
                const row = owned.find(row => row.itemId === op.target);
                if (!row || row.innate || row.tier !== body.tier || (!row.classes.includes(source.listUuid) && row.classification !== 'unresolved')) return error('validation', 'A removal must identify an ordinary owned Spell on this list and tier.');
            }
            const remainingAdds = operations.filter(op => op.kind === 'add' && op.status !== 'complete').length;
            const remainingRemovals = operations.filter(op => op.kind === 'remove' && op.status !== 'complete').length;
            if (remainingAdds && owned.some(row => row.classification === 'unresolved' && (row.tier === body.tier || row.tier === null)))
                return error('validation', 'Owned spells have unresolved Class/tier data. They are retained and counted separately; resolve their exact sources before adding to this quota.');
            const known = owned.filter(row => !row.innate && row.tier === body.tier && row.classes.includes(source.listUuid)).length;
            // Existing excess is preserved. Removing excess is allowed; adding to
            // an unknown/exceeded quota is not silently a GM exception.
            if (remainingAdds && limit.status === 'known' && known + remainingAdds - remainingRemovals > limit.value) return error('validation', `Tier ${body.tier} allows ${limit.value} ordinary spells; existing inventory has ${known}.`);
            const latest = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
            if (!latest || digest(spellReview(latest)) !== reviewed) return error('conflict', 'Character changed during preflight; refresh and review.');
            const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
            if (!journal) { journal = { fingerprint: print, review: reviewed, revision, process: operationProcess, operations }; await store.set(key, journal); }
            for (const op of journal.operations) {
                if (op.status === 'complete') continue;
                const current: any = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
                if (!current || digest(spellReview(current)) !== journal.review) return error('conflict', 'Character changed between operations. Review completed receipts before continuing.');
                actor = current;
                op.status = 'started'; delete op.error;
                await store.set(key, journal); // write-ahead receipt; interrupted calls are uncertain
                try {
                    if (op.kind === 'add') {
                        const created = await req.runtime.documents.items.create({ type: 'Actor', id: actorId }, additions.get(op.target));
                        op.itemId = documentId(created);
                        if (!op.itemId) throw new Error('Create returned no authoritative embedded Item identity.');
                        actor.items = [...(actor.items ?? []), created];
                    } else {
                        await req.runtime.documents.items.delete({ type: 'Actor', id: actorId }, op.target);
                        actor.items = (actor.items ?? []).filter((item: any) => documentId(item) !== op.target);
                        op.itemId = op.target;
                    }
                    op.status = 'complete'; journal.review = digest(spellReview(actor));
                    await store.set(key, journal);
                } catch (e) {
                    op.status = isSdkError(e) && ['permission_denied', 'validation', 'not_found'].includes(e.code) ? 'failed' : 'uncertain';
                    op.error = getErrorMessage(e);
                    await store.set(key, journal);
                    break;
                }
            }
            return result();
        });
    } catch (e) {
        return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e));
    }
}
