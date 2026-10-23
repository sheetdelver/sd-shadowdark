'use client';

import { useAutomaticSpellGrants } from '../hooks/useAutomaticSpellGrants';
import { useState, useEffect, useCallback, useRef } from 'react';

import { getErrorMessage, processHtmlContent } from '@sheet-delver/sdk';
import { useSDK, useSDKComponents } from '@sheet-delver/sdk/react';
import ShadowdarkSheet from '../ShadowdarkSheet';
import { postActorRoll } from './postActorRoll';
import { ShadowdarkActorProvider } from '../context/ShadowdarkActorContext';
import { ShadowdarkUIProvider } from '../context/ShadowdarkUIContext';

export interface ShadowdarkActorPageProps {
    actorId: string;
}

/**
 * Shadowdark actor page (ADR-0027 conformed).
 *
 * Owns the Shadowdark feature handlers (effects, item updates with effect deletion, etc.).
 * Platform access is through `useSDK()` / `useSDKComponents()`; realtime refresh rides the
 * SDK event bus (`events.on('document:changed')`) instead of the raw socket. Registered as
 * the module's `actorPage` surface in `module/ui.tsx`.
 */
export default function ShadowdarkActorPage({ actorId }: ShadowdarkActorPageProps) {
    const { foundryUrl, addNotification: addToast, isDiceTrayOpen, toggleDiceTray, events, fetchWithAuth, navigate, isConnected, worldId, currentUser } = useSDK();
    const { LoadingModal, SharedContentModal } = useSDKComponents();

    const scope = JSON.stringify([worldId, currentUser?.id, currentUser?.role]);
    const [loaded, setLoaded] = useState<{ scope: string; actor: any } | null>(null);
    const actor = loaded?.scope === scope ? loaded.actor : null;
    const setActor = useCallback((value: any) => setLoaded({ scope, actor: value }), [scope]);
    const [reviewing, setReviewing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actorError, setActorError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const fetchRef = useRef(fetchWithAuth);
    fetchRef.current = fetchWithAuth;
    const foundryUrlRef = useRef(foundryUrl);
    useEffect(() => { foundryUrlRef.current = foundryUrl; }, [foundryUrl]);

    const addNotification = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
        const content = processHtmlContent(message, foundryUrlRef.current);
        addToast(content, type, { html: true });
    }, [addToast]);

    // Only the newest request for the current Actor may update state.
    const requestSeq = useRef(0);
    const currentActorId = useRef(actorId);
    useEffect(() => { currentActorId.current = actorId; setActor(null); setActorError(null); setShowDeleteModal(false); }, [actorId]);

    const fetchActor = useCallback(async (id: string, silent = false) => {
        const seq = ++requestSeq.current;
        const stale = () => seq !== requestSeq.current || currentActorId.current !== id;
        if (!silent) setLoading(true);
        try {
            const res = await fetchRef.current(`/api/modules/shadowdark/actors/${id}/view`);
            if (stale()) return;
            if (res.status === 404) {
                setActor(null);
                setActorError(null);
                setShowDeleteModal(true);
                return;
            }
            if (!res.ok) {
                setActor(null);
                setActorError(res.status === 503
                    ? 'Character data is temporarily unavailable.'
                    : 'Could not load this character.');
                return;
            }

            const data = await res.json();
            if (stale()) return;
            if (data.actor && !data.error) {
                setActor(data.actor);
                setActorError(null);
                setShowDeleteModal(false);
            } else throw new Error(getErrorMessage(data?.error ?? 'Could not load this character.'));
        } catch (e) {
            if (!stale()) { setActor(null); setActorError(`Character data is unavailable: ${getErrorMessage(e)}`); }
        } finally {
            if (!stale()) { setLoading(false); setReviewing(false); }
        }
    }, [setActor]);

    const grantSync = useAutomaticSpellGrants(actor, async () => { await fetchActor(actorId, true); });

    const notifyRef = useRef(addNotification);
    notifyRef.current = addNotification;
    const loadingRef = useRef(loading);
    useEffect(() => { loadingRef.current = loading; }, [loading]);

    useEffect(() => {
        if (!actorId) return;
        if (isConnected) fetchActor(actorId, true);
        else { requestSeq.current++; setReviewing(true); }

        // Realtime refresh via the SDK event bus (replaces the raw socket actorChanged).
        const off = events.on('document:changed', ({ type, id }) => {
            if ((type === 'Actor' && id === actorId) || type === 'Item') {
                fetchActor(actorId, true);
            }
        });
        // World rules changed (a setting or declared pack): Core re-prepares Actors;
        // reload so luck mode, actions and the context revision are current.
        const offContext = events.on('world:contextChanged', () => {
            // Retire visibility/interaction immediately, keeping mounted picker
            // search until the caller's new source is authorized. Denial clears it.
            setReviewing(true);
            if (isConnected) fetchActor(actorId, true);
        });

        const timeout = setTimeout(() => {
            if (loadingRef.current) {
                notifyRef.current('Loading is taking longer than expected. The server might be busy.', 'error');
            }
        }, 15000);

        return () => {
            off();
            offContext();
            requestSeq.current++;
            clearTimeout(timeout);
        };
    }, [actorId, fetchActor, events, worldId, currentUser?.id, currentUser?.role, isConnected]);

    /** JSON request that rejects with the server's message on any failure. */
    const request = useCallback(async (url: string, init: RequestInit = {}) => {
        const res = await fetchWithAuth(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
        let data: any = null;
        try { data = await res.json(); } catch { /* empty body */ }
        if (!res.ok || data?.success === false || data?.error) {
            throw new Error(getErrorMessage(data?.error ?? `HTTP ${res.status}`));
        }
        return data;
    }, [fetchWithAuth]);

    const refreshAfter = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
        try { return await run(); }
        finally { if (currentActorId.current) fetchActor(currentActorId.current, true); }
    }, [fetchActor]);

    const handleRoll = async (type: string, key: string, options: any = {}) => {
        if (!actor) return;
        await postActorRoll(
            { fetchWithAuth, addNotification: addToast }, actor, type, key, options,
            localStorage.getItem('sheetdelver_roll_mode') || 'publicroll',
        );
        // A refused stale roll (world rules changed) needs the re-prepared Actor.
        if (currentActorId.current) fetchActor(currentActorId.current, true);
    };

    const id = actor?.id || actor?._id;
    const moduleBase = `/api/modules/shadowdark/actors/${id}`;
    /** The world-context revision this Actor was prepared under; Core refuses the write if rules changed since. */
    const contextHeaders = (): Record<string, string> => typeof actor?.worldContextRevision === 'number'
        ? { 'X-SheetDelver-Context-Revision': String(actor.worldContextRevision) } : {};

    const handleUpdate = (path: string, value: any) => refreshAfter(() =>
        request(`/api/actors/${id}/update`, { method: 'POST', body: JSON.stringify({ [path]: value }) }));

    const handleDeleteItem = (itemId: string) => refreshAfter(() =>
        request(`/api/actors/${id}/items?itemId=${encodeURIComponent(itemId)}`, { method: 'DELETE' }));

    const handleCreateItem = (itemData: any) => refreshAfter(async () => {
        await request(`/api/actors/${id}/items`, { method: 'POST', body: JSON.stringify(itemData) });
        if (itemData.name) addNotification(`Created ${itemData.name}`, 'success');
    });

    /** Item edits send only changed paths for one exact embedded id. */
    const handleUpdateItem = (itemId: string, patch: Record<string, unknown>, deletedEffectRefs: string[] = []) => refreshAfter(async () => {
        for (const ref of deletedEffectRefs) {
            await request(`${moduleBase}/effects/delete?ref=${encodeURIComponent(ref)}`, { method: 'DELETE' });
        }
        if (Object.keys(patch).length) {
            await request(`/api/actors/${id}/items`, { method: 'PUT', body: JSON.stringify({ _id: itemId, ...patch }) });
        }
    });

    const handleToggleEffect = (ref: string, enabled: boolean) => refreshAfter(() =>
        request(`${moduleBase}/effects/toggle`, { method: 'POST', body: JSON.stringify({ ref, enabled }) }));
    const handleDeleteEffect = (ref: string) => refreshAfter(() =>
        request(`${moduleBase}/effects/delete?ref=${encodeURIComponent(ref)}`, { method: 'DELETE' }));
    const handleCreateEffect = (payload: any) => refreshAfter(() =>
        request(`${moduleBase}/effects/create`, { method: 'POST', body: JSON.stringify(payload) }));
    const handleUpdateEffect = (ref: string, patch: any) => refreshAfter(() =>
        request(`${moduleBase}/effects/update`, { method: 'POST', body: JSON.stringify({ ref, patch }) }));
    const handleAction = (body: any) => refreshAfter(() => request(`${moduleBase}/actions`, {
        method: 'POST', headers: contextHeaders(),
        body: JSON.stringify({ ...body, rollMode: body.rollMode ?? (localStorage.getItem('sheetdelver_roll_mode') || 'publicroll') }),
    }));
    const handleLuck = (mode: 'pulp' | 'standard', value: number | boolean) => refreshAfter(() => request(`${moduleBase}/luck`, {
        method: 'POST', headers: contextHeaders(), body: JSON.stringify({ mode, value }),
    }));

    if (loading) return <LoadingModal message="Loading Codex..." />;
    if (!actor && !showDeleteModal && !actorError) return null;

    return (
        <main className="min-h-screen font-sans selection:bg-amber-900 pb-20">
            <nav className="relative bg-neutral-900 border-b border-neutral-800 px-4 py-3 shadow-md flex items-center justify-between backdrop-blur-sm bg-opacity-95">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-neutral-400 hover:text-amber-500 transition-colors font-semibold group text-sm uppercase tracking-wide cursor-pointer"
                >
                    <span className="group-hover:-translate-x-1 transition-transform">←</span>
                    Back to Dashboard
                </button>
                <div className="text-xs text-neutral-600 font-mono hidden md:block">
                    {actor?.name ? `${actor.name}` : 'Loading...'}
                </div>
            </nav>

            {grantSync.error && <div role="alert" className="mx-auto max-w-5xl border-2 border-black bg-white text-black p-3">
                <p>Automatic spell grant: {grantSync.error}</p>
                <button type="button" className="min-h-11 border-2 border-black px-3 mt-2" onClick={grantSync.retry}>Retry granted spells</button>
            </div>}
            {reviewing && <p role="status">Refreshing character access…</p>}
            {actor && (
                <div inert={reviewing || !isConnected} aria-hidden={reviewing || !isConnected || undefined} style={{ visibility: reviewing || !isConnected ? 'hidden' : undefined }} className="w-full max-w-5xl mx-auto p-4">
                    <ShadowdarkUIProvider>
                        <ShadowdarkActorProvider
                            actor={actor}
                            onUpdate={handleUpdate}
                            onDeleteItem={handleDeleteItem}
                            onCreateItem={handleCreateItem}
                            onUpdateItem={handleUpdateItem}
                            onRoll={handleRoll}
                            onAction={handleAction}
                            onLuck={handleLuck}
                            onToggleEffect={handleToggleEffect}
                            onDeleteEffect={handleDeleteEffect}
                            onCreateEffect={handleCreateEffect}
                            onUpdateEffect={handleUpdateEffect}
                            onRefresh={async () => { await fetchActor(actor.id || actor._id, true); }}
                        >
                            <ShadowdarkSheet
                                onToggleDiceTray={toggleDiceTray}
                                isDiceTrayOpen={isDiceTrayOpen}
                            />
                        </ShadowdarkActorProvider>
                    </ShadowdarkUIProvider>
                </div>
            )}

            {!actor && actorError && !showDeleteModal && (
                <div className="w-full max-w-5xl mx-auto p-4 text-center text-neutral-300" role="alert">
                    <p>{actorError}</p>
                    <button type="button" onClick={() => fetchActor(actorId)}>Retry character</button>
                </div>
            )}


            {showDeleteModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                    <div className="bg-neutral-900 border border-amber-500/30 p-8 rounded-xl max-w-md w-full text-center shadow-2xl">
                        <div className="text-5xl mb-4">💀</div>
                        <h2 className="text-2xl font-bold text-white mb-2 font-serif">Character Unavailable</h2>
                        <p className="text-neutral-400 mb-8">This character is absent or no longer visible to you.</p>
                        <button
                            onClick={() => navigate('/')}
                            className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-8 rounded shadow-lg uppercase tracking-widest transition-all w-full"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                </div>
            )}
            <SharedContentModal />
        </main>
    );
}
