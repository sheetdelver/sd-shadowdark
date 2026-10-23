import { randomUUID } from 'node:crypto';
import { SdkError, getErrorMessage } from '@sheet-delver/sdk';
import type { ModuleServerRequest } from '@sheet-delver/sdk/server';
import { readChanges } from '../logic/effects';
import { documentId } from '../logic/identity';
import { creatorHash } from './character-creation';
import type { CreatorPlan } from '../logic/character-creation';
import { contextConflict, requireOwnedActor } from './access';
import { withActorLock } from './operation-lock';
import { shadowdarkAdapter } from './ShadowdarkAdapter';
import { callerOf } from './access';

type Journal = { version:1; requestId:string; intent:string; review:string; marker:string; payload:any;
    state:'prepared'|'dispatched'|'complete'; actorId?:string; message?:string };
function scope(req:ModuleServerRequest) {
    const world=req.runtime.world?.snapshot().identity, user=req.userSession?.userId??req.getAccessContext?.().userId;
    if(!world||!user||!req.runtime.dataStore)throw new SdkError('not_ready','Creation needs caller/world identity and durable receipts.');
    return creatorHash([world.instanceId,world.worldId,user]);
}
const keyFor=(s:string,id:string)=>`creator-${s}-${id}`;
const activeFor=(s:string)=>`creator-active-${s}`;
/** Compare every reviewed field; native schema may add defaults, IDs and stats.
 * Embedded arrays retain their exact order/count. Modern/legacy changes normalize
 * through the shared reader, preserving their semantics and all other fields. */
export function creationSourceMatches(actual:any,expected:any):boolean {
    const normalize=(value:any,kind:'document'|'effect'|'plain'='document'):any=>{
        if(Array.isArray(value))return value.map(v=>normalize(v,kind));
        if(!value||typeof value!=='object')return value;
        const copy={...value};
        if(kind!=='plain') {
            for(const k of ['_id','id','uuid','pack','_key'])delete copy[k];
            if(copy._stats)copy._stats=copy._stats.compendiumSource?{compendiumSource:copy._stats.compendiumSource}:{};
        }
        if(kind==='effect'&&(Array.isArray(copy.changes)||Array.isArray(copy.system?.changes))) {
            const raw=copy.system?.changes??copy.changes;
            const changes=readChanges(copy).changes.map(c=>{const normalized={...raw[c.index],key:c.key,type:c.type,value:String(c.value),phase:c.phase,priority:c.priority};delete normalized.mode;return normalized;});
            delete copy.changes;copy.system={...copy.system,changes};
        }
        return Object.fromEntries(Object.entries(copy).map(([k,v])=>[k,normalize(v,kind!=='plain'&&k==='effects'?'effect':kind==='document'&&k==='items'?'document':'plain')]));
    };
    const includes=(a:any,e:any):boolean=>{
        if(Array.isArray(e)) {
            if(!Array.isArray(a)||a.length!==e.length)return false;
            return e.every((value,index)=>includes(a[index],value));
        }
        if(e&&typeof e==='object')return !!a&&typeof a==='object'&&Object.entries(e).every(([k,v])=>includes(a[k],v));
        return a===e;
    };
    return includes(normalize(actual),normalize(expected));
}
function receipt(j:Journal) { return {requestId:j.requestId,state:j.state==='prepared'?'not-created':j.state==='complete'?'complete':'uncertain',actorId:j.actorId,
    message:j.state==='complete'?'Creation confirmed. Open the character.':j.state==='prepared'?'No creation was dispatched. Edit and prepare again.':j.message??'Creation may have succeeded. Check creation; do not submit another character.'}; }
