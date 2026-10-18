import { getErrorMessage } from '@sheet-delver/sdk';
import type { SDKContextValue } from '@sheet-delver/sdk/react';

type RollClient = Pick<SDKContextValue, 'fetchWithAuth' | 'addNotification'>;

/** The actor roll endpoint posts chat on success; the host owns its preview and dice. */
export async function postActorRoll(
    client: RollClient,
    actor: { id: string; name: string; worldContextRevision?: unknown },
    type: string,
    key: string,
    options: Record<string, unknown> = {},
    defaultRollMode = 'publicroll',
): Promise<void> {
    try {
        const response = await client.fetchWithAuth(`/api/actors/${actor.id}/roll`, {
            method: 'POST',
            // The prepared revision fences the roll: Core refuses it if world rules changed.
            headers: { 'Content-Type': 'application/json', ...(typeof actor.worldContextRevision === 'number'
                ? { 'X-SheetDelver-Context-Revision': String(actor.worldContextRevision) } : {}) },
            body: JSON.stringify({
                type, key,
                options: {
                    ...options,
                    rollMode: options.rollMode ?? defaultRollMode,
                    speaker: options.speaker ?? { actor: actor.id, alias: actor.name },
                },
            }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            client.addNotification('Roll failed: ' + getErrorMessage(data.error ?? 'Unknown error'), 'error');
        }
    } catch (error) {
        client.addNotification('Error: ' + getErrorMessage(error), 'error');
    }
}
