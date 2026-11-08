import { NATIVE_PREDEFINED_EFFECTS } from '../data/native-predefined-effects';
import { createEffect } from '../utils/Sanitizer';

/** Explicit permanent additive choices from the generated native snapshot. No prose parsing. */
export const TREASURE_MODIFIERS=['acBonus','additionalGearSlots','abilityImprovementStr','abilityImprovementDex',
    'abilityImprovementCon','abilityImprovementInt','abilityImprovementWis','abilityImprovementCha','initAdvantage'] as const;
export type TreasureModifierId=typeof TREASURE_MODIFIERS[number];
export interface TreasureModifier {id:TreasureModifierId;value:string}
export const supportsTreasureModifiers=(type:string)=>['Armor','Weapon','Basic','Gem','Wand'].includes(type);
export function modifierErrors(modifiers:TreasureModifier[]|undefined,type:string):Record<string,string>{
    const errors:Record<string,string>={};if(modifiers===undefined)return errors;
    if(!Array.isArray(modifiers)||modifiers.length>TREASURE_MODIFIERS.length)return {modifiers:'Use one entry for each supported modifier.'};
    if(modifiers.length&&!supportsTreasureModifiers(type))errors.modifiers='Permanent modifiers belong to equipment, not consumables or boons.';
    const seen=new Set<string>();
    modifiers.forEach((m,i)=>{
        if(!m||!TREASURE_MODIFIERS.includes(m.id)||seen.has(m.id))errors[`modifiers.${i}`]='Choose a supported modifier once; combine its amount in one entry.';
        else if(!/^-?\d+$/.test(m.value)||!Number.isSafeInteger(Number(m.value))||Number(m.value)===0)errors[`modifiers.${i}`]='Enter a nonzero whole number.';
        else if(m.id==='initAdvantage'&&m.value!=='1')errors[`modifiers.${i}`]='Initiative advantage uses one native grant.';
        seen.add(m?.id);
    });
    return errors;
}
export function applyTreasureModifiers(item:any,modifiers:TreasureModifier[]=[]):void {
    if(Object.keys(modifierErrors(modifiers,item.type)).length)throw Error('Correct the permanent modifiers.');
    if(!modifiers.length)return;
    item.system.magicItem=true;
    item.effects=[...(item.effects??[]),...modifiers.map(m=>{
        const def=NATIVE_PREDEFINED_EFFECTS[m.id];
        return createEffect(`${def.label}${m.id==='initAdvantage'?'':` ${Number(m.value)>0?'+':''}${m.value}`}`,
            def.icon,[{key:def.key,mode:def.mode,value:m.value}],{sourceName:'Treasure authoring'});
    })];
}
