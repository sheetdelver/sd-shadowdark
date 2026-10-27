import { createHash } from 'node:crypto';
import type { ModuleServerRequest } from '@sheet-delver/sdk/server';
import { documentId } from '../logic/identity';
import { REST_LOSS_PATH } from '../logic/spell-loss';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function key(req:ModuleServerRequest,actorId:string,itemId:string) {
    const world=req.runtime.world?.snapshot().identity;
    return world?`spell-loss-${hash([world.instanceId,world.worldId,actorId,itemId])}`:null;
}
function stamp(item:any) {
    // Native edits may toggle false→true while leaving module flags untouched.
    // Without a native modification stamp that cycle cannot be distinguished.
    if(!Number.isFinite(item?._stats?.modifiedTime))return null;
    return hash([item._stats.modifiedTime,item.system,item.flags]);
}
/** Best-effort evidence after a confirmed module cast. Failure reduces automatic
 * recovery to explicit eligibility; it must never cause the spell to be cast again. */
export async function recordSpellLoss(req:ModuleServerRequest,actorId:string,itemId:string,updates:Record<string,unknown>) {
    if(!updates[REST_LOSS_PATH]||!req.runtime.dataStore)return;
    try {
        const actor:any=await req.runtime.documents.get('Actor',actorId,{minOwnership:'owner'});
        const item=(actor?.items??[]).find((i:any)=>documentId(i)===itemId),k=key(req,actorId,itemId),version=stamp(item);
        if(k&&version&&item.system?.lost===true&&JSON.stringify(item.flags?.shadowdark?.sheetDelver?.spellLoss)===JSON.stringify(updates[REST_LOSS_PATH]))
            await req.runtime.dataStore.set(k,{stamp:version});
    }catch{/* No proven source version: rest will ask for eligibility instead. */}
}
/** Read-only planning copy; never rewrite native metadata merely to hide stale evidence. */
export async function restPlanningSource(req:ModuleServerRequest,actor:any) {
    const copy=structuredClone(actor);
    for(const item of copy.items??[]) {
        if(item.type!=='Spell'||item.system?.lost!==true)continue;
        const loss=item.flags?.shadowdark?.sheetDelver?.spellLoss;
        if(!loss||loss.reason==='permanent')continue;
        const k=key(req,documentId(actor),documentId(item)),version=stamp(item);
        let proof:{stamp:string}|null=null;
        try {if(k&&version&&req.runtime.dataStore)proof=await req.runtime.dataStore.get<{stamp:string}>(k);}catch{/* unavailable proof is not proof of rest eligibility */}
        if(!version||proof?.stamp!==version)item.flags.shadowdark.sheetDelver.spellLoss={...loss,reason:'unknown'};
    }
    return copy;
}
