import { ABILITY_KEYS, prepareActorCore, type PreparationLookups } from './actor-preparation';
import { canonicalUuid } from './identity';
import { getProperty, setProperty } from './foundry';
import type { RuleInputs } from './world-settings';
import type { StatAllocation } from './stat-choices';
import type { prepareShadowdarkView } from './prepared-view';
import type { creatorLevelRequirements, creatorTableOutcome } from './creator-awards';
import type { ChoiceCatalog } from './talent-choices';
import type { LanguagePlan } from './languages';

export const CREATOR_VERSION = 1 as const;
export type NumericEntry = { value: number | null; basis: 'effective' | 'base' };
export interface CreatorChoices { stats?: StatAllocation; target?: string; spell?: string; castingClass?: string }
/** Entry identity is independent of template identity, including repeatable awards. */
export interface CreatorAward {
    id: string; origin: 'recorded' | 'table'; level: number | null;
    source?: string; table?: string; total?: number; results?: string[];
    choices: Record<string, CreatorChoices>;
}
export interface CreatorGear {
    id: string; source: string; quantity: number; equipped: boolean; stashed: boolean;
    spent?: boolean; broken?: boolean; lostSpells?: string[];
}
export interface CharacterDraft {
    version: typeof CREATOR_VERSION; name: string; level: number; xp: number;
    classUuid: string; ancestryUuid: string; backgroundUuid: string; deityUuid: string; patronUuid: string;
    alignment: '' | 'lawful' | 'neutral' | 'chaotic';
    abilities: Record<typeof ABILITY_KEYS[number], NumericEntry>;
    awards: CreatorAward[]; fixedChoices: Record<string, CreatorChoices>;
    ancestryTalents: string[]; classTalents: string[];
    languages: string[]; spells: { source: string; castingClass: string }[];
    hp: { value: NumericEntry; max: NumericEntry };
    gear: CreatorGear[]; coins: { gp: number; sp: number; cp: number };
    notes: string; acknowledgements: string[];
}
export interface CreatorIssue { id: string; step: number; message: string }
/** Environment-neutral wire contract; UI never imports server orchestration. */
export interface CreatorPlan {
    version:1; contextRevision:number; review:string; source:any;
    preview:ReturnType<typeof prepareShadowdarkView>;
    comparisons:{path:string;entered:number;basis:string;base:number;prepared:number}[];
    errors:CreatorIssue[];warnings:CreatorIssue[];unacknowledged:CreatorIssue[];ready:boolean;
    choices:any[];awards:any[];requirements:ReturnType<typeof creatorLevelRequirements>[];expectedAwards:number;
    ancestryOptions:{uuid:string;name:string}[];classOptions:{uuid:string;name:string}[];ancestryChoiceCount:number;classChoiceCount:number;
    tables:{uuid:string;name:string;formula:string;outcomes:ReturnType<typeof creatorTableOutcome>[]}[];
    languagePlan:LanguagePlan&{rows:any[]};fixedSpells:{source:string|null;name:string}[];targetCatalog:ChoiceCatalog;
    listUuid:string|null;requiresPatron:boolean;hitDie:string|null;dependencies:{uuid:string;hash:string}[];
}
export function emptyCharacterDraft(): CharacterDraft {
    return { version: 1, name: '', level: 1, xp: 0, classUuid: '', ancestryUuid: '', backgroundUuid: '', deityUuid: '', patronUuid: '', alignment: '',
        abilities: Object.fromEntries(ABILITY_KEYS.map(key => [key, { value: null, basis: 'effective' }])) as CharacterDraft['abilities'],
        awards: [], fixedChoices: {}, ancestryTalents: [], classTalents: [], languages: [], spells: [],
        hp: { value: { value: null, basis: 'effective' }, max: { value: null, basis: 'effective' } }, gear: [], coins: { gp: 0, sp: 0, cp: 0 }, notes: '', acknowledgements: [] };
}
/** Stable full-intent encoding. Unlike creationGrantReview, includes inventory/numbers/notes. */
export function creatorCanonical(value: unknown): string {
    const canonical = (v: any): any => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => [k, canonical(v[k])])) : v;
    return JSON.stringify(canonical(value));
}
const integer = (v: unknown, min = 0, max = 1_000_000): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown) => typeof v === 'string' && canonicalUuid(v) === v;
const refs = (v: any) => Array.isArray(v) && v.length <= 200 && v.every(exact) && new Set(v).size === v.length;
const id = (v: unknown) => typeof v === 'string' && /^[\w-]{1,80}$/.test(v);
const numberEntry = (v: any) => object(v) && ['base','effective'].includes(v.basis) && (v.value === null || integer(v.value));
/** Validate bounded identifiers and selections; document bodies/effects are never inputs. */
export function validateCharacterDraft(v: any): asserts v is CharacterDraft {
    const fail = () => { throw new Error('Character entries have an invalid shape. Use finite whole numbers, exact sources and separate award choices.'); };
    if (!object(v) || v.version !== 1 || typeof v.name !== 'string' || v.name.length > 200 || !integer(v.level,0,20) || !integer(v.xp)
        || !['','lawful','neutral','chaotic'].includes(v.alignment) || typeof v.notes !== 'string' || v.notes.length > 10000) fail();
    for (const key of ['classUuid','ancestryUuid','backgroundUuid','deityUuid','patronUuid']) if (v[key] !== '' && !exact(v[key])) fail();
    if (!object(v.abilities) || Object.keys(v.abilities).length !== 6 || ABILITY_KEYS.some(key => !numberEntry(v.abilities[key]))) fail();
    if (!object(v.hp) || !numberEntry(v.hp.value) || !numberEntry(v.hp.max) || !object(v.coins) || ['gp','sp','cp'].some(k => !integer(v.coins[k]))) fail();
    const choices = (c: any) => {
        if (!object(c) || Object.keys(c).length > 100) fail();
        for (const [key, entry] of Object.entries(c) as [string, any][]) {
            if (!key || key.length > 600 || !object(entry) || Object.keys(entry).some(k => !['stats','target','spell','castingClass'].includes(k))) fail();
            if (entry.stats !== undefined && (!object(entry.stats) || Object.entries(entry.stats).some(([s,n]) => !ABILITY_KEYS.includes(s as any) || !integer(n,0,2)))) fail();
            if (entry.target !== undefined && (typeof entry.target !== 'string' || entry.target.length > 200)) fail();
            for (const k of ['spell','castingClass']) if (entry[k] !== undefined && entry[k] !== '' && !exact(entry[k])) fail();
        }
    };
    choices(v.fixedChoices);
    if (![v.ancestryTalents,v.classTalents,v.languages].every(refs) || !Array.isArray(v.spells) || v.spells.length > 200
        || v.spells.some((s: any) => !object(s) || !exact(s.source) || !exact(s.castingClass))) fail();
    if (!Array.isArray(v.awards) || v.awards.length > 100 || new Set(v.awards.map((a: any) => a?.id)).size !== v.awards.length) fail();
    for (const a of v.awards) {
        if (!object(a) || !id(a.id) || !['recorded','table'].includes(a.origin) || (a.level !== null && !integer(a.level,0,v.level))) fail();
        if (a.origin === 'recorded' ? !exact(a.source) : !exact(a.table) || !integer(a.total,0,10000) || !Array.isArray(a.results) || a.results.length > 100 || a.results.some((r: unknown) => !id(r)) || new Set(a.results).size !== a.results.length) fail();
        choices(a.choices);
    }
    if (!Array.isArray(v.gear) || v.gear.length > 200 || new Set(v.gear.map((g: any) => g?.id)).size !== v.gear.length
        || v.gear.some((g: any) => !object(g) || !id(g.id) || !exact(g.source) || !integer(g.quantity,0) || typeof g.equipped !== 'boolean' || typeof g.stashed !== 'boolean' || (g.equipped && g.stashed))) fail();
    for(const g of v.gear) if ((g.spent!==undefined&&typeof g.spent!=='boolean')||(g.broken!==undefined&&typeof g.broken!=='boolean')||(g.lostSpells!==undefined&&!refs(g.lostSpells)))fail();
    if (!Array.isArray(v.acknowledgements) || v.acknowledgements.length > 200 || v.acknowledgements.some((s: unknown) => typeof s !== 'string' || s.length > 100)) fail();
    const keys = Object.keys(emptyCharacterDraft());
    if (Object.keys(v).some(k => !keys.includes(k))) fail();
}

