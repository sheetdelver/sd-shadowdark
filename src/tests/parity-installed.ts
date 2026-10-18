/** ADR-0002 public installed-archive contracts; controlled upstream, never native acceptance. */
import assert from 'node:assert/strict';
import type { Doc } from './core0191/world';
import type { WorldState, ControlledUpstream } from './core0191/upstream';

export function parityFixtures(packs: Record<string, Doc[]>, wizard: Doc) {
    const sourceClass = packs['shadowdark.classes'].find(row => row._id === '035nuVkU9q2wtMPs')!;
    const worldClass = { ...structuredClone(sourceClass), _id: 'sd02WorldClass', ownership: { default: 0, player: 2 } };
    const actor: Doc = { ...structuredClone(wizard), _id: 'sd02WorldCaster', name: 'SD02 exact dependencies' };
    actor.system.class = 'Item.sd02WorldClass';
    for (const spell of actor.items.filter((row: Doc) => row.type === 'Spell')) spell.system.class = ['Item.sd02WorldClass'];
    const embedded = { ...structuredClone(sourceClass), _id: 'sd02EmbeddedClass' };
    actor.items.push(embedded);
    const ability = structuredClone(packs['shadowdark.class-abilities'].find(row => row._id === 'so8ytbZuqmNvppI7')!);
    ability._id = 'sd02Ability'; actor.items.push(ability);
    const uncertain = { ...structuredClone(ability), _id: 'sd02Uncertain' }; actor.items.push(uncertain);
    const spell = { ...structuredClone(actor.items.find((row: Doc) => row.type === 'Spell')), _id: 'sd02WorldSpell', ownership: { default: 0, player: 2 } };
    delete spell._stats; delete spell.flags?.core?.sourceId;
    return { actor, worldClass, spell };
}

