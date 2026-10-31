import React from 'react';
import { MAGIC_TABLES } from '../../data/magic-tables';
import { MAGIC_FAMILIES, magicTable, type MagicRecipe, type MagicGroup, type MagicFamily } from '../../logic/magic-attributes';
import { originalRow, originalSelection, type OriginalPart } from '../../logic/original-tables';
import { OriginalDice, OriginalSourceNote } from './MundaneParts';

export default function MagicAttributes({value,fixedFamily,allowPersonality=true,change,roll,errors,rollError}:{
    value:MagicRecipe;fixedFamily?:MagicFamily;allowPersonality?:boolean;change:(v:MagicRecipe)=>void;roll:(group:MagicGroup,index:number,table:string)=>void;
    errors:Record<string,string>;rollError:(key:string)=>React.ReactNode;
}) {
    const error=(key:string)=>errors[`magic.${key}`]?<p role="alert">{errors[`magic.${key}`]}</p>:null;
    const family=fixedFamily??value.family;
    const group=(key:MagicGroup)=>{
        const singular=key==='curses'?'curse':key.slice(0,-1),table=magicTable(family,key);
        return <div className="sd-treasure-part" key={key}>
            <h4>{key[0].toUpperCase()+key.slice(1)}</h4>{error(key)}
            {value[key].map((part,i)=>{
                const update=(next:OriginalPart)=>change({...value,[key]:value[key].map((v,j)=>i===j?next:v)});
                return <div className="sd-mundane-part" key={i}>
                    <label htmlFor={`magic-${key}-${i}`}>{singular[0].toUpperCase()+singular.slice(1)} {i+1} *</label>
                    <div className="sd-mundane-input-row"><textarea id={`magic-${key}-${i}`} aria-label={`${key} ${i+1}`} value={part.text} maxLength={1000} onChange={e=>update({...part,text:e.target.value})}/>
                        <OriginalDice label={`Roll ${singular} ${i+1}`} onClick={()=>roll(key,i,table)}/></div>
                    <select aria-label={`Choose ${singular} ${i+1}`} value={part.source?.table===table&&originalRow(part.source)?.text===part.text?part.source.result:''} onChange={e=>update(e.target.value?originalSelection(table,e.target.value):{text:part.text})}>
                        <option value="">Enter your own or choose a result…</option>{MAGIC_TABLES[table].rows.map(row=><option key={row.id} value={row.id}>{row.text}</option>)}
                    </select>{part.source&&<small>{MAGIC_TABLES[part.source.table]?.name}</small>}<OriginalSourceNote part={part}/>{error(`${key}.${i}`)}{rollError(`${key}.${i}`)}
                    <button type="button" onClick={()=>change({...value,[key]:value[key].filter((_,j)=>j!==i)})}>Remove {singular} {i+1}</button>
                </div>;
            })}
            <button type="button" disabled={value[key].length>=20} onClick={()=>change({...value,[key]:[...value[key],{text:''}]})}>Add {singular}</button>
        </div>;
    };
    return <>
        {error('enabled')}
        <section aria-label="Attributes" className="sd-treasure-recipe"><h3>Attributes</h3>
            <label><input type="checkbox" checked={value.attributesEnabled} onChange={e=>change({...value,attributesEnabled:e.target.checked})}/>Add attributes</label>
            {value.attributesEnabled&&<>
                <p>Roll or choose SheetDelver Originals alternatives, or enter results from your own source. Added descriptions are applied manually; existing item effects are preserved.</p>
                {fixedFamily?<p>Benefit and curse tables: {family[0].toUpperCase()+family.slice(1)}.</p>:<label>Benefit and curse tables<select aria-label="Benefit and curse tables" value={family} onChange={e=>change({...value,family:e.target.value as MagicFamily})}>
                    {MAGIC_FAMILIES.map(f=><option key={f} value={f}>{f[0].toUpperCase()+f.slice(1)}</option>)}
                </select></label>}{error('family')}
                {group('benefits')}{group('curses')}
            </>}
        </section>
        {allowPersonality&&<section aria-label="Personality" className="sd-treasure-recipe"><h3>Personality</h3>
            <label><input type="checkbox" checked={value.personalityEnabled} onChange={e=>change({...value,personalityEnabled:e.target.checked})}/>Add personality</label>
            {value.personalityEnabled&&<>
                <p>Item personalities share virtue and flaw tables across item types. Roll or choose SheetDelver Originals alternatives, or enter your own results.</p>
                {group('virtues')}{group('flaws')}
                <label>Personality trait *<input aria-label="Personality trait" value={value.trait} maxLength={1000} onChange={e=>change({...value,trait:e.target.value})}/></label>{error('trait')}
                <label>Item alignment *<input aria-label="Item alignment" value={value.alignment} maxLength={1000} onChange={e=>change({...value,alignment:e.target.value})}/></label>{error('alignment')}
            </>}
        </section>}
    </>;
}
