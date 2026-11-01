import { originalRow, type OriginalPart, type OriginalSource } from './original-tables';
import { parseUuid } from './identity';
import { UTILITY_IMAGES } from '../data/remaining-treasure-tables';

export interface UtilityRecipe {mode:'build'|'existing';form:OriginalPart;feature:OriginalPart}
export const emptyUtilityRecipe=(mode:UtilityRecipe['mode']='build'):UtilityRecipe=>({mode,form:{text:''},feature:{text:''}});
export interface SpellItemRecipe {feature:OriginalPart;tier:string;tierSource?:OriginalSource}
export const emptySpellItemRecipe=():SpellItemRecipe=>({feature:{text:''},tier:''});
export const escapeTreasureText=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const describePart=(label:string,part:OriginalPart)=>`<p><strong>${label}:</strong> ${escapeTreasureText(part.text)}</p>`;
export function partError(part:OriginalPart,table:string):string|undefined {
    if(!part||typeof part.text!=='string'||!part.text.trim()||part.text.length>1000)return 'Enter, choose or roll a result (up to 1,000 characters).';
    if(part.source&&(!originalRow(part.source)||part.source.table!==table))return 'Choose a current result for this field or enter it manually.';
}
export function utilityErrors(u:UtilityRecipe):Record<string,string>{
    if(!u||!['build','existing'].includes(u.mode))return {'utility.mode':'Choose how to create this item.'};
    if(u.mode==='existing')return {};
    const errors:Record<string,string>={};
    for(const key of ['form','feature'] as const){const e=partError(u[key],`utility-${key}`);if(e)errors[`utility.${key}`]=e;}
    return errors;
}
export function utilityImage(u:UtilityRecipe):string|undefined {
    const row=originalRow(u.form.source);
    return u.mode==='build'&&u.form.source?.table==='utility-form'&&row?.text===u.form.text?UTILITY_IMAGES[row.id]:undefined;
}
export function spellItemErrors(s:SpellItemRecipe,kind:string):Record<string,string>{
    const errors:Record<string,string>={};
    const e=partError(s.feature,`${kind.toLowerCase()}-feature`);if(e)errors['spellItem.feature']=e;
    if(!/^[1-5]$/.test(s.tier))errors['spellItem.tier']='Choose a spell tier from 1 to 5.';
    if(s.tierSource&&(!originalRow(s.tierSource)||s.tierSource.table!=='spell-tier'))errors['spellItem.tier']='Choose a current tier or set it manually.';
    return errors;
}
export function isWeaponBase(item:any):boolean {
    const ref=parseUuid(item?.uuid);
    return ref?.kind==='compendium'&&ref.pack==='shadowdark.gear'&&item.system?.magicItem===false
        &&(item.type==='Weapon'&&!!item.system?.damage||item.type==='Basic'&&item.system?.isAmmunition===true);
}
export const weaponBases=(items:any[]):any[]=>items.filter(isWeaponBase).sort((a,b)=>a.uuid<b.uuid?-1:a.uuid>b.uuid?1:0);
export const weaponName=(item:any,bonus:string)=>item?`${item.name}${/^[1-3]$/.test(bonus)?` +${bonus}`:''}`:'';
export const spellTier=(spell:any)=>Number(spell?.system?.tier??spell?.tier);
export const tierSpells=(items:any[],tier:string)=>items.filter(s=>s.type==='Spell'&&spellTier(s)===Number(tier)).sort((a,b)=>a.uuid<b.uuid?-1:a.uuid>b.uuid?1:0);