export async function proveParityContracts(options: { context: any; api: string; origin: string; state: WorldState; upstream: ControlledUpstream;
    pass: (text: string) => void; wait: (label: string, operation: () => Promise<any>) => Promise<any>; restart: () => Promise<void> }) {
    const { context, api, origin, state, upstream, pass, wait } = options;
    const actor = state.actors.find(row => row._id === 'sd02WorldCaster')!;
    const get = (url: string) => context.request.get(`${api}${url}`, { headers: { Origin: origin } });
    const post = async (url: string, data: unknown) => {
        const status = await (await get('/api/status')).json();
        return context.request.post(`${api}${url}`, { headers: { Origin: origin, 'X-SheetDelver-Runtime': status.runtimeToken }, data });
    };
    const viewUrl = `/api/modules/shadowdark/actors/${actor._id}/view`;
    const view = async () => { const response = await get(viewUrl); assert.equal(response.status(), 200, await response.text()); return response.json(); };
    let projection = await view();
    assert.ok(projection.actor.derived.actions.filter((row: Doc) => row.kind === 'spell').every((row: Doc) => row.available));
    assert.equal(projection.baseline.length, 71); assert.equal(projection.actor.derived.resolvedNames.class, 'Wizard');
    pass('SD02 world Class dependencies, normalized labels and compact source review through installed caller view');
    const oldSource = structuredClone(actor);
    const changeRefs = (reference: string) => {
        const system = { ...structuredClone(actor.system), class: reference };
        const items = structuredClone(actor.items);
        for (const item of items.filter((row: Doc) => row.type === 'Spell')) item.system.class = [reference];
        upstream.externalUpdate('Actor', [{ _id: actor._id, system, items }]);
    };
    changeRefs(`Actor.${actor._id}.Item.sd02EmbeddedClass`);
    await wait('embedded exact reference visible', async () => (await view()).actor.system.class.startsWith('Actor.') || false);
    projection = await view(); assert.ok(projection.actor.derived.actions.filter((row: Doc) => row.kind === 'spell').every((row: Doc) => row.available));
    pass('SD02 Actor-embedded Class read uses exact public caller parent/Item identity');
    changeRefs('Item.sd02WorldClass');
    await wait('world source restored', async () => (await view()).actor.system.class === 'Item.sd02WorldClass' || false);
    projection = await view();
    const removal = actor.items.find((row: Doc) => row.type === 'Spell')!;
    const body = { requestId: 'sd02-installed-management', baseline: projection.baseline, listUuid: 'Item.sd02WorldClass', tier: removal.system.tier, additions: ['Item.sd02WorldSpell'], removals: [removal._id] };
    const beforeCount = actor.items.length, beforeWrites = upstream.writes.length;
    const managed = await post(`/api/modules/shadowdark/actors/${actor._id}/spells/manage`, body);
    assert.equal(managed.status(), 200, await managed.text()); assert.equal((await managed.json()).state, 'complete');
    assert.equal(actor.items.length, beforeCount); assert.ok(!actor.items.some((item: Doc) => item._id === removal._id));
    const created = actor.items.find((row: Doc) => row._stats?.compendiumSource === 'Item.sd02WorldSpell');
    assert.ok(created); assert.deepEqual(created.system, state.items.find(row => row._id === 'sd02WorldSpell')!.system);
    assert.equal(upstream.writes.length, beforeWrites + 2);
    pass('SD02 installed explicit replacement preserves native Spell source and records independent create/delete receipts');
    const actionUrl = `/api/modules/shadowdark/actors/${actor._id}/actions`;
    const action = { requestId: 'sd02-installed-ability', kind: 'ability', itemId: 'sd02Ability' };
    const first = await post(actionUrl, action); assert.equal(first.status(), 200, await first.text()); assert.equal((await first.json()).state, 'complete');
    assert.equal(actor.items.find((row: Doc) => row._id === 'sd02Ability').system.uses.available, 0);
    const uncertain = { requestId: 'sd02-installed-uncertain', kind: 'ability', itemId: 'sd02Uncertain' };
    upstream.failAfterWrite = record => record.uuid.endsWith('Item.sd02Uncertain') ? 'Controlled lost acknowledgement after spend' : null;
    const partial = await post(actionUrl, uncertain); assert.equal(partial.status(), 200, await partial.text()); assert.equal((await partial.json()).state, 'partial');
    upstream.failAfterWrite = undefined;
    const finalWrites = upstream.writes.length, finalChat = state.chat.length;
    await options.restart();
    const replay = await post(`/api/modules/shadowdark/actors/${actor._id}/spells/manage`, body);
    assert.equal(replay.status(), 200, await replay.text()); assert.equal((await replay.json()).replayed, true);
    const replayAction = await post(actionUrl, action); assert.equal(replayAction.status(), 200, await replayAction.text()); assert.equal((await replayAction.json()).state, 'complete');
    const replayUnknown = await post(actionUrl, uncertain); assert.equal(replayUnknown.status(), 200, await replayUnknown.text()); assert.equal((await replayUnknown.json()).retryable, false);
    assert.equal(upstream.writes.length, finalWrites); assert.equal(state.chat.length, finalChat);
    pass('SD02 genuine Core process restart: completed management/action receipts replay without writes; uncertain spend never repeats result');
    // The native Array setting must refresh this same caller's catalog.
    const catalogResponse = await get('/api/modules/shadowdark/fetch-pack/spells');
    assert.equal(catalogResponse.status(),200); const catalogBefore = await catalogResponse.json();
    assert.equal(catalogBefore.state,'complete');
    const ownBefore = structuredClone(actor.items);
    upstream.setSetting('shadowdark.sourceFilters',['sd02-no-published-source']);
    await wait('Array sourceFilters refreshed',async()=>{ const response=await get('/api/modules/shadowdark/fetch-pack/spells'); const catalog=await response.json(); return response.status()===200 && catalog.rows.length<catalogBefore.rows.length || false; });
    assert.deepEqual(actor.items,ownBefore); upstream.setSetting('shadowdark.sourceFilters',[]);
    await wait('Array sourceFilters restored',async()=>{const response=await get('/api/modules/shadowdark/fetch-pack/spells');return (await response.json()).rows.length===catalogBefore.rows.length||false;});
    pass('SD02 public Array sourceFilters context refresh filters catalog and preserves every owned Item');
    // A changed exact source is not authorized by an old completed review.
    const stale = await post(`/api/modules/shadowdark/actors/${actor._id}/spells/manage`, { ...body, requestId: 'sd02-installed-stale' });
    assert.equal(stale.status(), 409, await stale.text());
    for (const [ownership, status] of [[2, 200], [1, 404], [0, 404]] as const) {
        upstream.externalUpdate('Actor', [{ _id: actor._id, ownership: { default: 0, player: ownership } }]);
        await wait(`caller view ownership ${ownership}`, async () => (await get(viewUrl)).status() === status || false);
        const denied = await post(actionUrl, { ...action, requestId: `sd02-denied-${ownership}` });
        assert.equal(denied.status(), ownership === 2 ? 403 : 404, await denied.text());
    }
    upstream.externalUpdate('Actor', [{ _id: actor._id, ownership: oldSource.ownership }]);
    await wait('owner restoration', async () => (await get(viewUrl)).status() === 200 || false);
    pass('SD02 installed OBSERVER read/403 write and LIMITED/NONE concealment404; owner restoration and stale review rejection');
}
