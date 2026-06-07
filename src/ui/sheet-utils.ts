// Re-export shared logic from lib
import {
    calculateItemSlots,
    calculateMaxSlots,
    calculateCoinSlots,
    calculateGemSlots,
    calculateSpellBonus,
    calculateXPForLevel,
    calculateXPCarryover,
    shouldGainTalent
} from '../logic/rules';

export {
    calculateItemSlots,
    calculateMaxSlots,
    calculateCoinSlots,
    calculateGemSlots,
    calculateSpellBonus,
    calculateXPForLevel,
    calculateXPCarryover,
    shouldGainTalent
};

import { resolveImage, processHtmlContent, getSafeDescription } from '@sheet-delver/sdk';
export { resolveImage, processHtmlContent as formatDescription, getSafeDescription };
