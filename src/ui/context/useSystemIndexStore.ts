import { useLayoutEffect, useMemo, useSyncExternalStore, useEffect } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import { systemIndexSession } from './system-index-session';

export function useSystemIndexStore() {
    const sdk = useSDK();
    const session = useMemo(()=>systemIndexSession(sdk.events),[sdk.events]);
    const scope = {worldId:sdk.worldId??null,userId:sdk.currentUser?.id??null,role:sdk.currentUser?.role??null,connected:sdk.isConnected};
    useLayoutEffect(()=>{session.configure(scope,sdk.fetchWithAuth);},[session,scope.worldId,scope.userId,scope.role,scope.connected,sdk.fetchWithAuth]);
    const snapshot = useSyncExternalStore(session.store.subscribe,session.store.getSnapshot,session.store.getSnapshot);
    return {store:session.store,snapshot,matchesScope:session.store.matchesScope(scope)};
}

/** Tool projections participate in the same caller-scoped cache as sheet collections. */
export function useToolCatalog(id: string) {
    const {store,snapshot,matchesScope} = useSystemIndexStore();
    useEffect(()=>store.retainCollections([id]),[store,id]);
    const state = matchesScope ? snapshot.collectionStates[id] : undefined;
    const ready = matchesScope && snapshot.status==='ready' && state?.status==='ready';
    return {data:ready?snapshot.collections[id]:null,ready,
        error:matchesScope?(snapshot.error??(state?.status==='failed'?state.error:null)):null,
        refresh:()=>{if(snapshot.status==='ready')store.invalidateCollections([id]);else store.retry();}};
}
