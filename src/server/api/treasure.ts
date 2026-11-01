import { weaponBases, tierSpells, spellTier } from '../../logic/treasure-procedures';
import { modifierErrors } from '../../logic/treasure-modifiers';
import { armorBases } from '../../logic/armor-treasure';
import { createHash, randomUUID } from 'node:crypto';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { SdkError, getErrorMessage, isSdkError, processHtmlContent } from '@sheet-delver/sdk';
import { callerOf, canReadPack, contextConflict, requestRevision, requireOwnedActor } from '../access';
import { shadowdarkAdapter as adapter } from '../ShadowdarkAdapter';
import { withActorLock } from '../operation-lock';
import { documentId, parseUuid, canonicalUuid } from '../../logic/identity';
import { continueLibrary, reconcileLibrary, type LibrarySave } from '../treasure-library';
import { CRAWLING_KIT_UUID, TREASURE_TYPES, treasureFolder, treasureUnchanged, treasureErrors, treasurePayload, type TreasureDraft } from '../../logic/treasure';
import { ORIGINAL_TABLES, ORIGINAL_TABLE_VERSION } from '../../data/original-tables';
import { originalSelection } from '../../logic/original-tables';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
function gm(req: ModuleServerRequest) { if (!callerOf(req).isGM) throw new SdkError('permission_denied', 'Treasure & Items requires a Gamemaster.'); }
function scope(req: ModuleServerRequest) {
    gm(req);
    const world = req.runtime.world?.snapshot().identity;
    const user = req.userSession?.userId ?? req.getAccessContext?.().userId;
    if (!world || !user || !req.runtime.dataStore) throw new SdkError('not_ready', 'The current world is not ready.');
    return hash([world.instanceId, world.worldId, user]);
}
function current(req: ModuleServerRequest, revision: number | null) {
    gm(req);
    if (contextConflict(req.runtime, revision)) throw new SdkError('conflict', 'Sources changed. Refresh sources and review again.');
}
const route = async (req: ModuleServerRequest, method: string, run: () => Promise<unknown>) => {
    const revision = requestRevision(req.runtime);
    try {
        gm(req);
        if (req.method !== method) return json({ error: 'Method not allowed' }, { status: 405 });
        const result = await run(); current(req, revision); return json({ success: true, ...result as object });
    } catch (e) { return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e)); }
};
async function collection(req: ModuleServerRequest, id: string) {
    try { return await adapter.getCollection(id, { caller: callerOf(req) }); }
    catch (e) { if (isSdkError(e) && e.code === 'permission_denied') return []; throw e; }
}
async function exact(req: ModuleServerRequest, uuid: string, type?: string) {
    const ref = parseUuid(uuid);
    if (ref?.kind !== 'compendium') throw new SdkError('validation', 'Choose an exact compendium source.');
    const doc = await adapter.resolveDocumentFor(uuid, callerOf(req));
    if (!doc || (type && doc.type !== type)) throw new SdkError('not_found', 'This source is unavailable. Refresh sources or enter a manual result.');
    return { ...doc, uuid };
}
export const handleTreasureCatalog = (req: ModuleServerRequest) => route(req, 'GET', async () => {
    const [tables, gear, magic, spells, actors, classes] = await Promise.all([
        collection(req,'tables'), collection(req,'gear'), collection(req,'magic-items'), collection(req,'spells'),
        req.runtime.documents.list('Actor', { filter: { type: 'Player' } }, { minOwnership: 'owner' }),
        collection(req,'classes'),
    ]);
    const label = (d: any) => req.runtime.access?.packs().find(p => p.id === d.pack)?.label ?? d.pack ?? '';
    const options = (docs: any[]) => docs.filter(d => {
        const ref = parseUuid(d.uuid);
        return ref?.kind === 'compendium' && canReadPack(callerOf(req),ref.pack);
    }).map(d => ({ ...d, source: label(d) }));
    const classNames=new Map(options(classes).filter(d=>d.type==='Class').map(d=>[canonicalUuid(d.uuid),d.name]));
    return { tables: options(tables).filter(d=>d.uuid==='Compendium.shadowdark.rollable-tables.RollTable.Pi9nnnLeXpTKCSMY').map(d => ({ uuid: d.uuid, name: d.name, source: d.source, formula: d.formula })),
        items: options([...gear,...magic].filter(d => TREASURE_TYPES.includes(d.type) && d.uuid !== CRAWLING_KIT_UUID)),
        spells: options(spells).map(d => ({ uuid: d.uuid, name: d.name, type: d.type, img: d.img, source: d.source, tier: d.system?.tier,
            classes: (Array.isArray(d.system?.class)?d.system.class:[]).map((ref:unknown)=>classNames.get(canonicalUuid(ref))??'Class unavailable') })),
        actors: actors.rows.filter((a: any) => a.type === 'Player').map((a: any) => ({ id: documentId(a), name: a.name })) };
});

