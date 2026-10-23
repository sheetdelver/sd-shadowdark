import { createHash } from 'node:crypto';
import { creationGrantReview } from '../../logic/creation-grants';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, isSdkError, logger, SdkError } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { assembleFinalItems } from './level-up-engine';
import * as levelUpEngine from './level-up-engine';
import { TALENT_HANDLERS } from '../../logic/talent-handlers';
import { canonicalUuid, sourceRef, formatUuid, parseUuid } from '../../logic/identity';
import { statChoiceRule } from '../../logic/stat-choices';
import { callerOf, requestRules, requestRevision, contextConflict, requireOwnedActor } from '../access';
import { hitPointRollFormula } from '../../logic/actions';
import { prepareActorCore } from '../../logic/actor-preparation';
import { advancementHitPoints } from '../../logic/advancement';
import { knownSpellSources, advancementSpellChoices, grantedSpellSources, prepareSpellModel, spellListIdentity } from '../../logic/spell-model';
import { callerLanguagePlan } from '../languages';
import { validateLanguageSelections } from '../../logic/languages';
import { spellReview } from '../../logic/spell-review';
import { withActorLock } from '../operation-lock';
import { pendingAdvancement, resumeAdvancement } from '../advancement-operation';

/**
 * Rolled talents/boons and chosen spells are re-read from their exact source.
 * Selection wrappers produced by table handlers (stat choices) keep only
 * name/type/system metadata; their effects are rebuilt by the server handlers.
 */
async function verifyGrants(body: any, classObj: any, req: ModuleServerRequest) {
    for (const value of [body.rolledTalents, body.rolledBoons, body.selectedSpells, body.extraSpellSelection?.selected]) {
        if (value != null && (!Array.isArray(value) || value.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry))))
            throw new SdkError('validation', 'Advancement selections must be arrays of exact source selections.');
    }
    for (const selection of [body.weaponMasterySelection, body.armorMasterySelection, body.spellAdvantageSelection, body.statSelection]) {
        if (selection != null && (!selection || typeof selection !== 'object' || Array.isArray(selection)
            || !Array.isArray(selection.selected) || selection.selected.some((value: unknown) => typeof value !== 'string')
            || (selection.required !== undefined && (!Number.isInteger(selection.required) || selection.required < 0)))) {
            throw new SdkError('validation', 'Talent choices must contain a count and a list of selected options.');
        }
    }
    const resolveGrant = async (entry: any, allowed: string[]) => {
        const uuid = canonicalUuid(entry?.documentUuid ?? entry?.uuid);
        if (uuid) {
            const doc = await shadowdarkAdapter.resolveDocumentFor(uuid, callerOf(req));
            if (!doc) throw new SdkError('validation', `${entry?.name || uuid} is not available.`);
            // RollTables have a document kind, not an Item subtype. Only a
            // supported distribution instruction can become a Talent wrapper.
            if (parseUuid(uuid)?.documentType === 'RollTable' && statChoiceRule(doc))
                return { name: doc.name, type: 'Talent', uuid, system: { ...(entry?.system ?? {}) }, effects: [] };
            if (!allowed.includes(doc.type)) throw new SdkError('validation', `${doc.name} is a ${doc.type}, not ${allowed.join('/')}.`);
            return { ...doc, uuid, system: { ...(doc.system ?? {}), ...(entry?.system?.level !== undefined ? { level: entry.system.level } : {}),
                ...(entry?.system?.talentClass ? { talentClass: entry.system.talentClass } : {}) } };
        }
        if (TALENT_HANDLERS.some(handler => handler.action === 'extra-spell' && handler.matches(entry))) throw new SdkError('validation', 'An extra spell choice requires its exact native granting Talent source.');
        // Module table markers ("Patron Boon", "Choose One") are instructions, not grants.
        if (['PatronBoon', 'PatronBoonTwice', 'synthetic'].includes(entry?.type)
            && !TALENT_HANDLERS.some(handler => handler.action && handler.matches(entry))) return null;
        if (!TALENT_HANDLERS.some(handler => handler.action && handler.matches(entry))) {
            throw new SdkError('validation', `${entry?.name || 'A rolled result'} has no source document and no supported selection.`);
        }
        return { name: entry.name ?? entry.text, type: 'Talent', system: { ...(entry?.system ?? {}) }, effects: [] };
    };
    const classUuid = spellListIdentity(classObj, classObj?.uuid);
    const resolveSpell = async (entry: any, requireClass: boolean) => {
        const uuid = canonicalUuid(entry?.uuid);
        if (!uuid) throw new SdkError('validation', `${entry?.name || 'A selected spell'} has no source reference.`);
        const doc = await shadowdarkAdapter.resolveDocumentFor(uuid, callerOf(req));
        if (!doc || doc.type !== 'Spell') throw new SdkError('validation', `${entry?.name || uuid} is not an available Spell.`);
        if (requireClass && (!classUuid || !(doc.system?.class ?? []).some((value: unknown) => canonicalUuid(value) === classUuid))) {
            throw new SdkError('validation', `${doc.name} is not on the exact Class spell list.`);
        }
        return { ...doc, uuid };
    };
    return {
        rolledTalents: (await Promise.all((body.rolledTalents ?? []).map((entry: any) => resolveGrant(entry, ['Talent'])))).filter(Boolean),
        rolledBoons: (await Promise.all((body.rolledBoons ?? []).map((entry: any) => resolveGrant(entry, ['Boon', 'Talent'])))).filter(Boolean),
        selectedSpells: await Promise.all((body.selectedSpells ?? []).map((entry: any) => resolveSpell(entry, true))),
        extraSpells: await Promise.all((body.extraSpellSelection?.selected ?? []).map((entry: any) => resolveSpell(entry, false))),
    };
}

