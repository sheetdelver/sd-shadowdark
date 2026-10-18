import { getErrorMessage, logger } from '@sheet-delver/sdk';
import type { ModuleRequestRuntime } from '@sheet-delver/sdk/server';
import shadowdarklingMapping from '../data/shadowdarkling/map-shadowdarkling.json';
import { TALENT_EFFECTS_MAP } from '../data/talent-effects';
import { NATIVE_PREDEFINED_EFFECTS } from '../data/native-predefined-effects';
import { shadowdarkAdapter } from '../server/ShadowdarkAdapter';
import { sanitizeItem, createEffect } from '../utils/Sanitizer';
import { enrichItem, resolveSubItems, EnrichmentContext } from '../logic/actor-enricher';
import { assertResolvedTalentChoices } from '../logic/talent-choices';
import { canonicalUuid, ownedCopy } from '../logic/identity';
import { callerFromRuntime } from './access';
import { collectEffects } from '../logic/effects';
import { resolveFormula } from '../logic/formula';

/**
 * Shadowdarklings JSON → Shadowdark Actor.
 *
 * Supported conversion rules (explicit, nothing else is inferred):
 * 1. the curated map-shadowdarkling.json table (exact key, then case-insensitive key);
 * 2. the one declared compendium document of the expected native type whose name
 *    equals the imported name (case-insensitive); several matches are ambiguous;
 * 3. magic items named "<base> +N" use the base document plus the native magic
 *    bonus representation (weapon: predefined weaponAttackBonus/weaponDamageBonus
 *    `.this` effects; armor: `system.ac.modifier`).
 *
 * Everything is resolved before any write. Unresolved or ambiguous references are
 * returned for review and nothing is created until the caller confirms. Only gear
 * and treasure lines can become custom items, built strictly from the imported
 * file's own fields and labelled as custom.
 */
export interface ImportReference { category: string; name: string; reason: string; candidates?: string[] }

export interface ImportResult {
    success: boolean;
    id?: string;
    needsConfirmation?: boolean;
    unresolved?: ImportReference[];
    created?: { actor: boolean; items: number; total: number };
    errors?: string[];
    warnings?: string[];
    debug?: string[];
}

export interface ImportOptions {
    /** Proceed after review; unresolved non-gear references are skipped. */
    confirm?: boolean;
    /** Create clearly labelled custom items for unresolved gear/treasure lines. */
    allowCustomGear?: boolean;
}

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]!));
const TYPE_FOR_CATEGORY: Record<string, string[]> = {
    ancestry: ['Ancestry'], background: ['Background'], deity: ['Deity'], patron: ['Patron'], class: ['Class'],
    language: ['Language'], spell: ['Spell'], talent: ['Talent', 'Class Ability', 'Boon'],
    weapon: ['Weapon'], armor: ['Armor'], basic: ['Basic', 'Potion', 'Scroll', 'Wand', 'Gem'],
};

/** Sum of transferred numeric `system.attributes.hp.max` ADD changes in items to be created. */
function hpMaxFromItems(items: any[], rollData: unknown): number {
    let total = 0;
    for (const effect of collectEffects({ effects: [], items: items.map((item, index) => ({ ...item, _id: `import${index}` })) })) {
        if (!effect.applies) continue;
        for (const change of effect.changes) {
            if (change.key !== 'system.attributes.hp.max' || change.type !== 'add') continue;
            const value = resolveFormula(change.value, rollData, { forceDeterministic: true });
            if (value.ok && value.deterministic) total += value.value;
        }
    }
    return total;
}

export class ShadowdarkImporter {

    private mapping: any = shadowdarklingMapping;

