import { grantSource } from './spell-grants';
import { ROLL_TABLE_FILTER as F, ROLL_TABLE_TALENT_MAP, ROLL_TABLE_PATRON_BOONS } from '../data/roll-table-patterns';

/** Native4.0.6 Talent prose explicitly requires rerolling these duplicates.
 * Other sources (including fixed +1/+2 and Force GM Reroll) stay independent. */
export const NONREPEATABLE_CREATOR_AWARDS = new Set([
    '9K2XPwkAA7BYZQrW','FIHNdRhD6DHFxSkC','tfM77lqANyzu0kMy','gRyFoUtbbnkwcxy9',
    'UVsf7VJCOrBm42Yz','52dWOJ8zzxCwfM1B','dWqqxABbZKmJLnff',
].map(id=>`Compendium.shadowdark.talents.Item.${id}`));

/** Native LevelUpSD.getData + _onRollTalent. Count source grants, never names. */
export function creatorLevelRequirements(level: number, classDoc: any, items: any[]) {
    const patron = classDoc?.system?.patron;
    const needsBoon = patron?.required === true;
    const starting = patron?.startingBoons ?? 0; // native NumberField initial 0
    if (!Number.isInteger(starting) || starting < 0) throw new Error('The Class starting-boon count is invalid.');
    const ambitious = level === 1 && items.some(item => grantSource(item) === 'Compendium.shadowdark.talents.Item.DYWFJu5XeazJYc0P') ? 1 : 0;
    return { level, requiredTalents: level % 2 ? (needsBoon ? ambitious : 1 + ambitious) : 0,
        requiredBoons: level === 1 && needsBoon ? starting : 0,
        choiceRolls: level > 1 && level % 2 && needsBoon ? 1 : 0, needsBoon };
}

/** A native result group is a single award. Identity survives equal names and
 * repeated template references. Instruction-only outcomes stay explicit. */
export function creatorTableOutcome(table: any, total: number) {
    const rows = (table?.results ?? []).filter((r: any) => Array.isArray(r.range) && r.range[0] <= total && r.range[1] >= total);
    const pattern = [...Object.values(ROLL_TABLE_TALENT_MAP), ...Object.values(ROLL_TABLE_PATRON_BOONS)].find(p => p.UUID === table.uuid);
    const filter = pattern?.map.find(p => p.range[0] <= total && p.range[1] >= total)?.filter ?? F.None;
    const distribute = !!(filter & (F.DistributeTwoStatsAny | F.DistributeTwoStatsOnlyOnce));
    const options = rows.filter((r: any) => r.documentUuid).map((r: any) => ({ id: r._id, source: r.documentUuid, label: r.name || r.text || 'Award' }));
    const text = rows.filter((r: any) => !r.documentUuid).map((r: any) => r.description || r.text || r.name || '').join(' ');
    const choose = !!(filter & (F.ChooseOne | F.ChooseTwoInstead | F.WarlockSpecificTwelve)) || /choose\s*(?:one|1)|\bor\b/i.test(text);
    const unsupported = !rows.length ? 'This table has no result for that total.'
        : !pattern && text.trim() ? 'This table instruction has no supported automatic interpretation. Record the actual awarded Talent/Boon separately, or preserve it as a note.'
        : !options.length && !distribute ? 'This result requires a further patron/table choice. Record the actual awarded Boon separately with its acquisition level.' : null;
    return { table: table.uuid, total, range: rows[0]?.range??[total,total], results: rows.map((r: any) => r._id), options, text,
        count: choose ? (filter & F.ChooseTwoInstead ? 2 : 1) : options.length,
        mode: distribute ? 'stats' as const : choose ? 'choose' as const : 'bundle' as const,
        statRule: distribute ? { total: 2, maxPerStat: filter & F.DistributeTwoStatsOnlyOnce ? 1 : 2 } : null, unsupported };
}
