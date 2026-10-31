import React from 'react';
import { POTION_TABLES } from '../../data/potion-tables';
import { POTION_KEYS, potionFeatureTable, type PotionPart, type PotionRecipe } from '../../logic/potion-treasure';
import { originalRow, originalSelection, type OriginalPart } from '../../logic/original-tables';
import { OriginalDice, OriginalSourceNote } from './MundaneParts';

export default function PotionParts({value,change,roll,errors,rollError}:{
    value:PotionRecipe;change:(p:PotionRecipe)=>void;roll:(key:PotionPart|'all')=>void;
    errors:Record<string,string>;rollError:(key:string)=>React.ReactNode;
}) {
    return <section aria-label="Potion recipe" className="sd-treasure-recipe">
        <h3>Potion features</h3>
        <p>Choose three appearance features, then add potion benefits or curses below. Roll original alternatives or enter results from your own source.</p>
        <button type="button" className="sd-creator-roll" onClick={()=>roll('all')}>Roll all features</button>{rollError('all')}
        {POTION_KEYS.map((key,i)=>{
            const part=value[key],table=potionFeatureTable(key),label=`Potion feature ${i+1}`;
            const update=(next:OriginalPart)=>change({...value,[key]:next});
            return <div key={key} className="sd-mundane-part">
                <label htmlFor={`potion-${key}`}>Feature {i+1} *</label>
                <div className="sd-mundane-input-row"><textarea id={`potion-${key}`} aria-label={label} aria-required="true" maxLength={1000} value={part.text} onChange={e=>update({...part,text:e.target.value})}/>
                    <OriginalDice label={`Roll potion feature ${i+1}`} onClick={()=>roll(key)}/></div>
                <select aria-label={`Choose potion feature ${i+1}`} value={originalRow(part.source)?.text===part.text?part.source?.result??'':''} onChange={e=>update(e.target.value?originalSelection(table,e.target.value):{text:part.text})}>
                    <option value="">Enter your own or choose a result…</option>{POTION_TABLES[table].rows.map(row=><option key={row.id} value={row.id}>{row.text}</option>)}
                </select><OriginalSourceNote part={part}/>{errors[`potion.${key}`]&&<p role="alert">{errors[`potion.${key}`]}</p>}{rollError(key)}
            </div>;
        })}
        <p>The features describe its appearance. Benefits and curses describe what drinking it does; those outcomes are managed by the GM.</p>
    </section>;
}
