import type { SDKContextValue } from '@sheet-delver/sdk/react';
import { createSystemIndexStore, type SystemIndexScope } from './system-index-store';

export const TOOL_BESTIARY = 'tool:bestiary';
export const TOOL_TREASURE = 'tool:treasure';
type Events = SDKContextValue['events'];
const sessions = new WeakMap<Events, ReturnType<typeof createSession>>();

/** One browser-session store, using Core's existing event bus; no polling or persistent data. */
export function systemIndexSession(events: Events) {
    let session = sessions.get(events);
    if (!session) { session = createSession(events); sessions.set(events,session); }
    return session;
}
function createSession(events: Events) {
    let fetcher: SDKContextValue['fetchWithAuth'];
    let scope: SystemIndexScope;
    let off: Array<()=>void> = [];
    const store = createSystemIndexStore({
        fetchIndex: signal => fetcher('/api/modules/shadowdark/index',{signal}),
        fetchCollection: async (id,signal) => {
            const path = id === TOOL_BESTIARY ? 'bestiary' : id === TOOL_TREASURE ? 'treasure/catalog' : `fetch-pack/${id}`;
            const res = await fetcher(`/api/modules/shadowdark/${path}`,{signal});
            if (!res.ok || !id.startsWith('tool:')) return res;
            const data = await res.json();
            if (!data?.success) throw new Error(typeof data?.error === 'string' ? data.error : 'Sources are unavailable.');
            // Tool projections share the collection store's lifecycle and request deduplication.
            const rows = id === TOOL_BESTIARY ? data.entries : [data];
            return new Response(JSON.stringify(rows),{headers:{'Content-Type':'application/json'}});
        },
    });
    return { store, configure(next: SystemIndexScope, fetchWithAuth: SDKContextValue['fetchWithAuth']) {
        fetcher = fetchWithAuth; scope = next;
        if (!off.length) {
            const reset = () => store.invalidate();
            const disconnect = () => { scope = {...scope,connected:false}; store.setScope(scope); };
            let queued = false;
            const changed = new Set<string>();
            const document = ({type}:{type:string}) => {
                if (!['Actor','Item','RollTable','User'].includes(type)) return;
                changed.add(type);
                if (queued) return;
                queued = true;
                queueMicrotask(()=>{
                    queued = false;
                    if (!off.length) return;
                    const types = [...changed]; changed.clear();
                    if (types.some(t=>t==='User'||t==='Item'||t==='RollTable')) reset();
                    else store.invalidateCollections([TOOL_BESTIARY,TOOL_TREASURE]);
                });
            };
            off = [events.on('world:contextChanged',reset), events.on('world:packagesChanged',reset),
                events.on('world:teardown',disconnect), events.on('connection:changed',({connected,worldId})=>{scope={...scope,connected:connected&&worldId===scope.worldId};store.setScope(scope);}),
                events.on('document:changed',document),events.on('document:listInvalidated',document),
                events.on('module:disposed',({moduleId})=>{if(moduleId!=='shadowdark')return;off.forEach(stop=>stop());off=[];store.release();sessions.delete(events);})];
        }
        store.setScope(next);
    }};
}
