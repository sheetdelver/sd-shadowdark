import type { ModuleRequestRuntime } from '@sheet-delver/sdk/server';
import { buildDocumentCard, buildNpcCard } from '../logic/resource-cards';
import { prepareShadowdarkView, type ViewLookups } from '../logic/prepared-view';
import { parseUuid } from '../logic/identity';
import { requestRules } from './access';
import { resolveMonsterArtwork, type ArtworkRuntime } from './community-artwork';

/** Structural optional contract: older hosts ignore this hook. No Actor instance
 * enters this path. Core reads and authorizes the original compendium source. */
export async function prepareReferenceView(context: {
    uuid: string; documentType: 'Actor' | 'Item'; document: Readonly<Record<string, unknown>>;
}, runtime: ArtworkRuntime & { world?: ModuleRequestRuntime['world']; signal: AbortSignal }, lookups: ViewLookups = {}) {
    const ref = parseUuid(context.uuid);
    if (runtime.signal.aborted || ref?.kind !== 'compendium' || ref.documentType !== context.documentType) return null;
    const doc = context.document;
    if (context.documentType === 'Actor' && doc.type !== 'NPC') return null;
    const card = context.documentType === 'Actor'
        ? { ...buildNpcCard(prepareShadowdarkView(doc, lookups, requestRules(runtime)), doc, ref), ...await resolveMonsterArtwork(runtime, doc, ref) }
        : buildDocumentCard(doc, ref, lookups);
    return runtime.signal.aborted ? null : { title: card.title, model: { ...card, actions: [] } };
}
