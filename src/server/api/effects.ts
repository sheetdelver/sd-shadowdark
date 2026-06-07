import type { ModuleRequestRuntime } from '@sheet-delver/sdk/server';
import { SYSTEM_PREDEFINED_EFFECTS } from '../../data/talent-effects';

type EffectLike = Record<string, unknown> & {
    _id?: string;
    id?: string;
    name?: string;
    label?: string;
    sourceName?: string;
    source?: string;
    origin?: string;
    statuses?: string[];
    flags?: {
        core?: {
            statusId?: string;
        };
    };
};

type ItemWithEffects = Record<string, unknown> & {
    _id?: string;
    id?: string;
    name?: string;
    effects?: EffectLike[];
};

type ActorWithEffects = {
    effects?: EffectLike[];
    items?: ItemWithEffects[];
};

/**
 * Build the normalized effects array that the UI expects.
 * Derived from the static SYSTEM_PREDEFINED_EFFECTS map — no network call needed.
 */
const PREDEFINED_EFFECTS_LIST = Object.entries(SYSTEM_PREDEFINED_EFFECTS).map(([id, data]) => ({
    id,
    name: data.label,
    label: data.label,
    img: data.icon,
    effectKey: (data as any).key || null,
    defaultValue: (data as any).value ?? null,
    mode: (data as any).mode ?? null,
    changes: (data as any).changes || null,
}));

/**
 * Handles all ActiveEffect operations for a given actor over `req.runtime`.
 *
 * Actor-level effects use parent `{ type: 'Actor', id }`; effects that live on an actor's
 * owned item use the owned-item parent `{ type: 'Actor.<actorId>.Item', id: itemId }` — both
 * resolve through `runtime.documents.effects`, which gates writes on the root actor.
 */
export async function handleEffects(
    actorId: string,
    runtime: ModuleRequestRuntime,
    action: 'list' | 'toggle' | 'create' | 'update' | 'delete',
    data?: any
) {
    const actor = await runtime.documents.get('Actor', actorId) as ActorWithEffects | null;
    if (!actor) throw new Error('Actor not found');

    switch (action) {
        case 'list': {
            const allEffects: any[] = [];
            const actorEffects = actor.effects || [];

            // 1. Process Actor Effects
            for (const effect of actorEffects) {
                const eId = effect._id || effect.id;
                const enhancedEffect = { ...effect, _id: eId };

                if (!enhancedEffect.sourceName || enhancedEffect.sourceName === "Unknown") {
                    enhancedEffect.sourceName = enhancedEffect.source || enhancedEffect.origin || "Unknown";
                    if (enhancedEffect.origin) {
                        const parts = enhancedEffect.origin.split('.');
                        const itemIdx = parts.indexOf('Item');
                        if (itemIdx !== -1 && parts[itemIdx + 1]) {
                            const itemId = parts[itemIdx + 1];
                            const sourceItem = (actor.items || []).find((it: any) => (it._id || it.id) === itemId);
                            if (sourceItem) enhancedEffect.sourceName = sourceItem.name;
                        }
                    }
                }
                allEffects.push(enhancedEffect);
            }

            // 2. Process Item-based Effects
            if (actor.items) {
                for (const item of actor.items) {
                    const itemEffects = item.effects || [];
                    for (const effect of itemEffects) {
                        const eId = effect._id || effect.id;
                        const isDuplicate = allEffects.some(e => e._id === eId);
                        const itemId = item._id || item.id;
                        if (!itemId) continue;
                        if (!isDuplicate) {
                            allEffects.push({
                                ...effect,
                                _id: eId,
                                sourceName: item.name,
                                isItemEffect: true
                            });
                        }
                    }
                }
            }

            return {
                predefined: PREDEFINED_EFFECTS_LIST,
                active: allEffects
            };
        }

        case 'toggle': {
            const effectId = data.effectId;
            const effectData = PREDEFINED_EFFECTS_LIST.find(e => e.id === effectId);
            if (!effectData) throw new Error(`Predefined effect ${effectId} not found`);

            const existing = (actor.effects || []).find((e: any) => {
                const eStatusId = e.flags?.core?.statusId;
                const eStatuses = e.statuses || [];
                const eName = e.name || e.label;

                return (eStatusId && eStatusId === effectId) ||
                    (eStatuses.includes(effectId)) ||
                    (effectData.name && eName === effectData.name);
            });

            if (existing) {
                return await handleEffects(actorId, runtime, 'delete', { effectId: existing._id || existing.id });
            } else {
                const newEffect = {
                    name: effectData.name,
                    img: effectData.img,
                    origin: `Actor.${actorId}`,
                    disabled: false,
                    statuses: [effectData.id],
                    flags: { core: { statusId: effectData.id } },
                    changes: [{ key: effectData.effectKey, value: effectData.defaultValue, mode: effectData.mode }]
                };
                return await runtime.documents.effects.create({ type: 'Actor', id: actorId }, newEffect);
            }
        }

        case 'create':
            return await runtime.documents.effects.create({ type: 'Actor', id: actorId }, data);

        case 'update': {
            const effectId = data._id;
            const actorEffect = (actor.effects || []).find((e: any) => (e._id || e.id) === effectId);
            if (actorEffect) {
                return await runtime.documents.effects.update({ type: 'Actor', id: actorId }, effectId, data);
            }

            if (actor.items) {
                for (const item of actor.items) {
                    const itEffect = (item.effects || []).find((e: any) => (e._id || e.id) === effectId);
                    const itemId = item._id || item.id;
                    if (!itemId) continue;
                    if (itEffect) {
                        return await runtime.documents.effects.update({ type: `Actor.${actorId}.Item`, id: itemId }, effectId, data);
                    }
                }
            }
            throw new Error(`Scale Effect ${effectId} not found on Actor ${actorId}`);
        }

        case 'delete': {
            const effectId = data.effectId;
            const actorEffect = (actor.effects || []).find((e: any) => (e._id || e.id) === effectId);
            if (actorEffect) {
                await runtime.documents.effects.delete({ type: 'Actor', id: actorId }, effectId);
                return { success: true };
            }

            if (actor.items) {
                for (const item of actor.items) {
                    const itEffect = (item.effects || []).find((e: any) => (e._id || e.id) === effectId);
                    const itemId = item._id || item.id;
                    if (!itemId) continue;
                    if (itEffect) {
                        await runtime.documents.effects.delete({ type: `Actor.${actorId}.Item`, id: itemId }, effectId);
                        return { success: true };
                    }
                }
            }
            throw new Error(`Delete Effect ${effectId} not found on Actor ${actorId}`);
        }

        default:
            throw new Error(`Unknown action: ${action}`);
    }
}
