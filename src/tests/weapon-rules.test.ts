import assert from 'node:assert/strict';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MockSDKProvider } from '@sheet-delver/sdk/testing';
import { prepareWeaponBase, prepareWeaponAttack, numericWeaponEffect } from '../logic/weapon-rules';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { applyMasteryChoice, assertResolvedTalentChoices, choiceCatalog } from '../logic/talent-choices';
import { enrichItem } from '../logic/actor-enricher';
import { assembleFinalItems } from '../server/api/level-up-engine';
import { shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { ShadowdarkUIProvider } from '../ui/context/ShadowdarkUIContext';
import { ShadowdarkActorProvider, useShadowdarkActor } from '../ui/context/ShadowdarkActorContext';
import { ItemRow } from '../ui/InventoryComponents';
import { CardBody } from '../ui/components/ResourceDetailModal';
import ItemStateControls from '../ui/components/ItemStateControls';
import { buildOwnedItemCard } from '../logic/resource-cards';
import AbilitiesTab from '../ui/AbilitiesTab';
import ShadowdarkPaperSheet from '../ui/ShadowdarkPaperSheet';
import { ShadowdarkNormalizer } from '../logic/normalization';
import { damageCases, damageFixture, propertyNames } from './fixtures/weapon-cases';
import { applyItemDataOverrides } from '../server/api/item-properties';
import { handleFinalizeLevelUp } from '../server/api/level-up';

void React;

// Native 4.0.6: WeaponSD, PlayerSD._calcAttackMainConfig/_calcDamageConfig,
// _ActorBaseSD._getActiveEffectKeys and the core Weapon Mastery template.
// ADR-0001 changes from the ADR-0063 fixtures: Player weapons have no
// `system.bonuses` (native magic bonuses are `.this` effects), mastery choices
// are found by the native effect name, and choices come from declared base items.
const nameIndex = { 'Compendium.shadowdark.properties.Item.fin': 'Finesse',
    'Compendium.shadowdark.properties.Item.throw': 'Thrown',
    'Compendium.shadowdark.properties.Item.two': 'Two-Handed',
    'Compendium.shadowdark.properties.Item.vers': 'Versatile' };
// STR 9 (-1), DEX 16 (+3), level 4.
const actor = { type: 'Player', system: { level: { value: 4 }, abilities: { str: { value: 9 }, dex: { value: 16 } } }, items: [], effects: [] };
const weapon = (name: string, system: any = {}, effects: any[] = []) => ({ _id: name, name, type: 'Weapon', effects, system: {
    equipped: true, type: 'melee', damage: { oneHanded: 'd8', twoHanded: 'd10' }, properties: [], ...system,
} });
const attack = (who: any, item: any, options: any = {}) => prepareWeaponAttack(who, item, options, nameIndex);
const catalog = choiceCatalog([
    ...['Longsword', 'Dagger'].map(name => ({ name, type: 'Weapon', system: { baseWeapon: '', magicItem: false } })),
    ...['Leather', 'Shield'].map(name => ({ name, type: 'Armor', system: { baseArmor: '', magicItem: false } })),
]);
const view = (who: any) => prepareShadowdarkView(who, { propertyName: uuid => (nameIndex as Record<string, string>)[uuid] ?? null });

async function masteryAssemblyRegression() {
    const resolve = shadowdarkAdapter.resolveDocument;
    const catalogFn = shadowdarkAdapter.getChoiceCatalog;
    const templates = ['Weapon', 'Armor'].map(kind => ({ name: `${kind} Mastery`, type: 'Talent',
        uuid: `Compendium.shadowdark.talents.Item.${kind.toLowerCase()}`, system: {}, effects: [{ name: `${kind} Mastery`, changes: [
            { key: `system.roll.melee.bonus.REPLACEME`, mode: 2, value: '1+floor(@level.value/2)' },
        ] }] }));
    const original = JSON.stringify(templates);
    shadowdarkAdapter.resolveDocument = async uuid => structuredClone(templates.find(item => item.uuid === uuid) ?? null);
    shadowdarkAdapter.getChoiceCatalog = async () => catalog;
    const state = (kind: string, choices: string[], rolled: any[]) => ({ rolledTalents: rolled, rolledBoons: [],
        selectedSpells: [], selectedLanguages: [], statSelection: { selected: [] }, statPool: {},
        extraSpellSelection: { selected: [] }, weaponMasterySelection: { required: 0, selected: [] },
        armorMasterySelection: { required: 0, selected: [] },
        [`${kind}MasterySelection`]: { required: choices.length, selected: choices } } as any);
    try {
        for (const template of templates) {
            const kind = template.name.startsWith('Weapon') ? 'weapon' : 'armor';
            const choices = kind === 'weapon' ? ['Longsword', 'Dagger'] : ['Leather', 'Shield'];
            const fixed = { name: 'Fixed class', type: 'Class', uuid: 'Class.fixed', system: { talents: [template.uuid] } };
            const repeated = await assembleFinalItems(state(kind, choices, [template, template]), 3, { system: {} });
            assert.deepEqual(repeated.map(item => item.name), choices.map(choice => `${template.name} (${choice})`),
                'repeated rolled templates are independent grants, not UUID duplicates');
            assert.ok(repeated.every(item => item._stats?.compendiumSource === template.uuid), 'created copies record their exact source');
            const combined = await assembleFinalItems(state(kind, choices, [template]), 1, fixed);
            assert.equal(combined.filter(item => item.name.startsWith(template.name)).length, 2,
                'fixed and rolled mastery grants must both survive');
            const context = { addedSourceIds: new Set<string>(), addedNames: new Set<string>(), targetLevel: 1, actor: null, choices: catalog };
            const generatorItems = (await Promise.all(combined.map(item => enrichItem(item, context)))).filter(Boolean);
            assert.equal(generatorItems.filter(item => item.name.startsWith(template.name)).length, 2,
                'generator enrichment must retain both already-resolved selections');
            const ancestry = { name: 'Independent ancestry', type: 'Ancestry', system: { talents: [template.uuid] } };
            const fixedGrants = await assembleFinalItems(state(kind, choices, []), 1, fixed, ancestry);
            assert.equal(fixedGrants.filter(item => item.name.startsWith(template.name)).length, 2,
                'independent class and ancestry grants are not fixed-reference aliases');
            await assert.rejects(() => assembleFinalItems(state(kind, [choices[0]], [template]), 1, fixed),
                /choice|selection/i, 'one selection cannot satisfy two independent grants');
            const aliases = { ...fixed, system: { talents: [template.uuid], abilities: [template.uuid] } };
            const deduped = await assembleFinalItems(state(kind, [choices[0]], []), 1, aliases);
            assert.equal(deduped.filter(item => item.name.startsWith(template.name)).length, 1,
                'two references to one fixed grant are an actual duplicate');
            await assert.rejects(() => assembleFinalItems(state(kind, choices, []), 1, fixed), /choice|selection/i,
                'extra selections must not be silently ignored');
            await assert.rejects(() => assembleFinalItems(state(kind, [], [template]), 3, { system: {} }), /choice|selection/i);
            const existing = { _id: 'existing', system: { level: { value: 2 } }, items: [{ name: 'Existing talent' }] };
            const prior = structuredClone(existing);
            const writes: string[] = [];
            await handleFinalizeLevelUp('existing', { json: async () => ({ ...state(kind, [], [template]), targetLevel: 3 }),
                runtime: { documents: { get: async () => existing, patch: async () => writes.push('Actor'),
                    items: { create: async () => writes.push('Item') } } } } as any);
            assert.deepEqual(writes, [], 'invalid/cancelled choices fail before Actor or Item writes');
            assert.deepEqual(existing, prior, 'rejected advancement preserves the existing Actor');
            const reselected = await assembleFinalItems(state(kind, [choices[1]], [template]), 3, { system: {} });
            assert.equal(reselected[0].name, `${template.name} (${choices[1]})`, 'a cancelled choice does not leak into a later attempt');
        }
    } finally {
        shadowdarkAdapter.resolveDocument = resolve;
        shadowdarkAdapter.getChoiceCatalog = catalogFn;
    }
    assert.equal(JSON.stringify(templates), original, 'assembly never mutates cached templates');
}

function damageOrderingRegression() {
    const item = weapon('Ordered sword');
    const changes = [{ key: 'system.roll.melee.damage', mode: 2, value: 3 },
        { key: 'system.roll.melee.damage', mode: 1, value: 2 }];
    for (const ordered of [changes, [...changes].reverse()]) {
        for (const distribute of ['same-effect', 'effects', 'items']) {
            const fixture = { ...actor, items: distribute === 'items' ? ordered.map((change, index) => ({
                type: 'Talent', name: `Grant ${index}`, effects: [{ changes: [change] }],
            })) : [], effects: distribute === 'same-effect' ? [{ changes: ordered }]
                : distribute === 'effects' ? ordered.map(change => ({ changes: [change] })) : [] };
            assert.equal(attack(fixture, item).damage, '(d8+3)*2');
        }
    }
    const override = { key: 'system.roll.melee.damage', mode: 5, value: 7 };
    const permutations = <T,>(values: T[]): T[][] => values.length ? values.flatMap((value, index) =>
        permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest])) : [[]];
    for (const ordered of permutations([override, ...changes])) {
        assert.equal(attack({ ...actor, items: ordered.map(change => ({ effects: [{ changes: [change] }] })) }, item).damage, '7');
    }
    const more = [...changes, { ...changes[0], value: 2 }, { ...changes[1], value: 3 }];
    for (const ordered of permutations(more)) assert.equal(attack({ ...actor, effects: [{ changes: ordered }] }, item).damage, '(d8+5)*6');
    assert.equal(attack({ ...actor, effects: [{ changes: [{ ...override, value: 0 }, ...changes, override] }] }, item).damage, '7', 'last OVERRIDE wins');
    assert.equal(attack({ ...actor, effects: [{ changes: [override, ...changes, { ...override, value: 0 }] }] }, item).damage, '0');
}

