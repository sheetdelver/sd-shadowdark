import assert from 'node:assert/strict';
import { prepareWeaponBase, prepareWeaponAttack, numericWeaponEffect } from '../logic/weapon-rules';
import { calculateAttacks } from '../logic/rules';
import { applyMasteryChoice, assertResolvedTalentChoices } from '../logic/talent-choices';
import { enrichItem } from '../logic/actor-enricher';
import { assembleFinalItems } from '../server/api/level-up-engine';
import { shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MockSDKProvider } from '@sheet-delver/sdk/testing';
import { ShadowdarkUIProvider } from '../ui/context/ShadowdarkUIContext';
import { ShadowdarkActorProvider } from '../ui/context/ShadowdarkActorContext';
import { ItemRow } from '../ui/InventoryComponents';
import ItemModal from '../ui/components/ItemModal';
import AbilitiesTab from '../ui/AbilitiesTab';
import ShadowdarkPaperSheet from '../ui/ShadowdarkPaperSheet';
import { ShadowdarkNormalizer } from '../logic/normalization';
import { damageCases, damageFixture, propertyNames } from './fixtures/weapon-cases';
import { applyItemDataOverrides } from '../server/api/item-properties';
import { handleFinalizeLevelUp } from '../server/api/level-up';

// Native 4.0.6: WeaponSD, PlayerSD._calcAttackMainConfig/_calcDamageConfig,
// _ActorBaseSD._getActiveEffectKeys and the core Weapon Mastery template.
// Deliberately not fixtures/assertions for the supplied newer 4.1.0 rules.
const nameIndex = { 'Compendium.shadowdark.properties.Item.fin': 'Finesse',
    'Compendium.shadowdark.properties.Item.throw': 'Thrown',
    'Compendium.shadowdark.properties.Item.two': 'Two-Handed' };
const actor = { type: 'Player', system: { level: { value: 4 } },
    computed: { abilities: { str: { mod: -1 }, dex: { mod: 3 } }, weaponPropertyNames: nameIndex }, items: [], effects: [] };
const weapon = (name: string, system: any = {}) => ({ _id: name, name, type: 'Weapon', system: {
    equipped: true, type: 'melee', damage: { oneHanded: 'd8', twoHanded: 'd10' }, properties: [], ...system,
} });

async function masteryAssemblyRegression() {
    const resolve = shadowdarkAdapter.resolveDocument;
    const templates = ['Weapon', 'Armor'].map(kind => ({ name: `${kind} Mastery`, type: 'Talent',
        uuid: `Compendium.shadowdark.talents.Item.${kind.toLowerCase()}`, system: {}, effects: [{ changes: [
            { key: `system.roll.melee.bonus.REPLACEME`, mode: 2, value: '1+floor(@level.value/2)' },
        ] }] }));
    const original = JSON.stringify(templates);
    shadowdarkAdapter.resolveDocument = async uuid => structuredClone(templates.find(item => item.uuid === uuid) ?? null);
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
            const combined = await assembleFinalItems(state(kind, choices, [template]), 1, fixed);
            assert.equal(combined.filter(item => item.name.startsWith(template.name)).length, 2,
                'fixed and rolled mastery grants must both survive');
            const context = { addedSourceIds: new Set<string>(), addedNames: new Set<string>(), targetLevel: 1, actor: null };
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
    } finally { shadowdarkAdapter.resolveDocument = resolve; }
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
            assert.equal(prepareWeaponAttack(fixture, item).damage, '(d8+3)*2');
        }
    }
    const override = { key: 'system.roll.melee.damage', mode: 5, value: 7 };
    const permutations = <T,>(values: T[]): T[][] => values.length ? values.flatMap((value, index) =>
        permutations(values.filter((_, i) => i !== index)).map(rest => [value, ...rest])) : [[]];
    for (const ordered of permutations([override, ...changes])) {
        assert.equal(prepareWeaponAttack({ ...actor, items: ordered.map(change => ({ effects: [{ changes: [change] }] })) }, item).damage, '7');
    }
    const more = [...changes, { ...changes[0], value: 2 }, { ...changes[1], value: 3 }];
    for (const ordered of permutations(more)) assert.equal(prepareWeaponAttack({ ...actor, effects: [{ changes: ordered }] }, item).damage, '(d8+5)*6');
    assert.equal(prepareWeaponAttack({ ...actor, effects: [{ changes: [{ ...override, value: 0 }, ...changes, override] }] }, item).damage, '7', 'last OVERRIDE wins');
    assert.equal(prepareWeaponAttack({ ...actor, effects: [{ changes: [override, ...changes, { ...override, value: 0 }] }] }, item).damage, '0');
}

