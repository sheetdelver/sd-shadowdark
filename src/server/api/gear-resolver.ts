import { canonicalUuid } from '../../logic/identity';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { sanitizeItem } from '../../utils/Sanitizer';
import type { Caller } from '../access';

function getUuidRef(ref: unknown): string | null {
    if (typeof ref === 'string') return ref;
    if (!ref || typeof ref !== 'object') return null;

    const uuid = Reflect.get(ref as object, 'uuid');
    return typeof uuid === 'string' ? uuid : null;
}

/**
 * Resolves all associated documents (talents, features, gear) for a class or ancestry.
 */
export async function resolveBaggage(doc: any, caller: Caller): Promise<any[]> {
    if (!doc || !doc.system) return [];

    const baggage: any[] = [];
    const refs: string[] = [
        ...(doc.system.talents || []),
        ...(doc.system.features || []),
        ...(doc.system.abilities || []),
        ...(doc.system.classAbilities || []),
        ...(doc.system.startingSpells || [])
        // talentChoices excluded - these are handled by the Generator UI
    ];

    for (const ref of refs) {
        const uuid = canonicalUuid(getUuidRef(ref));
        if (!uuid) throw new Error(`Required ${doc.name} grant has no exact UUID.`);
        const item = await shadowdarkAdapter.resolveDocumentFor(uuid, caller);
        if (!item) throw new Error(`Required ${doc.name} grant ${uuid} is unavailable; advancement has not written.`);
        const clean = JSON.parse(JSON.stringify(sanitizeItem(item)));
        delete clean._id;
        clean.uuid = uuid;
        baggage.push(clean);
    }

    return baggage;
}

/**
 * Legacy-style gear resolver that scans a document for any arrays of UUID strings.
 */
export async function resolveGear(doc: any, caller: Caller): Promise<any[]> {
    if (!doc) return [];

    const candidates = new Set<string>();
    const objectsToScan = [doc, doc.system || {}];

    for (const obj of objectsToScan) {
        for (const key of Object.keys(obj)) {
            if (['talents', 'features', 'abilities', 'classAbilities'].includes(key)) {
                continue;
            }

            const val = obj[key];
            if (Array.isArray(val) && val.length > 0) {
                if (typeof val[0] === 'string') {
                    val.forEach(v => {
                        // Only add if it looks like a Gear UUID
                        if (typeof v === 'string' && v.includes('.') && v.includes('.gear.')) {
                            candidates.add(v);
                        }
                    });
                }
            }
        }
    }

    const resolvedItems = [];
    for (const entry of candidates) {
        const uuid = canonicalUuid(entry);
        if (!uuid) throw new Error(`Required gear ${entry} has no exact UUID.`);
        const item = await shadowdarkAdapter.resolveDocumentFor(uuid, caller);
        if (!item) throw new Error(`Required gear ${uuid} is unavailable; advancement has not written.`);
        const clean = JSON.parse(JSON.stringify(sanitizeItem(item)));
        delete clean._id;
        clean.uuid = uuid;
        resolvedItems.push(clean);
    }

    // Handle manual object arrays in 'equipment' or 'items'
    const manualLists = ['equipment', 'items'];
    for (const key of manualLists) {
        const list = doc.system?.[key];
        if (Array.isArray(list)) {
            for (const entry of list) {
                if (typeof entry === 'object' && entry.name && entry.type) {
                    resolvedItems.push(JSON.parse(JSON.stringify(sanitizeItem(entry))));
                }
            }
        }
    }

    return resolvedItems;
}
