// Presentation helpers only. Shadowdark rules are prepared server-side in the
// module view (derived/computed); components must not recompute them.
import { calculateXPForLevel, calculateXPCarryover, shouldGainTalent } from '../logic/rules';

export { calculateXPForLevel, calculateXPCarryover, shouldGainTalent };

import { resolveImage, processHtmlContent, getSafeDescription } from '@sheet-delver/sdk';
export { resolveImage, processHtmlContent as formatDescription, getSafeDescription };
export { presentDescription } from '../logic/description';
