'use client';
import React, { useEffect, useRef, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { useSDK, useSDKComponents } from '@sheet-delver/sdk/react';
import MundaneParts, { OriginalDice, OriginalSourceNote } from './MundaneParts';
import { ORIGINAL_TABLE_VERSION } from '../../data/original-tables';
import BoonParts from './BoonParts';
import BoonEffectFields from '../components/BoonEffectFields';
import { TreasurePart, PermanentModifiers } from './TreasureProcedureParts';
import { supportsTreasureModifiers } from '../../logic/treasure-modifiers';
import { emptyUtilityRecipe, emptySpellItemRecipe, weaponBases, weaponName, tierSpells, type UtilityRecipe } from '../../logic/treasure-procedures';
import PotionParts from './PotionParts';
import { emptyPotionRecipe, POTION_KEYS, potionFeatureTable, type PotionPart, type PotionRecipe } from '../../logic/potion-treasure';
import ArmorParts from './ArmorParts';
import { emptyArmorRecipe, armorBases, armorName, type ArmorRecipe } from '../../logic/armor-treasure';
import MagicAttributes from './MagicAttributes';
import { isScroll } from '../../logic/scrolls';
import { emptyMagicRecipe, magicFixedFamily, type MagicGroup } from '../../logic/magic-attributes';
import { BOON_PARTS, boonKeys, boonName, emptyBoonRecipe, type BoonRecipe, type BoonPartKey } from '../../logic/boons';
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
const notesTheme = { ...shadowdarkTheme.richText, container: 'sd-rich-text-editor relative group flex flex-col', editor: 'prose prose-sm font-serif max-w-none focus:outline-none min-h-[8rem] p-4 text-black' };
const defaultTable = 'Compendium.shadowdark.rollable-tables.RollTable.Pi9nnnLeXpTKCSMY';
type Catalog = { namingAvailable?: boolean; tables: any[]; items: any[]; spells: any[]; actors: { id: string; name: string }[] };
type Operation = { unchangedSource?: boolean; requestId: string; actorId: string; itemId?: string; worldItemId?: string; mode?: string; category?: string; folderName?: string; name: string; state: string };
const freshWeapon=()=>({...emptyWeaponRecipe(),mode:'build' as const,bonus:'',featurePart:{text:''}});
const freshDraft = (category: TreasureCategory): TreasureDraft => ({...emptyTreasureDraft(),category,magic:category==='boons'?undefined:emptyMagicRecipe(),...(category==='boons'?{kind:'Boon',boon:emptyBoonRecipe()}:category==='mundane'?{mundane:emptyMundaneRecipe()}:category==='weapons'?{kind:'template',weapon:freshWeapon()}:category==='armor'?{kind:'template',armor:emptyArmorRecipe()}:category==='potions'?{kind:'Potion',potion:emptyPotionRecipe()}:category==='magic'?{kind:'template'}:category==='scrolls'?{kind:'Scroll',spellItem:emptySpellItemRecipe()}:category==='utility'?{utility:emptyUtilityRecipe()}:{})});
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
                {TREASURE_CATEGORIES.filter(([id])=>id!=='magic'&&id!=='personality').map(([id,label])=><li key={id}><button disabled={locked} aria-current={category===id?'page':undefined}
                    onClick={()=>setCategory(id)}>{label}</button></li>)}
            </ol></nav>
            <TreasureWorkflow key={category} category={category} initialDraft={drafts.current[category]}
                remember={d=>{drafts.current[category]=d;}} lock={setLocked} recoverCategory={setCategory}/>

        </div>
    </main>;
}
function TreasureWorkflow({category,initialDraft,remember,lock,recoverCategory}:{category:TreasureCategory;initialDraft?:TreasureDraft;remember:(d:TreasureDraft)=>void;lock:(value:boolean)=>void;recoverCategory:(category:TreasureCategory)=>void}) {
    const { fetchWithAuth, navigate, resolveImageUrl, worldId, currentUser, isConnected } = useSDK();
    const { RichTextEditor } = useSDKComponents();
    const scope = JSON.stringify([worldId,currentUser?.id,currentUser?.role,isConnected]);
    const resource = useToolCatalog(TOOL_TREASURE);
    const catalog: Catalog | null = resource.data?.[0] ?? null;
    const [draft,setDraft] = useState(()=>initialDraft??freshDraft(category));
    const [detailsVersion,setDetailsVersion] = useState(0);
    const [nameSuggestion,setNameSuggestion] = useState('');
    const [actorId,setActorId] = useState('');
    const [table,setTable] = useState('');
    const [draw,setDraw] = useState<any>(null);
    const [plan,setPlan] = useState<any>(null);
    const [operation,setOperation] = useState<Operation | null>(null);
    const [requestId,setRequestId] = useState('');
    const [completion,setCompletion] = useState<Operation|null>(null);
    const startRef=useRef<HTMLHeadingElement>(null);
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
    useEffect(() => { setNameSuggestion(''); }, [detailsVersion, catalog, ready]);
    const uncertain = !!requestId || (!!operation && operation.state !== 'complete');
    useEffect(()=>{remember(draft);},[draft]);
    useEffect(()=>{lock(busy||uncertain);},[busy,uncertain]);
    function acceptOperation(op: Operation) {
        if(op.state!=='complete'){setOperation(op);return;}
        setCompletion(op);setOperation(null);setRequestId('');setDraft(freshDraft(category));setPlan(null);setDraw(null);setActorId('');setErrors({});setDetailsVersion(n=>n+1);
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
    const change = (patch: Partial<TreasureDraft>) => { setDraft(d => ({...d,...patch})); setPlan(null);  setErrors({}); };
    const replaceDraft=(next:TreasureDraft)=>{
        setDraft(next);setDetailsVersion(n=>n+1);setPlan(null);setErrors({});setCompletion(null);setError(null);setDraw(null);
    };
    const resetItem=(clear:boolean)=>{
        const source=catalog?.items.find(i=>i.uuid===draft.templateUuid);
        const fresh={...freshDraft(category),...(category==='armor'?{armor:emptyArmorRecipe('existing')}:category==='potions'?{kind:'template' as const,potion:emptyPotionRecipe('existing')}:category==='utility'?{kind:'template' as const,utility:emptyUtilityRecipe('existing')}:category==='weapons'?{weapon:{...emptyWeaponRecipe(),mode:'existing' as const}}:category==='scrolls'?{kind:'template' as const,spellItem:undefined}:{})};
        replaceDraft(!clear&&source?treasureFromTemplate(source,fresh):fresh);
    };
    const selectArmorBase=(uuid:string)=>{
        const armor=draft.armor??emptyArmorRecipe(),source=catalog?.items.find(i=>i.uuid===uuid);
        const old=catalog?.items.find(i=>i.uuid===draft.templateUuid);
        const automatic=!draft.name||draft.name===armorName(old,armor.bonus);
        if(!source){change({...emptyTreasureDraft(),category,kind:'template',armor,magic:draft.magic});setDetailsVersion(n=>n+1);return;}
        change({...treasureFromTemplate(source,draft),armor,...(automatic?{name:armorName(source,armor.bonus)}:{name:draft.name})});
        setDetailsVersion(n=>n+1);
    };
    const editArmor=(armor:ArmorRecipe)=>{
        const source=catalog?.items.find(i=>i.uuid===draft.templateUuid);
        const automatic=!draft.name||draft.name===armorName(source,draft.armor?.bonus??'');
        change({armor,...(automatic?{name:armorName(source,armor.bonus)}:{})});
    };
    const rollArmor=(key:'type'|'bonus'|'feature')=>run(`armor.${key}`,async()=>{
        const generation=epoch.current;
        if(key==='type'){
            const result=await api('/original-draw',{table:'armor-type',version:ORIGINAL_TABLE_VERSION});
            if(generation!==epoch.current||scopeRef.current!==scope)return;
            if(!armorBases(catalog?.items??[]).some(i=>i.uuid===result.armorType.uuid))throw Error('The rolled armor type is not in the current list. Refresh sources.');
            selectArmorBase(result.armorType.uuid);
        }else{
            const part=await originalDraw(`armor-${key}`);
            if(generation!==epoch.current||scopeRef.current!==scope)return;
            editArmor({...draft.armor!,...(key==='bonus'?{bonus:part.text,bonusSource:part.source}:{feature:part})});
        }
    });
    const rollPotion=(key:PotionPart|'all')=>run(`potion.${key}`,async()=>{
        let potion={...draft.potion!};const generation=epoch.current;
        for(const part of key==='all'?POTION_KEYS:[key]){
            const result=await originalDraw(potionFeatureTable(part));
            if(generation!==epoch.current||scopeRef.current!==scope)return;
            potion={...potion,[part]:result};
        }
        change({potion});
    });
    const clear=()=>{replaceDraft(freshDraft(category));setActorId('');setPicker(null);setTier('');};
    const sourceActions=()=> <div className="sd-treasure-actions"><button type="button" onClick={resource.refresh}>Refresh sources</button><button type="button" onClick={clear}>Clear</button></div>;
    const editUtility=(utility:UtilityRecipe)=>change({utility,...(!draft.name||draft.name===draft.utility?.form.text?{name:utility.form.text}:{})});
    const rollUtility=(key:'form'|'feature'|'all')=>run(`utility.${key}`,async()=>{
        let utility={...draft.utility!};const generation=epoch.current;
        for(const part of key==='all'?['form','feature'] as const:[key]){
            const result=await originalDraw(`utility-${part}`);
            if(generation!==epoch.current||scopeRef.current!==scope)return;
            utility={...utility,[part]:result};
        }
        editUtility(utility);
    });
    const selectWeaponBase=(uuid:string)=>{
        const weapon=draft.weapon!,source=catalog?.items.find(i=>i.uuid===uuid),old=catalog?.items.find(i=>i.uuid===draft.templateUuid);
        const automatic=!draft.name||draft.name===weaponName(old,weapon.bonus);
        if(!source){change({...emptyTreasureDraft(),category,kind:'template',weapon,magic:draft.magic,modifiers:draft.modifiers});setDetailsVersion(n=>n+1);return;}
        change({...treasureFromTemplate(source,draft),...(automatic?{name:weaponName(source,weapon.bonus)}:{name:draft.name})});setDetailsVersion(n=>n+1);
    };
    const editWeapon=(weapon:WeaponRecipe)=>{
        const source=catalog?.items.find(i=>i.uuid===draft.templateUuid);
        change({weapon,...(!draft.name||draft.name===weaponName(source,draft.weapon!.bonus)?{name:weaponName(source,weapon.bonus)}:{})});
    };
    const rollWeapon=(key:'type'|'bonus'|'feature'|'quantity')=>run(`weapon.${key}`,async()=>{
        const generation=epoch.current;
        if(key==='type'||key==='quantity'){
            const result=await api('/original-draw',{table:key==='type'?'weapon-type':'ammunition-quantity',version:ORIGINAL_TABLE_VERSION,uuid:draft.templateUuid});
            if(generation!==epoch.current||scopeRef.current!==scope)return;
            if(key==='quantity')change({quantity:String(result.quantity)});
            else{
                if(!weaponBases(catalog?.items??[]).some(i=>i.uuid===result.weaponType.uuid))throw Error('Refresh sources to use the rolled weapon type.');
                selectWeaponBase(result.weaponType.uuid);
            }
        }else{
            const part=await originalDraw(`weapon-${key}`);
            if(generation!==epoch.current||scopeRef.current!==scope)return;
            editWeapon({...draft.weapon!,...(key==='bonus'?{bonus:part.text,bonusSource:part.source}:{featurePart:part})});
        }
    });
    const chooseSpell=(spell:any)=>{
        const old=catalog?.spells.find(s=>s.uuid===draft.spellUuid);
        change({spellUuid:spell.uuid,...(!draft.name||draft.name===`${draft.kind} of ${old?.name}`?{name:`${draft.kind} of ${spell.name}`}:{})});
    };
    const changeSpellTier=(value:string,source?:any)=>{
        const old=catalog?.spells.find(s=>s.uuid===draft.spellUuid);
        change({spellItem:{...draft.spellItem!,tier:value,tierSource:source},spellUuid:'',...(draft.name===`${draft.kind} of ${old?.name}`?{name:''}:{})});
        setPicker(null);
    };
    const rollSpellPart=(key:'feature'|'tier'|'spell')=>run(`spellItem.${key}`,async()=>{
        const generation=epoch.current;
        if(key==='spell'){
            const result=await api('/original-draw',{table:'tier-spell',tier:draft.spellItem!.tier,version:ORIGINAL_TABLE_VERSION});
            if(generation!==epoch.current||scopeRef.current!==scope)return;
            const spell=tierSpells(catalog?.spells??[],draft.spellItem!.tier).find(s=>s.uuid===result.spell.uuid);
            if(!spell)throw Error('Refresh sources to use the rolled spell.');
            chooseSpell(spell);
        }else{
            const part=await originalDraw(key==='tier'?'spell-tier':`${draft.kind.toLowerCase()}-feature`);
            if(generation!==epoch.current||scopeRef.current!==scope)return;
            if(key==='tier')changeSpellTier(part.text,part.source);
            else change({spellItem:{...draft.spellItem!,feature:part}});
        }
    });
    const editMundane = (mundane: MundaneRecipe, patch: Partial<TreasureDraft> = {}) => {
        const generated=mundaneName(draft.mundane??emptyMundaneRecipe());
        change({mundane,...(!draft.name||draft.name===generated?{name:mundaneName(mundane)}:{}),...patch});
    };
    async function originalDraw(table: string): Promise<MundanePart> {
        const result=await api('/original-draw',{table,version:ORIGINAL_TABLE_VERSION});
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
    const editBoon = (boon:BoonRecipe) => change({boon,...(!draft.name||draft.name===boonName(draft.boon!)?{name:boonName(boon)}:{})});
    const rollBoon = (key:BoonPartKey|'all') => run(`boon.${key}`,async()=>{
        let boon={...draft.boon!};const generation=epoch.current;
        for(const part of key==='all'?boonKeys(boon.path):[key]) {
            const result=await originalDraw(BOON_PARTS[part].table);
            if(generation!==epoch.current||scopeRef.current!==scope)return;
            boon={...boon,[part]:result};
        }
        editBoon(boon);
    });
    const rollMagic = (group:MagicGroup,index:number,table:string) => run(`magic.${group}.${index}`,async()=>{
        const generation=epoch.current,magic=draft.magic??emptyMagicRecipe();
        const part=await originalDraw(table);
        if(generation!==epoch.current||scopeRef.current!==scope)return;
        change({magic:{...magic,[group]:magic[group].map((value,i)=>i===index?part:value)}});
    });
    const localError = (key: string) => errors[key] ? <p role="alert">{errors[key]}</p> : null;
    const requestError = (section: string) => error?.section === section ? <p role="alert">{error.text}</p> : null;
    async function run(section: string, work: () => Promise<void>) {
        if (pending.current || !ready) return;
        pending.current = true; setBusy(true); setError(null);
        try { await work(); } catch (e) { if (scopeRef.current === scope) setError({section,text:e instanceof Error ? e.message : 'Request failed.'}); }
        finally { pending.current = false; setBusy(false); }
    }
    const chooseItem = (doc: any) => { setDraft(d => treasureFromTemplate(doc,category==='mundane'?{...d,mundane:{...emptyMundaneRecipe(doc.type==='Gem'?'gemstone':'luxury'),feature:d.mundane?.feature??{text:''}}}:isScroll(doc)?{...d,magic:{...(d.magic??emptyMagicRecipe()),personalityEnabled:false}}:d)); setDetailsVersion(n => n+1); setErrors({}); setPlan(null);  };
    const applyResultText = () => {
        if (!draw) return;
        const description = draw.results.map((r: any) => presentReferenceDescription(r.text)).join('<br>');
        const text = (new DOMParser().parseFromString(description,'text/html').body.textContent ?? '').replace(/\s+/g,' ').trim();
        const name = text.slice(0,200), value = treasureResultValue(text);
        // Explicit replacement: no former template, spell, effects or value may leak
        // into a new text-only result. Explicit currency is copied; quantities remain manual.
        setDraft(d => ({ ...freshDraft(category), ...value, name, description, drawId: draw.id, sourceNote: d.sourceNote }));
        setDetailsVersion(n => n+1); setErrors({}); setPlan(null);
    };
    const roll = () => run('draw',async () => {
        const generation = epoch.current;
        const result = await api('/draw',{uuid:table});
        if (generation !== epoch.current || scopeRef.current !== scope) return;
        setDraw(result.draw); change({drawId:result.draw.id});
    });
    const suggestName = () => run('name', async () => {
        const generation = epoch.current;
        const result = await api('/name', {});
        if (generation !== epoch.current || scopeRef.current !== scope) return;
        const name = result.parts.map((part: string) => new DOMParser().parseFromString(part, 'text/html').body.textContent ?? '').join(' ').replace(/\s+/g, ' ').trim();
        if (!name || name.length > 200) throw new Error('The suggested name is empty or too long. Enter a name manually.');
        setNameSuggestion(name);
    });
    const review = () => run('details',async () => {
        const validation = treasureErrors(draft);
        setErrors(validation); if (Object.keys(validation).length) return;
        const generation = epoch.current;
        const result = await api('/prepare',{draft,actorId,saveToLibrary:true});
        if (generation !== epoch.current || scopeRef.current !== scope) return;
        if (Object.keys(result.plan.errors).length) { setErrors(result.plan.errors); return; }
        setPlan(result.plan);
        requestAnimationFrame(() => reviewRef.current?.scrollIntoView({block:'start',behavior:'smooth'}));
    });
    const deliver = () => run('delivery',async () => {
        const id = requestId || newRequestId(), generation = epoch.current;
        setRequestId(id);
        const result = await api('/deliver',{draft,actorId,review:plan?.review,requestId:id,saveToLibrary:true});
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
    const options = picker === 'table' ? catalog?.tables : picker === 'item' ? itemOptions : catalog?.spells.filter(s => draft.spellItem?String(s.tier)===draft.spellItem.tier:!tier || String(s.tier) === tier).map(s => ({...s,description:`Tier ${s.tier ?? 'unknown'} · ${s.classes?.length?s.classes.join(', '):'Class unavailable'}`}));
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
                <p>{category==='boons'?'Create a non-monetary reward, save it to your library and optionally assign it to a character.':category==='mundane'?'Create a nonmagical valuable, or use an existing native item.':category==='weapons'?'Build from a native weapon, enter its features and qualities, then save the finished item.':'Assign an existing item, or customize one and save it to your world library.'}</p>
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
                    }<section aria-label="Item details"><h2>{category==='boons'?'1. Choose a boon':category==='mundane'?'1. Choose an item':category==='weapons'?'1. Weapon base':'Item details'}</h2>
                        {category==='boons'&&draft.boon&&<BoonParts value={draft.boon} change={editBoon} roll={rollBoon} rollAll={()=>rollBoon('all')} errors={errors} rollError={key=>requestError(`boon.${key}`)}/>}
                        {category==='mundane'&&<><label>Item path<select aria-label="Item path" value={draft.kind==='template'?'template':draft.mundane?.path??'luxury'} onChange={e=>{
                            const path=e.target.value;const m=emptyMundaneRecipe(path==='template'?'luxury':path as MundanePath);
                            m.feature=draft.mundane?.feature??{text:''};
                            editMundane(m,{kind:path==='template'?'template':path==='gemstone'?'Gem':'Basic',templateUuid:'',name:'',gp:'0',sp:'0',cp:'0'});
                        }}><option value="luxury">Luxury object</option><option value="gemstone">Gemstone</option><option value="jewelry">Jewelry</option><option value="template">Existing native item</option></select></label>{localError('mundane.path')}{localError('kind')}</>}
                        {category==='armor'&&<>
                            <label>Create armor from<select aria-label="Create armor from" value={draft.armor?.mode??'existing'} onChange={e=>replaceDraft({...freshDraft(category),armor:emptyArmorRecipe(e.target.value as ArmorRecipe['mode'])})}>
                                <option value="build">Build armor</option><option value="existing">Existing native item</option>
                            </select></label>{localError('armor.mode')}<div className="sd-treasure-actions"><button type="button" onClick={resource.refresh}>Refresh sources</button>
                                <button type="button" onClick={()=>{replaceDraft(freshDraft(category));setActorId('');setPicker(null);setTier('');}}>Clear</button></div>
                            {draft.armor?.mode==='build'&&<ArmorParts value={draft.armor} bases={armorBases(catalog.items)} selected={draft.templateUuid}
                                selectBase={selectArmorBase} change={editArmor} roll={rollArmor} errors={errors} rollError={key=>requestError(`armor.${key}`)}/>}
                        </>}
                        {category==='potions'&&<>
                            <label>Create potion from<select aria-label="Create potion from" value={draft.potion?.mode??'existing'} onChange={e=>replaceDraft({...freshDraft(category),kind:e.target.value==='build'?'Potion':'template',potion:emptyPotionRecipe(e.target.value as PotionRecipe['mode'])})}>
                                <option value="build">Build potion</option><option value="existing">Existing native item</option>
                            </select></label>{localError('potion.mode')}
                            <div className="sd-treasure-actions"><button type="button" onClick={resource.refresh}>Refresh sources</button>
                                <button type="button" onClick={()=>{replaceDraft(freshDraft(category));setActorId('');setPicker(null);setTier('');}}>Clear</button></div>
                            {draft.potion?.mode==='build'&&<PotionParts value={draft.potion} change={potion=>change({potion})} roll={rollPotion} errors={errors} rollError={key=>requestError(`potion.${key}`)}/>}
                        </>}
                        {category==='utility'&&<>
                            <label>Create utility item from<select aria-label="Create utility item from" value={draft.utility?.mode??'existing'} onChange={e=>replaceDraft({...freshDraft(category),kind:e.target.value==='build'?'Basic':'template',utility:emptyUtilityRecipe(e.target.value as UtilityRecipe['mode'])})}>
                                <option value="build">Build utility item</option><option value="existing">Existing native item</option>
                            </select></label>{localError('utility.mode')}{sourceActions()}
                            {draft.utility?.mode==='build'&&<section aria-label="Utility recipe">
                                <p>Choose its form and appearance, then add utility benefits or curses and any permanent modifiers below.</p>
                                <button type="button" className="sd-creator-roll" onClick={()=>rollUtility('all')}>Roll form and feature</button>{requestError('utility.all')}
                                {(['form','feature'] as const).map(key=><TreasurePart key={key} label={`Utility ${key}`} table={`utility-${key}`} value={draft.utility![key]}
                                    change={part=>editUtility({...draft.utility!,[key]:part})} roll={()=>rollUtility(key)} error={errors[`utility.${key}`]} rollError={requestError(`utility.${key}`)}/>)}
                            </section>}
                        </>}
                        {category==='weapons'&&<>
                            <label>Create weapon from<select aria-label="Create weapon from" value={draft.weapon?.mode??'existing'} onChange={e=>replaceDraft({...freshDraft(category),weapon:e.target.value==='build'?freshWeapon():{...emptyWeaponRecipe(),mode:'existing'}})}>
                                <option value="build">Build weapon / ammunition</option><option value="existing">Existing native item</option>
                            </select></label>{localError('weapon.mode')}{sourceActions()}
                            {draft.weapon?.mode==='build'&&<section aria-label="Weapon recipe">
                                <h3>Weapon type</h3><div className="sd-mundane-input-row"><select aria-label="Weapon type" aria-required="true" value={draft.templateUuid} onChange={e=>selectWeaponBase(e.target.value)}>
                                    <option value="">Choose weapon or ammunition…</option>{weaponBases(catalog.items).map(i=><option key={i.uuid} value={i.uuid}>{i.name}</option>)}
                                </select><OriginalDice label="Roll weapon type" disabled={!weaponBases(catalog.items).length} onClick={()=>rollWeapon('type')}/></div>
                                {template?.img&&<img className="sd-treasure-base-icon" src={resolveImageUrl(template.img)} alt={template.name}/>}{localError('templateUuid')}{requestError('weapon.type')}
                                <p>Type rolls choose equally from available ordinary gear. Damage, properties, slots, price and artwork come from the selected type.</p>
                                <h3>Weapon bonus</h3><div className="sd-mundane-input-row"><select aria-label="Weapon bonus" value={draft.weapon.bonus} onChange={e=>editWeapon({...draft.weapon!,bonus:e.target.value,bonusSource:undefined})}>
                                    <option value="">Choose bonus…</option>{[0,1,2,3].map(n=><option key={n} value={n}>{n?`+${n}`:'None (+0)'}</option>)}
                                </select><OriginalDice label="Roll weapon bonus" onClick={()=>rollWeapon('bonus')}/></div>
                                <OriginalSourceNote part={{text:draft.weapon.bonus,source:draft.weapon.bonusSource}}/>{localError('bonus')}{requestError('weapon.bonus')}
                                <p>{template?.type==='Basic'&&template?.system?.isAmmunition?'Ammunition bonuses are recorded for manual application to the attack; native ammunition does not supply a targeted attack-effect hook.':'The bonus adds native attack and damage effects to this weapon.'} Bonus rolls use equally likely original suggestions.</p>
                                {template?.type==='Basic'&&template?.system?.isAmmunition&&<div className="sd-mundane-part"><button type="button" onClick={()=>rollWeapon('quantity')}>Roll ammunition quantity (2d6)</button>{requestError('weapon.quantity')}<p>Edit the rolled quantity in Quantity below.</p></div>}
                                <TreasurePart label="Weapon feature" table="weapon-feature" value={draft.weapon.featurePart??{text:draft.weapon.feature}} change={featurePart=>editWeapon({...draft.weapon!,featurePart})}
                                    roll={()=>rollWeapon('feature')} error={errors['weapon.feature']} rollError={requestError('weapon.feature')}/>
                            </section>}
                        </>}
                        {category==='scrolls'&&<>
                            <label>Create spell item from<select aria-label="Create spell item from" value={draft.kind} onChange={e=>replaceDraft({...freshDraft(category),kind:e.target.value as TreasureDraft['kind'],spellItem:e.target.value==='template'?undefined:emptySpellItemRecipe()})}>
                                <option value="Scroll">Build scroll</option><option value="Wand">Build wand</option><option value="template">Existing native item</option>
                            </select></label>{sourceActions()}
                            {draft.spellItem&&<section aria-label="Scroll or wand recipe">
                                <TreasurePart label={`${draft.kind} feature`} table={`${draft.kind.toLowerCase()}-feature`} value={draft.spellItem.feature} change={feature=>change({spellItem:{...draft.spellItem!,feature}})}
                                    roll={()=>rollSpellPart('feature')} error={errors['spellItem.feature']} rollError={requestError('spellItem.feature')}/>
                                <h3>Spell tier</h3><div className="sd-mundane-input-row"><select aria-label="Spell tier" value={draft.spellItem.tier} onChange={e=>changeSpellTier(e.target.value)}>
                                    <option value="">Choose tier…</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
                                </select><OriginalDice label="Roll spell tier" onClick={()=>rollSpellPart('tier')}/></div>
                                <OriginalSourceNote part={{text:draft.spellItem.tier,source:draft.spellItem.tierSource}}/>{localError('spellItem.tier')}{requestError('spellItem.tier')}
                                <p>Select a fixed tier from your result, or roll an equally likely original suggestion. Changing tier clears the old spell.</p>
                                <div className="sd-treasure-actions"><button type="button" disabled={!draft.spellItem.tier} onClick={()=>setPicker('spell')}>{catalog.spells.find(s=>s.uuid===draft.spellUuid)?.name||'Choose spell'}</button>
                                    <OriginalDice label="Roll spell" disabled={!tierSpells(catalog.spells,draft.spellItem.tier).length} onClick={()=>rollSpellPart('spell')}/></div>{localError('spellUuid')}{requestError('spellItem.spell')}
                                <p>Spell rolls choose equally among readable spells at this tier. These are available-source alternatives, not the book’s spell table. The selected spell supplies its icon and native casting link.</p>
                                {!!draft.spellItem.tier&&!tierSpells(catalog.spells,draft.spellItem.tier).length&&<p>No available spells at this tier. Refresh sources or choose another tier.</p>}
                            </section>}
                        </>}
                        {!['boons','mundane','weapons','armor','potions','utility','scrolls'].includes(category)&&<label>Create from<select aria-label="Create from" value={draft.kind} onChange={e=>{const kind=e.target.value as TreasureDraft['kind'];setDraft({...freshDraft(category),kind,sourceNote:draft.sourceNote,drawId:draft.drawId});setPlan(null);setErrors({});}}>
                            {category!=='scrolls'&&<option value="Basic">Manual treasure / basic item</option>}<option value="template">Existing native item</option>{['random','scrolls'].includes(category)&&<><option value="Scroll">Scroll from a spell</option><option value="Wand">Wand from a spell</option></>}
                        </select></label>}
                        {draft.kind==='template' && draft.armor?.mode!=='build' && draft.weapon?.mode!=='build' && <><button onClick={()=>setPicker('item')}>{catalog.items.find(i=>i.uuid===draft.templateUuid)?.name || (category==='weapons'?'Choose weapon base':'Choose native item')}</button>{localError('templateUuid')}{draft.templateUuid&&<div className="sd-treasure-actions"><button type="button" disabled={!template} onClick={()=>resetItem(false)}>Reset to source</button><button type="button" onClick={()=>resetItem(true)}>Clear item</button></div>}<p>Retains the template’s mechanics and effects. Added descriptions do not create new effects.</p>
                            {template&&<p role="status">{unchangedSource?'Unchanged from the original source. Assign it to a character without saving a duplicate.':'Modified from the original source. You can save this version to your library.'}</p>}</>}
                        {['Scroll','Wand'].includes(draft.kind) && !draft.spellItem && <><label>Spell tier<select aria-label="Spell tier" value={tier} onChange={e=>setTier(e.target.value)}><option value="">All tiers</option>{[...new Set(catalog.spells.map(s=>s.tier).filter(t=>t!=null))].sort((a,b)=>Number(a)-Number(b)).map(t=><option key={t} value={t}>{t}</option>)}</select></label>
                            <button onClick={()=>setPicker('spell')}>{catalog.spells.find(s=>s.uuid===draft.spellUuid)?.name || 'Choose spell'}</button>{localError('spellUuid')}
                            <p>Choose from available spells, including a result rolled from your book. The recipient’s class does not limit this picker.</p></>}
                        {category==='mundane'&&draft.mundane&&<MundaneParts value={draft.mundane} change={editMundane} roll={rollMundane} rollObject={rollMundaneObject} native={draft.kind==='template'} errors={errors} rollError={key=>requestError(`mundane.${key}`)}/>}
                        <label htmlFor="treasure-name">Name *</label>
                        <div className="sd-mundane-input-row"><input id="treasure-name" value={draft.name} maxLength={200} onChange={e=>change({name:e.target.value})} />
                            <OriginalDice label={catalog.namingAvailable ? 'Suggest item name' : 'Native naming tables unavailable'} disabled={!catalog.namingAvailable} onClick={suggestName}/></div>{localError('name')}{requestError('name')}
                        {nameSuggestion && <div className="sd-treasure-actions" role="status"><span>Suggested: {nameSuggestion}</span>
                            <button type="button" onClick={()=>{change({name:nameSuggestion});setNameSuggestion('');}}>Apply name</button>
                            <button type="button" onClick={()=>setNameSuggestion('')}>Dismiss</button></div>}
                        {category==='boons'&&draft.boon&&boonName(draft.boon)&&draft.name!==boonName(draft.boon)&&<button type="button" onClick={()=>change({name:boonName(draft.boon!)})}>Use generated name</button>}
                        {category==='mundane'&&draft.kind!=='template'&&draft.mundane&&mundaneName(draft.mundane)&&draft.name!==mundaneName(draft.mundane)&&<button type="button" onClick={()=>change({name:mundaneName(draft.mundane!)})}>Use generated name</button>}
                        {category==='boons'&&localError('magic.enabled')}
                        {category==='boons'&&draft.boon&&<BoonEffectFields value={draft.boon.effects??[]} onChange={effects=>editBoon({...draft.boon!,effects})} errors={errors}/>}
                        {category!=='boons'&&!(category==='scrolls'&&draft.kind==='template'&&!template)&&<MagicAttributes allowPersonality={draft.kind!=='Scroll'&&!isScroll(template)} value={draft.magic??emptyMagicRecipe()} fixedFamily={magicFixedFamily(category,template,draft.kind)} change={magic=>change({magic:{...magic,family:magicFixedFamily(category,template,draft.kind)??magic.family}})}
                            roll={rollMagic} errors={errors} rollError={key=>requestError(`magic.${key}`)}/>}
                        {(supportsTreasureModifiers(template?.type??draft.kind)||!!draft.modifiers?.length)&&<PermanentModifiers value={draft.modifiers??[]} change={modifiers=>change({modifiers})} errors={errors} type={template?.type??draft.kind}/>}
                        {category!=='boons'&&<><div className="sd-creator-grid">{numberField('quantity','Quantity')}{numberField('slots','Slots per group')}{numberField('perSlot','Items per group')}{numberField('freeCarry','Free to carry')}</div>
                        <h3>Item value</h3>{template&&<p>Source value: {template.system?.cost?.gp??0} GP · {template.system?.cost?.sp??0} SP · {template.system?.cost?.cp??0} CP. These amounts are filled in when you select the item.</p>}<p>Value per item. Amounts marked “each” apply to one item; enter the quantity separately. This does not add money to the character.</p>
                        <div className="sd-treasure-money">{numberField('gp','GP')}{numberField('sp','SP')}{numberField('cp','CP')}</div></>}
                        {category==='mundane'&&draft.mundane&&<div className="sd-treasure-part">
                            <div className="sd-treasure-actions"><span>Suggested value each</span><OriginalDice label="Roll suggested value" onClick={()=>rollMundane('value')}/></div>
                            {requestError('mundane.value')}<p>Original generator suggestion; it replaces GP, SP and CP. Adjust it for size, quality or your campaign.</p>
                            {draft.mundane.valueSource&&<OriginalSourceNote part={{text:`${draft.gp} GP`,source:draft.mundane.valueSource}}/>}
                            <p><strong>Total value ({draft.quantity||'—'}):</strong> {treasureValue(draft,true)}</p>
                        </div>}
                        <h3>{['boons','mundane'].includes(category)?'Additional notes':'Description'}</h3><p>{['boons','mundane'].includes(category)?'The assembled details are included automatically in the item preview. Add any other information here.':'Include manually determined features, benefits or curses here. These details will be visible to the recipient.'}</p>
                        <RichTextEditor key={`${draft.kind}:${draft.templateUuid}:${detailsVersion}`} content={draft.description} onSave={(html:string)=>change({description:html})} theme={notesTheme} editButtonText="Edit description" />{localError('description')}
                        {preview && <TreasureCardPreview payload={preview} />}
                        <label>{unchangedSource?'Assign to character *':'Assign to character (optional)'}<select aria-label={unchangedSource?'Assign to character':'Assign to character (optional)'} value={actorId} onChange={e=>{setActorId(e.target.value);setPlan(null);setErrors({});}}><option value="">{unchangedSource?'Choose character…':'Save to library only'}</option>{catalog.actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{localError('actorId')}
                        {requestError('details')}<div className="sd-creator-footer"><button onClick={review}>Review item</button></div>
                    </section>
                </fieldset>
                {plan && !operation && <section ref={reviewRef} aria-label="Review item" className="sd-treasure-review"><h2>{plan.unchangedSource?'Review and assign':'Review and save'}</h2>
                    <TreasureCardPreview payload={plan.payload} /><dl className="sd-treasure-facts">{!plan.unchangedSource&&<><dt>Folder</dt><dd>SheetDelver / {plan.folderName}</dd></>}<dt>Recipient</dt><dd>{plan.actorName||'Library only'}</dd><dt>Type</dt><dd>{plan.payload.type}</dd>
                        {category!=='boons'&&<><dt>Quantity</dt><dd>{plan.payload.system.quantity}</dd><dt>Value each</dt><dd>{treasureValue(draft)}</dd>{category==='mundane'&&<><dt>Total value</dt><dd>{treasureValue(draft,true)}</dd></>}
                        <dt>Slots</dt><dd>{draft.slots} per {draft.perSlot} item(s) · {draft.freeCarry} free to carry</dd></>}
                        <dt>Source</dt><dd>{plan.templateName ? `Native template: ${plan.templateName}${plan.unchangedSource?' (unchanged)':' (modified)'}` : draft.mundane||draft.boon ? 'SheetDelver Originals / editable authoring' : 'Manual item details'}{plan.draw && ` · Table reference: ${plan.draw.name} (${plan.draw.total})`}</dd>
                        {plan.spellName && <><dt>Linked spell</dt><dd>{plan.spellName}</dd></>}
                    </dl>
                    <p>Written benefits and curses require manual handling.</p>
                    {requestError('delivery')}<div className="sd-creator-footer"><button className="sd-creator-primary" disabled={busy||!!uncertain} onClick={deliver}>{plan.unchangedSource?'Assign to character':actorId?'Save and assign':'Save item'}</button></div>
                </section>}
            </>}
        <CompendiumSelectModal isOpen={ready&&!!picker} sharedFrame onClose={()=>setPicker(null)} title={picker==='table'?'Available tables':picker==='item'?'Native items':'Spells'} options={options??[]} onSelect={option=>{
            if (picker==='table') setTable(option.uuid??'');
            if (picker==='item') { const item=catalog?.items.find(i=>i.uuid===option.uuid);if(item)chooseItem(item); }
            if (picker==='spell') chooseSpell(option);
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
