import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { contextConflict, requestRevision } from '../access';

/**
 * GET index: the same caller-safe projection Core serves at `/api/system/data`
 * (`getSystemDataForUser`), built from the caller's own compendium reads.
 */
export async function handleIndex(req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const runtime = req.runtime;
        const systemData = await shadowdarkAdapter.getSystemDataForUser({
            compendium: runtime.compendium, access: runtime.access, world: runtime.world, documents: runtime.documents,
        });
        logger.debug(`[ShadowdarkAPI] Responding with caller system data. IndexSize: ${Object.keys(systemData?.nameIndex || {}).length}`);
        return json(systemData);
    } catch (e: unknown) {
        if (isSdkError(e)) return error(e.code, e.message);
        const conflict = contextConflict(req.runtime, revision);
        if (conflict) return conflict;
        logger.error('Failed to get Shadowdark system data', e);
        return error('internal', getErrorMessage(e));
    }
}
