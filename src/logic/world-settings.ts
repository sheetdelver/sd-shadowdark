/**
 * Native Shadowdark world settings the module's rules consume, read from Core's
 * authoritative world context (Core ADR-0064, module-api 1.5 / UI API 3.2).
 *
 * The keys are declared in `info.json.worldSettings`. Native `src/settings.mjs`
 * registers both identically (world scope, Boolean) in every release 4.0.0–4.0.6,
 * so the declaration covers exactly those inspected releases. Core resolves each
 * key to the stored world value, the declared registered default when no world
 * row exists, or `unavailable` (not ready, unsupported version, invalid value).
 *
 * Callers never read Setting documents, localStorage or Actor data for these
 * values, and an unavailable value is never treated as the native default.
 * Preparation receives the snapshot as `context.world`; request routes use
 * `req.runtime.world`; the browser reads the prepared `derived.ruleInputs`, which
 * carries the same revision as the rest of the prepared Actor.
 */
export const WORLD_SETTING_KEYS = {
    usePulpMode: 'shadowdark.usePulpMode',
    autoConsumeAmmunition: 'shadowdark.autoConsumeAmmunition',
    sourceFilters: 'shadowdark.sourceFilters',
} as const;

export type WorldSettingName = keyof typeof WORLD_SETTING_KEYS;

/** One rule input as the module consumes it; `value` is null exactly when unavailable. */
export type RuleSetting =
    | { status: 'world' | 'registered-default'; value: boolean }
    | { status: 'unavailable'; value: null; reason: string };

export interface RuleInputs {
    /** Core context revision the values came from; null without a host context. */
    contextRevision: number | null;
    usePulpMode: RuleSetting;
    autoConsumeAmmunition: RuleSetting;
    sourceFilters?: SourceFilters;
}
export type SourceFilters = { status: 'world' | 'registered-default'; value: string[] }
    | { status: 'unavailable'; value: null; reason: string };
export function readSourceFilters(snapshot: WorldSnapshotLike | null | undefined): SourceFilters {
    const row = snapshot?.settings?.[WORLD_SETTING_KEYS.sourceFilters] as any;
    if ((row?.status === 'world' || row?.status === 'registered-default') && Array.isArray(row.value) && row.value.every((value: unknown) => typeof value === 'string'))
        return { status: row.status, value: [...row.value] };
    return { status: 'unavailable', value: null, reason: 'Native source filters are unavailable or invalid; refresh the world context.' };
}
/** CompendiumsSD._documents: empty selection/all blank source titles remain visible. */
export function sourceAllowed(doc: any, filters: readonly string[]): boolean {
    const title = doc?.system?.source?.title ?? '';
    return filters.length === 0 || title === '' || filters.includes(title);
}

/** Structural subset of the SDK `ModuleWorldSnapshot`, so this file stays environment-neutral. */
export interface WorldSnapshotLike {
    identity?: { contextRevision?: number };
    settings?: Readonly<Record<string, unknown>>;
}

function readSetting(snapshot: WorldSnapshotLike | null | undefined, key: string): RuleSetting {
    if (!snapshot?.settings) return { status: 'unavailable', value: null, reason: 'World context is not available.' };
    const result = snapshot.settings[key] as { status?: unknown; value?: unknown; reason?: unknown } | undefined;
    if (!result) return { status: 'unavailable', value: null, reason: `${key} is not declared in this world context.` };
    if (result.status === 'world' || result.status === 'registered-default') {
        // Both settings are native Booleans; anything else is not a usable value.
        if (typeof result.value === 'boolean') return { status: result.status, value: result.value };
        return { status: 'unavailable', value: null, reason: `${key} has an invalid value.` };
    }
    return { status: 'unavailable', value: null, reason: `${key} is unavailable (${String(result.reason ?? 'unknown')}).` };
}

export function ruleInputsFrom(snapshot: WorldSnapshotLike | null | undefined): RuleInputs {
    return {
        contextRevision: typeof snapshot?.identity?.contextRevision === 'number' ? snapshot.identity.contextRevision : null,
        usePulpMode: readSetting(snapshot, WORLD_SETTING_KEYS.usePulpMode),
        autoConsumeAmmunition: readSetting(snapshot, WORLD_SETTING_KEYS.autoConsumeAmmunition),
        sourceFilters: readSourceFilters(snapshot),
    };
}

/** No host context (offline tools, tests without a world): every input unavailable. */
export const UNAVAILABLE_RULE_INPUTS: RuleInputs = Object.freeze(ruleInputsFrom(null)) as RuleInputs;

/** Luck mode from the Pulp setting; null when the setting is unavailable. */
export function luckMode(rules: RuleInputs): 'pulp' | 'standard' | null {
    return rules.usePulpMode.value === null ? null : rules.usePulpMode.value ? 'pulp' : 'standard';
}

/** Native PlayerSD.hasLuckToken; null when the mode is unknown. */
export function hasLuckToken(rules: RuleInputs, luck: { available?: unknown; remaining?: unknown } | null | undefined): boolean | null {
    const mode = luckMode(rules);
    if (mode === null) return null;
    return mode === 'pulp' ? Number(luck?.remaining ?? 0) > 0 : luck?.available === true;
}
