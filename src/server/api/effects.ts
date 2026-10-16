import type { ModuleRequestRuntime } from '@sheet-delver/sdk/server';
import { SdkError } from '@sheet-delver/sdk';
import { NATIVE_PREDEFINED_EFFECTS, NATIVE_REJECTED_PREDEFINED } from '../../data/native-predefined-effects';
import { collectEffects, effectId, preferredShape, serializeChanges, type EditableChange } from '../../logic/effects';
import { CHANGE_TYPE_PRIORITY, modeToType, slugify } from '../../logic/foundry';
import { documentId } from '../../logic/identity';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';

/**
 * ActiveEffect operations over `req.runtime`, addressed by owner-qualified
 * references relative to the Actor: `ActiveEffect.<id>` for Actor effects and
 * `Item.<itemId>.ActiveEffect.<id>` for effects on an owned Item. An embedded
 * effect ID alone never selects a document, because IDs repeat across parents.
 *
 * Updates are lossless: only fields the caller changed are written, and change
 * arrays are serialized in the effect's own shape (legacy `changes` or Foundry 14
 * `system.changes`) while keeping each entry's unknown fields.
 */
export type EffectRef = { kind: 'actor'; effectId: string } | { kind: 'item'; itemId: string; effectId: string };

export function parseEffectRef(value: unknown): EffectRef | null {
    if (typeof value !== 'string') return null;
    const parts = value.split('.');
    if (parts.length === 2 && parts[0] === 'ActiveEffect' && parts[1]) return { kind: 'actor', effectId: parts[1] };
    if (parts.length === 4 && parts[0] === 'Item' && parts[2] === 'ActiveEffect' && parts[1] && parts[3]) {
        return { kind: 'item', itemId: parts[1], effectId: parts[3] };
    }
    return null;
}

const ALLOWED_TYPES = new Set(['add', 'multiply', 'override', 'upgrade', 'downgrade', 'subtract', 'custom']);

function validateChanges(changes: unknown): EditableChange[] {
    if (!Array.isArray(changes)) throw new SdkError('validation', 'changes must be an array');
    return changes.map((change: any, position) => {
        const key = typeof change?.key === 'string' ? change.key.trim() : '';
        if (!key) throw new SdkError('validation', `Change ${position + 1} needs a key.`);
        if (key.includes('REPLACEME')) throw new SdkError('validation', `Change ${position + 1} still needs a choice (${key}).`);
        const type = typeof change.type === 'string' ? change.type : '';
        if (!ALLOWED_TYPES.has(type) && !/^custom\.-?\d+$/.test(type)) throw new SdkError('validation', `Change ${position + 1} has an unsupported type "${type}".`);
        if (change.phase !== undefined && !['initial', 'final'].includes(change.phase)) {
            throw new SdkError('validation', `Change ${position + 1} has an unregistered phase "${change.phase}".`);
        }
        const priority = change.priority === null || change.priority === undefined || change.priority === '' ? null : Number(change.priority);
        if (priority !== null && !Number.isFinite(priority)) throw new SdkError('validation', `Change ${position + 1} has an invalid priority.`);
        return {
            index: Number.isInteger(change.index) ? change.index : undefined, key, type, value: change.value ?? '',
            phase: change.phase, priority,
        };
    });
}

function locate(actor: any, ref: EffectRef): { parent: { type: string; id: string }; effect: any; item?: any } {
    if (ref.kind === 'actor') {
        const effect = (actor.effects ?? []).find((entry: any) => effectId(entry) === ref.effectId);
        if (!effect) throw new SdkError('not_found', `Effect ${ref.effectId} is not on this Actor.`);
        return { parent: { type: 'Actor', id: documentId(actor) }, effect };
    }
    const item = (actor.items ?? []).find((entry: any) => documentId(entry) === ref.itemId);
    const effect = (item?.effects ?? []).find((entry: any) => effectId(entry) === ref.effectId);
    if (!item || !effect) throw new SdkError('not_found', `Effect ${ref.effectId} is not on Item ${ref.itemId}.`);
    return { parent: { type: `Actor.${documentId(actor)}.Item`, id: ref.itemId }, effect, item };
}

