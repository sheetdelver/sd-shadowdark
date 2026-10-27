import { MANUAL_DAILY_SOURCES } from '../data/rest-manual-sources';
import { documentId, formatUuid, sourceRef } from './identity';
import { prepareActorCore, type PreparationLookups } from './actor-preparation';
import { reconcileCreatorNumbers } from './character-creation';
import type { RuleInputs } from './world-settings';
import { isWand, wandBroken, wandRestUpdates } from './wands';
import { scrollSpent } from './scrolls';

import { REST_LOSS_PATH } from './spell-loss';
export interface RestIntent { consumeRation: boolean; rationId?: string; confirmedSpells: string[] }
export interface RestRow { id: string; name: string; detail: string; confirmable?: boolean }
export interface RestWrite { itemId?: string; patch: Record<string, unknown>; label: string }
export interface RestPlan {
    rations: Array<{ id: string; name: string; quantity: number }>;
    reset: RestRow[]; excluded: RestRow[]; writes: RestWrite[]; errors: string[];
}
// Native 4.0.6 class-abilities.db: the fifteen documents explicitly state daily
// uses. Herbalism (ZjCvQZ7k4hBa9y2I) and Presence (J4KYu5M32T81yE1f) talents
// establish rest recovery for the other seven. Counts always come from ownership.
export const DAILY_ABILITIES = new Set(['Jkl9j4RZ2WYy0Gmd','Ecajh7eY7lBEHuMv','i0IHFrEbhd0MOvkQ','xwE0DGzMTxMQWqRj',
    '6snDwCm38HjvO1uv','MbC7YucyY4D9dYre','vndvnruyp9aZ3f5l','z5uKTDf4wtkipQ4s','pRO1kFMnFkkcYOgC','cXyvO6H22jfOxcz4',
    '1hc2HGy3pZ89jvGM','dsFmHTTuERiQePky','KfaSyGxX13IBVmKO','so8ytbZuqmNvppI7','yDByoMchtApfpKcS'].map(id=>`Compendium.shadowdark.class-abilities.Item.${id}`));
export const REST_ABILITIES = new Set(['i8PZF77jaVDkCE6n','Ussun0GbRMiJZ8vP','3fck7HFRfDywsjQk','EhaA5tBROfrws1Kx',
    'oCNpE6bnZjPIdOO1','UzSmg3aLstFcNsUa','jg2sUC3nIAI8sT18'].map(id=>`Compendium.shadowdark.class-abilities.Item.${id}`));
