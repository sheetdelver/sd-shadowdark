import { readChanges, type EditableChange } from './effects';
import { modeToType, slugify } from './foundry';
import { nativeKeyMigration, isRejectedBonusesKey } from './legacy-effect-keys';

/**
 * Plans native Shadowdark 4.0.6 `Update_251001_1.updateEffects` for one stored
 * effect: every pre-4.0 change becomes its native 4.0 replacement, in place,
 * keeping the effect's own serialized shape and every unrelated change. Pure;
 * nothing applies it yet. The caller-bound route that did was retired (review
 * RV-02); Core ADR-0064's admin upgrade job is the intended runner.
 *
 * `priority` is left undefined so `serializeChanges` keeps each original entry's
 * stored priority (or its absence) exactly.
 *
 * Deliberate differences from native, both recorded in the audit:
 * - `system.bonuses.advantage` with a spell value also matches the slugified
 *   value ("Magic Missile" → magic-missile), because SheetDelver 0.9.4 stored
 *   spell names. A value that is not a declared spell is left unchanged and
 *   reported, instead of native's fall-through to `system.attributes.ac.<value>`.
 * - `system.bonuses.*` keys native has no case for are left unchanged and
 *   reported (native logs "No migration path").
 */
export interface EffectMigrationPlan {
    /** Full replacement change list for `serializeChanges`, or null when nothing changes. */
    changes: EditableChange[] | null;
    migrated: Array<{ from: string; to: string[] }>;
    unresolved: Array<{ key: string; reason: string }>;
}

export function planEffectMigration(effect: any, parentType: string | undefined, spellSlugs: ReadonlySet<string>): EffectMigrationPlan {
    const { changes } = readChanges(effect);
    const migrated: EffectMigrationPlan['migrated'] = [];
    const unresolved: EffectMigrationPlan['unresolved'] = [];
    const output: EditableChange[] = [];
    let touched = false;
    for (const change of changes) {
        const keep: EditableChange = { index: change.index, key: change.key, type: change.type, value: change.value, phase: change.phase };
        let migration = nativeKeyMigration({ key: change.key, mode: change.mode, value: change.value }, parentType);
        if (change.key === 'system.bonuses.advantage' && migration?.note) {
            const raw = String(change.value ?? '');
            const slug = spellSlugs.has(raw) ? raw : spellSlugs.has(slugify(raw)) ? slugify(raw) : null;
            if (!slug) {
                unresolved.push({ key: change.key, reason: `"${raw}" is not a declared spell; left unchanged.` });
                output.push(keep);
                continue;
            }
            migration = { changes: [{ key: `system.roll.spell.advantage.${slug}`, mode: 2, value: 1 }] };
        }
        if (!migration) {
            if (isRejectedBonusesKey(change.key)) unresolved.push({ key: change.key, reason: 'native 4.0.6 has no migration path for this key; left unchanged.' });
            output.push(keep);
            continue;
        }
        touched = true;
        migrated.push({ from: change.key, to: migration.changes.map(entry => entry.key) });
        migration.changes.forEach((entry, position) => output.push({
            // The first replacement keeps the original entry (and its unknown fields).
            ...(position === 0 ? { index: change.index } : {}),
            key: entry.key,
            type: entry.mode === undefined || entry.mode === null || entry.mode === change.mode ? change.type : modeToType(entry.mode),
            value: entry.value, phase: change.phase,
        }));
    }
    return { changes: touched ? output : null, migrated, unresolved };
}

/** Native `updateActor` migrates Actor-level effects of Players only; owned items always. */
export function actorEffectsInScope(actor: any): boolean {
    return actor?.type === 'Player';
}
