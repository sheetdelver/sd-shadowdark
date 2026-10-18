/** ADR-0002 sanitized source regressions. No operator data or native writes. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { nativePacks } from './core0191/world';
import { ShadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { DECLARED_PACKS, ownedCopy } from '../logic/identity';
import { primLike, worldSnapshot } from './fixtures/native-406';
import { handleFinalizeLevelUp } from '../server/api/level-up';
const nativeRoot = process.env.SHADOWDARK_NATIVE ?? path.resolve(process.cwd(), 'temp/shadowdark');
const packs = nativePacks(nativeRoot, DECLARED_PACKS.map(p => p.id));
const rows = Object.entries(packs).flatMap(([pack, docs]) => docs.map(doc => ({ ...doc, pack, uuid: `Compendium.${pack}.${doc.type === 'Player' || doc.type === 'NPC' ? 'Actor' : pack.endsWith('tables') ? 'RollTable' : 'Item'}.${doc._id}` })));
const byUuid = new Map(rows.map(doc => [doc.uuid, doc]));
const adapter = new ShadowdarkAdapter();
const documents: any = { get: async () => null, list: async () => ({ contents: [] }) };
const caller: any = { runtime: { documents, access: { canReadPack: () => true } }, isGM: false };
await adapter.initialize({ compendium: { findAll: async (type: string) => rows.filter(doc => type === 'Item' ? !['Player','NPC'].includes(doc.type) : type === doc.type), getById: async (pack: string, id: string) => rows.find(doc => doc.pack === pack && doc._id === id) ?? null }, documents, logger: console, world: { snapshot: () => worldSnapshot } } as any);
const KNIGHT = 'Compendium.shadowdark.classes.Item.0uVUOXKuX9xfJ600';
const WITCH = 'Compendium.shadowdark.classes.Item.KGnBAFiTiLHZJUND';
const talent = rows.find(doc => doc._id === 'XRW3jhpTni15hwFc')!;
const checks: any[] = [];
async function check(id: string, fn: () => unknown | Promise<unknown>) { try { await fn(); checks.push({ id, passed: true }); } catch (e) { checks.push({ id, passed: false, error: (e as Error).message }); } }
const knight = () => { const a: any = primLike(); a.items = [{ ...ownedCopy(byUuid.get(KNIGHT), KNIGHT), _id: 'class' }, { ...ownedCopy(talent, talent.uuid), _id: 'talent' }]; a.effects = []; a.system.class = KNIGHT; a.system.level = { value: 2, xp: 35 }; return a; };
await check('SD02-03 Knight progression keeps Knight counts and Witch list', async () => {
    const before = knight(); const input = structuredClone(before);
    const data = await adapter.getLevelUpData(input, undefined, undefined, caller);
    assert.deepEqual(data.spellsToChoose, { 1: 1 });
    assert.equal(data.classUuid, KNIGHT);
    assert.equal(data.availableSpells.length, 46);
    assert.ok(data.availableSpells.every((spell: any) => spell.system.class.includes(WITCH)));
    assert.deepEqual(input, before);
});
await check('SD02-07 crafted advancement missing mandatory spell makes zero writes', async () => {
    const actor = knight(); let writes = 0;
    const req: any = { userSession: { userId: 'sanitized', isGM: true }, runtime: { ...caller.runtime, documents: { ...documents, get: async () => structuredClone(actor), patch: async () => { writes++; }, items: { create: async () => { writes++; } } } }, json: async () => ({ classUuid: KNIGHT, targetLevel: 3, selectedSpells: [], hpRoll: 3 }) };
    const res = await handleFinalizeLevelUp(actor._id, req);
    assert.equal(writes, 0, 'missing required spell must block HP/XP and Item writes');
    assert.equal(res.status, 400);
});
console.log(JSON.stringify({ method: 'Controlled native pack sources and actual module routes; not native acceptance', checks }, null, 2));
if (checks.some(row => !row.passed) && !process.argv.includes('--baseline')) process.exitCode = 1;
