import { createHash, randomUUID } from 'node:crypto';
import { SdkError } from '@sheet-delver/sdk';
import type { ModuleServerRequest } from '@sheet-delver/sdk/server';
import { requireOwnedActor, contextConflict, requestRevision } from './access';
import { withActorLock } from './operation-lock';
import { documentId, ownedCopy } from '../logic/identity';

export interface LibrarySave {
    mode: 'library'; requestId: string; intent: string; marker: string; name: string;
    unchangedSource?: boolean; actorId: string; category: string; folderName: string; worldItemId?: string; itemId?: string;
    state: 'pending'|'saving'|'saved'|'assigning'|'complete'; payload: any; revision: number | null;
    provenance?: unknown;
}
export const libraryReceipt = (d: LibrarySave) => ({ mode:d.mode,requestId:d.requestId,name:d.name,actorId:d.actorId,
    unchangedSource:d.unchangedSource,category:d.category,folderName:d.folderName,worldItemId:d.worldItemId,itemId:d.itemId,state:d.state });
const markerOf = (d: any) => d.flags?.shadowdark?.sheetDelver?.treasureOperation;
const folderRole = (d: any) => d.flags?.shadowdark?.sheetDelver?.treasureFolder;
const parentOf = (d: any) => d.folder ?? d.parent ?? null;
function worldScope(req: ModuleServerRequest) {
    const w=req.runtime.world!.snapshot().identity;
    return createHash('sha256').update(JSON.stringify([w.instanceId,w.worldId])).digest('hex');
}

/** Folder creation is serialized in this process and fenced durably before dispatch. */
async function folder(req: ModuleServerRequest, name: string, parent: string|null, role: string): Promise<string> {
    const key=`treasure-folder-${worldScope(req)}-${role}`;
    const previous=await req.runtime.dataStore.get<{marker:string}>(key);
    const all=(await req.runtime.documents.list('Folder')).rows;
    const marked=all.filter(d=>folderRole(d)===role || (previous && markerOf(d)===previous.marker));
    const named=all.filter(d=>d.type==='Item' && d.name===name && parentOf(d)===parent);
    const matches=marked.length?marked:named;
    if(matches.length>1) throw new SdkError('conflict',`Multiple ${name} Item folders exist. Resolve the duplicate folders in Foundry.`);
    if(matches.length===1) {
        const d=matches[0];
        if(d.type!=='Item'||parentOf(d)!==parent) throw new SdkError('conflict',`The ${name} folder was moved or changed. Review it in Foundry.`);
        return documentId(d);
    }
    if(previous) throw new SdkError('conflict',`Creation of the ${name} folder is not confirmed. Refresh and check its result before retrying.`);
    const marker=randomUUID(); await req.runtime.dataStore.set(key,{marker});
    const d=await req.runtime.documents.create('Folder',{name,type:'Item',folder:parent,
        flags:{shadowdark:{sheetDelver:{treasureFolder:role,treasureOperation:marker}}}});
    const id=documentId(d); if(!id) throw new SdkError('conflict',`The ${name} folder creation is not confirmed.`);
    return id;
}
async function destination(req: ModuleServerRequest, name: string) {
    return withActorLock(`treasure-folders-${worldScope(req)}`,async()=>{
        const root=await folder(req,'SheetDelver',null,'root');
        return folder(req,name,root,`category-${name}`);
    });
}

export async function reconcileLibrary(req: ModuleServerRequest,key: string,d: LibrarySave) {
    // Even replay/readback rechecks the selected recipient's current access.
    const actor=d.actorId?await requireOwnedActor(req.runtime,d.actorId):null;
    if(d.state==='saving') {
        const matches=(await req.runtime.documents.list('Item',undefined,{minOwnership:'owner'})).rows.filter(i=>markerOf(i)===d.marker);
        if(matches.length===1&&documentId(matches[0])) {
            d.worldItemId=documentId(matches[0]);d.state=d.actorId?'saved':'complete';await req.runtime.dataStore.set(key,d);
        }
    }
    if(d.state==='assigning') {
        const matches=(actor?.items??[]).filter((i:any)=>markerOf(i)===d.marker);
        if(matches.length===1&&documentId(matches[0])) {d.itemId=documentId(matches[0]);d.state='complete';await req.runtime.dataStore.set(key,d);}
    }
    return libraryReceipt(d);
}

/** Resume only a step known not to have been dispatched. Status never writes Foundry. */
export async function continueLibrary(req: ModuleServerRequest,key: string,d: LibrarySave) {
    await reconcileLibrary(req,key,d);
    if(d.state==='complete'||d.state==='saving'||d.state==='assigning') return libraryReceipt(d);
    const revision=requestRevision(req.runtime);
    if(d.state==='pending' && contextConflict(req.runtime,d.revision)) throw new SdkError('conflict','World context changed before completion. Review this operation.');
    if(d.state==='pending' && !d.unchangedSource) {
        const folderId=await destination(req,d.folderName);
        if(contextConflict(req.runtime,revision)) throw new SdkError('conflict','World context changed before saving.');
        d.state='saving'; await req.runtime.dataStore.set(key,d);
        try {
            const created=await req.runtime.documents.create('Item',{...d.payload,folder:folderId,ownership:{default:0},
                flags:{...d.payload.flags,shadowdark:{...d.payload.flags?.shadowdark,sheetDelver:{...d.payload.flags?.shadowdark?.sheetDelver,treasureOperation:d.marker}}}});
            d.worldItemId=documentId(created)||undefined;
            if(d.worldItemId) d.state=d.actorId?'saved':'complete';
            await req.runtime.dataStore.set(key,d);
        } catch { return libraryReceipt(d); }
    }
    if((d.state==='pending'&&d.unchangedSource)||(d.state==='saved'&&d.worldItemId)) {
        const actor=await requireOwnedActor(req.runtime,d.actorId);
        if(actor.type!=='Player') throw new SdkError('validation','Choose a player character.');
        const saved=d.unchangedSource?d.payload:await req.runtime.documents.get('Item',d.worldItemId!,{minOwnership:'owner'});
        if(!saved||(!d.unchangedSource&&markerOf(saved)!==d.marker)) throw new SdkError('conflict','The saved item is unavailable. Review it in Foundry.');
        const payload=ownedCopy(saved);
        payload.flags={...payload.flags,shadowdark:{...payload.flags?.shadowdark,sheetDelver:{...payload.flags?.shadowdark?.sheetDelver,treasureOperation:d.marker}}};
        delete payload.folder;delete payload.ownership;
        if(contextConflict(req.runtime,revision)) throw new SdkError('conflict','World context changed before assignment.');
        d.state='assigning';await req.runtime.dataStore.set(key,d);
        try {
            const created=await req.runtime.documents.items.create({type:'Actor',id:d.actorId},payload);
            d.itemId=documentId(created)||undefined;if(d.itemId)d.state='complete';
            await req.runtime.dataStore.set(key,d);
        } catch { /* Only exact readback can settle an uncertain assignment. */ }
    }
    return libraryReceipt(d);
}