    public async importFromJSON(runtime: ModuleRequestRuntime, json: any, options: ImportOptions = {}): Promise<ImportResult> {
        const debugLog: string[] = [];
        const log = (msg: string) => { debugLog.push(msg); logger.info(`[ShadowdarkImporter] ${msg}`); };
        const warnings: string[] = [];
        const unresolved: ImportReference[] = [];

        try {
            if (!json || typeof json !== 'object' || !json.rolledStats) throw new Error('This is not a Shadowdarklings character export.');
            log(`Resolving import for ${json.name}`);
            const caller = callerFromRuntime(runtime);

            const gear: any[] = [];
            const customGear: any[] = [];
            const spells: any[] = [];
            const talents: any[] = [];
            const classAbilities: any[] = [];

            /** Explicit rules 1 and 2; never a partial-name or substring match. */
            const findItem = async (name: string, category: string, required = true): Promise<any | null> => {
                if (!name) return null;
                const table = this.mapping?.[category] ?? {};
                const key = table[name] !== undefined ? name : Object.keys(table).find(entry => entry.toLowerCase() === name.toLowerCase());
                if (key) {
                    const uuid = canonicalUuid(table[key]);
                    const doc = uuid ? await shadowdarkAdapter.resolveReadable(uuid, caller) : null;
                    if (doc) return { ...sanitizeItem(doc), uuid };
                    if (required) unresolved.push({ category, name, reason: `Mapped document ${table[key]} is not available from declared packs you can read.` });
                    return null;
                }
                const { doc, ambiguous } = await shadowdarkAdapter.findUniqueByName(name, TYPE_FOR_CATEGORY[category] ?? [], caller);
                if (doc) return sanitizeItem(doc);
                if (required) {
                    unresolved.push(ambiguous.length
                        ? { category, name, reason: 'Several Shadowdark documents share this name.', candidates: ambiguous }
                        : { category, name, reason: 'No Shadowdark document with this name.' });
                }
                return null;
            };

            const findTalent = async (bonus: any): Promise<any | null> => {
                const table = this.mapping?.bonus ?? {};
                const keys = [`${bonus.bonusName}_${bonus.bonusTo}`, bonus.bonusName, `${bonus.bonusTo}_${bonus.bonusName}`, bonus.bonusTo];
                const key = keys.find(candidate => candidate && table[candidate]);
                if (key) {
                    const uuid = canonicalUuid(table[key]);
                    const doc = uuid ? await shadowdarkAdapter.resolveReadable(uuid, caller) : null;
                    if (doc) return { ...sanitizeItem(doc), uuid };
                    unresolved.push({ category: 'talent', name: bonus.name, reason: `Mapped document ${table[key]} is not available from declared packs you can read.` });
                    return null;
                }
                const named = TALENT_EFFECTS_MAP[bonus.bonusName] ?? TALENT_EFFECTS_MAP[bonus.name];
                if (named) {
                    const uuid = canonicalUuid(named);
                    const doc = uuid ? await shadowdarkAdapter.resolveReadable(uuid, caller) : null;
                    if (doc) return { ...sanitizeItem(doc), uuid };
                }
                return findItem(bonus.bonusName || bonus.name, 'talent');
            };

            const enrichmentContext: EnrichmentContext = {
                addedSourceIds: new Set<string>(),
                addedNames: new Set<string>(),
                targetLevel: json.level || 1,
                actor: null,
                bonuses: json.bonuses || [],
                mapping: this.mapping,
                discoveredItems: [],
                resolveDoc: (uuid: string) => shadowdarkAdapter.resolveReadable(uuid, caller),
                choices: await shadowdarkAdapter.getChoiceCatalog(caller),
            };
            const resolveDoc = (uuid: string) => shadowdarkAdapter.resolveReadable(uuid, caller);

            const stats = json.rolledStats ?? {};
            const actorData: any = {
                name: json.name || 'Unnamed',
                type: 'Player',
                img: 'icons/svg/mystery-man.svg',
                prototypeToken: { name: json.name || 'Unnamed', actorLink: true },
                system: {
                    // PlayerSD attributeModel stores scores as `value`.
                    abilities: Object.fromEntries((['str', 'dex', 'con', 'int', 'wis', 'cha'] as const)
                        .map(key => [key, { value: Number(stats[key.toUpperCase()]) }])),
                    alignment: String(json.alignment || 'neutral').toLowerCase(),
                    attributes: { hp: { value: Number(json.maxHitPoints) || 0, max: Number(json.maxHitPoints) || 0 } },
                    coins: { gp: json.gold || 0, sp: json.silver || 0, cp: json.copper || 0 },
                    level: { value: json.level || 1, xp: json.XP || 0 },
                    languages: [] as string[],
                },
            };
            for (const [key, ability] of Object.entries(actorData.system.abilities) as [string, any][]) {
                if (!Number.isFinite(ability.value)) throw new Error(`The export has no valid ${key.toUpperCase()} score.`);
            }

            const pushSubItems = (items: any[]) => items.forEach(item => (item.type === 'Class Ability' ? classAbilities : talents).push(item));
            const patronName = json.patron || json.bonuses?.find((b: any) => b.sourceCategory === 'Patron' && b.name === 'Patron')?.bonusTo;
            const [ancestry, background, deity, patron] = await Promise.all([
                findItem(json.ancestry, 'ancestry'), findItem(json.background, 'background'),
                json.deity ? findItem(json.deity, 'deity') : Promise.resolve(null),
                patronName ? findItem(patronName, 'patron') : Promise.resolve(null),
            ]);
            if (ancestry) { actorData.system.ancestry = ancestry.uuid; pushSubItems(await resolveSubItems(ancestry, resolveDoc, enrichmentContext)); }
            if (background) { actorData.system.background = background.uuid; pushSubItems(await resolveSubItems(background, resolveDoc, enrichmentContext)); }
            if (deity) { actorData.system.deity = deity.uuid; pushSubItems(await resolveSubItems(deity, resolveDoc, enrichmentContext)); }
            if (patron) { actorData.system.patron = patron.uuid; pushSubItems(await resolveSubItems(patron, resolveDoc, enrichmentContext)); }

            if (json.languages) {
                const names = String(json.languages).split(/\s*,\s*/).filter(Boolean);
                const docs = await Promise.all(names.map(name => findItem(name, 'language')));
                actorData.system.languages = docs.filter(Boolean).map(doc => doc.uuid);
            }

            const classObj = await findItem(json.class, 'class');
            if (classObj) {
                actorData.system.class = classObj.uuid;
                pushSubItems(await resolveSubItems(classObj, resolveDoc, enrichmentContext));
            }

            for (const line of Array.isArray(json.gear) ? json.gear : []) {
                if (line.name === 'Coins') continue;
                const category = line.type === 'sundry' ? 'basic' : String(line.type ?? 'basic');
                const item = await findItem(line.name, category, false);
                if (item) {
                    // Quantities come from the export; no name-based adjustment.
                    if (item.system && line.quantity !== undefined) item.system.quantity = Number(line.quantity);
                    gear.push(item);
                } else {
                    unresolved.push({ category: 'gear', name: line.name, reason: 'No Shadowdark document; can be created as a custom item.' });
                    customGear.push({
                        name: line.name, type: 'Basic', img: 'icons/svg/item-bag.svg',
                        system: {
                            description: `<p>Custom item imported from Shadowdarklings; no matching Shadowdark document.</p>`,
                            quantity: Number(line.quantity) || 1,
                            ...(line.slots !== undefined ? { slots: { slots_used: Number(line.slots), per_slot: 1, free_carry: 0 } } : {}),
                        },
                    });
                }
            }

            for (const treasure of Array.isArray(json.treasures) ? json.treasures : []) {
                customGear.push({
                    name: treasure.name, type: 'Basic', img: 'icons/commodities/treasure/chest-wooden-closed.webp',
                    system: {
                        description: `<p>${escapeHtml(treasure.desc)}</p>`, treasure: true, quantity: 1,
                        ...(treasure.currency && treasure.cost !== undefined ? { cost: { [treasure.currency]: Number(treasure.cost) } } : {}),
                        ...(treasure.slots !== undefined ? { slots: { slots_used: Number(treasure.slots), per_slot: 1, free_carry: 0 } } : {}),
                    },
                });
            }

            for (const magic of Array.isArray(json.magicItems) ? json.magicItems : []) {
                const category = magic.magicItemType === 'magicWeapon' ? 'weapon' : magic.magicItemType === 'magicArmor' ? 'armor' : 'basic';
                let item = await findItem(magic.name, category, false);
                const plus = /^(.*?)\s*\+(\d+)$/.exec(String(magic.name ?? '').trim());
                if (!item && plus && category !== 'basic') {
                    item = await findItem(plus[1], category, false);
                    if (item) {
                        const bonus = Number(plus[2]);
                        item.name = magic.name;
                        item.system = { ...(item.system ?? {}), magicItem: true };
                        if (category === 'weapon') {
                            item.effects = [...(item.effects ?? []),
                                ...(['weaponAttackBonus', 'weaponDamageBonus'] as const).map(key => createEffect(NATIVE_PREDEFINED_EFFECTS[key].label,
                                    NATIVE_PREDEFINED_EFFECTS[key].icon, [{ key: NATIVE_PREDEFINED_EFFECTS[key].key, mode: 2, value: bonus }], { sourceName: 'Imported magic bonus' }))];
                        } else {
                            item.system.ac = { ...(item.system.ac ?? {}), modifier: Number(item.system.ac?.modifier ?? 0) + bonus };
                        }
                    }
                }
                if (item) gear.push(item);
                else unresolved.push({ category: 'magic item', name: magic.name, reason: 'No Shadowdark document or supported "+N" base item.' });
            }

            for (const bonus of Array.isArray(json.bonuses) ? json.bonuses : []) {
                if (/^(ExtraLanguage|ExtraLanguageManual|GrantSpecialTalent):/.test(bonus.name)) continue;
                if (bonus.sourceCategory === 'Patron' && bonus.name === 'Patron') continue;
                if (this.mapping.ignoreTalents?.includes(bonus.name)) continue;
                if (/^Spell:/.test(bonus.name)) {
                    const spell = await findItem(bonus.bonusName, 'spell');
                    const enriched = spell ? await enrichItem(spell, enrichmentContext) : null;
                    if (enriched) spells.push(enriched);
                    continue;
                }
                const talent = await findTalent(bonus);
                if (!talent) continue;
                if (talent.system?.talentClass === 'level' && bonus.gainedAtLevel !== undefined) talent.system.level = bonus.gainedAtLevel;
                try {
                    const enriched = await enrichItem(talent, { ...enrichmentContext, bonusTo: bonus.bonusTo });
                    if (enriched) (enriched.type === 'Class Ability' ? classAbilities : talents).push(enriched);
                } catch (e) {
                    // A choice the export names but declared data cannot satisfy stays unresolved.
                    unresolved.push({ category: 'talent choice', name: `${talent.name}: ${bonus.bonusTo ?? ''}`, reason: getErrorMessage(e) });
                }
            }

            const discovered = enrichmentContext.discoveredItems ?? [];
            // A template whose required choice the export does not supply is never
            // created with its placeholder; it is listed for review instead.
            const nativeItems = [...gear, ...classAbilities, ...spells, ...talents, ...discovered].filter(item => {
                try { assertResolvedTalentChoices([item]); return true; }
                catch (e) { unresolved.push({ category: 'talent choice', name: item.name, reason: getErrorMessage(e) }); return false; }
            });

            // Shadowdarklings max HP includes talent bonuses that native effects
            // re-apply; store the base so the prepared value matches the export.
            const hpFromItems = hpMaxFromItems(nativeItems, actorData.system);
            if (hpFromItems) {
                actorData.system.attributes.hp.max = Math.max(0, actorData.system.attributes.hp.max - hpFromItems);
                warnings.push(`Base max HP stored as ${actorData.system.attributes.hp.max}; imported effects add ${hpFromItems}.`);
            }

            if (unresolved.length && !options.confirm) {
                return { success: false, needsConfirmation: true, unresolved, warnings, debug: debugLog };
            }
            const items = [...nativeItems.map(item => ownedCopy(item)), ...(options.allowCustomGear ? customGear : [])];
            if (!options.allowCustomGear && customGear.length) warnings.push(`${customGear.length} unresolved gear/treasure lines were not created.`);

            const createdActor: any = await runtime.documents.create('Actor', actorData);
            if (!createdActor?._id) throw new Error('Failed to create Actor document');
            let createdItems = 0;
            for (const item of items) {
                try {
                    await runtime.documents.items.create({ type: 'Actor', id: createdActor._id }, item);
                    createdItems++;
                } catch (e) {
                    return {
                        success: false, id: createdActor._id, created: { actor: true, items: createdItems, total: items.length },
                        errors: [`Import partially applied: the Actor and ${createdItems} of ${items.length} items were created. ${getErrorMessage(e)}`],
                        unresolved, warnings, debug: debugLog,
                    };
                }
            }
            log(`Import created ${createdActor._id} with ${createdItems} items.`);
            return { success: true, id: createdActor._id, created: { actor: true, items: createdItems, total: items.length }, unresolved, warnings, debug: debugLog };
        } catch (error: unknown) {
            const message = getErrorMessage(error);
            logger.error('[ShadowdarkImporter] Import failed:', error);
            return { success: false, errors: [message], unresolved, warnings, debug: debugLog };
        }
    }
}
