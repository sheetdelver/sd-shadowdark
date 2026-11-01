import { ABILITY_KEYS, type AbilityKey } from './actor-preparation';
import { canonicalUuid } from './identity';

export const CREATOR_ABILITY_LABELS: Record<AbilityKey,string> = {
    str:'Strength', dex:'Dexterity', con:'Constitution', int:'Intelligence', wis:'Wisdom', cha:'Charisma',
};
// Player Quickstart, Stats: explicit core-class guidance. Exact identities only;
// casting and Class Ability checks below follow the selected native documents.
const CORE_CLASS_GUIDANCE: Record<string,{ability:AbilityKey;reason:string}> = {
    'Compendium.shadowdark.classes.Item.hO7KrvqDRH6kvftJ':{ability:'str',reason:'Melee attacks'},
    'Compendium.shadowdark.classes.Item.C6wkCa2w5dlgSq7f':{ability:'dex',reason:'Stealth and agility'},
};
export function creatorAbilityGuidance(classDoc:any, classAbilities:readonly any[], level:number) {
    const reasons=new Map<AbilityKey,Set<string>>();
    const add=(ability:any,reason:string)=>{
        if(!ABILITY_KEYS.includes(ability))return;
        const key=ability as AbilityKey;
        if(!reasons.has(key))reasons.set(key,new Set());
        reasons.get(key)!.add(reason);
    };
    if(level>0&&classDoc){
        const classRef=canonicalUuid(classDoc.uuid);
        const core=classRef?CORE_CLASS_GUIDANCE[classRef]:undefined;
        if(core)add(core.ability,core.reason);
        add(classDoc.system?.spellcasting?.ability,'Spellcasting');
        const refs=new Set((classDoc.system?.classAbilities??[]).map((ref:string)=>canonicalUuid(ref)));
        for(const entry of classAbilities){
            const ref=canonicalUuid(entry.uuid);
            if(ref&&refs.has(ref))add(entry.system?.ability,`${entry.system?.group||entry.name} checks`);
        }
    }
    return [...reasons].map(([ability,uses])=>({ability,label:CREATOR_ABILITY_LABELS[ability],uses:[...uses]}));
}
