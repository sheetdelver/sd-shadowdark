import { originalRow, type OriginalSource, type OriginalPart } from './original-tables';
export { originalRow, originalSelection, type OriginalSource } from './original-tables';

export type MundanePath = 'luxury' | 'gemstone' | 'jewelry';
export type MundanePartKey = 'form' | 'material' | 'detail' | 'feature';
export type MundanePart = OriginalPart;
export interface MundaneRecipe {
    path: MundanePath;
    form: MundanePart; material: MundanePart; detail: MundanePart; feature: MundanePart;
    detailFor: string;
    valueSource?: OriginalSource;
}
export const emptyMundaneRecipe = (path: MundanePath = 'luxury'): MundaneRecipe => ({
    path, form:{text:''}, material:{text:''}, detail:{text:''}, feature:{text:''}, detailFor:'',
});
export function mundaneFollowUp(m: MundaneRecipe): string | undefined {
    const row=originalRow(m.form.source);
    return row?.text===m.form.text ? row.followUp : undefined;
}
export function mundaneTable(m: MundaneRecipe, key: MundanePartKey): string | undefined {
    if (key==='form') return m.path==='gemstone'?'gem-identity':m.path==='jewelry'?'jewelry-form':'luxury-form';
    if (key==='material') return m.path==='gemstone'?'gem-finish':'workmanship';
    return key==='feature'?'unique-feature':mundaneFollowUp(m);
}
export function mundaneName(m: MundaneRecipe): string {
    const form=m.form.text.trim();
    if (!form) return '';
    return (m.material.text.trim() ? `${m.material.text.trim()} ${form[0].toLowerCase()}${form.slice(1)}` : form).slice(0,200);
}
export const mundaneValueTable = (m: MundaneRecipe): string => `${m.path}-value`;
export function mundaneParts(m: MundaneRecipe): [string,string][] {
    return [['Form',m.form.text],[m.path==='gemstone'?'Cut and appearance':'Material and workmanship',m.material.text],
        ['Detail',m.detail.text],['Unique feature',m.feature.text]].filter(([,text])=>text.trim()) as [string,string][];
}
export function mundaneDescription(m: MundaneRecipe): string {
    const escape=(v:string)=>v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
    return mundaneParts(m).map(([label,text])=>`<p><strong>${label}:</strong> ${escape(text)}</p>`).join('');
}
export function mundaneErrors(m: MundaneRecipe, template: boolean): Record<string,string> {
    const errors:Record<string,string>={};
    if (!m || !['luxury','gemstone','jewelry'].includes(m.path)) return {'mundane.path':'Choose a mundane item path.'};
    for (const key of ['form','material','detail','feature'] as const) {
        const part=m[key];
        if (!part || typeof part.text!=='string' || part.text.length>1000) {errors[`mundane.${key}`]='Enter up to 1,000 characters.';continue;}
        // Provenance describes the author's source, not a permission or dice-integrity boundary.
        if (part.source && !originalRow(part.source)) errors[`mundane.${key}`]='This original source changed. Choose a current result or keep it as manual text.';
        if (part.source && key!=='detail' && part.source.table!==mundaneTable(m,key)) errors[`mundane.${key}`]='Choose a result for this part.';
    }
    if (!template && !m.form?.text?.trim()) errors['mundane.form']='Enter, choose or roll an item form.';
    if (!errors['mundane.form'] && ((mundaneFollowUp(m) && !m.detail?.text?.trim()) || (m.detail?.text?.trim() && m.detailFor!==m.form.text)))
        errors['mundane.detail']='Resolve the detail for this form. Choose or roll a new result, or edit the retained text.';
    if (m.valueSource && (m.valueSource.table!==mundaneValueTable(m) || !originalRow(m.valueSource))) errors.gp='Choose a current suggested value or enter a value manually.';
    return errors;
}

/** Integer native cost fields; keep denomination amounts explicit, including large totals. */
export function treasureValue(d:{gp:string;sp:string;cp:string;quantity:string}, total=false): string {
    if (![d.gp,d.sp,d.cp,d.quantity].every(v=>/^\d+$/.test(v))) return '—';
    const count=total?BigInt(d.quantity):BigInt(1);
    return `${BigInt(d.gp)*count} GP · ${BigInt(d.sp)*count} SP · ${BigInt(d.cp)*count} CP`;
}
