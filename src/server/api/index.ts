import type { ModuleServerRequest } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

export async function handleIndex(_req: ModuleServerRequest) {
    try {
        const systemData = await shadowdarkAdapter.getSystemData();

        logger.debug(`[ShadowdarkAPI] Responding with system data. Keys: ${Object.keys(systemData || {}).join(', ')}, IndexSize: ${Object.keys(systemData?.nameIndex || {}).length}`);

        return Response.json(systemData);
    } catch (error: unknown) {
        logger.error('Failed to get Shadowdark system data', error);
        return Response.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
