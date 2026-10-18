import { canonicalUuid } from './identity';

export type LanguageRarity = 'common' | 'rare' | null;
/** Source field only. A translated/custom name never establishes rarity. */
export function languageRarity(doc: any): LanguageRarity {
    return doc?.system?.rarity === 'common' || doc?.system?.rarity === 'rare' ? doc.system.rarity : null;
}
export type LanguageGroupId = 'ancestry' | 'class' | 'common' | 'rare';
export type LanguageSelections = Record<LanguageGroupId, string[]>;
export const emptyLanguageSelections = (): LanguageSelections => ({ ancestry: [], class: [], common: [], rare: [] });
export interface LanguageGroup { id: LanguageGroupId; label: string; count: number; options: string[] }
export interface LanguagePlan { fixed: string[]; groups: LanguageGroup[]; errors: string[] }

/** Native CharacterGeneratorSD._loadLanguages + _updateLangData. No inferred
 * Common/INT allowance, merged restricted pools, or Background language schema. */
export function languagePlan(ancestry: any, classDoc: any, languages: any[], existing: readonly string[] = [], exactDocuments: any[] = []): LanguagePlan {
    const errors: string[] = [];
    const read = (doc: any, owner: string) => {
        const data = doc?.system?.languages ?? {};
        const count = (key: string) => {
            const value = data[key] === undefined ? 0 : data[key]; // native NumberField initial 0
            if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
            errors.push(`${owner} language ${key} count is invalid.`); return 0;
        };
        const refs = (key: string): string[] => {
            const values = data[key] === undefined ? [] : data[key]; // native ArrayField initial []
            if (!Array.isArray(values) || values.some(value => !canonicalUuid(value))) { errors.push(`${owner} language ${key} needs exact UUIDs.`); return []; }
            return [...new Set(values.map(value => canonicalUuid(value)!))];
        };
        const select = count('select');
        return { common: count('common'), rare: count('rare'), select, fixed: refs('fixed'), options: select > 0 ? refs('selectOptions') : [] };
    };
    const a = read(ancestry, 'Ancestry'), c = read(classDoc, 'Class');
    const fixed = [...new Set([...a.fixed, ...c.fixed])];
    const docs = new Map<string, any>();
    for (const doc of [...languages, ...exactDocuments]) { const uuid = canonicalUuid(doc.uuid); if (uuid && doc.type === 'Language') docs.set(uuid, doc); }
    const catalog = new Set(languages.map(doc => canonicalUuid(doc.uuid)).filter(Boolean));
    const unavailable = (uuid: string) => { if (!docs.has(uuid)) errors.push(`Language ${uuid} is unavailable or not visible.`); };
    fixed.forEach(unavailable);
    const excluded = new Set([...existing, ...fixed]);
    const groups: LanguageGroup[] = [
        { id: 'ancestry', label: 'Ancestry Languages', count: a.select, options: a.options },
        { id: 'class', label: 'Class Languages', count: c.select, options: c.options },
        { id: 'common', label: 'Common Languages', count: a.common + c.common, options: [...docs].filter(([uuid,doc]) => catalog.has(uuid) && languageRarity(doc) === 'common').map(([uuid]) => uuid) },
        { id: 'rare', label: 'Rare Languages', count: a.rare + c.rare, options: [...docs].filter(([uuid,doc]) => catalog.has(uuid) && languageRarity(doc) === 'rare').map(([uuid]) => uuid) },
    ].map(group => ({ ...group, id: group.id as LanguageGroupId, options: group.options.filter(uuid => !excluded.has(uuid)) }));
    for (const group of groups) if (group.count > 0) {
        group.options.forEach(unavailable);
        if (group.options.length < group.count) errors.push(`${group.label} requires ${group.count} distinct readable choices; only ${group.options.length} are available.`);
    }
    return { fixed, groups, errors: [...new Set(errors)] };
}

/** Separate explicit assignments prevent one UUID satisfying two restricted pools. */
export function validateLanguageSelections(plan: LanguagePlan, input: unknown, existing: readonly string[] = []) {
    const errors = [...plan.errors], selections = emptyLanguageSelections();
    const data = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
    const used = new Set([...existing, ...plan.fixed]);
    for (const key of Object.keys(data)) if (!plan.groups.some(group => group.id === key)) errors.push(`Unsupported language choice group ${key}.`);
    for (const group of plan.groups) {
        const values = data[group.id] ?? [];
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || canonicalUuid(value) !== value)) { errors.push(`${group.label} requires exact Language UUIDs.`); continue; }
        if (values.length !== group.count) errors.push(`${group.label} requires exactly ${group.count} choices; received ${values.length}.`);
        for (const uuid of values) {
            if (!group.options.includes(uuid)) errors.push(`${group.label}: ${uuid} is outside its readable native pool.`);
            if (used.has(uuid)) errors.push(`Language ${uuid} cannot fill more than one grant/choice.`);
            used.add(uuid);
        }
        selections[group.id] = [...values];
    }
    return { valid: errors.length === 0, errors: [...new Set(errors)], selections,
        languages: [...new Set([...existing, ...plan.fixed, ...selections.ancestry, ...selections.class, ...selections.common, ...selections.rare])] };
}
