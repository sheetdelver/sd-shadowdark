import { createHash } from 'node:crypto';
import { SdkError, processHtmlContent } from '@sheet-delver/sdk';
import type { ModuleServerRequest } from '@sheet-delver/sdk/server';
import { ABILITY_KEYS, prepareActorCore } from '../logic/actor-preparation';
import { LEVEL_ZERO_CLASS, creatorCanonical, reconcileCreatorNumbers, validateCharacterDraft, type CharacterDraft, type CreatorChoices, type CreatorIssue, type CreatorPlan } from '../logic/character-creation';
import { creatorLevelRequirements, creatorTableOutcome, creatorAwardAllocation, NONREPEATABLE_CREATOR_AWARDS } from '../logic/creator-awards';
import { statChoiceRule, applyStatAllocation } from '../logic/stat-choices';
import { talentChoiceKind, applyChoice, assertResolvedTalentChoices, choiceCatalog } from '../logic/talent-choices';
import { canonicalUuid, ownedCopy, formatUuid } from '../logic/identity';
import { spellChoiceGrant, spellGrantClasses, grantSource, FIXED_SPELL_GRANTS } from '../logic/spell-grants';
import { creatorSpellProgression } from '../logic/creator-spell-progression';
import { spellLimit, spellListIdentity } from '../logic/spell-model';
import { allocateLanguageInventory } from '../logic/languages';
import { prepareShadowdarkView } from '../logic/prepared-view';
import { isScroll, SCROLL_SPENT_PATH } from '../logic/scrolls';
import { isWand, wandSpells } from '../logic/wands';
import { setProperty } from '../logic/foundry';
import { requestRevision, requestRules, callerOf, contextConflict } from './access';
import { shadowdarkAdapter as adapter } from './ShadowdarkAdapter';
import { callerLanguagePlan } from './languages';

export const creatorHash = (v: unknown) => createHash('sha256').update(creatorCanonical(v)).digest('hex');
export { LEVEL_ZERO_CLASS } from '../logic/character-creation';
const PHYSICAL = ['Weapon','Armor','Basic','Potion','Scroll','Wand','Gem'];

