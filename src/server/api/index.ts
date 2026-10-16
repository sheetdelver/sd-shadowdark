import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { getErrorMessage, logger } from '@sheet-delver/sdk';
import { callerOf } from '../access';

/** GET index: system data with the name index filtered by the caller's pack policy. */
export async function handleIndex(req: ModuleServerRequest) {
    try {
        const systemData = await shadowdarkAdapter.getSystemDataFor(callerOf(req));

        logger.debug(`[ShadowdarkAPI] Responding with system data. Keys: ${Object.keys(systemData || {}).join(', ')}, IndexSize: ${Object.keys(systemData?.nameIndex || {}).length}`);

        return json(systemData);
    } catch (e: unknown) {
        logger.error('Failed to get Shadowdark system data', e);
        return error('internal', getErrorMessage(e));
    }
}
