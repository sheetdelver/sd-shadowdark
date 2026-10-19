import { createHash } from 'node:crypto';
import { spellReview } from '../logic/spell-review';
/** Compact, source-bound review; not authorization or a data store. */
export const reviewToken = (actor: any) => `sha256:${createHash('sha256').update(spellReview(actor)).digest('hex')}`;
export const reviewMatches = (actor: any, token: string) => token.startsWith('sha256:') ? token === reviewToken(actor) : token === spellReview(actor);