export const handleTreasureDraw = (req: ModuleServerRequest) => route(req, 'POST', async () => {
    const body = await req.json<any>(), revision = requestRevision(req.runtime), s = scope(req);
    const table = await exact(req, body?.uuid);
    if (parseUuid(body.uuid)?.documentType !== 'RollTable' || !Array.isArray(table.results) || !/^\d{1,2}d\d{1,5}$/.test(table.formula ?? ''))
        throw new SdkError('validation', 'This table cannot be rolled here. Enter its result manually.');
    const roll = await req.runtime.rolls.roll(table.formula, table.name, { displayChat: false });
    const result = await adapter.drawTable(body.uuid, callerOf(req), roll.total);
    current(req, revision);
    if (!result?.results?.length) throw new SdkError('validation', 'No matching table result. Enter the result manually.');
    const fresh = await exact(req, body.uuid);
    if (hash(fresh) !== hash(table)) throw new SdkError('conflict', 'The table changed during the roll. Review its current source.');
    const draw = { id: randomUUID(), tableUuid: body.uuid, name: table.name, sourceHash: hash(table), total: roll.total,
        results: result.results.map((r: any) => ({ text: String(r.description ?? r.text ?? r.name ?? ''), id: documentId(r) })),
        itemUuids: result.items.filter((d: any) => TREASURE_TYPES.includes(d.type)).map((d: any) => d.uuid), unresolved: result.unresolved };
    await req.runtime.dataStore.set(`treasure-draw-${s}-${draw.id}`, draw);
    return { draw };
});

/** Original module data uses the public roll service, never a fabricated compendium. */
export const handleTreasureOriginalDraw = (req: ModuleServerRequest) => route(req,'POST',async()=>{
    const body=await req.json<any>(), revision=requestRevision(req.runtime);
    scope(req);
    if(body?.version===ORIGINAL_TABLE_VERSION&&body?.table==='tier-spell'){
        if(!/^[1-5]$/.test(body.tier))throw new SdkError('validation','Choose a spell tier first.');
        const spells=tierSpells(await collection(req,'spells'),body.tier).filter(d=>{const ref=parseUuid(d.uuid);return ref?.kind==='compendium'&&canReadPack(callerOf(req),ref.pack);});
        if(!spells.length)throw new SdkError('not_found','No readable spells are available at this tier.');
        const rolled=await req.runtime.rolls.roll(`1d${spells.length}`,'Spell: available sources at selected tier',{displayChat:false});
        current(req,revision);const spell=Number.isInteger(rolled.total)?spells[rolled.total-1]:undefined;
        if(!spell)throw new SdkError('validation','The roll did not produce an available spell.');
        return {spell:{uuid:spell.uuid,total:rolled.total}};
    }
    if(body?.version===ORIGINAL_TABLE_VERSION&&body?.table==='ammunition-quantity'){
        const item=await exact(req,body.uuid);
        if(!weaponBases([item]).length||item.type!=='Basic'||!item.system.isAmmunition)throw new SdkError('validation','Choose native ammunition first.');
        const rolled=await req.runtime.rolls.roll('2d6','Ammunition quantity',{displayChat:false});
        current(req,revision);
        if(!Number.isInteger(rolled.total)||rolled.total<2||rolled.total>12)throw new SdkError('validation','Invalid ammunition quantity.');
        return {quantity:rolled.total};
    }
    if(body?.version===ORIGINAL_TABLE_VERSION&&['armor-type','weapon-type'].includes(body?.table)){
        const weapon=body.table==='weapon-type';
        const bases=(weapon?weaponBases:armorBases)(await collection(req,'gear')).filter(d=>{const ref=parseUuid(d.uuid);return ref?.kind==='compendium'&&canReadPack(callerOf(req),ref.pack);});
        if(!bases.length)throw new SdkError('not_found','No readable base types are available.');
        const roll=await req.runtime.rolls.roll(`1d${bases.length}`,`${weapon?'Weapon':'Armor'} type: available native gear`,{displayChat:false});
        current(req,revision);
        const base=Number.isInteger(roll.total)?bases[roll.total-1]:undefined;
        if(!base)throw new SdkError('validation','The roll did not produce an available base type.');
        return {[weapon?'weaponType':'armorType']:{uuid:base.uuid,total:roll.total}};
    }
    if (body?.version!==ORIGINAL_TABLE_VERSION || typeof body?.table!=='string' || !Object.hasOwn(ORIGINAL_TABLES,body.table))
        throw new SdkError('validation','Choose a current SheetDelver Originals table.');
    const table=ORIGINAL_TABLES[body.table];
    const roll=await req.runtime.rolls.roll(`1d${table.rows.length}`,`SheetDelver Originals: ${table.name}`,{displayChat:false});
    current(req,revision);
    const row=Number.isInteger(roll.total)?table.rows[roll.total-1]:undefined;
    if (!row) throw new SdkError('validation','The roll did not produce an available result.');
    return {part:originalSelection(body.table,row.id,roll.total)};
});

