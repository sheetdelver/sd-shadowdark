import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { ShadowdarkImporter } from '../importer';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

/**
 * POST import. Body: the Shadowdarklings export, or `{ character, confirm, allowCustomGear }`.
 * Without confirmation an import with unresolved references writes nothing and
 * returns `needsConfirmation` with the unresolved list.
 */
export async function handleImport(req: ModuleServerRequest) {
    try {
        const body: any = await req.json();
        const wrapped = body && typeof body === 'object' && body.character && typeof body.character === 'object';
        const character = wrapped ? body.character : body;
        const result = await new ShadowdarkImporter().importFromJSON(req.runtime, character, {
            confirm: wrapped && body.confirm === true, allowCustomGear: wrapped && body.allowCustomGear === true,
        });
        if (result.needsConfirmation) return json(result);
        if (!result.success) {
            logger.error('[API] Import Failed:', result.errors);
            return json(result, { status: result.id ? 207 : 400 });
        }
        return json(result);
    } catch (e: unknown) {
        logger.error('[Shadowdark API] Import Error:', e);
        return error('internal', getErrorMessage(e) || 'Import failed');
    }
}
