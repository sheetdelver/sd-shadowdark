'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@sheet-delver/sdk';
import { useSDK } from '@sheet-delver/sdk/react';
import { canonicalUuid } from '../../logic/identity';

/**
 * ARCHITECTURAL SAFEGUARD:
 *
 * This context separates the "Lean Index" (systemData) from "Heavy Rule Shards" (collections).
 *
 * - systemData: Is the immutable manifest containing metadata and the nameIndex.
 * - collections: Is an ephemeral, on-demand cache for full rule shards (spells, gear, etc.).
 *
 * Both caches belong to one world: a different world id (or a lost connection)
 * discards them, and a response for an earlier world is ignored.
 */

interface ShadowdarkUIState {
    systemData: any | null;
    collections: Record<string, any[]>;
    loadingSystem: boolean;
    fetchPack: (packId: string) => Promise<any>;
    /** Label for an exact reference; a non-reference string is already a label. */
    resolveName: (value: string, collection?: string) => string;
}

const ShadowdarkUIContext = createContext<ShadowdarkUIState | undefined>(undefined);

export function ShadowdarkUIProvider({ children }: { children: React.ReactNode }) {
    const { fetchWithAuth, isConnected, worldId } = useSDK();
    const [systemData, setSystemData] = useState<any>(null);
    const [collections, setCollections] = useState<Record<string, any[]>>({});
    const [loadingSystem, setLoadingSystem] = useState(true);
    const generation = useRef(0);
    const scope = `${worldId ?? ''}:${isConnected ? 'up' : 'down'}`;

    useEffect(() => {
        generation.current++;
        setSystemData(null);
        setCollections({});
    }, [worldId]);

    const fetchPack = useCallback(async (packId: string) => {
        if (collections[packId]) return collections[packId];
        const started = generation.current;
        try {
            const res = await fetchWithAuth(`/api/modules/shadowdark/fetch-pack/${packId}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (started !== generation.current) return null;
            setCollections(prev => prev[packId] ? prev : { ...prev, [packId]: data });
            return data;
        } catch (err) {
            logger.error(`[ShadowdarkUIContext] Failed to fetch pack ${packId}:`, err);
            return null;
        }
    }, [collections, fetchWithAuth]);

    useEffect(() => {
        if (!isConnected || systemData) return;
        setLoadingSystem(true);
        const started = generation.current;
        let cancelled = false;

        const fetchData = async (retries = 3, delay = 1000) => {
            try {
                const res = await fetchWithAuth('/api/modules/shadowdark/index');
                if (res.status === 503 && retries > 0) {
                    logger.warn(`[ShadowdarkUIContext] System initializing (503), retrying in ${delay / 1000}s...`);
                    setTimeout(() => !cancelled && fetchData(retries - 1, delay * 2), delay);
                    return;
                }
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (cancelled || started !== generation.current) return;
                setSystemData(data || {});
                setLoadingSystem(false);
            } catch (err) {
                logger.error('[ShadowdarkUIContext] Failed to fetch system manifest:', err);
                if (retries > 0) setTimeout(() => !cancelled && fetchData(retries - 1, delay * 2), delay);
                else if (!cancelled) setLoadingSystem(false);
            }
        };

        fetchData();
        return () => { cancelled = true; };
    }, [fetchWithAuth, isConnected, systemData, scope]);

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
        <ShadowdarkUIContext.Provider value={{ systemData, collections, loadingSystem, fetchPack, resolveName }}>
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
