import React from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import { ARMOR_TABLES } from '../../data/armor-tables';
import { type ArmorRecipe } from '../../logic/armor-treasure';
import { originalRow, originalSelection } from '../../logic/original-tables';
import { OriginalDice, OriginalSourceNote } from './MundaneParts';

export default function ArmorParts({value,bases,selected,selectBase,change,roll,errors,rollError}:{
    value:ArmorRecipe;bases:any[];selected:string;selectBase:(uuid:string)=>void;change:(a:ArmorRecipe)=>void;
    roll:(key:'type'|'bonus'|'feature')=>void;errors:Record<string,string>;rollError:(key:string)=>React.ReactNode;
}) {
    const { resolveImageUrl }=useSDK();
    const error=(key:string)=>errors[key]?<p role="alert">{errors[key]}</p>:null;
    const base=bases.find(b=>b.uuid===selected),feature=value.feature;
    return <section aria-label="Armor recipe" className="sd-treasure-recipe sd-mundane-part">
        <h3>Armor type</h3>
        <div className="sd-mundane-input-row"><select aria-label="Armor type" aria-required="true" value={selected} onChange={e=>selectBase(e.target.value)}>
            <option value="">Choose armor type…</option>{bases.map(b=><option key={b.uuid} value={b.uuid}>{b.name}</option>)}
        </select><OriginalDice label="Roll armor type" disabled={!bases.length} onClick={()=>roll('type')}/></div>
        {base?.img&&<img className="sd-treasure-base-icon" src={resolveImageUrl(base.img)} alt={base.name}/>}
        <p>{bases.length?'Type rolls choose equally from available ordinary armor. AC, properties, slots, price and artwork come from the selected type.':'No readable armor types are available. Refresh sources or choose an existing item.'}</p>
        {error('templateUuid')}{rollError('type')}
        <h3>Armor bonus</h3>
        <div className="sd-mundane-input-row"><select aria-label="Armor bonus" aria-required="true" value={value.bonus} onChange={e=>change({...value,bonus:e.target.value,bonusSource:undefined})}>
            <option value="">Choose bonus…</option>{['0','1','2','3'].map(n=><option key={n} value={n}>{n==='0'?'None (+0)':`+${n}`}</option>)}
        </select><OriginalDice label="Roll armor bonus" onClick={()=>roll('bonus')}/></div>
        <OriginalSourceNote part={{text:value.bonus,source:value.bonusSource}}/>{error('armor.bonus')}{rollError('bonus')}
        <p>The bonus adds to this armor’s AC modifier. Bonus rolls use equally likely SheetDelver Originals suggestions.</p>
        <h3>Armor feature</h3>
        <div className="sd-mundane-input-row"><textarea aria-label="Armor feature" aria-required="true" value={feature.text} maxLength={1000} onChange={e=>change({...value,feature:{...feature,text:e.target.value}})}/>
            <OriginalDice label="Roll armor feature" onClick={()=>roll('feature')}/></div>
        <select aria-label="Choose armor feature" value={originalRow(feature.source)?.text===feature.text?feature.source?.result??'':''} onChange={e=>change({...value,feature:e.target.value?originalSelection('armor-feature',e.target.value):{text:feature.text}})}>
            <option value="">Enter your own or choose a result…</option>{ARMOR_TABLES['armor-feature'].rows.map(row=><option key={row.id} value={row.id}>{row.text}</option>)}
        </select><OriginalSourceNote part={feature}/>{error('armor.feature')}{rollError('feature')}
        <p>Features are cosmetic descriptions. Roll original alternatives or enter a result from your own source.</p>
    </section>;
}