async function prepare(req: ModuleServerRequest, draft: TreasureDraft, actorId: string, library = false) {
    if (!draft || typeof draft !== 'object') throw new SdkError('validation', 'Enter item details.');
    const errors = treasureErrors(draft);
    if (Object.keys(errors).length) return { errors };
    const revision = requestRevision(req.runtime);
    const template = draft.kind === 'template' ? await exact(req, draft.templateUuid) : null;
    const spell = ['Scroll','Wand'].includes(draft.kind) ? await exact(req, draft.spellUuid, 'Spell') : null;
    if(draft.spellItem&&spellTier(spell)!==Number(draft.spellItem.tier))return {errors:{spellUuid:'Choose a spell from the selected tier.'}};
    const modifiers=modifierErrors(draft.modifiers,template?.type??draft.kind);
    if(Object.keys(modifiers).length)return {errors:modifiers};
    const actor = actorId ? await requireOwnedActor(req.runtime, actorId) : null;
    const unchangedSource = treasureUnchanged(draft,template);
    if (!actor && unchangedSource) return { errors: {actorId:'Choose a character to receive this unchanged item.'} };
    if (!actor && !library) throw new SdkError('validation','Choose a player character.');
    if (actor && actor.type !== 'Player') throw new SdkError('validation', 'Choose a player character.');
    const payload = treasurePayload(draft, template, spell);
    payload.system.description = processHtmlContent(payload.system.description);
    // This slice delivers disclosed items only. An unidentified template must be reviewed in Foundry first.
    if (payload.system.identification?.identified === false) throw new SdkError('validation', 'This template is unidentified. Use an identified template for this first version.');
    let draw = null;
    if (draft.drawId) {
        draw = await req.runtime.dataStore.get<any>(`treasure-draw-${scope(req)}-${draft.drawId}`);
        if (!draw) throw new SdkError('conflict', 'The saved table result is unavailable. Clear it to continue manually.');
        const table = await exact(req, draw.tableUuid);
        if (hash(table) !== draw.sourceHash) throw new SdkError('conflict', 'The table changed. Clear the old result or roll its current version.');
    }
    current(req, revision);
    return { review: hash([draft, payload, template, spell, draw, actorId, actor?.name, revision, library]), payload, unchangedSource, actorId, actorName: actor?.name, folderName: treasureFolder(draft,payload),
        spellName: spell?.name, templateName: template?.name, draw, errors: {}, contextRevision: revision };
}
export const handleTreasurePrepare = (req: ModuleServerRequest) => route(req, 'POST', async () => {
    const b = await req.json<any>(); return { plan: await prepare(req,b?.draft,b?.actorId,b?.saveToLibrary===true) };
});
interface Delivery { requestId: string; actorId: string; intent: string; marker: string; itemId?: string; name: string; state: 'dispatched' | 'complete'; provenance: { sourceNote: string; templateUuid: string; spellUuid: string; draw: unknown } }
function receipt(d: Delivery) { return { requestId: d.requestId, actorId: d.actorId, itemId: d.itemId, name: d.name, state: d.state }; }
async function reconcile(req: ModuleServerRequest, key: string, d: Delivery) {
    const actor = await requireOwnedActor(req.runtime,d.actorId);
    if (d.state === 'complete') return receipt(d);
    const matches = (actor.items ?? []).filter((i: any) => i.flags?.shadowdark?.sheetDelver?.treasureOperation === d.marker);
    if (matches.length === 1 && documentId(matches[0])) {
        d = { ...d, state: 'complete', itemId: documentId(matches[0]) };
        await req.runtime.dataStore.set(key,d);
    }
    return receipt(d);
}
export const handleTreasureStatus = (req: ModuleServerRequest) => route(req,'GET',async () => {
    const s = scope(req);
    return withActorLock(`treasure-${s}`,async () => {
        const requested = new URL(req.url,'http://localhost').searchParams.get('requestId');
        if (requested && !/^[\w-]{8,80}$/.test(requested)) throw new SdkError('validation','Invalid delivery request.');
        const active = requested || await req.runtime.dataStore.get<string>(`treasure-active-${s}`);
        const key = `treasure-delivery-${s}-${active}`;
        const d = active ? await req.runtime.dataStore.get<Delivery>(key) : null;
        return { operation: d ? ('mode' in d ? await reconcileLibrary(req,key,d as unknown as LibrarySave) : await reconcile(req,key,d)) : null };
    });
});
export const handleTreasureDeliver = (req: ModuleServerRequest) => route(req,'POST',async () => {
    const b = await req.json<any>(), s = scope(req);
    if (b?.resume === true && /^[\w-]{8,80}$/.test(b.requestId ?? '')) {
        return withActorLock(`treasure-${s}`,async()=>{
            const key=`treasure-delivery-${s}-${b.requestId}`;
            const saved=await req.runtime.dataStore.get<LibrarySave>(key);
            if(saved?.mode!=='library') throw new SdkError('not_found','The saved item operation is unavailable.');
            return {operation:await continueLibrary(req,key,saved)};
        });
    }
    if (!/^[\w-]{8,80}$/.test(b?.requestId ?? '') || typeof b.actorId !== 'string') throw new SdkError('validation','Invalid delivery request.');
    return withActorLock(`treasure-${s}`, async () => {
        const key = `treasure-delivery-${s}-${b.requestId}`, intent = b.saveToLibrary===true ? hash([b.draft,b.actorId,'library']) : hash([b.draft,b.actorId]);
        const previous = await req.runtime.dataStore.get<Delivery>(key);
        if (previous) {
            if (previous.intent !== intent) throw new SdkError('conflict','This request belongs to another item.');
            return { operation: 'mode' in previous ? await continueLibrary(req,key,previous as unknown as LibrarySave) : await reconcile(req,key,previous) };
        }
        const active = await req.runtime.dataStore.get<string>(`treasure-active-${s}`);
        const old = active ? await req.runtime.dataStore.get<Delivery>(`treasure-delivery-${s}-${active}`) : null;
        if (active && (!old || old.state !== 'complete')) throw new SdkError('conflict','Check the previous delivery before adding another item.');
        const plan = await prepare(req,b.draft,b.actorId,b.saveToLibrary===true);
        if (!plan.review || plan.review !== b.review) return { reviewChanged: true, plan };
        if (b.saveToLibrary===true) {
            const d: LibrarySave = {mode:'library',requestId:b.requestId,intent,marker:randomUUID(),name:plan.payload.name,
                actorId:b.actorId,category:b.draft.category??'random',folderName:plan.folderName!,unchangedSource:plan.unchangedSource,state:'pending',payload:plan.payload,revision:plan.contextRevision!,
                provenance:{sourceNote:b.draft.sourceNote,templateUuid:b.draft.templateUuid,draw:plan.draw,mundane:b.draft.mundane,boon:b.draft.boon,armor:b.draft.armor,potion:b.draft.potion,utility:b.draft.utility,spellItem:b.draft.spellItem,weapon:b.draft.weapon,modifiers:b.draft.modifiers,magic:b.draft.magic}};
            await req.runtime.dataStore.set(key,d);
            await req.runtime.dataStore.set(`treasure-active-${s}`,b.requestId);
            return {operation:await continueLibrary(req,key,d)};
        }
        const d: Delivery = { requestId: b.requestId, actorId: b.actorId, intent, marker: randomUUID(), name: plan.payload.name, state: 'dispatched',
            provenance: { sourceNote: b.draft.sourceNote, templateUuid: b.draft.kind === 'template' ? b.draft.templateUuid : '', spellUuid: ['Scroll','Wand'].includes(b.draft.kind) ? b.draft.spellUuid : '', draw: plan.draw } };
        const payload = plan.payload;
        payload.flags = { ...payload.flags, shadowdark: { ...payload.flags?.shadowdark, sheetDelver: { ...payload.flags?.shadowdark?.sheetDelver, treasureOperation: d.marker } } };
        // Durable fence before the sole create. Unknown outcomes never replay.
        await req.runtime.dataStore.set(key,d);
        await req.runtime.dataStore.set(`treasure-active-${s}`,b.requestId);
        current(req,plan.contextRevision!);
        try {
            const created = await req.runtime.documents.items.create({ type:'Actor',id:b.actorId },payload);
            d.itemId = documentId(created) || undefined;
            if (d.itemId) d.state = 'complete';
            await req.runtime.dataStore.set(key,d);
        } catch { /* Keep the dispatched receipt; check exact marker through status. */ }
        return { operation: receipt(d) };
    });
});
