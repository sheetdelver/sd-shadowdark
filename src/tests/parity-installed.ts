/** ADR-0002 public installed-archive contracts; controlled upstream, never native acceptance. */
import assert from 'node:assert/strict';
import { userSession } from './core0191/core';
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
    const exact = new Map<string,Doc>(Object.entries(state.packs).flatMap(([pack, docs]) => docs.map(doc => [`Compendium.${pack}.Item.${doc._id}`, doc] as const)));
    const ancestryUuid = actor.system.ancestry;
    const planResponse = await post('/api/modules/shadowdark/languages/plan',{ancestryUuid});
    assert.equal(planResponse.status(),200,await planResponse.text()); const plan=await planResponse.json(); assert.deepEqual(plan.errors,[]);
    const choices: Record<string,string[]>={},used=new Set<string>(plan.fixed);
    for(const group of plan.groups){choices[group.id]=group.options.filter((uuid:string)=>!used.has(uuid)).slice(0,group.count);assert.equal(choices[group.id].length,group.count);choices[group.id].forEach(uuid=>used.add(uuid));}
    const sourceItems = (exact.get(ancestryUuid)!.system.talents??[]).map((uuid:string)=>{
        const source=structuredClone(exact.get(uuid)!);delete source._id;source._stats={...(source._stats??{}),compendiumSource:uuid};return source;
    });
    const preservedSpellUuid='Compendium.shadowdark.spells.Item.mByUvcHIVEPWscfH';
    const preservedSpell=structuredClone(exact.get(preservedSpellUuid)!);delete preservedSpell._id;preservedSpell._stats={...(preservedSpell._stats??{}),compendiumSource:preservedSpellUuid};sourceItems.push(preservedSpell);
    // The controlled upstream does not run Foundry's embedded-ID allocator.
    // Supply explicit fixture IDs so restart enumeration has valid identities.
    sourceItems.forEach((item:Doc,index:number)=>{item._id=`sd02Created${String(index).padStart(5,'0')}`;});
    const creationSource={name:'SD02 validated creation',type:'Player',system:{...structuredClone(actor.system),class:'',ancestry:ancestryUuid,level:{value:0,xp:0},languages:[...used]},items:sourceItems,effects:[],flags:{sd02:{preserve:true}}};
    const createdResponse=await post('/api/modules/shadowdark/characters/create',{actor:creationSource,languageChoices:choices});
    assert.equal(createdResponse.status(),200,await createdResponse.text());const creation=await createdResponse.json();
    const createdActor=state.actors.find(row=>row._id===creation.id)!;assert.ok(createdActor);assert.deepEqual(createdActor.system,creationSource.system);assert.deepEqual(createdActor.items,sourceItems);
    assert.equal(upstream.writes.at(-1)!.socketUser,'player');
    // Minimal public reproduction of the generic Core writer's historical
    // string-array cleaning. The module creation route above bypasses that
    // writer through the documented SDK, without repairing source afterwards.
    const genericResponse=await post('/api/actors',{...creationSource,name:'SD02 generic writer control'});
    assert.equal(genericResponse.status(),200,await genericResponse.text());const generic=await genericResponse.json();
    const genericActor=state.actors.find(row=>row._id===(generic.id??generic.actor?._id))!;assert.ok(genericActor);
    const genericSpell=genericActor.items.find((row:Doc)=>row._stats?.compendiumSource===preservedSpellUuid)!;assert.ok(genericSpell);
    assert.equal(genericSpell.system.class,undefined);assert.ok(createdActor.items.find((row:Doc)=>row._stats?.compendiumSource===preservedSpellUuid).system.class.length);
    pass('SD02 public generic Actor-create control loses Spell Class arrays; module SDK creation preserves them without caller-side repair');
    const invalidBefore=upstream.writes.length;const invalidCreation=await post('/api/modules/shadowdark/characters/create',{actor:creationSource,languageChoices:{...choices,common:['Item.notInPool']}});
    assert.equal(invalidCreation.status(),400);assert.equal(upstream.writes.length,invalidBefore);
    pass('SD02 installed Generator creation validates language pools before caller-bound SDK write and preserves source fields/effects');
    const importSource={name:'SD02 native import',class:'Basilisk',level:1,maxHitPoints:5,rolledStats:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10}};
    const gm=await userSession(api,origin,'service');
    const importResponse=await gm.post('/api/modules/shadowdark/import',importSource);const importText=await importResponse.text();assert.equal(importResponse.status,200,importText);const imported=JSON.parse(importText);assert.equal(imported.success,true,JSON.stringify(imported));
    const importedActor=state.actors.find(row=>row._id===imported.id)!;assert.equal(importedActor.system.class,'Compendium.shadowdark.classes.Item.WWzTbubXXXfl2vXY');
    const importedClass=exact.get(importedActor.system.class)!;
    for(const uuid of importedClass.system.talents??[]){const item=importedActor.items.find((row:Doc)=>row._stats?.compendiumSource===uuid);assert.ok(item,uuid);assert.deepEqual(item.effects,exact.get(uuid)!.effects);}
    pass('SD02 installed GM curated exact-source import retains Class identity and complete fixed native effects');
    const viewUrl = `/api/modules/shadowdark/actors/${actor._id}/view`;
    const view = async () => { const response = await get(viewUrl); assert.equal(response.status(), 200, await response.text()); return response.json(); };
    let projection = await view();
    assert.ok(projection.actor.derived.actions.filter((row: Doc) => row.kind === 'spell').every((row: Doc) => row.available));
    assert.equal(projection.baseline.length, 71); assert.equal(projection.actor.derived.resolvedNames.class, 'Wizard');
    pass('SD02 world Class dependencies, normalized labels and compact source review through installed caller view');
    const gmView=await gm.get(viewUrl);assert.equal(gmView.status,200);
    const worldClass=state.items.find(row=>row._id==='sd02WorldClass')!,previousOwnership=structuredClone(worldClass.ownership);
    upstream.externalUpdate('Item',[{_id:worldClass._id,ownership:{default:0,player:0}}]);
    await wait('private Class retired',async()=>{const result=await view();return result.actor.derived.spellModel.sources.length===0||false;});
    const privateView=await view();assert.ok(privateView.actor.derived.actions.filter((row:Doc)=>row.kind==='spell').every((row:Doc)=>!row.available));
    assert.notEqual(privateView.actor.derived.resolvedNames.class,'Wizard');
    upstream.externalUpdate('Item',[{_id:worldClass._id,ownership:previousOwnership}]);
    await wait('world Class permission restored',async()=>(await view()).actor.derived.spellModel.sources.length>0||false);
    pass('SD02 GM/world source warm read cannot leak denied Class labels or enable casting for another caller');
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
    assert.equal(managed.status(), 200, await managed.text()); assert.equal((await managed.json()).state, 'complete',JSON.stringify(await managed.json()));
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
