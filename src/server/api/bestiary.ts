import { json, error, type ModuleServerRequest, type ModuleServerParams } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { prepareShadowdarkView } from '../../logic/prepared-view';
import { buildNpcCard } from '../../logic/resource-cards';
import { documentId, formatUuid, parseUuid } from '../../logic/identity';
import { callerOf, canReadPack, contextConflict, requestRevision, requestRules } from '../access';
import { resolveMonsterArtwork } from '../community-artwork';

/**
 * Module bestiary: read-only NPC browsing and cards.
 *
 * - The declared monster pack (`shadowdark.monsters`) is offered when the caller's
 *   effective native pack capability allows it (server/access.ts), the same
 *   policy every route applies. GMs often restrict monster packs; Core decides.
 * - World NPC Actors are listed and read through `req.runtime`, so Core's
 *   visibility projection decides what each caller may see.
 *
 * Cards come from the same preparation as sheets. There is no spawn, encounter
 * or sharing action.
 */
async function summary(req: ModuleServerRequest, doc: any, uuid: string, source: 'compendium' | 'world', artwork = true) {
    const system = doc?.system ?? {};
    return {
        ref: parseUuid(uuid), name: doc?.name ?? 'Creature', ...(artwork ? await resolveMonsterArtwork(req.runtime, doc, parseUuid(uuid)) : { img: doc?.img }), source,
        level: Number(system.level?.value ?? 0), alignment: system.alignment ?? null,
        ac: system.attributes?.ac?.value ?? null, hp: system.attributes?.hp?.max ?? null,
    };
}

export async function handleBestiaryList(req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const entries: any[] = [];
        const caller = callerOf(req);
        const compendiumAvailable = canReadPack(caller, 'shadowdark.monsters');
        if (compendiumAvailable) {
            const monsters = await shadowdarkAdapter.getCollection('monsters', { caller });
            entries.push(...await Promise.all(monsters.filter(doc => doc?.type === 'NPC' && parseUuid(doc.uuid)).map(doc => summary(req, doc, doc.uuid, 'compendium'))));
        }
        try {
            const world = await req.runtime.documents.list('Actor', { filter: { type: 'NPC' } });
            for (const row of world.rows as any[]) if (row?.type === 'NPC') {
                const result = await summary(req, row, `Actor.${documentId(row)}`, 'world');
                const current = await req.runtime.documents.get('Actor', documentId(row));
                if (current?.type === 'NPC') entries.push(JSON.stringify(current) === JSON.stringify(row) ? result
                    : await summary(req, current, `Actor.${documentId(current)}`, 'world', false));
            }
        } catch (e) {
            logger.warn('[ShadowdarkBestiary] World NPCs unavailable:', e);
        }
        entries.sort((a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name)));
        const stale = contextConflict(req.runtime, revision);
        if (stale) return stale;
        return json({ success: true, compendiumAvailable: canReadPack(caller, 'shadowdark.monsters'),
            entries: entries.filter(entry => entry.ref.kind !== 'compendium' || canReadPack(caller, entry.ref.pack)) });
    } catch (e) {
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error('[ShadowdarkBestiary] List failed:', e);
        return error('internal', getErrorMessage(e));
    }
}

export async function handleBestiaryCard(req: ModuleServerRequest, { params }: ModuleServerParams) {
    const revision = requestRevision(req.runtime);
    try {
        const { route } = await params;
        const ref = parseUuid(route.slice(1).join('/'));
        if (!ref) return error('validation', 'An exact NPC reference is required');
        let doc: any = null;
        if (ref.kind === 'compendium') {
            doc = await shadowdarkAdapter.resolveDocumentFor(formatUuid(ref), callerOf(req));
        } else if (ref.kind === 'world' && ref.documentType === 'Actor') {
            doc = await req.runtime.documents.get('Actor', ref.id);
        }
        if (!doc || doc.type !== 'NPC') return error('not_found', 'NPC not found or not visible');
        const artwork = await resolveMonsterArtwork(req.runtime, doc, ref);
        const observed = doc;
        const retired = contextConflict(req.runtime, revision);
        if (retired) return retired;
        if (ref.kind === 'compendium' && !canReadPack(callerOf(req), ref.pack)) return error('permission_denied', 'This compendium is no longer available.');
        if (ref.kind === 'world') {
            // Read current authorized source after optional asset I/O. A custom
            // portrait or permission change must win over the earlier snapshot.
            doc = await req.runtime.documents.get('Actor', ref.id);
            if (!doc || doc.type !== 'NPC') return error('not_found', 'NPC not found or not visible');
        }
        const view = prepareShadowdarkView(doc, shadowdarkAdapter.lookups(), requestRules(req.runtime));
        return json({ success: true, card: { ...buildNpcCard(view, doc, ref), ...(JSON.stringify(doc) === JSON.stringify(observed) ? artwork : { img: doc.img }) } });
    } catch (e) {
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error('[ShadowdarkBestiary] Card failed:', e);
        return error('internal', getErrorMessage(e));
    }
}
