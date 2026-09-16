import { strict as assert } from 'node:assert';
import type { ActorPreparationContext, FoundryActor } from '@sheet-delver/sdk';
import { ShadowdarkAdapter } from '../server/ShadowdarkAdapter';

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

    console.log('shadowdark prepared Actor parity: PASS');
}

if (import.meta.url === `file://${process.argv[1]}`) run();
