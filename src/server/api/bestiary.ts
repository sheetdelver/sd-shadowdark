import { json, error, type ModuleServerRequest, type ModuleServerParams } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { prepareShadowdarkView } from '../../logic/prepared-view';
import { buildNpcCard } from '../../logic/resource-cards';
import { documentId, formatUuid, parseUuid } from '../../logic/identity';
import { callerOf, canReadPack, contextConflict, requestRevision, requestRules } from '../access';
import { resolveMonsterArtwork } from '../community-artwork';
import { nativeMonsterLevel } from '../../logic/monster-catalog';

/** Monster Stats uses declared catalog NPCs and caller-visible world Actors.
 * Pack labels/capabilities come from the public caller-bound access surface.
 * Cards use shared NPC preparation; this browser has no write actions. */
async function summary(req: ModuleServerRequest, doc: any, uuid: string, source: 'compendium' | 'world', artwork = true) {
    const system = doc?.system ?? {};
    const ref = parseUuid(uuid);
    const pack = ref?.kind === 'compendium' ? ref.pack : null;
    const packs = req.runtime.access?.packs() ?? [];
    const metadata = pack ? packs.find(row => row.id === pack) : null;
    const label = metadata?.label || pack;
    const packLabel = metadata && packs.some(row => row.id !== pack && (row.label || row.id) === label) ? `${label} (${pack})` : label;
    return {
        ref, name: doc?.name ?? 'Creature', ...(artwork ? await resolveMonsterArtwork(req.runtime, doc, parseUuid(uuid)) : { img: doc?.img }), source,
        sourceId: pack ? `pack:${pack}` : 'world', sourceLabel: pack ? packLabel : 'World Actors',
        level: nativeMonsterLevel(system.level?.value), alignment: typeof system.alignment === 'string' ? system.alignment.trim() || null : null,
        move: typeof system.move === 'string' ? system.move.trim() || null : null,
        moveNote: typeof system.moveNote === 'string' ? system.moveNote.trim() || null : null,
        ac: system.attributes?.ac?.value ?? null, hp: system.attributes?.hp?.max ?? null,
    };
}

export async function handleBestiaryList(req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const entries: any[] = [];
        const caller = callerOf(req);
        try {
            const monsters = await shadowdarkAdapter.getCollection('monsters', { caller });
            entries.push(...await Promise.all(monsters.filter(doc => {
                const ref = parseUuid(doc.uuid);
                return doc?.type === 'NPC' && ref?.kind === 'compendium' && ref.documentType === 'Actor' && canReadPack(caller, ref.pack);
            }).map(doc => summary(req, doc, doc.uuid, 'compendium'))));
        } catch (e) {
            // No readable catalog is a valid world-only view; other failures must
            // remain visible instead of masquerading as an empty compendium.
            if (!isSdkError(e) || e.code !== 'permission_denied') throw e;
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
        entries.sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.sourceLabel.localeCompare(b.sourceLabel));
        const stale = contextConflict(req.runtime, revision);
        if (stale) return stale;
        const visible = entries.filter(entry => entry.ref && (entry.ref.kind !== 'compendium' || canReadPack(caller, entry.ref.pack)));
        const sources = [...new Map(visible.map(entry => [entry.sourceId, { id: entry.sourceId, label: entry.sourceLabel }])).values()];
        return json({ success: true, compendiumAvailable: visible.some(entry => entry.source === 'compendium'), sources, entries: visible });
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
