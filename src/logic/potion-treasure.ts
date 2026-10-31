import { originalRow, type OriginalPart } from './original-tables';

export const POTION_KEYS=['first','second','third'] as const;
export type PotionPart=typeof POTION_KEYS[number];
export interface PotionRecipe { mode:'build'|'existing'; first:OriginalPart;second:OriginalPart;third:OriginalPart }
export const emptyPotionRecipe=(mode:PotionRecipe['mode']='build'):PotionRecipe=>({mode,first:{text:''},second:{text:''},third:{text:''}});
export const potionFeatureTable=(key:PotionPart)=>`potion-feature-${key}`;
export function potionErrors(p:PotionRecipe):Record<string,string>{
    if(!p||!['build','existing'].includes(p.mode))return {'potion.mode':'Choose how to create this potion.'};
    if(p.mode==='existing')return {};
    const errors:Record<string,string>={};
    POTION_KEYS.forEach((key,i)=>{
        const part=p[key];
        if(!part||typeof part.text!=='string'||!part.text.trim()||part.text.length>1000)errors[`potion.${key}`]=`Enter, choose or roll feature ${i+1} (up to 1,000 characters).`;
        else if(part.source&&(!originalRow(part.source)||part.source.table!==potionFeatureTable(key)))errors[`potion.${key}`]='Choose a current result for this feature or enter it manually.';
    });
    return errors;
}
export function potionDescription(p:PotionRecipe):string {
    if(p.mode!=='build')return '';
    const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    return POTION_KEYS.map((key,i)=>`<p><strong>Potion feature ${i+1}:</strong> ${escape(p[key].text)}</p>`).join('');
}
