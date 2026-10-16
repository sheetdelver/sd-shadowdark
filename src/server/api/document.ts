import { json, error, type ModuleServerRequest, type ModuleServerParams } from '@sheet-delver/sdk/server';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { getErrorMessage, isSdkError, logger } from '@sheet-delver/sdk';
import { parseUuid } from '../../logic/identity';
import { callerOf } from '../access';

/**
 * GET document/<uuid>. Declared compendium documents come from the shared pack
 * projection under the caller's pack policy (server/access.ts); world and
 * embedded documents are read through `req.runtime`, so Core's caller visibility
 * and projections apply (no system-level world reads).
 */
export async function handleGetDocument(req: ModuleServerRequest, { params }: ModuleServerParams) {
    try {
        const { route } = await params;
        const uuid = route.slice(1).join('/');

        if (!uuid) {
            return error('validation', 'Missing UUID');
        }
        if (!parseUuid(uuid)) {
            return error('validation', `Unsupported document reference: ${uuid}`);
        }

        const document = await shadowdarkAdapter.resolveDocumentFor(uuid, callerOf(req));

        if (!document) {
            return error('not_found', `Document not found or not visible: ${uuid}`);
        }

        return json(document);
    } catch (e: unknown) {
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error('Failed to get Shadowdark document', e);
        return error('internal', getErrorMessage(e));
    }
}
