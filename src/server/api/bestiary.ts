import { json, error, type ModuleServerRequest, type ModuleServerParams } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { prepareShadowdarkView } from '../../logic/prepared-view';
import { buildNpcCard } from '../../logic/resource-cards';
import { documentId, formatUuid, parseUuid } from '../../logic/identity';
import { callerOf } from '../access';

/**
 * Module bestiary: read-only NPC browsing and cards.
 *
 * - Declared monster packs (`shadowdark.monsters`) are offered to GMs only, by the
 *   module-wide caller policy in server/access.ts that every route applies. Core
 *   does not expose a world's compendium ownership configuration, and GMs often
 *   restrict monster packs, so players are not shown compendium monsters.
 * - World NPC Actors are listed and read through `req.runtime`, so Core's
 *   visibility projection decides what each caller may see.
 *
 * Cards come from the same preparation as sheets. There is no spawn, encounter
 * or sharing action.
 */
function summary(doc: any, uuid: string, source: 'compendium' | 'world') {
    const system = doc?.system ?? {};
    return {
        ref: parseUuid(uuid), name: doc?.name ?? 'Creature', img: doc?.img, source,
        level: Number(system.level?.value ?? 0), alignment: system.alignment ?? null,
        ac: system.attributes?.ac?.value ?? null, hp: system.attributes?.hp?.max ?? null,
    };
}

export async function handleBestiaryList(req: ModuleServerRequest) {
    try {
        const entries: any[] = [];
        const caller = callerOf(req);
        const gm = caller.isGM;
        if (gm) {
            const monsters = await shadowdarkAdapter.getCollection('monsters', { caller });
            for (const doc of monsters) if (doc?.type === 'NPC' && parseUuid(doc.uuid)) entries.push(summary(doc, doc.uuid, 'compendium'));
        }
        try {
            const world = await req.runtime.documents.list('Actor', { filter: { type: 'NPC' } });
            for (const row of world.rows as any[]) if (row?.type === 'NPC') entries.push(summary(row, `Actor.${documentId(row)}`, 'world'));
        } catch (e) {
            logger.warn('[ShadowdarkBestiary] World NPCs unavailable:', e);
        }
        entries.sort((a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name)));
        return json({ success: true, compendiumAvailable: gm, entries });
    } catch (e) {
        logger.error('[ShadowdarkBestiary] List failed:', e);
        return error('internal', getErrorMessage(e));
    }
}

export async function handleBestiaryCard(req: ModuleServerRequest, { params }: ModuleServerParams) {
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
        const view = prepareShadowdarkView(doc, shadowdarkAdapter.lookups());
        return json({ success: true, card: buildNpcCard(view, doc, ref) });
    } catch (e) {
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error('[ShadowdarkBestiary] Card failed:', e);
        return error('internal', getErrorMessage(e));
    }
}
