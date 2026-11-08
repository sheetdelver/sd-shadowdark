import { canonicalUuid, ownedCopy } from './identity';

const CRAWLING_KIT = 'Compendium.shadowdark.gear.Item.fJHwwn6TEfbdr8CM';

/** Expand only the native kit, using its own linked contents and readable sources.
 * Bundle quantities (e.g. three rations) belong to each component's template. */
export function gearAdditionItems(item: any, catalog: readonly any[]): any[] {
    const source = canonicalUuid(item?.uuid ?? item?._stats?.compendiumSource ?? item?.flags?.core?.sourceId);
    if (source !== CRAWLING_KIT) return [ownedCopy(item)];
    const rows = [...String(item.system?.description ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)];
    if (!rows.length) throw new Error('The Crawling Kit contents are unavailable. No items were added.');
    return rows.map(([, html]) => {
        const text = html.replace(/<[^>]*>/g, '').trim();
        const match = text.match(/^(?:(\d+)\s*x\s*)?@UUID\[([^\]]+)\](?:\{[^}]*\})?$/i);
        const reference = match && canonicalUuid(match[2]);
        const component = reference && catalog.find(row => canonicalUuid(row.uuid) === reference);
        const count = match?.[1] ? Number(match[1]) : 1;
        const quantity = component?.system?.quantity;
        if (!component || !Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(count * quantity)) {
            throw new Error('A Crawling Kit component is unavailable. Refresh gear sources; no items were added.');
        }
        const copy = ownedCopy(component, reference!);
        copy.system.quantity = count * quantity;
        return copy;
    });
}
