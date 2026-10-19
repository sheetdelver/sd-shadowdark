/**
 * Caller-scoped Shadowdark system index and collection cache (ADR-0001 RV-08).
 *
 * The index (`/index`) and collection shards (`/fetch-pack/<id>`) are filtered by
 * the caller's pack capabilities and the world context, so both belong to one
 * scope: world, user, role and connection. Each scope change, Core
 * `world:contextChanged` invalidation or manual retry starts a new request
 * generation:
 *
 * - the previous generation's requests are aborted, its retry timer is cleared
 *   and any late response is discarded;
 * - the index and every cached collection are dropped, then a replacement index
 *   request starts at once, whether the previous one was pending, loaded or failed;
 * - the generation ends `ready` (current data) or `failed` (a reason), never in a
 *   permanent `loading` state. Without a connection it is `offline`. A 409 (the
 *   world context changed while the request ran) is retried like a 5xx.
 *
 * Framework-neutral: the React provider subscribes to it, and the regression
 * suite drives it directly with controlled responses and timers.
 */

export type SystemIndexStatus = 'offline' | 'loading' | 'ready' | 'failed';
export type CollectionState =
    | { status: 'loading' }
    | { status: 'ready'; warnings?: string[] }
    | { status: 'failed'; error: string; failure: 'denied' | 'unavailable' | 'failed'; httpStatus?: number };

export interface SystemIndexSnapshot {
    status: SystemIndexStatus;
    systemData: any | null;
    collections: Record<string, any[]>;
    error: string | null;
    generation: number;
    collectionStates: Record<string, CollectionState>;
}

export interface SystemIndexScope {
    worldId: string | null;
    userId: string | null;
    role: number | null;
    connected: boolean;
}
const keyOf = (scope: SystemIndexScope) => JSON.stringify([scope.worldId, scope.userId, scope.role, scope.connected]);

