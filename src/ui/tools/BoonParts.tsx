import React from 'react';
import { BOON_TABLES } from '../../data/boon-tables';
import { BOON_PARTS, boonKeys, type BoonRecipe, type BoonPath, type BoonPartKey } from '../../logic/boons';
import { originalRow, originalSelection, type OriginalPart } from '../../logic/original-tables';
import { OriginalDice, OriginalSourceNote } from './MundaneParts';

export default function BoonParts({value,change,roll,rollAll,errors,rollError}:{
    value:BoonRecipe;change:(v:BoonRecipe)=>void;roll:(key:BoonPartKey)=>void;rollAll:()=>void;
    errors:Record<string,string>;rollError:(key:string)=>React.ReactNode;
}) {
    const error=(key:string)=>errors[`boon.${key}`]?<p id={`boon-error-${key}`} role="alert">{errors[`boon.${key}`]}</p>:null;
    return <div className="sd-treasure-recipe">
        <label>Boon type<select aria-label="Boon type" value={value.path} onChange={e=>change({...value,path:e.target.value as BoonPath})}>
            <option value="oath">Oath</option><option value="secret">Secret</option><option value="blessing">Blessing</option>
        </select></label>{error('path')}
        <p>{value.path==='oath'?'Record a favor or promise owed to the character.':value.path==='secret'?'Combine what is known with whom or what it concerns.':'Record a blessing, including any duration or limits. Its effects are managed by the GM.'}</p>
        <h3>2. Build the boon</h3>
        <p>SheetDelver Originals are optional generation aids. Choose, roll or enter your own details.</p>
        <button type="button" className="sd-creator-roll" onClick={rollAll}>Roll boon</button>
        <p>{value.path==='secret'?'Rolls both secret details independently.':'Rolls the selected boon type.'} Notes and manually entered limits are kept.</p>{rollError('all')}
        {boonKeys(value.path).map(key=>{
            const {label,table}=BOON_PARTS[key],part=value[key],id=`boon-${key}`,invalid=!!errors[`boon.${key}`];
            const update=(next:OriginalPart)=>change({...value,[key]:next});
            return <div className="sd-mundane-part" key={key}>
                <label htmlFor={id}>{label} *</label>
                <div className="sd-mundane-input-row"><textarea id={id} rows={4} value={part.text} maxLength={1000} aria-invalid={invalid} aria-describedby={invalid?`boon-error-${key}`:undefined} onChange={e=>update({...part,text:e.target.value})}/>
                    <OriginalDice label={`Roll ${label.toLowerCase()}`} onClick={()=>roll(key)}/></div>
                <select aria-label={`Choose ${label.toLowerCase()}`} value={originalRow(part.source)?.text===part.text?part.source!.result:''} onChange={e=>update(e.target.value?originalSelection(table,e.target.value):{text:part.text})}>
                    <option value="">Enter your own or choose a result…</option>{BOON_TABLES[table].rows.map(row=><option key={row.id} value={row.id}>{row.text}</option>)}
                </select><OriginalSourceNote part={part}/>
                {part.text&&<button type="button" className="sd-mundane-clear" onClick={()=>update({text:''})}>Clear {label.toLowerCase()}</button>}
                {error(key)}{rollError(key)}
            </div>;
        })}
        {value.path==='blessing'&&<div className="sd-mundane-part"><label htmlFor="boon-limits">Duration and limits</label><textarea id="boon-limits" rows={3} value={value.limits} maxLength={1000} placeholder="Optional clarification: duration, uses or conditions" onChange={e=>change({...value,limits:e.target.value})}/>{error('limits')}<p>Uses and expiration are recorded as text; they are not automatically tracked or reset by resting.</p></div>}
        <h3>3. Finished boon</h3>
        <label>Level gained<input inputMode="numeric" value={value.level} onChange={e=>{if(/^\d*$/.test(e.target.value)&&(!e.target.value||Number(e.target.value)<=10))change({...value,level:e.target.value});}}/></label>{error('level')}
    </div>;
}
