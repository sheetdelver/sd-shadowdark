import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readChanges } from '../logic/effects';
import { prepareActorCore } from '../logic/actor-preparation';
import snapshot from './fixtures/native-412-effect-keys.json';

// Separate from the 4.0.6 conformance oracle: 4.1.2 packs use native v14 effects.
// This qualifies version admission and existing data readers, not all new rules.
const root = process.env.SHADOWDARK_FORWARD_NATIVE_REF;
if (!root) throw new Error('Set SHADOWDARK_FORWARD_NATIVE_REF to the pinned release-4.1.2 source checkout');
assert.equal(JSON.parse(readFileSync(join(root, 'system/system.json'), 'utf8')).version, '4.1.2');
const packs = join(root, 'data/packs');
const docs: any[] = readdirSync(packs).sort().flatMap(pack => readdirSync(join(packs, pack)).sort().map(file => JSON.parse(readFileSync(join(packs, pack, file), 'utf8'))));
const parents = new Map(docs.filter(doc => !doc._key.includes('.effects!') && doc._key.split('!').length >= 3)
    .map(doc => [doc._key.split('!')[2], new Set(doc.effects ?? [])]));
const keys = new Set<string>();
for (const doc of docs.filter(doc => doc._key.includes('.effects!'))) {
    const full = doc._key.split('!')[2], at = full.lastIndexOf('.');
    if (!parents.get(full.slice(0, at))?.has(full.slice(at + 1))) continue;
    const parsed = readChanges(doc);
    assert.equal(parsed.diagnostics.length, 0, doc.name);
    parsed.changes.forEach(change => keys.add(change.key));
}
assert.deepEqual([...keys].sort(), snapshot.keys);
const talent = docs.find(doc => doc._id === 'HzzgAIdhoAyfeItJ');
const effect = docs.find(doc => doc._id === 'AmcPerJgnykmMwVA');
const actor = { _id: 'offline', type: 'Player', name: 'Offline', effects: [], system: {
    abilities: Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map(key => [key, { value: 10 }])),
    attributes: { hp: { value: 4, max: 4 }, ac: { value: 10 } }, level: { value: 4 },
}, items: [1, 3].map(level => ({ ...structuredClone(talent), _id: `award-${level}`, system: { ...talent.system, level }, effects: [structuredClone(effect)] })) };
assert.equal(prepareActorCore(actor, { classDocument: () => null, spellDocument: () => null, propertyName: () => null }).effective.bonus.backstabdice, 2);
const nativeMigration = readFileSync(join(root, 'system/src/migrations/updates/Update_251001_1.mjs'));
assert.equal(createHash('sha256').update(nativeMigration).digest('hex'), '0bed7ed1f94fd0ffb9eb95a013d166eccce05e01da0d36d80a2b82d14aaca190', 'legacy effect-key transformation remains identical to 4.0.6');
console.log('Native 4.1.2 admission evidence: pack effect reader, Backstab stacking and unchanged legacy migration passed');