function requirePositiveRollTotal(value: unknown, label: string): number {
    const total = Number(value);
    if (!Number.isFinite(total) || total <= 0) {
        throw new Error(`${label} did not return a valid total`);
    }
    return total;
}

/**
 * GET /api/shadowdark/actors/[id]/level-up/data
 * Fetch level-up data for the modal.
 */
export async function handleGetLevelUpData(actorId: string | undefined, req: ModuleServerRequest) {
    const world = req.runtime.world?.snapshot().identity;
    // Retirement must not race a write-ahead receipt or an in-flight grant.
    // Use the same Actor queue as finalization, including read-only reviews.
    if (actorId && !['undefined', 'null', 'new'].includes(actorId))
        return withActorLock(world ? `${world.instanceId}:${world.worldId}:${actorId}` : `${shadowdarkAdapter.runtimeGeneration}:${actorId}`, () => getLevelUpData(actorId, req));
    return getLevelUpData(actorId, req);
}
async function getLevelUpData(actorId: string | undefined, req: ModuleServerRequest) {
    logger.info(`[API] handleGetLevelUpData | actorId: ${actorId} | url: ${req.url}`);
    try {
        const url = new URL(req.url, 'http://localhost');
        const classId = url.searchParams.get('classId');
        const patronId = url.searchParams.get('patronId');

        let actor = null;
        if (actorId && actorId !== 'undefined' && actorId !== 'null' && actorId !== 'new') {
            actor = await requireOwnedActor(req.runtime, actorId);
        }

        const pending = actor ? await pendingAdvancement(req, actor) : null;
        if (pending) return json({ success: true, data: { advancementOperation: pending, progressionReady: false } });
        const data = await shadowdarkAdapter.getLevelUpData(actor, classId || undefined, patronId || undefined, callerOf(req));

        return json({ success: true, data: { ...data, advancementOperation: actor ? await pendingAdvancement(req, actor) : null } });

    } catch (e: unknown) {
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error('[API] Level-Up Data Error:', e);
        return error('internal', getErrorMessage(e) || 'Failed to fetch level-up data');
    }
}

/**
 * POST /api/shadowdark/actors/[id]/level-up/roll-hp
 * Roll HP for level-up.
 */