/** The owned-item card as ResourceDetailModal composes it: card body plus item controls. */
function ItemCard({ item }: { item: any }) {
    const { actor } = useShadowdarkActor();
    const itemId = String(item._id ?? item.id);
    const card = buildOwnedItemCard(actor.derived, actor.items.find((entry: any) => String(entry._id ?? entry.id) === itemId));
    return createElement('div', null, card && createElement(CardBody, { card }), createElement(ItemStateControls, { itemId }));
}

function renderWeaponConsumer(component: any, props: any, fixture: any) {
    const noop = async () => {};
    return renderToStaticMarkup(createElement(MockSDKProvider, null,
        createElement(ShadowdarkUIProvider, null, createElement(ShadowdarkActorProvider, {
            children: createElement(component, props),
            actor: fixture, onUpdate: noop, onDeleteItem: noop, onCreateItem: noop, onUpdateItem: noop,
            onRoll: noop, onToggleEffect: noop, onDeleteEffect: noop, onCreateEffect: noop,
            onUpdateEffect: noop, onRefresh: noop,
        } as any))));
}

function inventoryDamageRegression() {
    for (const test of damageCases) {
        const source = damageFixture(test);
        const prior = structuredClone(source);
        const fixture: any = ShadowdarkNormalizer.normalizeActorData(structuredClone(source), { nameIndex: propertyNames });
        const item = fixture.items![0];
        assert.deepEqual(item.system.damage, source.items[0].system.damage, 'normalization must not lose source damage');
        const prepared = prepareWeaponAttack(fixture, item, {}, propertyNames);
        assert.equal(prepareWeaponBase(item, {}, propertyNames).damage, test.base, test.name);
        assert.equal(prepared.damage, test.adjusted, test.name);
        assert.equal(prepared.handedness, test.hands, test.name);
        assert.equal(prepared.toHit, test.toHit, test.name);
        const expected = test.adjusted ?? 'Damage unavailable';
        const summary = [...fixture.derived!.attacks.melee, ...fixture.derived!.attacks.ranged][0];
        assert.equal(summary.derived.damage, expected, test.name);
        assert.equal(shadowdarkAdapter.getRollData(fixture as any, 'item', item.id ?? item._id)?.formula, `1d20+${test.toHit}`);
        for (const [component, props] of [[ItemRow, { item, expandedItems: new Set([item._id]), toggleItem() {} }],
            [ItemCard, { item }], [AbilitiesTab, {}], [ShadowdarkPaperSheet, { onToggleView() {} }]] as const) {
            const html = renderWeaponConsumer(component, props, fixture);
            assert.ok(html.includes(expected), `${component.name} must display ${expected} for ${test.name}`);
            if (component === ItemRow && item.type === 'Weapon') {
                assert.match(html, /data-weapon-damage="base"/);
                assert.match(html, /data-weapon-damage="actor"/);
                assert.ok(html.includes(test.base ?? 'Damage unavailable'));
            }
            if (component === ItemCard && item.type === 'Weapon') {
                assert.match(html, /Base damage/);
                assert.ok(html.includes(test.base ?? 'Damage unavailable'));
                assert.match(html, /aria-label="(Un)?[Ee]quip /, 'the card keeps the equip control');
                assert.match(html, /aria-label="(Stash|Retrieve) /, 'the card keeps the stash control');
            }
            if (!test.base && component !== ShadowdarkPaperSheet) assert.match(html, /Damage unavailable: system\.damage\./, 'missing source has a useful field diagnostic');
        }
        assert.deepEqual(source, prior);
    }
    const staff = weapon('Staff', { damage: { twoHanded: 'd4' }, properties: ['Compendium.shadowdark.properties.Item.two'] });
    const original = structuredClone(staff.system);
    applyItemDataOverrides(staff);
    assert.deepEqual(staff.system, original, 'legacy name-specific overrides cannot rewrite authoritative damage/properties');
}

export async function run() {
    const longsword = weapon('Longsword', { damage: { oneHanded: 'd8', twoHanded: '' } });
    const prim = { ...actor, items: [longsword] };
    assert.equal(attack(prim, longsword).damage, 'd8');
    assert.equal(attack(prim, longsword).toHit, -1);
    const staff = weapon('Staff', { properties: ['Compendium.shadowdark.properties.Item.two'], damage: { oneHanded: '', twoHanded: 'd4' } });
    const binx = { ...actor, system: { ...actor.system, abilities: { str: { value: 12 }, dex: { value: 10 } } }, items: [staff] };
    assert.equal(attack(binx, staff).damage, 'd4', 'STR never adds to weapon damage by default');
    assert.equal(attack(binx, staff).handedness, '2h');
    const dagger = weapon('Dagger', { range: 'near', properties: ['Compendium.shadowdark.properties.Item.fin', 'Compendium.shadowdark.properties.Item.throw'] });
    assert.equal(attack(actor, dagger).abilityBonus, 3);
    const javelin = weapon('Javelin', { range: 'near', properties: ['Compendium.shadowdark.properties.Item.throw'] });
    const summary = view({ ...actor, items: [javelin] }).attacks;
    assert.equal(summary.melee[0].derived.toHit, '-1');
    assert.equal(summary.ranged[0].derived.toHit, '+3', 'thrown rows use distinct native melee/ranged bonuses');
    assert.equal(attack(actor, weapon('Fake Finesse', { properties: ['Compendium.finesse.unknown'] })).abilityBonus, -1);
    assert.equal(attack(actor, weapon('Bow', { type: 'ranged' })).abilityBonus, 3);
    // WeaponSD.getDamageFormula: a Versatile weapon's two-handed grip uses damage.twoHanded.
    assert.equal(attack(actor, weapon('Bastard Sword', { properties: ['Compendium.shadowdark.properties.Item.vers'] }), { handedness: '2h' }).damage, 'd10');
    assert.equal(attack(actor, weapon('Longsword'), { handedness: '2h' }).damage, null, 'a grip the weapon does not offer is not rolled');
    assert.equal(attack(actor, weapon('Unresolved', { damage: {} })).damage, null);
    // NpcSD._generateAttackConfig: NPC Attack items carry their own bonus.
    const npcAttack = { _id: 'claw', name: 'Claw', type: 'NPC Attack', effects: [], system: { ranges: ['close'], bonuses: { attackBonus: 5 }, damage: { value: '1d6' } } };
    assert.equal(attack({ ...actor, type: 'NPC', items: [npcAttack] }, npcAttack).toHit, 5);
    assert.equal(numericWeaponEffect('1+floor(@level.value/2)', actor), 3);
    assert.equal(numericWeaponEffect('constructor(1)', actor), null);
    assert.equal(numericWeaponEffect('1/0', actor), null);
    // Native talent and its effect are both named "Weapon Mastery".
    const mastery = { _id: '5bpWuaT0KTNzuzCu', uuid: 'Compendium.shadowdark.talents.Item.5bpWuaT0KTNzuzCu',
        name: 'Weapon Mastery', type: 'Talent', system: {}, effects: [{ name: 'Weapon Mastery', transfer: true, changes: [
            { key: 'system.roll.melee.bonus.REPLACEME', mode: 2, value: '1+floor(@level.value/2)' },
            { key: 'system.roll.melee.damage.REPLACEME', mode: 2, value: '1+floor(@level.value/2)' },
        ] }] };
    const before = JSON.stringify(mastery);
    const selected = applyMasteryChoice(mastery, 'Longsword', 'weapon', catalog);
    assert.match(selected.effects[0].changes[0].key, /\.longsword$/);
    assert.equal(selected.effects[0].changes[0].value, '1+floor(@level.value/2)');
    const trained = { ...actor, items: [longsword, selected] };
    const normalized = attack(trained, longsword);
    assert.equal(normalized.toHit, 2);
    assert.equal(normalized.damage, 'd8+3');
    const ui = view(trained).attacks.melee[0].derived;
    assert.equal(ui.toHit, '+2'); assert.equal(ui.damage, normalized.damage);
    const server = shadowdarkAdapter.getRollData(trained as any, 'item', 'Longsword')!;
    assert.equal(server.formula, '1d20+2');
    const defaults = { abilityBonus: normalized.abilityBonus, itemBonus: normalized.itemBonus, talentBonus: normalized.talentBonus };
    assert.equal(shadowdarkAdapter.getRollData(trained as any, 'item', 'Longsword', defaults)?.formula, server.formula);
    assert.equal(shadowdarkAdapter.getRollData(trained as any, 'item', 'Longsword', { ...defaults, talentBonus: 0 })?.formula, '1d20-1');
    const enchanted = weapon('Sword', {}, [{ name: 'Enchantment', transfer: true, changes: [
        { key: 'system.roll.attack.bonus.this', mode: 2, value: '-2' }, { key: 'system.roll.attack.damage.this', mode: 2, value: '2' },
    ] }]);
    assert.equal(attack({ ...actor, items: [enchanted] }, enchanted).toHit, -3);
    assert.equal(attack({ ...actor, items: [enchanted] }, enchanted).damage, 'd8+2');
    assert.equal(attack({ ...actor, items: [enchanted] }, enchanted).itemBonus, -2, 'the weapon\'s own .this bonus is reported as its item bonus');
    assert.equal(attack({ ...trained, items: [longsword, { ...selected, effects: selected.effects.map((effect: any) => ({ ...effect, disabled: true })) }] }, longsword).toHit, -1);
    assert.throws(() => applyMasteryChoice(mastery, '../__proto__', 'weapon', catalog), /valid weapon/);
    assert.throws(() => applyMasteryChoice(mastery, 'Longsword', 'weapon', {}), /no weapon options/);
    assert.throws(() => assertResolvedTalentChoices([mastery]), /needs a choice/);
    const enriched = await enrichItem(mastery, { addedSourceIds: new Set(), addedNames: new Set(), targetLevel: 1, actor: null, bonusTo: 'Longsword', choices: catalog });
    assert.doesNotMatch(JSON.stringify(enriched), /REPLACEME/);
    const imported = { addedSourceIds: new Set<string>(), addedNames: new Set<string>(), targetLevel: 1, actor: null, choices: catalog,
        mapping: { bonus: { Plus1AttackAndDamagePlusHalfLevel: mastery.uuid } },
        bonuses: [{ bonusName: 'Plus1AttackAndDamagePlusHalfLevel', bonusTo: 'Longsword' }] };
    const fixedImported = await enrichItem(mastery, imported);
    assert.doesNotMatch(JSON.stringify(fixedImported), /REPLACEME/);
    assert.equal(await enrichItem(mastery, { ...imported, bonusTo: 'Longsword' }), null,
        'fixed class talent and explicit import bonus create one resolved Item');
    const multiple = { ...imported, addedSourceIds: new Set<string>(), addedNames: new Set<string>(),
        bonuses: [...imported.bonuses, { bonusName: 'Plus1AttackAndDamagePlusHalfLevel', bonusTo: 'Dagger' }] };
    assert.equal(await enrichItem(mastery, multiple), null);
    assert.ok(await enrichItem(mastery, { ...multiple, bonusTo: 'Longsword' }));
    assert.ok(await enrichItem(mastery, { ...multiple, bonusTo: 'Dagger' }));
    const resolve = shadowdarkAdapter.resolveDocument;
    const catalogFn = shadowdarkAdapter.getChoiceCatalog;
    shadowdarkAdapter.resolveDocument = async uuid => uuid === mastery.uuid ? structuredClone(mastery) : null;
    shadowdarkAdapter.getChoiceCatalog = async () => catalog;
    const state: any = { rolledTalents: [], rolledBoons: [], selectedSpells: [], selectedLanguages: [],
        weaponMasterySelection: { required: 1, selected: ['Longsword'] }, armorMasterySelection: { required: 0, selected: [] },
        statSelection: { selected: [] }, statPool: {}, extraSpellSelection: { selected: [] } };
    try {
        const fixedClass = { name: 'Fighter', type: 'Class', system: { talents: [mastery.uuid] } };
        const generated = await assembleFinalItems(state, 1, fixedClass);
        assert.equal(generated.filter(item => item.name === 'Weapon Mastery (Longsword)').length, 1);
        assert.doesNotMatch(JSON.stringify(generated), /REPLACEME/);
        await assert.rejects(() => assembleFinalItems({ ...state, weaponMasterySelection: { selected: [] } }, 1, fixedClass), /valid weapon/);
        const advancement = await assembleFinalItems({ ...state, rolledTalents: [mastery] }, 3, { system: {} });
        assert.equal(advancement.length, 1);
        assert.doesNotMatch(JSON.stringify(advancement), /REPLACEME/);
    } finally {
        shadowdarkAdapter.resolveDocument = resolve;
        shadowdarkAdapter.getChoiceCatalog = catalogFn;
    }
    assert.equal(JSON.stringify(mastery), before, 'choice, import and advancement never mutate the cached template');
    await masteryAssemblyRegression();
    damageOrderingRegression();
    inventoryDamageRegression();
    console.log('shadowdark native 4.0.6 weapon/choice fixtures: PASS');
}
if (import.meta.url === `file://${process.argv[1]}`) {
    const cases: Record<string, () => unknown> = { R1: masteryAssemblyRegression, R2: damageOrderingRegression, R3: inventoryDamageRegression };
    Promise.resolve().then(() => cases[process.argv[2]] ? cases[process.argv[2]]() : run()).catch(error => { console.error(error); process.exitCode = 1; });
}
