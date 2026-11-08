import type { ModuleRequestRuntime } from '@sheet-delver/sdk/server';
import { formatUuid, parseUuid, type DocumentRef } from '../logic/identity';
import { monsterPortraitRef } from '../logic/community-artwork';

/** Structural optional capability keeps this module buildable against its older
 * SDK floor. Core owns discovery, native preferences, asset loading and access.
 */
export type ArtworkRuntime = { artwork?: {
    resolve(uuid: string, kind?: 'image' | 'token'): Promise<{ status: string; src?: string; credit?: string }>;
} };
export async function resolveMonsterArtwork(runtime: ArtworkRuntime | ModuleRequestRuntime, doc: any, ref: DocumentRef | null): Promise<{ img?: string; fallbackImg?: string; artworkCredit?: string }> {
    const origin = monsterPortraitRef(doc, ref);
    const reader = (runtime as ArtworkRuntime).artwork;
    if (!origin || !reader) return { img: doc?.img };
    try {
        const result = await reader.resolve(formatUuid(origin), 'image');
        if (result.status === 'resolved' && result.src) return { img: result.src, fallbackImg: doc.img, ...(result.credit ? { artworkCredit: result.credit } : {}) };
    } catch { /* Optional art cannot make an otherwise readable NPC unusable. */ }
    return { img: doc?.img };
}

/** Optional SDK hook: display policy is module-owned, including token defaults.
 * Structural types let the module still load on hosts without this new hook.
 */
export async function resolveDisplayArtwork(context: {
    actor: Readonly<Record<string, any>>; currentImage: string | null;
    imageSource: string; purpose: string;
    compendiumSourceUuid?: string;
}, runtime: { artwork?: ArtworkRuntime['artwork']; signal: AbortSignal }): Promise<{src: string; credit?: string} | null> {
    if (runtime.signal.aborted || !context.currentImage || context.actor.type !== 'NPC') return null;
    // Test the currently displayed image, so a custom Combatant or Token image
    // is never replaced merely because its base Actor has the default portrait.
    const origin=monsterPortraitRef({...context.actor,img:context.currentImage},parseUuid(context.compendiumSourceUuid));
    if (!origin || !runtime.artwork) return null;
    const kind=context.purpose==='combat-token'&&context.imageSource!=='actor'?'token':'image';
    const result=await runtime.artwork.resolve(formatUuid(origin),kind);
    return !runtime.signal.aborted&&result.status==='resolved'&&result.src
        ? {src:result.src,...(result.credit?{credit:result.credit}:{})}:null;
}
