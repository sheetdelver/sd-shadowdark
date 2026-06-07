import type { ModuleServerRequest, ModuleServerParams } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { getErrorMessage, logger } from '@sheet-delver/sdk';

export async function handleGetDocument(_req: ModuleServerRequest, { params }: ModuleServerParams) {
    try {
        const { route } = await params;
        const uuid = route.slice(1).join('/');

        if (!uuid) {
            return Response.json({ error: 'Missing UUID' }, { status: 400 });
        }

        const document = await shadowdarkAdapter.resolveDocument(uuid);

        if (!document) {
            return Response.json({ error: `Document not found: ${uuid}` }, { status: 404 });
        }

        return Response.json(document);
    } catch (error: unknown) {
        logger.error('Failed to get Shadowdark document', error);
        return Response.json({ error: getErrorMessage(error) }, { status: 500 });
    }
}
