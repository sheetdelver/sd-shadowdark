import { SdkError } from '@sheet-delver/sdk';
import { error, type ModuleRequestRuntime, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { parseUuid } from '../logic/identity';
import { ruleInputsFrom, UNAVAILABLE_RULE_INPUTS, type RuleInputs } from '../logic/world-settings';

/**
 * Caller policy for declared compendium content (ADR-0001 RV-01, G8-D).
 *
 * Pack access is Core's effective native pack capability for the calling user
 * (`req.runtime.access.canReadPack`, module-api 1.5): the world's compendium
 * ownership configuration for that user's role, for every pack, not only
 * monsters. The module's shared pack projection (Registry) is a warmed,
 * system-level cache; it never grants access. Every serving path filters or
 * refuses its content with the caller's current capability, evaluated after
 * the awaited cache read, so a revocation applies to warm caches at once.
 *
 * A request runtime without `access` (an older or test host) reads no pack
 * content: there is no allow-all fallback.
 */
export interface Caller {
    runtime: Pick<ModuleRequestRuntime, 'documents'> & { access?: ModuleRequestRuntime['access'] };
    /** Informational only; never used to grant pack access. */
    isGM: boolean;
}

export function callerOf(req: Pick<ModuleServerRequest, 'runtime' | 'userSession'> & Partial<Pick<ModuleServerRequest, 'getAccessContext'>>): Caller {
    return { runtime: req.runtime, isGM: req.userSession?.isGM === true || req.getAccessContext?.().isGM === true };
}

/** A caller from a request runtime alone (helpers that receive `req.runtime`). */
export function callerFromRuntime(runtime: Caller['runtime']): Caller {
    return { runtime, isGM: false };
}

export function canReadPack(caller: Caller | null | undefined, pack: string): boolean {
    try {
        return caller?.runtime.access?.canReadPack(pack) === true;
    } catch {
        return false;
    }
}

/** Pack id of a compendium reference; null for world/embedded references. */
export function packOf(uuid: unknown): string | null {
    const ref = parseUuid(uuid);
    return ref?.kind === 'compendium' ? ref.pack : null;
}

/** Rows (with `pack` or a compendium `uuid`) the caller may read. */
export function readableRows<T extends { pack?: unknown; uuid?: unknown }>(rows: readonly T[], caller: Caller): T[] {
    return rows.filter(row => {
        const pack = typeof row?.pack === 'string' ? row.pack : packOf(row?.uuid);
        return pack !== null && canReadPack(caller, pack);
    });
}

/** Refusal for compendium content the caller cannot read; routes map it to 403 like any SDK error. */
export const compendiumDenied = (pack?: string) =>
    new SdkError('permission_denied', pack ? `Compendium ${pack} is not available to you.` : 'This compendium content is not available to you.');

/**
 * Rule inputs for a request, from the request runtime's world context (Core pins
 * its revision for the request's runtime operations). A retired or absent
 * context gives unavailable inputs, never native defaults.
 */
export function requestRules(runtime: { world?: ModuleRequestRuntime['world'] }): RuleInputs {
    try {
        return ruleInputsFrom(runtime.world?.snapshot());
    } catch {
        return UNAVAILABLE_RULE_INPUTS;
    }
}

/** The request's world context revision at its start, or null without a context. */
export function requestRevision(runtime: { world?: ModuleRequestRuntime['world'] }): number | null {
    try {
        return runtime.world?.snapshot().identity.contextRevision ?? null;
    } catch {
        return null;
    }
}

/**
 * A 409 when Core retired the request's world context while it ran (a setting,
 * declared pack or recovery changed mid-request). Core then fails the request's
 * runtime reads with a plain Error, so routes check the public
 * `world.assertRevision` against the revision captured at the start instead of
 * treating it as an internal failure. Null when the context is unchanged.
 */
export function contextConflict(runtime: { world?: ModuleRequestRuntime['world'] }, start: number | null) {
    if (start === null || !runtime.world) return null;
    try {
        runtime.world.assertRevision(start);
        return null;
    } catch {
        return error('conflict', 'World rules changed while this request ran; refresh and try again.');
    }
}
