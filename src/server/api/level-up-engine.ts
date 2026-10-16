import { logger } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { TALENT_HANDLERS } from '../../logic/talent-handlers';
import { resolveBaggage, resolveGear } from './gear-resolver';
import { ROLL_TABLE_FILTER } from '../../data/roll-table-patterns';
import { TableService } from '../../utils/TableService';
import { sanitizeItems } from '../../utils/Sanitizer';
import { applyMasteryChoice, assertResolvedTalentChoices, masteryKind, type ChoiceCatalog } from '../../logic/talent-choices';
import { canonicalUuid, sourceRef, formatUuid, ownedCopy } from '../../logic/identity';

interface RollResultProcessorOptions {
    result: any;
    table: any;
    client?: any;
}

export async function processRollResult({ result, table, client }: RollResultProcessorOptions) {
    return await TableService.processRollResult(client, { result, table });
}

export function getChoices(table: any, sourceResults?: any[]): any[] {
    const results = sourceResults || (table && table.results) || [];
    if (results.length === 0) return [];

    logger.info(`[Engine] processing choices for ${table?.name || 'unknown'} (${results.length} results)`);

    // First map to potential options
    const rawOptions = results
        .filter((r: any) => {
            const name = (r.text || r.name || "").trim().toLowerCase();
            if (!name) return false;

            // Filter out common instruction tokens that shouldn't be choices
            const instructionTokens = [
                "or", "and", "choose", "select", "reroll", "duplicates", "already", "taken", "had"
            ];

            if (instructionTokens.includes(name)) {
                logger.debug(`[Engine] Filtering out instruction token: ${name}`);
                return false;
            }

            // More aggressive regex for "Choose 1" type headers
            const instructionRegex = /(?:choose|select)\s+(?:one|1|two|2|an)\b/i;
            if (instructionRegex.test(name)) {
                logger.debug(`[Engine] Filtering out choice instruction: ${name}`);
                return false;
            }

            // filter out pure numbers (sometimes used for ranges in table results)
            if (/^\d+$/.test(name)) return false;

            return true;
        })
        .map((r: any) => {
            const name = (r.text || r.name || r.description || "").trim();
            const option: any = {
                name: name || "Unknown Option",
                text: name || "Unknown Option",
                type: 'Talent',
                img: r.img || (table ? table.img : ""),
                uuid: r.documentUuid || r.uuid || r._id,
                original: r
            };

            // Match against TALENT_HANDLERS to provide UI triggers
            for (const handler of TALENT_HANDLERS) {
                if (handler.matches(option)) {
                    option.action = handler.action;
                    option.config = handler.config;
                    break;
                }
            }

            return option;
        });

    // Deduplicate
    const uniqueOptions = new Map();
    for (const opt of rawOptions) {
        // Prefer Name for deduplication to avoid "Weapon Mastery" appearing twice with different UUIDs
        // Fallback to UUID if name is empty (unlikely)
        const key = (opt.name || opt.uuid).trim().toLowerCase();
        if (!uniqueOptions.has(key)) {
            uniqueOptions.set(key, opt);
        }
    }

    const finalOptions = Array.from(uniqueOptions.values());
    logger.info(`[Engine] Generated ${finalOptions.length} choice options (from ${rawOptions.length} raw)`);
    return finalOptions;
}

export interface LevelUpState {
    rolledTalents: any[];
    rolledBoons: any[];
    selectedSpells: any[];
    selectedLanguages: string[];
    hpRoll: number | null;
    goldRoll: number | null;
    statSelection: { required: number; selected: string[] };
    statPool: { total: number; allocated: Record<string, number>; talentIndex: number | null };
    weaponMasterySelection: { required: number; selected: string[] };
    armorMasterySelection: { required: number; selected: string[] };
    extraSpellSelection: { active: boolean; maxTier: number; source: string; selected: any[] };
}

/**
 * Calculates advancement requirements based on actor and target level.
 */
