import type { ModuleServerRequest } from '@sheet-delver/sdk/server';
import { logger } from '@sheet-delver/sdk';

interface ActorWithNotes {
    system?: {
        notes?: string;
        details?: {
            notes?: {
                value?: string;
            };
        };
    };
}

/**
 * Handle GET request for actor notes.
 */
export async function handleGetNotes(actorId: string, req: ModuleServerRequest) {
    try {
        const actor = await req.runtime.documents.get('Actor', actorId) as ActorWithNotes | null;

        if (!actor) {
            throw new Error('Actor not found');
        }

        const notes = actor.system?.notes || actor.system?.details?.notes?.value || '';

        return { notes };
    } catch (error) {
        logger.error('Error fetching actor notes:', error);
        throw error;
    }
}

/**
 * Handle POST request to update actor notes.
 */
export async function handleUpdateNotes(actorId: string, req: ModuleServerRequest) {
    try {
        const body = await req.json<{ notes?: unknown }>();
        const { notes } = body;

        if (typeof notes !== 'string') {
            throw new Error('Invalid notes data: must be a string');
        }

        // Patch the actor's notes via the document store (PC-only field path).
        await req.runtime.documents.patch('Actor', actorId, { 'system.notes': notes });

        logger.info(`Updated notes for actor ${actorId}`);

        return { success: true };
    } catch (error) {
        logger.error('Error updating actor notes:', error);
        throw error;
    }
}