export async function handleRollHP(actorId: string | undefined, req: ModuleServerRequest) {
    logger.info(`[API] handleRollHP called for actorId: ${actorId}`);
    const revision = requestRevision(req.runtime);
    try {
        const body = await req.json<any>();
        const { isReroll: _isReroll, classId } = body;

        const actor = actorId && !['new','undefined','null'].includes(actorId) ? await requireOwnedActor(req.runtime, actorId) : null;
        const reference = canonicalUuid(classId || actor?.system?.class);
        if (actor?.system?.level?.value > 0 && classId && reference !== canonicalUuid(actor.system?.class)) return error('validation', 'HP advancement must use the Actor’s exact Class.');
        let hitDie = '1d4'; // native level-zero Generator die, only without a Class
        if (classId || actor?.system?.class) {
            if (!reference) return error('validation', 'HP advancement requires an exact Class reference.');
            const classDoc = await shadowdarkAdapter.resolveDocumentFor(reference, callerOf(req));
            const source = classDoc?.system?.hitPoints;
            if (classDoc?.type !== 'Class' || typeof source !== 'string' || !/^(?:1)?d[1-9]\d*$/i.test(source)) return error('validation', 'The exact Class hit die is unavailable or unsupported; no die was inferred from an owned copy.');
            hitDie = /^d/i.test(source) ? `1${source}` : source;
        } else if (actor?.system?.level?.value > 0) return error('validation', 'The Actor has no exact Class for its HP roll.');

        // Native LevelUpSD applies system.roll.hp.advantage to the hit die (e.g. Stout).
        const prepared = hitPointRollFormula(actor ? prepareActorCore(actor, shadowdarkAdapter.lookups(), requestRules(req.runtime)) : null, hitDie);
        hitDie = prepared.formula;

        // Build speaker override from the already-fetched actor (or session for new chars).
        let speakerOverride: Record<string, unknown> | undefined = undefined;
        if (actor) {
            speakerOverride = { actor: actor._id || actor.id, alias: actor.name };
        } else if (req.userSession?.username) {
            speakerOverride = { alias: req.userSession.username };
        }

        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        // Roll + post via the runtime; the structured result carries the total.
        const result = await req.runtime.rolls.roll(hitDie, 'Hit Point Roll (Level Up)', {
            displayChat: true,
            speaker: speakerOverride,
        });

        // A hit-die roll cannot be zero. Fail visibly if the SDK contract is broken
        // instead of silently turning a missing result into one hit point.
        const total = Math.max(1, requirePositiveRollTotal(result.total, 'Hit point roll'));

        return json({
            success: true,
            formula: hitDie,
            total: total,
            roll: {
                total,
                formula: hitDie,
                isReroll: _isReroll || false
            }
        });

    } catch (e: unknown) {
        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error('[API] Roll HP Error:', e);
        return error('internal', getErrorMessage(e) || 'Failed to roll HP');
    }
}

export async function handleRollGold(actorId: string | undefined, req: ModuleServerRequest) {
    // Shadowdark Standard Gold: 2d6 * 5
    const formula = `2d6 * 5`;

    try {
        // Determine speaker override
        let speakerOverride: Record<string, unknown> | undefined = undefined;
        if (actorId && actorId !== 'new') {
            try {
                const actor = await req.runtime.documents.get('Actor', actorId);
                if (actor) {
                    speakerOverride = { actor: actor._id || actor.id, alias: actor.name };
                }
            } catch (e) {
                logger.warn(`[API] Could not fetch actor for speaker: ${e}`);
            }
        } else if (req.userSession?.username) {
            // New character (generator): use player's name from the session
            speakerOverride = { alias: req.userSession.username };
        }

        const result = await req.runtime.rolls.roll(formula, 'Starting Gold Roll', {
            displayChat: true,
            speaker: speakerOverride,
        });

        return json({ success: true, roll: { total: requirePositiveRollTotal(result.total, 'Starting gold roll') } });
    } catch (e: unknown) {
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error("Gold Roll Failed", e);
        return error('internal', getErrorMessage(e));
    }
}

/**
 * POST /api/shadowdark/actors/[id]/level-up/roll-talent
 */
