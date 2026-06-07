import type { ModuleServerRequest } from '@sheet-delver/sdk/server';
import { ShadowdarkImporter } from '../importer';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

export async function handleImport(req: ModuleServerRequest) {
    try {
        const json = await req.json();

        // Use Module Logic
        const importer = new ShadowdarkImporter();
        const result = await importer.importFromJSON(req.runtime, json);

        if (!result.success) {
            logger.error('[API] Import Failed:', result.errors);
            return Response.json({ success: false, errors: result.errors, debug: result.debug }, { status: 400 });
        }

        return Response.json({ success: true, id: result.id, errors: result.errors, debug: result.debug });

    } catch (error: unknown) {
        logger.error('[Shadowdark API] Import Error:', error);
        if (error instanceof Error && error.stack) logger.error(error.stack);
        return Response.json({
            error: getErrorMessage(error) || 'Import failed',
            details: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}
