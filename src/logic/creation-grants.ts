import { ownedCopy } from './identity';
/** Native level-one Generator takes prepared grants, with its separate gear flow. */
export function creationGrants(items: any[]): any[] {
    return items.filter(item => !['weapon', 'armor', 'basic', 'potion', 'scroll', 'gear'].includes(String(item.type).toLowerCase()));
}
/** Lossless comparison: ignore only the top-level owned ID and transport stamps. */
export function creationGrantReview(items: any[]): string {
    const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
    return JSON.stringify(creationGrants(items).map(item => JSON.stringify(canonical(ownedCopy(item)))).sort());
}
