'use client';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSDK, useSDKComponents } from '@sheet-delver/sdk/react';
import { ShadowdarkUIProvider, useShadowdarkCollections } from '../context/ShadowdarkUIContext';
import { CollectionStatus } from '../components/CollectionStatus';
import CompendiumSelectModal from '../components/CompendiumSelectModal';
import GearSelectionModal from '../components/GearSelectionModal';
import CreateTreasureModal from '../components/CreateTreasureModal';
import GemBagModal from '../components/GemBagModal';
import { shadowdarkTheme } from '../themes/shadowdark';
import { allocateLanguageInventory } from '../../logic/languages';
import { spellLimit } from '../../logic/spell-model';
import { spellGrantClasses } from '../../logic/spell-grants';
import { creatorAbilityGuidance } from '../../logic/creator-ability-guidance';
import { NONREPEATABLE_CREATOR_AWARDS } from '../../logic/creator-awards';
import ModulePageHeader from '../components/ModulePageHeader';
import { StatPoolSelectionSection } from '../components/levelup/sections/StatPoolSelectionSection';
import { LEVEL_ZERO_CLASS, emptyCharacterDraft, type CharacterDraft, type CreatorChoices } from '../../logic/character-creation';
import { ABILITY_KEYS } from '../../logic/actor-preparation';
import { canonicalUuid } from '../../logic/identity';
import { isScroll } from '../../logic/scrolls';
import { isWand, wandSpells } from '../../logic/wands';
import type { CreatorPlan } from '../../logic/character-creation';