export async function handleRollTalent(actorId: string | undefined, req: ModuleServerRequest) {
    try {
        const body = await req.json<any>();
        const { tableUuidOrName, targetLevel } = body;
        const tableUuid = canonicalUuid(tableUuidOrName);

        if (!tableUuid) {
            return error('validation', 'A RollTable UUID is required; table names are not resolved.');
        }

        // Pre-fetch actor items if checking for duplicates
        const existingTalentNames = new Set<string>();
        if (actorId && actorId !== 'new') {
            try {
                const actor = await req.runtime.documents.get('Actor', actorId) as any;
                if (actor && actor.items) {
                    actor.items.forEach((i: any) => {
                        if (i.type === 'Talent' || i.type === 'Boon') {
                            existingTalentNames.add(i.name.toLowerCase().trim());
                        }
                    });
                }
            } catch (e) {
                logger.warn(`[API] Could not fetch actor items for duplicate check: ${e}`);
            }
        }

        const instructionRegex = /\breroll\b|\balready\s+taken\b|\balready\s+had\b/i;

        let attempts = 0;
        const maxAttempts = 5;
        let finalRollResult = null;
        let item = null;
        let needsChoice = false;
        let choiceOptions: any[] = [];
        let choiceCount = 1;
        let action = undefined;
        let config = undefined;

        while (attempts < maxAttempts) {
            attempts++;
            const result = await shadowdarkAdapter.drawTable(tableUuid, callerOf(req));
            if (!result) {
                return error('not_found', `RollTable not available: ${tableUuid}`);
            }

            finalRollResult = result;
            const processed = await levelUpEngine.processRollResult({
                result,
                table: result.table,
                caller: callerOf(req),
            });

            item = processed.item;
            needsChoice = processed.needsChoice;
            choiceOptions = processed.choiceOptions;
            choiceCount = processed.choiceCount || 1;
            action = processed.action;
            config = processed.config;

            if (needsChoice) break; // Choices are filtered in getChoices()

            if (item) {
                const itemName = (item.name || item.text || item.description || "").toLowerCase().trim();

                // Check for reroll instruction
                if (instructionRegex.test(itemName)) {
                    logger.info(`[API] Explicit reroll instruction hit: "${itemName}". Attempt ${attempts}/${maxAttempts}`);
                    continue;
                }

                // Check for duplicate
                if (existingTalentNames.has(itemName)) {
                    logger.info(`[API] Duplicate talent hit: "${itemName}". Attempt ${attempts}/${maxAttempts}`);
                    continue;
                }

                // Valid non-duplicate item
                break;
            } else {
                logger.info(`[API] Empty or instruction result. Attempt ${attempts}/${maxAttempts}`);
                continue;
            }
        }

        if (item) {
            // Apply mutation handlers
            for (const handler of TALENT_HANDLERS) {
                if (handler.matches(item)) {
                    // check for onRoll side effects that might force a choice
                    if (handler.onRoll) {
                        const block = handler.onRoll({ item, targetLevel });
                        if (block === true) {
                            needsChoice = true;
                            // If handler forces choice but we don't have options yet, fetch them
                            if (!choiceOptions || choiceOptions.length === 0) {
                                choiceOptions = finalRollResult ? levelUpEngine.getChoices(finalRollResult.table) : [];
                            }
                        }
                    }
                }
            }

            // Normalize Name (Frontend expects .name)
            if (!item.name && (item.text || item.description)) {
                item.name = item.text || item.description;
            }
        }

        return json({
            success: true,
            roll: finalRollResult?.total,
            formula: finalRollResult?.formula,
            item: item,
            needsChoice,
            choiceOptions,
            choiceCount,
            action,
            config
        });

    } catch (e: unknown) {
        if (isSdkError(e)) return error(e.code, e.message);
        logger.error('[API] Roll Talent Error:', e);
        return error('internal', getErrorMessage(e) || 'Failed to roll talent');
    }
}

/**
 * POST /api/shadowdark/actors/[id]/level-up/roll-boon
 */
export async function handleRollBoon(actorId: string | undefined, req: ModuleServerRequest) {
    // Similar to talent but for boons
    return handleRollTalent(actorId, req);
}

