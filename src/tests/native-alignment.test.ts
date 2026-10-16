import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MockSDKProvider } from '@sheet-delver/sdk/testing';
import type { FoundryActor } from '@sheet-delver/sdk';
import { ShadowdarkAdapter, shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { ShadowdarkRegistry } from '../server/Registry';
import { handleGetDocument } from '../server/api/document';
import { applyMasteryChoice, assertResolvedTalentChoices, choiceCatalog } from '../logic/talent-choices';
import { prepareWeaponAttack } from '../logic/weapon-rules';
import { ShadowdarkUIProvider } from '../ui/context/ShadowdarkUIContext';
import { ShadowdarkActorProvider } from '../ui/context/ShadowdarkActorContext';
import AbilitiesTab from '../ui/AbilitiesTab';
import ShadowdarkPaperSheet from '../ui/ShadowdarkPaperSheet';
import {
    armsman, bastardSword, dagger, greatsword, lantern, torch, hostActorProjection, legacyMastery, longsword, MASTERY_UUID, preparationContext, primLike,
    PROPERTY_NAMES, shield, v14Mastery,
} from './fixtures/native-406';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { buildOwnedItemCard } from '../logic/resource-cards';
import { prepareActorCore } from '../logic/actor-preparation';
import { prepareRequestedAction } from '../logic/actions';
import { itemControls } from '../logic/inventory-controls';
import { LuckControl } from '../ui/components/LuckControl';
import { worldSetting } from '../logic/world-settings';

/**
 * ADR-0001 native-alignment regressions. Expected values are derived by hand from
 * native 4.0.6 source (PlayerSD/NpcSD/_ActorBaseSD/ActiveEffectSD/ArmorSD) and the
 * Foundry 14 ActiveEffect migration, not from module output. See the audit for anchors.
 */
type Result = { id: string; name: string; ok: boolean; detail?: string };
const results: Result[] = [];
async function check(id: string, name: string, fn: () => unknown | Promise<unknown>) {
    try { await fn(); results.push({ id, name, ok: true }); }
    catch (error) { results.push({ id, name, ok: false, detail: (error as Error).message.split('\n')[0] }); }
}

const adapter = new ShadowdarkAdapter();
const prepare = (actor: unknown): any => adapter.prepareActorData(structuredClone(actor) as FoundryActor, preparationContext);
const meleeRow = (prepared: any) => (prepared.derived?.attacks?.melee ?? []).find((row: any) => row.name === 'Longsword')?.derived;

function render(component: any, actor: any) {
    const noop = async () => {};
    return renderToStaticMarkup(createElement(MockSDKProvider, null,
        createElement(ShadowdarkUIProvider, null, createElement(ShadowdarkActorProvider, {
            children: createElement(component as any, { onToggleView() {} } as any),
            actor, onUpdate: noop, onDeleteItem: noop, onCreateItem: noop, onUpdateItem: noop,
            onRoll: noop, onToggleEffect: noop, onDeleteEffect: noop, onCreateEffect: noop,
            onUpdateEffect: noop, onAddPredefinedEffect: noop, onRefresh: noop,
        } as any))));
}

async function issue23() {
    // PlayerSD attributeModel.mod: clamp(floor((9 - 10) / 2)) = -1. Mastery formula
    // 1 + floor(@level.value / 2) at level 1 = 1. _calcAttackMainConfig: -1 + 1 = 0;
    // _calcDamageConfig: "d8" with ADD 1 = d8+1 (module compact display).
    const prepared = prepare(primLike());
    const projected: any = hostActorProjection(prepared);
    await check('A01-01', 'prepared Actor attack row is +0 / d8+1', () => {
        assert.equal(meleeRow(prepared)?.toHit, '+0'); assert.equal(meleeRow(prepared)?.damage, 'd8+1');
    });
    await check('A01-01', 'caller HTTP projection keeps +0 / d8+1', () => {
        assert.equal(meleeRow(projected)?.toHit, '+0'); assert.equal(meleeRow(projected)?.damage, 'd8+1');
    });
    await check('A01-01', 'server roll formula is 1d20+0', () => {
        assert.equal(shadowdarkAdapter.getRollData(prepared as any, 'item', 'primLongsword')?.formula, '1d20+0');
    });
    await check('A01-01', 'dialog defaults on the projected Actor total +0', () => {
        const item = projected.items.find((entry: any) => entry.name === 'Longsword');
        const defaults = (projected.derived?.actions?.attacks ?? []).find((entry: any) => entry.itemId === 'primLongsword')
            ?? prepareWeaponAttack(projected, item);
        assert.equal(defaults.toHit, 0); assert.equal(defaults.damage, 'd8+1');
    });
    // Attack-row markup: advanced "<b>+0</b> to hit, <b>d8+1</b> dmg"; paper "+0 <span>d8+1</span>".
    await check('A01-01', 'advanced Abilities tab attack row renders +0 / d8+1', () => {
        const html = render(AbilitiesTab, projected).replace(/<!-- -->/g, '');
        assert.match(html, /Longsword[\s\S]*?>\+0<\/span> to hit, <span[^>]*>d8\+1<\/span>/);
    });
    await check('A01-01', 'paper sheet attack row renders +0 / d8+1', () => {
        const html = render(ShadowdarkPaperSheet, projected).replace(/<!-- -->/g, '');
        assert.match(html, /Longsword[\s\S]*?>\+0 ?<span[^>]*>d8\+1<\/span>/);
    });
    await check('A01-01', 'legacy shape gives the same result', () => {
        const legacy = prepare(primLike(legacyMastery()));
        assert.equal(meleeRow(legacy)?.toHit, '+0'); assert.equal(meleeRow(legacy)?.damage, 'd8+1');
    });
    await check('A01-02', 'mixed payload uses system.changes once (no double application)', () => {
        const mixed: any = v14Mastery();
        mixed.effects[0].changes = legacyMastery().effects[0].changes;
        const row = meleeRow(prepare(primLike(mixed)));
        assert.equal(row?.toHit, '+0'); assert.equal(row?.damage, 'd8+1');
    });
    await check('A01-01', 'disabling the effect removes it exactly once', () => {
        const row = meleeRow(prepare(primLike(v14Mastery({ disabled: true }))));
        assert.equal(row?.toHit, '-1'); assert.equal(row?.damage, 'd8');
    });
    await check('A01-01', 'source data is not mutated by preparation', () => {
        const source = primLike(); const before = structuredClone(source);
        prepare(source); assert.deepEqual(source, before);
    });
}

async function effectsAndStats() {
    await check('SD01-01', 'v14 ADD of a class slug joins spellcasting classes', () => {
        const actor: any = primLike();
        actor.effects = [{ _id: 'caster', name: 'Caster', disabled: false, transfer: false, system: { changes: [
            { key: 'system.spellcasting.classes', type: 'add', value: 'wizard', phase: 'initial', priority: null },
        ] } }];
        assert.deepEqual(prepare(actor).derived?.spellcasting?.classes, ['wizard']);
    });
    await check('SD01-01', 'v14 HP formula ADD evaluates (8 + 1 = 9)', () => {
        const actor: any = primLike();
        actor.effects = [{ _id: 'hp', name: 'Tough', disabled: false, system: { changes: [
            { key: 'system.attributes.hp.max', type: 'add', value: '1+floor(@level.value/2)', phase: 'initial' },
        ] } }];
        assert.equal(prepare(actor).derived?.hp?.max, 9);
    });
    await check('SD01-03', 'NPC explicit DEX +3 is preserved', () => {
        const npc = prepare({ _id: 'npc', name: 'Npc', type: 'NPC', system: { abilities: { dex: { mod: 3 } },
            attributes: { ac: { value: 13 }, hp: { value: 5, max: 5 } }, level: { value: 1 } }, items: [], effects: [] });
        assert.equal((npc.derived as any).abilities.dex.mod, 3);
        const score = (npc.derived as any).abilities.dex.value;
        assert.ok(score === null || score === undefined, 'no invented NPC score');
    });
    for (const [score, mod] of [[0, -4], [8, -1], [9, -1], [10, 0], [18, 4], [24, 4]]) {
        await check('SD01-03', `Player score ${score} has native bounded mod ${mod}`, () => {
            const actor: any = primLike(); actor.system.abilities.str = { value: score };
            assert.equal((prepare(actor).derived as any).abilities.str.mod, mod);
        });
    }
    const armored = (items: any[]) => { const actor: any = primLike(); actor.system.abilities.dex = { value: 16 }; actor.items = items; return prepare(actor); };
    const armor = (name: string, ac: object, extra: object = {}) => ({ _id: name, name, type: 'Armor', effects: [],
        system: { equipped: true, ac, properties: [], baseArmor: '', ...extra } });
    await check('SD01-04', 'DEX +3 with native shield {base 0, modifier 2} is AC 15', () => {
        assert.equal(armored([armor('Kite', { base: 0, modifier: 2, attribute: '' })]).derived.ac, 15);
    });
    await check('SD01-04', 'base 15 armor allowing DEX gives AC 18', () => {
        assert.equal(armored([armor('Custom Plate', { base: 15, modifier: 0, attribute: 'dex' })]).derived.ac, 18);
    });
    await check('SD01-04', 'best body armor plus additive shield is order independent (16)', () => {
        const leather = armor('Leather armor', { base: 11, modifier: 0, attribute: 'dex' });
        const shield = armor('Shield', { base: 0, modifier: 2, attribute: '' });
        assert.equal(armored([leather, shield]).derived.ac, 16); assert.equal(armored([shield, leather]).derived.ac, 16);
    });
    await check('SD01-04', 'slots start at 10 and add max(0, STR - 10)', () => {
        const actor: any = primLike(); actor.system.abilities.str = { value: 14 };
        assert.equal(prepare(actor).derived.maxSlots, 14);
    });
}

async function choicesAndIdentity() {
    const template: any = v14Mastery();
    template.name = 'Weapon Mastery';
    template.effects[0].system.changes.forEach((change: any) => { change.key = change.key.replace('longsword', 'REPLACEME'); });
    await check('SD01-02', 'v14 mastery choice replaces REPLACEME in system.changes', () => {
        const catalog = choiceCatalog([longsword()]);
        assert.doesNotMatch(JSON.stringify(applyMasteryChoice(template, 'Longsword', 'weapon', catalog)), /REPLACEME/);
    });
    await check('SD01-02', 'unresolved v14 placeholder blocks creation', () => {
        assert.throws(() => assertResolvedTalentChoices([template]), /choice/);
    });
    await check('SD01-11', '_id-only embedded item exposes canonical id', () => {
        const actor: any = primLike(); actor.items = [{ _id: 'sword', name: 'Sword', type: 'Weapon', system: { equipped: true, damage: { oneHanded: 'd6' } }, effects: [] }];
        assert.equal((prepare(actor).items as any[])[0].id, 'sword');
    });
    await check('SD01-11', 'Actor-only effect is represented once with owner identity', () => {
        const actor: any = primLike(); actor.items = [];
        actor.effects = [{ _id: 'bless', name: 'Blessed', disabled: false, system: { changes: [] } }];
        // The sheet's effect list (EffectsTab) is the prepared view's list.
        const effects = ((prepare(actor).derived as any)?.effects ?? []) as any[];
        assert.equal(effects.filter(effect => (effect._id ?? effect.id) === 'bless').length, 1);
        assert.equal(effects.find(effect => effect.id === 'bless')?.owner?.kind, 'actor');
    });
    await check('SD01-06', 'document route denies a world read the caller cannot see', async () => {
        let baseReads = 0;
        const registry = (shadowdarkAdapter as any)._registry as ShadowdarkRegistry;
        registry.attach({ findAll: async () => [], findOne: async () => null, getById: async () => null } as any,
            { fetchByUuid: async () => { baseReads++; return { _id: 'synthetic', name: 'Private', type: 'Item' }; } } as any);
        const req: any = { runtime: { documents: { get: async () => null, fetchByUuid: async () => null } } };
        const response: any = await handleGetDocument(req, { params: Promise.resolve({ systemId: 'shadowdark', route: ['document', 'Item.synthetic'] }) });
        assert.notEqual(response.status, 200); assert.equal(baseReads, 0);
    });
    await check('SD01-07', 'another pack with the same terminal ID is not substituted', async () => {
        const registry = new ShadowdarkRegistry();
        const row = { _id: 'same', name: 'Real', type: 'Weapon', pack: 'shadowdark.gear', uuid: 'Compendium.shadowdark.gear.Item.same', system: {} };
        registry.attach({ findAll: async (type: string) => type === 'Item' ? [row] : [], findOne: async () => null, getById: async () => null } as any,
            { fetchByUuid: async () => null } as any);
        assert.equal(await registry.getDocument('Compendium.custom.gear.Item.same'), null);
        assert.equal((await registry.getDocument('Compendium.shadowdark.gear.Item.same'))?.name, 'Real');
    });
    await check('SD01-05', 'module view keeps the canonical mastery source identity after host projection', () => {
        const projected: any = hostActorProjection(prepare(primLike()));
        const talent = (projected.derived?.items ?? []).find((item: any) => item.id === 'primMastery');
        assert.deepEqual(talent?.source, { kind: 'compendium', pack: 'shadowdark.talents', documentType: 'Item', id: '5bpWuaT0KTNzuzCu' });
        assert.equal(MASTERY_UUID.endsWith(talent?.source?.id), true);
    });
    void longsword;
}

async function attackModes() {
    // Native PlayerSD.getAttacks: one attack per equipped weapon plus a ranged one
    // when Thrown; WeaponSD.getDamageFormula picks oneHanded/twoHanded by grip and
    // Versatile weapons switch grips. Finesse uses the better of STR/DEX (+2 here).
    const lookups = { propertyName: (uuid: string) => PROPERTY_NAMES[uuid] ?? null };
    const viewOf = (source: any) => prepareShadowdarkView(source, lookups);
    const cardOf = (source: any, itemId: string) => buildOwnedItemCard(viewOf(source), source.items.find((item: any) => item._id === itemId))!;
    const attackLabels = (card: any) => card.actions.filter((entry: any) => entry.kind === 'attack').map((entry: any) => entry.label);
    const attackFacts = (card: any) => card.facts.filter((fact: any) => / attack$/.test(fact.label)).map((fact: any) => `${fact.label}: ${fact.value}`);

    await check('SD01-08', 'thrown weapon card labels melee and thrown attacks distinctly', () => {
        const card = cardOf(armsman([dagger()]), 'dagger');
        assert.deepEqual(attackLabels(card), ['Melee attack', 'Thrown attack']);
        assert.deepEqual(attackFacts(card), ['Melee attack: +2 to hit, d4', 'Thrown attack: +2 to hit, d4']);
    });
    await check('SD01-08', 'versatile weapon offers each grip with its own damage', () => {
        const card = cardOf(armsman([bastardSword()]), 'bastard');
        assert.deepEqual(attackLabels(card), ['Melee, one-handed attack', 'Melee, two-handed attack']);
        assert.deepEqual(attackFacts(card), ['Melee, one-handed attack: +2 to hit, d8', 'Melee, two-handed attack: +2 to hit, d10']);
        assert.equal(card.facts.find((fact: any) => fact.label === 'Base damage')?.value, 'd8 one-handed, d10 two-handed');
    });
    await check('SD01-08', 'stored two-handed grip is listed first', () => {
        const view = viewOf(armsman([bastardSword({ handedness: '2h' })]));
        assert.deepEqual(view.actions.filter(action => action.kind === 'attack').map(action => action.attack?.handedness), ['2h', '1h']);
    });
    await check('SD01-08', 'an equipped shield makes the two-handed grip unavailable with a reason', () => {
        const card = cardOf(armsman([bastardSword(), shield()]), 'bastard');
        const [oneHand, twoHands] = card.actions;
        assert.equal(oneHand.available, true);
        assert.equal(twoHands.available, false);
        assert.match(String(twoHands.reason), /two-handed grip needs both hands; Shield is equipped/);
    });
    await check('SD01-08', 'sheets omit an unavailable mode; the card keeps it disabled with its reason', () => {
        const source = armsman([bastardSword(), shield()]);
        const view: any = viewOf(source);
        assert.deepEqual([...view.attacks.melee, ...view.attacks.ranged].map((row: any) => row.derived.mode), ['Melee, one-handed']);
        const actor = { ...source, derived: view, computed: view };
        for (const component of [AbilitiesTab, ShadowdarkPaperSheet]) {
            const html = render(component, actor);
            assert.doesNotMatch(html, /two-handed/i, `${component.name} hides the blocked grip`);
            assert.doesNotMatch(html, /Damage unavailable/, `${component.name} shows no placeholder row`);
        }
        const card = cardOf(source, 'bastard');
        assert.equal(card.actions.find((entry: any) => entry.label === 'Melee, two-handed attack')?.available, false);
        assert.match(card.facts.find((fact: any) => fact.label === 'Melee, two-handed attack')?.detail ?? '', /Shield is equipped/);
    });
    await check('SD01-08', 'sheet rows carry the mode label for every attack', () => {
        const view: any = viewOf(armsman([dagger(), bastardSword()]));
        const rows = [...view.attacks.melee, ...view.attacks.ranged].map((row: any) => `${row.name}: ${row.derived.mode}`);
        assert.deepEqual(rows.sort(), ['Bastard Sword: Melee, one-handed', 'Bastard Sword: Melee, two-handed', 'Dagger: Melee', 'Dagger: Thrown']);
        const actor = { ...armsman([dagger(), bastardSword()]), derived: view, computed: view };
        assert.match(render(AbilitiesTab, actor), /Thrown/);
        assert.match(render(ShadowdarkPaperSheet, actor), /Melee, two-handed/);
    });
    await check('SD01-08', 'server refuses an attack mode the weapon does not have', () => {
        const source = armsman([dagger()]);
        const action = prepareRequestedAction(prepareActorCore(source, lookups), source, lookups, { kind: 'attack', itemId: 'dagger', attackType: 'melee', handedness: '2h' });
        assert.equal(action?.available, false);
        assert.match(String(action?.reason), /no melee two-handed attack/);
    });
}

async function inventoryControls() {
    // Native PlayerSheetSD._onToggleEquipped/_onToggleStashed/_toggleLightSource and
    // the shield branch of _onToggleEquipped (Versatile → 1h, other 2h unequipped).
    const lookups = { propertyName: (uuid: string) => PROPERTY_NAMES[uuid] ?? null };
    const controlsFor = (source: any, itemId: string) => itemControls(prepareShadowdarkView(source, lookups).items, source.items, itemId);
    const byId = (controls: any[], id: string) => controls.find(control => control.id === id);

    await check('C6', 'equip toggles equipped and clears stashed; stash clears equipped', () => {
        const controls = controlsFor(armsman([dagger()]), 'dagger');
        assert.deepEqual(byId(controls, 'equip').writes, [{ itemId: 'dagger', patch: { 'system.equipped': false, 'system.stashed': false } }]);
        assert.deepEqual(byId(controls, 'stash').writes, [{ itemId: 'dagger', patch: { 'system.stashed': true, 'system.equipped': false } }]);
    });
    await check('C6', 'equipping a shield frees both hands as native does', () => {
        const source = armsman([bastardSword({ handedness: '2h' }), greatsword(), shield({ equipped: false })]);
        assert.deepEqual(byId(controlsFor(source, 'shield'), 'equip').writes, [
            { itemId: 'shield', patch: { 'system.equipped': true, 'system.stashed': false } },
            { itemId: 'bastard', patch: { 'system.handedness': '1h' } },
            { itemId: 'greatsword', patch: { 'system.equipped': false } },
        ]);
    });
    await check('C6', 'only Weapon/Armor can be equipped; only native light sources can be lit', () => {
        const source = armsman([torch(), lantern()]);
        assert.deepEqual(controlsFor(source, 'torch').map(control => control.id), ['stash', 'light']);
        assert.deepEqual(controlsFor(source, 'lantern').map(control => control.id), ['stash'], 'native Lantern is not itself a light source');
    });
    await check('C6', 'lighting a torch puts out other lit sources and marks it used', () => {
        const source = armsman([torch(), torch('torch2', { active: true, hasBeenUsed: true })]);
        assert.deepEqual(byId(controlsFor(source, 'torch'), 'light').writes, [
            { itemId: 'torch', patch: { 'system.light.active': true, 'system.light.hasBeenUsed': true } },
            { itemId: 'torch2', patch: { 'system.light.active': false } },
        ]);
        assert.deepEqual(byId(controlsFor(source, 'torch2'), 'light').writes, [{ itemId: 'torch2', patch: { 'system.light.active': false } }]);
    });
}

async function luck() {
    // settings.mjs: usePulpMode is world-scoped, default false. PlayerSD luck:
    // standard mode uses luck.available, Pulp mode uses luck.remaining.
    const actor = { ...primLike(), system: { ...primLike().system, luck: { available: true, remaining: 3 } } };
    await check('C8', 'Pulp mode falls back to the native default (off) and says so', () => {
        assert.deepEqual(worldSetting('usePulpMode'), { value: false, source: 'native-default' });
    });
    await check('C8', 'standard luck is a centred, unlabelled tick box', () => {
        const html = render(() => createElement(LuckControl, {}), actor);
        assert.match(html, /type="checkbox"[^>]*checked/);
        assert.match(html, /aria-label="Luck token"/, 'named for assistive technology only');
        assert.match(html, /justify-center/);
        assert.doesNotMatch(html, />\s*Token\s*</, 'no visible label');
        assert.doesNotMatch(html, /Pulp|luck tokens/i);
    });
    await check('C8', 'Pulp luck replaces the token with an unlabelled count selector', () => {
        const html = render(() => createElement(LuckControl, { pulpMode: true }), actor);
        assert.doesNotMatch(html, /type="checkbox"|Token|Pulp/);
        assert.match(html, /aria-label="3 luck tokens"/);
        assert.match(html, /aria-label="Spend a luck token"/);
    });
}

export async function run(options: { report?: boolean } = {}) {
    results.length = 0;
    await issue23();
    await effectsAndStats();
    await choicesAndIdentity();
    await attackModes();
    await inventoryControls();
    await luck();
    const failed = results.filter(result => !result.ok);
    if (options.report || failed.length) {
        for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.id} ${result.name}${result.detail ? ` — ${result.detail}` : ''}`);
    }
    console.log(`shadowdark ADR-0001 native alignment: ${results.length - failed.length}/${results.length} passed`);
    if (failed.length) throw new Error(`${failed.length} native-alignment regressions failed`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run({ report: process.argv.includes('--report') }).catch(() => { process.exitCode = 1; });
}
