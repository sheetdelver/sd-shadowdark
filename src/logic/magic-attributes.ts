import { isScroll } from './scrolls';
import { isWand } from './wands';
import { originalRow, type OriginalPart } from './original-tables';

export const MAGIC_GROUPS=['benefits','curses','virtues','flaws'] as const;
export type MagicGroup=typeof MAGIC_GROUPS[number];
export const MAGIC_FAMILIES=['armor','potion','utility','weapon','wand','scroll'] as const;
export type MagicFamily=typeof MAGIC_FAMILIES[number];
export interface MagicRecipe {
    attributesEnabled:boolean; personalityEnabled:boolean; family:MagicFamily;
    benefits:OriginalPart[];curses:OriginalPart[];virtues:OriginalPart[];flaws:OriginalPart[];
    trait:string;alignment:string;
}
export const emptyMagicRecipe=():MagicRecipe=>({attributesEnabled:false,personalityEnabled:false,family:'utility',
    benefits:[],curses:[],virtues:[],flaws:[],trait:'',alignment:''});
export const magicGroupEnabled=(m:MagicRecipe,key:MagicGroup)=>key==='benefits'||key==='curses'?m.attributesEnabled:m.personalityEnabled;
/** Match each actual item subtype, including legacy scroll/wand native templates. */
export function magicFixedFamily(category?:string,item?:any,kind?:string):MagicFamily|undefined {
    if(kind==='Scroll'||isScroll(item))return 'scroll';
    if(kind==='Wand'||isWand(item))return 'wand';
    if(category==='scrolls')return undefined;
    if(category==='armor'||item?.type==='Armor')return 'armor';
    if(category==='potions'||item?.type==='Potion')return 'potion';
    if(category==='weapons'||item?.type==='Weapon')return 'weapon';
    if(category==='utility'||category==='mundane'||item?.type==='Basic'||item?.type==='Gem')return 'utility';
    return undefined;
}
export const magicTable=(family:MagicFamily,group:MagicGroup)=>`${group==='virtues'||group==='flaws'?'personality':family}-${group}`;
export const magicHasAdditions=(m?:MagicRecipe)=>!!m&&(MAGIC_GROUPS.some(key=>magicGroupEnabled(m,key)&&m[key].some(part=>part.text.trim()))||m.personalityEnabled&&!!(m.trait.trim()||m.alignment.trim()));
export function magicErrors(m:MagicRecipe):Record<string,string>{
    const errors:Record<string,string>={};
    if(typeof m?.attributesEnabled!=='boolean'||typeof m?.personalityEnabled!=='boolean')return {'magic.enabled':'Choose whether to add attributes or a personality.'};
    if(m.attributesEnabled&&!MAGIC_FAMILIES.includes(m.family))errors['magic.family']='Choose a benefit and curse table family.';
    for(const key of MAGIC_GROUPS){
        if(!magicGroupEnabled(m,key))continue;
        const entries=m[key];
        if(!Array.isArray(entries)||entries.length>20){errors[`magic.${key}`]='Use at most 20 entries per group.';continue;}
        entries.forEach((part,i)=>{
            if(!part||typeof part.text!=='string'||!part.text.trim()||part.text.length>1000)errors[`magic.${key}.${i}`]='Enter this result, including any required follow-up choices (up to 1,000 characters).';
            else if(part.source){
                const allowed=key==='virtues'||key==='flaws'
                    ? part.source.table===magicTable(m.family,key)
                    : MAGIC_FAMILIES.some(f=>part.source!.table===magicTable(f,key));
                if(!originalRow(part.source)||!allowed)errors[`magic.${key}.${i}`]='Choose a current result for this property or enter it manually.';
            }
        });
    }
    if(m.personalityEnabled){
        for(const key of ['trait','alignment'] as const)if(typeof m[key]!=='string'||m[key].length>1000)errors[`magic.${key}`]='Enter up to 1,000 characters.';
        if(typeof m.trait==='string'&&!m.trait.trim())errors['magic.trait']='Enter the personality trait.';
        if(typeof m.alignment==='string'&&!m.alignment.trim())errors['magic.alignment']='Choose the item’s alignment.';
    }
    return errors;
}
export function magicDescription(m?:MagicRecipe):string {
    if(!m)return '';
    const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    const singular={benefits:'Benefit',curses:'Curse',virtues:'Virtue',flaws:'Flaw'};
    const parts:[string,string][]=MAGIC_GROUPS.flatMap(key=>magicGroupEnabled(m,key)?m[key].map(part=>[singular[key],part.text] as [string,string]):[]);
    if(m.personalityEnabled)parts.push(['Personality trait',m.trait],['Item alignment',m.alignment]);
    return parts.filter(([,text])=>text.trim()).map(([label,text])=>`<p><strong>${label}:</strong> ${escape(text)}</p>`).join('');
}
