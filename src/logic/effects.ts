import { CHANGE_TYPE_PRIORITY, clone, finiteNumber, modeToType, typeToMode } from './foundry';

/**
 * One lossless reader for serialized ActiveEffects in both supported shapes.
 *
 * - Foundry 14 stores `system.changes[]` with string `type`, `phase` and `priority`.
 * - Foundry 13 / pack source stores top-level `changes[]` with numeric `mode`.
 *
 * Precedence follows Foundry 14 `BaseActiveEffect.migrateData`: legacy `changes`
 * are migrated only when `system.changes` is absent, so a payload carrying both
 * uses `system.changes` and never applies the legacy copy a second time.
 *
 * Native state follows Shadowdark 4.0.6 `ActiveEffectSD` (situational flag and
 * stashed / unequipped / unidentified suppression) and Foundry 14
 * `Actor#allApplicableEffects` (Actor effects plus transferred Item effects).
 */
export type EffectShape = 'v14' | 'legacy' | 'mixed' | 'none';

export interface EffectOwnerRef {
    kind: 'actor' | 'item';
    itemId?: string;
    itemName?: string;
    itemType?: string;
}

export interface CanonicalChange {
    /** Position in the authoritative source array; edits address this index. */
    index: number;
    key: string;
    type: string;
    /** Legacy numeric equivalent, or null for types with no legacy mode. */
    mode: number | null;
    value: unknown;
    phase: string;
    priority: number;
    /** Priority exactly as stored (null/absent means the type default). */
    storedPriority: number | null;
    from: 'system.changes' | 'changes';
}

export interface CanonicalEffect {
    id: string;
    /** Owner-qualified identity relative to the Actor, e.g. `Item.abc.ActiveEffect.def`. */
    ref: string;
    owner: EffectOwnerRef;
    name: string;
    img?: string;
    shape: EffectShape;
    changes: CanonicalChange[];
    /** Legacy entries present beside `system.changes` and ignored by precedence. */
    ignoredLegacyChanges: number;
    disabled: boolean;
    transfer: boolean;
    situational: boolean;
    suppressed: boolean;
    suppressionReason: string | null;
    /** Native `effect.active`: not disabled and not suppressed. */
    active: boolean;
    /** Included in Actor preparation (Actor effect, or transferred Item effect). */
    applies: boolean;
    diagnostics: string[];
}

const canBeEquipped = (type: unknown) => type === 'Weapon' || type === 'Armor';

/** Native ActiveEffectSD.isSuppressed for an embedded Item parent (schema defaults applied). */
export function itemSuppression(item: any): string | null {
    const system = item?.system ?? {};
    if (system.stashed === true) return 'stashed';
    if (canBeEquipped(item?.type) && (system.equipped ?? false) === false) return 'unequipped';
    if ((system.identification?.identified ?? true) === false) return 'unidentified';
    return null;
}

export function effectId(effect: any): string {
    return String(effect?._id ?? effect?.id ?? '');
}

export function readChanges(effect: any): { shape: EffectShape; changes: CanonicalChange[]; ignoredLegacyChanges: number; diagnostics: string[] } {
    const v14 = Array.isArray(effect?.system?.changes) ? effect.system.changes : null;
    const legacy = Array.isArray(effect?.changes) ? effect.changes : null;
    const diagnostics: string[] = [];
    const source = v14 ?? legacy ?? [];
    const from = v14 ? 'system.changes' as const : 'changes' as const;
    const shape: EffectShape = v14 && legacy ? 'mixed' : v14 ? 'v14' : legacy ? 'legacy' : 'none';
    if (shape === 'mixed' && legacy!.length) {
        diagnostics.push(`Both system.changes and legacy changes are present; system.changes is authoritative (Foundry 14 migration precedence).`);
    }
    const changes = source.flatMap((raw: any, index: number): CanonicalChange[] => {
        if (!raw || typeof raw !== 'object' || typeof raw.key !== 'string') {
            diagnostics.push(`Change ${index} has no key and is not applied.`);
            return [];
        }
        let type: string;
        if (typeof raw.type === 'string' && raw.type) type = raw.type;
        else if (finiteNumber(raw.mode) !== null) type = modeToType(Number(raw.mode));
        // Both Foundry 13 (`mode`) and 14 (`type`) schemas default a change to ADD.
        else type = 'add';
        const storedPriority = finiteNumber(raw.priority);
        return [{
            index, key: raw.key, type, mode: typeToMode(type), value: raw.value,
            phase: typeof raw.phase === 'string' && raw.phase ? raw.phase : 'initial',
            priority: storedPriority ?? CHANGE_TYPE_PRIORITY[type] ?? 0,
            storedPriority, from,
        }];
    });
    return { shape, changes, ignoredLegacyChanges: shape === 'mixed' ? legacy!.length : 0, diagnostics };
}

