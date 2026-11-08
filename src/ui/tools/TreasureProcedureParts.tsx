import React from 'react';
import { ORIGINAL_TABLES } from '../../data/original-tables';
import { originalRow, originalSelection, type OriginalPart } from '../../logic/original-tables';
import { OriginalDice, OriginalSourceNote } from './MundaneParts';
import { NATIVE_PREDEFINED_EFFECTS } from '../../data/native-predefined-effects';
import { TREASURE_MODIFIERS, supportsTreasureModifiers, type TreasureModifier } from '../../logic/treasure-modifiers';

/** Existing paper/input/dice pattern, shared without merging category procedures. */
export function TreasurePart({label,table,value,change,roll,error,rollError}:{label:string;table:string;value:OriginalPart;
    change:(v:OriginalPart)=>void;roll:()=>void;error?:string;rollError?:React.ReactNode}){
    return <div className="sd-mundane-part"><h3>{label}</h3>
        <div className="sd-mundane-input-row"><textarea aria-label={label} aria-required="true" maxLength={1000} value={value.text} onChange={e=>change({...value,text:e.target.value})}/>
            <OriginalDice label={`Roll ${label.toLowerCase()}`} onClick={roll}/></div>
        <select aria-label={`Choose ${label.toLowerCase()}`} value={originalRow(value.source)?.text===value.text?value.source?.result??'':''} onChange={e=>change(e.target.value?originalSelection(table,e.target.value):{text:value.text})}>
            <option value="">Enter your own or choose a result…</option>{ORIGINAL_TABLES[table].rows.map(row=><option key={row.id} value={row.id}>{row.text}</option>)}
        </select><OriginalSourceNote part={value}/>{error&&<p role="alert">{error}</p>}{rollError}
    </div>;
}
export function PermanentModifiers({value,change,errors,type}:{value:TreasureModifier[];change:(v:TreasureModifier[])=>void;errors:Record<string,string>;type:string}){
    return <section aria-label="Permanent modifiers"><h3>Permanent modifiers</h3>
        {!supportsTreasureModifiers(type)&&<p role="alert">This item cannot grant permanent equipment modifiers. Remove these entries or choose equipment.</p>}
        <p>Add only unconditional equipment grants. These stack with the source’s effects and any armor or weapon bonus. Text alone does not add a modifier.</p>
        <p>{['Armor','Weapon'].includes(type)?'Active while equipped, identified and not stashed.':'Active while carried, identified and not stashed.'} No temporary or daily-use effects are created.</p>
        {value.map((m,i)=><div className="sd-mundane-part" key={i}>
            <label>Modifier<select aria-label={`Modifier ${i+1}`} value={m.id} onChange={e=>change(value.map((v,j)=>j===i?{id:e.target.value as TreasureModifier['id'],value:'1'}:v))}>
                {TREASURE_MODIFIERS.map(id=><option key={id} value={id} disabled={value.some((v,j)=>j!==i&&v.id===id)}>{NATIVE_PREDEFINED_EFFECTS[id].label}</option>)}
            </select></label>
            {m.id!=='initAdvantage'&&<label>Amount<input aria-label={`Modifier amount ${i+1}`} inputMode="numeric" value={m.value} onChange={e=>{if(/^-?\d*$/.test(e.target.value))change(value.map((v,j)=>j===i?{...v,value:e.target.value}:v));}}/></label>}
            <button type="button" onClick={()=>change(value.filter((_,j)=>j!==i))}>Remove modifier {i+1}</button>{errors[`modifiers.${i}`]&&<p role="alert">{errors[`modifiers.${i}`]}</p>}
        </div>)}
        <button type="button" disabled={!supportsTreasureModifiers(type)||value.length>=TREASURE_MODIFIERS.length} onClick={()=>{const id=TREASURE_MODIFIERS.find(id=>!value.some(v=>v.id===id));if(id)change([...value,{id,value:'1'}]);}}>Add permanent modifier</button>
        {errors.modifiers&&<p role="alert">{errors.modifiers}</p>}
    </section>;
}
