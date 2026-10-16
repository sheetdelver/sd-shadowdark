'use client';

import { useEffect } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';

/**
 * Runs the module's automatic data migrations (native 4.0.6 effect keys) without
 * player involvement. A GM's first Shadowdark page in a world migrates the whole
 * world once (server records a per-world marker); an owner opening a sheet that
 * still has pre-4.0 keys migrates that Actor. Writes are caller-bound on the
 * server; failures only log and are retried on the next visit.
 */
const worldRuns = new Map<string, Promise<unknown>>();
const actorRuns = new Set<string>();

export function useWorldMigrations(onMigrated?: (updated: number) => void) {
    const { fetchWithAuth, worldId, currentUser, isConnected, addNotification } = useSDK() as any;
    useEffect(() => {
        if (!isConnected || !worldId || !currentUser?.isGM || worldRuns.has(worldId)) return;
        const run = fetchWithAuth('/api/modules/shadowdark/migrations/effect-keys', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ worldId }),
        }).then(async (res: Response) => {
            const data = await res.json().catch(() => null);
            const updated = Number(data?.report?.effectsUpdated ?? 0);
            if (updated > 0) {
                addNotification?.(`Shadowdark: updated ${updated} effect${updated === 1 ? '' : 's'} to the current system format.`, 'success');
                onMigrated?.(updated);
            }
            if (!res.ok || data?.report?.failures?.length) worldRuns.delete(worldId);
        }).catch(() => worldRuns.delete(worldId));
        worldRuns.set(worldId, run);
    }, [fetchWithAuth, worldId, currentUser?.isGM, isConnected, addNotification, onMigrated]);
}

export function useActorMigration(actor: any, onMigrated: () => void) {
    const { fetchWithAuth, currentUser } = useSDK() as any;
    const actorId = actor ? String(actor.id ?? actor._id ?? '') : '';
    const pending = Number(actor?.derived?.pendingMigrations?.effectKeys ?? 0);
    const ownership = actor?.ownership ?? {};
    const canWrite = currentUser?.isGM || ownership[currentUser?.id] === 3 || ownership.default === 3;
    useEffect(() => {
        if (!actorId || pending === 0 || !canWrite || actorRuns.has(actorId)) return;
        actorRuns.add(actorId);
        fetchWithAuth('/api/modules/shadowdark/migrations/effect-keys', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actorId }),
        }).then(async (res: Response) => {
            const data = await res.json().catch(() => null);
            if (Number(data?.report?.effectsUpdated ?? 0) > 0) onMigrated();
        }).catch(() => actorRuns.delete(actorId));
    }, [actorId, pending, canWrite, fetchWithAuth, onMigrated]);
}
