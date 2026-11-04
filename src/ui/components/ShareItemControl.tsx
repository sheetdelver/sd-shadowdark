'use client';
import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { useSDK } from '@sheet-delver/sdk/react';
import { useShadowdarkActor } from '../context/ShadowdarkActorContext';
import { newRequestId } from '../utils/request-id';

export default function ShareItemControl({ itemId }: { itemId: string }) {
    const { actor } = useShadowdarkActor();
    const sdk = useSDK();
    const scope = JSON.stringify([sdk.worldId, sdk.currentUser?.id, sdk.currentUser?.role, sdk.isConnected, actor?.id ?? actor?._id, actor?.worldContextRevision, itemId]);
    return <ShareItemAction key={scope} itemId={itemId} />;
}

function ShareItemAction({ itemId }: { itemId: string }) {
    const { actor } = useShadowdarkActor();
    const { fetchWithAuth, events, isConnected } = useSDK();
    const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [retired, setRetired] = useState(false);
    const pending = useRef(false), requestId = useRef(''), generation = useRef(0);
    useEffect(() => {
        const off = events.on('world:contextChanged', () => { generation.current++; setRetired(true); });
        return () => { generation.current++; off(); };
    }, [events]);
    if (actor?.canEdit !== true) return null;
    const share = async () => {
        if (pending.current || retired || !isConnected) return;
        const seq = generation.current;
        pending.current = true; setBusy(true); setMessage('');
        requestId.current ||= newRequestId();
        try {
            const response = await fetchWithAuth(`/api/modules/shadowdark/actors/${actor.id ?? actor._id}/items/chat`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, requestId: requestId.current }),
            });
            const data = await response.json();
            if (seq !== generation.current) return;
            if (!response.ok) { setMessage(data.error?.message ?? data.error ?? 'The item could not be shared.'); return; }
            setMessage(data.posted ? 'Shared to chat.' : data.warning ?? 'Sharing could not be confirmed. Check chat.');
            if (data.posted) requestId.current = '';
        } catch { if (seq === generation.current) setMessage('Sharing could not be confirmed. Check chat before trying again.'); }
        finally { pending.current = false; if (seq === generation.current) setBusy(false); }
    };
    return <div className="space-y-1">
        <button type="button" disabled={busy || retired || !isConnected} onClick={share} title="Share this item with everyone in chat"
            className="inline-flex items-center gap-2 min-h-11 px-3 border-2 border-black bg-white text-xs font-bold uppercase disabled:opacity-40">
            <MessageSquare size={16} aria-hidden="true" />{busy ? 'Sharing…' : 'Share to chat'}
        </button>
        {retired ? <p role="status" className="text-xs">Refresh the character before sharing.</p> : message && <p role="status" className="text-xs">{message}</p>}
    </div>;
}