const CREATOR_NOTES_THEME={...shadowdarkTheme.richText,container:"relative group flex flex-col",editor:"prose prose-sm font-serif max-w-none focus:outline-none min-h-[8rem] p-4 text-black"};
const STEPS=['Identity','Ability scores','Talents and boons','Languages and spells','Hit points','Equipment and money','Review and create'];
const hpInputs=(d:CharacterDraft)=>JSON.stringify([d.level,d.classUuid,d.ancestryUuid,d.abilities,d.awards,d.fixedChoices,d.ancestryTalents,d.classTalents]);
const id=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');
const label=(row:any)=>`${row.name}${row.system?.source?.title||row.pack?` — ${row.system?.source?.title||row.pack}`:''}`;
type Operation={requestId:string;state:string;actorId?:string;differences?:string[];message:string};
export default function CharacterCreator(){return <ShadowdarkUIProvider><CreatorContent /></ShadowdarkUIProvider>;}
export function CreatorContent() {
    const {fetchWithAuth,navigate,worldId,moduleId,currentUser,isConnected,events}=useSDK();
    const {ConfirmationModal,RichTextEditor}=useSDKComponents();
    const data=useShadowdarkCollections(['classes','ancestries','backgrounds','deities','patrons','talents','class-abilities','spells','languages','gear','magic-items','properties']);
    const [draft,setDraft]=useState<CharacterDraft>(emptyCharacterDraft),[step,setStep]=useState(0),[plan,setPlan]=useState<CreatorPlan|null>(null);
    const [planStale,setPlanStale]=useState(true);
    const [busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
    const [operation,setOperation]=useState<Operation|null>(null),[statusReady,setStatusReady]=useState(false);
    const [requestId,setRequestId]=useState(id),[confirm,setConfirm]=useState<{title:string;message:string;run:()=>void}|null>(null);
    const [picker,setPicker]=useState<{title:string;options:any[];select:(row:any)=>void}|null>(null),[gearOpen,setGearOpen]=useState(false);
    const [treasureOpen,setTreasureOpen]=useState(false),[gemsOpen,setGemsOpen]=useState(false);
    const [gains,setGains]=useState<Record<number,number|null>>({});
    const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
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
            setDraft(previous=>{const next=structuredClone(previous);if(!keepAcknowledgements)next.acknowledgements=[];change(next);if(hpInputs(next)!==hpInputs(previous))next.hp={value:{value:null,basis:'effective'},max:{value:null,basis:'effective'}};return next;});
    };
    useLayoutEffect(()=>{
        epoch.current++;actionEpoch.current++;setPlan(null);setPicker(null);setGearOpen(false);setTreasureOpen(false);setGemsOpen(false);setConfirm(null);setBusy(false);setStatusReady(false);
        if(oldScope.current!==scope){setDraft(emptyCharacterDraft());setStep(0);setOperation(null);setRequestId(id());setGains({});setFieldErrors({});dismissedReceipt.current=null;oldScope.current=scope;}
    },[scope,isConnected,data.generation]);
    useEffect(()=>events.on('world:contextChanged',()=>{epoch.current++;actionEpoch.current++;setBusy(false);setPlan(null);setConfirm(null);setRefresh(n=>n+1);}),[events]);
    useEffect(()=>{heading.current?.focus();},[step]);
    useEffect(()=>{
        if(!isConnected)return;let active=true;setStatusReady(false);
        post('status',{}).then(result=>{if(active){if(result.operation?.requestId!==dismissedReceipt.current)setOperation(previous=>
            result.operation?.state==='complete'&&previous?.requestId!==result.operation.requestId ? null : result.operation);setStatusReady(true);}}).catch(e=>{if(active)setError(e.message);});
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
    const hpContext=hpInputs(draft);
    useEffect(()=>{
        if(step!==4||!isConnected||!data.ready||operation?.state==='complete'||operation?.state==='uncertain')return;
        const values=Array.from({length:draft.level},(_,i)=>gains[i+1]);
        if(values.some(n=>n===null||n===undefined))return;
        const current=epoch.current,controller=new AbortController();let active=true;
        const timer=setTimeout(()=>{post('hp',{draft,gains:values},controller.signal).then(result=>{
            if(active&&current===epoch.current)edit(d=>{d.hp={value:{value:result.hp.max,basis:'effective'},max:{value:result.hp.max,basis:'effective'}};});
        }).catch(e=>{if(active&&current===epoch.current&&e.name!=='AbortError')setFieldErrors(previous=>({...previous,hp:e.message}));});},250);
        return()=>{active=false;clearTimeout(timer);controller.abort();};
    },[step,gains,hpContext,scope,isConnected,data.ready,data.generation,refresh]);
    const setHPGain=(level:number,total:number|null)=>{
        setFieldErrors(previous=>({...previous,[`hp:${level}`]:'',hp:''}));
        setGains(previous=>({...previous,[level]:total}));
        edit(d=>{d.hp={value:{value:null,basis:'effective'},max:{value:null,basis:'effective'}};});
    };
    const fieldError=(field:string,message:string)=>setFieldErrors(previous=>({...previous,[field]:message}));
    const feedback=(field:string)=>{
        const messages=[fieldErrors[field],...(!planStale?plan?.errors.filter(e=>e.field===field&&!(field==='hp'&&draft.level>0&&Array.from({length:draft.level},(_,i)=>gains[i+1]).some(n=>n==null))).map(e=>e.message)??[]:[])].filter(Boolean);
        return messages.length?<div id={`creator-error-${field}`} role="alert" className="sd-creator-field-error" style={{color:'#b91c1c',font:'400 .875rem Arial,sans-serif',marginTop:'.5rem'}}>{[...new Set(messages)].map(message=><p key={message}>{message}</p>)}</div>:null;
    };
    const invalid=(field:string)=>!!fieldErrors[field]||(!planStale&&!!plan?.errors.some(e=>e.field===field));
    const numeric=(field:string,label:string,value:number|null,change:(n:number|null)=>void,min=0,max=1000000)=> <input id={field.startsWith('ability:')?`creator-score-${field.slice(8)}`:undefined} aria-label={label} aria-invalid={invalid(field)} aria-describedby={`creator-error-${field}`} type="text" inputMode="numeric" pattern="[0-9]*" value={value??''} onChange={()=>{}} onInput={e=>{
        const raw=e.currentTarget.value,n=Number(raw);
        if(raw!==''&&(!/^\d+$/.test(raw)||!Number.isSafeInteger(n)||n<min||n>max)){fieldError(field,`Enter a whole number from ${min} to ${max}.`);return;}
        fieldError(field,'');change(raw===''?null:n);
    }}/>;
    // Forward navigation uses the same fresh plan as final creation. Earlier
    // steps remain reachable for correction; tabs cannot bypass required input.
    const fieldStep=(field:string)=>field.startsWith('hp')?5:field.startsWith('ability')||field==='abilities'?2:field.startsWith('award')||field.startsWith('choice')||field.endsWith('Talents')?3:field==='languages'||field==='spells'?4:field.startsWith('coin')||field.startsWith('quantity')||field.startsWith('gear')?6:field==='notes'?7:1;
    const canVisit=(target:number)=>target<=step||(!locked&&isConnected&&data.ready&&!planStale&&!!plan&&!Object.entries(fieldErrors).some(([field,message])=>message&&fieldStep(field)<=target)&&!plan.errors.some(e=>e.step<=target));
    const choose=(collection:string,title:string,selected:(row:any)=>void)=>setPicker({title,options:(data.collections[collection]??[]).filter((row:any)=>collection!=='classes'||row.uuid!==LEVEL_ZERO_CLASS),select:selected});
    const identity=(key:'classUuid'|'ancestryUuid'|'backgroundUuid'|'deityUuid'|'patronUuid',collection:string,title:string,required=false)=><div className="sd-creator-field" key={key}>
        <span>{title}{required?' *':''}</span><button type="button" aria-invalid={invalid(key)} aria-describedby={`creator-error-${key}`}  onClick={()=>choose(collection,title,row=>{if(key==='classUuid'&&row.uuid!==draft.classUuid){setGains({});setFieldErrors({});}fieldError(key,'');edit(d=>{d[key]=row.uuid;});})}>
            {(data.collections[collection]??[]).find((r:any)=>r.uuid===draft[key])?.name||(draft[key]?'Source unavailable':'Choose…')}</button>
        {!required&&draft[key]&&<button type="button" className="sd-creator-clear" aria-label={`Clear ${title} selection`} onClick={()=>edit(d=>{d[key]='';})}>Clear selection</button>}{feedback(key)}</div>;
    const classDoc=(data.collections.classes??[]).find((r:any)=>r.uuid===draft.classUuid);
    const abilityGuidance=creatorAbilityGuidance(classDoc,data.collections['class-abilities']??[],draft.level);
    const chosenSpells=new Set([...draft.spells.map(s=>s.source),...(plan?.fixedSpells.map(s=>s.source)??[]),...Object.values(draft.fixedChoices).map(c=>c.spell),...draft.awards.flatMap(a=>Object.values(a.choices).map(c=>c.spell))].filter(Boolean));
    const nextSlot=plan?.awardAllocation.slots.find(s=>!s.awardId);
    const availableTables=(plan?.tables??[]).filter(t=>nextSlot&&(nextSlot.kind==='choice'||t.kind===nextSlot.kind));
    const awardOptions=(data.collections.talents??[]).filter((r:any)=>availableTables.some(t=>t.outcomes.some(o=>o.options.some((o:{source:string})=>o.source===r.uuid)))&&(!NONREPEATABLE_CREATOR_AWARDS.has(r.uuid)||!draft.awards.some(a=>a.source===r.uuid)));
    const availableLanguages=(data.collections.languages??[]).filter((r:any)=>plan&&!plan.languagePlan.fixed.includes(r.uuid)&&!draft.languages.includes(r.uuid)&&allocateLanguageInventory(plan.languagePlan,[...draft.languages,r.uuid]).extra.length===0);
    const availableSpells=(data.collections.spells??[]).filter((s:any)=>{
        if(!plan?.listUuid||!classDoc?.system?.spellcasting?.ability||draft.level===0||chosenSpells.has(s.uuid)||!s.system?.class?.includes(plan.listUuid))return false;
        const limit=spellLimit(classDoc.system.spellcasting.spellsknown,draft.level,s.system.tier);
        return limit.status==='known'&&draft.spells.filter(r=>(data.collections.spells??[]).find((d:any)=>d.uuid===r.source)?.system?.tier===s.system.tier).length<limit.value;
    });
    const addValuable=(kind:'treasure'|'gem',item:any)=>edit(d=>{(d.valuables??=[]).push({id:id(),kind,name:item.name,quantity:item.system.quantity??1,cost:{...item.system.cost}});});
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
            {p.spellGrant&&<><button type="button" onClick={()=>setPicker({title:`Spell for ${p.name}`,options:(data.collections.spells??[]).filter((s:any)=>!chosenSpells.has(s.uuid)&&p.level!==null&&spellGrantClasses({uuid:p.source},s,{level:p.level,classDoc,known:(data.collections.spells??[]).filter((s:any)=>draft.spells.some(r=>r.source===s.uuid)||plan?.fixedSpells.some(r=>r.source===s.uuid))}).length>0),select:row=>update(c=>{c.spell=row.uuid;c.castingClass='';})})}>
                {(data.collections.spells??[]).find((s:any)=>s.uuid===current.spell)?.name??'Choose granted Spell…'}</button>
                {!p.spellGrant.classUuid&&current.spell&&<label>Granted casting list<select aria-label={`Casting list for ${p.name}`} value={current.castingClass??''} onChange={e=>update(c=>{c.castingClass=e.target.value;})}>
                    <option value="">Choose…</option>{((data.collections.spells??[]).find((s:any)=>s.uuid===current.spell)?.system?.class??[]).map((ref:string)=><option key={ref} value={ref}>{(data.collections.classes??[]).find((r:any)=>r.uuid===ref)?.name??'Unavailable Class'}</option>)}</select></label>}
                <p>{p.spellGrant.label}; eligibility is checked at this award’s acquisition level.</p></>}
            {feedback(`choice:${p.key}`)}
        </div>;
    };
    const roll=async(kind:'score'|'hp'|'table',apply:(total:number)=>void,extra:any={})=>{
        const current=epoch.current,action=++actionEpoch.current;setBusy(true);setError('');
        try {const result=await post('roll',{kind,...extra});if(current===epoch.current)apply(result.total);}catch(e){if(current===epoch.current)fieldError(kind==='hp'?`hp:${extra.level}`:'awards',(e as Error).message);}finally{if(action===actionEpoch.current)setBusy(false);}
    };
    const rollName=async()=>{
        if(!draft.ancestryUuid)return;
        const current=epoch.current,action=++actionEpoch.current;setBusy(true);setError('');
        try {
            const response=await fetchWithAuth('/api/modules/shadowdark/actors/randomize/name',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ancestryUuid:draft.ancestryUuid})});
            const result=await response.json();
            if(!response.ok||typeof result.name!=='string'||!result.name.trim())throw new Error(result.error||'No name could be rolled for this ancestry.');
            if(current===epoch.current)edit(d=>{d.name=result.name;});
        }catch(e){if(current===epoch.current)fieldError('name',(e as Error).message);}finally{if(action===actionEpoch.current)setBusy(false);}
    };
    const diceButton=(name:string,onClick:()=>void,disabled=false)=><button type="button" className="sd-creator-dice" aria-label={name} title={name} onClick={onClick} disabled={disabled}>
        <img src="/icons/dice-d6.svg" alt="" aria-hidden="true" /></button>;
    const rollScores=(key?:typeof ABILITY_KEYS[number])=>{
        const run=async()=>{
            const current=epoch.current,action=++actionEpoch.current;setBusy(true);
            try {
                const keys=key?[key]:ABILITY_KEYS,results:(readonly [typeof ABILITY_KEYS[number],number])[]=[];
                for(const stat of keys){const result=await post('roll',{kind:'score'});if(current!==epoch.current)return;results.push([stat,result.total] as const);}
                setFieldErrors(previous=>Object.fromEntries(Object.entries(previous).filter(([field])=>!field.startsWith('abilit'))));edit(d=>{for(const [stat,total] of results)d.abilities[stat]={value:total,basis:'base'};});
            }catch(e){if(current===epoch.current)fieldError(key?`ability:${key}`:'abilities',(e as Error).message);}finally{if(action===actionEpoch.current)setBusy(false);}
        };
        void run();
    };
    const rollAllHP=async()=>{
        const current=epoch.current,action=++actionEpoch.current;setBusy(true);setError('');
        try{
            const totals:Record<number,number>={};
            for(let level=1;level<=draft.level;level++){
                const result=await post('roll',{kind:'hp',classUuid:draft.classUuid,draft,level});
                if(current!==epoch.current)return;totals[level]=result.total;
            }
            setFieldErrors(previous=>Object.fromEntries(Object.entries(previous).filter(([field])=>!field.startsWith('hp'))));setGains(totals);edit(d=>{d.hp={value:{value:null,basis:'effective'},max:{value:null,basis:'effective'}};});
        }catch(e){if(current===epoch.current)fieldError('hp',(e as Error).message);}finally{if(action===actionEpoch.current)setBusy(false);}
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
    const allItems=[...(data.collections.gear??[]),...(data.collections['magic-items']??[])];
    return <main className="sd-creator font-crimson font-inter font-sans pb-24">
        <ModulePageHeader title="Character Creator" context={`Step ${step+1} of ${STEPS.length}`} onBack={()=>setConfirm({title:'Leave Character Creator?',message:operation?.state==='uncertain'?'The creation receipt is retained for review when you return. Editable entries are kept only on this page.':'Your editable entries are kept only on this page. Leave and discard them?',run:()=>navigate('/')})} />
        <div className="sd-creator-body">
            <nav className="sd-creator-steps" aria-label="Creation steps"><ol>{STEPS.map((s,i)=><li key={s}><button type="button" aria-current={i===step?'step':undefined} disabled={!canVisit(i)} onClick={()=>{if(canVisit(i))setStep(i);}}>{i+1}. {s}</button></li>)}</ol></nav>
            <section className="sd-creator-summary" aria-label="Character summary"><strong>{draft.name||'Your character'}</strong><span>Level {draft.level}</span><span>{plan&&!planStale?`AC ${plan.preview.ac} · HP ${plan.preview.hp.value}/${plan.preview.hp.max}`:'Preparing current entries…'}</span><span>{draft.awards.length} awards · {draft.gear.length+(draft.valuables?.length??0)} inventory entries</span></section>
            <div className="sd-creator-page"><CollectionStatus state={data} label="Loading readable native character sources…" />
            {!isConnected&&<p role="alert">Disconnected. Entries are preserved; reconnect and review before continuing.</p>}
            {operation&&<section aria-label="Creation outcome" className="sd-creator-notice"><p role="status">{operation.message}</p><details><summary>Verification details</summary><p>Request: {operation.requestId}</p>{operation.differences?.length&&<><p>Saved fields that differ:</p><ul>{operation.differences.map(path=><li key={path}>{path}</li>)}</ul></>}</details>
                {operation.state!=='not-created'&&<button type="button" disabled={busy||!isConnected} onClick={()=>void checkCreation()}>Check creation</button>}
                {operation.state==='uncertain'&&operation.actorId&&<button type="button" onClick={()=>navigate(`/actors/${operation.actorId}`)}>Review created character</button>}
                {operation.state==='complete'&&operation.actorId&&<button type="button" onClick={()=>navigate(`/actors/${operation.actorId}`)}>Open character</button>}
                {operation.state==='complete'&&<button type="button" onClick={()=>{dismissedReceipt.current=operation.requestId;setOperation(null);setRequestId(id());setGains({});edit(d=>Object.assign(d,emptyCharacterDraft()));setStep(0);}}>Start another character</button>}
                {operation.state==='not-created'&&<button type="button" onClick={()=>{setOperation(null);setRequestId(id());}}>Continue editing</button>}
            </section>}
            <h2 ref={heading} tabIndex={-1}>{step+1}. {STEPS[step]}</h2>
            <fieldset disabled={locked||!data.ready||!isConnected} className={`sd-creator-fields${step===0?' sd-creator-identity':''}`}>
                {step===0&&<><div className="sd-creator-field sd-creator-name"><div className="sd-creator-field-heading"><label htmlFor="creator-name">Name *</label>{diceButton('Randomize Name',()=>void rollName(),!draft.ancestryUuid)}</div><input id="creator-name" aria-label="Name" aria-invalid={invalid('name')} aria-describedby="creator-error-name" maxLength={200} required placeholder="Character Name" value={draft.name} onChange={e=>edit(d=>{d.name=e.target.value;})}/>{feedback('name')}</div>
                    <label>Level<select aria-label="Level" value={draft.level} onChange={e=>{const level=Number(e.target.value);setFieldErrors(previous=>Object.fromEntries(Object.entries(previous).filter(([field])=>!field.startsWith('hp'))));setGains(previous=>Object.fromEntries(Object.entries(previous).filter(([at])=>Number(at)<=level)));edit(d=>{d.level=level;});}}>{Array.from({length:21},(_,n)=><option key={n}>{n}</option>)}</select></label>
                    <label>Current XP{numeric('xp','Current XP',draft.xp,n=>edit(d=>{d.xp=n??0;}))}{feedback('xp')}</label>
                    {draft.level>0?identity('classUuid','classes','Class',true):<p>Level 0 uses the native Level 0 Class, without first-level adventuring grants.</p>}
                    {identity('ancestryUuid','ancestries','Ancestry',true)}{identity('backgroundUuid','backgrounds','Background',true)}
                    <label>Alignment *<select aria-label="Alignment" aria-invalid={invalid('alignment')} aria-describedby="creator-error-alignment" required value={draft.alignment} onChange={e=>edit(d=>{d.alignment=e.target.value as CharacterDraft['alignment'];})}><option value="">Choose…</option>{['lawful','neutral','chaotic'].map(a=><option key={a}>{a}</option>)}</select>{feedback('alignment')}</label>
                    {identity('deityUuid','deities','Deity')}{feedback('identity')}{draft.level===0&&<p>Level 0 characters choose a background and alignment. A deity is optional.</p>}{(plan?.requiresPatron||draft.patronUuid)&&identity('patronUuid','patrons','Patron',!!plan?.requiresPatron)}
                </>}
                {step===1&&<><p>Enter the scores from your character sheet, or roll them. Rolled scores receive the bonuses from your selected talents.</p>
                    <section aria-label="Ability guidance" className="sd-creator-ability-guidance">
                        <h3>{draft.level>0&&classDoc?`Key abilities for ${classDoc.name}`:'Ability guidance'}</h3>
                        {abilityGuidance.length>0&&<ul>{abilityGuidance.map(entry=><li key={entry.ability}><strong>{entry.label} ({entry.ability.toUpperCase()})</strong> — {entry.uses.join('; ')}.</li>)}</ul>}
                        <p><strong>Constitution (CON)</strong> — {draft.level===0?'Starting HP':'First-level HP'} and resisting injury. Strength helps melee attacks; Dexterity helps ranged attacks and armor class where armor permits.</p>
                        <p>New characters roll 3d6 for each score in order. If none is 14 or higher, you may reroll all six.</p>
                    </section>
                    <button type="button" className="sd-creator-roll" onClick={()=>rollScores()}>Roll all scores</button><div className="sd-creator-grid sd-creator-scores">{ABILITY_KEYS.map(k=><div className="sd-creator-score" key={k}>
                        <div className="sd-creator-score-heading"><label htmlFor={`creator-score-${k}`}>{k.toUpperCase()}</label>{diceButton(`Roll ${k.toUpperCase()}`,()=>rollScores(k))}</div>
                        {numeric(`ability:${k}`,k.toUpperCase(),draft.abilities[k].value,n=>edit(d=>{d.abilities[k]={value:n,basis:'effective'};}),1)}
                        {feedback(`ability:${k}`)}
                        <span>Modifier {planStale?'…':plan?.preview.abilities[k]?.mod??'—'}</span></div>)}</div>{feedback('abilities')}</>}
                {step===2&&<><p>Choose the talents and boons earned at each level. Fixed Class and ancestry grants are included automatically.</p>
                    <p>Awards: {plan?.awardAllocation.slots.filter(s=>s.awardId).length??0} / {plan?.expectedAwards??'…'} selected.</p>
                    {plan&&plan.ancestryChoiceCount>0&&<fieldset><legend>Choose {plan.ancestryChoiceCount} ancestry talents</legend>{plan.ancestryOptions.map(o=><label key={o.uuid}><input type="checkbox" disabled={!draft.ancestryTalents.includes(o.uuid)&&draft.ancestryTalents.length>=plan.ancestryChoiceCount} checked={draft.ancestryTalents.includes(o.uuid)} onChange={()=>edit(d=>{d.ancestryTalents=d.ancestryTalents.includes(o.uuid)?d.ancestryTalents.filter(r=>r!==o.uuid):[...d.ancestryTalents,o.uuid];})}/>{o.name}</label>)}</fieldset>}{feedback('ancestryTalents')}
                    {!!plan?.classChoiceCount&&<fieldset><legend>Choose {plan.classChoiceCount} Class talents</legend>{plan.classOptions.map(o=><label key={o.uuid}><input type="checkbox" disabled={!draft.classTalents.includes(o.uuid)&&draft.classTalents.length>=plan.classChoiceCount} checked={draft.classTalents.includes(o.uuid)} onChange={()=>edit(d=>{d.classTalents=d.classTalents.includes(o.uuid)?d.classTalents.filter(r=>r!==o.uuid):[...d.classTalents,o.uuid];})}/>{o.name}</label>)}</fieldset>}{feedback('classTalents')}
                    {plan?.requirements.filter(r=>r.requiredTalents+r.requiredBoons+r.choiceRolls>0).map(r=><p key={r.level}>Level {r.level}: {r.requiredTalents} talents, {r.requiredBoons} boons{r.choiceRolls?`, ${r.choiceRolls} talent or boon choice`:''}</p>)}
                    <button type="button" disabled={!nextSlot||!awardOptions.length||planStale} onClick={()=>nextSlot&&setPicker({title:'Recorded Talent or Boon',options:awardOptions,select:row=>edit(d=>{d.awards.push({id:id(),origin:'recorded',level:nextSlot.level,source:row.uuid,choices:{}});})})}>{nextSlot?`Choose level ${nextSlot.level} ${nextSlot.kind==='choice'?'talent or boon':nextSlot.kind}`:'All level awards selected'}</button>{feedback('awards')}
                    <details><summary>Choose or roll a native table result</summary><label>Award table<select value={tableUuid} onChange={e=>{setTableUuid(e.target.value);setTableTotal(null);}}><option value="">Choose…</option>{availableTables.map(t=><option key={t.uuid} value={t.uuid}>{t.name}</option>)}</select></label>
                        <label>Native result group<select value={tableTotal??''} onChange={e=>setTableTotal(e.target.value===''?null:Number(e.target.value))}><option value="">Choose…</option>{plan?.tables.find(t=>t.uuid===tableUuid)?.outcomes.map((o:any)=><option key={o.total} value={o.total}>{o.total}: {o.options.map((r:any)=>r.label).join(' / ')||o.text}</option>)}</select></label>
                        <button type="button" disabled={!availableTables.some(t=>t.uuid===tableUuid)||planStale} onClick={()=>void roll('table',setTableTotal,{tableUuid})}>Roll table</button>
                        <button type="button" disabled={!nextSlot||!availableTables.some(t=>t.uuid===tableUuid)||tableTotal===null||planStale} onClick={()=>edit(d=>{const outcome=plan?.tables.find(t=>t.uuid===tableUuid)?.outcomes.find((o:any)=>o.range[0]<=tableTotal!&&o.range[1]>=tableTotal!);d.awards.push({id:id(),origin:'table',table:tableUuid,total:tableTotal!,results:outcome?.mode==='bundle'?outcome.options.map((o:any)=>o.id):[],level:nextSlot!.level,choices:{}});})}>Add table award</button></details>
                    {draft.awards.map(a=>{const view=plan?.awards.find(r=>r.id===a.id),outcome=plan?.tables.find(t=>t.uuid===a.table)?.outcomes.find((o:any)=>o.range[0]<=a.total!&&o.range[1]>=a.total!);return <section className="sd-creator-award" key={a.id}><h3>{view?.name||'Recorded award'}</h3>
                        <label>Gained at level{numeric(`award:${a.id}`,'Gained at level',a.level,n=>edit(d=>{d.awards.find(r=>r.id===a.id)!.level=n;}),1,draft.level)}{feedback(`award:${a.id}`)}</label>
                        {a.origin==='table'&&outcome?.mode==='choose'&&<fieldset><legend>Choose {outcome.count} result</legend>{outcome.options.map((o:any)=><label key={o.id}><input type="checkbox" checked={a.results?.includes(o.id)??false} onChange={()=>edit(d=>{const target=d.awards.find(r=>r.id===a.id)!;target.results=target.results!.includes(o.id)?target.results!.filter(r=>r!==o.id):[...target.results!,o.id];})}/>{o.label}</label>)}</fieldset>}
                        <button type="button" onClick={()=>{fieldError(`award:${a.id}`,'');edit(d=>{d.awards=d.awards.filter(r=>r.id!==a.id);});}}>Remove award</button></section>;})}
                    {plan?.choices.map(choice)}
                </>}
                {step===3&&<><h3>Languages</h3><p>Fixed languages: {plan?.languagePlan.fixed.map(ref=>plan.languagePlan.rows.find(r=>r.uuid===ref)?.name??'Unavailable').join(', ')||'None'}</p>
                    {plan?.languagePlan.groups.filter(g=>g.count>0).map(g=><p key={g.id}>{g.label}: {g.count} choices</p>)}
                    <button type="button" disabled={!availableLanguages.length||planStale} onClick={()=>setPicker({title:'Language on your sheet',options:availableLanguages,select:row=>edit(d=>{if(!d.languages.includes(row.uuid))d.languages.push(row.uuid);})})}>Add Language</button>{feedback('languages')}
                    <ul>{draft.languages.map(ref=><li key={ref}>{(data.collections.languages??[]).find((r:any)=>r.uuid===ref)?.name??'Source unavailable'} <button type="button" onClick={()=>edit(d=>{d.languages=d.languages.filter(r=>r!==ref);})}>Remove language</button></li>)}</ul>
                    <h3>Spells</h3><p>Fixed Spells: {plan?.fixedSpells.map(s=>s.name).join(', ')||'None'}. Fixed Spells are included automatically.</p>
                    {classDoc?.system?.spellcasting?.ability&&draft.level>0&&[1,2,3,4,5].map(tier=>{const limit=spellLimit(classDoc.system.spellcasting.spellsknown,draft.level,tier);return <p key={tier}>Tier {tier}: {draft.spells.filter(s=>(data.collections.spells??[]).find((r:any)=>r.uuid===s.source)?.system?.tier===tier).length} / {limit.status==='known'?limit.value:'Progression unavailable'}</p>;})}
                    <button type="button" disabled={!availableSpells.length||planStale} onClick={()=>setPicker({title:'Ordinary Spell on your sheet',options:availableSpells,select:row=>edit(d=>{d.spells.push({source:row.uuid,castingClass:plan!.listUuid!});})})}>Add ordinary Spell</button>{feedback('spells')}
                    <ul>{draft.spells.map((s,i)=>{const row=(data.collections.spells??[]).find((r:any)=>r.uuid===s.source);return <li key={s.source}>{row?.name??'Source unavailable'} <label>Casting list<select disabled value={s.castingClass} onChange={e=>edit(d=>{d.spells[i].castingClass=e.target.value;})}>{row?.system?.class?.map((ref:string)=><option key={ref} value={ref}>{(data.collections.classes??[]).find((r:any)=>r.uuid===ref)?.name??'Unavailable Class'}</option>)}</select></label><button type="button" onClick={()=>edit(d=>{d.spells.splice(i,1);})}>Remove Spell</button></li>;})}</ul>
                    {plan?.choices.filter(p=>p.spellGrant).map(choice)}
                </>}
                {step===4&&<><p>{draft.level===0?'Level 0 HP uses your Constitution modifier (minimum 1), plus applicable talents.':'Enter or roll the hit die for each level. First-level Constitution and applicable talents are included in the total.'}</p>
                    {draft.level>0&&<button type="button" className="sd-creator-roll" onClick={()=>void rollAllHP()}>Roll all HP</button>}
                    <div className="sd-creator-hp-levels" style={{display:'grid',gridTemplateColumns:'minmax(0, 1fr)',gap:'1rem'}}>{Array.from({length:draft.level},(_,i)=>{const level=i+1;return <div className="sd-creator-score" key={level}>
                        <h3>Level {level}</h3><div className="sd-creator-hp-row" style={{display:'flex',alignItems:'center',gap:'.75rem'}}><div style={{flex:'1 1 0%',minWidth:0}}>{numeric(`hp:${level}`,`Level ${level} HP roll`,gains[level]??null,n=>setHPGain(level,n),1,Number(plan?.hitDie?.slice(1))||0)}</div>
                        {diceButton(`Roll level ${level} HP`,()=>void roll('hp',total=>setHPGain(level,total),{classUuid:draft.classUuid,draft,level}))}</div>{feedback(`hp:${level}`)}{gains[level]==null&&!fieldErrors[`hp:${level}`]&&<p style={{color:'#b91c1c',fontSize:'.875rem'}}>Enter or roll 1–{Number(plan?.hitDie?.slice(1))||'…'} HP for this level.</p>}</div>;})}</div>
                    {feedback('hp')}<p role="status">Total HP: {draft.hp.max.value===null||planStale?'—':plan?.preview.hp.max??'—'}</p><p>Your character starts at full HP.</p>
                </>}
                {step===5&&<><p>Add actual current possessions. No starting kit, shopping budget or money roll is required.</p><button type="button" onClick={()=>setGearOpen(true)}>Add equipment</button>
                    <div className="sd-creator-grid">{(['gp','sp','cp'] as const).map(coin=><label key={coin}>{coin.toUpperCase()}{numeric(`coin:${coin}`,coin.toUpperCase(),draft.coins[coin],n=>edit(d=>{d.coins[coin]=n??0;}))}{feedback(`coin:${coin}`)}</label>)}</div>
                    {draft.gear.map((g,i)=>{const row=allItems.find((r:any)=>r.uuid===g.source);return <section key={g.id} className="sd-creator-award"><h3>{row?.name??'Source unavailable'}</h3>
                        <label>Quantity{numeric(`quantity:${g.id}`,'Quantity',g.quantity,n=>edit(d=>{d.gear[i].quantity=n??0;}))}{feedback(`quantity:${g.id}`)}</label>
                        <label>Location<select value={g.stashed?'stashed':g.equipped?'equipped':'carried'} onChange={e=>edit(d=>{d.gear[i].stashed=e.target.value==='stashed';d.gear[i].equipped=e.target.value==='equipped';})}><option value="carried">Carried</option><option value="stashed">Stashed</option>{['Weapon','Armor'].includes(row?.type)&&<option value="equipped">Equipped</option>}</select></label>
                        {isScroll(row)&&<label><input type="checkbox" checked={g.spent??false} onChange={e=>edit(d=>{d.gear[i].spent=e.target.checked;})}/>Already spent</label>}
                        {isWand(row)&&<><label><input type="checkbox" checked={g.broken??false} onChange={e=>edit(d=>{d.gear[i].broken=e.target.checked;})}/>Broken wand</label>{wandSpells(row).filter(s=>s.uuid).map(s=><label key={s.uuid}><input type="checkbox" checked={g.lostSpells?.includes(s.uuid!)??false} onChange={()=>edit(d=>{const item=d.gear[i];item.lostSpells=item.lostSpells?.includes(s.uuid!)?item.lostSpells.filter(r=>r!==s.uuid):[...(item.lostSpells??[]),s.uuid!];})}/>Lost: {(data.collections.spells??[]).find((r:any)=>r.uuid===s.uuid)?.name??'Linked Spell'}</label>)}</>}
                        <button type="button" onClick={()=>{fieldError(`quantity:${g.id}`,'');fieldError(`gear:${g.id}`,'');edit(d=>{d.gear.splice(i,1);});}}>Remove equipment</button>{feedback(`gear:${g.id}`)}</section>;})}
                    {feedback('gear')}<h3>Treasure</h3><button type="button" onClick={()=>setTreasureOpen(true)}>Add treasure</button>
                    {(draft.valuables??[]).filter(v=>v.kind==='treasure').map(v=><p key={v.id}>{v.name} × {v.quantity} — {v.cost.gp} GP, {v.cost.sp} SP, {v.cost.cp} CP <button type="button" onClick={()=>edit(d=>{d.valuables=d.valuables?.filter(r=>r.id!==v.id);})}>Remove treasure</button></p>)}
                    <h3>Gems</h3><p>{(draft.valuables??[]).filter(v=>v.kind==='gem').length} gems</p><button type="button" onClick={()=>setGemsOpen(true)}>Gem Bag</button>
                    <p>Capacity: {plan?.preview.slotsUsed??'…'} / {plan?.preview.maxSlots??'…'} slots</p>
                </>}
                {step===6&&<><p>Check each section in order. All required choices must be complete before creating your character.</p>

                    {plan&&<><h3>1. Identity</h3><p>{draft.name} · Level {draft.level} · {classDoc?.name??'Level 0'} · {(data.collections.ancestries??[]).find((r:any)=>r.uuid===draft.ancestryUuid)?.name}</p>
                        <p>XP {draft.xp} · Alignment {draft.alignment||'None'}</p>{(['background','deity','patron'] as const).map(key=>{const ref=draft[`${key}Uuid`];const collection=key==='deity'?'deities':`${key}s`;return ref?<p key={key}>{key[0].toUpperCase()+key.slice(1)}: {(data.collections[collection]??[]).find((r:any)=>r.uuid===ref)?.name??'Unavailable'}</p>:null;})}
                        <h3>2. Ability scores</h3><div className="sd-creator-table"><table><thead><tr><th>Ability</th><th>Score</th><th>Modifier</th></tr></thead><tbody>{ABILITY_KEYS.map(k=><tr key={k}><th scope="row">{k.toUpperCase()}</th><td>{plan.preview.abilities[k].value}</td><td>{plan.preview.abilities[k].mod}</td></tr>)}</tbody></table></div>
                        <h3>3. Talents and boons</h3><ul>{plan.source.items.filter((item:any)=>['Talent','Boon','Class Ability'].includes(item.type)).map((item:any,i:number)=><li key={i}>{item.name}</li>)}</ul>
                        <h3>4. Languages and spells</h3><p>{plan.source.system.languages.map((ref:string)=>plan.languagePlan.rows.find(r=>r.uuid===ref)?.name??'Unavailable').join(', ')||'No languages'}</p><ul>{plan.source.items.filter((item:any)=>item.type==='Spell').map((item:any,i:number)=><li key={i}>{item.name}</li>)}</ul>
                        <h3>5. Hit points</h3><p>HP {plan.preview.hp.value} / {plan.preview.hp.max} · AC {plan.preview.ac}</p>
                        <h3>6. Equipment and money</h3><ul>{plan.source.items.filter((item:any)=>['Weapon','Armor','Basic','Potion','Scroll','Wand','Gem'].includes(item.type)).map((item:any,i:number)=><li key={i}>{item.name}{item.system?.quantity!==undefined?` × ${item.system.quantity}`:''}</li>)}</ul><p>{draft.coins.gp} GP · {draft.coins.sp} SP · {draft.coins.cp} CP</p>
                        <h3>Character notes</h3><RichTextEditor content={draft.notes} onSave={(html:string)=>{if(html.length>10000){fieldError('notes','Notes must be at most 10,000 characters.');return;}fieldError('notes','');edit(d=>{d.notes=html;});}} theme={CREATOR_NOTES_THEME} editButtonText="Edit Notes" />{feedback('notes')}
                        <h3>Requirements</h3>{plan.errors.length===0?<p>Required choices are complete.</p>:plan.errors.map(e=><p key={e.id}><button type="button" onClick={()=>setStep(e.step-1)}>Step {e.step}</button> {e.message}</p>)}
                        {plan.warnings.map(w=><label className="sd-creator-notice" key={w.id}><input type="checkbox" checked={draft.acknowledgements.includes(w.id)} onChange={()=>edit(d=>{d.acknowledgements=d.acknowledgements.includes(w.id)?d.acknowledgements.filter(r=>r!==w.id):[...d.acknowledgements,w.id];},true)}/>{w.message}</label>)}
                    </>}
                </>}
            </fieldset>
            {(!plan||planStale)&&isConnected&&data.ready&&<p role="status">Preparing current entries…</p>}
            <footer className="sd-creator-footer"><button type="button" disabled={step===0} onClick={()=>setStep(s=>s-1)}>Back</button>
                {step<6?<button type="button" className="sd-creator-primary" disabled={!canVisit(step+1)} onClick={()=>{if(canVisit(step+1))setStep(s=>s+1);}}>Next</button>:<button type="button" className="sd-creator-primary" disabled={Object.values(fieldErrors).some(Boolean)||!plan?.ready||planStale||locked||!statusReady||!isConnected} onClick={()=>setConfirm({title:'Create this character?',message:`Create ${draft.name.trim()} as a level ${draft.level} character?`,run:()=>void create()})}>Create character</button>}
                <button type="button" className="sd-creator-refresh" disabled={busy} onClick={()=>{setRefresh(n=>n+1);data.retry();}}>Refresh sources and review</button>{error&&<p role="alert">{error}</p>}</footer>
        </div></div>
        <CreateTreasureModal isOpen={treasureOpen} onClose={()=>setTreasureOpen(false)} onCreate={item=>addValuable('treasure',item)} />
        <GemBagModal isOpen={gemsOpen} onClose={()=>setGemsOpen(false)} actor={{items:(draft.valuables??[]).filter(v=>v.kind==='gem').map(v=>({id:v.id,name:v.name,type:'Gem',system:{cost:v.cost,quantity:v.quantity}}))}} onCreateItem={async item=>addValuable('gem',item)} onUpdateItem={async(itemId,patch)=>edit(d=>{const gem=d.valuables?.find(v=>v.id===itemId);if(gem){if(typeof patch.name==='string')gem.name=patch.name;if(typeof patch['system.cost.gp']==='number')gem.cost.gp=patch['system.cost.gp'];}})} onDeleteItem={itemId=>edit(d=>{d.valuables=d.valuables?.filter(v=>v.id!==itemId);})} />
        {picker&&data.ready&&<CompendiumSelectModal isOpen sharedFrame title={picker.title} options={picker.options.map(row=>({name:label(row),uuid:row.uuid,description:String(row.system?.description??'').replace(/<[^>]*>/g,' ')}))} onClose={()=>setPicker(null)} onSelect={selected=>{const row=picker.options.find(r=>r.uuid===selected.uuid);if(row)picker.select(row);setPicker(null);}}/>}
        <GearSelectionModal isOpen={gearOpen} onClose={()=>setGearOpen(false)} onCreate={async item=>{const source=canonicalUuid(item._stats?.compendiumSource??item.flags?.core?.sourceId);if(!source){setError('Equipment needs its exact native source.');return;}edit(d=>{d.gear.push({id:id(),source,quantity:item.system?.quantity??1,equipped:false,stashed:false});});setGearOpen(false);}}/>
        {confirm&&<ConfirmationModal isOpen title={confirm.title} message={confirm.message} confirmLabel="Continue" onCancel={()=>setConfirm(null)} onConfirm={()=>{const action=confirm.run;setConfirm(null);action();}}/>}
    </main>;
}
