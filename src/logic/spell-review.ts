import { documentId } from './identity';

/** Review token over relevant source, never a prepared projection or catalog. */
export function spellReview(actor: any): string {
    const canonical = (value: any): any => Array.isArray(value) ? value.map(canonical)
        : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])])) : value;
    const effect = (doc: any) => ({ id: documentId(doc), disabled: doc.disabled, transfer: doc.transfer, changes: doc.changes, system: doc.system, flags: doc.flags });
    return JSON.stringify(canonical({ actorId: documentId(actor), type: actor.type, system: actor.system,
        items: (actor.items ?? []).map((item: any) => ({ id: documentId(item), type: item.type, name: item.name, system: item.system,
            origin: item._stats?.compendiumSource ?? item.flags?.core?.sourceId, effects: (item.effects ?? []).map(effect) })),
        effects: (actor.effects ?? []).map(effect) }));
}