/** Request-local fresh source planning. No world documents are written here. */
export async function prepareCreator(req: ModuleServerRequest, input: unknown):Promise<CreatorPlan> {
    try { validateCharacterDraft(input); } catch (e) { throw new SdkError('validation',(e as Error).message); }
    const draft: CharacterDraft = structuredClone(input), caller = callerOf(req), revision = requestRevision(req.runtime);
    if (revision === null) throw new SdkError('not_ready','Character Creator needs the current world rules.');
    const errors: CreatorIssue[] = [], warnings: CreatorIssue[] = [];
    const issue = (step: number, message: string, field = ['','identity','abilities','awards','spells','hp','gear','review'][step]) => errors.push({ id: creatorHash([step,field,message]).slice(0,24), step, field, message });
    const warn = (step: number, message: string) => warnings.push({ id: creatorHash([step,message]).slice(0,24), step, message });
    const dependencies = new Map<string,{uuid:string;hash:string}>();
    const resolve = async (uuid: string, types: string[]): Promise<any> => {
        if (!canonicalUuid(uuid)) throw new SdkError('validation','Choose an exact source.');
        const doc = await adapter.resolveDocumentFor(uuid,caller);
        if (!doc || (types.length && !types.includes(doc.type))) throw new SdkError('validation',`A selected ${types.join('/')} source is unavailable or has the wrong type.`);
        const value={...structuredClone(doc),uuid};
        const hash=creatorHash(value), previous=dependencies.get(uuid);
        if (previous && previous.hash!==hash) throw new SdkError('conflict','A source changed during preparation. Review again.');
        dependencies.set(uuid,{uuid,hash});return value;
    };
    const optional = async (uuid: string, type: string) => uuid ? resolve(uuid,[type]) : null;
    const ancestry=await optional(draft.ancestryUuid,'Ancestry');
    const cls=await optional(draft.level===0 ? LEVEL_ZERO_CLASS : draft.classUuid,'Class');
    const background=await optional(draft.backgroundUuid,'Background'), deity=await optional(draft.deityUuid,'Deity'), patron=await optional(draft.patronUuid,'Patron');
    if (!draft.name.trim()) issue(1,'Enter the character’s name.','name');
    if (!ancestry) issue(1,'Choose an ancestry.','ancestryUuid');
    if (!background) issue(1,'Choose a background.','backgroundUuid');
    if (!draft.alignment) issue(1,'Choose an alignment.','alignment');
    if (draft.level>0 && (!cls || cls.uuid===LEVEL_ZERO_CLASS)) issue(1,'Choose an adventuring Class.','classUuid');
    if (draft.level>0 && cls?.system?.patron?.required && !patron) issue(1,'This Class requires a Patron.','patronUuid');
    const items:any[]=[], choices:any[]=[], awards:any[]=[], tablePlans:any[]=[];
    type Pending = { key:string; doc:any; selection:CreatorChoices; level:number|null; awardId:string; origin:string };
    const pending:Pending[]=[];
    const add = (key:string,doc:any,selection:CreatorChoices={},level:number|null=1,awardId=key,origin='fixed') => pending.push({key,doc,selection,level,awardId,origin});
    const ancestryOptions:any[]=[];const classOptions:any[]=[];
    if (ancestry) {
        items.push(ownedCopy(ancestry,ancestry.uuid));
        const refs=[...new Set<string>(ancestry.system?.talents ?? [])];
        const count=ancestry.system?.talentChoiceCount ?? 0;
        if (!Number.isInteger(count)||count<0) issue(3,'The ancestry talent allowance is invalid.','ancestryTalents');
        const selected=refs.length<=count ? refs : draft.ancestryTalents;
        if (refs.length>count && (selected.length!==count||selected.some(r=>!refs.includes(r)))) issue(3,`Choose exactly ${count} ancestry talents from its native pool.`,'ancestryTalents');
        for (const ref of refs) { const doc=await resolve(ref,['Talent','Boon']);ancestryOptions.push({uuid:ref,name:doc.name});if(selected.includes(ref)) add(`ancestry:${ref}`,doc,draft.fixedChoices[`ancestry:${ref}`],0); }
    }
    if (cls) {
        items.push(ownedCopy(cls,cls.uuid));
        const fixed=[...new Set<string>([...(cls.system?.talents??[]),...(cls.system?.classAbilities??[]),...(cls.system?.startingSpells??[])])];
        for (const ref of fixed) add(`class:${ref}`,await resolve(ref,['Talent','Boon','Class Ability','Spell']),draft.fixedChoices[`class:${ref}`],draft.level===0?0:1);
        const refs=[...new Set<string>(cls.system?.talentChoices??[])];const count=cls.system?.talentChoiceCount??0;
        if (!Number.isInteger(count)||count<0) issue(3,'The Class talent allowance is invalid.','classTalents');
        if (draft.classTalents.length!==count || draft.classTalents.some(r=>!refs.includes(r))) issue(3,`Choose exactly ${count} Class talents from its native pool.`, 'classTalents');
        for (const ref of refs) {const doc=await resolve(ref,['Talent','Boon']);classOptions.push({uuid:ref,name:doc.name});if(draft.classTalents.includes(ref))add(`class-choice:${ref}`,doc,draft.fixedChoices[`class-choice:${ref}`]);}
        if ((cls.system?.classAbilityChoiceCount??0)>0) issue(3,'This custom Class has an unsupported class-ability choice pool. Preserve it in notes until its source workflow is supported.');
    }
    const tableRefs=[cls?.system?.classTalentTable,patron?.system?.boonTable].filter((r):r is string=>!!r);
    for (const ref of [...new Set(tableRefs)]) {
        const table=await resolve(ref,[]);if(!Array.isArray(table.results))throw new SdkError('validation','A required award table is unavailable.');
        const totals=[...new Set<number>(table.results.flatMap((r:any)=>Array.isArray(r.range)?[r.range[0]]:[]))];
        tablePlans.push({uuid:ref,kind:ref===patron?.system?.boonTable?'boon':'talent',name:table.name,formula:table.formula,outcomes:totals.map(total=>creatorTableOutcome(table,total))});
    }
    for (const award of draft.awards) {
        if (award.origin==='recorded') {
            const doc=await resolve(award.source!,['Talent','Boon']);add(award.id,doc,award.choices[award.source!]??{},award.level,award.id,'recorded');
            awards.push({id:award.id,level:award.level,origin:award.origin,name:doc.name});
        } else {
            const table=await resolve(award.table!,[]);
            if(!Array.isArray(table.results))throw new SdkError('validation','Choose a readable RollTable.');
            const outcome=creatorTableOutcome(table,award.total!);
            awards.push({id:award.id,level:award.level,origin:award.origin,name:table.name,table:table.uuid,total:award.total,results:award.results});
            if(outcome.unsupported){issue(3,outcome.unsupported,`award:${award.id}`);continue;}
            if(outcome.mode==='stats') {
                const doc={name:outcome.statRule?.maxPerStat===1?'Distribute to Stats (Warlock)':'Distribute to Stats',type:'Talent',system:{description:outcome.text},effects:[]};
                if(award.results!.length)issue(3,'This stat distribution uses its own allocation rather than separate fixed stat results.',`award:${award.id}`);
                add(award.id,doc,award.choices.stats??{},award.level,award.id,'table');
            } else {
                const selected=award.results!;
                if(selected.length!==outcome.count||selected.some(r=>!outcome.options.some((o:any)=>o.id===r))||(outcome.mode==='bundle'&&outcome.options.some((o:any)=>!selected.includes(o.id)))) {issue(3,'Select the complete native award bundle, or the exact required result choices.',`award:${award.id}`);continue;}
                for(const result of outcome.options.filter((o:any)=>selected.includes(o.id))) {
                    if(result.source==='Compendium.shadowdark.rollable-tables.RollTable.EmBGQUSaf5L7ojKJ') {
                        await resolve(result.source,[]);
                        add(`${award.id}:${result.id}`,{name:'Distribute to Stats',type:'Talent',system:{},effects:[]},award.choices[result.id]??{},award.level,award.id,'table');
                    } else add(`${award.id}:${result.id}`,await resolve(result.source,['Talent','Boon']),award.choices[result.id]??{},award.level,award.id,'table');
                }
            }
        }
    }
    for(const ref of NONREPEATABLE_CREATOR_AWARDS)if(pending.filter(p=>grantSource(p.doc)===ref).length>1)
        issue(3,`${pending.find(p=>grantSource(p.doc)===ref)!.doc.name} cannot repeat under its native reroll-duplicates rule. Preserve unsupported paper history as descriptive notes instead.`);
    for (const p of pending) {
        let copy=ownedCopy(p.doc,p.doc.uuid);
        copy.system??={};
        // Native Talent.level cannot store unknown chronology. Preserve native
        // default 0, and separately record unknown; never assign final level.
        if(['Talent','Boon'].includes(copy.type))copy.system.level=p.level??0;
        const award=draft.awards.find(a=>a.id===p.awardId);
        copy.flags={...copy.flags,shadowdark:{...copy.flags?.shadowdark,sheetDelver:{...copy.flags?.shadowdark?.sheetDelver,creatorAward:{id:p.awardId,entry:p.key,origin:p.origin,acquisitionLevel:p.level,
            ...(award?.origin==='table'?{table:award.table,total:award.total,results:award.results}:{})}}}};
        const rule=statChoiceRule(copy), kind=talentChoiceKind(copy), grant=spellChoiceGrant(copy);
        choices.push({key:p.key,name:copy.name,source:p.doc.uuid??null,level:p.level,origin:p.origin,awardId:p.awardId,statRule:rule,targetKind:kind,spellGrant:grant});
        if(rule)try{copy=applyStatAllocation(copy,p.selection.stats??{});}catch(e){issue(3,(e as Error).message,`choice:${p.key}`);}
        items.push(copy);
    }
    const requirements=[];
    for(let level=1;level<=draft.level;level++)requirements.push(creatorLevelRequirements(level,cls,items));
    const expected=requirements.reduce((sum,r)=>sum+r.requiredTalents+r.requiredBoons+r.choiceRolls,0);
    const awardAllocation=creatorAwardAllocation(requirements,draft.awards,tablePlans);
    for(const r of requirements){
        const slots=awardAllocation.slots.filter(s=>s.level===r.level),filled=slots.filter(s=>s.awardId).length;
        if(filled!==slots.length)issue(3,`Level ${r.level}: choose ${slots.length} talent/boon awards from the required Class or Patron tables (${filled} selected).`);
    }
    for(const id of awardAllocation.invalid)issue(3,'Choose an eligible level and Class/Patron table, or remove this extra award.',`award:${id}`);
    const fixedRefs=[...new Set(items.flatMap(i=>FIXED_SPELL_GRANTS[grantSource(i)??'']?[FIXED_SPELL_GRANTS[grantSource(i)!]]:[]))];
    for(const ref of fixedRefs)if(!items.some(i=>i.type==='Spell'&&grantSource(i)===ref))items.push(ownedCopy(await resolve(ref,['Spell']),ref));
    const fixedSpells=items.filter(i=>i.type==='Spell');
    const list=cls?spellListIdentity(cls,cls.uuid):null;
    const listDoc=list?await resolve(list,['Class']):null;
    const ordinary:any[]=[];const used=new Set(items.filter(i=>i.type==='Spell').map(grantSource));
    for(const s of draft.spells) {
        const doc=await resolve(s.source,['Spell']);await resolve(s.castingClass,['Class']);
        if(!Number.isInteger(doc.system?.tier)||doc.system.tier<1||doc.system.tier>5||!Array.isArray(doc.system.class)||!doc.system.class.includes(s.castingClass)) {issue(4,'An entered Spell has no matching native tier/list.');continue;}
        if(used.has(s.source)){issue(4,'Fixed, ordinary and granted Spells must have distinct exact sources.');continue;}
        used.add(s.source);const copy=ownedCopy(doc,s.source);ordinary.push(copy);items.push(copy);
        if(s.castingClass!==list)issue(4,`${doc.name} is outside this Class’s ordinary spell list.`);
    }
    const ordinaryStages=creatorSpellProgression(cls,draft.level,draft.spells,ordinary.map(doc=>({...doc,uuid:grantSource(doc)})));
    for(const p of pending) {
        const rule=spellChoiceGrant(p.doc);if(!rule)continue;
        if(p.level===null){issue(4,`${p.doc.name} requires its acquisition level to validate the Spell choice.`,`choice:${p.key}`);continue;}
        const selected=p.selection.spell;
        if(!selected){issue(4,`Choose the Spell granted by ${p.doc.name}.`,`choice:${p.key}`);continue;}
        const spell=await resolve(selected,['Spell']);
        const learned=new Set(ordinaryStages.filter(stage=>stage.level<=p.level!).flatMap(stage=>stage.tiers.flatMap(t=>t.selected)));
        const context={level:p.level,known:[...ordinary.filter(doc=>learned.has(grantSource(doc)!)),...fixedSpells],classDoc:cls};
        const classes=spellGrantClasses(p.doc,spell,context), casting=p.selection.castingClass||classes[0];
        if(!casting||!classes.includes(casting)||used.has(selected)){issue(4,`Choose an eligible, distinct Spell for ${p.doc.name} at acquisition level ${p.level}. An unsupported tier cannot be waived.`,`choice:${p.key}`);continue;}
        await resolve(casting,['Class']);
        const copy=ownedCopy(spell,selected);
        copy.flags={...copy.flags,shadowdark:{...copy.flags?.shadowdark,spellGrant:{source:grantSource(p.doc),classUuid:casting,level:p.level},sheetDelver:{...copy.flags?.shadowdark?.sheetDelver,creatorGrant:p.key}}};
        used.add(selected);items.push(copy);
    }
    const baseGear=await adapter.getCollection('gear',{caller});
    const effectCatalog=choiceCatalog(baseGear);
    // Selected target templates are re-resolved, rather than trusting the warmed
    // catalog or any document body supplied by the browser.
    const knownCatalog={...effectCatalog,spell:choiceCatalog(items).spell};
    for(const p of pending) {
        const kind=talentChoiceKind(p.doc);if(!kind)continue;
        const copyIndex=items.findIndex(i=>i.flags?.shadowdark?.sheetDelver?.creatorAward?.entry===p.key);
        if(kind!=='spell'&&p.selection.target) {
            for(const row of baseGear.filter(r=>r.name===p.selection.target&&r.type===(kind==='weapon'?'Weapon':'Armor')))
                await resolve(row.uuid,[row.type]);
        }
        try{items[copyIndex]=applyChoice(items[copyIndex],p.selection.target,kind,knownCatalog);}catch(e){issue(3,(e as Error).message,`choice:${p.key}`);}
    }
    try{assertResolvedTalentChoices(items);}catch(e){if(!errors.some(error=>error.field?.startsWith('choice:')))issue(3,(e as Error).message);}
    for(const gear of draft.gear) {
        const doc=await resolve(gear.source,PHYSICAL), copy=ownedCopy(doc,gear.source);
        if(gear.equipped&&!['Weapon','Armor'].includes(doc.type))issue(6,`${doc.name} cannot be equipped under its native type.`,`gear:${gear.id}`);
        copy.system={...copy.system,quantity:gear.quantity,equipped:gear.equipped,stashed:gear.stashed};items.push(copy);
        if(gear.spent!==undefined) {
            if(!isScroll(copy))issue(6,'Only a recognized scroll can have a spent state.',`gear:${gear.id}`);
            else setProperty(copy,SCROLL_SPENT_PATH,gear.spent);
        }
        if(gear.broken!==undefined||gear.lostSpells!==undefined) {
            const spells=wandSpells(copy);
            if(!isWand(copy)||gear.lostSpells?.some(ref=>!spells.some(s=>s.uuid===ref)))issue(6,'Wand state needs exact native linked Spells.',`gear:${gear.id}`);
            else if(copy.type==='Wand') {
                if(gear.broken!==undefined)copy.system.broken=gear.broken;
                if(gear.lostSpells!==undefined)copy.system.spells=copy.system.spells.map((s:any)=>({...s,lost:gear.lostSpells!.includes(canonicalUuid(s.uuid)!)}));
            } else setProperty(copy,'flags.shadowdark.sheetDelver.wand',{...copy.flags?.shadowdark?.sheetDelver?.wand,
                ...(gear.broken!==undefined?{broken:gear.broken}:{}),...(gear.lostSpells!==undefined?{lostSpells:gear.lostSpells}:{})});
        }
    }
    for(const valuable of draft.valuables??[])items.push({name:valuable.name.trim(),type:valuable.kind==='gem'?'Gem':'Basic',img:valuable.kind==='gem'?'icons/commodities/gems/gem-rough-ball-red.webp':'icons/containers/bags/pouch-simple-brown.webp',system:{quantity:valuable.quantity,cost:{gp:valuable.cost.gp,sp:valuable.cost.sp,cp:valuable.cost.cp},...(valuable.kind==='treasure'?{treasure:true,slots:{per_slot:1,slots_used:1},equipped:false,stashed:false}:{})},effects:[]});
    const languagePlan=await callerLanguagePlan(caller,ancestry,cls,[],'inventory');
    // Creation must fill exactly the source-defined choice pools.
    for(const message of languagePlan.errors)issue(4,message,'languages');
    for(const ref of languagePlan.fixed)await resolve(ref,['Language']);
    for(const ref of draft.languages)await resolve(ref,['Language']);
    const languages=[...new Set([...languagePlan.fixed,...draft.languages])];
    const allocation=allocateLanguageInventory(languagePlan,languages);
    const required=languagePlan.groups.reduce((sum,g)=>sum+g.count,0);
    if(allocation.assigned.size!==required||allocation.extra.length)issue(4,`Language choices fill ${allocation.assigned.size} of ${required} native slots with ${allocation.extra.length} extra entries. Fixed languages are included automatically.`, 'languages');
    const actor:any={name:draft.name.trim(),type:'Player',img:'icons/svg/mystery-man.svg',system:{
        abilities:Object.fromEntries(ABILITY_KEYS.map(k=>[k,{value:draft.abilities[k].value??10}])),attributes:{hp:{value:draft.hp.value.value??0,max:draft.hp.max.value??0}},
        class:cls?.uuid??'',ancestry:ancestry?.uuid??'',background:background?.uuid??'',deity:deity?.uuid??'',patron:patron?.uuid??'',alignment:draft.alignment,
        level:{value:draft.level,xp:draft.xp},languages,coins:draft.coins,notes:processHtmlContent(draft.notes),},items,effects:[],prototypeToken:{actorLink:true,name:draft.name.trim()}};
    const lookups=await adapter.callerLookups(actor,caller);
    const numericEntries=Object.fromEntries([...ABILITY_KEYS.map(k=>[`system.abilities.${k}.value`,draft.abilities[k]]),['system.attributes.hp.value',draft.hp.value],['system.attributes.hp.max',draft.hp.max]]);
    const reconciled=reconcileCreatorNumbers(actor,numericEntries,lookups,requestRules(req.runtime));
    for(const message of reconciled.errors){
        const hp=message.includes('hp.');
        const ability=ABILITY_KEYS.find(k=>message.includes(`abilities.${k}.value`));
        issue(hp?5:2,hp&&message.startsWith('Enter ')?'Complete the HP entries above.':ability?message.replace(`abilities.${ability}.value`,ability.toUpperCase()):message,ability?`ability:${ability}`:hp?'hp':'abilities');
    }
    const source=reconciled.source;
    const view=prepareShadowdarkView(source,lookups,requestRules(req.runtime));
    const prepared=prepareActorCore(source,lookups,requestRules(req.runtime));
    if(prepared.hp.value>prepared.hp.max)issue(5,`Current HP ${prepared.hp.value} exceeds maximum ${prepared.hp.max}. Enter current HP no greater than maximum HP.`);
    if(prepared.slotUsage&&prepared.maxSlots!==null&&prepared.slotUsage.total>prepared.maxSlots)warn(6,`Inventory uses ${prepared.slotUsage.total} of ${prepared.maxSlots} slots. Keep actual possessions and review encumbrance.`);
    if(cls?.system?.spellcasting?.ability&&draft.level>0) {
        if(!view.spellModel.sources.some(s=>s.classUuid===cls.uuid)) {
            const grants=view.spellModel.grants;
            const reason=!listDoc?'Its spell-list Class is unavailable.':grants.length
                ? `Its spellcasting talents grant “${grants.join(', ')}”, which does not match the ${listDoc.name} spell list.`
                : 'Its talents do not provide an active spellcasting grant.';
            issue(1,`${cls.name} cannot use its spell list. ${reason} Check the Class and its spellcasting talent in Foundry, then refresh sources.`, 'classUuid');
        }
        for(const stage of creatorSpellProgression(cls,draft.level,[],[])) {
            if(stage.diagnostics.length)issue(4,`Level ${stage.level}: native spell progression is unavailable or decreases. Review the Class source.`);
        }
        for(let tier=1;tier<=5;tier++) {
            const limit=spellLimit(cls.system.spellcasting.spellsknown,draft.level,tier);
            const count=ordinary.filter(i=>i.system.tier===tier&&i.system.class?.includes(list)).length;
            if(limit.status==='unavailable'){if(tier===1)issue(4,'The selected Class has no spells-known data for this level. A supported progression source is required.');}
            else if(count!==limit.value)issue(4,`Tier ${tier}: selected ${count} ordinary Spells; the native Class allowance is ${limit.value}.`);
        }
    } else if(ordinary.length)issue(4,'This character has no ordinary spell allowance. Spells from talents or boons must be selected through their grants.');
    for(const message of prepared.diagnostics)issue(7,message);
    // Re-read every dependency after awaited catalog/preparation work. Final
    // creation repeats this entire planner, including permissions and context.
    for(const d of dependencies.values()) {
        const doc=await adapter.resolveDocumentFor(d.uuid,caller);
        if(!doc||creatorHash({...structuredClone(doc),uuid:d.uuid})!==d.hash)throw new SdkError('conflict','A selected source changed or became unavailable. Review again.');
    }
    if(contextConflict(req.runtime,revision))throw new SdkError('conflict','World rules changed. Prepare again.');
    const unacknowledged=warnings.filter(w=>!draft.acknowledgements.includes(w.id));
    const uniqueErrors=[...new Map(errors.map(e=>[e.id,e])).values()];
    const review=creatorHash({version:1,draft,source,dependencies:[...dependencies.values()].sort((a,b)=>a.uuid.localeCompare(b.uuid)),revision});
    return {version:1 as const,contextRevision:revision,review,source,preview:view,comparisons:reconciled.comparisons,errors:uniqueErrors,warnings,unacknowledged,
        ready:uniqueErrors.length===0&&unacknowledged.length===0,choices,awards,requirements,awardAllocation,expectedAwards:expected,ancestryOptions,classOptions,
        ancestryChoiceCount:ancestry&&ancestryOptions.length>(ancestry.system.talentChoiceCount??0)?ancestry.system.talentChoiceCount:0,
        classChoiceCount:cls?.system?.talentChoiceCount??0,tables:tablePlans,languagePlan,fixedSpells:fixedSpells.map(s=>({source:grantSource(s),name:s.name})),
        targetCatalog:{weapon:effectCatalog.weapon??[],armor:effectCatalog.armor??[],spell:knownCatalog.spell??[]},listUuid:list,requiresPatron:cls?.system?.patron?.required===true,
        hitDie:cls?.system?.hitPoints??null,dependencies:[...dependencies.values()]};
}
