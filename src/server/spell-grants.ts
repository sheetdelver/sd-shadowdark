import { SdkError } from '@sheet-delver/sdk';
import { grantedSpellSources, knownSpellSources } from '../logic/spell-model';
import { ownedCopy } from '../logic/identity';
import { shadowdarkAdapter } from './ShadowdarkAdapter';
import type { Caller } from './access';

/** Fixed native entitlements only. Choice grants are resolved by advancement. */
export function missingSpellGrants(items: any[]): string[] {
    const known = knownSpellSources(items);
    return [...grantedSpellSources(items)].filter(uuid => !known.has(uuid));
}

/** Caller-readable complete source copies, independent of ordinary spell quotas/filters. */
export async function resolveSpellGrants(items: any[], caller: Caller): Promise<any[]> {
    const result = [];
    for (const uuid of missingSpellGrants(items)) {
        const doc = await shadowdarkAdapter.resolveDocumentFor(uuid, caller);
        if (!doc || doc.type !== 'Spell') throw new SdkError('not_found', 'A granted spell source is unavailable. Restore access to its spell compendium and retry.');
        result.push(ownedCopy(doc, uuid));
    }
    return result;
}
