/** SD02-R2: final write boundary, real shared preparation, native fixed grants/spells. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { nativePacks } from './core0191/world';
import { shadowdarkAdapter as adapter } from '../server/ShadowdarkAdapter';
import { DECLARED_PACKS, ownedCopy } from '../logic/identity';
import { creationGrants } from '../logic/creation-grants';
import { primLike, worldSnapshot } from './fixtures/native-406';
import { handleFinalizeLevelUp } from '../server/api/level-up';
import { handleCreateCharacter } from '../server/api/languages';
const packs = nativePacks(process.env.SHADOWDARK_NATIVE ?? path.resolve('temp/shadowdark'), DECLARED_PACKS.map(p => p.id));
const rows: any[] = Object.entries(packs).flatMap(([pack, docs]) => docs.map(doc => ({ ...doc, pack, uuid: `Compendium.${pack}.${['Player','NPC'].includes(doc.type) ? 'Actor' : pack.endsWith('tables') ? 'RollTable' : 'Item'}.${doc._id}` })));
const byUuid = new Map(rows.map(doc => [doc.uuid, doc]));
const WIZARD = 'Compendium.shadowdark.classes.Item.035nuVkU9q2wtMPs';
const zero = { common: 0, rare: 0, select: 0, selectOptions: [], fixed: [] };
// Explicit world fixture: native Wizard rules/grants, exact Wizard alternate
// list, zero language pools solely to isolate the spell requirement.
const cls = { ...structuredClone(byUuid.get(WIZARD)), _id: 'reviewClass', uuid: 'Item.reviewClass' };
cls.system.languages = structuredClone(zero); cls.system.spellcasting.class = WIZARD;
const ancestry = { _id: 'reviewAncestry', uuid: 'Item.reviewAncestry', type: 'Ancestry', name: 'Zero-pool review ancestry', system: { languages: zero } };
const spellRows = rows.filter(doc => doc.type === 'Spell' && doc.system.tier === 1 && doc.system.class.includes(WIZARD));
const writes: any[] = []; let revision = 1;
const compendium = { findAll: async () => rows, getById: async (_type: string, uuid: string) => structuredClone(byUuid.get(uuid) ?? null) };
const runtime: any = { world: { snapshot: () => worldSnapshot(revision), assertRevision: (value: number) => { if (value !== revision) throw new Error('Retired context'); } }, access: { canReadPack: () => true }, compendium,
    documents: { get: async (type: string, id: string) => type === 'Item' ? structuredClone(id === cls._id ? cls : id === ancestry._id ? ancestry : null) : null,
        list: async () => ({ rows: [], total: 0 }), create: async (type: string, data: any) => { writes.push({ type, data: structuredClone(data) }); return { ...data, _id: 'created' }; } } };
await adapter.initialize({ ...runtime, logger: console } as any);
const languages = { ancestry: [], class: [], common: [], rare: [] };
const req = (body: any): any => ({ runtime, userSession: { userId: 'offline-owner' }, json: async () => structuredClone(body) });
const choices = () => ({ targetLevel: 1, classUuid: cls.uuid, ancestryUuid: ancestry.uuid, selectedSpells: spellRows.slice(0,3), hpRoll: 3, languageChoices: languages });
async function prepared(input: any = choices()) {
    const response = await handleFinalizeLevelUp('new', req(input)); const plan: any = await response.json(); assert.equal(response.status, 200, JSON.stringify(plan)); const actor: any = primLike(); actor.effects = []; actor.system.class = cls.uuid; actor.system.ancestry = ancestry.uuid; actor.system.languages = [];
    actor.items = creationGrants(plan.items); actor.flags = { unknown: { preserve: ['a','b'] } };
    return { actor, creationPlan: plan.creationPlan ?? { choices: input, review: 'pre-correction-unbound', contextRevision: revision }, languageChoices: languages };
}
async function post(body: any) { const response = await handleCreateCharacter(req(body)); return { status: response.status, body: await response.json() as any }; }
const checks: any[] = [];
async function check(name: string, run: () => Promise<void>) { try { await run(); checks.push({ name, pass: true }); } catch (e) { checks.push({ name, pass: false, error: String(e) }); } }
async function rejected(body: any, status?: number) { const before = writes.length; const result = await post(body); if (status) assert.equal(result.status, status, JSON.stringify(result)); else assert.ok(result.status! >= 400, JSON.stringify(result)); assert.equal(writes.length, before); }
await check('review reproducer: three native fixed talents without three required spells is refused', async () => {
    const actor: any = primLike(); actor.effects = []; actor.system.class = cls.uuid; actor.system.ancestry = ancestry.uuid; actor.system.languages = [];
    actor.items = [ownedCopy(cls,cls.uuid), ...cls.system.talents.map((uuid: string) => ownedCopy(byUuid.get(uuid), uuid))];
    assert.equal(cls.system.spellcasting.spellsknown['1']['1'], 3); await rejected({ actor, languageChoices: languages },400);
});
await check('valid caster final write preserves all planned native arrays/effects/unknown fields', async () => {
    const body = await prepared(); const before = structuredClone(body); const result = await post(body); assert.equal(result.status,200,JSON.stringify(result));
    assert.deepEqual(writes.at(-1).data, before.actor); assert.deepEqual(body,before);
    const spells = writes.at(-1).data.items.filter((item: any) => item.type === 'Spell'); assert.equal(spells.length,3);
    assert.ok(spells.every((spell: any) => spell.system.class.includes(WIZARD))); assert.ok(writes.at(-1).data.items.some((item: any) => item.effects?.length));
});
await check('missing/excess/duplicate/wrong-tier/wrong-list final Items never create Actor', async () => {
    const valid = await prepared(); const spells = valid.actor.items.filter((item: any) => item.type === 'Spell');
    for (const alter of [
        (b: any) => { b.actor.items = b.actor.items.filter((i: any) => i !== b.actor.items.find((x: any) => x.type === 'Spell')); },
        (b: any) => b.actor.items.push(ownedCopy(spellRows[3],spellRows[3].uuid)),
        (b: any) => b.actor.items.push(structuredClone(spells[0])),
        (b: any) => { b.actor.items.find((i: any) => i.type === 'Spell').system.tier = 2; },
        (b: any) => { b.actor.items.find((i: any) => i.type === 'Spell').system.class = ['Item.wrongList']; },
    ]) { const body = structuredClone(valid); alter(body); await rejected(body); }
});
await check('crafted plan choices are revalidated: missing/excess/duplicates/wrong-tier/wrong-list', async () => {
    const valid = await prepared();
    const higher = rows.find(d => d.type === 'Spell' && d.system.tier === 2 && d.system.class.includes(WIZARD));
    const other = rows.find(d => d.type === 'Spell' && d.system.tier === 1 && !d.system.class.includes(WIZARD));
    for (const selectedSpells of [[],spellRows.slice(0,4),[spellRows[0],spellRows[0],spellRows[1]],[higher,...spellRows.slice(0,2)],[other,...spellRows.slice(0,2)]]) {
        const body = structuredClone(valid); body.creationPlan.choices.selectedSpells = selectedSpells; await rejected(body);
    }
});
await check('same quota but changed native source invalidates old prepared plan', async () => {
    const body = await prepared(); cls.system.reviewMarker = { changed: true };
    try { await rejected(body,409); } finally { delete cls.system.reviewMarker; }
});
await check('changed progression and stale world revision cannot create Actor', async () => {
    const body = await prepared(); cls.system.spellcasting.spellsknown['1']['1'] = 4;
    try { await rejected(body,400); } finally { cls.system.spellcasting.spellsknown['1']['1'] = 3; }
    revision++; try { await rejected(body,409); } finally { revision--; }
});
await check('extra native Talent spell is separate from three ordinary required spells', async () => {
    const input: any = choices(); input.rolledTalents = [byUuid.get('Compendium.shadowdark.talents.Item.Ey3P0EplF5SHIdey')];
    input.extraSpellSelection = { active: true, selected: [spellRows[3]] };
    const body = await prepared(input); assert.equal(body.actor.items.filter((i: any) => i.type === 'Spell').length,4); assert.equal((await post(body)).status,200);
    const missing = structuredClone(body); missing.creationPlan.choices.selectedSpells = spellRows.slice(0,2); await rejected(missing,400);
    const overlap = structuredClone(body); overlap.creationPlan.choices.extraSpellSelection.selected = [spellRows[0]]; await rejected(overlap,400);
});
await check('altered native fields/effects/source identity are refused, unchanged preserved', async () => {
    const valid = await prepared();
    for (const alter of [
        (b: any) => { b.actor.items.find((i: any) => i.type === 'Spell')._stats.compendiumSource = spellRows[3].uuid; },
        (b: any) => { b.actor.items.find((i: any) => i.effects?.length).effects = []; },
        (b: any) => { b.actor.items.find((i: any) => i.type === 'Class').system.unknown = ['injected']; },
    ]) { const body = structuredClone(valid); alter(body); await rejected(body,400); }
});
await check('a native fixed granted Spell cannot fill ordinary starting quotas', async () => {
    const saved = structuredClone(cls), PRIEST = 'Compendium.shadowdark.classes.Item.oZWzXx1WRLg286zD';
    Object.assign(cls, structuredClone(byUuid.get(PRIEST)), { _id: 'reviewClass', uuid: 'Item.reviewClass' });
    cls.system.languages = structuredClone(zero); cls.system.spellcasting.class = PRIEST;
    try {
        const ordinary = rows.filter(d => d.type === 'Spell' && d.system.tier === 1 && d.system.class.includes(PRIEST) && d.uuid !== 'Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH');
        const input = { ...choices(), selectedSpells: ordinary.slice(0,2) };
        const valid = await prepared(input); assert.equal((await post(valid)).status,200);
        valid.creationPlan.choices.selectedSpells = [ordinary[0], byUuid.get('Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH')];
        await rejected(valid,400);
    } finally { for (const key of Object.keys(cls)) delete cls[key]; Object.assign(cls,saved); }
});
await check('valid level-zero creation retains its independent language/inventory contract', async () => {
    const actor: any = primLike(); actor.system.level.value = 0; actor.system.class = ''; actor.system.ancestry = ancestry.uuid; actor.system.languages = []; actor.effects = []; actor.items = [{ type: 'Spell', name: 'Custom inventory', system: { class: [], tier: 9, custom: true } }];
    const before = structuredClone(actor); assert.equal((await post({actor,languageChoices:languages})).status,200); assert.deepEqual(writes.at(-1).data,before);
});
console.log(JSON.stringify({ scope: 'Offline real final writer/shared preparation with exact native sources; not native acceptance', checks },null,2));
if(checks.some(c=>!c.pass))process.exitCode=1;
