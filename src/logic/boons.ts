import { originalRow, type OriginalPart } from './original-tables';

export type BoonPath = 'oath'|'secret'|'blessing';
export type BoonPartKey = 'oath'|'detail'|'subject'|'benefit';
export interface BoonRecipe {
    path:BoonPath; level:string; oath:OriginalPart; detail:OriginalPart;
    subject:OriginalPart; benefit:OriginalPart; limits:string;
}
export const BOON_PARTS = {
    oath:{label:'Favor or promise',table:'boon-oath'},
    detail:{label:'Secret detail',table:'boon-secret-detail'},
    subject:{label:'Secret subject',table:'boon-secret-subject'},
    benefit:{label:'Blessing benefit',table:'boon-blessing'},
};
export const emptyBoonRecipe = ():BoonRecipe => ({path:'oath',level:'0',oath:{text:''},detail:{text:''},subject:{text:''},benefit:{text:''},limits:''});
export const boonKeys = (path:BoonPath):BoonPartKey[] => path==='secret'?['detail','subject']:path==='blessing'?['benefit']:['oath'];
export function boonName(b:BoonRecipe):string {
    const text=b.path==='secret'?`Secret: ${b.subject.text}`:b.path==='blessing'?b.benefit.text.split('. ')[0]:b.oath.text;
    return (boonKeys(b.path).some(key=>b[key].text.trim())?text:'').slice(0,200);
}
export function boonErrors(b:BoonRecipe):Record<string,string> {
    if(!b || !['oath','secret','blessing'].includes(b.path))return {'boon.path':'Choose a boon type.'};
    const errors:Record<string,string>={};
    if(!/^(?:[0-9]|10)$/.test(b.level))errors['boon.level']='Enter a level from 0 to 10.';
    for(const key of Object.keys(BOON_PARTS) as BoonPartKey[]){
        const part=b[key];
        if(!part||typeof part.text!=='string'||part.text.length>1000){errors[`boon.${key}`]='Enter up to 1,000 characters.';continue;}
        if(boonKeys(b.path).includes(key)&&!part.text.trim())errors[`boon.${key}`]=`Enter, choose or roll ${BOON_PARTS[key].label.toLowerCase()}.`;
        if(part.source&&(!originalRow(part.source)||part.source.table!==BOON_PARTS[key].table))errors[`boon.${key}`]='Choose a current result for this part or enter it manually.';
    }
    if(typeof b.limits!=='string'||b.limits.length>1000)errors['boon.limits']='Use up to 1,000 characters for duration and limits.';
    return errors;
}
export function boonDescription(b:BoonRecipe):string {
    const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    const text=b.path==='secret'?`${b.detail.text.trim()} ${b.subject.text.trim()}.`:b[b.path==='oath'?'oath':'benefit'].text;
    return `<p>${escape(text)}</p>`+(b.path==='blessing'&&b.limits.trim()?`<p><strong>Duration and limits:</strong> ${escape(b.limits)}</p>`:'');
}
