// ADR-0002 maintained native-method oracles. In-memory collaborators only.
// Run with node --import tsx; SHADOWDARK_NATIVE selects the read-only 4.0.6 reference.
// --baseline records known failures without pretending they pass. Never native acceptance.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const nativeRoot = process.env.SHADOWDARK_NATIVE ?? path.resolve(moduleRoot, '../../../../temp/shadowdark');
assert.equal(JSON.parse(readFileSync(`${nativeRoot}/system/system.json`, 'utf8')).version, '4.0.6');
const nativeCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: nativeRoot, encoding: 'utf8' }).trim();
assert.equal(nativeCommit, '9677d16b3903b3b640f00d4efd48249142ac8334');
const source = path => import(pathToFileURL(`${moduleRoot}/src/${path}`));
const native = path => import(pathToFileURL(`${nativeRoot}/system/src/${path}`));
globalThis.foundry = { data: { fields: {} }, appv1: { api: { FormApplication: class {} } }, abstract: { TypeDataModel: class { prepareBaseData() {} }, DataModel: class {} }, dice: { Roll: class {} }, applications: { ux: { TextEditor: { implementation: {} } }, api: { DialogV2: { confirm: async () => true } } } };
globalThis.CONFIG = { SHADOWDARK: { DEFAULTS: { GEMS_PER_SLOT: 10 }, ABILITY_KEYS: ['str', 'dex', 'con', 'int', 'wis', 'cha'] } };
globalThis.game = { i18n: { localize: s => s, format: (s, values) => s === 'SHADOWDARK.item.magic_item.unidentifiedName' ? `Unidentified ${values.type}` : s } };
globalThis.ui = { notifications: { warn: s => { throw Error(s); }, error: s => { throw Error(s); } } };
globalThis.Hooks = { call: async () => true };
globalThis.shadowdark = { defaults: { FREE_COIN_CARRY: 100, BASE_ARMOR_CLASS: 10 }, dice: { createToolTip: () => '', setRollTarget: () => {}, rollDialog: async () => true }, chat: { renderRollMessage: async () => ({}) } };
String.prototype.slugify ??= function () { return this.toLowerCase().replace(/\s+/g, '-'); };
const { prepareShadowdarkView } = await source('logic/prepared-view.ts');
const { formatUuid } = await source('logic/identity.ts');
const { default: NativeClass } = await native('models/items/ClassSD.mjs');
const { default: Player } = await native('models/PlayerSD.mjs');
const { default: Npc } = await native('models/NpcSD.mjs');
const { ActorBaseSD: Base } = await native('models/_ActorBaseSD.mjs');
const { PhysicalItemSD: Physical } = await native('models/items/_PhysicalItemSD.mjs');
const { default: Weapon } = await native('models/items/WeaponSD.mjs');
const { default: RollSD } = await native('dice/RollSD.mjs');
const { prepareActorCore, prepareItemBasics } = await source('logic/actor-preparation.ts');
const { weaponBase, prepareRequestedAction, planConsequences, evaluateOutcome } = await source('logic/actions.ts');
const { handleActorAction } = await source('server/api/actions.ts');
const { ShadowdarkRegistry } = await source('server/Registry.ts');
const { languagePlan, validateLanguageSelections } = await source('logic/languages.ts');
const { default: NativeGenerator } = await native('apps/CharacterGeneratorSD.mjs');
const { primLike } = await source('tests/fixtures/native-406.ts');
const results = { method: 'Actual native methods and current module functions, controlled in-memory dependencies; not native Foundry acceptance', nativeCommit, parity: {}, defects: {} };
const clone = structuredClone;
const pack = name => readdirSync(`${nativeRoot}/data/packs/${name}.db`).filter(n => n.endsWith('.json')).map(n => JSON.parse(readFileSync(`${nativeRoot}/data/packs/${name}.db/${n}`, 'utf8'))).filter(d => /^!items![^!]+$/.test(d._key));
const properties = new Map(pack('properties').map(d => [`Compendium.shadowdark.properties.Item.${d._id}`, d.name]));
const lookups = { propertyName: uuid => properties.get(uuid) ?? null };
const physicalGetter = Object.getOwnPropertyDescriptor(Physical.prototype, 'slotsUsed').get;
const nativeItem = doc => { const item = clone(doc); Object.assign(item.system, { isPhysical: ['Armor','Basic','Gem','Potion','Scroll','Wand','Weapon'].includes(item.type), isArmor: item.type === 'Armor', isGem: item.type === 'Gem' }); if (item.system.isPhysical) item.system.slotsUsed = physicalGetter.call(item.system); return item; };
const gear = pack('gear');
let count = 0;
for (const item of gear.filter(d => d.system.slots)) {
  assert.equal(prepareItemBasics(item, lookups).slotsUsed, physicalGetter.call(item.system)); count++;
}
results.parity.physicalItemSlots = count;
count = 0;
for (const item of gear.filter(d => d.type === 'Weapon')) {
  const model = Object.assign(Object.create(Weapon.prototype), clone(item.system));
  model.hasProperty = name => (model.properties ?? []).some(ref => properties.get(ref)?.toLowerCase() === name);
  model.prepareBaseData();
  const basics = prepareItemBasics(item, lookups);
  const actual = weaponBase(item, basics);
  assert.equal(actual.handedness, model.handedness, item.name);
  assert.equal(actual.damage, model.getDamageFormula() || null, item.name); count++;
}
results.parity.nativeWeaponDefaultHandAndDie = count;
const actorBase = () => { const a = primLike(); a.items = []; a.effects = []; a.system.abilities.dex.value = 14; return a; };
const armors = gear.filter(d => d.type === 'Armor');
count = 0;
for (const group of [[], ...armors.map(i => [i]), armors]) {
  const actor = actorBase(); actor.items = group.map(i => ({ ...clone(i), system: { ...clone(i.system), equipped: true } }));
  const prepared = prepareActorCore(actor, lookups);
  const nativeThis = { abilities: prepared.abilities, parent: { items: actor.items.map(nativeItem) }, _getActiveEffectKeys: (_key, value) => ({ value, tooltips: '' }) };
  assert.equal(prepared.ac, Player.prototype._calcArmorClass.call(nativeThis).value); count++;
}
results.parity.noEffectArmorConfigurations = count;
count = 0;
for (const coins of [0, 100, 101, 201]) {
  const actor = actorBase(); actor.system.coins.gp = coins;
  actor.items = gear.filter(d => d.system.slots).map(nativeItem);
  actor.items.push({ ...clone(actor.items[0]), _id: 'repeat', sort: -1 });
  actor.items[1].system.stashed = true;
  const prepared = prepareActorCore(actor, lookups);
  const model = { coins: actor.system.coins, parent: { items: actor.items }, _sortByUserOrder: Base.prototype._sortByUserOrder, getPhysicalItems: Base.prototype.getPhysicalItems };
  assert.deepEqual(prepared.slotUsage, Base.prototype.getSlotUsage.call(model)); count++;
}
results.parity.coinBoundaryAndInventoryConfigurations = count;
count = 0;
for (const natural of [1, 10, 20]) for (const total of [5, 15, 25]) {
  const nativeRoll = Object.assign(Object.create(RollSD.prototype), { _evaluated: true, total, dice: [{ total: natural, faces: 20 }], options: { dc: 15, canCritical: true } });
  const outcome = evaluateOutcome({ dc: 15, critical: { success: 20, failure: 1 } }, total, natural);
  assert.deepEqual([outcome.success, outcome.criticalSuccess, outcome.criticalFailure], [nativeRoll.success, nativeRoll.criticalSuccess, nativeRoll.criticalFailure]); count++;
}
results.parity.rollSuccessAndCriticalConfigurations = count;
const noCritical = Object.assign(Object.create(RollSD.prototype), { _evaluated: true, total: 15, dice: [{ total: 15, faces: 20 }], options: { dc: 10, canCritical: true, criticalSuccessAt: 0, criticalFailureAt: 0 } });
const moduleNoCritical = evaluateOutcome({ dc: 10, critical: { success: 0, failure: 0 } }, 15, 15);
results.defects.disabledCritical = { nativeCriticalSuccess: noCritical.criticalSuccess, moduleCriticalSuccess: moduleNoCritical.criticalSuccess };
assert.equal(noCritical.criticalSuccess, false);
function apply(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (key.includes('.')) { const parts = key.split('.'); const leaf = parts.pop(); let p = target; for (const part of parts) p = p[part] ??= {}; p[leaf] = clone(value); }
    else if (value && typeof value === 'object' && !Array.isArray(value)) apply(target[key] ??= {}, value);
    else target[key] = clone(value);
  }
}
let seq = 0;
async function moduleAction(actor, body, fail = '') {
  const events = []; const state = clone(actor);
  const runtime = { documents: { get: async () => clone(state), effects: { update: async (_parent, id, patch) => { events.push(['effect', clone(patch)]); if (fail === 'effect' && id === 'effect') throw Error('controlled effect failure'); for (const item of state.items) { const effect = item.effects?.find(e => e._id === id); if (effect) apply(effect, patch); } } }, items: {
    update: async (_parent, id, patch) => { events.push(['update', clone(patch)]); if (fail === 'update') throw Error('controlled write failure'); apply(state.items.find(i => i._id === id), patch); if (fail === 'update-after') throw Error('controlled lost field receipt'); },
    delete: async (_parent, id) => { events.push(['delete', id]); if (fail === 'delete') throw Error('controlled delete failure'); state.items = state.items.filter(i => i._id !== id); },
  } }, rolls: { roll: async formula => { events.push(['roll']); if (fail === 'roll') throw Error('controlled roll failure'); return { formula, total: 5, terms: [{ faces: 20, results: [{ result: 5, active: true }] }] }; } }, chat: { send: async () => { events.push(['chat']); if (fail === 'chat') throw Error('controlled chat failure'); return {}; } } };
  const response = await handleActorAction(actor._id, { runtime, userSession: { userId: 'offline-audit' }, json: async () => ({ requestId: `broad-audit-${++seq}`, ...body }) });
  return { events, state, status: response.status, body: await response.json() };
}
const ability = { _id: 'ability', name: 'Controlled limited ability', type: 'Class Ability', system: { ability: 'wis', dc: 10, limitedUses: true, loseOnFailure: true, lost: false, uses: { available: 1, max: 1 } }, effects: [] };
results.defects.abilityOrder = [];
for (const failure of ['', 'roll', 'update']) {
  const actor = actorBase(); actor.items = [clone(ability)]; const events = []; const nativeAbility = clone(ability);
  nativeAbility.update = async patch => { events.push(['update', clone(patch)]); if (failure === 'update') throw Error('controlled write failure'); apply(nativeAbility, patch); };
  globalThis.fromUuid = async () => nativeAbility;
  shadowdark.dice.rollFromConfig = async () => { events.push(['roll']); if (failure === 'roll') throw Error('controlled roll failure'); return { success: false }; };
  try { await Player.prototype.useAbility.call({ parent: { uuid: 'Actor.audit' }, rollConfigGenerators: { ability: async config => { config.mainRoll = {}; } } }, 'Actor.audit.Item.ability'); } catch {}
  const actual = await moduleAction(actor, { kind: 'ability', itemId: 'ability' }, failure);
  results.defects.abilityOrder.push({ failure: failure || 'normal', nativeEvents: events, moduleEvents: actual.events, nativeUses: nativeAbility.system.uses.available, moduleUses: actual.state.items[0].system.uses.available, moduleStatus: actual.status });
}
assert.equal(results.defects.abilityOrder[1].nativeUses, 0);