export async function calculateAdvancement(actor: any, targetLevel: number, classObj: any) {
    const isOddLevel = targetLevel % 2 !== 0;
    const requiresPatron = Boolean(classObj.system?.patron?.required || classObj.system?.patron?.requiredBoon);

    let requiredTalents = isOddLevel ? 1 : 0;
    let requiredBoons = 0;
    let choiceRolls = 0;

    if (requiresPatron) {
        if (targetLevel === 1) {
            requiredBoons = 1;
            choiceRolls = 0;
            requiredTalents = 0;
        } else if (isOddLevel) {
            choiceRolls = 1;
            requiredBoons = 0;
            requiredTalents = 0;
        } else {
            requiredTalents = 0;
            requiredBoons = 0;
            choiceRolls = 0;
        }
    }

    // Apply Handler Init (e.g. Ambitious talent)
    if (actor && actor.items) {
        for (const handler of TALENT_HANDLERS) {
            if (handler.onInit) {
                const res = handler.onInit({ actor, targetLevel });
                if (res.requiredTalents) requiredTalents += res.requiredTalents;
                if (res.choiceRolls) choiceRolls += res.choiceRolls;
            }
        }
    }

    return {
        requiredTalents,
        requiredBoons,
        choiceRolls,
        needsBoon: requiresPatron
    };
}

/**
 * Validates the level-up state and determines if it's "complete".
 */
export async function validateState(state: LevelUpState, requirements: any, actor?: any) {
    // 1. Talents
    if (state.rolledTalents.length < requirements.requiredTalents) return { valid: false, reason: 'Missing talents' };

    // 2. Boons
    const usedChoices = Math.max(0, state.rolledTalents.length - requirements.requiredTalents) +
        Math.max(0, state.rolledBoons.length - requirements.requiredBoons);
    if (usedChoices < requirements.choiceRolls && (state.rolledBoons.length < requirements.requiredBoons)) {
        // This is a bit simplified, but captures the essence
    }

    if (requirements.needsBoon && (state.rolledBoons.length + state.rolledTalents.length) < (requirements.requiredBoons + requirements.requiredTalents + requirements.choiceRolls)) {
        return { valid: false, reason: 'Missing boons or talents' };
    }

    // 3. HP & Gold
    if (state.hpRoll === null) return { valid: false, reason: 'Missing HP roll' };
    if (requirements.isLevel1 && state.goldRoll === null) return { valid: false, reason: 'Missing Gold roll' };

    // 4. Selections (Weapon/Armor/Stats)
    for (const handler of TALENT_HANDLERS) {
        if (handler.isBlocked && handler.isBlocked(state)) {
            return { valid: false, reason: `Handler ${handler.id} is blocked` };
        }
    }

    return { valid: true };
}

/**
 * Assembles all items for finalization.
 */
