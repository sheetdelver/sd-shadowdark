import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { callerOf, contextConflict, requestRevision } from '../access';

/** Collections served from the declared-pack projection, filtered by the caller's pack capability (server/access.ts). */
const KNOWN = new Set(['ancestries', 'backgrounds', 'classes', 'deities', 'patrons', 'languages', 'spells', 'talents',
    'class-abilities', 'gear', 'magic-items', 'conditions', 'spell-effects', 'properties', 'tables', 'monsters']);

export async function handleGetCollection(req: ModuleServerRequest, id: string) {
    const revision = requestRevision(req.runtime);
    try {
        if (!KNOWN.has(id)) return error('not_found', `Collection '${id}' not found`);
        const url = new URL(req.url, 'http://localhost');
        const summary = url.searchParams.get('summary') === 'true';
        logger.debug(`Shadowdark API | Fetching collection: ${id} (summary: ${summary})`);
        return json(await shadowdarkAdapter.getCollection(id, { summary, caller: callerOf(req) }));
    } catch (e: unknown) {
        if (isSdkError(e)) return error(e.code, e.message);
        const conflict = contextConflict(req.runtime, revision);
        if (conflict) return conflict;
        logger.error(`Shadowdark API | Failed to get collection ${id}`, e);
        return error('internal', getErrorMessage(e));
    }
}