function renderWeaponConsumer(component: any, props: any, fixture: any) {
    const noop = async () => {};
    return renderToStaticMarkup(createElement(MockSDKProvider, null,
        createElement(ShadowdarkUIProvider, null, createElement(ShadowdarkActorProvider, {
            children: createElement(component, props),
            actor: fixture, onUpdate: noop, onDeleteItem: noop, onCreateItem: noop, onUpdateItem: noop,
            onRoll: noop, onToggleEffect: noop, onDeleteEffect: noop, onCreateEffect: noop,
            onUpdateEffect: noop, onAddPredefinedEffect: noop, onRefresh: noop,
        }))));
}

function inventoryDamageRegression() {
    for (const test of damageCases) {
        const source = damageFixture(test);
        const prior = structuredClone(source);
        const fixture: any = ShadowdarkNormalizer.normalizeActorData(structuredClone(source), { nameIndex: propertyNames });
        const item = fixture.items![0];
        assert.deepEqual(item.system.damage, source.items[0].system.damage, 'normalization must not lose source damage');
        const attack = prepareWeaponAttack(fixture, item);
        assert.equal(prepareWeaponBase(item, {}, fixture.computed?.weaponPropertyNames).damage, test.base);
        assert.equal(attack.damage, test.adjusted, test.name);
        assert.equal(attack.handedness, test.hands);
        assert.equal(attack.toHit, test.toHit);
        const expected = test.adjusted ?? 'Damage unavailable';
        const summary = [...fixture.derived!.attacks.melee, ...fixture.derived!.attacks.ranged][0];
        assert.equal(summary.derived.damage, expected);
        assert.equal(shadowdarkAdapter.getRollData(fixture as any, 'item', item.id ?? item._id)?.formula, `1d20+${test.toHit}`);
        for (const [component, props] of [[ItemRow, { item, expandedItems: new Set([item._id]), toggleItem() {} }],
            [ItemModal, { item, isOpen: true, onClose() {} }], [AbilitiesTab, {}], [ShadowdarkPaperSheet, { onToggleView() {} }]] as const) {
            const html = renderWeaponConsumer(component, props, fixture);
            assert.ok(html.includes(expected), `${component.name} must display ${expected}`);
            if (component === ItemRow || component === ItemModal) {
                assert.match(html, /data-weapon-damage="base"/);
                assert.match(html, /data-weapon-damage="actor"/);
                assert.ok(html.includes(test.base ?? 'Damage unavailable'));
            }
            if (!test.base) assert.match(html, /Damage unavailable: system\.damage\./, 'missing source has a useful field diagnostic');
        }
        assert.deepEqual(source, prior);
    }
    const staff = weapon('Staff', { damage: { twoHanded: 'd4' }, properties: ['Compendium.shadowdark.properties.Item.two'] });
    const original = structuredClone(staff.system);
    applyItemDataOverrides(staff);
    assert.deepEqual(staff.system, original, 'legacy name-specific overrides cannot rewrite authoritative damage/properties');
}

