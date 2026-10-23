'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSDK, useSDKComponents } from '@sheet-delver/sdk/react';
import { ShadowdarkUIProvider, useShadowdarkCollections } from '../context/ShadowdarkUIContext';
import { CollectionStatus } from '../components/CollectionStatus';
import CompendiumSelectModal from '../components/CompendiumSelectModal';
import GearSelectionModal from '../components/GearSelectionModal';
import ModulePageHeader from '../components/ModulePageHeader';
import { StatPoolSelectionSection } from '../components/levelup/sections/StatPoolSelectionSection';
import { emptyCharacterDraft, type CharacterDraft, type CreatorChoices, type NumericEntry } from '../../logic/character-creation';
import { ABILITY_KEYS } from '../../logic/actor-preparation';
import { canonicalUuid } from '../../logic/identity';
import { isScroll } from '../../logic/scrolls';
import { isWand, wandSpells } from '../../logic/wands';
import type { CreatorPlan } from '../../logic/character-creation';

const STEPS=['Identity','Ability scores','Talents and boons','Languages and spells','Hit points','Equipment and money','Review and create'];
const id=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
const label=(row:any)=>`${row.name}${row.system?.source?.title||row.pack?` — ${row.system?.source?.title||row.pack}`:''}`;
type Operation={requestId:string;state:string;actorId?:string;message:string};
export default function CharacterCreator(){return <ShadowdarkUIProvider><CreatorContent /></ShadowdarkUIProvider>;}
export function CreatorContent() {
    const {fetchWithAuth,navigate,worldId,moduleId,currentUser,isConnected,events}=useSDK();
    const {ConfirmationModal}=useSDKComponents();
    const data=useShadowdarkCollections(['classes','ancestries','backgrounds','deities','patrons','talents','spells','languages','gear','magic-items','properties']);
    const [draft,setDraft]=useState<CharacterDraft>(emptyCharacterDraft),[step,setStep]=useState(0),[plan,setPlan]=useState<CreatorPlan|null>(null);
    const [planStale,setPlanStale]=useState(true);
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[reviewNeeded,setReviewNeeded]=useState(false);
    const [operation,setOperation]=useState<Operation|null>(null),[statusReady,setStatusReady]=useState(false);
    const [requestId,setRequestId]=useState(id),[confirm,setConfirm]=useState<{title:string;message:string;run:()=>void}|null>(null);
    const [picker,setPicker]=useState<{title:string;options:any[];select:(row:any)=>void}|null>(null),[gearOpen,setGearOpen]=useState(false);
    const [gains,setGains]=useState<Record<number,number|null>>({}),[calculate,setCalculate]=useState(false);
    const [tableUuid,setTableUuid]=useState(''),[tableTotal,setTableTotal]=useState<number|null>(null);
    const epoch=useRef(0),scope=JSON.stringify([worldId,moduleId,currentUser?.id,currentUser?.role]),oldScope=useRef(scope);
    const actionEpoch=useRef(0);
    const dismissedReceipt=useRef<string|null>(null);
    const heading=useRef<HTMLHeadingElement>(null);
    const locked=busy||operation?.state==='uncertain'||operation?.state==='complete';
    const post=async(path:string,body:any,signal?:AbortSignal)=>{
        const response=await fetchWithAuth(`/api/modules/shadowdark/characters/creator/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
        const result=await response.json();if(!response.ok&&result.creationWrites!=='none')throw new Error(result.error||'This character could not be reviewed.');return result;
    };
    const edit=(change:(d:CharacterDraft)=>void,keepAcknowledgements=false)=>{
        epoch.current++;setPlanStale(true);setError('');setConfirm(null);
            setDraft(previous=>{const next=structuredClone(previous);if(!keepAcknowledgements)next.acknowledgements=[];change(next);return next;});
    };
    useLayoutEffect(()=>{
        epoch.current++;actionEpoch.current++;setPlan(null);setPicker(null);setGearOpen(false);setConfirm(null);setBusy(false);setStatusReady(false);
        if(oldScope.current!==scope){setDraft(emptyCharacterDraft());setStep(0);setOperation(null);setRequestId(id());setGains({});dismissedReceipt.current=null;oldScope.current=scope;}
    },[scope,isConnected,data.generation]);
    useEffect(()=>events.on('world:contextChanged',()=>{epoch.current++;actionEpoch.current++;setBusy(false);setPlan(null);setReviewNeeded(true);setConfirm(null);setRefresh(n=>n+1);}),[events]);
    useEffect(()=>{heading.current?.focus();},[step]);
    useEffect(()=>{
        if(!isConnected)return;let active=true;setStatusReady(false);
        post('status',{}).then(result=>{if(active){if(result.operation?.requestId!==dismissedReceipt.current)setOperation(result.operation);setStatusReady(true);}}).catch(e=>{if(active)setError(e.message);});
        return()=>{active=false;};
    },[scope,isConnected,refresh,data.generation]);
    useEffect(()=>{
        if(!isConnected||!data.ready)return;
        const current=++epoch.current,controller=new AbortController();
        const timer=setTimeout(()=>{post('prepare',{draft},controller.signal).then(result=>{if(current===epoch.current){setPlan(result.plan);setPlanStale(false);setError('');}})
            .catch(e=>{if(current===epoch.current&&e.name!=='AbortError')setError(e.message);});},250);
        return()=>{clearTimeout(timer);controller.abort();};
    },[draft,scope,isConnected,data.ready,data.generation,refresh,fetchWithAuth]);
    useEffect(()=>()=>{epoch.current++;},[]);
    const choose=(collection:string,title:string,selected:(row:any)=>void)=>setPicker({title,options:data.collections[collection]??[],select:selected});
    const identity=(key:'classUuid'|'ancestryUuid'|'backgroundUuid'|'deityUuid'|'patronUuid',collection:string,title:string,required=false)=><div className="sd-creator-field" key={key}>
        <span>{title}{required?' *':''}</span><button type="button" onClick={()=>choose(collection,title,row=>{edit(d=>{d[key]=row.uuid;});setReviewNeeded(true);})}>
            {(data.collections[collection]??[]).find((r:any)=>r.uuid===draft[key])?.name||(draft[key]?'Source unavailable':'Choose…')}</button>
        {!required&&draft[key]&&<button type="button" onClick={()=>edit(d=>{d[key]='';})}>None</button>}</div>;
    const number=(title:string,entry:NumericEntry,onChange:(entry:NumericEntry)=>void)=><label className="sd-creator-field"><span>{title}</span>
        <input aria-label={title} type="number" min="0" step="1" value={entry.value??''} onChange={e=>onChange({...entry,value:e.target.value===''?null:e.target.valueAsNumber})}/>
        <select aria-label={`${title} basis`} value={entry.basis} onChange={e=>onChange({...entry,basis:e.target.value as NumericEntry['basis']})}>
            <option value="effective">Paper total</option><option value="base">Native base</option></select></label>;
    const choice=(p:any)=>{
        const award=draft.awards.find(a=>a.id===p.awardId);
        const choiceKey=award?.origin==='recorded'?award.source!:p.key===p.awardId?'stats':p.key.slice(p.awardId.length+1);
        const current:CreatorChoices=award?award.choices[choiceKey]??{}:draft.fixedChoices[p.key]??{};
        const update=(f:(c:CreatorChoices)=>void)=>edit(d=>{const a=d.awards.find(a=>a.id===p.awardId),target=a?(a.choices[choiceKey]??={}):(d.fixedChoices[p.key]??={});f(target);});
        return <div className="sd-creator-award" key={p.key}><h3>{p.name}</h3><p>{p.origin==='fixed'?'Fixed grant':p.level===null?'Acquisition level unknown':`Gained at level ${p.level}`}</p>
            {p.statRule&&<StatPoolSelectionSection total={p.statRule.total} maxPerStat={p.statRule.maxPerStat} title={p.name} allocated={current.stats??{}}
                onChange={(stat,delta)=>update(c=>{c.stats={...c.stats,[stat]:(c.stats?.[stat]??0)+delta};})}/>}
            {p.targetKind&&<label>Choose {p.targetKind}<select value={current.target??''} onChange={e=>update(c=>{c.target=e.target.value;})}>
                <option value="">Choose…</option>{(plan?.targetCatalog[p.targetKind as keyof CreatorPlan['targetCatalog']]??[]).map((o:any)=><option key={o.slug} value={o.name}>{o.name}</option>)}</select></label>}
            {p.spellGrant&&<><button type="button" onClick={()=>choose('spells',`Spell for ${p.name}`,row=>update(c=>{c.spell=row.uuid;}))}>
                {(data.collections.spells??[]).find((s:any)=>s.uuid===current.spell)?.name??'Choose granted Spell…'}</button>
                {!p.spellGrant.classUuid&&current.spell&&<label>Granted casting list<select aria-label={`Casting list for ${p.name}`} value={current.castingClass??''} onChange={e=>update(c=>{c.castingClass=e.target.value;})}>
                    <option value="">Choose…</option>{((data.collections.spells??[]).find((s:any)=>s.uuid===current.spell)?.system?.class??[]).map((ref:string)=><option key={ref} value={ref}>{(data.collections.classes??[]).find((r:any)=>r.uuid===ref)?.name??'Unavailable Class'}</option>)}</select></label>}
                <p>{p.spellGrant.label}; eligibility is checked at this award’s acquisition level.</p></>}
        </div>;
    };
    const roll=async(kind:'score'|'hp'|'table',apply:(total:number)=>void,extra:any={})=>{
        const current=epoch.current,action=++actionEpoch.current;setBusy(true);setError('');
        try {const result=await post('roll',{kind,...extra});if(current===epoch.current)apply(result.total);}catch(e){if(current===epoch.current)setError((e as Error).message);}finally{if(action===actionEpoch.current)setBusy(false);}
    };
    const rollScores=(key?:typeof ABILITY_KEYS[number])=>{
        const run=async()=>{
            const current=epoch.current,action=++actionEpoch.current;setBusy(true);
            try {
                const keys=key?[key]:ABILITY_KEYS,results:(readonly [typeof ABILITY_KEYS[number],number])[]=[];
                for(const stat of keys){const result=await post('roll',{kind:'score'});if(current!==epoch.current)return;results.push([stat,result.total] as const);}
                edit(d=>{for(const [stat,total] of results)d.abilities[stat]={value:total,basis:'base'};});
            }catch(e){if(current===epoch.current)setError((e as Error).message);}finally{if(action===actionEpoch.current)setBusy(false);}
        };
        if((key?[key]:ABILITY_KEYS).some(k=>draft.abilities[k].value!==null))setConfirm({title:'Replace entered scores?',message:'Rolling replaces the selected scores with native base scores. Permanent bonuses will be applied in review.',run:()=>void run()});else void run();
    };
    const checkCreation=async()=>{
        const current=epoch.current,action=++actionEpoch.current;
        setBusy(true);try{const result=await post('status',operation?{requestId:operation.requestId}:{});if(current!==epoch.current)return;if(result.operation)setOperation(result.operation);else if(operation?.state==='uncertain')setError('The saved creation receipt is unavailable. This does not prove creation failed; review with your GM before any replacement.');setStatusReady(true);}catch(e){if(current===epoch.current)setError((e as Error).message);}finally{if(action===actionEpoch.current)setBusy(false);}
    };
    const create=async()=>{
        if(!plan?.ready||planStale||!statusReady)return;
        const current=epoch.current,action=++actionEpoch.current,saved={draft,review:plan.review,contextRevision:plan.contextRevision,requestId};
        setBusy(true);setError('');
        // Treat a lost HTTP reply as uncertain immediately. Status, never create,
        // is the continuation even if the browser knows no resulting Actor ID.
        setOperation({requestId,state:'uncertain',message:'Creation is being submitted. Check creation if the result is interrupted.'});
        try {
            const result=await post('create',saved);
            if(current!==epoch.current)return;
            if(result.creationWrites==='none'){if(result.plan)setPlan(result.plan);setOperation(null);setError(result.error);}
            else if(result.reviewChanged){setPlan(result.plan);setOperation(null);setError('Sources or reviewed entries changed. Review the refreshed character before creating.');}
            else setOperation(result.operation);
        }catch(e){if(current===epoch.current)setError((e as Error).message);}finally{if(action===actionEpoch.current)setBusy(false);}
    };
    const fixedSources=new Set(plan?.fixedSpells.map(s=>s.source)??[]);
    const allItems=[...(data.collections.gear??[]),...(data.collections['magic-items']??[])];
    return <main className="sd-creator font-crimson font-inter font-sans pb-24">
        <ModulePageHeader title="Character Creator" context={`Step ${step+1} of ${STEPS.length}`} onBack={()=>setConfirm({title:'Leave Character Creator?',message:operation?.state==='uncertain'?'The creation receipt is retained for review when you return. Editable entries are kept only on this page.':'Your editable entries are kept only on this page. Leave and discard them?',run:()=>navigate('/')})} />
        <div className="sd-creator-body">
            <nav className="sd-creator-steps" aria-label="Creation steps"><ol>{STEPS.map((s,i)=><li key={s}><button type="button" aria-current={i===step?'step':undefined} onClick={()=>setStep(i)}>{i+1}. {s}</button></li>)}</ol></nav>
            <section className="sd-creator-summary" aria-label="Character summary"><strong>{draft.name||'Your character'}</strong><span>Level {draft.level}</span><span>{plan&&!planStale?`AC ${plan.preview.ac} · HP ${plan.preview.hp.value}/${plan.preview.hp.max}`:'Preparing current entries…'}</span><span>{draft.awards.length} awards · {draft.gear.length} inventory entries</span></section>
            <div className="sd-creator-page"><CollectionStatus state={data} label="Loading readable native character sources…" />
            {!isConnected&&<p role="alert">Disconnected. Entries are preserved; reconnect and review before continuing.</p>}
            {error&&<p role="alert">{error}</p>}
            {reviewNeeded&&<p className="sd-creator-notice">Earlier entries are retained. Review dependent talents, spells, languages and totals after changing identity or sources. <button type="button" onClick={()=>setReviewNeeded(false)}>Reviewed</button></p>}
            {operation&&<section aria-label="Creation outcome" className="sd-creator-notice"><p role="status">{operation.message}</p><p>Operation {operation.requestId}</p>
                {operation.state!=='not-created'&&<button type="button" disabled={busy||!isConnected} onClick={()=>void checkCreation()}>Check creation</button>}
                {operation.state==='complete'&&operation.actorId&&<button type="button" onClick={()=>navigate(`/actors/${operation.actorId}`)}>Open character</button>}
                {operation.state==='complete'&&<button type="button" onClick={()=>{dismissedReceipt.current=operation.requestId;setOperation(null);setRequestId(id());edit(d=>Object.assign(d,emptyCharacterDraft()));setStep(0);}}>Start another character</button>}
                {operation.state==='not-created'&&<button type="button" onClick={()=>{setOperation(null);setRequestId(id());}}>Continue editing</button>}
            </section>}
            <h2 ref={heading} tabIndex={-1}>{step+1}. {STEPS[step]}</h2>
            <fieldset disabled={locked||!data.ready||!isConnected} className={`sd-creator-fields${step===0?' sd-creator-identity':''}`}>
                {step===0&&<><label className="sd-creator-name">Name<input placeholder="Character Name" value={draft.name} onChange={e=>edit(d=>{d.name=e.target.value;})}/></label>
                    <label>Level<select aria-label="Level" value={draft.level} onChange={e=>{edit(d=>{d.level=Number(e.target.value);});setReviewNeeded(true);}}>{Array.from({length:21},(_,n)=><option key={n}>{n}</option>)}</select></label>
                    <label>Current XP<input type="number" min="0" value={draft.xp} onChange={e=>edit(d=>{d.xp=e.target.valueAsNumber;})}/></label>
                    {draft.level>0?identity('classUuid','classes','Class',true):<p>Level 0 uses the native Level 0 Class, without first-level adventuring grants.</p>}
                    {identity('ancestryUuid','ancestries','Ancestry',true)}{identity('backgroundUuid','backgrounds','Background')}
                    <label>Alignment<select value={draft.alignment} onChange={e=>edit(d=>{d.alignment=e.target.value as CharacterDraft['alignment'];})}><option value="">None</option>{['lawful','neutral','chaotic'].map(a=><option key={a}>{a}</option>)}</select></label>
                    {identity('deityUuid','deities','Deity')}{(plan?.requiresPatron||draft.patronUuid)&&identity('patronUuid','patrons','Patron',!!plan?.requiresPatron)}
                </>}
                {step===1&&<><p>Enter scores on your sheet, including permanent bonuses. Choose Native base when bonuses have not been added. Optional rolls supply base scores.</p>
                    <button type="button" className="sd-creator-roll" onClick={()=>rollScores()}>Roll all scores</button><div className="sd-creator-grid sd-creator-scores">{ABILITY_KEYS.map(k=><div className="sd-creator-score" key={k}>
                        {number(k.toUpperCase(),draft.abilities[k],entry=>edit(d=>{d.abilities[k]=entry;}))}
                        <span>Prepared modifier {planStale?'…':plan?.preview.abilities[k]?.mod??'—'}</span><button type="button" className="sd-creator-roll" onClick={()=>rollScores(k)}>Roll {k.toUpperCase()}</button></div>)}</div></>}
                {step===2&&<><p>Enter awards actually received. Repeated awards remain separate. Historical table totals are optional.</p>
                    <p>Native level data suggests {plan?.expectedAwards??'…'} awards.</p>
                    {plan&&plan.ancestryChoiceCount>0&&<fieldset><legend>Choose {plan.ancestryChoiceCount} ancestry talents</legend>{plan.ancestryOptions.map(o=><label key={o.uuid}><input type="checkbox" checked={draft.ancestryTalents.includes(o.uuid)} onChange={()=>edit(d=>{d.ancestryTalents=d.ancestryTalents.includes(o.uuid)?d.ancestryTalents.filter(r=>r!==o.uuid):[...d.ancestryTalents,o.uuid];})}/>{o.name}</label>)}</fieldset>}
                    {!!plan?.classChoiceCount&&<fieldset><legend>Choose {plan.classChoiceCount} Class talents</legend>{plan.classOptions.map(o=><label key={o.uuid}><input type="checkbox" checked={draft.classTalents.includes(o.uuid)} onChange={()=>edit(d=>{d.classTalents=d.classTalents.includes(o.uuid)?d.classTalents.filter(r=>r!==o.uuid):[...d.classTalents,o.uuid];})}/>{o.name}</label>)}</fieldset>}
                    <button type="button" onClick={()=>choose('talents','Recorded Talent or Boon',row=>edit(d=>{d.awards.push({id:id(),origin:'recorded',level:null,source:row.uuid,choices:{}});}))}>Add recorded award</button>
                    <details><summary>Choose or roll a native table result</summary><label>Award table<select value={tableUuid} onChange={e=>{setTableUuid(e.target.value);setTableTotal(null);}}><option value="">Choose…</option>{plan?.tables.map(t=><option key={t.uuid} value={t.uuid}>{t.name}</option>)}</select></label>
                        <label>Native result group<select value={tableTotal??''} onChange={e=>setTableTotal(e.target.value===''?null:Number(e.target.value))}><option value="">Choose…</option>{plan?.tables.find(t=>t.uuid===tableUuid)?.outcomes.map((o:any)=><option key={o.total} value={o.total}>{o.total}: {o.options.map((r:any)=>r.label).join(' / ')||o.text}</option>)}</select></label>
                        <button type="button" disabled={!tableUuid} onClick={()=>void roll('table',setTableTotal,{tableUuid})}>Roll table</button>
                        <button type="button" disabled={!tableUuid||tableTotal===null} onClick={()=>edit(d=>{const outcome=plan?.tables.find(t=>t.uuid===tableUuid)?.outcomes.find((o:any)=>o.range[0]<=tableTotal!&&o.range[1]>=tableTotal!);d.awards.push({id:id(),origin:'table',table:tableUuid,total:tableTotal!,results:outcome?.mode==='bundle'?outcome.options.map((o:any)=>o.id):[],level:null,choices:{}});})}>Add table award</button></details>
                    {draft.awards.map(a=>{const view=plan?.awards.find(r=>r.id===a.id),outcome=plan?.tables.find(t=>t.uuid===a.table)?.outcomes.find((o:any)=>o.range[0]<=a.total!&&o.range[1]>=a.total!);return <section className="sd-creator-award" key={a.id}><h3>{view?.name||'Recorded award'}</h3>
                        <label>Acquisition level (leave empty if unknown)<input type="number" min="0" max={draft.level} value={a.level??''} onChange={e=>edit(d=>{d.awards.find(r=>r.id===a.id)!.level=e.target.value===''?null:e.target.valueAsNumber;})}/></label>
                        {a.origin==='table'&&outcome?.mode==='choose'&&<fieldset><legend>Choose {outcome.count} result</legend>{outcome.options.map((o:any)=><label key={o.id}><input type="checkbox" checked={a.results?.includes(o.id)??false} onChange={()=>edit(d=>{const target=d.awards.find(r=>r.id===a.id)!;target.results=target.results!.includes(o.id)?target.results!.filter(r=>r!==o.id):[...target.results!,o.id];})}/>{o.label}</label>)}</fieldset>}
                        <button type="button" onClick={()=>edit(d=>{d.awards=d.awards.filter(r=>r.id!==a.id);})}>Remove award</button></section>;})}
                    {plan?.choices.map(choice)}
                </>}
                {step===3&&<><h3>Languages</h3><p>Fixed languages: {plan?.languagePlan.fixed.map(ref=>plan.languagePlan.rows.find(r=>r.uuid===ref)?.name??'Unavailable').join(', ')||'None'}</p>
                    {plan?.languagePlan.groups.filter(g=>g.count>0).map(g=><p key={g.id}>{g.label}: {g.count} choices</p>)}
                    <button type="button" onClick={()=>choose('languages','Language on your sheet',row=>edit(d=>{if(!d.languages.includes(row.uuid))d.languages.push(row.uuid);}))}>Add Language</button>
                    <ul>{draft.languages.map(ref=><li key={ref}>{(data.collections.languages??[]).find((r:any)=>r.uuid===ref)?.name??'Source unavailable'} <button type="button" onClick={()=>edit(d=>{d.languages=d.languages.filter(r=>r!==ref);})}>Remove language</button></li>)}</ul>
                    <h3>Spells</h3><p>Fixed Spells: {plan?.fixedSpells.map(s=>s.name).join(', ')||'None'}. Fixed Spells are included automatically.</p>
                    <button type="button" onClick={()=>setPicker({title:'Ordinary Spell on your sheet',options:(data.collections.spells??[]).filter((s:any)=>!fixedSources.has(s.uuid)&&!draft.spells.some(r=>r.source===s.uuid)),select:row=>edit(d=>{d.spells.push({source:row.uuid,castingClass:plan?.listUuid&&row.system?.class?.includes(plan.listUuid)?plan.listUuid:row.system?.class?.[0]??''});})})}>Add ordinary Spell</button>
                    <ul>{draft.spells.map((s,i)=>{const row=(data.collections.spells??[]).find((r:any)=>r.uuid===s.source);return <li key={s.source}>{row?.name??'Source unavailable'} <label>Casting list<select value={s.castingClass} onChange={e=>edit(d=>{d.spells[i].castingClass=e.target.value;})}>{row?.system?.class?.map((ref:string)=><option key={ref} value={ref}>{(data.collections.classes??[]).find((r:any)=>r.uuid===ref)?.name??'Unavailable Class'}</option>)}</select></label><button type="button" onClick={()=>edit(d=>{d.spells.splice(i,1);})}>Remove Spell</button></li>;})}</ul>
                    {plan?.choices.filter(p=>p.spellGrant).map(choice)}
                </>}
                {step===4&&<><p>Enter current and maximum HP separately. Current HP may be 0; no healing occurs.</p><div className="sd-creator-grid">
                    {number('Current HP',draft.hp.value,entry=>edit(d=>{d.hp.value=entry;}))}{number('Maximum HP',draft.hp.max,entry=>edit(d=>{d.hp.max=entry;}))}</div>
                    <label><input type="checkbox" checked={calculate} onChange={e=>setCalculate(e.target.checked)}/>Optional calculation from level gains</label>
                    {calculate&&<><p>Requires known grant chronology. Equipment CON bonuses and HP effects require direct paper entry.</p>
                        {Array.from({length:draft.level},(_,i)=><label key={i}>Level {i+1} die total<input type="number" min="1" value={gains[i+1]??''} onChange={e=>setGains(p=>({...p,[i+1]:e.target.value===''?null:e.target.valueAsNumber}))}/><button type="button" onClick={()=>void roll('hp',total=>setGains(p=>({...p,[i+1]:total})),{classUuid:draft.classUuid})}>Roll level {i+1} HP</button></label>)}
                        <button type="button" onClick={()=>setConfirm({title:'Use calculated maximum HP?',message:'This replaces maximum HP using the entered level gains. Current HP remains the value on your sheet.',run:()=>{const current=epoch.current,action=++actionEpoch.current;setBusy(true);post('hp',{draft,gains:Array.from({length:draft.level},(_,i)=>gains[i+1])}).then(r=>{if(current===epoch.current)edit(d=>{d.hp.max={value:r.hp.max,basis:'base'};});}).catch(e=>{if(current===epoch.current)setError(e.message);}).finally(()=>{if(action===actionEpoch.current)setBusy(false);});}})}>Calculate maximum HP</button></>}
                </>}
                {step===5&&<><p>Add actual current possessions. No starting kit, shopping budget or money roll is required.</p><button type="button" onClick={()=>setGearOpen(true)}>Add equipment</button>
                    <div className="sd-creator-grid">{(['gp','sp','cp'] as const).map(coin=><label key={coin}>{coin.toUpperCase()}<input type="number" min="0" value={draft.coins[coin]} onChange={e=>edit(d=>{d.coins[coin]=e.target.valueAsNumber;})}/></label>)}</div>
                    {draft.gear.map((g,i)=>{const row=allItems.find((r:any)=>r.uuid===g.source);return <section key={g.id} className="sd-creator-award"><h3>{row?.name??'Source unavailable'}</h3>
                        <label>Quantity<input type="number" min="0" value={g.quantity} onChange={e=>edit(d=>{d.gear[i].quantity=e.target.valueAsNumber;})}/></label>
                        <label>Location<select value={g.stashed?'stashed':g.equipped?'equipped':'carried'} onChange={e=>edit(d=>{d.gear[i].stashed=e.target.value==='stashed';d.gear[i].equipped=e.target.value==='equipped';})}><option value="carried">Carried</option><option value="stashed">Stashed</option>{['Weapon','Armor'].includes(row?.type)&&<option value="equipped">Equipped</option>}</select></label>
                        {isScroll(row)&&<label><input type="checkbox" checked={g.spent??false} onChange={e=>edit(d=>{d.gear[i].spent=e.target.checked;})}/>Already spent</label>}
                        {isWand(row)&&<><label><input type="checkbox" checked={g.broken??false} onChange={e=>edit(d=>{d.gear[i].broken=e.target.checked;})}/>Broken wand</label>{wandSpells(row).filter(s=>s.uuid).map(s=><label key={s.uuid}><input type="checkbox" checked={g.lostSpells?.includes(s.uuid!)??false} onChange={()=>edit(d=>{const item=d.gear[i];item.lostSpells=item.lostSpells?.includes(s.uuid!)?item.lostSpells.filter(r=>r!==s.uuid):[...(item.lostSpells??[]),s.uuid!];})}/>Lost: {(data.collections.spells??[]).find((r:any)=>r.uuid===s.uuid)?.name??'Linked Spell'}</label>)}</>}
                        <button type="button" onClick={()=>edit(d=>{d.gear.splice(i,1);})}>Remove equipment</button></section>;})}
                    <p>Capacity: {plan?.preview.slotsUsed??'…'} / {plan?.preview.maxSlots??'…'} slots</p>
                </>}
                {step===6&&<><p>Review the complete prepared character and every deviation before final creation.</p>
                    <label>Paper notes (descriptive only)<textarea value={draft.notes} maxLength={10000} onChange={e=>edit(d=>{d.notes=e.target.value;})}/></label>
                    {plan&&<><div className="sd-creator-table"><table><thead><tr><th>Field</th><th>Entered</th><th>Native base</th><th>Prepared</th></tr></thead><tbody>{plan.comparisons.map(c=><tr key={c.path}><th scope="row">{c.path.includes('.hp.')?c.path.endsWith('max')?'Maximum HP':'Current HP':c.path.split('.')[2].toUpperCase()}</th><td>{c.entered} ({c.basis==='effective'?'paper':'base'})</td><td>{c.base}</td><td>{c.prepared}</td></tr>)}</tbody></table></div>
                        <p>Level {plan.source.system.level.value} · XP {plan.source.system.level.xp} · AC {plan.preview.ac}</p>
                        <h3>Owned grants and inventory</h3><ul>{plan.source.items.map((item:any,i:number)=><li key={i}>{item.name}{item.system?.quantity!==undefined?` × ${item.system.quantity}`:''}</li>)}</ul>
                        <h3>Languages</h3><p>{plan.source.system.languages.map((ref:string)=>plan.languagePlan.rows.find(r=>r.uuid===ref)?.name??(data.collections.languages??[]).find((r:any)=>r.uuid===ref)?.name??'Unavailable').join(', ')||'None'}</p>
                        {plan.warnings.map(w=><label className="sd-creator-notice" key={w.id}><input type="checkbox" checked={draft.acknowledgements.includes(w.id)} onChange={()=>edit(d=>{d.acknowledgements=d.acknowledgements.includes(w.id)?d.acknowledgements.filter(r=>r!==w.id):[...d.acknowledgements,w.id];},true)}/>{w.message}</label>)}
                    </>}
                </>}
            </fieldset>
            {plan?.errors.filter(e=>e.step===step+1||step===6).map(e=><p role="alert" key={e.id}>{e.message}</p>)}
            {(!plan||planStale)&&isConnected&&data.ready&&<p role="status">Preparing current entries…</p>}
            <footer className="sd-creator-footer"><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Back</button>
                {step<6?<button type="button" className="sd-creator-primary" onClick={()=>setStep(s=>s+1)}>Next</button>:<button type="button" className="sd-creator-primary" disabled={!plan?.ready||planStale||locked||!statusReady||!isConnected} onClick={()=>setConfirm({title:'Create this character?',message:'Create one new character with all reviewed Items. An interrupted result must be checked before another creation.',run:()=>void create()})}>Create character</button>}
                <button type="button" className="sd-creator-refresh" disabled={busy} onClick={()=>{setRefresh(n=>n+1);data.retry();}}>Refresh sources and review</button></footer>
        </div></div>
        {picker&&data.ready&&<CompendiumSelectModal isOpen sharedFrame title={picker.title} options={picker.options.map(row=>({name:label(row),uuid:row.uuid,description:String(row.system?.description??'').replace(/<[^>]*>/g,' ')}))} onClose={()=>setPicker(null)} onSelect={selected=>{const row=picker.options.find(r=>r.uuid===selected.uuid);if(row)picker.select(row);setPicker(null);}}/>}
        <GearSelectionModal isOpen={gearOpen} onClose={()=>setGearOpen(false)} onCreate={async item=>{const source=canonicalUuid(item._stats?.compendiumSource??item.flags?.core?.sourceId);if(!source){setError('Equipment needs its exact native source.');return;}edit(d=>{d.gear.push({id:id(),source,quantity:item.system?.quantity??1,equipped:false,stashed:false});});setGearOpen(false);}}/>
        {confirm&&<ConfirmationModal isOpen title={confirm.title} message={confirm.message} confirmLabel="Continue" onCancel={()=>setConfirm(null)} onConfirm={()=>{const action=confirm.run;setConfirm(null);action();}}/>}
    </main>;
}
