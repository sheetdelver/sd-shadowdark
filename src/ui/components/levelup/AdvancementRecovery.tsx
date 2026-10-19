import React, { useState } from 'react';

/** Receipts stay bound to one operation, independent of the next level's form. */
export function AdvancementRecovery({ operation, busy, refresh, resume }: { operation: any; busy: boolean; refresh: () => void; resume: (recovery?: any) => void }) {
    const [reviewed, setReviewed] = useState(false);
    const [items, setItems] = useState<Record<string, string>>({});
    return <section aria-label="Advancement recovery" className="border-2 border-black p-4 space-y-3">
        <h3>Incomplete advancement to level {operation.targetLevel ?? 'under review'}</h3>
        <p>Request: {operation.requestId}</p>
        <ol>{(operation.operations ?? []).map((op: any, index: number) => <li key={index}>
            {op.kind === 'item' ? op.name : 'Final level / XP / HP update'}: {op.status}{op.itemId ? ` · Item ${op.itemId}` : ''}{op.error ? ` · ${op.error}` : ''}
            {op.kind === 'item' && op.status === 'uncertain' && <label>Exact owned Item ID after source review
                <input value={items[op.index] ?? ''} onChange={event => setItems({ ...items, [op.index]: event.target.value })} />
            </label>}
        </li>)}</ol>
        <p>{operation.recovery}</p>
        <button type="button" disabled={busy} onClick={() => { setReviewed(false); refresh(); }}>Refresh operation review</button>
        <button type="button" disabled={busy} onClick={() => resume()}>Retry same request</button>
        <label><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I independently reviewed the current source and exact Item identities.</label>
        <button type="button" disabled={busy || !reviewed || !operation.baseline} onClick={() => resume({ reviewed: true, baseline: operation.baseline, items })}>Continue reviewed operation</button>
    </section>;
}
