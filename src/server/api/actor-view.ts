import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { callerOf, contextConflict, requestRevision, requestRules } from '../access';
import { prepareShadowdarkView } from '../../logic/prepared-view';
import { spellReview } from '../../logic/spell-review';

/** Bounded caller projection, using exactly the same preparer as server actions. */
export async function handleActorView(actorId: string, req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const { baseline } = await req.json<{ baseline?: string }>();
        const actor = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'observer' });
        if (!actor) return error('not_found', 'Actor not found or not visible');
        if (!baseline || spellReview(actor) !== baseline) return error('conflict', 'Character source changed; refresh before reviewing spells.');
        const lookups = await shadowdarkAdapter.callerLookups(actor, callerOf(req));
        const latest = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'observer' });
        if (!latest || spellReview(latest) !== baseline) return error('conflict', 'Character source changed while dependencies loaded; refresh.');
        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        return json({ derived: prepareShadowdarkView(latest, lookups, requestRules(req.runtime)), baseline });
    } catch (e) {
        return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e));
    }
}
