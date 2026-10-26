import { advancementSpellChoices, spellLimit } from './spell-model';
import { canonicalUuid } from './identity';

/** Ordinary choices fill each tier's earliest native level slots in selection
 * order. Grants never enter this list or consume its allowances. */
export function creatorSpellProgression(classDoc:any, target:number, selections:readonly {source:string}[], catalog:readonly any[]) {
    if(!classDoc?.system?.spellcasting?.ability||target===0)return [];
    const byRef=new Map(catalog.map(doc=>[canonicalUuid(doc.uuid),doc]));
    const byTier=new Map<number,string[]>();
    for(const selection of selections){
        const tier=byRef.get(canonicalUuid(selection.source))?.system?.tier;
        if(!byTier.has(tier))byTier.set(tier,[]);
        byTier.get(tier)!.push(selection.source);
    }
    const used=new Map<number,number>();
    return Array.from({length:target},(_,i)=>{
        const level=i+1,delta=advancementSpellChoices(classDoc,level-1,level);
        const tiers=[1,2,3,4,5].map(tier=>{
            const required=delta.required[tier]??0,offset=used.get(tier)??0;
            const selected=(byTier.get(tier)??[]).slice(offset,offset+required);
            used.set(tier,offset+required);
            const limit=spellLimit(classDoc.system.spellcasting.spellsknown,level,tier);
            return {tier,required,selected,knownBefore:Math.min(offset,(byTier.get(tier)??[]).length),limit};
        });
        return {level,tiers,diagnostics:delta.diagnostics,complete:delta.diagnostics.length===0&&tiers.every(t=>t.selected.length===t.required)};
    });
}
