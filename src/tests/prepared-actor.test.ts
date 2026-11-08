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
    };

    const prepared = new ShadowdarkAdapter().prepareActorData(source as unknown as FoundryActor, context);

    assert.equal(prepared._id, 'crawler');
    assert.equal(prepared.id, 'crawler');
    assert.equal(prepared.derived.ac, 12);
    assert.equal(prepared.derived.maxSlots, 12);
    assert.equal((prepared.computed as Record<string, unknown>).ac, 12);
    assert.deepEqual(prepared.categorizedItems?.all, []);
    assert.equal(source.system.abilities.dex.base, 14);
    assert.equal(new ShadowdarkAdapter().getInitiativeFormula(prepared), '1d20+2');
    assert.deepEqual(prepared.derived.initiative, { value: 2, advantage: 0 });

    // Dashboard realtime refresh replaces only card data, retaining the original
    // list Actor. HP/AC must therefore be complete in every card projection.
    const cardAdapter = new ShadowdarkAdapter();
    const initialCard = cardAdapter.getActorCardData(prepared);
    assert.deepEqual(initialCard.blocks, [
        { title: 'HP', value: 4, subValue: '/ 6', valueClass: 'sd-ui-success' },
        { title: 'AC', value: 12 },
    ]);
    const changed = structuredClone(source);
    changed.system.attributes.hp = { value: 0, max: 8 };
    changed.system.abilities.dex.base = 18;
    const refreshedCard = cardAdapter.getActorCardData(cardAdapter.prepareActorData(changed as unknown as FoundryActor, context));
    assert.deepEqual(refreshedCard.blocks, [
        { title: 'HP', value: 0, subValue: '/ 8', valueClass: 'sd-ui-success' },
        { title: 'AC', value: 14 },
    ], 'card-only refresh must carry HP (including zero), max HP and prepared AC');
    assert.equal((prepared.derived.hp as { value: number }).value, 4, 'original list snapshot stays unchanged');

    const combatStats = manifest.info.combatTracking?.attributes ?? [];
    const readPath = (path: string): unknown => path.split('.').reduce<unknown>((value, key) =>
        value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, prepared);
    assert.deepEqual(readPath(combatStats[0].path), { value: 4, max: 6 });
    assert.equal(readPath(combatStats[1].path), 12);
    assert.equal(readPath(combatStats[2].path), 1);
    for (const stat of combatStats.slice(3).filter(entry => entry.kind === 'number')) {
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
    assert.deepEqual(npc.system.attributes, { ac: { value: 14 }, hp: { value: 11, max: 11 } });
    assert.deepEqual(npc.system.level, { value: 2 });
    assert.equal(new ShadowdarkAdapter().getInitiativeFormula(npc), '1d20+1',
        'NPC explicit DEX modifier must not become a computed Player score');
    const adapter = new ShadowdarkAdapter();
    const initiativeCases = [
        { score: 14, bonus: 3, advantage: 1, expected: '2d20kh1+5' },
        { score: 8, bonus: 0, advantage: -1, expected: '2d20kl1-1' },
        { score: 10, bonus: 0, advantage: 0, expected: '1d20+0' },
        { score: 10, bonus: 0, advantage: 1, expected: '2d20kh1+0' },
        { score: 10, bonus: 0, advantage: -1, expected: '2d20kl1+0' },
        { score: 0, bonus: 0, advantage: 0, expected: '1d20-4' },
        { score: 24, bonus: 0, advantage: 0, expected: '1d20+4' },
    ];
    for (const test of initiativeCases) {
        const current = structuredClone(source) as any;
        current.system.abilities.dex = { value: test.score, mod: 99 };
        current.system.roll = { initiative: { bonus: test.bonus, advantage: test.advantage } };
        const before = structuredClone(current);
        assert.equal(adapter.getInitiativeFormula(adapter.prepareActorData(current, context)), test.expected);
        assert.deepEqual(current, before, 'initiative preparation must not mutate source data');
    }
    const affected = structuredClone(source) as any;
    affected.system.abilities.dex = { value: 14 };
    affected.system.roll = { initiative: { bonus: 1, advantage: 0 } };
    affected.effects = [{ disabled: false, changes: [
        { key: 'system.abilities.dex.value', mode: 2, value: '2' },
        { key: 'system.roll.initiative.bonus', mode: 2, value: '2' },
        { key: 'system.roll.initiative.advantage', mode: 2, value: '1' },
    ] }, { disabled: true, changes: [{ key: 'system.roll.initiative.bonus', mode: 2, value: '100' }] }];
    assert.equal(adapter.getInitiativeFormula(adapter.prepareActorData(affected, context)), '2d20kh1+6');
    assert.equal(affected.system.roll.initiative.bonus, 1);
    // Native 4.0.6 PlayerSD has no `system.bonuses` field (Update_251001_1 migrated
    // `bonuses.advantage: initiative` to `system.roll.initiative.advantage`), so a
    // stale pre-4.0 array is ignored exactly as natively; only roll data counts.
    const legacy = structuredClone(source) as any;
    legacy.system.bonuses = { advantage: ['initiative'] };
    assert.equal(adapter.getInitiativeFormula(adapter.prepareActorData(legacy, context)), '1d20+2');
    legacy.system.roll = { initiative: { advantage: 1, bonus: 0 } };
    assert.equal(adapter.getInitiativeFormula(adapter.prepareActorData(legacy, context)), '2d20kh1+2',
        'native roll.initiative.advantage applies');
    const bonusNpc = { ...npc, system: { ...npc.system, roll: { initiative: { bonus: 2, advantage: -1 } } },
        computed: {}, derived: {} } as unknown as FoundryActor;
    assert.equal(adapter.getInitiativeFormula(adapter.prepareActorData(bonusNpc, context)), '2d20kl1+3');

    console.log('shadowdark prepared Actor parity: PASS');
}

if (import.meta.url === `file://${process.argv[1]}`) run();
