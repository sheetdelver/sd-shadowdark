import React, { useEffect, useState } from 'react';

const buttonClass = 'min-h-10 border-2 border-black bg-white px-3 py-2 text-left font-bold hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2';
const inputClass = 'block w-full min-w-0 border-2 border-black bg-white p-2 font-mono text-sm focus-visible:outline-2 focus-visible:outline-offset-2';

/** Receipts stay bound to one operation, independent of the next level's form. */
export function AdvancementRecovery({ operation, busy, refresh, resume, onClose }: { operation: any; busy: boolean; refresh: () => void; resume: (recovery?: any) => void; onClose?: () => void }) {
    const [reviewed, setReviewed] = useState(false);
    const [items, setItems] = useState<Record<string, string>>({});
    const [note, setNote] = useState('');
    useEffect(() => { setReviewed(false); setItems({}); setNote(''); }, [operation.requestId, operation.baseline, operation.contextRevision]);
    const recovery = (action?: string) => ({ reviewed: true, baseline: operation.baseline, items, ...(action ? { action } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
    const disabled = busy || !reviewed || !operation.baseline;
    const retired = operation.state === 'retired';
    return <section aria-label="Advancement recovery" className="min-w-0 border-2 border-black p-4 space-y-4" style={{ overflowWrap: 'anywhere' }}>
        <h3 className="font-bold">{retired ? (operation.terminal?.disposition === 'zero-write' ? 'Advancement was not applied' : 'Advancement operation retired') : `Incomplete advancement to level ${operation.targetLevel ?? 'under review'}`}</h3>
        <p>Request: {operation.requestId}</p>
        {operation.terminal && <p role="status">Terminal disposition: {operation.terminal.disposition}. {operation.terminal.note}</p>}
        <ol className="space-y-3">{(operation.operations ?? []).map((op: any, index: number) => <li key={index} className="space-y-2">
            {op.kind === 'item' ? op.name : 'Final level / XP / HP update'}: {op.status}{op.itemId ? ` · Item ${op.itemId}` : ''}{op.error ? ` · ${op.error}` : ''}
            {op.receiptPending && <p role="status">Upstream write acknowledged{op.itemId ? ` as Item ${op.itemId}` : ''}; receipt storage needs reconciliation. No write will be repeated.</p>}
            {op.verificationPending && <p role="status">Acknowledged write needs primary-source review; it will not repeat.</p>}
            {!retired && op.kind === 'item' && (op.status === 'uncertain' || op.receiptPending || op.verificationPending) && <label className="block space-y-2">Exact owned Item ID after source review
                <input className={inputClass} value={items[op.index] ?? (op.acknowledged ? op.itemId ?? '' : '')} onChange={event => setItems({ ...items, [op.index]: event.target.value })} />
            </label>}
        </li>)}</ol>
        <p>{operation.recovery}</p>
        {retired ? <button type="button" className={buttonClass} onClick={onClose}>{operation.terminal?.disposition === 'zero-write' ? 'Start advancement again' : 'Close and prepare fresh plan'}</button> : <>
            {operation.contextRevision !== undefined && operation.planRevision !== undefined && operation.contextRevision !== operation.planRevision && <p role="status">World rules changed. The old plan cannot replay. Reconcile receipts or use a verified terminal resolution.</p>}
            <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass} disabled={busy} onClick={() => { setReviewed(false); refresh(); }}>Refresh operation review</button>
                <button type="button" className={buttonClass} disabled={busy} onClick={() => resume()}>Retry same request</button>
            </div>
            <label className="flex items-start gap-2"><input className="mt-1 h-4 w-4 shrink-0 accent-black" type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>I independently reviewed the current source and exact Item identities.</span></label>
            <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass} disabled={disabled} onClick={() => resume(recovery())}>Continue reviewed operation</button>
                <button type="button" className={buttonClass} disabled={disabled} onClick={() => resume(recovery('reconcile'))}>Reconcile receipts without replay</button>
            </div>
            <details className="border-t-2 border-black pt-3 space-y-3">
                <summary className="cursor-pointer font-bold">Resolve a partially applied operation after restoration</summary>
                <p>{operation.restoration?.instructions}</p>
                {operation.restoration?.values ? <ul>{operation.restoration.values.map((entry: any) => <li key={entry.path}>{entry.path}: {entry.absent ? 'originally absent' : JSON.stringify(entry.value)}</li>)}</ul> : <p>For an older receipt, use your independent original source export; no prior values are inferred.</p>}
                <label className="block space-y-2">Independent restoration evidence
                    <textarea className={inputClass} rows={3} value={note} maxLength={1000} onChange={event => setNote(event.target.value)} />
                </label>
                <button type="button" className={buttonClass} disabled={disabled || !operation.canResolveRestored || !note.trim()} onClick={() => resume(recovery('resolve-restored'))}>Verify restoration and close operation</button>
            </details>
        </>}
    </section>;
}
