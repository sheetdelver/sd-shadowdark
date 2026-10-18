/**
 * Shadowdark world fixtures for the isolated released Core host harness (ADR-0001).
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

const LEGACY: Array<[string, (weapon: boolean) => string]> = [
    ['system.bonuses.acBonus', () => 'system.attributes.ac.value'],
    ['system.bonuses.gearSlots', () => 'system.slots'],
    ['system.attributes.hp.bonus', () => 'system.attributes.hp.max'],
    ['system.abilities.str.bonus', () => 'system.abilities.str.value'],
    ['system.bonuses.meleeAttackBonus', weapon => weapon ? 'system.roll.melee.bonus.this' : 'system.roll.melee.bonus.all'],
];

export interface Inventory {
    actors: Doc[]; items: Doc[]; scenes: Doc[];
    worldPacks: Record<string, Doc[]>;
    worldPackMetadata: Doc[];
    /** Effects the hooks must change, by canonical UUID. */
    expectedOperations: string[];
}

/**
 * @param generation 13 stores effect changes as `changes` (mode); 14 as `system.changes` (type/phase).
 * @param current    true writes the native 4.0 keys already (a no-op world).
 */
export function shadowdarkInventory(players: number, itemsPerActor: number, generation: 13 | 14, current = false) {
    const operations: string[] = [];
    let counter = 0;
    /** One effect; `migrates` decides whether the oracle rewrites it. */
    const effect = (id: string, key: string, weapon: boolean, migrates: boolean, uuid: string, extra: Doc = {}) => {
        const index = counter++;
        const target = LEGACY.find(([from]) => from === key)?.[1](weapon) ?? key;
        const legacyKey = current ? target : key;
        const unrelated = generation === 14
            ? { key: 'system.roll.ranged.bonus.all', type: 'add', value: '1', phase: 'initial', priority: null, note: `keep-${index}` }
            : { key: 'system.roll.ranged.bonus.all', mode: 2, value: '1', priority: null, note: `keep-${index}` };
        const change = (k: string) => generation === 14
            ? { key: k, type: 'add', value: String(1 + index % 3), phase: 'initial', priority: 20 + index % 5, extraField: index }
            : { key: k, mode: 2, value: String(1 + index % 3), priority: 20 + index % 5, extraField: index };
        const doc: Doc = { _id: id, name: `Effect ${id}`, img: 'icons/svg/aura.svg', disabled: index % 7 === 0, transfer: true, origin: null,
            flags: { fixture: { order: index } }, duration: { rounds: null }, description: '', statuses: [], ...extra };
        const changes = [unrelated, change(legacyKey), { ...unrelated, note: `tail-${index}` }];
        if (generation === 14) doc.system = { changes }; else doc.changes = changes;
        const after = structuredClone(doc);
        if (migrates && !current && key !== target) {
            (generation === 14 ? after.system.changes : after.changes)[1].key = target;
            operations.push(uuid);
        }
        return { doc, after };
    };
    const pair = <T>(make: (side: 'before' | 'after') => T) => ({ before: make('before'), after: make('after') });

    /** Builds an Item with optional effects; returns before/after documents. */
    const item = (uuid: string, id: string, type: string, legacyKey: string | null, extra: Doc = {}) => {
        const weapon = type === 'Weapon';
        const effects = legacyKey ? [effect(`${id}e`, legacyKey, weapon, true, `${uuid}.ActiveEffect.${id}e`)] : [];
        const base = (side: 'before' | 'after') => ({ _id: id, name: `${type} ${id}`, type, img: 'icons/svg/item-bag.svg', folder: null, sort: counter,
            system: type === 'Weapon'
                ? { type: 'melee', range: 'close', damage: { oneHanded: 'd6', twoHanded: '' }, properties: [], equipped: false, quantity: 1,
                    slots: { free_carry: 0, per_slot: 1, slots_used: 1 }, description: '<p>Fixture weapon.</p>', unknownSystem: { keep: null } }
                : { description: `<p>${type} fixture.</p>`, quantity: 1, slots: { free_carry: 0, per_slot: 1, slots_used: 1 } },
            effects: effects.map(row => side === 'before' ? row.doc : row.after), flags: { fixture: { item: id } }, ...extra });
        return pair(base);
    };

    const actors = pair(() => [] as Doc[]);
    const roll = <T>(target: { before: T[]; after: T[] }, value: { before: T; after: T }) => { target.before.push(value.before); target.after.push(value.after); };
    const actorCount = Math.max(players * 2, 2);
    for (let a = 0; a < actorCount; a++) {
        const type = a % 2 ? 'NPC' : 'Player';
        const id = `a${a}`;
        const uuid = `Actor.${id}`;
        const itemPairs = Array.from({ length: itemsPerActor }, (_, i) => {
            const itemType = ['Weapon', 'Talent', 'Armor', 'Basic'][i % 4];
            const legacy = i % 4 === 0 ? 'system.bonuses.meleeAttackBonus' : i % 4 === 1 ? 'system.bonuses.acBonus' : null;
            return item(`${uuid}.Item.i${a}x${i}`, `i${a}x${i}`, itemType, legacy);
        });
        const actorEffects = [
            effect(`e${a}x0`, 'system.attributes.hp.bonus', false, type === 'Player', `${uuid}.ActiveEffect.e${a}x0`),
            effect(`e${a}x1`, 'system.abilities.str.bonus', false, type === 'Player', `${uuid}.ActiveEffect.e${a}x1`),
        ];
        const system = type === 'Player'
            ? { abilities: { str: { base: 10, bonus: 0 }, dex: { base: 12, bonus: 0 }, con: { base: 11, bonus: 0 }, int: { base: 9, bonus: 0 }, wis: { base: 13, bonus: 0 }, cha: { base: 8, bonus: 0 } },
                attributes: { hp: { value: 6, max: 6, base: 6, bonus: 0 }, ac: { value: 11 } }, level: { value: 1, xp: 0 }, luck: { available: true, remaining: 2 },
                coins: { gp: 5, sp: 0, cp: 0 }, alignment: 'neutral', class: '', ancestry: '', background: '', deity: '', languages: [], slots: 10,
                notes: '<p>Fixture notes.</p>', unknownSystem: { keep: true } }
            : { abilities: { str: { mod: 1 }, dex: { mod: 0 }, con: { mod: 1 }, int: { mod: -1 }, wis: { mod: 0 }, cha: { mod: 0 } },
                attributes: { hp: { value: 9, max: 9 }, ac: { value: 12 } }, level: { value: 2 }, alignment: 'chaotic', move: 'near', notes: '' };
        const make = (side: 'before' | 'after') => ({ _id: id, name: `${type} ${a}`, type, img: 'icons/svg/mystery-man.svg', folder: null, sort: a,
            ownership: { default: 0, service: 3, ...(a === 0 ? { player: 3 } : {}) }, system: structuredClone(system),
            prototypeToken: { actorLink: type === 'Player', name: `${type} ${a}` },
            items: itemPairs.map(row => row[side]), effects: actorEffects.map(row => side === 'before' ? row.doc : row.after),
            flags: { fixture: { actor: a } }, _stats: { systemId: 'shadowdark', systemVersion: '4.0.6' } });
        roll(actors, pair(make));
    }
    const items = pair(() => [] as Doc[]);
    roll(items, item('Item.looseWeapon', 'looseWeapon', 'Weapon', 'system.bonuses.meleeAttackBonus'));
    roll(items, item('Item.looseTalent', 'looseTalent', 'Talent', 'system.bonuses.gearSlots'));
    roll(items, item('Item.plainGear', 'plainGear', 'Basic', null));

    // Unlinked tokens. A delta stores only overrides; a delta Item is a complete Item.
    const deltaUuid = 'Scene.scene.Token.owned.ActorDelta.delta';
    const deltaWeapon = item(`${deltaUuid}.Item.deltaWeapon`, 'deltaWeapon', 'Weapon', 'system.bonuses.meleeAttackBonus');
    const deltaTalent = item(`${deltaUuid}.Item.i0x1`, 'i0x1', 'Talent', 'system.bonuses.acBonus');
    const deltaEffect = effect('deltaEffect', 'system.bonuses.acBonus', false, true, `${deltaUuid}.ActiveEffect.deltaEffect`);
    const npcDeltaUuid = 'Scene.scene.Token.npcToken.ActorDelta.npcDelta';
    const npcDeltaEffect = effect('npcDeltaEffect', 'system.bonuses.acBonus', false, false, `${npcDeltaUuid}.ActiveEffect.npcDeltaEffect`);
    const npcDeltaItem = item(`${npcDeltaUuid}.Item.claw`, 'claw', 'NPC Feature', 'system.bonuses.gearSlots');
    const scene = (side: 'before' | 'after') => ({ _id: 'scene', name: 'Fixture scene', active: true, tokens: [
        { _id: 'owned', name: 'Owned token', actorId: 'a0', actorLink: false, x: 0, y: 0, delta: { _id: 'delta', type: null, name: null,
            system: { attributes: { hp: { value: 3 } } },
            items: [deltaWeapon[side], deltaTalent[side], { _id: 'i0x2', _tombstone: true }],
            effects: [side === 'before' ? deltaEffect.doc : deltaEffect.after, { _id: 'e0x0', _tombstone: true }], flags: { fixture: { delta: true } } } },
        { _id: 'lazy', name: 'Lazy token', actorId: 'a0', actorLink: false, x: 100, y: 0, delta: null },
        { _id: 'linked', name: 'Linked token', actorId: 'a0', actorLink: true, x: 200, y: 0, delta: null },
        { _id: 'actorless', name: 'Decoration', actorId: null, actorLink: false, x: 300, y: 0, delta: null },
        { _id: 'npcToken', name: 'NPC token', actorId: 'a1', actorLink: false, x: 400, y: 0, delta: { _id: 'npcDelta',
            items: [npcDeltaItem[side]], effects: [side === 'before' ? npcDeltaEffect.doc : npcDeltaEffect.after] } },
    ], flags: {} });
    const scenes = pair(side => [scene(side)]);

    // Two eligible world packs and one module-owned pack, which remains excluded.
    const heroUuid = 'Compendium.world.heroes.Actor.hero';
    const heroItem = item(`${heroUuid}.Item.heroBlade`, 'heroBlade', 'Weapon', 'system.bonuses.meleeAttackBonus');
    const heroEffect = effect('heroEffect', 'system.attributes.hp.bonus', false, true, `${heroUuid}.ActiveEffect.heroEffect`);
    const armory = item('Compendium.world.armory.Item.blade', 'blade', 'Weapon', 'system.bonuses.meleeAttackBonus');
    const before = { lockedOps: operations.length };
    const vault = item('Compendium.world.vault.Item.relic', 'relic', 'Talent', 'system.bonuses.acBonus');
    operations.splice(before.lockedOps);
    const worldPacks = pair(side => ({
        'world.heroes': [{ _id: 'hero', name: 'Pack hero', type: 'Player', img: '', system: { attributes: { hp: { value: 4, max: 4 } } },
            items: [heroItem[side]], effects: [side === 'before' ? heroEffect.doc : heroEffect.after], flags: {} }],
        'world.armory': [armory[side]],
        'fixture.vault': [side === 'before' ? vault.before : structuredClone(vault.before)], // separate oracle object
    }));
    const worldPackMetadata = [
        { id: 'world.heroes', name: 'heroes', label: 'Heroes', type: 'Actor', packageType: 'world', packageName: 'w1', locked: false, ownership: { PLAYER: 'OBSERVER', ASSISTANT: 'OWNER' } },
        { id: 'world.armory', name: 'armory', label: 'Armory', type: 'Item', packageType: 'world', packageName: 'w1', locked: false, ownership: { PLAYER: 'OBSERVER', ASSISTANT: 'OWNER' } },
        { id: 'fixture.vault', name: 'vault', label: 'Vault', type: 'Item', packageType: 'module', packageName: 'fixture', locked: false, ownership: { PLAYER: 'NONE', ASSISTANT: 'OWNER' } },
    ];
    const world: Inventory = { actors: actors.before, items: items.before, scenes: scenes.before, worldPacks: worldPacks.before,
        worldPackMetadata, expectedOperations: [...new Set(operations)].sort() };
    const expected = { actors: actors.after, items: items.after, scenes: scenes.after, worldPacks: worldPacks.after };
    return { world, expected };
}