const origin = (item: any) => { const ref=sourceRef(item); return ref ? formatUuid(ref) : null; };
function ration(item: any) {
    if (item.type !== 'Basic') return false;
    const ref=origin(item);
    if(ref) return ref==='Compendium.shadowdark.gear.Item.GX6OmWQiE7MzTmjX';
    // Complete identifying content of the historical Gear Add copy, not name alone.
    return item.name==='Rations' && item.img==='icons/consumables/food/berries-ration-round-red.webp'
        && item.system?.description==='<p>One day of food and water supply for one person.</p>'
        && item.system?.magicItem===false && item.system?.slots?.per_slot===3;
}
export function restPlan(actor: any, intent: RestIntent, lookups: PreparationLookups, rules: RuleInputs): RestPlan {
    const result: RestPlan={rations:[],reset:[],excluded:[],writes:[],errors:[]};
    const items: any[]=actor.items ?? [], core=prepareActorCore(actor,lookups,rules);
    if(core.kind!=='Player') {result.errors.push('Only player characters can rest.');return result;}
    const add=(id:string,name:string,detail:string,patch:Record<string,unknown>,itemId?:string)=>{
        result.reset.push({id,name,detail});result.writes.push({itemId,patch,label:name});
    };
    const exclude=(id:string,name:string,detail:string,confirmable=false)=>result.excluded.push({id,name,detail,confirmable});
    result.rations=items.filter(i=>ration(i)&&!i.system?.stashed&&Number.isSafeInteger(i.system?.quantity)&&i.system.quantity>0)
        .map(i=>({id:documentId(i),name:i.name,quantity:i.system.quantity}));
    if(intent.consumeRation) {
        const food=result.rations.find(i=>i.id===intent.rationId);
        if(!food) result.errors.push('Choose an available carried ration, or uncheck Consume ration? if food is provided elsewhere.');
        else result.writes.push({itemId:food.id,patch:{'system.quantity':food.quantity-1},label:'Consume one ration'});
    }
    const hp=core.hp;
    if(!Number.isSafeInteger(hp.max)||hp.max<=0||!Number.isFinite(actor.system?.attributes?.hp?.value)) {
        result.errors.push('Current or maximum HP is unavailable. Refresh or correct HP before resting.');
    } else if(hp.value<hp.max) {
        const reconciled=reconcileCreatorNumbers(actor,{'system.attributes.hp.value':{basis:'effective',value:hp.max}},lookups,rules);
        if(reconciled.errors.length) exclude('hp','Hit points','HP has an effect that requires a manual adjustment.');
        else add('hp','Hit points',`${hp.value} → ${hp.max}`,{'system.attributes.hp.value':reconciled.source.system.attributes.hp.value});
    }
    const confirmable=new Set<string>();
    for(const item of items) {
        const id=documentId(item), s=item.system ?? {}, ref=origin(item), name=String(item.name ?? 'Item');
        if(isWand(item)) {
            if(wandBroken(item)) exclude(id,name,'Wand is broken');
            else {const patch=wandRestUpdates(item);if(patch)add(id,name,'Restore lost wand spells',patch,id);}
        } else if(scrollSpent(item)) exclude(id,name,'Scroll is spent');
        else if(item.type==='Spell' && s.lost===true) {
            const reason=item.flags?.shadowdark?.sheetDelver?.spellLoss?.reason;
            const permanent=reason==='permanent';
            const needsConfirmation=reason!=='rest'&&!permanent;
            if(needsConfirmation)confirmable.add(id);
            if(reason==='rest'||(needsConfirmation&&intent.confirmedSpells.includes(id)))
                add(id,name,'Restore spell',{'system.lost':false,[REST_LOSS_PATH]:null},id);
            else exclude(id,name,permanent?'Permanently lost':reason==='penance'?'Penance required':'Loss reason is unknown; confirm it can recover',needsConfirmation);
        } else if(s.lost===true || (s.limitedUses===true && Number(s.uses?.available)<Number(s.uses?.max))) {
            const patch:Record<string,unknown>={}, details:string[]=[];
            if(s.lost===true) {
                if(ref&&REST_ABILITIES.has(ref)){patch['system.lost']=false;details.push('Restore ability');}
                else exclude(`${id}:lost`,name,'Recovery rule is unknown; restore manually if eligible');
            }
            if(s.limitedUses===true&&Number(s.uses?.available)<Number(s.uses?.max)) {
                if(ref&&DAILY_ABILITIES.has(ref)&&Number.isSafeInteger(s.uses.max)&&s.uses.max>0
                    && !(item.effects??[]).some((e:any)=>!e.disabled&&(e.changes??[]).some((c:any)=>String(c.key).includes('uses.')))) {
                    patch['system.uses.available']=s.uses.max; details.push(`Uses ${s.uses.available} → ${s.uses.max}`);
                } else exclude(`${id}:uses`,name,'Daily recovery or effective use limit is unknown');
            }
            if(Object.keys(patch).length)add(id,name,details.join('; '),patch,id);
        }
        if(ref&&MANUAL_DAILY_SOURCES.has(ref)&&s.identification?.identified!==false)
            exclude(`${id}:daily`,name,ref==='Compendium.shadowdark.talents.Item.A8Siwy6S27LwEkx5'||ref==='Compendium.shadowdark.talents.Item.tfM77lqANyzu0kMy'
                ? 'Choose the new daily benefit separately' : 'Daily benefit has no tracked counter; reset manually if used');
        // Effects lack a native rest-expiry contract. Keep visible changed/temporary
        // state for manual review without clearing benefits or revealing curses.
        for(const effect of item.effects??[]) if(s.identification?.identified!==false) effectFollowup(effect,`${id}:`,exclude);
    }
    for(const effect of actor.effects??[]) effectFollowup(effect,'actor:',exclude);
    for(const id of intent.confirmedSpells) if(!confirmable.has(id))result.errors.push('A selected spell recovery changed. Refresh the rest preview.');
    return result;
}
function effectFollowup(effect:any,prefix:string,exclude:(id:string,name:string,detail:string)=>unknown) {
    if(effect.disabled)return;
    const temporary=Number(effect.duration?.seconds)>0||Number(effect.duration?.rounds)>0||Number(effect.duration?.turns)>0;
    const damage=(effect.changes??[]).some((c:any)=>String(c.key).startsWith('system.abilities.')&&Number(c.value)<0);
    if(temporary||damage)exclude(`${prefix}${documentId(effect)}`,String(effect.name??effect.label??'Effect'),'Effect duration or recovery must be handled separately');
}
