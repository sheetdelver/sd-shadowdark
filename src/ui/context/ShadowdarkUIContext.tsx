'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useSyncExternalStore, useMemo, useLayoutEffect } from 'react';
import { logger } from '@sheet-delver/sdk';
import { useSDK } from '@sheet-delver/sdk/react';
import { canonicalUuid } from '../../logic/identity';
import { createSystemIndexStore, type SystemIndexStatus, type CollectionState } from './system-index-store';

/**
 * ARCHITECTURAL SAFEGUARD:
 *
 * This context separates the "Lean Index" (systemData) from "Heavy Rule Shards" (collections).
 *
 * - systemData: Is the immutable manifest containing metadata and the nameIndex.
 * - collections: Is an ephemeral, on-demand cache for full rule shards (spells, gear, etc.).
 *
 * Both caches belong to one world, user, role and connection, and to the current
 * world context. `system-index-store` owns the request lifecycle: a scope change
 * or Core `world:contextChanged` event retires in-flight requests and retries,
 * drops both caches and starts a replacement index request, which ends in
 * current data or an explicit failure. The server filters both by the caller's
 * pack capability, so a cache never outlives the access it was fetched under.
 */

interface ShadowdarkUIState {
    systemData: any | null;
    collections: Record<string, any[]>;
    collectionStates: Record<string, CollectionState>;
    generation: number;
    retainCollections: (ids: readonly string[]) => () => void;
    retryCollection: (id: string) => void;
    loadingSystem: boolean;
    systemStatus: SystemIndexStatus;
    /** Why the system index is unavailable, when `systemStatus` is `failed`. */
    systemError: string | null;
    retrySystem: () => void;
    fetchPack: (packId: string) => Promise<any>;
    /** Label for an exact reference; a non-reference string is already a label. */
    resolveName: (value: string, collection?: string) => string;
}

const ShadowdarkUIContext = createContext<ShadowdarkUIState | undefined>(undefined);

export function ShadowdarkUIProvider({ children }: { children: React.ReactNode }) {
    const { fetchWithAuth, isConnected, worldId, currentUser, events } = useSDK();
    const fetchRef = useRef(fetchWithAuth);
    useLayoutEffect(() => { fetchRef.current = fetchWithAuth; }, [fetchWithAuth]);
    const [store] = useState(() => createSystemIndexStore({
        fetchIndex: signal => fetchRef.current('/api/modules/shadowdark/index', { signal }),
        fetchCollection: (packId, signal) => fetchRef.current(`/api/modules/shadowdark/fetch-pack/${packId}`, { signal }),
        onError: (message, error) => error ? logger.error(`[ShadowdarkUIContext] ${message}`, error) : logger.warn(`[ShadowdarkUIContext] ${message}`),
    }));
    const userId = currentUser?.id ?? null;
    const role = currentUser?.role ?? null;
    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
    // Scope changes are applied before paint. Also mask retired data during the
    // intervening render so consumers cannot copy another caller's cached rows.
    const { status, systemData, collections, error, collectionStates, generation } = store.matchesScope({ worldId: worldId ?? null, userId, role, connected: isConnected })
        ? snapshot : { status: 'offline' as const, systemData: null, collections: {}, error: null, collectionStates: {}, generation: snapshot.generation };
    useLayoutEffect(() => {
        store.setScope({ worldId: worldId ?? null, userId, role, connected: isConnected });
        return () => store.release();
    }, [store, worldId, userId, role, isConnected]);
    useEffect(() => events.on('world:contextChanged', () => store.invalidate()), [events, store]);
    useEffect(() => {
        let active = true, queued = false;
        const invalidateItems = ({ type }: { type: string }) => {
            if (type !== 'Item' || queued) return;
            queued = true;
            // A host change may publish both detail and directory hints. One
            // generation retires pending catalog results and preserves search.
            queueMicrotask(() => { queued = false; if (active) store.invalidate(); });
        };
        const offItem = events.on('document:changed', invalidateItems);
        const offList = events.on('document:listInvalidated', invalidateItems);
        return () => { active = false; offItem(); offList(); };
    }, [events, store]);


    const fetchPack = useCallback((packId: string) => store.fetchCollection(packId), [store]);
    const retrySystem = useCallback(() => store.retry(), [store]);

    const resolveName = useCallback((value: any, collection?: string): string => {
        if (!value) return '';
        if (typeof value !== 'string') return value.name || value.label || value.title || '';
        const canonical = canonicalUuid(value);
        if (!canonical) return value;
        if (systemData?.nameIndex?.[canonical]) return systemData.nameIndex[canonical];
        const found = collection ? collections[collection]?.find((entry: any) => canonicalUuid(entry.uuid) === canonical) : null;
        return found?.name ?? '';
    }, [systemData, collections]);

    return (
        <ShadowdarkUIContext.Provider value={{
            systemData, collections, loadingSystem: status === 'loading', systemStatus: status, systemError: error,
            retrySystem, fetchPack, resolveName, collectionStates, generation,
            retainCollections: store.retainCollections, retryCollection: store.retryCollection,
        }}>
            {children}
        </ShadowdarkUIContext.Provider>
    );
}

export function useShadowdarkUI() {
    const context = useContext(ShadowdarkUIContext);
    if (context === undefined) {
        throw new Error('useShadowdarkUI must be used within a ShadowdarkUIProvider');
    }
    return context;
}

/** Declare live demand once; the shared store handles readiness and generations. */
export function useShadowdarkCollections(packIds: readonly string[], enabled = true) {
    const { retainCollections, retryCollection, retrySystem, systemStatus, systemError, collectionStates, collections, generation } = useShadowdarkUI();
    const key = JSON.stringify([...new Set(packIds)].sort());
    const ids: string[] = useMemo(() => JSON.parse(key), [key]);
    useEffect(() => enabled ? retainCollections(ids) : undefined, [retainCollections, ids, enabled]);
    const failures = ids.flatMap(id => {
        const state = collectionStates[id];
        return state?.status === 'failed' ? [state.error] : [];
    });
    const error = !enabled ? null : systemStatus === 'failed' ? systemError
        : systemStatus === 'offline' ? 'World data is unavailable while disconnected. Reconnect to load these collections.'
        : failures.length ? failures.join(' ') : null;
    const ready = enabled && systemStatus === 'ready' && ids.every(id => collectionStates[id]?.status === 'ready');
    const retry = () => {
        if (systemStatus !== 'ready') retrySystem();
        else ids.forEach(retryCollection);
    };
    const warnings = ids.flatMap(id => { const state = collectionStates[id]; return state?.status === 'ready' ? state.warnings ?? [] : []; });
    return { collections, collectionStates, generation, ready, loading: enabled && !ready && !error, error, warnings, retry };
}
