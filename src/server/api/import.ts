import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { ShadowdarkImporter } from '../importer';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

export async function handleImport(req: ModuleServerRequest) {
    try {
        const body = await req.json();

        // Use Module Logic
        const importer = new ShadowdarkImporter();
        const result = await importer.importFromJSON(req.runtime, body);

        if (!result.success) {
            logger.error('[API] Import Failed:', result.errors);
            return json({ success: false, errors: result.errors, debug: result.debug }, { status: 400 });
        }

        return json({ success: true, id: result.id, errors: result.errors, debug: result.debug });

    } catch (e: unknown) {
        logger.error('[Shadowdark API] Import Error:', e);
        if (e instanceof Error && e.stack) logger.error(e.stack);
        return error('internal', getErrorMessage(e) || 'Import failed');
    }
}
