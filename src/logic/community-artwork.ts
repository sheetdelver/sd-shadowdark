import { sourceRef, type DocumentRef } from './identity';

export const DEFAULT_MONSTER_PORTRAIT = 'systems/shadowdark/assets/tokens/cowled_token_red.webp';
// Native 4.0.6 bundled monsters retain the earlier placeholder even though
// new NPCs use the red one. Both exact system-owned defaults are eligible.
const defaultPortraits = new Set([DEFAULT_MONSTER_PORTRAIT, 'systems/shadowdark/assets/tokens/cowled_token.webp']);

/** Only the native default portrait is replaceable; names are never identities. */
export function monsterPortraitRef(doc: any, ref: DocumentRef | null): DocumentRef | null {
    if (doc?.type !== 'NPC' || typeof doc.img !== 'string'
        || !defaultPortraits.has(doc.img.replace(/^\//, ''))) return null;
    const origin = ref?.kind === 'compendium' ? ref : sourceRef(doc);
    return origin?.kind === 'compendium' && origin.documentType === 'Actor' ? origin : null;
}

