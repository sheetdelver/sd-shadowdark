import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { getErrorMessage, logger } from '@sheet-delver/sdk';
import { getModuleFoundryClient } from '@server/shared/utils/getModuleFoundryClient';

export async function handleGetGear(request: Request): Promise<Response> {
    try {
        const client = getModuleFoundryClient(request);
        
        // Ensure system data is warmed/available
        const systemData = await shadowdarkAdapter.getSystemData(client);

        // Aggregate gear and magic items from the cache
        const combinedGear = [
            ...(systemData.gear || []),
            ...(systemData.magicItems || [])
        ];

        logger.info(`[API] handleGetGear: Returning ${combinedGear.length} combined items from cache.`);
        
        return Response.json(combinedGear);
    } catch (error: unknown) {
        logger.error('[API] Failed to get gear:', error);
        return Response.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
