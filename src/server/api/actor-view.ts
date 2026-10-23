import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { callerOf, contextConflict, requestRevision, requestRules } from '../access';
import { ShadowdarkNormalizer } from '../../logic/normalization';
import { spellReview } from '../../logic/spell-review';
import { reviewToken, reviewMatches } from '../source-review';
import { advancementNeedsReview } from '../advancement-operation';
import { missingSpellGrants } from '../spell-grants';
import { withActorLock } from '../operation-lock';

/** Bounded caller projection. No privileged registry or second world cache. */
export async function handleActorView(actorId: string, req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const baseline = req.method === 'GET' ? null : (await req.json<{ baseline?: string }>()).baseline;
        const actor = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'observer' });
        if (!actor) return error('not_found', 'Actor not found or not visible');
        const source = spellReview(actor);
        if (baseline !== null && (!baseline || !reviewMatches(actor, baseline))) return error('conflict', 'Character source changed; refresh before reviewing spells.');
        const lookups = await shadowdarkAdapter.callerLookups(actor, callerOf(req), { languages: true, identities: true });
        const world = req.runtime.world?.snapshot().identity;
        const advancementPending = await withActorLock(world ? `${world.instanceId}:${world.worldId}:${actorId}` : `${shadowdarkAdapter.runtimeGeneration}:${actorId}`,
            () => advancementNeedsReview(req, actorId));
        const latest = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'observer' });
        if (!latest || spellReview(latest) !== source) return error('conflict', 'Character source changed while dependencies loaded; refresh.');
        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        const normalized = ShadowdarkNormalizer.normalizeActorData(latest, {}, lookups, undefined, requestRules(req.runtime));
        const token = reviewToken(latest);
        const missingGrants = latest.type === 'Player' && missingSpellGrants(Array.isArray(latest.items) ? latest.items : []).length > 0;
        const canApplyGrants = missingGrants && !advancementPending && !!await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
        return json({ actor: { ...latest, ...normalized, advancementPending, spellGrants: { missing: missingGrants, canApply: canApplyGrants }, worldContextRevision: revision, spellReviewToken: token }, derived: normalized.derived, baseline: token });
    } catch (e) {
        return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e));
    }
}
