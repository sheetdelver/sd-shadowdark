/**
 * Pure analysis for the Shadowdark 4.0 effect-key migration steps (ADR-0001 G8-B).
 *
 * Native Shadowdark 4.0 (`Update_251001_1.updateEffects`, identical in releases
 * 4.0.0–4.0.6) renames pre-4.0 ActiveEffect change keys once, when a world
 * upgrades. Effects written later with pre-4.0 keys (for example by SheetDelver
 * 0.9.4 and earlier) keep keys native 4.0 does not apply. These steps give each
 * such stored effect native's replacement, through Core's admin-approved
 * maintenance job only.
 *
 * Scope follows native: Actor-level effects of Player Actors (and their token
 * delta overrides), and effects on every Item (world Items, owned Items, token
 * delta Items, and the same documents in world-owned Actor/Item packs). Weapon
 * parents select native's `.this` keys. Each hook reads only the effect target,
 * Core's declared `relations` (module-api 1.6: the parent's and the token base
 * Actor's `type`) and the native spell slugs parameter. Nothing is fabricated:
 *
 * - Only the stored `changes` / `system.changes` array is rewritten, in its own
 *   shape, keeping every other change, unknown per-change fields and order.
 * - Keys native has no migration for are left as they are (native does too).
 * - A `system.bonuses.advantage` value that is not a native spell (by slug or by
 *   SheetDelver 0.9.4's stored spell name) is unresolved: native would turn it
 *   into an AC change, which SheetDelver does not guess. It blocks with a reason.
 * - A parent whose type is not stored is unresolved, never guessed:
 *   - A token delta's `type` is optional; Foundry's `ActorDelta.applyDelta`
 *     drops a null/absent value, so the base Actor's type applies.
 *   - A token delta Item is different. Foundry stores it as a complete Item
 *     that replaces the base Actor's Item of the same id, and never merges the
 *     two (`ActorDelta.#mergeEmbeddedCollection`). It validates against the full
 *     Item schema, so a delta Item without `type` is an invalid document, with
 *     no inherited type to find. It blocks with its identity.
 *
 * Environment-neutral and synchronous: Core bundles each hook separately and runs
 * it without a runtime, clock, network or random source.
 */
import type { MigrationHookInput } from '@sheet-delver/sdk';
import { planEffectMigration } from '../../src/logic/effect-key-migration';
import { readChanges, serializeChanges } from '../../src/logic/effects';
import { nativeKeyMigration } from '../../src/logic/legacy-effect-keys';

export type Analysis =
    | { status: 'current'; reason?: string }
    | { status: 'unresolved'; reason: string }
    | { status: 'migration-needed'; updates: Record<string, unknown>; migrated: Array<{ from: string; to: string[] }> };

const ADVANTAGE = 'system.bonuses.advantage';
const REPAIR = 'Repair or restore it in Foundry, then review maintenance again.';

const documentId = (source: any) => String(source?._id ?? source?.id ?? '');

/**
 * Native parent type for the effect: `{ inScope: false }` for an Actor-level
 * effect of a non-Player Actor (native leaves those), or the reason a required
 * parent type is not available.
 */
function parentScope(input: MigrationHookInput): { inScope: true; parentType: string } | { inScope: false } | { unresolved: string } {
    const uuid = input.target.uuid;
    const parent = input.relations?.parent;
    if (!parent) return { unresolved: `The parent document of ActiveEffect ${uuid} is not available. ${REPAIR}` };
    const type: unknown = parent.source?.type;
    if (parent.kind === 'Actor' || parent.kind === 'ActorDelta') {
        let actorType = type;
        if (parent.kind === 'ActorDelta' && (actorType === null || actorType === undefined)) {
            const base = input.relations?.baseActor;
            if (!base) return { unresolved: `The base Actor of token delta ${parent.uuid} (${parent.baseActorUuid ?? 'unknown'}) is not available for ActiveEffect ${uuid}. ${REPAIR}` };
            actorType = base.source?.type;
        }
        if (typeof actorType !== 'string') return { unresolved: `The Actor type for ActiveEffect ${uuid} is not stored on ${parent.uuid}. ${REPAIR}` };
        return actorType === 'Player' ? { inScope: true, parentType: 'Player' } : { inScope: false };
    }
    if (parent.kind === 'Item') {
        if (typeof type === 'string') return { inScope: true, parentType: type };
        return { unresolved: parent.baseActorUuid
            ? `Token delta Item ${parent.uuid} stores no type, so ActiveEffect ${uuid} cannot be migrated. Foundry keeps each delta Item as a complete Item that replaces the base Actor's Item and does not inherit its type, so Foundry treats this Item as invalid. ${REPAIR}`
            : `Item ${parent.uuid} stores no type, so ActiveEffect ${uuid} cannot be migrated. ${REPAIR}` };
    }
    return { unresolved: `Unsupported ActiveEffect parent ${parent.uuid}.` };
}

export function analyze(input: MigrationHookInput): Analysis {
    const target = input.target;
    if (target.kind !== 'ActiveEffect') return { status: 'current', reason: 'Only ActiveEffects are in scope.' };
    const effect = target.source as any;
    const { changes } = readChanges(effect);
    // Parent type only changes the replacement's scope suffix, so a migratable key is detected without it.
    const legacy = changes.filter(change => nativeKeyMigration({ key: change.key, mode: change.mode, value: change.value }, undefined) !== null);
    if (!legacy.length) return { status: 'current' };
    const scope = parentScope(input);
    if ('unresolved' in scope) return { status: 'unresolved', reason: scope.unresolved };
    if (!scope.inScope) return { status: 'current', reason: 'Native 4.0 migrates Actor-level effects of Player Actors only.' };
    const slugs = Array.isArray(input.parameters.nativeSpellSlugs) ? input.parameters.nativeSpellSlugs as string[] : [];
    const plan = planEffectMigration(effect, scope.parentType, new Set(slugs));
    const blocking = plan.unresolved.filter(entry => entry.key === ADVANTAGE);
    if (blocking.length) {
        const name = String(effect?.name ?? documentId(effect));
        return { status: 'unresolved', reason: `Effect "${name}" (${target.uuid}): ${blocking.map(entry => `${entry.key} ${entry.reason}`).join(' ')} `
            + 'Edit or remove that change in Foundry, then review maintenance again.' };
    }
    if (!plan.changes) return { status: 'current' };
    return { status: 'migration-needed', updates: serializeChanges(effect, plan.changes), migrated: plan.migrated };
}
