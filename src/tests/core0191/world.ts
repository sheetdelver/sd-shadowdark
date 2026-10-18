/**
 * Shadowdark world fixtures for the isolated Core 0.19.1 host harness (ADR-0001).
 *
 * - `nativePacks` assembles the pinned native 4.0.6 compendium sources
 *   (LevelDB source JSON under temp/shadowdark/data/packs) into Foundry
 *   documents: embedded children replace their id lists, `_key` is dropped.
 * - `shadowdarkInventory` builds a world with pre-4.0 effect keys in every
 *   migration location, plus the hand-derived expected source after migration.
 *
 * The oracle never calls module or Core migration code. Each legacy change is
 * written with its expected native 4.0.6 key (Update_251001_1.updateEffects):
 *   system.bonuses.acBonus          → system.attributes.ac.value
 *   system.bonuses.gearSlots        → system.slots
 *   system.attributes.hp.bonus      → system.attributes.hp.max
 *   system.abilities.str.bonus      → system.abilities.str.value
 *   system.bonuses.meleeAttackBonus → system.roll.melee.bonus.this (Weapon parent) / .all
 * Mode, value, priority, phase and unknown per-change fields are unchanged for
 * these renames. Native scope: Actor-level effects of Player Actors (token deltas
 * resolve a null delta type to the base Actor's type), effects of every Item.
 */
import fs from 'node:fs';
import path from 'node:path';

export type Doc = Record<string, any>;

export function nativePacks(nativeRoot: string, ids: string[]): Record<string, Doc[]> {
    const result: Record<string, Doc[]> = {};
    for (const id of ids) {
        const dir = path.join(nativeRoot, 'data/packs', `${id.split('.')[1]}.db`);
        const rows = fs.readdirSync(dir).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
        const byKey = new Map<string, Doc>();
        for (const row of rows) byKey.set(row._key, row);
        const childKey = (key: string, collection: string, childId: string) => {
            const [, kind, ids] = key.split('!');
            return `!${kind}.${collection}!${ids}.${childId}`;
        };
        const assemble = (row: Doc): Doc => {
            const doc: Doc = { ...row };
            for (const collection of ['items', 'effects', 'results', 'pages']) {
                if (!Array.isArray(doc[collection])) continue;
                doc[collection] = doc[collection].map((entry: unknown) => {
                    if (typeof entry !== 'string') return entry;
                    const child = byKey.get(childKey(row._key, collection, entry));
                    if (!child) throw new Error(`${id}: missing ${collection} ${entry} of ${row._key}`);
                    return assemble(child);
                });
            }
            delete doc._key;
            return doc;
        };
        result[id] = rows.filter(row => /^!(items|actors|tables)!/.test(row._key)).map(assemble);
    }
    return result;
}