export async function assembleFinalItems(state: LevelUpState, targetLevel: number, classObj: any, ancestry?: any, background?: any, patron?: any, client?: any, actor?: any, catalogOverride?: ChoiceCatalog) {
    const catalog = catalogOverride ?? await shadowdarkAdapter.getChoiceCatalog();
    const items: any[] = [];
    // A template UUID identifies a source, not a grant. Each roll is independent;
    // repeated references within one fixed class/ancestry grant are aliases.
    type Origin = { source: 'fixed' | 'rolled' | 'other'; grant: string };
    const origins = new WeakMap<object, Origin>();
    const append = (item: any, source: Origin['source'], grant: string) => {
        origins.set(item, { source, grant });
        items.push(item);
    };
    const baggageNames = new Set<string>();

    // Existing Actor items are matched by recorded source identity, never by name.
    const existingItems = actor?.items || [];
    const existingUuids = new Set(existingItems.map((i: any) => sourceRef(i)).filter(Boolean).map((ref: any) => formatUuid(ref)));
    const isExisting = (uuid: unknown) => { const canonical = canonicalUuid(uuid); return !!canonical && existingUuids.has(canonical); };

    // 1. Process Talents and Boons
    const allRolled = [...state.rolledTalents, ...state.rolledBoons];
    const displacedUuids = new Set<string>();

    for (const [index, rawItem] of allRolled.entries()) {
        // DEEP CLONE: Prevent cache poisoning and ensure mutations stay local to this level-up session
        const item = JSON.parse(JSON.stringify(rawItem));
        
        // Ensure level is set for table-rolled talents
        if (!item.system) item.system = {};
        if (typeof item.system.level === 'undefined' || item.system.level === null) {
            item.system.level = targetLevel;
        }

        // Apply mutations from handlers ONLY if they are active selections
        for (const handler of TALENT_HANDLERS) {
            if (handler.matches(item)) {
                // If handler will resolve separate items, mark this one for displacement
                if (handler.resolveItems && !masteryKind(item)) {
                    const uuid = item.uuid || item.documentUuid;
                    if (uuid) displacedUuids.add(uuid);
                }

                if (handler.mutateItem) {
                    const isSelection = (handler.action === 'stat-selection' && state.statSelection) ||
                                      (handler.action === 'stat-pool' && state.statPool) ||
                                      (handler.action === 'extra-spell' && state.extraSpellSelection);
                    
                    if (isSelection || !handler.action) {
                        handler.mutateItem(item, state);
                    }
                }
            }
        }
        append(item, 'rolled', `rolled:${index}`);
    }

    // 2. Resolve additional items from handlers
    for (const handler of TALENT_HANDLERS) {
        if (handler.resolveItems && !['weapon-mastery', 'armor-mastery'].includes(handler.action ?? '')) {
            const extra = await handler.resolveItems(state, targetLevel, async (uuid: string) => {
                return shadowdarkAdapter.resolveDocument(uuid);
            }, catalog);
            extra.forEach((item, index) => append(item, 'other', `${handler.id}:${index}`));
        }
    }

    // 3. Spells
    for (const spell of [...state.selectedSpells, ...(state.extraSpellSelection?.selected || [])]) {
        const cleaned = { ...spell };
        delete cleaned._id;
        append(cleaned, 'other', `spell:${items.length}`);
    }

    // 4. Baggage (Level 1 / Swap only)
    if (targetLevel === 1) {
        const processBaggageGroup = async (doc: any, resolveFn: any, group: string) => {
            if (!doc) return;
            
            const baggage = await resolveFn(doc, client);
            for (const item of baggage) {
                const uuid = item.uuid || item.documentUuid;
                const name = (item.name || "").trim().toLowerCase();
                
                // Deduplicate against existing actor items to prevent 0 -> 1 duplicates
                if (isExisting(uuid)) {
                    logger.debug(`[LevelUpEngine] Skipping baggage item already on actor: ${item.name}`);
                    continue;
                }

                if (name) baggageNames.add(name);
                append(item, 'fixed', `${group}:${uuid || `${item.type}:${name}`}`);
            }
        };

        if (classObj) {
            // Include the Class item itself IF not already present
            if (!isExisting(classObj.uuid)) {
                 const cleanClass = JSON.parse(JSON.stringify(classObj));
                 delete cleanClass._id;
                 if (classObj.uuid) cleanClass.uuid = classObj.uuid;
                 append(cleanClass, 'other', 'class');
            }

            await processBaggageGroup(classObj, resolveGear, 'class');
            await processBaggageGroup(classObj, resolveBaggage, 'class');
        }
        if (ancestry) {
            // Include the Ancestry item itself IF not already present
            if (!isExisting(ancestry.uuid)) {
                const cleanAncestry = JSON.parse(JSON.stringify(ancestry));
                delete cleanAncestry._id;
                if (ancestry.uuid) cleanAncestry.uuid = ancestry.uuid;
                append(cleanAncestry, 'other', 'ancestry');
            }

            await processBaggageGroup(ancestry, resolveGear, 'ancestry');
            await processBaggageGroup(ancestry, resolveBaggage, 'ancestry');
        }
        if (background) {
            await processBaggageGroup(background, resolveBaggage, 'background');
        }
        if (patron) {
            await processBaggageGroup(patron, resolveBaggage, 'patron');
        }
    }

    // 5. Final pass (Resolution & Categorization)
    const resolvedItems: any[] = [];
    const seenUuids = new Set<string>();
    const seenMasteryGrants = new Set<string>();
    // baggageNames now populated during Baggage pass above

    for (const item of items) {
        const uuid = item.documentUuid || item.uuid || item._id;
        const name = (item.name || "").trim().toLowerCase();

        // DISPLACEMENT CHECK: Skip if this item was displaced by a handler
        if (uuid && displacedUuids.has(uuid)) {
            continue;
        }

        const origin = origins.get(item)!;
        let clean = JSON.parse(JSON.stringify(item));
        const type = String(item.type || "");
        const isShallow = !item.system || Object.keys(item.system).length === 0;
        const needsResolution = (type === 'document' || type === '2' || isShallow) && uuid;

        if (needsResolution) {
            try {
                const doc = await shadowdarkAdapter.resolveDocument(uuid!);
                if (doc) {
                    // DEEP CLONE: Prevent cache poisoning
                    clean = JSON.parse(JSON.stringify(doc));
                    delete clean._id;
                    clean.uuid = uuid!;
                    
                    // Metadata pass: ensure synthetic fields are preserved if they were on the 'stub'
                    // and missing from the cache
                    if (item.system?.talentClass && !clean.system?.talentClass) {
                        if (!clean.system) clean.system = {};
                        clean.system.talentClass = item.system.talentClass;
                    }
                    if (item.system?.level && !clean.system?.level) {
                        if (!clean.system) clean.system = {};
                        clean.system.level = item.system.level;
                    }

                    // Apply mutations again to the resolved document
                    for (const handler of TALENT_HANDLERS) {
                        if (handler.matches(clean) && handler.mutateItem) {
                             const isSelection = (handler.action === 'stat-selection' && state.statSelection) ||
                                               (handler.action === 'stat-pool' && state.statPool) ||
                                               (handler.action === 'extra-spell' && state.extraSpellSelection);
                            
                            if (isSelection || !handler.action) {
                                handler.mutateItem(clean, state);
                            }
                        }
                    }
                }
            } catch (e) {
                logger.error(`[LevelUpEngine] Failed to resolve ${uuid}:`, e);
            }
        }

        // Resolve before deduplication: a shallow template may conceal a required
        // mastery choice. Only the same fixed grant may be collapsed, never two
        // rolled grants or a fixed and rolled grant sharing a source template.
        if (masteryKind(clean)) {
            if (seenMasteryGrants.has(origin.grant)) continue;
            seenMasteryGrants.add(origin.grant);
        } else {
            if (uuid && seenUuids.has(uuid)) continue;
            if (origin.source === 'rolled' && baggageNames.has(name)) {
                const isStacker = name.startsWith('+1') || name.startsWith('+2') || name.includes('improvement');
                if (!isStacker) continue;
            }
            if (uuid) seenUuids.add(uuid);
        }

        // TAGGING: Tag advancements as 'level' if they lack any classification
        // Trust compendium/resolution metadata (talentClass) if it exists.
        // If targetLevel is 0 (Character Generation), we don't default to 'level' 
        // to avoid botching ancestry items resolved during generation.
        const isLevelAdvancement = targetLevel > 0;
        const existsAsRolled = origin.source === 'rolled';
        const existsAsBaggage = origin.source === 'fixed';

        if (isLevelAdvancement && existsAsRolled && !existsAsBaggage && !clean.system?.talentClass) {
            if (!clean.system) clean.system = {};
            clean.system.talentClass = "level";
            logger.debug(`[LevelUpEngine] Defaulted ${clean.name} to 'level' (isRolled: ${existsAsRolled})`);
        }

        resolvedItems.push(clean);
    }

    const required = { weapon: 0, armor: 0 };
    for (const item of resolvedItems) {
        const kind = masteryKind(item);
        if (kind) required[kind]++;
    }
    for (const kind of ['weapon', 'armor'] as const) {
        const selection = kind === 'weapon' ? state.weaponMasterySelection : state.armorMasterySelection;
        if ((selection?.selected?.length ?? 0) !== required[kind]
            || (selection?.required !== undefined && selection.required !== required[kind])) {
            throw new Error(`Choose a valid ${kind} for each mastery grant: ${required[kind]} required choices; refresh stale selections before creating Items.`);
        }
    }
    const selectionsUsed = { weapon: 0, armor: 0 };
    const finalized = resolvedItems.map(item => {
        const kind = masteryKind(item);
        if (!kind) return item;
        const selection = kind === 'weapon' ? state.weaponMasterySelection : state.armorMasterySelection;
        const selected = selection?.selected?.[selectionsUsed[kind]++];
        return applyMasteryChoice(item, selected, kind, catalog);
    });
    assertResolvedTalentChoices(finalized);
    // Created Items record their exact compendium source (Foundry fromCompendium).
    return sanitizeItems(finalized).map(item => ownedCopy(item));
}