export interface EffectPatch {
    name?: string;
    img?: string;
    disabled?: boolean;
    transfer?: boolean;
    situational?: boolean;
    changes?: unknown;
}

/** The minimal Foundry update for the caller's patch; null when nothing changed. */
export function buildEffectUpdate(effect: any, patch: EffectPatch): Record<string, unknown> | null {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined && patch.name !== effect.name) {
        if (!String(patch.name).trim()) throw new SdkError('validation', 'An effect needs a name.');
        update.name = String(patch.name);
    }
    if (patch.img !== undefined && patch.img !== effect.img) update.img = patch.img;
    if (patch.disabled !== undefined && patch.disabled !== (effect.disabled === true)) update.disabled = patch.disabled;
    if (patch.transfer !== undefined && patch.transfer !== (effect.transfer ?? true)) update.transfer = patch.transfer;
    if (patch.situational !== undefined && patch.situational !== (effect.flags?.shadowdark?.situational === true)) {
        update['flags.shadowdark.situational'] = patch.situational;
    }
    if (patch.changes !== undefined) {
        const serialized = serializeChanges(effect, validateChanges(patch.changes));
        const [path, value] = Object.entries(serialized)[0];
        const current = path === 'changes' ? effect.changes : effect.system?.changes;
        if (JSON.stringify(current ?? []) !== JSON.stringify(value)) update[path] = value;
    }
    return Object.keys(update).length ? update : null;
}

/** Native predefined definition with its choice resolved, as one change. */
async function predefinedChange(key: string, choice: unknown): Promise<{ name: string; img: string; change: EditableChange }> {
    const definition = NATIVE_PREDEFINED_EFFECTS[key];
    if (!definition) throw new SdkError('validation', `Unknown predefined effect ${key}.`);
    if (NATIVE_REJECTED_PREDEFINED[key]) throw new SdkError('validation', NATIVE_REJECTED_PREDEFINED[key]);
    let effectKey = definition.key;
    let value: unknown = definition.value;
    if (effectKey.includes('REPLACEME') || value === 'REPLACEME') {
        const options = await predefinedChoices(key);
        const selected = typeof choice === 'string' ? options.find(option => option.value === choice) : null;
        if (!selected) throw new SdkError('validation', `${definition.label} needs a valid choice before it is created.`);
        effectKey = effectKey.replace('REPLACEME', selected.value);
        if (value === 'REPLACEME') value = selected.value;
    }
    return {
        name: definition.label, img: definition.icon,
        change: { key: effectKey, type: modeToType(definition.mode), value, phase: 'initial', priority: null },
    };
}

/** Choice options for a predefined effect from declared data; none means unsupported. */
export async function predefinedChoices(key: string): Promise<Array<{ value: string; label: string }>> {
    const catalog = await shadowdarkAdapter.getChoiceCatalog();
    const fromCatalog = (kind: 'weapon' | 'armor' | 'spell') => (catalog[kind] ?? []).map(option => ({ value: option.slug, label: option.name }));
    switch (key) {
        case 'armorMastery': return fromCatalog('armor');
        case 'spellAdvantage': return fromCatalog('spell');
        case 'weaponDamageDieD12': return fromCatalog('weapon');
        case 'weaponDamageDieImprovementByProperty': {
            const properties = await shadowdarkAdapter.getCollection('properties');
            return properties.map((doc: any) => ({ value: slugify(doc.name), label: doc.name }));
        }
        case 'spellcastingClasses': {
            const classes = await shadowdarkAdapter.getCollection('classes');
            return classes.filter((doc: any) => doc.system?.spellcasting?.ability).map((doc: any) => ({ value: slugify(doc.name), label: doc.name }));
        }
        default: return [];
    }
}

export const PREDEFINED_EFFECTS_LIST = Object.entries(NATIVE_PREDEFINED_EFFECTS).map(([id, data]) => ({
    id, name: data.label, label: data.label, img: data.icon, effectKey: data.key, defaultValue: data.value,
    type: modeToType(data.mode), restriction: data.restriction ?? null,
    needsChoice: data.key.includes('REPLACEME') || data.value === 'REPLACEME',
    unsupported: NATIVE_REJECTED_PREDEFINED[id] ?? null,
}));

