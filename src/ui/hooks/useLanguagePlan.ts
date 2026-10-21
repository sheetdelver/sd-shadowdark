'use client';
import { useEffect, useState } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import { useShadowdarkUI } from '../context/ShadowdarkUIContext';
import type { LanguagePlan } from '../../logic/languages';

/** A form's bounded plan, retired by the shared world/caller generation. No world cache. */
export function useLanguagePlan(input: { ancestryUuid?: string; classUuid?: string; actorId?: string; mode?: 'inventory'; sourceRevision?: string; enabled: boolean }) {
    const { generation } = useShadowdarkUI();
    const { fetchWithAuth, worldId, currentUser, isConnected } = useSDK();
    const key = JSON.stringify([input.ancestryUuid, input.classUuid, input.actorId, input.mode, input.sourceRevision, input.enabled, generation, worldId, currentUser?.id, currentUser?.role, isConnected]);
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState<{ key: string; plan: (LanguagePlan & { rows: any[]; suggested?: string[]; contextRevision?: number; current?: string[]; review?: string }) | null; error: string | null }>({ key: '', plan: null, error: null });
    useEffect(() => {
        if (!input.enabled || !isConnected) return;
        let current = true; const controller = new AbortController();
        setState({ key, plan: null, error: null });
        void (async () => {
            try {
                const res = await fetchWithAuth('/api/modules/shadowdark/languages/plan', { method: 'POST', signal: controller.signal,
                    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ancestryUuid: input.ancestryUuid, classUuid: input.classUuid, actorId: input.actorId, mode: input.mode }) });
                const plan = await res.json();
                if (!current) return;
                if (!res.ok || !Array.isArray(plan.groups) || !Array.isArray(plan.fixed) || !Array.isArray(plan.rows) || !Array.isArray(plan.errors)) throw new Error(plan.error?.message ?? plan.error ?? `Language plan HTTP ${res.status}`);
                setState({ key, plan, error: plan.errors.length ? plan.errors.join(' ') : null });
            } catch (e) { if (current) setState({ key, plan: null, error: (e as Error).message }); }
        })();
        return () => { current = false; controller.abort(); };
    }, [key, attempt, fetchWithAuth]);
    const current = state.key === key && input.enabled && isConnected;
    const plan = current ? state.plan : null;
    const error = !input.enabled ? null : !isConnected ? 'Reconnect to review language choices.' : current ? state.error : null;
    return { key, plan, rows: plan?.rows ?? [], ready: !!plan && !error, error, loading: input.enabled && !error && !plan,
        retry: () => setAttempt(value => value + 1) };
}
