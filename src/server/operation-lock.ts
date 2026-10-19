import { randomUUID } from 'node:crypto';
/** A process lease, not a world cache. Partial journals require fresh review after restart. */
export const operationProcess = randomUUID();
/** Serialize this process's operations on one Actor. The SDK promises no CAS or distributed transaction. */
const locks = new Map<string, Promise<unknown>>();
export async function withActorLock<T>(scope: string, run: () => Promise<T>): Promise<T> {
    const previous = locks.get(scope) ?? Promise.resolve();
    const next = previous.catch(() => {}).then(run);
    locks.set(scope, next);
    try { return await next; } finally { if (locks.get(scope) === next) locks.delete(scope); }
}
