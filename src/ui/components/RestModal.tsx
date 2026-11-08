'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import ModuleDialog from './ModuleDialog';
import type { RestIntent, RestPlan, RestRow } from '../../logic/rest';
type Preview=Omit<RestPlan,'writes'>&{review:string;contextRevision:number};
type Operation={state:'complete'|'partial';requestId:string;intent:RestIntent;review:string;contextRevision:number;applied:string[];pending:string[];retryable:boolean;message?:string};
const button='min-h-11 border-2 border-black px-3 py-2 font-serif font-bold disabled:opacity-50';
export default function RestModal({open,onClose,actor,onRefresh}:{open:boolean;onClose:()=>void;actor:any;onRefresh:()=>Promise<void>}) {
    const {fetchWithAuth,addNotification}=useSDK();
    const [intent,setIntent]=useState<RestIntent>({consumeRation:true,confirmedSpells:[]});
    const [preview,setPreview]=useState<Preview|null>(null),[operation,setOperation]=useState<Operation|null>(null);
    const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[attempt,setAttempt]=useState(0);
    const epoch=useRef(0),dispatching=useRef(false),request=useRef<any>(null);
    const actorId=String(actor?.id??actor?._id??'');
    const revision=actor?.worldContextRevision??actor?.derived?.ruleInputs?.contextRevision;
    const alive=useRef(open);alive.current=open;
    const call=async(mode:string,body:any,signal?:AbortSignal)=>{
        const res=await fetchWithAuth(`/api/modules/shadowdark/actors/${encodeURIComponent(actorId)}/rest/${mode}`,{method:'POST',signal,
            headers:{'Content-Type':'application/json','X-SheetDelver-Context-Revision':String(revision)},body:JSON.stringify(body)});
        const data=await res.json();if(!res.ok)throw new Error(data.error?.message??data.error??'Rest request failed.');return data;
    };
    useEffect(()=>{
        const generation=++epoch.current;const abort=new AbortController();
        setPreview(null);setOperation(null);setMessage('');setReady(false);setBusy(false);dispatching.current=false;request.current=null;
        setIntent({consumeRation:true,confirmedSpells:[]});
        if(open)void call('status',{},abort.signal).then(data=>{
            if(generation!==epoch.current)return;
            if(data.state==='partial') {setOperation(data);request.current={...data.intent,requestId:data.requestId,review:data.review};}
            else if(data.state==='complete'){addNotification('Rest completed.','success');void onRefresh();onClose();}
            setReady(true);
        }).catch(e=>{if(generation===epoch.current&&!abort.signal.aborted)setMessage(e.message);});
        return()=>{++epoch.current;abort.abort();};
    },[open,actorId,revision]); // current provider retires this modal on caller/world changes
    useEffect(()=>{
        if(!open||!ready||operation||request.current)return;
        const generation=epoch.current,abort=new AbortController();setPreview(null);setMessage('');
        void call('plan',intent,abort.signal).then(data=>{
            if(generation!==epoch.current||abort.signal.aborted)return;
            if(data.operation){setOperation(data.operation);request.current={...data.operation.intent,requestId:data.operation.requestId,review:data.operation.review};return;}
            // Select the first available stack once; later selections remain explicit.
            if(intent.consumeRation&&!intent.rationId&&data.rations?.length){setIntent(prev=>({...prev,rationId:data.rations[0].id}));return;}
            setPreview(data);
        }).catch(e=>{if(generation===epoch.current&&!abort.signal.aborted)setMessage(e.message);});
        return()=>abort.abort();
    },[open,ready,operation,intent,attempt,actorId,revision]);
    const finish=async(mode:'complete'|'status')=>{
        if(dispatching.current)return;
        if(mode==='complete'&&!request.current){
            if(!preview||preview.errors.length)return;
            request.current={...intent,requestId:globalThis.crypto?.randomUUID?.()??`${Date.now()}-${Math.random().toString(36).slice(2)}`,review:preview.review};
        }
        dispatching.current=true;setBusy(true);setMessage('');const generation=epoch.current;
        try {
            const data=await call(mode,request.current??{});
            if(generation!==epoch.current||!alive.current)return;
            await onRefresh();if(generation!==epoch.current||!alive.current)return;
            if(data.state==='complete'){request.current=null;addNotification('Rest completed.','success');onClose();}
            else if(data.state==='none') {request.current=null;setOperation(null);setAttempt(n=>n+1);}
            else setOperation(data);
        }catch(e){if(generation===epoch.current&&alive.current)setMessage((e as Error).message);}
        finally{if(generation===epoch.current){dispatching.current=false;setBusy(false);}}
    };
    const change=(next:RestIntent)=>{setPreview(null);setIntent(next);};
    const rows=(entries:RestRow[],empty:string)=><ul className="divide-y divide-neutral-300">{entries.length?entries.map(row=><li key={row.id} className="py-2">
        <strong className="font-serif">{row.name}</strong><p className="text-sm">{row.detail}</p>
        {row.confirmable&&<label className="flex items-center gap-2 text-sm mt-2"><input type="checkbox" checked={intent.confirmedSpells.includes(row.id)}
            onChange={e=>change({...intent,confirmedSpells:e.target.checked?[...intent.confirmedSpells,row.id]:intent.confirmedSpells.filter(id=>id!==row.id)})}/>
            {row.detail==='Penance required'?'Required penance is complete':'This spell is eligible to recover'}</label>}
    </li>):<li className="py-2 text-neutral-500 italic">{empty}</li>}</ul>;
    return <ModuleDialog open={open} title="Rest" onClose={()=>{if(!dispatching.current)onClose();}} footer={<div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={onClose}>Close</button>
        {request.current?<><button type="button" className={button} disabled={busy} onClick={()=>void finish('status')}>Check rest</button>
            {operation?.retryable&&<button type="button" className={button} disabled={busy} onClick={()=>void finish('complete')}>Finish remaining resets</button>}</>
            :<button type="button" className={`${button} bg-black text-white`} disabled={busy||!preview||!!preview.errors.length} onClick={()=>void finish('complete')}>
                {busy?'Resting…':intent.consumeRation?'Complete rest — use 1 ration':'Complete rest'}</button>}
    </div>}>
        <p className="mb-4">Apply recovery after a successful rest.</p>
        {message&&<div role="alert" className="border-l-4 border-red-600 pl-3 mb-4"><p>{message}</p>{!request.current&&<button className={button} onClick={()=>{setReady(true);setAttempt(n=>n+1);}}>Refresh preview</button>}</div>}
        {operation?<div role="status" className="space-y-3"><p>{operation.message??'Some changes still need checking.'}</p>
            <h3 className="font-serif font-bold">Applied</h3><ul>{operation.applied.map((s,i)=><li key={i}>{s}</li>)}</ul>
            <h3 className="font-serif font-bold">Remaining</h3><ul>{operation.pending.map((s,i)=><li key={i}>{s}</li>)}</ul>
            <p>Checking again will not consume another ration.</p></div>
        :request.current?<p role="status">Checking the recorded rest before allowing another.</p>:<>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={intent.consumeRation} onChange={e=>change({...intent,consumeRation:e.target.checked})}/>Consume ration?</label>
            <p className="text-sm mb-3">Uncheck if food is provided elsewhere.</p>
            {intent.consumeRation&&preview&&<label className="block mb-3">Carried rations
                <select className="block w-full border-2 border-black p-2 mt-1" value={intent.rationId??''} onChange={e=>change({...intent,rationId:e.target.value})}>
                    <option value="">Choose a ration stack</option>{preview.rations.map(r=><option key={r.id} value={r.id}>{r.name} ({r.quantity} available)</option>)}
                </select></label>}
            {preview?.errors.map((e,i)=><p key={i} role="alert" className="border-l-4 border-red-600 pl-3 mb-3">{e}</p>)}
            {!preview&&!message?<p role="status">Loading rest preview…</p>:preview&&<>
                <h3 className="font-serif font-bold border-b-2 border-black mt-4">Will reset</h3>{rows(preview.reset,'No resources need resetting.')}
                {intent.confirmedSpells.length>0&&<button type="button" className="underline text-sm" onClick={()=>change({...intent,confirmedSpells:[]})}>Clear spell recovery confirmations</button>}
                <h3 className="font-serif font-bold border-b-2 border-black mt-4">Will not reset</h3>{rows(preview.excluded,'No exclusions.')}
            </>}
        </>}
    </ModuleDialog>;
}
