import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

/**
 * Generic handler to fetch a categorized collection from the warmed system projection.
 * Supports canonical names like 'ancestries', 'backgrounds', 'classes', etc.
 */
export async function handleGetCollection(req: ModuleServerRequest, id: string) {
    try {
        const url = new URL(req.url, 'http://localhost');
        const summary = url.searchParams.get('summary') === 'true';

        logger.debug(`Shadowdark API | Fetching collection: ${id} (summary: ${summary})`);
        
        const collection = await shadowdarkAdapter.getCollection(id, { summary });
        
        if (!collection || collection.length === 0) {
            // Check if it's a valid collection via the index
            const index = await shadowdarkAdapter.getRegistryIndex();
            const exists = Object.keys(index).some(uuid => uuid.includes(`.${id}.`));
            
            if (!exists && !['spells', 'gear', 'talents'].includes(id)) {
                logger.warn(`Shadowdark API | Collection not found: ${id}`);
                return error('not_found', `Collection '${id}' not found`);
            }
        }

        return json(collection);
    } catch (e: unknown) {
        logger.error(`Shadowdark API | Failed to get collection ${id}`, e);
        return error('internal', getErrorMessage(e));
    }
}
