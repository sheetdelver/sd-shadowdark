import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

/** Collections served from the declared-pack projection. Monsters are GM-only (see bestiary.ts). */
const KNOWN = new Set(['ancestries', 'backgrounds', 'classes', 'deities', 'patrons', 'languages', 'spells', 'talents',
    'class-abilities', 'gear', 'magic-items', 'conditions', 'spell-effects', 'properties', 'tables', 'monsters']);

export async function handleGetCollection(req: ModuleServerRequest, id: string) {
    try {
        if (!KNOWN.has(id)) return error('not_found', `Collection '${id}' not found`);
        if (id === 'monsters' && !(req.userSession?.isGM === true || req.getAccessContext?.().isGM === true)) {
            return error('permission_denied', 'Compendium monsters are available to GMs.');
        }
        const url = new URL(req.url, 'http://localhost');
        const summary = url.searchParams.get('summary') === 'true';
        logger.debug(`Shadowdark API | Fetching collection: ${id} (summary: ${summary})`);
        return json(await shadowdarkAdapter.getCollection(id, { summary }));
    } catch (e: unknown) {
        logger.error(`Shadowdark API | Failed to get collection ${id}`, e);
        return error('internal', getErrorMessage(e));
    }
}