const potion = { _id: 'potion', name: 'Cloudy vial', type: 'Potion', system: { description: 'Cloudy liquid', identification: { identified: false, name: 'Healing Potion', description: 'Known healing effect' } }, effects: [{ _id: 'effect', disabled: true }] };
const nativePotion = clone(potion), nativeEvents = [];
nativePotion.uuid = 'Actor.audit.Item.potion';
nativePotion.update = async patch => { nativeEvents.push('identify'); apply(nativePotion, patch); };
nativePotion.effects[0].update = async patch => { nativeEvents.push('effect'); apply(nativePotion.effects[0], patch); };
nativePotion.system.parent = nativePotion;
Object.defineProperty(nativePotion.system, 'isIdentified', { get: () => nativePotion.system.identification.identified });
nativePotion.system.toggleIdentified = () => Physical.prototype.toggleIdentified.call(nativePotion.system);
globalThis.ChatMessage = { create: async () => { nativeEvents.push('chat'); } };
try { await Player.prototype.usePotion.call({ parent: { id: 'audit', name: 'Audit', items: new Map([['potion', nativePotion]]), deleteEmbeddedDocuments: async () => { nativeEvents.push('delete'); throw Error('controlled delete failure'); } } }, 'potion'); } catch {}
const potionActor = actorBase(); potionActor.items = [potion];
const modulePotion = await moduleAction(potionActor, { kind: 'potion', itemId: 'potion' }, 'delete');
const fields = i => ({ name: i.name, description: i.system.description, identification: i.system.identification, effectDisabled: i.effects[0].disabled });
results.defects.potionDeleteFailure = { native: fields(nativePotion), module: fields(modulePotion.state.items[0]), nativeEvents, moduleEvents: modulePotion.events.map(e => e[0]), moduleState: modulePotion.body.state };
assert.equal(nativePotion.name, 'Healing Potion');
// Independently run the real usePotion/toggleIdentified handlers at each failure
// boundary, including native Promise.all effect activation and empty-name fallback.
results.defects.potionFailureMatrix = [];
for (const failure of ['update', 'update-after', 'effect', 'chat', 'delete', 'empty-name']) {
  const raw = clone(potion); raw.effects.push({_id:'tail',disabled:true});
  if(failure==='empty-name')raw.system.identification.name='';
  const doc=clone(raw), events=[];
  doc.uuid='Actor.audit.Item.potion';
  doc.update=async patch=>{events.push('update');if(failure==='update')throw Error('controlled fields');apply(doc,patch);if(failure==='update-after')throw Error('controlled lost field receipt');};
  for(const effect of doc.effects)effect.update=async patch=>{events.push('effect');if(failure==='effect'&&effect._id==='effect')throw Error('controlled effect');apply(effect,patch);};
  doc.system.parent=doc;Object.defineProperty(doc.system,'isIdentified',{get:()=>doc.system.identification.identified});
  doc.system.toggleIdentified=()=>Physical.prototype.toggleIdentified.call(doc.system);
  globalThis.ChatMessage={create:async()=>{events.push('chat');if(failure==='chat')throw Error('controlled chat');}};
  try { await Player.prototype.usePotion.call({parent:{id:'audit',name:'Audit',items:new Map([['potion',doc]]),deleteEmbeddedDocuments:async()=>{events.push('delete');throw Error('controlled delete');}}},'potion'); }catch{}
  // All cases retain the Item: empty-name reaches the independently failed delete.
  const actor=actorBase();actor.items=[raw];const actual=await moduleAction(actor,{kind:'potion',itemId:'potion'},failure==='empty-name'?'delete':failure);
  const project=item=>({name:item.name,description:item.system.description,identification:item.system.identification,effects:item.effects.map(effect=>({_id:effect._id,disabled:effect.disabled}))});
  results.defects.potionFailureMatrix.push({failure,native:project(doc),module:project(actual.state.items[0]),nativeEvents:events,moduleEvents:actual.events.map(event=>event[0])});
}
const spell = { _id: 'spell', name: 'Controlled NPC spell', type: 'Spell', system: { tier: 1, lost: false, class: [], formula: '', damageType: 'none' }, effects: [] };
const nativeSpell = clone(spell); nativeSpell.update = async patch => apply(nativeSpell, patch); globalThis.fromUuid = async () => nativeSpell;
shadowdark.dice.rollFromConfig = async () => ({ success: false });
await Npc.prototype.castSpell.call({ parent: { uuid: 'Actor.npc' }, rollConfigGenerators: { spell: async () => {} } }, 'Actor.npc.Item.spell', { cast: { focus: true } });
const npc = { _id: 'npc', type: 'NPC', name: 'Controlled NPC', system: { abilities: Object.fromEntries(CONFIG.SHADOWDARK.ABILITY_KEYS.map(k => [k, { mod: 0 }])), spellcasting: { ability: 'int', bonus: 2, attacks: 1 }, attributes: { ac: { value: 12 }, hp: { value: 5, max: 5 } } }, items: [spell], effects: [] };
const moduleNpc = await moduleAction(npc, { kind: 'spell', itemId: 'spell', focus: true });
results.defects.npcFocus = { nativeLost: nativeSpell.system.lost, moduleLost: moduleNpc.state.items[0].system.lost, moduleStatus: moduleNpc.status };
assert.equal(nativeSpell.system.lost, true);
const language = { _id: 'rare', name: 'Star Tongue', type: 'Language', uuid: 'Item.rare', system: { rarity: 'rare' } };
const index = { languages: [] }; ShadowdarkRegistry.categorize('shadowdark.languages', clone(language), index);
const languageRows=[language,{_id:'ca',uuid:'Item.ca',name:'Draconic',type:'Language',system:{rarity:'common'}},{_id:'cb',uuid:'Item.cb',name:'Second common',type:'Language',system:{rarity:'common'}},{_id:'rb',uuid:'Item.rb',name:'Second rare',type:'Language',system:{rarity:'rare'}}];
const zero={system:{languages:{common:0,rare:0,select:0,selectOptions:['Item.rare'],fixed:[]}}};
results.defects.languages={nativeRarity:language.system.rarity,moduleRarity:index.languages[0].rarity,cases:[]};
for(const [name,ancestry,classDoc,intMod] of [
 ['explicit-zero',null,clone(zero),0],
 ['no-implicit-int-common',null,clone(zero),4],
 ['separate-pools',{system:{languages:{common:1,rare:0,select:1,selectOptions:['Item.cb'],fixed:[]}}},{system:{languages:{common:0,rare:1,select:1,selectOptions:['Item.rare'],fixed:[]}}},4],
]){
 const nativeThis={ancestry:clone(ancestry),class:clone(classDoc),formData:{actor:{system:{languages:[],abilities:{int:{mod:intMod}}}},commonLanguages:['Item.ca','Item.cb'],rareLanguages:['Item.rare','Item.rb']},_getRandom:()=>0,
 _updateLangData:NativeGenerator.prototype._updateLangData,_setRandomLanguage:NativeGenerator.prototype._setRandomLanguage};
 await NativeGenerator.prototype._loadLanguages.call(nativeThis);
 const plan=languagePlan(ancestry,classDoc,languageRows);
 const expected=Object.fromEntries(['ancestry','class','common','rare'].map(id=>[id,nativeThis.formData.langData[id].select]));
 const selected=Object.fromEntries(['ancestry','class','common','rare'].map(id=>[id,nativeThis.formData.langData[id].selected]));
 results.defects.languages.cases.push({name,nativeCounts:expected,moduleCounts:Object.fromEntries(plan.groups.map(group=>[group.id,group.count])),nativeSelected:selected,moduleValid:validateLanguageSelections(plan,selected).valid});
}
const checks = [];
function check(id, fn) { try { fn(); checks.push({ id, passed: true }); } catch (error) { checks.push({ id, passed: false, error: error.message }); } }
check('SD02-13 disabled critical thresholds', () => assert.equal(moduleNoCritical.criticalSuccess, noCritical.criticalSuccess));
for (const row of results.defects.abilityOrder) check(`SD02-09 ability ${row.failure}`, () => {
  assert.deepEqual(row.moduleEvents.map(e => e[0]), row.nativeEvents.map(e => e[0]));
  assert.equal(row.moduleUses, row.nativeUses);
});
check('SD02-10 Potion delete failure survives identified', () => assert.deepEqual(results.defects.potionDeleteFailure.module, results.defects.potionDeleteFailure.native));
check('SD02-11 NPC focus cannot prevent loss', () => assert.equal(results.defects.npcFocus.moduleLost, results.defects.npcFocus.nativeLost));
check('SD02-12 native rarity', () => assert.equal(index.languages[0].rarity, language.system.rarity));
for(const row of results.defects.languages.cases)check(`SD02-12 ${row.name} actual native generator`,()=>{assert.deepEqual(row.moduleCounts,row.nativeCounts);assert.equal(row.moduleValid,true);});
for(const row of results.defects.potionFailureMatrix)check(`SD02-10 Potion ${row.failure} native state/order`,()=>{assert.deepEqual(row.module,row.native);assert.deepEqual(row.moduleEvents,row.nativeEvents);});
// Native eligibility methods, independently supplied sanitized prepared grant
// inputs. This is not a full Foundry data-model/effect lifecycle acceptance run.
const classDocuments=new Map(pack('classes').map(doc=>[`Compendium.shadowdark.classes.Item.${doc._id}`,doc]));
const nativeSpells=pack('spells');
const cases=[['L01 missing grant','035nuVkU9q2wtMPs',[],false],['L02 missing Spell Class','035nuVkU9q2wtMPs',['wizard'],true],['L03 source-less Priest',null,['priest'],false],['L04 wrong Knight grant','KGnBAFiTiLHZJUND',['knight-of-st.-ydris'],false]];
// Resolve Priest by the exact Class reference on the pinned granted Spell.
const priestRef=nativeSpells.find(doc=>doc._id==='mByUvcHIVEPWscfH').system.class[0];
results.parity.nativeEligibility=[];
const notify=ui.notifications.error;ui.notifications.error=()=>{};
try {for(const [name,id,grants,missing] of cases){
 const classRef=name.startsWith('L03')?priestRef:`Compendium.shadowdark.classes.Item.${id}`;
 const sourceSpell=nativeSpells.find(doc=>(doc.system.class??[]).includes(classRef));assert.ok(sourceSpell,name);
 const spell=clone(sourceSpell);spell._id='ownedSpell';if(missing)spell.system.class=[];delete spell._stats;
 const actor=actorBase();actor.system.class=name.startsWith('L04')?'Compendium.shadowdark.classes.Item.0uVUOXKuX9xfJ600':classRef;actor.items=[spell];actor.effects=grants.map((grant,index)=>({_id:`grant${index}`,disabled:false,changes:[{key:'system.spellcasting.classes',mode:2,value:grant}]}));
 const nativeData={spellcasting:{classes:grants,allowAllItems:false,itemAbility:''},abilities:Object.fromEntries(['str','dex','con','int','wis','cha'].map(key=>[key,{mod:0}]))};
 globalThis.fromUuid=async uuid=>{if(uuid==='Actor.fixture.Item.ownedSpell')return spell;const doc=classDocuments.get(uuid);if(!doc)return null;return {...clone(doc),system:{...clone(doc.system),isCastingClass:Object.getOwnPropertyDescriptor(NativeClass.prototype,'isCastingClass').get.call(doc.system)}}};
 const caster=Object.getOwnPropertyDescriptor(Player.prototype,'isSpellCaster').get.call(nativeData);
 const ability=await Player.prototype._getSpellcastingAbility.call(nativeData,'Actor.fixture.Item.ownedSpell');
 const action=prepareShadowdarkView(actor,{classDocument:ref=>classDocuments.get(formatUuid(ref))??null}).actions.find(row=>row.kind==='spell');
 check(`SD02-01 ${name} native eligibility`,()=>{assert.equal(action.available,caster&&!!ability);if(action.available)assert.equal(action.ability,ability);});
 results.parity.nativeEligibility.push({name,nativeCaster:caster,nativeAbility:ability,moduleAvailable:action.available,moduleReason:action.reason});
}}finally{ui.notifications.error=notify;}
results.checks = checks;
if (process.env.SHADOWDARK_EVIDENCE) writeFileSync(process.env.SHADOWDARK_EVIDENCE, JSON.stringify(results, null, 2));
const selected=process.argv.includes('--gate=D5a')?checks.filter(row=>!row.id.startsWith('SD02-12')):checks;
if (selected.some(row => !row.passed) && !process.argv.includes('--baseline')) process.exitCode = 1;
console.log(JSON.stringify(results, null, 2));
