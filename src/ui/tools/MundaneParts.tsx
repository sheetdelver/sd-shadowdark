import React from 'react';
import { MUNDANE_TABLES } from '../../data/mundane-tables';
import { mundaneFollowUp, mundaneTable, originalRow, originalSelection, type MundaneRecipe, type MundanePart, type MundanePartKey } from '../../logic/mundane';

export function OriginalDice({label,onClick}:{label:string;onClick:()=>void}) {
    return <button type="button" className="sd-creator-dice" aria-label={label} title={label} onClick={onClick}>
        <img src="/icons/dice-d6.svg" alt="" aria-hidden="true"/>
    </button>;
}
export function OriginalSourceNote({part}:{part:MundanePart}) {
    const row=originalRow(part.source);
    if (!row || !part.source) return null;
    return <small>SheetDelver Originals · {part.source.total===undefined?'Selected':`Rolled ${part.source.total}`} · {row.text===part.text?'Unedited result':'Edited result'}</small>;
}

/** Reuses Creator's input/roller rows; category data stays environment-neutral. */
export default function MundaneParts({value,change,roll,rollObject,native,errors,rollError}:{
    value:MundaneRecipe;change:(m:MundaneRecipe)=>void;roll:(key:MundanePartKey)=>void;
    rollObject:()=>void;native:boolean;errors:Record<string,string>;rollError:(key:string)=>React.ReactNode;
}) {
    const part=(key:MundanePartKey,label:string,required=false)=>{
        const tableId=mundaneTable(value,key), table=tableId?MUNDANE_TABLES[tableId]:undefined;
        const update=(next:MundanePart)=>change({...value,[key]:next,...(key==='detail'?{detailFor:value.form.text}:{})});
        const error=errors[`mundane.${key}`];
        return <div className="sd-mundane-part" key={key}>
            <label htmlFor={`mundane-${key}`}>{label}{required?' *':''}</label>
            <div className="sd-mundane-input-row">
                <input id={`mundane-${key}`} value={value[key].text} maxLength={1000} aria-invalid={!!error}
                    aria-describedby={error?`mundane-error-${key}`:undefined} onChange={e=>update({...value[key],text:e.target.value})}/>
                {table&&<OriginalDice label={`Roll ${label.toLowerCase()}`} onClick={()=>roll(key)}/>}
            </div>
            {table&&<select aria-label={`Choose ${label.toLowerCase()}`} value={originalRow(value[key].source)?.text===value[key].text?value[key].source!.result:''}
                onChange={e=>{if(e.target.value)update(originalSelection(tableId!,e.target.value));else update({text:value[key].text});}}>
                <option value="">Enter your own or choose a result…</option>
                {table.rows.map(row=><option key={row.id} value={row.id}>{row.text}</option>)}
            </select>}
            <OriginalSourceNote part={value[key]}/>
            {value[key].text&&<button type="button" className="sd-mundane-clear" onClick={()=>update({text:''})}>Clear {label.toLowerCase()}</button>}
            {error&&<p id={`mundane-error-${key}`} role="alert">{error}</p>}
            {rollError(key)}
        </div>;
    };
    return <div className="sd-treasure-recipe">
        <h3>2. {native?'Optional unique feature':'Build the object'}</h3>
        <p>SheetDelver Originals are optional generation aids. Choose, roll or enter your own details.</p>
        {!native&&<><button type="button" className="sd-creator-roll" onClick={rollObject}>Roll object</button>
            <p>Rolls the form, workmanship or cut, any required detail and a suggested value. Notes and unique features are kept.</p>
            {rollError('object')}
            {part('form',value.path==='gemstone'?'Gemstone':value.path==='jewelry'?'Jewelry form':'Object form',true)}
            {part('material',value.path==='gemstone'?'Cut and appearance':'Material and workmanship')}
            {part('detail',mundaneFollowUp(value)?MUNDANE_TABLES[mundaneFollowUp(value)!].name:'Additional detail',!!mundaneFollowUp(value))}
        </>}
        {part('feature','Unique feature')}
        <p>Unique features are descriptive. Change the value explicitly if a detail affects its worth.</p>
        <h3>3. Finished item</h3>
    </div>;
}