/** Invert only constant additive changes, then prove equality with the normal
 * preparer. Formula/override/cyclic effects require explicit base entry. */
export function reconcileCreatorNumbers(actor: any, entries: Record<string, NumericEntry>, lookups: PreparationLookups, rules: RuleInputs) {
    const source = structuredClone(actor), errors: string[] = [], comparisons: { path: string; entered: number; basis: string; base: number; prepared: number }[] = [];
    for (const [path, entry] of Object.entries(entries)) if (entry.value !== null) setProperty(source,path,entry.value);
    const initial = prepareActorCore(source,lookups,rules);
    for (const [path, entry] of Object.entries(entries)) {
        if (entry.value === null) { errors.push(`Enter ${path.replace('system.','')} from your sheet.`); continue; }
        let base = entry.value;
        if (entry.basis === 'effective') {
            const changes = initial.effects.filter(e => e.applies).flatMap(e => e.changes).filter(c => c.key === path);
            if (changes.some(c => c.type !== 'add' || !['initial','final'].includes(c.phase) || !/^[+-]?\d+$/.test(String(c.value).trim()))) {
                errors.push(`${path.replace('system.','')} has a non-additive or formula effect. Enter its native base and review the effective preview.`); continue;
            }
            base -= changes.reduce((sum,c) => sum + Number(c.value),0);
        }
        if (!integer(base)) { errors.push(`${path.replace('system.','')} cannot reproduce that total with a valid native base.`); continue; }
        setProperty(source,path,base);
    }
    const prepared = prepareActorCore(source,lookups,rules);
    for (const [path, entry] of Object.entries(entries)) if (entry.value !== null) {
        const result = getProperty({system:prepared.effective},path) as number;
        comparisons.push({ path, entered: entry.value, basis: entry.basis, base: getProperty(source,path) as number, prepared: result });
        if (entry.basis === 'effective' && result !== entry.value) errors.push(`${path.replace('system.','')} does not match the entered paper total after preparation.`);
    }
    return { source, prepared, comparisons, errors: [...new Set(errors)] };
}