/**
 * POST /api/shadowdark/actors/[id]/level-up/finalize
 * Finalize level-up and apply changes.
 */
export async function handleFinalizeLevelUp(actorId: string, req: ModuleServerRequest) {
    const world = req.runtime.world?.snapshot().identity;
    return withActorLock(world ? `${world.instanceId}:${world.worldId}:${actorId}` : `${shadowdarkAdapter.runtimeGeneration}:${actorId}`, () => finalizeLevelUp(actorId, req));
}
/** Reused at the final creation boundary; this path prepares and validates, never writes. */
export function prepareCharacterCreation(req: ModuleServerRequest, choices: any) {
    return finalizeLevelUp('new', req, choices);
}
async function finalizeLevelUp(actorId: string, req: ModuleServerRequest, input?: any) {
    const revision = requestRevision(req.runtime);
    let noWrites = !actorId || actorId === 'new';
    const rejected = (response: ReturnType<typeof error>) => noWrites
        ? { ...response, json: async () => ({ ...await response.json() as Record<string, unknown>, advancementWrites: 'none' }) }
        : response;
    const reject = (...args: Parameters<typeof error>) => rejected(error(...args));
    try {
        const body = input ?? await req.json<any>();
        const { gold } = body;

        logger.info(`[API] Finalizing Level Up for ${actorId} -> Level ${body.targetLevel || 'Unknown'}`);

        let actor: any = null;
        if (actorId && actorId !== 'new') {
            actor = await requireOwnedActor(req.runtime, actorId);
            const replay = body.requestId ? await resumeAdvancement(req, actor, body, revision) : null;
            if (replay) return replay;
            noWrites = true; // No saved request exists; all following checks are preflight.
        }

        // Server assembly resolves every source by exact identity through the
        // caller; client-supplied document bodies never establish identity.
        const resolveTyped = async (uuid: unknown, type: string) => {
            if (uuid === undefined || uuid === null || uuid === '') return null;
            const doc = await shadowdarkAdapter.resolveDocumentFor(String(uuid), callerOf(req));
            if (!doc || doc.type !== type) throw new SdkError('validation', `${type} ${String(uuid)} is not available.`);
            return { ...doc, uuid: canonicalUuid(uuid) ?? doc.uuid };
        };
        const classObj = await resolveTyped(body.classUuid ?? actor?.system?.class, 'Class');
        if (!classObj) return reject('validation', 'An exact readable Class is required before advancement.');
        const ancestry = await resolveTyped(body.ancestryUuid, 'Ancestry');
        const background = await resolveTyped(body.backgroundUuid, 'Background');
        const patron = await resolveTyped(body.patronUuid, 'Patron');
        const verified = await verifyGrants(body, classObj, req);

        const state = {
            rolledTalents: verified.rolledTalents,
            rolledBoons: verified.rolledBoons,
            selectedSpells: verified.selectedSpells,
            selectedLanguages: body.languages || [],
            hpRoll: body.hpRoll,
            goldRoll: gold,
            statChoices: body.statChoices,
            statSelection: body.statSelection || { required: 0, selected: [] },
            statPool: body.statPool || { total: 0, allocated: {}, talentIndex: null },
            weaponMasterySelection: body.weaponMasterySelection || { required: 0, selected: [] },
            armorMasterySelection: body.armorMasterySelection || { required: 0, selected: [] },
            spellAdvantageSelection: body.spellAdvantageSelection || { required: 0, selected: [] },
            extraSpellSelection: { ...(body.extraSpellSelection || { active: false, maxTier: 0, source: '' }), selected: verified.extraSpells }
        };

        const targetLevel = body.targetLevel || (actor?.system?.level?.value || 0) + 1;
        const currentLevel = actor?.system?.level?.value ?? 0;
        if (!Number.isInteger(targetLevel) || targetLevel !== currentLevel + 1) return reject('validation', 'Advancement must be exactly one level.');
        if (actor && currentLevel > 0 && canonicalUuid(actor.system?.class) !== canonicalUuid(classObj?.uuid)) return reject('validation', 'Advancement must keep the Actor’s exact Class identity.');

        // Assembly: compendium sources are limited to the caller's readable packs.
        const finalItems = await assembleFinalItems(state, targetLevel, classObj, ancestry, background, patron, callerOf(req), actor);

        const extraGrants = finalItems.filter(item => ['Talent','Boon'].includes(item.type) && TALENT_HANDLERS.some(handler => handler.action === 'extra-spell' && handler.matches(item)));
        if (verified.extraSpells.length !== extraGrants.length) return reject('validation', `Native granting talents require exactly ${extraGrants.length} extra spell choice(s).`);
        if (new Set(verified.extraSpells.map((spell: any) => spell.uuid)).size !== verified.extraSpells.length) return reject('validation', 'Extra spell choices must identify distinct exact sources.');
        // Evaluate actual/planned native grants, then validate every tier before
        // HP, XP, language or embedded Item writes. Empty catalogs cannot waive it.
        const planned = { ...(actor ?? { type: 'Player', items: [], effects: [] }),
            system: { ...(actor?.system ?? {}), class: classObj?.uuid ?? actor?.system?.class },
            items: [...(actor?.items ?? []), ...finalItems] };
        const lookups = await shadowdarkAdapter.callerLookups(planned, callerOf(req));
        const core = prepareActorCore(planned, lookups, requestRules(req.runtime));
        const casting = 'classes' in core.spellcasting && core.spellcasting.classes.length > 0;
        const choices = classObj?.system?.spellcasting?.ability ? advancementSpellChoices(classObj, currentLevel, targetLevel) : { required: {} as Record<number, number>, diagnostics: [] };
        if (classObj?.system?.spellcasting?.ability && !casting) return reject('validation', 'Missing casting grant; review the exact Class talents before advancing.');
        if (classObj?.system?.spellcasting?.ability && !prepareSpellModel(planned, core, lookups).sources.length) return reject('validation', 'The Actor’s active grant does not match its exact spell-list Class.');
        if (choices.diagnostics.length) return reject('validation', choices.diagnostics.join(' '));
        const selected = state.selectedSpells;
        const identities = selected.map((spell: any) => canonicalUuid(spell.uuid));
        const innate = grantedSpellSources(planned.items);
        const known = knownSpellSources(actor?.items ?? []);
        if ([...identities, ...verified.extraSpells.map((spell: any) => canonicalUuid(spell.uuid))].some(uuid => uuid && known.has(uuid)))
            return reject('validation', 'Choose a spell this character does not already know.');
        if (verified.extraSpells.some((spell: any) => identities.includes(canonicalUuid(spell.uuid)) || innate.has(spell.uuid)))
            return reject('validation', 'Extra spells must be distinct from required ordinary choices and fixed granted spells.');
        if (identities.some((uuid: string | null) => uuid && innate.has(uuid))) return reject('validation', 'Granted spells do not fill required ordinary spell choices.');
        if (new Set(identities).size !== identities.length) return reject('validation', 'A required spell source may be selected only once.');
        if (selected.some((spell: any) => !Number.isInteger(spell.system?.tier) || spell.system.tier < 1 || spell.system.tier > 5)) return reject('validation', 'Selected spell has an invalid native tier.');
        for (let tier = 1; tier <= 5; tier++) {
            const count = selected.filter((spell: any) => spell.system.tier === tier).length;
            if (count !== (choices.required[tier] ?? 0)) return reject('validation', `Tier ${tier} requires exactly ${choices.required[tier] ?? 0} new spell(s); received ${count}.`);
        }
        if (targetLevel === 1) {
            // Existing level-zero ancestry languages are inventory, not another
            // ancestry choice. A new Generator request supplies both pools.
            const existing = Array.isArray(actor?.system?.languages) ? actor.system.languages : [];
            const plan = await callerLanguagePlan(callerOf(req), actor ? null : ancestry, classObj, existing);
            const languages = validateLanguageSelections(plan, body.languageChoices, existing);
            if (!languages.valid) return reject('validation', languages.errors.join(' '));
            if (!Array.isArray(state.selectedLanguages) || state.selectedLanguages.some((uuid: string) => !languages.languages.includes(uuid)))
                return reject('validation', 'Language additions must come from the reviewed native choice pools.');
            state.selectedLanguages = languages.languages;
        } else {
            const existing = Array.isArray(actor?.system?.languages) ? actor.system.languages : [];
            if (state.selectedLanguages.some((uuid: string) => !existing.includes(uuid))) return reject('validation', 'This advancement grants no language choices. Edit ordinary inventory separately.');
            state.selectedLanguages = existing;
        }
        const conflict = contextConflict(req.runtime, revision); if (conflict) return rejected(conflict);
        if (actor) {
            const fresh = await req.runtime.documents.get('Actor', actorId, { minOwnership: 'owner' });
            if (!fresh || spellReview(fresh) !== spellReview(actor)) return reject('conflict', 'Actor source changed during advancement review. Refresh before applying any writes.');
        }

        const actorUpdates: any = {};
        if (actor && actorId !== 'new') {
            if (state.hpRoll !== undefined && state.hpRoll !== null) {
                // Native adds grants before calculating HP. Prepare their effects
                // without writing so an unresolved choice still cannot mutate data.
                const prepared = prepareActorCore({ ...actor, items: [...(actor.items ?? []), ...finalItems] },
                    lookups, requestRules(req.runtime));
                const hp = advancementHitPoints(prepared, targetLevel, state.hpRoll);
                actorUpdates['system.attributes.hp.max'] = hp.max;
                actorUpdates['system.attributes.hp.value'] = hp.value;
            }

            actorUpdates['system.level.value'] = targetLevel;
            // Native 4.0.6 LevelUpSD._finalizeLevelUp spends the current level's
            // XP threshold and carries the remainder; level zero starts fresh.
            actorUpdates['system.level.xp'] = actor.system.level.value > 0
                ? actor.system.level.xp - actor.system.level.value * 10
                : 0;

            if (gold !== undefined && gold !== null) {
                const currentCoins = actor.system?.coins?.gp || 0;
                actorUpdates['system.coins.gp'] = currentCoins + gold;
            }

            if (state.selectedLanguages && Array.isArray(state.selectedLanguages)) {
                const currentLangs = actor.system?.languages || [];
                const newLangs = Array.from(new Set([...currentLangs, ...state.selectedLanguages]));
                actorUpdates['system.languages'] = newLangs;
            }

            if (patron) actorUpdates['system.patron'] = patron.uuid;

            if (targetLevel === 1) {
                if (classObj) actorUpdates['system.class'] = classObj.uuid;
                if (ancestry) actorUpdates['system.ancestry'] = ancestry.uuid;
            }

            const dependencies = [classObj?.uuid, ancestry?.uuid, background?.uuid, patron?.uuid,
                ...finalItems.flatMap(item => { const ref = sourceRef(item); return ref ? [formatUuid(ref)] : []; }),
                ...finalItems.flatMap(item => item.type === 'Spell' ? item.system?.class ?? [] : [])].filter(Boolean);
            noWrites = false;
            const applied = await resumeAdvancement(req, actor, body, revision, { items: finalItems, patch: actorUpdates, dependencies,
                result: { actorId, targetLevel, updates: actorUpdates, hpRoll: state.hpRoll, goldRoll: gold, languages: state.selectedLanguages } });
            return applied ?? error('internal', 'Advancement plan could not be recorded.');
        }

        return json({
            success: true,
            actorId,
            creationPlan: { choices: body, contextRevision: revision, review: createHash('sha256').update(creationGrantReview(finalItems)).digest('hex') },
            items: finalItems,
            updates: actorUpdates,
            hpRoll: state.hpRoll,
            goldRoll: gold,
            languages: state.selectedLanguages
        });

    } catch (e: unknown) {
        const conflict = contextConflict(req.runtime, revision); if (conflict) return rejected(conflict);
        if (isSdkError(e)) return reject(e.code, e.message);
        logger.error('[API] Finalize Level-Up Error:', e);
        return reject('internal', getErrorMessage(e) || 'Failed to finalize level-up');
    }
}
