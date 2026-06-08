import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, logger } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';
import { assembleFinalItems } from './level-up-engine';
import * as levelUpEngine from './level-up-engine';
import { TALENT_HANDLERS } from '../../logic/talent-handlers';

/**
 * GET /api/shadowdark/actors/[id]/level-up/data
 * Fetch level-up data for the modal.
 */
export async function handleGetLevelUpData(actorId: string | undefined, req: ModuleServerRequest) {
    logger.info(`[API] handleGetLevelUpData | actorId: ${actorId} | url: ${req.url}`);
    try {
        const url = new URL(req.url, 'http://localhost');
        const classId = url.searchParams.get('classId');
        const patronId = url.searchParams.get('patronId');

        let actor = null;
        if (actorId && actorId !== 'undefined' && actorId !== 'null' && actorId !== 'new') {
            actor = await req.runtime.documents.get('Actor', actorId);
        }

        const data = await shadowdarkAdapter.getLevelUpData(actor, classId || undefined, patronId || undefined);

        return json({ success: true, data });

    } catch (e: unknown) {
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
    try {
        const body = await req.json<any>();
        const { isReroll: _isReroll, classId } = body;

        let hitDie = '1d4';

        // Fetch actor once and reuse for both hit die and speaker override.
        let actor: any = null;
        if (actorId && actorId !== 'new' && actorId !== 'undefined') {
            try {
                actor = await req.runtime.documents.get('Actor', actorId);
                const classItem = actor?.items?.find((i: any) => i.type === 'Class');
                if (classItem?.system?.hitPoints) {
                    hitDie = classItem.system.hitPoints;
                }
            } catch { /* ignore — fallback to 1d4 */ }
        }

        // Fallback: Use classId override if provided (e.g. for Level 1 creation)
        if (hitDie === '1d4' && classId) {
            try {
                const classDoc = await shadowdarkAdapter.resolveDocument(classId);
                if (classDoc?.system?.hitPoints) {
                    hitDie = classDoc.system.hitPoints;
                }
            } catch (err) {
                logger.error(`[API] Error fetching class doc:`, err);
            }
        }

        // Sanitize hitDie to a proper dice formula
        const str = String(hitDie).trim();
        if (/^\d+$/.test(str)) {
            hitDie = `1d${str}`;          // "4" -> "1d4"
        } else if (/^d\d+$/i.test(str)) {
            hitDie = `1${str}`;           // "d6" -> "1d6"
        }

        // Build speaker override from the already-fetched actor (or session for new chars).
        let speakerOverride: Record<string, unknown> | undefined = undefined;
        if (actor) {
            speakerOverride = { actor: actor._id || actor.id, alias: actor.name };
        } else if (req.userSession?.username) {
            speakerOverride = { alias: req.userSession.username };
        }

        // Roll + post via the runtime; the structured result carries the total.
        const result = await req.runtime.rolls.roll(hitDie, 'Hit Point Roll (Level Up)', {
            displayChat: true,
            speaker: speakerOverride,
        });

        // Shadowdark Rule: Minimum 1 HP gain
        const total = Math.max(1, result.total || 0);

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

        return json({ success: true, roll: { total: result.total } });
    } catch (e: unknown) {
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

        if (!tableUuidOrName) {
            return error('validation', 'tableUuidOrName is required');
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
            const result = await shadowdarkAdapter.drawTable(tableUuidOrName);
            if (!result) {
                return error('not_found', `RollTable not found: ${tableUuidOrName}`);
            }

            finalRollResult = result;
            const processed = await levelUpEngine.processRollResult({
                result,
                table: result.table
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
    try {
        const body = await req.json<any>();
        const { gold } = body;

        logger.info(`[API] Finalizing Level Up for ${actorId} -> Level ${body.targetLevel || 'Unknown'}`);

        let actor: any = null;
        if (actorId && actorId !== 'new') {
            actor = await req.runtime.documents.get('Actor', actorId);
            if (!actor) return error('not_found', 'Actor not found');
        }

        // Backend assembly and validation
        const classObj = body.classObj || (body.classUuid ? (await shadowdarkAdapter.resolveDocument(body.classUuid)) : null);
        const ancestry = body.ancestryObj || (body.ancestryUuid ? (await shadowdarkAdapter.resolveDocument(body.ancestryUuid)) : null);
        const background = body.backgroundObj || (body.backgroundUuid ? (await shadowdarkAdapter.resolveDocument(body.backgroundUuid)) : null);
        const patron = body.patronObj || (body.patronUuid ? (await shadowdarkAdapter.resolveDocument(body.patronUuid)) : null);

        const state = {
            rolledTalents: body.rolledTalents || [],
            rolledBoons: body.rolledBoons || [],
            selectedSpells: body.selectedSpells || [],
            selectedLanguages: body.languages || [],
            hpRoll: body.hpRoll,
            goldRoll: gold,
            statSelection: body.statSelection || { required: 0, selected: [] },
            statPool: body.statPool || { total: 0, allocated: {}, talentIndex: null },
            weaponMasterySelection: body.weaponMasterySelection || { required: 0, selected: [] },
            armorMasterySelection: body.armorMasterySelection || { required: 0, selected: [] },
            extraSpellSelection: body.extraSpellSelection || { active: false, maxTier: 0, source: '', selected: [] }
        };

        const targetLevel = body.targetLevel || (actor?.system?.level?.value || 0) + 1;

        // Assembly (the engine's resolution is runtime-backed via the adapter; the legacy
        // `client` arg is unused).
        const finalItems = await assembleFinalItems(state, targetLevel, classObj, ancestry, background, patron, undefined, actor);

        const actorUpdates: any = {};
        if (actor && actorId !== 'new') {
            if (state.hpRoll !== undefined && state.hpRoll !== null) {
                const currentMax = actor.system?.attributes?.hp?.max || 0;
                const currentVal = actor.system?.attributes?.hp?.value || 0;
                actorUpdates['system.attributes.hp.max'] = currentMax + state.hpRoll;
                actorUpdates['system.attributes.hp.value'] = currentVal + state.hpRoll;
            }

            actorUpdates['system.level.value'] = targetLevel;
            actorUpdates['system.level.xp'] = 0;

            if (gold !== undefined && gold !== null) {
                const currentCoins = actor.system?.coins?.gp || 0;
                actorUpdates['system.coins.gp'] = currentCoins + gold;
            }

            if (state.selectedLanguages && Array.isArray(state.selectedLanguages)) {
                const currentLangs = actor.system?.languages || [];
                const newLangs = Array.from(new Set([...currentLangs, ...state.selectedLanguages]));
                actorUpdates['system.languages'] = newLangs;
            }

            if (patron) {
                const patronUuid = patron.uuid || body.patronUuid;
                actorUpdates['system.patron'] = patronUuid;
                actorUpdates['system.patronUuid'] = patronUuid;
            }

            if (targetLevel === 1) {
                if (classObj) {
                    actorUpdates['system.class'] = classObj.uuid || body.classUuid;
                }
                if (ancestry) {
                    actorUpdates['system.ancestry'] = ancestry.uuid || body.ancestryUuid;
                }
            }

            if (Object.keys(actorUpdates).length > 0) {
                logger.info(`[API] Updating actor ${actorId} with: ${JSON.stringify(actorUpdates)}`);
                await req.runtime.documents.patch('Actor', actorId, actorUpdates);
            }

            if (finalItems.length > 0) {
                logger.info(`[API] Creating ${finalItems.length} items for actor ${actorId}`);
                for (const item of finalItems) {
                    await req.runtime.documents.items.create({ type: 'Actor', id: actorId }, item);
                }
            }
        }

        return json({
            success: true,
            actorId,
            items: finalItems,
            updates: actorUpdates,
            hpRoll: state.hpRoll,
            goldRoll: gold
        });

    } catch (e: unknown) {
        logger.error('[API] Finalize Level-Up Error:', e);
        return error('internal', getErrorMessage(e) || 'Failed to finalize level-up');
    }
}