/** Two sources the required step must refuse, with their actionable reasons. */
export function unresolvedSources(inventory: Inventory, generation: 13 | 14) {
    const player = inventory.actors[0];
    const bogus = { _id: 'bogusAdvantage', name: 'Spell focus', disabled: false, flags: {},
        ...(generation === 14 ? { system: { changes: [{ key: 'system.bonuses.advantage', type: 'add', value: 'Bogus Spell', phase: 'initial', priority: null }] } }
            : { changes: [{ key: 'system.bonuses.advantage', mode: 2, value: 'Bogus Spell', priority: null }] }) };
    player.effects.push(bogus);
    const delta = inventory.scenes[0].tokens[0].delta;
    const typeless = { _id: 'typeless', name: 'Broken delta Item', system: {}, effects: [{ _id: 'typelessEffect', name: 'Legacy',
        ...(generation === 14 ? { system: { changes: [{ key: 'system.bonuses.acBonus', type: 'add', value: '1', phase: 'initial', priority: null }] } }
            : { changes: [{ key: 'system.bonuses.acBonus', mode: 2, value: '1', priority: null }] }) }] };
    delta.items.push(typeless);
    return {
        uuids: ['Actor.a0.ActiveEffect.bogusAdvantage', 'Scene.scene.Token.owned.ActorDelta.delta.Item.typeless.ActiveEffect.typelessEffect'],
        /** The admin's Foundry repairs: delete both broken sources. */
        repairs: [
            { type: 'ActiveEffect', ids: ['bogusAdvantage'], operation: { parentUuid: 'Actor.a0' } },
            { type: 'Item', ids: ['typeless'], operation: { parentUuid: 'Scene.scene.Token.owned.ActorDelta.delta' } },
        ],
    };
}
