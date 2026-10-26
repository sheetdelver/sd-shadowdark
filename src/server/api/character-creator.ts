import { json,error,type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage,isSdkError,SdkError } from '@sheet-delver/sdk';
import { prepareCreator } from '../character-creation';
import { creatorOperationStatus,dispatchCreator } from '../creation-operation';
import { requestRevision,contextConflict,callerOf } from '../access';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { prepareActorCore } from '../../logic/actor-preparation';
import { hitPointRollFormula } from '../../logic/actions';
import { advancementHitPoints, STARTING_GOLD } from '../../logic/advancement';
import { requestRules } from '../access';
const route=async(req:ModuleServerRequest,run:()=>Promise<unknown>)=>{
    const revision=requestRevision(req.runtime);
    try{
        const result:any=await run();
        const refusal=result?.creationWrites==='none'&&result?.error?error(result.code??'validation',result.error):null;
        return contextConflict(req.runtime,revision)??json(result,refusal?{status:refusal.status}:undefined);
    }catch(e){return contextConflict(req.runtime,revision)??error(isSdkError(e)?e.code:'internal',getErrorMessage(e));}
};
export const handleCreatorPrepare=(req:ModuleServerRequest)=>route(req,async()=>({success:true,plan:await prepareCreator(req,(await req.json<any>()).draft)}));
export const handleCreatorStatus=(req:ModuleServerRequest)=>route(req,async()=>({success:true,operation:await creatorOperationStatus(req,(await req.json<any>()).requestId)}));
export const handleCreatorCreate=(req:ModuleServerRequest)=>route(req,async()=>{
    const body=await req.json<any>();
    // A saved dispatch is checked before fresh source planning so access/rule
    // changes never strand the operation behind new character prerequisites.
    const previous=await creatorOperationStatus(req,body.requestId);
    if(previous) {
        // dispatchCreator verifies the complete intent even on replay.
        return {success:true,operation:await dispatchCreator(req,body.requestId,body.draft,{} as any)};
    }
    let plan;
    try {plan=await prepareCreator(req,body.draft);}catch(e){
        return {success:false,creationWrites:'none',error:getErrorMessage(e),code:isSdkError(e)?e.code:'internal'};
    }
    if(!plan.ready)return {success:false,creationWrites:'none',error:'Resolve every required choice and acknowledge the reviewed deviations.',plan};
    if(plan.review!==body.review||plan.contextRevision!==body.contextRevision)return {success:false,reviewChanged:true,plan};
    return {success:true,operation:await dispatchCreator(req,body.requestId,body.draft,plan)};
});
/** Explicit optional dice only. Public roll runtime; no document/chat writes. */
export const handleCreatorRoll=(req:ModuleServerRequest)=>route(req,async()=>{
    const body=await req.json<any>();let formula:string;
    if(body.kind==='score')formula='3d6';
    else if(body.kind==='gold')formula=STARTING_GOLD.formula;
    else if(body.kind==='hp') {
        const cls=await shadowdarkAdapter.resolveDocumentFor(body.classUuid,callerOf(req));
        if(cls?.type!=='Class'||!/^d(?:4|6|8|10|12)$/.test(cls.system?.hitPoints??''))throw new SdkError('validation','The exact Class HP die is unavailable.');
        if(!body.draft||!Number.isInteger(body.level)||body.level<1||body.level>body.draft.level||body.classUuid!==body.draft.classUuid)throw new SdkError('validation','Choose a level within this character’s progression.');
        const plan=await prepareCreator(req,body.draft);
        const source={...plan.source,system:{...plan.source.system,level:{...plan.source.system.level,value:body.level}},items:plan.source.items.filter((i:any)=>{const award=i.flags?.shadowdark?.sheetDelver?.creatorAward;return !award||award.acquisitionLevel<=body.level;})};
        const lookups=await shadowdarkAdapter.callerLookups(source,callerOf(req));
        const roll=hitPointRollFormula(prepareActorCore(source,lookups,requestRules(req.runtime)),cls.system.hitPoints);
        if(roll.diagnostics.length)throw new SdkError('validation',roll.diagnostics.join(' '));
        formula=roll.formula;
    }else if(body.kind==='table') {
        const table=await shadowdarkAdapter.resolveDocumentFor(body.tableUuid,callerOf(req));
        if(!Array.isArray(table?.results)||!/^\d{1,2}d\d{1,3}(?:[+-]\d{1,3})?$/.test(table?.formula??''))throw new SdkError('validation','This exact table has no supported native roll formula.');
        formula=table.formula;
    }else throw new SdkError('validation','Choose a score, HP die, starting gold or exact award table to roll.');
    const result=await req.runtime.rolls.roll(formula,'Character Creator',{displayChat:false});
    return {success:true,formula,total:result.total};
});
/** Optional calculation only; a missing history never invents old CON/HP. */
export const handleCreatorHP=(req:ModuleServerRequest)=>route(req,async()=>{
    const body=await req.json<any>(),plan=await prepareCreator(req,body.draft),level=body.draft.level;
    if(plan.errors.some(e=>[1,2,3,4].includes(e.step)))throw new SdkError('validation','Resolve identity, scores and grant choices before calculating HP.');
    if(body.draft.awards.some((a:any)=>a.level===null))throw new SdkError('validation','Calculated HP needs known award chronology. Enter direct paper HP when history is unknown.');
    const gains=body.gains;
    const dieSides=Number(plan.hitDie?.slice(1));
    if(level>0&&(!Number.isInteger(dieSides)||dieSides<1))throw new SdkError('validation','The Class hit die is unavailable.');
    if(!Array.isArray(gains)||gains.length!==level||gains.some((n:unknown)=>typeof n!=='number'||!Number.isInteger(n)||n<1||n>dieSides))throw new SdkError('validation','Enter one die result within the Class hit die for each level.');
    const source=structuredClone(plan.source),lookups=await shadowdarkAdapter.callerLookups(source,callerOf(req));
    const finalCore=prepareActorCore(source,lookups,requestRules(req.runtime));
    if(finalCore.effects.some(e=>e.applies&&e.owner.kind==='item'&&!['Talent','Boon'].includes(e.owner.itemType??'')&&e.changes.some(c=>c.key==='system.abilities.con.value'||c.key.startsWith('system.attributes.hp.'))))
        throw new SdkError('validation','A possession or other source changes CON or HP without acquisition history. Enter direct paper HP.');
    let hp={value:0,max:0};
    if(level===0) {
        const core=prepareActorCore(source,lookups,requestRules(req.runtime));hp={value:Math.max(1,core.abilities.con.mod),max:Math.max(1,core.abilities.con.mod)};
    } else for(let at=1;at<=level;at++) {
        const virtual={...source,system:{...source.system,level:{value:at,xp:0},attributes:{...source.system.attributes,hp}},items:source.items.filter((i:any)=>{
            const award=i.flags?.shadowdark?.sheetDelver?.creatorAward;
            return !award||award.acquisitionLevel<=at;
        })};
        const core=prepareActorCore(virtual,lookups,requestRules(req.runtime));
        // Constant bonuses can be prepared once after the level gains; a
        // replacing or conditional effect needs a directly recorded total.
        if(core.effects.some(e=>e.applies&&e.changes.some(c=>c.key.startsWith('system.attributes.hp.')&&(c.type!=='add'||!/^[+-]?\d+$/.test(String(c.value))))))throw new SdkError('validation','A conditional or replacing HP effect needs direct HP entry.');
        // Constant permanent HP bonuses are applied once by preparation, not
        // accumulated again with every level's hit die.
        hp=advancementHitPoints({...core,hp},at,gains[at-1]);
    }
    const final={...source,system:{...source.system,attributes:{...source.system.attributes,hp}}};
    return {success:true,hp:prepareActorCore(final,lookups,requestRules(req.runtime)).hp};
});
