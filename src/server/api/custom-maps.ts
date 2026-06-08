import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { SYSTEM_PREDEFINED_EFFECTS, BOON_TYPE_MAP, EFFECT_TRANSLATIONS_MAP } from '../../data/talent-effects';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

/**
 * API handler to serve static Shadowdark rule mappings and predefined effects.
 * This is preferred over systemData for these specific constants to keep
 * the primary data stream lean and reliable.
 */
export async function handleGetCustomMaps(_req: ModuleServerRequest) {
    try {
        const payload = {
            PREDEFINED_EFFECTS: SYSTEM_PREDEFINED_EFFECTS,
            BOON_TYPES: BOON_TYPE_MAP,
            EFFECT_TRANSLATIONS: EFFECT_TRANSLATIONS_MAP,
            generatedAt: new Date().toISOString()
        };

        return json(payload);
    } catch (e: unknown) {
        logger.error('Failed to generate Shadowdark custom maps', e);
        return error('internal', getErrorMessage(e));
    }
}