export function readEffect(effect: any, owner: EffectOwnerRef, parentItem?: any): CanonicalEffect {
    const { shape, changes, ignoredLegacyChanges, diagnostics } = readChanges(effect);
    const id = effectId(effect);
    const suppressionReason = owner.kind === 'item' ? itemSuppression(parentItem) : null;
    const disabled = effect?.disabled === true;
    const transfer = effect?.transfer ?? true;
    const active = !disabled && !suppressionReason;
    return {
        id,
        ref: owner.kind === 'item' ? `Item.${owner.itemId}.ActiveEffect.${id}` : `ActiveEffect.${id}`,
        owner, name: String(effect?.name ?? effect?.label ?? 'Effect'), img: effect?.img ?? effect?.icon,
        shape, changes, ignoredLegacyChanges,
        disabled, transfer: transfer !== false, situational: effect?.flags?.shadowdark?.situational === true,
        suppressed: !!suppressionReason, suppressionReason,
        active, applies: active && (owner.kind === 'actor' || transfer !== false),
        diagnostics,
    };
}

/** Every effect on the Actor and its embedded Items, once each, with owner identity. */
export function collectEffects(actor: any): CanonicalEffect[] {
    const list = (value: any): any[] => Array.isArray(value) ? value : Array.isArray(value?.contents) ? value.contents : [];
    const effects = list(actor?.effects).map(effect => readEffect(effect, { kind: 'actor' }));
    for (const item of list(actor?.items)) {
        const itemId = String(item?._id ?? item?.id ?? '');
        for (const effect of list(item?.effects)) {
            effects.push(readEffect(effect, { kind: 'item', itemId, itemName: item?.name, itemType: item?.type }, item));
        }
    }
    return effects;
}

/**
 * Serialized `{ path: value }` update for an effect's changes in its own shape.
 * Each edited change keeps unknown fields of the original entry at that index.
 * A legacy-shaped effect cannot express a non-initial phase or a type with no
 * legacy mode; such an edit is rejected rather than silently dropped.
 */
export interface EditableChange { index?: number; key: string; type: string; value: unknown; phase?: string; priority?: number | null }

export function serializeChanges(effect: any, edited: EditableChange[]): Record<string, unknown> {
    const { shape } = readChanges(effect);
    const target = shape === 'legacy' ? 'changes' : 'system.changes';
    const originals: any[] = (target === 'changes' ? effect?.changes : effect?.system?.changes) ?? [];
    const output = edited.map(change => {
        if (!change.key) throw new Error('Every effect change needs a key.');
        const original = change.index !== undefined && originals[change.index] && typeof originals[change.index] === 'object'
            ? clone(originals[change.index]) : {};
        if (target === 'changes') {
            const mode = typeToMode(change.type);
            if (mode === null) throw new Error(`Change type "${change.type}" has no legacy mode; this effect is stored in the legacy shape.`);
            if (change.phase && change.phase !== 'initial') throw new Error('The legacy effect shape has no phase; only "initial" can be stored.');
            delete original.type; delete original.phase;
            return { ...original, key: change.key, mode, value: change.value,
                ...(change.priority !== undefined ? { priority: change.priority } : {}) };
        }
        delete original.mode;
        return { ...original, key: change.key, type: change.type, value: change.value,
            phase: change.phase ?? original.phase ?? 'initial',
            priority: change.priority !== undefined ? change.priority : (original.priority ?? null) };
    });
    return { [target]: output };
}

/** Shape to use for a new effect: follow existing Actor data, else legacy (Foundry 14 migrates it). */
export function preferredShape(actor: any): 'v14' | 'legacy' {
    const shapes = collectEffects(actor).map(effect => effect.shape);
    if (shapes.some(shape => shape === 'v14' || shape === 'mixed')) return 'v14';
    return 'legacy';
}
