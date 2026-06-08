import { json, error, type ModuleServerRequest, type ModuleServerParams } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

export async function handleGetDocument(_req: ModuleServerRequest, { params }: ModuleServerParams) {
    try {
        const { route } = await params;
        const uuid = route.slice(1).join('/');

        if (!uuid) {
            return error('validation', 'Missing UUID');
        }

        const document = await shadowdarkAdapter.resolveDocument(uuid);

        if (!document) {
            return error('not_found', `Document not found: ${uuid}`);
        }

        return json(document);
    } catch (e: unknown) {
        logger.error('Failed to get Shadowdark document', e);
        return error('internal', getErrorMessage(e));
    }
}
