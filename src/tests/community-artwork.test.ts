import assert from 'node:assert/strict';
import { DEFAULT_MONSTER_PORTRAIT, monsterPortraitRef } from '../logic/community-artwork';
import { resolveMonsterArtwork, resolveDisplayArtwork } from '../server/community-artwork';
import { parseUuid } from '../logic/identity';
import { handleBestiaryCard, handleBestiaryList } from '../server/api/bestiary';
import { shadowdarkAdapter } from '../server/ShadowdarkAdapter';

const uuid = 'Compendium.shadowdark.monsters.Actor.sgVqRuCaadRK1P7R';
const portrait = 'https://foundry.example/modules/shadowdark-community-tokens/artwork/portraits/aboleth.webp';
const doc = { _id: 'worldNpc', name: 'Renamed creature', type: 'NPC', img: DEFAULT_MONSTER_PORTRAIT,
    _stats: { compendiumSource: uuid }, system: {}, items: [], effects: [] };
let cases = 0;
async function check(name: string, run: () => unknown | Promise<unknown>) { await run(); cases++; console.log(`PASS ${name}`); }
function runtime() {
    let revision = 1;
    return { world: { snapshot: () => ({ identity: { contextRevision: revision }, settings: {} }),
        assertRevision: (expected: number) => { if (revision !== expected) throw Error('retired'); } },
        retire: () => revision++, access: { canReadPack: () => true, packs: () => [{ id: 'shadowdark.monsters', label: 'Monsters', type: 'Actor' }] },
        documents: { get: async () => structuredClone(doc), list: async () => ({ rows: [structuredClone(doc)] }) } } as any;
}
await check('only native default NPC portraits with exact origins are eligible', () => {
    assert.deepEqual(monsterPortraitRef(doc, parseUuid(uuid)), parseUuid(uuid));
    assert.deepEqual(monsterPortraitRef({ ...doc, img: 'systems/shadowdark/assets/tokens/cowled_token.webp' }, parseUuid(uuid)), parseUuid(uuid), 'pinned native monster pack placeholder');
    assert.deepEqual(monsterPortraitRef(doc, parseUuid('Actor.worldNpc')), parseUuid(uuid));
    for (const value of [{ ...doc, img: 'worlds/custom.webp' }, { ...doc, type: 'Player' }, { ...doc, _stats: {} },
        { ...doc, _stats: { compendiumSource: uuid.replace('.Actor.', '.Item.') } }]) {
        assert.equal(monsterPortraitRef(value, parseUuid('Actor.worldNpc')), null);
    }
});
await check('SDK resolver receives canonical identity; document and fallback remain intact', async () => {
    const r = runtime(), before = structuredClone(doc);
    r.artwork = { resolve: async (id: string, kind: string) => { assert.equal(id, uuid); assert.equal(kind, 'image'); return { status: 'resolved', src: portrait, credit: 'Artist' }; } };
    assert.deepEqual(await resolveMonsterArtwork(r, doc, parseUuid('Actor.worldNpc')), { img: portrait, fallbackImg: doc.img, artworkCredit: 'Artist' });
    assert.deepEqual(doc, before);
});
await check('older hosts, disabled packages, permission denial and errors preserve original art', async () => {
    const r = runtime(); assert.deepEqual(await resolveMonsterArtwork(r, doc, parseUuid(uuid)), { img: doc.img });
    for (const result of [{ status: 'none' }, { status: 'unavailable', reason: 'not-visible' }, { status: 'unavailable', reason: 'asset-unavailable' }]) {
        r.artwork = { resolve: async () => result }; assert.deepEqual(await resolveMonsterArtwork(r, doc, parseUuid(uuid)), { img: doc.img });
    }
    r.artwork = { resolve: async () => { throw Error('retired'); } };
    assert.deepEqual(await resolveMonsterArtwork(r, doc, parseUuid(uuid)), { img: doc.img });
    r.artwork = { resolve: async () => { throw Error('custom art should not call resolver'); } };
    assert.deepEqual(await resolveMonsterArtwork(r, { ...doc, img: portrait }, parseUuid(uuid)), { img: portrait });
});
await check('optional adapter hook preserves custom display images and selects portrait/token intent',async()=>{
    const calls:string[]=[];
    const runtime={signal:new AbortController().signal,artwork:{resolve:async(id:string,kind?:'image'|'token')=>{assert.equal(id,uuid);calls.push(kind!);return{status:'resolved' as const,src:portrait,packageId:'fixture'}}}};
    const context={actor:doc,currentImage:doc.img,purpose:'combat-portrait',imageSource:'actor'};
    assert.equal((await shadowdarkAdapter.resolveDisplayArtwork(context,runtime))?.src,portrait);
    assert.equal((await resolveDisplayArtwork({...context,purpose:'combat-token',imageSource:'token'},runtime))?.src,portrait);
    assert.deepEqual(calls,['image','token']);
    assert.equal(await resolveDisplayArtwork({...context,currentImage:'worlds/custom-token.webp',imageSource:'token'},runtime),null);
    assert.equal(await resolveDisplayArtwork(context,{signal:runtime.signal}),null);
    assert.equal(await resolveDisplayArtwork({...context,actor:{...doc,type:'Player'}},runtime),null);
    const abort=new AbortController();abort.abort();assert.equal(await resolveDisplayArtwork(context,{...runtime,signal:abort.signal}),null);
    assert.equal(calls.length,2);
});
const originalCollection = shadowdarkAdapter.getCollection;
await check('combat copies use host-verified origin without native origin fields',async()=>{
    const copy={...doc,_stats:undefined,name:'Aboleth #1'};
    const before=structuredClone(copy);
    let calls=0;
    const runtime={signal:new AbortController().signal,artwork:{resolve:async(id:string)=>{calls++;assert.equal(id,uuid);return{status:'resolved' as const,src:portrait,packageId:'fixture'}}}};
    const context={actor:copy,currentImage:copy.img,purpose:'combat-portrait',imageSource:'actor',compendiumSourceUuid:uuid};
    assert.equal((await resolveDisplayArtwork(context,runtime))?.src,portrait);
    assert.deepEqual(copy,before);
    assert.equal(await resolveDisplayArtwork({...context,currentImage:'worlds/custom.webp'},runtime),null);
    assert.equal(await resolveDisplayArtwork({...context,compendiumSourceUuid:undefined},runtime),null);
    assert.equal(calls,1);
});
const originalResolve = shadowdarkAdapter.resolveDocumentFor;
try {
    shadowdarkAdapter.getCollection = async () => [{ ...doc, uuid }];
    shadowdarkAdapter.resolveDocumentFor = async () => structuredClone(doc);
    await check('public list and card use shared SDK artwork with caller filtering', async () => {
        const r = runtime(); r.artwork = { resolve: async () => ({ status: 'resolved', src: portrait }) };
        const req = { runtime: r } as any;
        const list: any = await (await handleBestiaryList(req)).json();
        assert.equal(list.entries.length, 2); assert.ok(list.entries.every((row: any) => row.img === portrait && row.fallbackImg === doc.img));
        const card: any = await (await handleBestiaryCard(req, { params: Promise.resolve({ route: ['bestiary', uuid] }) } as any)).json();
        assert.equal(card.card.img, portrait);
        r.access.canReadPack = () => false;
        const restricted: any = await (await handleBestiaryList(req)).json(); assert.equal(restricted.entries.length, 1); assert.equal(restricted.entries[0].source, 'world');
    });
    await check('custom portrait and lost visibility during resolution retire earlier source', async () => {
        for (const changed of [{ ...doc, img: 'worlds/custom.webp' }, null]) {
            const r = runtime(); let current: any = doc;
            r.documents.get = async () => current;
            r.artwork = { resolve: async () => { current = changed; return { status: 'resolved', src: portrait }; } };
            const response = await handleBestiaryCard({ runtime: r } as any, { params: Promise.resolve({ route: ['bestiary', 'Actor.worldNpc'] }) } as any);
            if (changed) { const result: any = await response.json(); assert.equal(result.card.img, changed.img); assert.equal(result.card.fallbackImg, undefined); }
            else assert.equal(response.status, 404);
        }
    });
    await check('pack revocation and world retirement cannot return pending cards', async () => {
        for (const retire of [false, true]) {
            const r = runtime();
            r.artwork = { resolve: async () => { if (retire) r.retire(); else r.access.canReadPack = () => false; return { status: 'resolved', src: portrait }; } };
            const response = await handleBestiaryCard({ runtime: r } as any, { params: Promise.resolve({ route: ['bestiary', uuid] }) } as any);
            assert.equal(response.status, retire ? 409 : 403);
        }
    });
} finally { shadowdarkAdapter.getCollection = originalCollection; shadowdarkAdapter.resolveDocumentFor = originalResolve; }
console.log(`Shadowdark SDK artwork adoption: ${cases} groups passed`);
