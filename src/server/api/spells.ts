import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { canonicalUuid, ownedCopy } from '../../logic/identity';
import { callerOf, contextConflict, requestRevision } from '../access';

/**
 * POST /api/modules/shadowdark/actors/[id]/spells/learn
 * Adds a copy of an exact Spell document to the Actor. The source is read
 * through the caller, must be a Spell, and is copied with all fields/effects and
 * its source identity. Core's write ownership still governs the create.
 */
export async function handleLearnSpell(actorId: string, req: ModuleServerRequest) {
    try {
        const { spellUuid } = await req.json<{ spellUuid?: string }>();
        const canonical = canonicalUuid(spellUuid);
        if (!canonical) return error('validation', 'A Spell UUID is required');

        const actor = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
        if (!actor) return error('not_found', 'Actor not found or not owned');

        const spellData = await shadowdarkAdapter.resolveDocumentFor(canonical, callerOf(req));
        if (!spellData) return error('not_found', `Spell not available: ${canonical}`);
        if (spellData.type !== 'Spell') return error('validation', `${spellData.name} is a ${spellData.type}, not a Spell`);

        const result = await req.runtime.documents.items.create({ type: 'Actor', id: actorId }, ownedCopy(spellData, canonical));
        return json({ success: true, data: result });
    } catch (e: unknown) {
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error('[API] Learn Spell Error:', e);
        return error('internal', getErrorMessage(e) || 'Failed to learn spell');
    }
}

/**
 * GET /api/modules/shadowdark/spells/list?class=<Class UUID>
 * Spells whose `system.class` contains the exact class UUID: declared-compendium
 * spells from packs the caller can read, plus caller-visible world spells. Distinct documents stay distinct even
 * when they share a name and tier.
 */
export async function handleGetSpellsBySource(req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const { searchParams } = new URL(req.url, 'http://localhost');
        const classUuid = canonicalUuid(searchParams.get('class'));
        if (!classUuid) return error('validation', 'class must be an exact Class UUID');
        const catalog = await shadowdarkAdapter.spellCatalog(callerOf(req), classUuid);
        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        if (catalog.state === 'failed') return error('not_ready', catalog.sources.map(source => `${source.source}: ${source.reason}`).join(' '));
        return json({ success: true, spells: catalog.rows, sources: catalog.sources, state: catalog.state });
    } catch (e: unknown) {
        return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e));
    }
}
