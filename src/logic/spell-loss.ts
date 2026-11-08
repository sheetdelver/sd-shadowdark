export const REST_LOSS_PATH = 'flags.shadowdark.sheetDelver.spellLoss';
/** Manual loss/restoration retires prior casting provenance. */
export function manualSpellLoss(lost: boolean): Record<string, unknown> {
    return { 'system.lost': lost, [REST_LOSS_PATH]: null };
}
