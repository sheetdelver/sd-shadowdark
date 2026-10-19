import React, { useEffect, useState } from 'react';

/** Receipts stay bound to one operation, independent of the next level's form. */
export function AdvancementRecovery({ operation, busy, refresh, resume, onClose }: { operation: any; busy: boolean; refresh: () => void; resume: (recovery?: any) => void; onClose?: () => void }) {
    const [reviewed, setReviewed] = useState(false);
    const [items, setItems] = useState<Record<string, string>>({});
    const [note, setNote] = useState('');
    useEffect(() => { setReviewed(false); setItems({}); setNote(''); }, [operation.requestId, operation.baseline, operation.contextRevision]);
    const recovery = (action?: string) => ({ reviewed: true, baseline: operation.baseline, items, ...(action ? { action } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    const disabled = busy || !reviewed || !operation.baseline;
    const retired = operation.state === 'retired';
    return <section aria-label="Advancement recovery" className="border-2 border-black p-4 space-y-3">
        <h3>{retired ? (operation.terminal?.disposition === 'zero-write' ? 'Advancement was not applied' : 'Advancement operation retired') : `Incomplete advancement to level ${operation.targetLevel ?? 'under review'}`}</h3>
        <p>Request: {operation.requestId}</p>
        {operation.terminal && <p role="status">Terminal disposition: {operation.terminal.disposition}. {operation.terminal.note}</p>}
        <ol>{(operation.operations ?? []).map((op: any, index: number) => <li key={index}>
            {op.kind === 'item' ? op.name : 'Final level / XP / HP update'}: {op.status}{op.itemId ? ` · Item ${op.itemId}` : ''}{op.error ? ` · ${op.error}` : ''}
            {op.receiptPending && <p role="status">Upstream write acknowledged{op.itemId ? ` as Item ${op.itemId}` : ''}; receipt storage needs reconciliation. No write will be repeated.</p>}
            {op.verificationPending && <p role="status">Acknowledged write needs primary-source review; it will not repeat.</p>}
            {!retired && op.kind === 'item' && (op.status === 'uncertain' || op.receiptPending || op.verificationPending) && <label>Exact owned Item ID after source review
                <input value={items[op.index] ?? (op.acknowledged ? op.itemId ?? '' : '')} onChange={event => setItems({ ...items, [op.index]: event.target.value })} />
            </label>}
        </li>)}</ol>
        <p>{operation.recovery}</p>
        {retired ? <button type="button" onClick={onClose}>{operation.terminal?.disposition === 'zero-write' ? 'Start advancement again' : 'Close and prepare fresh plan'}</button> : <>
            {operation.contextRevision !== undefined && operation.planRevision !== undefined && operation.contextRevision !== operation.planRevision && <p role="status">World rules changed. The old plan cannot replay. Reconcile receipts or use a verified terminal resolution.</p>}
            <button type="button" disabled={busy} onClick={() => { setReviewed(false); refresh(); }}>Refresh operation review</button>
            <button type="button" disabled={busy} onClick={() => resume()}>Retry same request</button>
            <label><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I independently reviewed the current source and exact Item identities.</label>
            <button type="button" disabled={disabled} onClick={() => resume(recovery())}>Continue reviewed operation</button>
            <button type="button" disabled={disabled} onClick={() => resume(recovery('reconcile'))}>Reconcile receipts without replay</button>
            <details>
                <summary>Resolve a partially applied operation after restoration</summary>
                <p>{operation.restoration?.instructions}</p>
                {operation.restoration?.values ? <ul>{operation.restoration.values.map((entry: any) => <li key={entry.path}>{entry.path}: {entry.absent ? 'originally absent' : JSON.stringify(entry.value)}</li>)}</ul> : <p>For an older receipt, use your independent original source export; no prior values are inferred.</p>}
                <label>Independent restoration evidence
                    <textarea value={note} maxLength={1000} onChange={event => setNote(event.target.value)} />
                </label>
                <button type="button" disabled={disabled || !operation.canResolveRestored || !note.trim()} onClick={() => resume(recovery('resolve-restored'))}>Verify restoration and close operation</button>
            </details>
        </>}
    </section>;
}