export async function run() {
    const longsword = weapon('Longsword');
    const prim = { ...actor, items: [longsword] };
    assert.equal(prepareWeaponAttack(prim, longsword).damage, 'd8');
    assert.equal(prepareWeaponAttack(prim, longsword).toHit, -1);
    const staff = weapon('Staff', { properties: ['Compendium.shadowdark.properties.Item.two'], damage: { oneHanded: '', twoHanded: 'd4' } });
    const binx = { ...actor, computed: { ...actor.computed, abilities: { str: { mod: 1 }, dex: { mod: 0 } } }, items: [staff] };
    assert.equal(prepareWeaponAttack(binx, staff).damage, 'd4', 'STR never adds to weapon damage by default');
    assert.equal(prepareWeaponAttack(binx, staff).handedness, '2h');
    const dagger = weapon('Dagger', { range: 'near', properties: ['Compendium.shadowdark.properties.Item.fin', 'Compendium.shadowdark.properties.Item.throw'] });
    assert.equal(prepareWeaponAttack(actor, dagger).abilityBonus, 3);
    const javelin = weapon('Javelin', { range: 'near', properties: ['Compendium.shadowdark.properties.Item.throw'] });
    const summary = calculateAttacks({ ...actor, items: [javelin] }, [javelin], nameIndex);
    assert.equal(summary.melee[0].derived.toHit, '-1');
    assert.equal(summary.ranged[0].derived.toHit, '+3', 'thrown rows use distinct native melee/ranged bonuses');
    assert.equal(prepareWeaponAttack(actor, weapon('Fake Finesse', { properties: ['Compendium.finesse.unknown'] })).abilityBonus, -1);
    assert.equal(prepareWeaponAttack(actor, weapon('Bow', { type: 'ranged' })).abilityBonus, 3);
    assert.equal(prepareWeaponAttack(actor, longsword, { handedness: '2h' }).damage, 'd10');
    assert.equal(prepareWeaponAttack(actor, weapon('Unresolved', { damage: {} })).damage, null);
    assert.equal(prepareWeaponAttack({ ...actor, type: 'NPC' }, weapon('NPC', { bonuses: { attackBonus: 5 } })).toHit, 5);
    assert.equal(numericWeaponEffect('1+floor(@level.value/2)', actor), 3);
    assert.equal(numericWeaponEffect('constructor(1)', actor), null);
    assert.equal(numericWeaponEffect('1/0', actor), null);
    const mastery = { _id: '5bpWuaT0KTNzuzCu', uuid: 'Compendium.shadowdark.talents.Item.5bpWuaT0KTNzuzCu',
        name: 'Weapon Mastery', type: 'Talent', system: {}, effects: [{ transfer: true, changes: [
            { key: 'system.roll.melee.bonus.REPLACEME', mode: 2, value: '1+floor(@level.value/2)' },
            { key: 'system.roll.melee.damage.REPLACEME', mode: 2, value: '1+floor(@level.value/2)' },
        ] }] };
    const before = JSON.stringify(mastery);
    const selected = applyMasteryChoice(mastery, 'Longsword', 'weapon');
    assert.match(selected.effects[0].changes[0].key, /\.longsword$/);
    assert.equal(selected.effects[0].changes[0].value, '1+floor(@level.value/2)');
    const trained = { ...actor, items: [longsword, selected] };
    const normalized = prepareWeaponAttack(trained, longsword);
    assert.equal(normalized.toHit, 2);
    assert.equal(normalized.damage, 'd8+3');
    const ui = calculateAttacks(trained, trained.items, nameIndex).melee[0].derived;
    assert.equal(ui.toHit, '+2'); assert.equal(ui.damage, normalized.damage);
    const server = shadowdarkAdapter.getRollData(trained as any, 'item', 'Longsword')!;
    assert.equal(server.formula, '1d20+2');
    const defaults = { abilityBonus: normalized.abilityBonus, itemBonus: normalized.itemBonus, talentBonus: normalized.talentBonus };
    assert.equal(shadowdarkAdapter.getRollData(trained as any, 'item', 'Longsword', defaults)?.formula, server.formula);
    assert.equal(shadowdarkAdapter.getRollData(trained as any, 'item', 'Longsword', { ...defaults, talentBonus: 0 })?.formula, '1d20-1');
    const enchanted = weapon('Sword', { bonuses: { attackBonus: -2, damageBonus: 2 } });
    assert.equal(prepareWeaponAttack(actor, enchanted).toHit, -3);
    assert.equal(prepareWeaponAttack(actor, enchanted).damage, 'd8+2');
    assert.equal(prepareWeaponAttack({ ...trained, items: [longsword, { ...selected, effects: selected.effects.map((effect: any) => ({ ...effect, disabled: true })) }] }, longsword).toHit, -1);
    assert.throws(() => applyMasteryChoice(mastery, '../__proto__', 'weapon'), /valid weapon/);
    assert.throws(() => assertResolvedTalentChoices([mastery]), /needs a choice/);
    const enriched = await enrichItem(mastery, { addedSourceIds: new Set(), addedNames: new Set(), targetLevel: 1, actor: null, bonusTo: 'Longsword' });
    assert.doesNotMatch(JSON.stringify(enriched), /REPLACEME/);
    const imported = { addedSourceIds: new Set<string>(), addedNames: new Set<string>(), targetLevel: 1, actor: null,
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
    shadowdarkAdapter.resolveDocument = async uuid => uuid.endsWith('5bpWuaT0KTNzuzCu') ? structuredClone(mastery) : null;
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
    } finally { shadowdarkAdapter.resolveDocument = resolve; }
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