async function reconcile(req:ModuleServerRequest,j:Journal,key:string) {
    if(j.state==='prepared')return receipt(j);
    if(j.state==='complete') {
        // Confirmation is historical evidence. Ordinary later Actor edits do
        // not turn a proven creation back into an unknown dispatch.
        try {await requireOwnedActor(req.runtime,j.actorId!);return receipt(j);}
        catch {return {...receipt(j),actorId:undefined,message:'Creation was confirmed, but the character is no longer owner-readable. Restore access to open it. This operation will never create another Actor.'};}
    }
    let matches:any[]=[];
    if(j.actorId) {
        try {matches=[await requireOwnedActor(req.runtime,j.actorId)];}catch{j.message='The confirmed character is no longer owner-readable. Restore access to review it; no replacement is created.';return receipt({...j,state:'dispatched'});}
    } else {
        // Positive evidence from the public PRIMARY store, never a cached UI list
        // or name search. Absence/ambiguity does not prove failure or permit retry.
        const result=await req.runtime.documents.list('Actor',{filter:{'flags.shadowdark.sheetDelver.creatorOperation':j.marker}},{minOwnership:'owner'});
        matches=result.rows.filter((a:any)=>a.flags?.shadowdark?.sheetDelver?.creatorOperation===j.marker);
        if(matches.length!==1||result.total!==1){j.message=matches.length?'Several characters may carry this creation marker. Review exact sources with your GM.':'No unique owner-readable creation is visible yet. This does not prove failure; no replacement will be created.';return receipt(j);}
        const id=documentId(matches[0]);
        if(!id)return receipt(j);
        try {matches=[await requireOwnedActor(req.runtime,id)];}catch{return receipt(j);}
    }
    const actual=matches[0];
    if(actual?.flags?.shadowdark?.sheetDelver?.creatorOperation!==j.marker||!creationSourceMatches(actual,j.payload)) {
        j.message='The exact marked character differs from the reviewed source. Review it with your GM; this operation will not create a replacement.';
        return receipt({...j,state:'dispatched'});
    }
    const completed={...j,actorId:documentId(actual),state:'complete' as const};
    await req.runtime.dataStore.set(key,completed);Object.assign(j,completed);return receipt(j);
}
/** This journal is caller/world-bound recovery bookkeeping, never an editable draft. */
export async function creatorOperationStatus(req:ModuleServerRequest,requestId?:string) {
    const s=scope(req);
    return withActorLock(activeFor(s),async()=>{
        const active=await req.runtime.dataStore.get<{requestId:string}>(activeFor(s));
        const id=requestId??active?.requestId;if(!id)return null;
        if(!/^[\w-]{8,80}$/.test(id))throw new SdkError('validation','Invalid creation operation ID.');
        const key=keyFor(s,id),j=await req.runtime.dataStore.get<Journal>(key);
        return j?reconcile(req,j,key):null;
    });
}
/** Fresh plan supplied by the route. Same-process submits serialize; the SDK
 * has no cross-process CAS/idempotency contract. Dispatched receipts NEVER
 * resume a create, including after restart, access loss or an empty search. */
export async function dispatchCreator(req:ModuleServerRequest,requestId:string,intent:unknown,plan:CreatorPlan) {
    if(!/^[\w-]{8,80}$/.test(requestId??''))throw new SdkError('validation','Creation needs a stable operation ID.');
    const s=scope(req),store=req.runtime.dataStore,key=keyFor(s,requestId);
    return withActorLock(activeFor(s),async()=>{
        const fingerprint=creatorHash(intent),existing=await store.get<Journal>(key);
        if(existing) {
            if(existing.intent!==fingerprint)throw new SdkError('conflict','This operation ID belongs to a different character.');
            return reconcile(req,existing,key);
        }
        const active=await store.get<{requestId:string}>(activeFor(s));
        if(active) {
            const previous=await store.get<Journal>(keyFor(s,active.requestId));
            if(!previous||previous.state==='dispatched')throw new SdkError('conflict','A previous creation needs review. Check creation before starting another.');
        }
        if(!plan.ready)throw new SdkError('validation','Resolve every required choice and acknowledge the exact paper deviations.');
        const marker=randomUUID(),payload=structuredClone(plan.source);
        payload.flags={...payload.flags,shadowdark:{...payload.flags?.shadowdark,sheetDelver:{...payload.flags?.shadowdark?.sheetDelver,creatorOperation:marker,
            transcription:{version:1,review:plan.review,deviations:plan.warnings,comparisons:plan.comparisons}}}};
        const j:Journal={version:1,requestId,intent:fingerprint,review:plan.review,marker,payload,state:'prepared'};
        await store.set(key,j);await store.set(activeFor(s),{requestId});
        if(contextConflict(req.runtime,plan.contextRevision))throw new SdkError('conflict','World rules changed before creation. Prepare again.');
        // Queueing and receipt persistence can await. Revalidate source/access
        // after those awaits, before the sole document dispatch.
        for(const dependency of plan.dependencies) {
            const doc=await shadowdarkAdapter.resolveDocumentFor(dependency.uuid,callerOf(req));
            if(!doc||creatorHash({...structuredClone(doc),uuid:dependency.uuid})!==dependency.hash)throw new SdkError('conflict','Creation sources changed before dispatch. Prepare again.');
        }
        if(contextConflict(req.runtime,plan.contextRevision))throw new SdkError('conflict','World rules changed before dispatch. Prepare again.');
        j.state='dispatched';await store.set(key,j);
        let created:any;
        try {created=await req.runtime.documents.create('Actor',payload);}catch(e){
            j.message=`Creation outcome needs review: ${getErrorMessage(e)}`;
            try{await store.set(key,j);}catch{/* durable dispatched fence already exists */}
            return receipt(j);
        }
        j.actorId=documentId(created)||undefined;
        try {await store.set(key,j);}catch{
            return {...receipt(j),message:'Creation returned an Actor, but its receipt could not be saved. Check creation using its operation marker; creation will not repeat.'};
        }
        try {return await reconcile(req,j,key);}catch{
            return {...receipt(j),message:'Creation was dispatched. Source verification or receipt persistence is pending. Check creation; no replacement will be sent.'};
        }
    });
}
