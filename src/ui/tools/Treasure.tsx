'use client';
import React, { useEffect, useRef, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { useSDK, useSDKComponents } from '@sheet-delver/sdk/react';
import MundaneParts, { OriginalDice, OriginalSourceNote } from './MundaneParts';
import { MUNDANE_TABLE_VERSION } from '../../data/mundane-tables';
import { emptyMundaneRecipe, mundaneName, mundaneValueTable, mundaneTable, mundaneFollowUp, originalRow, treasureValue, type MundanePath, type MundaneRecipe, type MundanePartKey, type MundanePart } from '../../logic/mundane';
import { newRequestId } from '../utils/request-id';
import { useToolCatalog } from '../context/useSystemIndexStore';
import { TOOL_TREASURE } from '../context/system-index-session';
import ModulePageHeader from '../components/ModulePageHeader';
import CompendiumSelectModal from '../components/CompendiumSelectModal';
import { CardBody } from '../components/ResourceCardBody';
import { buildDocumentCard } from '../../logic/resource-cards';
import { shadowdarkTheme } from '../themes/shadowdark';
import { presentReferenceDescription } from '../../logic/description';
import { emptyTreasureDraft, emptyWeaponRecipe, TREASURE_CATEGORIES, treasureErrors, treasurePayload, treasureUnchanged, treasureTemplateAllowed, treasureFromTemplate, treasureResultValue, type TreasureDraft, type TreasureCategory, type WeaponRecipe } from '../../logic/treasure';

const base = '/api/modules/shadowdark/treasure';
const notesTheme = { ...shadowdarkTheme.richText, container: 'relative group flex flex-col', editor: 'prose prose-sm font-serif max-w-none focus:outline-none min-h-[8rem] p-4 text-black' };
const defaultTable = 'Compendium.shadowdark.rollable-tables.RollTable.Pi9nnnLeXpTKCSMY';
type Catalog = { tables: any[]; items: any[]; spells: any[]; actors: { id: string; name: string }[] };
type Operation = { unchangedSource?: boolean; requestId: string; actorId: string; itemId?: string; worldItemId?: string; mode?: string; category?: string; folderName?: string; name: string; state: string };
const freshDraft = (category: TreasureCategory): TreasureDraft => ({...emptyTreasureDraft(),category,...(category==='mundane'?{mundane:emptyMundaneRecipe()}:category==='weapons'?{kind:'template',weapon:emptyWeaponRecipe()}:category==='armor'||category==='potions'||category==='magic'?{kind:'template'}:category==='scrolls'?{kind:'Scroll'}:{})});

/** Category tabs share controls and completion services, not a compulsory stepper. */
export default function Treasure() {
    const sdk=useSDK();
    return <TreasureTabs key={JSON.stringify([sdk.worldId,sdk.currentUser?.id,sdk.currentUser?.role,sdk.isConnected])} />;
}
function TreasureTabs() {
    const {navigate}=useSDK();
    const [category,setCategory]=useState<TreasureCategory>('random');
    const drafts=useRef<Partial<Record<TreasureCategory,TreasureDraft>>>({});
    const [locked,setLocked]=useState(false);
    return <main className="sd-creator sd-treasure pb-24">
        <ModulePageHeader title="Treasure & Items" context="GM tools" onBack={()=>navigate('/')} icon={<PackagePlus/>}/>
        <div className="sd-creator-body">
            <nav className="sd-creator-steps sd-treasure-tabs" aria-label="Treasure categories"><ol>
                {TREASURE_CATEGORIES.map(([id,label])=><li key={id}><button disabled={locked} aria-current={category===id?'page':undefined}
                    onClick={()=>setCategory(id)}>{label}</button></li>)}
            </ol></nav>
            {['boons','personality'].includes(category)?<div className="sd-creator-page"><h2>{TREASURE_CATEGORIES.find(([id])=>id===category)?.[1]}</h2>
                <p>This category’s dedicated workflow is being prepared. Weapon personalities can already be entered in the Weapons tab.</p></div>:
                <TreasureWorkflow key={category} category={category} initialDraft={drafts.current[category]}
                    remember={d=>{drafts.current[category]=d;}} lock={setLocked} recoverCategory={setCategory}/>}
        </div>
    </main>;
}
function TreasureWorkflow({category,initialDraft,remember,lock,recoverCategory}:{category:TreasureCategory;initialDraft?:TreasureDraft;remember:(d:TreasureDraft)=>void;lock:(value:boolean)=>void;recoverCategory:(category:TreasureCategory)=>void}) {
    const { fetchWithAuth, navigate, worldId, currentUser, isConnected } = useSDK();
    const { RichTextEditor } = useSDKComponents();
    const scope = JSON.stringify([worldId,currentUser?.id,currentUser?.role,isConnected]);
    const resource = useToolCatalog(TOOL_TREASURE);
    const catalog: Catalog | null = resource.data?.[0] ?? null;
    const [draft,setDraft] = useState(()=>initialDraft??freshDraft(category));
    const [detailsVersion,setDetailsVersion] = useState(0);
    const [actorId,setActorId] = useState('');
    const [table,setTable] = useState('');
    const [draw,setDraw] = useState<any>(null);
    const [plan,setPlan] = useState<any>(null);
    const [operation,setOperation] = useState<Operation | null>(null);
    const [requestId,setRequestId] = useState('');
    const [completion,setCompletion] = useState<Operation|null>(null);
    const startRef=useRef<HTMLHeadingElement>(null);
    const [disclosed,setDisclosed] = useState(false);
    const [busy,setBusy] = useState(false);
    const [error,setError] = useState<{ section: string; text: string } | null>(null);
    const [errors,setErrors] = useState<Record<string,string>>({});
    const [picker,setPicker] = useState<'table'|'item'|'spell'|null>(null);
    const [tier,setTier] = useState('');
    const epoch = useRef(0), pending = useRef(false), scopeRef = useRef(scope);
    scopeRef.current = scope;
    const draftScope = useRef(scope);
    const reviewRef = useRef<HTMLElement>(null), outcomeRef = useRef<HTMLElement>(null);
    useEffect(() => { if (operation || requestId) outcomeRef.current?.scrollIntoView({block:'start',behavior:'smooth'}); },[operation,requestId]);
    const ready = catalog !== null && resource.ready && isConnected;
    const uncertain = !!requestId || (!!operation && operation.state !== 'complete');
    useEffect(()=>{remember(draft);},[draft]);
    useEffect(()=>{lock(busy||uncertain);},[busy,uncertain]);
    function acceptOperation(op: Operation) {
        if(op.state!=='complete'){setOperation(op);return;}
        setCompletion(op);setOperation(null);setRequestId('');setDraft(freshDraft(category));setPlan(null);setDraw(null);setActorId('');setDisclosed(false);setErrors({});setDetailsVersion(n=>n+1);
        requestAnimationFrame(()=>{startRef.current?.focus();startRef.current?.scrollIntoView({block:'start',behavior:'smooth'});});
    }
    async function api(path: string, body?: unknown) {
        const res = await fetchWithAuth(base + path, body === undefined ? {} : { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(typeof data.error === 'string' ? data.error : 'The request could not be completed.');
        return data;
    }
    useEffect(() => {
        const generation = ++epoch.current; let cancelled = false;
        setPlan(null); setPicker(null); setError(null);
        if (draftScope.current !== scope) {
            draftScope.current = scope; setDraft(freshDraft(category)); setDraw(null); setActorId(''); setOperation(null); setRequestId('');
        }
        if (!ready || !catalog) return;
        setTable(catalog.tables.some(t => t.uuid === defaultTable) ? defaultTable : '');
        // Receipts are deliberately fresh; only source catalogs survive navigation.
        api('/status').then(status => {
            if (cancelled || epoch.current !== generation) return;
            if (status.operation?.state === 'complete' && status.operation.requestId === requestId) acceptOperation(status.operation);
            else if (status.operation && status.operation.state !== 'complete') {
                if(status.operation.category && status.operation.category!==category && TREASURE_CATEGORIES.some(([id])=>id===status.operation.category)) {recoverCategory(status.operation.category);return;}
                setOperation(status.operation);setRequestId(status.operation.requestId);
            }
        }).catch(e => { if (!cancelled && epoch.current === generation) setError({ section:'sources',text:e.message }); });
        return () => { cancelled = true; epoch.current++; };
    },[scope,catalog,ready,fetchWithAuth]);
    const change = (patch: Partial<TreasureDraft>) => { setDraft(d => ({...d,...patch})); setPlan(null); setDisclosed(false); setErrors({}); };
    const editMundane = (mundane: MundaneRecipe, patch: Partial<TreasureDraft> = {}) => {
        const generated=mundaneName(draft.mundane??emptyMundaneRecipe());
        change({mundane,...(!draft.name||draft.name===generated?{name:mundaneName(mundane)}:{}),...patch});
    };
    async function originalDraw(table: string): Promise<MundanePart> {
        const result=await api('/original-draw',{table,version:MUNDANE_TABLE_VERSION});
        return result.part;
    }
    const rollMundane = (key: MundanePartKey|'value') => run(`mundane.${key}`,async()=>{
        const m=draft.mundane!, generation=epoch.current;
        const table=key==='value'?mundaneValueTable(m):mundaneTable(m,key);
        if(!table)return;
        const part=await originalDraw(table);
        if(generation!==epoch.current||scopeRef.current!==scope)return;
        if(key==='value')editMundane({...m,valueSource:part.source},{gp:String(originalRow(part.source)!.gp),sp:'0',cp:'0'});
        else editMundane({...m,[key]:part,...(key==='detail'?{detailFor:m.form.text}:{})});
    });
    const rollMundaneObject = () => run('mundane.object',async()=>{
        let m={...draft.mundane!}; const generation=epoch.current;
        // Build atomically: an interrupted or failed roll sequence leaves the draft intact.
        for(const key of ['form','material'] as const) {
            m={...m,[key]:await originalDraw(mundaneTable(m,key)!)};
            if(generation!==epoch.current||scopeRef.current!==scope)return;
        }
        const followUp=mundaneFollowUp(m);
        m={...m,detail:followUp?await originalDraw(followUp):{text:''},detailFor:m.form.text};
        if(generation!==epoch.current||scopeRef.current!==scope)return;
        const value=await originalDraw(mundaneValueTable(m));
        if(generation!==epoch.current||scopeRef.current!==scope)return;
        editMundane({...m,valueSource:value.source},{gp:String(originalRow(value.source)!.gp),sp:'0',cp:'0'});
    });
    const localError = (key: string) => errors[key] ? <p role="alert">{errors[key]}</p> : null;
    const requestError = (section: string) => error?.section === section ? <p role="alert">{error.text}</p> : null;
    async function run(section: string, work: () => Promise<void>) {
        if (pending.current || !ready) return;
        pending.current = true; setBusy(true); setError(null);
        try { await work(); } catch (e) { if (scopeRef.current === scope) setError({section,text:e instanceof Error ? e.message : 'Request failed.'}); }
        finally { pending.current = false; setBusy(false); }
    }
    const chooseItem = (doc: any) => { setDraft(d => treasureFromTemplate(doc,category==='mundane'?{...d,mundane:{...emptyMundaneRecipe(doc.type==='Gem'?'gemstone':'luxury'),feature:d.mundane?.feature??{text:''}}}:d)); setDetailsVersion(n => n+1); setErrors({}); setPlan(null); setDisclosed(false); };
    const applyResultText = () => {
        if (!draw) return;
        const description = draw.results.map((r: any) => presentReferenceDescription(r.text)).join('<br>');
        const text = (new DOMParser().parseFromString(description,'text/html').body.textContent ?? '').replace(/\s+/g,' ').trim();
        const name = text.slice(0,200), value = treasureResultValue(text);
        // Explicit replacement: no former template, spell, effects or value may leak
        // into a new text-only result. Explicit currency is copied; quantities remain manual.
        setDraft(d => ({ ...freshDraft(category), ...value, name, description, drawId: draw.id, sourceNote: d.sourceNote }));
        setDetailsVersion(n => n+1); setErrors({}); setPlan(null); setDisclosed(false);
    };
    const roll = () => run('draw',async () => {
        const generation = epoch.current;
        const result = await api('/draw',{uuid:table});
        if (generation !== epoch.current || scopeRef.current !== scope) return;
        setDraw(result.draw); change({drawId:result.draw.id});
    });
    const review = () => run('details',async () => {
        const validation = treasureErrors(draft);
        setErrors(validation); if (Object.keys(validation).length) return;
        const generation = epoch.current;
        const result = await api('/prepare',{draft,actorId,saveToLibrary:true});
        if (generation !== epoch.current || scopeRef.current !== scope) return;
        if (Object.keys(result.plan.errors).length) { setErrors(result.plan.errors); return; }
        setPlan(result.plan); setDisclosed(false);
        requestAnimationFrame(() => reviewRef.current?.scrollIntoView({block:'start',behavior:'smooth'}));
    });
    const deliver = () => run('delivery',async () => {
        const id = requestId || newRequestId(), generation = epoch.current;
        setRequestId(id);
        const result = await api('/deliver',{draft,actorId,review:plan?.review,disclosed,requestId:id,saveToLibrary:true});
        if (generation !== epoch.current || scopeRef.current !== scope) return;
        if (result.reviewChanged) { setRequestId(''); setPlan(null); setError({section:'details',text:'Sources changed. Review the current item again before adding it.'}); return; }
        acceptOperation(result.operation);
    });
    const resume = () => run('delivery',async()=>{const result=await api('/deliver',{requestId:operation!.requestId,resume:true});acceptOperation(result.operation);});
    const check = () => run('delivery',async () => {
        const generation = epoch.current, result = await api('/status' + (requestId ? `?requestId=${encodeURIComponent(requestId)}` : ''));
        if (generation !== epoch.current || scopeRef.current !== scope) return;
        if(result.operation) acceptOperation(result.operation);
        else if (!result.operation) setError({section:'delivery',text:'No saved result is visible yet. Retry the same request below; it retains the original delivery identity.'});
    });
    const numberField = (key: 'quantity'|'gp'|'sp'|'cp'|'slots'|'perSlot'|'freeCarry',label: string) => <div key={key}><label>{label}<input inputMode="numeric" value={draft[key]} onChange={e => {if (/^\d*$/.test(e.target.value)) change({[key]:e.target.value,...(draft.mundane&&['gp','sp','cp'].includes(key)?{mundane:{...draft.mundane,valueSource:undefined}}:{})});}} /></label>{localError(key)}</div>;
    const template = catalog?.items.find(i=>i.uuid===draft.templateUuid);
    let preview: any = null;
    if (!plan && ready) {
        try { preview = treasurePayload(draft, template, catalog?.spells.find(s=>s.uuid===draft.spellUuid)); }
        catch { /* Incomplete drafts keep field validation; preview appears when ready. */ }
    }
    const unchangedSource = treasureUnchanged(draft,template);
    const itemOptions = catalog?.items.filter(i=>treasureTemplateAllowed(category,i));
    const options = picker === 'table' ? catalog?.tables : picker === 'item' ? itemOptions : catalog?.spells.filter(s => !tier || String(s.tier) === tier).map(s => ({...s,description:`Tier ${s.tier ?? 'unknown'}`}));
    return <div className="sd-creator-page">
        <h2 ref={startRef} tabIndex={-1}>{TREASURE_CATEGORIES.find(([id])=>id===category)?.[1]}</h2>
        {completion && <div role="status" className="sd-creator-notice">{completion.unchangedSource ? `Assigned ${completion.name} to the character. No library copy was created.` : `Saved ${completion.name} to SheetDelver / ${completion.folderName}.${completion.actorId?' A copy was assigned to the character.':''}`}
            {completion.actorId&&<button onClick={()=>navigate(`/actors/${completion.actorId}`)}>Open character</button>}</div>}
            {requestError('sources')}{resource.error&&<p role="alert">{resource.error}</p>}{!ready && !error && !resource.error && <p role="status">{isConnected ? 'Loading available sources…' : 'Connect to your world to use this tool.'}</p>}
            {!ready && <button disabled={busy} onClick={resource.refresh}>Refresh sources</button>}
            {ready && <>
                {(operation || requestId) && <section ref={outcomeRef} aria-label="Item delivery" className="sd-creator-notice">
                    <h2>{operation?.unchangedSource||plan?.unchangedSource?'Finish assigning item':'Finish saving item'}</h2>
                    <p role="status">{operation?.unchangedSource ? 'Character assignment is not confirmed yet. Check its result before trying again.' : operation?.worldItemId ? `${operation.name} is saved. Character assignment is not yet complete.` : 'Saving is not confirmed yet. Check its result before starting another item.'}</p>
                    {requestError('delivery')}
                    <button disabled={busy} onClick={check}>{operation?.unchangedSource?'Check assignment':'Check save'}</button>
                    {operation?.mode==='library'&&['pending','saved'].includes(operation.state)&&<button disabled={busy} onClick={resume}>{operation.unchangedSource?'Continue assignment':operation.state==='saved'?'Assign saved item':'Continue saving'}</button>}
                    {requestId&&!operation&&plan&&<button disabled={busy} onClick={deliver}>Retry same request</button>}
                </section>}
                <p>{category==='mundane'?'Create a nonmagical valuable, or use an existing native item.':category==='weapons'?'Build from a native weapon, enter its features and qualities, then save the finished item.':'Assign an existing item, or customize one and save it to your world library.'}</p>
                <fieldset disabled={busy || uncertain || operation?.state === 'complete'} className="sd-creator-fields">
                    {category==='random' && <section aria-label="Result source"><h2>1. Result source</h2>
                        <p>Missing tables? Roll outside the application and enter the item details below.</p>
                        <div className="sd-treasure-actions"><button onClick={() => setPicker('table')}>{catalog.tables.find(t=>t.uuid===table)?.name || 'Choose available table'}</button>
                            <button className="sd-creator-roll" disabled={!table} onClick={roll}>Roll table</button><button onClick={resource.refresh}>Refresh sources</button></div>{requestError('draw')}
                        {!catalog.tables.length && <p>No readable tables are available. Manual entry is ready below.</p>}
                        {draw && <div className="sd-creator-notice"><strong>{draw.name} · Rolled {draw.total}</strong>
                            {draw.results.map((r:any,i:number)=><div key={i} dangerouslySetInnerHTML={{__html:presentReferenceDescription(r.text)}} />)}
                            <p>Choose a linked item or apply the result text to replace the draft. Explicit GP/SP/CP values are filled in; review quantities and resolve any remaining details or rolls.</p>
                            {draw.itemUuids.map((uuid:string) => {const item=catalog.items.find(i=>i.uuid===uuid);return item ? <button key={uuid} onClick={()=>chooseItem(item)}>Use {item.name}</button> : null;})}
                            {!draw.itemUuids.some((uuid:string)=>catalog.items.some(item=>item.uuid===uuid)) && draw.results.some((r:any)=>r.text.trim()) && <button type="button" onClick={applyResultText}>Apply to item details</button>}
                            {!!draw.unresolved.length && <p>Some linked sources are unavailable; enter their results manually.</p>}
                            <button onClick={()=>{setDraw(null);change({drawId:''});}}>Clear table result</button>
                        </div>}
                        <label>Source note (GM only)<input value={draft.sourceNote} maxLength={500} onChange={e=>change({sourceNote:e.target.value})} placeholder="Optional book or page reference" /></label>{localError('sourceNote')}
                    </section>
                    }<section aria-label="Item details"><h2>{category==='mundane'?'1. Choose an item':category==='weapons'?'1. Weapon base':'Item details'}</h2>
                        {category==='mundane'&&<><label>Item path<select aria-label="Item path" value={draft.kind==='template'?'template':draft.mundane?.path??'luxury'} onChange={e=>{
                            const path=e.target.value;const m=emptyMundaneRecipe(path==='template'?'luxury':path as MundanePath);
                            m.feature=draft.mundane?.feature??{text:''};
                            editMundane(m,{kind:path==='template'?'template':path==='gemstone'?'Gem':'Basic',templateUuid:'',name:'',gp:'0',sp:'0',cp:'0'});
                        }}><option value="luxury">Luxury object</option><option value="gemstone">Gemstone</option><option value="jewelry">Jewelry</option><option value="template">Existing native item</option></select></label>{localError('mundane.path')}{localError('kind')}</>}
                        {!['mundane','weapons','armor','potions'].includes(category)&&<label>Create from<select aria-label="Create from" value={draft.kind} onChange={e=>{const kind=e.target.value as TreasureDraft['kind'];setDraft({...freshDraft(category),kind,sourceNote:draft.sourceNote,drawId:draft.drawId});setPlan(null);setErrors({});}}>
                            {category!=='scrolls'&&<option value="Basic">Manual treasure / basic item</option>}<option value="template">Existing native item</option>{['random','scrolls'].includes(category)&&<><option value="Scroll">Scroll from a spell</option><option value="Wand">Wand from a spell</option></>}
                        </select></label>}
                        {draft.kind==='template' && <><button onClick={()=>setPicker('item')}>{catalog.items.find(i=>i.uuid===draft.templateUuid)?.name || (category==='weapons'?'Choose weapon base':'Choose native item')}</button>{localError('templateUuid')}<p>Retains the template’s mechanics and effects. Added descriptions do not create new effects.</p>
                            {template&&<p role="status">{unchangedSource?'Unchanged from the original source. Assign it to a character without saving a duplicate.':'Modified from the original source. You can save this version to your library.'}</p>}</>}
                        {['Scroll','Wand'].includes(draft.kind) && <><label>Spell tier<select aria-label="Spell tier" value={tier} onChange={e=>setTier(e.target.value)}><option value="">All tiers</option>{[...new Set(catalog.spells.map(s=>s.tier).filter(t=>t!=null))].sort((a,b)=>Number(a)-Number(b)).map(t=><option key={t} value={t}>{t}</option>)}</select></label>
                            <button onClick={()=>setPicker('spell')}>{catalog.spells.find(s=>s.uuid===draft.spellUuid)?.name || 'Choose spell'}</button>{localError('spellUuid')}
                            <p>Choose from available spells, including a result rolled from your book. The recipient’s class does not limit this picker.</p></>}
                        {category==='mundane'&&draft.mundane&&<MundaneParts value={draft.mundane} change={editMundane} roll={rollMundane} rollObject={rollMundaneObject} native={draft.kind==='template'} errors={errors} rollError={key=>requestError(`mundane.${key}`)}/>}
                        <label>Name *<input value={draft.name} maxLength={200} onChange={e=>change({name:e.target.value})} /></label>{localError('name')}
                        {category==='mundane'&&draft.kind!=='template'&&draft.mundane&&mundaneName(draft.mundane)&&draft.name!==mundaneName(draft.mundane)&&<button type="button" onClick={()=>change({name:mundaneName(draft.mundane!)})}>Use generated name</button>}
                        {category==='weapons'&&draft.weapon&&<WeaponParts value={draft.weapon} change={weapon=>change({weapon})} errors={errors}/>}
                        <div className="sd-creator-grid">{numberField('quantity','Quantity')}{numberField('slots','Slots per group')}{numberField('perSlot','Items per group')}{numberField('freeCarry','Free to carry')}</div>
                        <h3>Item value</h3>{template&&<p>Source value: {template.system?.cost?.gp??0} GP · {template.system?.cost?.sp??0} SP · {template.system?.cost?.cp??0} CP. These amounts are filled in when you select the item.</p>}<p>Value per item. Amounts marked “each” apply to one item; enter the quantity separately. This does not add money to the character.</p>
                        <div className="sd-treasure-money">{numberField('gp','GP')}{numberField('sp','SP')}{numberField('cp','CP')}</div>
                        {category==='mundane'&&draft.mundane&&<div className="sd-treasure-part">
                            <div className="sd-treasure-actions"><span>Suggested value each</span><OriginalDice label="Roll suggested value" onClick={()=>rollMundane('value')}/></div>
                            {requestError('mundane.value')}<p>Original generator suggestion; it replaces GP, SP and CP. Adjust it for size, quality or your campaign.</p>
                            {draft.mundane.valueSource&&<OriginalSourceNote part={{text:`${draft.gp} GP`,source:draft.mundane.valueSource}}/>}
                            <p><strong>Total value ({draft.quantity||'—'}):</strong> {treasureValue(draft,true)}</p>
                        </div>}
                        <h3>{category==='mundane'?'Additional notes':'Description'}</h3><p>{category==='mundane'?'The assembled details are included automatically in the item preview. Add any other information here.':'Include manually determined features, benefits or curses here. These details will be visible to the recipient.'}</p>
                        <RichTextEditor key={`${draft.kind}:${draft.templateUuid}:${detailsVersion}`} content={draft.description} onSave={(html:string)=>change({description:html})} theme={notesTheme} editButtonText="Edit description" />{localError('description')}
                        {preview && <TreasureCardPreview payload={preview} />}
                        <label>{unchangedSource?'Assign to character *':'Assign to character (optional)'}<select aria-label={unchangedSource?'Assign to character':'Assign to character (optional)'} value={actorId} onChange={e=>{setActorId(e.target.value);setPlan(null);setErrors({});}}><option value="">{unchangedSource?'Choose character…':'Save to library only'}</option>{catalog.actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{localError('actorId')}
                        {requestError('details')}<div className="sd-creator-footer"><button onClick={review}>Review item</button></div>
                    </section>
                </fieldset>
                {plan && !operation && <section ref={reviewRef} aria-label="Review item" className="sd-treasure-review"><h2>{plan.unchangedSource?'Review and assign':'Review and save'}</h2>
                    <TreasureCardPreview payload={plan.payload} /><dl className="sd-treasure-facts">{!plan.unchangedSource&&<><dt>Folder</dt><dd>SheetDelver / {plan.folderName}</dd></>}<dt>Recipient</dt><dd>{plan.actorName||'Library only'}</dd><dt>Type</dt><dd>{plan.payload.type}</dd>
                        <dt>Quantity</dt><dd>{plan.payload.system.quantity}</dd><dt>Value each</dt><dd>{treasureValue(draft)}</dd>{category==='mundane'&&<><dt>Total value</dt><dd>{treasureValue(draft,true)}</dd></>}
                        <dt>Slots</dt><dd>{draft.slots} per {draft.perSlot} item(s) · {draft.freeCarry} free to carry</dd>
                        <dt>Source</dt><dd>{plan.templateName ? `Native template: ${plan.templateName}${plan.unchangedSource?' (unchanged)':' (modified)'}` : draft.mundane ? 'SheetDelver Originals / editable authoring' : 'Manual item details'}{plan.draw && ` · Table reference: ${plan.draw.name} (${plan.draw.total})`}</dd>
                        {plan.spellName && <><dt>Linked spell</dt><dd>{plan.spellName}</dd></>}
                    </dl>
                    {!!plan.payload.effects?.length && <><h3>Item effects</h3><ul>{plan.payload.effects.map((e:any,i:number)=><li key={i}>{e.name || 'Unnamed effect'}{e.disabled?' (disabled)':''}</li>)}</ul></>}
                    <p>{category==='mundane'?'Generated features describe the item; they do not add magical effects.':'Textual qualities remain manual. Supported weapon bonus effects and original template effects are included.'} {plan.unchangedSource?'This assigns the original item without creating a library duplicate.':'This saves a reusable item; assignment adds a separate inventory copy.'} It does not equip the item or grant XP or coins.</p>
                    {actorId&&<label><input type="checkbox" checked={disclosed} disabled={busy||uncertain} onChange={e=>setDisclosed(e.target.checked)} />All item details may be shared with the recipient.</label>}
                    {requestError('delivery')}<div className="sd-creator-footer"><button className="sd-creator-primary" disabled={(!!actorId&&!disclosed)||busy||!!uncertain} onClick={deliver}>{plan.unchangedSource?'Assign to character':actorId?'Save and assign':'Save item'}</button></div>
                </section>}
            </>}
        <CompendiumSelectModal isOpen={ready&&!!picker} sharedFrame onClose={()=>setPicker(null)} title={picker==='table'?'Available tables':picker==='item'?'Native items':'Spells'} options={options??[]} onSelect={option=>{
            if (picker==='table') setTable(option.uuid??'');
            if (picker==='item') { const item=catalog?.items.find(i=>i.uuid===option.uuid);if(item)chooseItem(item); }
            if (picker==='spell') change({spellUuid:option.uuid??'',name:draft.name||`${draft.kind} of ${option.name}`});
            setPicker(null);
        }} />
    </div>;
}

function TreasureCardPreview({payload}:{payload:any}) {
    const card = buildDocumentCard(payload, null);
    return <section aria-label="Item card preview" className="sd-treasure-card-preview">
        <h3>Item preview</h3>
        <article aria-label={payload.name} className="sd-resource-card"><CardBody card={card} informational /></article>
    </section>;
}

function WeaponParts({value,change,errors}:{value:WeaponRecipe;change:(v:WeaponRecipe)=>void;errors:Record<string,string>}) {
    const field=(key:'feature'|'trait'|'alignment',label:string)=><label>{label}<input value={value[key]} maxLength={1000} onChange={e=>change({...value,[key]:e.target.value})}/>{errors[key]&&<p role="alert">{errors[key]}</p>}</label>;
    return <div className="sd-treasure-recipe">
        <h3>2. Bonus and feature</h3>
        <label>Additional weapon bonus<select aria-label="Additional weapon bonus" value={value.bonus} onChange={e=>change({...value,bonus:e.target.value})}>{[0,1,2,3].map(n=><option key={n} value={n}>{n?`+${n}`:'None'}</option>)}</select></label>
        {errors.bonus&&<p role="alert">{errors.bonus}</p>}
        <p>This adds to the base weapon’s existing attack and damage effects. Choose None to retain them unchanged.</p>
        {field('feature','Weapon feature')}
        <h3>3. Benefits and curses</h3><p>Enter externally chosen results and any follow-up details. These descriptions require manual adjudication.</p>
        {(['benefits','curses','virtues','flaws'] as const).map(group=><div key={group} className="sd-treasure-part">
            {group==='virtues'&&<h3>4. Personality (optional)</h3>}
            <h4>{group[0].toUpperCase()+group.slice(1)} ({value[group].length})</h4>
            {value[group].map((entry,i)=><div key={i}><label>{group} {i+1}<textarea aria-label={`${group} ${i+1}`} value={entry} maxLength={1000} onChange={e=>change({...value,[group]:value[group].map((v,j)=>j===i?e.target.value:v)})}/></label>
                {errors[`${group}.${i}`]&&<p role="alert">{errors[`${group}.${i}`]}</p>}
                <button type="button" onClick={()=>change({...value,[group]:value[group].filter((_,j)=>j!==i)})}>Remove {group==='curses'?'curse':group.slice(0,-1)} {i+1}</button></div>)}
            <button type="button" disabled={value[group].length>=20} onClick={()=>change({...value,[group]:[...value[group],'']})}>Add {group==='curses'?'curse':group.slice(0,-1)}</button>
        </div>)}
        {field('trait','Personality trait')}{field('alignment','Item alignment')}
        <h3>5. Finished item details</h3>
    </div>;
}
