import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

export async function handleIndex(_req: ModuleServerRequest) {
    try {
        const systemData = await shadowdarkAdapter.getSystemData();

        logger.debug(`[ShadowdarkAPI] Responding with system data. Keys: ${Object.keys(systemData || {}).join(', ')}, IndexSize: ${Object.keys(systemData?.nameIndex || {}).length}`);

        return json(systemData);
    } catch (e: unknown) {
        logger.error('Failed to get Shadowdark system data', e);
        return error('internal', getErrorMessage(e));
    }
}
