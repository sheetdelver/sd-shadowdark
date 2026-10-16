import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { canonicalUuid, ownedCopy } from '../../logic/identity';
import { callerOf } from '../access';

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
 * spells plus caller-visible world spells. Distinct documents stay distinct even
 * when they share a name and tier.
 */
export async function handleGetSpellsBySource(req: ModuleServerRequest) {
    try {
        const { searchParams } = new URL(req.url, 'http://localhost');
        const classUuid = canonicalUuid(searchParams.get('class'));
        if (!classUuid) return error('validation', 'class must be an exact Class UUID');

        const local = await shadowdarkAdapter.getSpellsForClass(classUuid);
        const world: any[] = [];
        try {
            const worldItems = await req.runtime.documents.list('Item', { filter: { type: 'Spell' } });
            for (const spell of worldItems.rows as any[]) {
                if (spell.type !== 'Spell') continue;
                if ((spell.system?.class ?? []).some((value: unknown) => canonicalUuid(value) === classUuid)) {
                    world.push({ ...spell, uuid: canonicalUuid(spell.uuid) ?? `Item.${spell._id}`, source: 'world' });
                }
            }
        } catch (err) {
            logger.warn('[API] Failed to fetch world spells:', err);
        }

        const byUuid = new Map<string, any>();
        for (const spell of [...local, ...world]) {
            const uuid = canonicalUuid(spell.uuid);
            if (uuid && !byUuid.has(uuid)) byUuid.set(uuid, { ...spell, uuid, tier: spell.system?.tier ?? null });
        }
        const merged = [...byUuid.values()].sort((a, b) => (a.tier ?? 0) - (b.tier ?? 0) || String(a.name).localeCompare(String(b.name)));
        return json({ success: true, spells: merged });
    } catch (e: unknown) {
        logger.error('[API] Fetch Spells Error:', e);
        return error('internal', getErrorMessage(e));
    }
}
