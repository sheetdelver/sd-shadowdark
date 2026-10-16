import { SdkError } from '@sheet-delver/sdk';
import type { ModuleRequestRuntime, ModuleServerRequest } from '@sheet-delver/sdk/server';
import { parseUuid } from '../logic/identity';

/**
 * Caller policy for declared compendium content (ADR-0001 RV-01).
 *
 * Core does not yet tell modules a world's native pack permissions (Core ADR-0064
 * plans effective caller pack capabilities). Until it does, the monster pack,
 * which GMs commonly restrict, is served to GMs only, on every route that can
 * return its content: documents, collections, the name index and bestiary cards.
 * When the Core capability exists it replaces this policy on all routes at once.
 * Other declared packs are character-building data every player needs.
 */
export const GM_ONLY_PACKS: ReadonlySet<string> = new Set(['shadowdark.monsters']);
export const GM_ONLY_COLLECTIONS: ReadonlySet<string> = new Set(['monsters']);

/** The calling user: their request runtime and whether they are a GM in this world. */
export interface Caller {
    runtime: Pick<ModuleRequestRuntime, 'documents'>;
    isGM: boolean;
}

export function callerOf(req: Pick<ModuleServerRequest, 'runtime' | 'userSession'> & Partial<Pick<ModuleServerRequest, 'getAccessContext'>>): Caller {
    return { runtime: req.runtime, isGM: req.userSession?.isGM === true || req.getAccessContext?.().isGM === true };
}

export const canReadPack = (caller: Pick<Caller, 'isGM'> | null | undefined, pack: string) => caller?.isGM === true || !GM_ONLY_PACKS.has(pack);
export const canReadCollection = (caller: Pick<Caller, 'isGM'> | null | undefined, id: string) => caller?.isGM === true || !GM_ONLY_COLLECTIONS.has(id);

/** Whether a reference names content the caller may not read (only restricted compendium packs). */
export function isRestrictedFor(caller: Pick<Caller, 'isGM'> | null | undefined, uuid: unknown): boolean {
    const ref = parseUuid(uuid);
    return ref?.kind === 'compendium' && !canReadPack(caller, ref.pack);
}

/** Name index entries the caller may see. */
export function visibleNameIndex(index: Record<string, string>, caller: Pick<Caller, 'isGM'>): Record<string, string> {
    if (caller.isGM) return index;
    return Object.fromEntries(Object.entries(index).filter(([uuid]) => !isRestrictedFor(caller, uuid)));
}

/** Refusal for restricted compendium content; routes map it to 403 like any SDK error. */
export const compendiumDenied = () => new SdkError('permission_denied', 'Compendium monsters are available to GMs.');
