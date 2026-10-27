import { restPlanningSource } from '../spell-loss';
import { createHash } from 'node:crypto';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { SdkError, getErrorMessage, isSdkError } from '@sheet-delver/sdk';
import { restPlan, type RestIntent, type RestWrite } from '../../logic/rest';
import { documentId } from '../../logic/identity';
import { spellReview } from '../../logic/spell-review';
import { callerOf, requestRules, requestRevision, contextConflict, requireOwnedActor } from '../access';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { withActorLock } from '../operation-lock';

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
// The shared source review deliberately omits Item flags; rest also binds loss,
// scroll and legacy wand flags because they determine resource eligibility.
const review=(actor:any)=>hash([spellReview(actor),(actor.items??[]).map((i:any)=>[documentId(i),i.flags])]);
type State='pending'|'started'|'applied'|'failed'|'uncertain';
interface Journal { requestId:string; user:string; intent:RestIntent; token:string; expected:string; after?:string;
    revision:number|null; writes:RestWrite[]; states:State[]; complete:boolean; message?:string }
const valueAt=(obj:any,path:string)=>path.split('.').reduce((o,k)=>o?.[k],obj);
function target(actor:any,w:RestWrite){return w.itemId?(actor.items??[]).find((i:any)=>documentId(i)===w.itemId):actor;}
function matches(actor:any,w:RestWrite){const t=target(actor,w);return !!t&&Object.entries(w.patch).every(([p,v])=>JSON.stringify(valueAt(t,p)??null)===JSON.stringify(v));}
function apply(actor:any,w:RestWrite){const t=target(actor,w);for(const [path,value]of Object.entries(w.patch)){const keys=path.split('.');const last=keys.pop()!;let o=t;for(const key of keys)o=o[key]??={};o[last]=structuredClone(value);} }
// Preview discovers ration stacks before one can be selected. Missing selection
// is a field-level plan error; completion still refuses it before any write.
function intentOf(body:any):RestIntent {
    if(!body||typeof body.consumeRation!=='boolean'||!Array.isArray(body.confirmedSpells)||body.confirmedSpells.length>200
        ||body.confirmedSpells.some((id:unknown)=>typeof id!=='string'||id.length>100)
        ||(body.rationId!==undefined&&(typeof body.rationId!=='string'||body.rationId.length>100)))throw new SdkError('validation','Invalid rest choices.');
    return {consumeRation:body.consumeRation,...(body.consumeRation&&body.rationId!==undefined?{rationId:body.rationId}:{}),confirmedSpells:[...new Set<string>(body.confirmedSpells)].sort()};
}
const response=(j:Journal)=>({state:j.complete?'complete':'partial',requestId:j.requestId,intent:j.intent,review:j.token,contextRevision:j.revision,
    applied:j.writes.filter((_,i)=>j.states[i]==='applied').map(w=>w.label),
    pending:j.writes.filter((_,i)=>j.states[i]!=='applied').map(w=>w.label),
    retryable:!j.states.some(s=>s==='uncertain'||s==='started'),message:j.message});

/** Only completion dispatches writes. Status reconciles acknowledgements but never
 * retries a write. Durable actor-wide pending pointer prevents a new request from
 * spending another ration after a lost response, reload or another caller. */
