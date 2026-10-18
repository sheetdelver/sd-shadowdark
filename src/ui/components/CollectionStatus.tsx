/** Shared explanation/recovery for caller-scoped collection reads. */
export function CollectionStatus({ state, label }: {
    state: { error: string | null; loading: boolean; retry: () => void };
    label: string;
}) {
    if (state.error) return <div role="alert" className="border-2 border-red-700 bg-red-50 p-3 text-red-900 space-y-2">
        <p>{state.error}</p>
        <button type="button" onClick={state.retry} className="min-h-11 border-2 border-red-800 bg-white px-3 font-bold">Retry</button>
    </div>;
    if (state.loading) return <p role="status" className="p-3 italic">{label}</p>;
    return null;
}
