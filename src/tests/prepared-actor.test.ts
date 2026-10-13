import { strict as assert } from 'node:assert';
import type { ActorPreparationContext, FoundryActor } from '@sheet-delver/sdk';
import { ShadowdarkAdapter } from '../server/ShadowdarkAdapter';
import manifest from '../../module/ui';

const context: Readonly<ActorPreparationContext> = Object.freeze({
    worldEpoch: 1,
    sourceRevision: 9,
    systemId: 'shadowdark',
    systemVersion: '4.0.6',
    moduleId: 'shadowdark',
    moduleVersion: '0.6.1',
});

export function run(): void {
    const source = {
        _id: 'crawler',
        name: 'Prepared Crawler',
        type: 'Player',
        img: 'icons/crawler.webp',
        systemId: 'shadowdark',
        system: {
            abilities: {
                str: { base: 12, bonus: 0 },
                dex: { base: 14, bonus: 0, mod: 2 },
                con: { base: 10, bonus: 0 },
                int: { base: 9, bonus: 0 },
                wis: { base: 11, bonus: 0 },
                cha: { base: 8, bonus: 0 },
            },
            attributes: { hp: { value: 4, max: 6 } },
            level: { value: 1, xp: 0, xp_max: 10 },
            coins: { gp: 20, sp: 0, cp: 0 },
            languages: [],
            alignment: 'neutral',
        },
        items: [],
        effects: [],
    } as unknown as FoundryActor;

    const prepared = new ShadowdarkAdapter().prepareActorData(source, context);

    assert.equal(prepared._id, 'crawler');
    assert.equal(prepared.id, 'crawler');
    assert.equal(prepared.derived.ac, 12);
    assert.equal(prepared.derived.maxSlots, 12);
    assert.equal((prepared.computed as Record<string, unknown>).ac, 12);
    assert.deepEqual(prepared.categorizedItems?.all, []);
    assert.equal(source.system.abilities.dex.base, 14);

    const combatStats = manifest.info.combatTracking?.attributes ?? [];
    const readPath = (path: string): unknown => path.split('.').reduce<unknown>((value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, prepared);
    assert.equal(readPath(combatStats[0].path), prepared.system.attributes.hp);
    assert.equal(readPath(combatStats[1].path), 12);
    assert.equal(readPath(combatStats[2].path), 1);
    for (const stat of combatStats.slice(3)) {
        assert.equal(stat.actorTypes?.includes('Player'), true);
        assert.equal(typeof readPath(stat.path), 'number', `${stat.key} must exist on prepared Players`);
    }

    // The official Lizardfolk NPC source has AC 14 and DEX +1. Its explicit
    // monster AC must survive preparation; 10 + DEX would incorrectly be 11.
    const npc = new ShadowdarkAdapter().prepareActorData({
        _id: 'lizardfolk', name: 'Lizardfolk', type: 'NPC', systemId: 'shadowdark',
        img: 'icons/lizardfolk.webp', items: [], effects: [],
        system: { abilities: { dex: { mod: 1 } }, attributes: {
            ac: { value: 14 }, hp: { value: 11, max: 11 },
        }, level: { value: 2 } },
    } as unknown as FoundryActor, context);
    assert.equal(npc.derived.ac, 14);
    assert.equal(npc.system.attributes.hp.value, 11);
    assert.equal(npc.system.level.value, 2);

    console.log('shadowdark prepared Actor parity: PASS');
}

if (import.meta.url === `file://${process.argv[1]}`) run();
