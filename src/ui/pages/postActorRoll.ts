import { getErrorMessage } from '@sheet-delver/sdk';
import type { SDKContextValue } from '@sheet-delver/sdk/react';

type RollClient = Pick<SDKContextValue, 'fetchWithAuth' | 'addNotification'>;

/** The actor roll endpoint posts chat on success; the host owns its preview and dice. */
export async function postActorRoll(
    client: RollClient,
    actor: { id: string; name: string },
    type: string,
    key: string,
    options: Record<string, unknown> = {},
    defaultRollMode = 'publicroll',
): Promise<void> {
    try {
        const response = await client.fetchWithAuth(`/api/actors/${actor.id}/roll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
