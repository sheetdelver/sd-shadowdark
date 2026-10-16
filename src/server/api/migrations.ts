import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { effectId, serializeChanges } from '../../logic/effects';
import { slugify } from '../../logic/foundry';
import { documentId } from '../../logic/identity';
import {
    actorEffectsInScope, EFFECT_KEY_MIGRATION_ID, EFFECT_KEY_MIGRATION_VERSION, planEffectMigration,
} from '../../logic/effect-key-migration';

/**
 * Automatic data migration (native Shadowdark 4.0.6 Update_251001_1 effect keys).
 *
 * Module routes are the only place the SDK allows writes, and they act as the
 * caller. Like native (which migrates when a GM loads the world), the module UI
 * calls this once per world for a GM, covering every world Actor and Item the GM
 * can write, and records a per-world marker. Owners opening a sheet that still
 * carries pre-4.0 keys migrate that Actor with their own permission. Unlinked
 * token deltas and world compendium packs are not reachable through the SDK.
 *
 * POST migrations/effect-keys  { worldId } (GM) or { actorId } (owner)
 * GET  migrations/effect-keys?worldId=…  → { done, marker }
 */
const isGM = (req: ModuleServerRequest) => req.userSession?.isGM === true || req.getAccessContext?.().isGM === true;
const markerKey = (worldId: string) => `migrations/${EFFECT_KEY_MIGRATION_ID}/${worldId}`;

interface Report {
    documents: number;
    effectsUpdated: number;
    migrated: Array<{ document: string; effect: string; from: string; to: string[] }>;
    unresolved: Array<{ document: string; effect: string; key: string; reason: string }>;
    failures: Array<{ document: string; effect: string; error: string }>;
}
const emptyReport = (): Report => ({ documents: 0, effectsUpdated: 0, migrated: [], unresolved: [], failures: [] });

async function spellSlugs(): Promise<Set<string>> {
    const spells = await shadowdarkAdapter.getCollection('spells', { summary: true }).catch(() => []);
    return new Set(spells.map((spell: any) => slugify(String(spell?.name ?? ''))).filter(Boolean));
}

/** Migrate the effects of one parent (Actor, owned Item or world Item). */
async function migrateEffects(req: ModuleServerRequest, report: Report, label: string, parent: { type: string; id: string },
    effects: any[], parentType: string | undefined, slugs: Set<string>) {
    for (const effect of Array.isArray(effects) ? effects : []) {
        const plan = planEffectMigration(effect, parentType, slugs);
        const name = String(effect?.name ?? 'Effect');
        for (const entry of plan.unresolved) report.unresolved.push({ document: label, effect: name, ...entry });
        if (!plan.changes) continue;
        try {
            await req.runtime.documents.effects.update(parent, effectId(effect), serializeChanges(effect, plan.changes));
            report.effectsUpdated++;
            for (const entry of plan.migrated) report.migrated.push({ document: label, effect: name, ...entry });
        } catch (cause) {
            report.failures.push({ document: label, effect: name, error: getErrorMessage(cause) });
        }
    }
}

export async function migrateActor(req: ModuleServerRequest, actor: any, report: Report, slugs: Set<string>) {
    const actorId = documentId(actor);
    const label = `Actor ${actor?.name ?? actorId}`;
    report.documents++;
    if (actorEffectsInScope(actor)) await migrateEffects(req, report, label, { type: 'Actor', id: actorId }, actor?.effects, undefined, slugs);
    for (const item of Array.isArray(actor?.items) ? actor.items : []) {
        await migrateEffects(req, report, `${label} / ${item?.name ?? 'Item'}`, { type: `Actor.${actorId}.Item`, id: documentId(item) }, item?.effects, item?.type, slugs);
    }
}

async function listAll(req: ModuleServerRequest, type: string): Promise<any[]> {
    const rows: any[] = [];
    for (let page = 1; page < 1000; page++) {
        const result = await req.runtime.documents.list(type, { page, pageSize: 100 });
        rows.push(...result.rows);
        if (!result.rows.length || rows.length >= result.total) break;
    }
    return rows;
}

export async function handleEffectKeyMigration(req: ModuleServerRequest) {
    try {
        if (req.method === 'GET') {
            const worldId = new URL(req.url, 'http://localhost').searchParams.get('worldId');
            if (!worldId) return error('validation', 'worldId is required');
            const marker = await req.runtime.dataStore.get<any>(markerKey(worldId));
            return json({ success: true, done: marker?.version === EFFECT_KEY_MIGRATION_VERSION, marker });
        }
        const body = await req.json<{ worldId?: string; actorId?: string }>();
        const slugs = await spellSlugs();
        const report = emptyReport();

        if (body.actorId) {
            // Owner path: one Actor, caller-bound; writes fail closed without ownership.
            const actor = await req.runtime.documents.get('Actor', body.actorId);
            if (!actor) return error('not_found', 'Actor not found');
            await migrateActor(req, actor, report, slugs);
            return json({ success: true, scope: 'actor', report });
        }

        if (!isGM(req)) return error('permission_denied', 'Only a GM can migrate the whole world.');
        if (!body.worldId) return error('validation', 'worldId is required');
        const existing = await req.runtime.dataStore.get<any>(markerKey(body.worldId));
        if (existing?.version === EFFECT_KEY_MIGRATION_VERSION) return json({ success: true, scope: 'world', alreadyDone: true, marker: existing });

        for (const row of await listAll(req, 'Actor')) {
            const actor = await req.runtime.documents.get('Actor', documentId(row));
            if (actor) await migrateActor(req, actor, report, slugs);
        }
        for (const row of await listAll(req, 'Item')) {
            const item: any = await req.runtime.documents.get('Item', documentId(row));
            if (!item) continue;
            report.documents++;
            await migrateEffects(req, report, `Item ${item.name ?? documentId(item)}`, { type: 'Item', id: documentId(item) }, item.effects, item.type, slugs);
        }
        const marker = {
            id: EFFECT_KEY_MIGRATION_ID, version: EFFECT_KEY_MIGRATION_VERSION, completedAt: new Date().toISOString(),
            by: req.userSession?.userId ?? null, documents: report.documents, effectsUpdated: report.effectsUpdated,
            unresolved: report.unresolved.length, failures: report.failures.length,
        };
        // A run with failed writes is not marked done, so the next GM visit retries.
        if (!report.failures.length) await req.runtime.dataStore.set(markerKey(body.worldId), marker);
        logger.info(`[Shadowdark] Effect key migration: ${report.effectsUpdated} effects updated across ${report.documents} documents (${report.failures.length} failures).`);
        return json({ success: true, scope: 'world', report, marker: report.failures.length ? null : marker });
    } catch (cause) {
        return isSdkError(cause) ? error(cause.code as any, cause.message) : error('internal', getErrorMessage(cause));
    }
}