export interface SystemIndexStoreOptions {
    fetchIndex: (signal: AbortSignal) => Promise<Response>;
    fetchCollection: (packId: string, signal: AbortSignal) => Promise<Response>;
    /** Further attempts after a 5xx/429/409 response or network failure. */
    retries?: number;
    retryDelayMs?: number;
    setTimer?: (callback: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
    onError?: (message: string, error?: unknown) => void;
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error);
/** Server errors, rate limits and a world-context conflict ("refresh this action") are retried. */
const retriable = (status: number) => status >= 500 || status === 429 || status === 409;

export function createSystemIndexStore(options: SystemIndexStoreOptions) {
    const retries = options.retries ?? 3;
    const retryDelayMs = options.retryDelayMs ?? 1000;
    const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    const clearTimer = options.clearTimer ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>));

    let snapshot: SystemIndexSnapshot = { status: 'offline', systemData: null, collections: {}, error: null, generation: 0, collectionStates: {} };
    let scopeKey: string | null = null;
    let connected = false;
    let generation = 0;
    let controller: AbortController | null = null;
    let timer: unknown = null;
    const pending = new Map<string, { promise: Promise<any[] | null>; controller: AbortController; finish: (data: any[] | null) => void }>();
    // Subscriptions express demand, not another data store. They survive context
    // changes and loads start only after the new caller's index is ready.
    const consumers = new Map<string, number>();
    const listeners = new Set<() => void>();

    function publish(next: Partial<SystemIndexSnapshot>) {
        snapshot = { ...snapshot, ...next };
        for (const listener of listeners) listener();
    }

    /** Ends the current generation: no request, retry or response of it can publish. */
    function retire() {
        generation++;
        controller?.abort();
        controller = null;
        if (timer !== null) { clearTimer(timer); timer = null; }
        for (const request of pending.values()) { request.controller.abort(); request.finish(null); }
        pending.clear();
    }

    function restart() {
        retire();
        if (scopeKey === null) return;
        const cleared = { systemData: null, collections: {}, collectionStates: {}, error: null, generation };
        if (!connected) { publish({ ...cleared, status: 'offline' }); return; }
        publish({ ...cleared, status: 'loading' });
        const started = generation;
        const own = new AbortController();
        controller = own;
        const current = () => started === generation;
        const attempt = async (left: number, delay: number) => {
            timer = null;
            let failure: string;
            let retry = left > 0;
            try {
                const response = await options.fetchIndex(own.signal);
                if (!current()) return;
                if (response.ok) {
                    const data = await response.json();
                    if (!current()) return;
                    publish({ status: 'ready', systemData: data ?? {}, error: null });
                    for (const packId of consumers.keys()) void fetchCollection(packId);
                    return;
                }
                failure = `The Shadowdark system index is unavailable (HTTP ${response.status}).`;
                retry &&= retriable(response.status);
            } catch (error) {
                if (!current()) return;
                failure = `The Shadowdark system index could not be loaded: ${message(error)}`;
            }
            if (retry) {
                options.onError?.(`${failure} Retrying in ${delay / 1000}s.`);
                timer = setTimer(() => { if (current()) void attempt(left - 1, delay * 2); }, delay);
                return;
            }
            options.onError?.(failure);
            publish({ status: 'failed', error: failure });
        };
        void attempt(retries, retryDelayMs);
    }

    function fetchCollection(packId: string): Promise<any[] | null> {
        if (scopeKey === null || !connected || snapshot.status !== 'ready') return Promise.resolve(null);
        const state = snapshot.collectionStates[packId];
        if (state?.status === 'ready') return Promise.resolve(snapshot.collections[packId]);
        const inFlight = pending.get(packId);
        if (inFlight) return inFlight.promise;
        // Failure is terminal until explicit retry or a new context. Re-renders
        // and additional consumers must not create permission-denial loops.
        if (state?.status === 'failed') return Promise.resolve(null);
        const started = generation;
        const own = new AbortController();
        let finish!: (data: any[] | null) => void;
        const promise = new Promise<any[] | null>(resolve => { finish = resolve; });
        pending.set(packId, { promise, controller: own, finish });
        const current = () => started === generation && pending.get(packId)?.controller === own;
        publish({ collectionStates: { ...snapshot.collectionStates, [packId]: { status: 'loading' } } });
        void (async () => {
            let httpStatus: number | undefined;
            try {
                const response = await options.fetchCollection(packId, own.signal);
                if (!current()) return;
                httpStatus = response.status;
                if (!response.ok) {
                    const detail = await response.json().catch(() => null);
                    const reason = detail?.message ?? detail?.error?.message ?? detail?.error;
                    throw new Error(`HTTP ${response.status}${typeof reason === 'string' ? `: ${reason}` : ''}`);
                }
                const data = await response.json();
                if (!current()) return;
                const catalog = packId === 'spells' && Array.isArray(data?.rows) && Array.isArray(data?.sources) && ['complete', 'partial'].includes(data?.state);
                if (!Array.isArray(data) && !catalog) throw new Error('The server returned an invalid collection; source rows were required.');
                const rows = catalog ? data.rows : data;
                const warnings = catalog ? data.sources.filter((source: any) => source.status === 'failed').map((source: any) => `${source.source}: ${source.reason ?? 'Unavailable'}`) : [];
                pending.delete(packId);
                publish({ collections: { ...snapshot.collections, [packId]: rows },
                    collectionStates: { ...snapshot.collectionStates, [packId]: { status: 'ready', ...(warnings.length ? { warnings } : {}) } } });
                finish(rows);
            } catch (error) {
                if (!current()) return;
                const failure = httpStatus === 401 || httpStatus === 403 ? 'denied'
                    : httpStatus === 404 || httpStatus === 409 || httpStatus === 503 ? 'unavailable' : 'failed';
                const explanation = `${packId}: ${failure === 'denied' ? 'Access denied' : failure === 'unavailable' ? 'Collection unavailable' : 'Could not load collection'} (${message(error)}).`;
                pending.delete(packId);
                publish({ collectionStates: { ...snapshot.collectionStates, [packId]: { status: 'failed', error: explanation, failure, httpStatus } } });
                options.onError?.(explanation, error);
            } finally { finish(null); }
        })();
        return promise;
    }

    return {
        getSnapshot: () => snapshot,
        matchesScope: (scope: SystemIndexScope) => scopeKey === keyOf(scope),
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        /** World, user, role and connection the cached data belongs to. */
        setScope(scope: SystemIndexScope) {
            const key = keyOf(scope);
            if (key === scopeKey) return;
            scopeKey = key;
            connected = scope.connected;
            restart();
        },
        /** Core `world:contextChanged`: settings, declared packs or recovery changed. */
        invalidate() { restart(); },
        retry() { restart(); },
        /** Unmount or scope teardown: retire all work without publishing. */
        release() { retire(); scopeKey = null; },
        fetchCollection,
        retryCollection(packId: string) {
            const state = snapshot.collectionStates[packId];
            if (state?.status !== 'failed' && !(state?.status === 'ready' && state.warnings?.length)) return;
            const states = { ...snapshot.collectionStates };
            delete states[packId];
            publish({ collectionStates: states });
            void fetchCollection(packId);
        },
        /** Active consumers recover automatically, including mounts before scope readiness. */
        retainCollections(packIds: readonly string[]) {
            const ids = [...new Set(packIds)];
            for (const id of ids) {
                consumers.set(id, (consumers.get(id) ?? 0) + 1);
                void fetchCollection(id);
            }
            return () => {
                for (const id of ids) {
                    const count = (consumers.get(id) ?? 1) - 1;
                    if (count > 0) { consumers.set(id, count); continue; }
                    consumers.delete(id);
                    const request = pending.get(id);
                    if (request) {
                        request.controller.abort();
                        request.finish(null);
                        pending.delete(id);
                        const states = { ...snapshot.collectionStates };
                        delete states[id];
                        publish({ collectionStates: states });
                    }
                }
            };
        },
    };
}

export type SystemIndexStore = ReturnType<typeof createSystemIndexStore>;
