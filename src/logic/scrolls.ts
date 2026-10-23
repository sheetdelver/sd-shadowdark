import { canonicalUuid, formatUuid, parseUuid, sourceRef } from './identity';

/** Native 4.0.6 ships these scrolls as Basic Items, not Scroll Items. */
export const LEGACY_SCROLL_SOURCES = new Set([
    'Compendium.shadowdark.magic-items.Item.N27A6nb0epkHZ3lR',
    'Compendium.shadowdark.magic-items.Item.mXkpNk8z0eZU8kKj',
]);
export const SCROLL_SPENT_PATH = 'flags.shadowdark.sheetDelver.scrollSpent';

// The old Gear Add dialog discarded origins. Recognize only its exact native
// content copies; this grants a capability, never fabricates source provenance.
const LEGACY_SCROLL_CONTENT = [
    { name: 'Scroll of Burning Hands', img: 'icons/sundries/scrolls/scroll-writing-orange-black.webp',
        description: '<p>@UUID[Compendium.shadowdark.spells.ItN82uLU3PhJFLNm]{Burning Hands}</p>' },
    { name: 'Scroll of Hold Portal', img: 'icons/sundries/scrolls/scroll-bound-green.webp',
        description: '<p>@UUID[Compendium.shadowdark.spells.q600IZtPTAgkz6vB]{Hold Portal}</p>' },
];

export function isScroll(item: any): boolean {
    if (item?.type === 'Scroll') return true;
    if (item?.type !== 'Basic') return false;
    const source = sourceRef(item), uuid = parseUuid(item?.uuid);
    const ref = source ?? (uuid?.kind === 'compendium' ? uuid : null);
    if (ref) return LEGACY_SCROLL_SOURCES.has(formatUuid(ref));
    return item.system?.magicItem === true && LEGACY_SCROLL_CONTENT.some(template =>
        item.name === template.name && item.img === template.img && item.system?.description === template.description);
}

export function scrollSpellUuid(item: any): string | null {
    if (!isScroll(item)) return null;
    if (item.type === 'Scroll') return canonicalUuid(item.system?.spellUuid);
    // Read the actual link, including reviewed edits, without name inference.
    const links = [...String(item.system?.description ?? '').matchAll(/@UUID\[([^\]]+)\]/g)]
        .map(match => canonicalUuid(match[1]));
    return links.length === 1 && links[0] && parseUuid(links[0])?.documentType === 'Item' ? links[0] : null;
}

export function scrollSpent(item: any): boolean {
    return isScroll(item) && item?.flags?.shadowdark?.sheetDelver?.scrollSpent === true;
}
