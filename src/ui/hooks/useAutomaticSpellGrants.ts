import { useEffect, useRef, useState } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';

/** Follow caller-authorized source refreshes; no polling and no rendering-time writes. */
export function useAutomaticSpellGrants(actor: any, refresh: () => Promise<void>) {
    const { fetchWithAuth, worldId, currentUser, isConnected } = useSDK();
    const [retry, setRetry] = useState(0);
    const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
    const key = JSON.stringify([worldId, currentUser?.id, currentUser?.role, actor?.id ?? actor?._id,
        actor?.worldContextRevision, actor?.spellReviewToken]);
    const latest = useRef(key); latest.current = key;
    const refreshRef = useRef(refresh); refreshRef.current = refresh;
    const fetchRef = useRef(fetchWithAuth); fetchRef.current = fetchWithAuth;
    const attempt = useRef<{ key: string; retry: number; promise: Promise<void> } | null>(null);
    const enabled = !!actor?.spellGrants?.canApply && !actor?.advancementPending && isConnected;
    useEffect(() => {
        if (!enabled) return;
        let active = true;
        if (attempt.current?.key !== key || attempt.current.retry !== retry) {
            const run = async () => {
                const response = await fetchRef.current(`/api/modules/shadowdark/actors/${actor.id ?? actor._id}/spells/grants`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SheetDelver-Context-Revision': String(actor.worldContextRevision) }, body: '{}',
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.error?.message ?? 'Granted spells could not be saved.');
            };
            attempt.current = { key, retry, promise: run() };
        }
        void attempt.current.promise.then(async () => {
            if (active && latest.current === key) { setFailure(null); await refreshRef.current(); }
        }).catch(async (e: Error) => {
            if (active && latest.current === key) { setFailure({ key, message: e.message }); await refreshRef.current(); }
        });
        return () => { active = false; };
    }, [key, enabled, retry]);
    return { error: actor?.spellGrants?.missing && failure?.key === key ? failure.message : null,
        retry: () => setRetry(value => value + 1) };
}
