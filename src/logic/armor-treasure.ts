import { parseUuid } from './identity';
import { originalRow, type OriginalPart, type OriginalSource } from './original-tables';
import { slugify } from './foundry';

export interface ArmorRecipe {
    mode:'build'|'existing'; bonus:string; feature:OriginalPart;
    bonusSource?:OriginalSource;
}
export const emptyArmorRecipe=(mode:ArmorRecipe['mode']='build'):ArmorRecipe=>({mode,bonus:'',feature:{text:''}});
/** Use declared native gear and its exact fields, including available mithral variants. */
export function isArmorBase(item:any):boolean {
    const ref=parseUuid(item?.uuid);
    return item?.type==='Armor'&&item.system?.magicItem===false
        &&ref?.kind==='compendium'&&ref.pack==='shadowdark.gear'
        &&Number.isSafeInteger(item.system?.ac?.modifier)
        &&(item.system?.ac?.base===null||Number.isSafeInteger(item.system?.ac?.base));
}
export const armorBases=(items:any[]):any[]=>items.filter(isArmorBase).sort((a,b)=>a.uuid<b.uuid?-1:a.uuid>b.uuid?1:0);
export const armorName=(base:any,bonus:string)=>base?`${base.name}${/^[1-3]$/.test(bonus)?` +${bonus}`:''}`:'';
export function armorErrors(a:ArmorRecipe):Record<string,string>{
    if(!a||!['build','existing'].includes(a.mode))return {'armor.mode':'Choose how to create this armor.'};
    if(a.mode==='existing')return {};
    const errors:Record<string,string>={};
    if(!/^[0-3]$/.test(a.bonus))errors['armor.bonus']='Choose an armor bonus from 0 to 3.';
    if(a.bonusSource&&(!originalRow(a.bonusSource)||a.bonusSource.table!=='armor-bonus'))errors['armor.bonus']='Choose a current bonus or set it manually.';
    if(!a.feature||typeof a.feature.text!=='string'||!a.feature.text.trim()||a.feature.text.length>1000)errors['armor.feature']='Enter or roll an armor feature (up to 1,000 characters).';
    else if(a.feature.source&&(!originalRow(a.feature.source)||a.feature.source.table!=='armor-feature'))errors['armor.feature']='Choose a current armor feature or enter it manually.';
    return errors;
}
/** Native ArmorSD uses ac.modifier; adding an AC effect as well would double it. */
export function applyArmorRecipe(item:any,a:ArmorRecipe,base:any):void {
    if(a.mode!=='build')return;
    if(!isArmorBase(base))throw Error('Choose an available armor type from native gear.');
    item.system.ac={...base.system.ac,modifier:base.system.ac.modifier+Number(a.bonus)};
    item.system.baseArmor=base.system.baseArmor||slugify(base.name);
    if(Number(a.bonus)>0)item.system.magicItem=true;
    const text=a.feature.text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    item.system.description+=`<p><strong>Armor feature:</strong> ${text}</p>`;
}