export async function handleRest(actorId:string,req:ModuleServerRequest,mode:'plan'|'complete'|'status') {
    if(req.method!=='POST')return json({error:'Method not allowed'},{status:405});
    const revision=requestRevision(req.runtime);
    try {
        const body=await req.json<any>();
        const world=req.runtime.world?.snapshot().identity, store=req.runtime.dataStore;
        if(!world||!store)throw new SdkError('not_ready','Rest storage is unavailable. Try again after reconnecting.');
        const user=req.userSession?.userId??req.getAccessContext?.().userId;
        if(!user)throw new SdkError('permission_denied','Sign in to rest.');
        const scope=`${world.instanceId}:${world.worldId}:${actorId}`, activeKey=`rest-active-${hash(scope)}`;
        const key=(id:string)=>`rest-operation-${hash([scope,user,id])}`;
        return await withActorLock(scope,async()=>{
            let actor:any=structuredClone(await requireOwnedActor(req.runtime,actorId));
            const active=await store.get<{key:string;user:string}>(activeKey);
            let j:Journal|null=null, journalKey='';
            if(body.requestId!==undefined){
                if(typeof body.requestId!=='string'||! /^[\w-]{8,80}$/.test(body.requestId))throw new SdkError('validation','Invalid rest request.');
                journalKey=key(body.requestId);j=await store.get<Journal>(journalKey);
            }
            if(!j&&active){
                if(active.user!==user)throw new SdkError('conflict','Another player has an unfinished rest for this character. Ask them to check its result.');
                journalKey=active.key;j=await store.get<Journal>(journalKey);
                if(!j)throw new SdkError('conflict','The previous rest record is unavailable. Review the character before resting again.');
                if(mode==='complete'&&body.requestId!==j.requestId)throw new SdkError('conflict','Check the unfinished rest before starting another.');
            }
            const save=async()=>{await store.set(journalKey,j!);};
            const checkContext=()=>{if(revision!==null)req.runtime.world!.assertRevision(revision);};
            // Exact final values can settle uncertain writes or independently completed
            // resets without another write. Pending/refused writes still require
            // unchanged source before dispatch; manual edits never authorize replay.
            if(j&&!j.complete){
                for(let i=0;i<j.writes.length;i++)if(j.states[i]!=='applied'&&matches(actor,j.writes[i])){
                    if(['started','uncertain'].includes(j.states[i]))j.expected=j.after??j.expected;
                    j.states[i]='applied';
                }
                if(j.states.every(s=>s==='applied')){j.complete=true;j.message=undefined;await save();await store.set(activeKey,null);}
                else await save();
            }
            if(mode==='status'){checkContext();return json(j?response(j):{state:'none'});}
            if(j){
                if(mode==='plan'){checkContext();return json({operation:response(j)});}
                if(j.requestId!==body.requestId||hash(j.intent)!==hash(intentOf(body))||j.token!==body.review)
                    throw new SdkError('conflict','Rest choices changed. Check the original rest result.');
                if(j.complete)return json(response(j));
                if(j.revision!==revision||review(actor)!==j.expected){j.message='Character or world rules changed. Review the remaining resources manually.';await save();return json({...response(j),retryable:false});}
                if(j.states.some(s=>s==='started'||s==='uncertain'))return json({...response(j),message:'A saved change is not confirmed. Check again or review the remaining resources manually.'});
            }else{
                const intent=intentOf(body);
                const lookups=await shadowdarkAdapter.callerLookups(actor,callerOf(req));
                const latest=await requireOwnedActor(req.runtime,actorId);
                if(review(latest)!==review(actor))throw new SdkError('conflict','Character changed. Refresh the rest preview.');
                const planning=await restPlanningSource(req,actor);
                const plan=restPlan(planning,intent,lookups,requestRules(req.runtime));
                checkContext();
                const token=hash([review(actor),(actor.items??[]).map((i:any)=>[documentId(i),i._stats?.modifiedTime]),intent,plan.writes,revision]);
                if(mode==='plan')return json({...plan,writes:undefined,review:token,contextRevision:revision});
                if(!body.requestId)throw new SdkError('validation','A rest request is required.');
                if(plan.errors.length)throw new SdkError('validation',plan.errors.join(' '));
                if(body.review!==token)throw new SdkError('conflict','Character or rest choices changed. Refresh the rest preview.');
                j={requestId:body.requestId,user,intent,token,expected:review(actor),revision,writes:plan.writes,states:plan.writes.map(()=>'pending'),complete:false};
                journalKey=key(body.requestId);await save();await store.set(activeKey,{key:journalKey,user});
            }
            for(let i=0;i<j.writes.length;i++){
                if(j.states[i]==='applied')continue;
                actor=structuredClone(await requireOwnedActor(req.runtime,actorId));checkContext();
                if(review(actor)!==j.expected){j.message='Character changed while resting. Review remaining resources manually.';await save();return json({...response(j),retryable:false});}
                const w=j.writes[i];const projected=structuredClone(actor);apply(projected,w);j.after=review(projected);j.states[i]='started';await save();checkContext();
                try {
                    if(w.itemId)await req.runtime.documents.items.update({type:'Actor',id:actorId},w.itemId,w.patch);
                    else await req.runtime.documents.patch('Actor',actorId,w.patch);
                    apply(actor,w);j.expected=review(actor);
                    const fresh=await requireOwnedActor(req.runtime,actorId);
                    if(!matches(fresh,w))throw new Error('Saved change is not yet visible.');
                    j.states[i]='applied';await save();
                }catch(e){
                    j.states[i]=isSdkError(e)&&['validation','permission_denied','not_found'].includes(e.code)?'failed':'uncertain';
                    j.message='Rest is partly applied. Check its result before making further changes.';
                    await save();return json(response(j));
                }
            }
            j.complete=true;j.message=undefined;await save();await store.set(activeKey,null);return json(response(j));
        });
    }catch(e){return contextConflict(req.runtime,revision)??error(isSdkError(e)?e.code:'internal',getErrorMessage(e));}
}