export async function handleEffects(
    actorId: string,
    runtime: ModuleRequestRuntime,
    action: 'list' | 'toggle' | 'create' | 'update' | 'delete' | 'choices',
    data?: any
) {
    const actor: any = await runtime.documents.get('Actor', actorId);
    if (!actor) throw new SdkError('not_found', 'Actor not found');

    switch (action) {
        case 'list':
            return { predefined: PREDEFINED_EFFECTS_LIST, active: collectEffects(actor) };

        case 'choices':
            return { options: await predefinedChoices(String(data?.key ?? '')) };

        case 'toggle': {
            const ref = parseEffectRef(data?.ref);
            if (!ref || typeof data?.enabled !== 'boolean') throw new SdkError('validation', 'toggle needs an effect ref and enabled');
            const { parent, effect } = locate(actor, ref);
            if ((effect.disabled === true) === !data.enabled) return { unchanged: true };
            return runtime.documents.effects.update(parent, effectId(effect), { disabled: !data.enabled });
        }

        case 'create': {
            const owner = data?.owner?.kind === 'item' ? { kind: 'item' as const, itemId: String(data.owner.itemId ?? '') } : { kind: 'actor' as const };
            let name = String(data?.effect?.name ?? '').trim();
            let img = data?.effect?.img;
            let changes: EditableChange[];
            if (data?.predefined?.key) {
                const resolved = await predefinedChange(String(data.predefined.key), data.predefined.choice);
                name ||= resolved.name;
                img ??= resolved.img;
                changes = [resolved.change];
            } else {
                changes = validateChanges(data?.effect?.changes ?? []);
            }
            if (!name) throw new SdkError('validation', 'An effect needs a name.');
            const shape = preferredShape(actor);
            const serialized = serializeChanges(shape === 'v14' ? { system: { changes: [] } } : { changes: [] },
                changes.map(change => ({ ...change, index: undefined })));
            if (shape === 'legacy') {
                const phase = changes.find(change => change.phase && change.phase !== 'initial');
                if (phase) throw new SdkError('validation', 'This Actor\'s effects use the legacy shape, which has no phase.');
            }
            const payload: Record<string, unknown> = {
                name, img: img || 'icons/svg/aura.svg', disabled: data?.effect?.disabled === true,
                ...(data?.effect?.situational ? { flags: { shadowdark: { situational: true } } } : {}),
                ...(shape === 'v14' ? { system: { changes: serialized['system.changes'] } } : { changes: serialized.changes }),
            };
            if (owner.kind === 'item') {
                const item = (actor.items ?? []).find((entry: any) => documentId(entry) === owner.itemId);
                if (!item) throw new SdkError('not_found', `Item ${owner.itemId} is not on this Actor.`);
                payload.transfer = data?.effect?.transfer ?? true;
                return runtime.documents.effects.create({ type: `Actor.${actorId}.Item`, id: owner.itemId }, payload);
            }
            payload.origin = `Actor.${actorId}`;
            return runtime.documents.effects.create({ type: 'Actor', id: actorId }, payload);
        }

        case 'update': {
            const ref = parseEffectRef(data?.ref);
            if (!ref) throw new SdkError('validation', 'update needs an owner-qualified effect ref');
            const { parent, effect } = locate(actor, ref);
            const update = buildEffectUpdate(effect, data?.patch ?? {});
            if (!update) return { unchanged: true };
            return runtime.documents.effects.update(parent, effectId(effect), update);
        }

        case 'delete': {
            const ref = parseEffectRef(data?.ref);
            if (!ref) throw new SdkError('validation', 'delete needs an owner-qualified effect ref');
            const { parent, effect } = locate(actor, ref);
            await runtime.documents.effects.delete(parent, effectId(effect));
            return { success: true };
        }

        default:
            throw new SdkError('validation', `Unknown action: ${action}`);
    }
}

export { CHANGE_TYPE_PRIORITY };
