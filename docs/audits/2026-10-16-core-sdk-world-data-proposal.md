# Proposal: module data migrations and world data access (Core/SDK)

Status: **Proposal for Core review — not implemented.** Written October 16, 2026
from Shadowdark module work (ADR-0001). Core and the SDK were inspected read-only
at Core `ff65695` (package 0.18.1; SDK surface unchanged since `v0.18.0`).
Nothing in this document is specific to Shadowdark; Shadowdark is the first
consumer. Related module records: the
[native-alignment audit](2026-10-15-native-alignment.md) sections "Effect
conformance audit" and "Research note: world settings are not readable by modules".

## Problem

System modules need two capabilities the platform does not offer today.

1. **Read world settings.** A module must apply the system's world-level rule
   switches. Examples are Shadowdark's `shadowdark.usePulpMode` (luck model) and
   `shadowdark.autoConsumeAmmunition`. Without them the module can only assume
   the system defaults.
2. **Migrate world data when the module or supported system version changes.**
   Native systems migrate world documents when a GM loads an upgraded world
   (Shadowdark 4.0.6 `MigrationRunnerSD` covers Actors, owned Items, world Items,
   unlinked token deltas and world compendium packs).
   - Documents written afterwards by older clients keep the outdated data.
   - SheetDelver's Shadowdark module up to 0.9.4 wrote pre-4.0 effect keys
     (`system.abilities.<stat>.bonus`, `system.bonuses.*`). As a result, characters
     show unmodified stats (CON 9 with a +2 improvement) and spellcasters have no
     casting class, in Foundry and in SheetDelver.
   - Players cannot be expected to repair this by hand.

## Current platform facts

- `adapter.initialize(runtime)` receives a `ModuleRuntime` whose `documents` is
  read-only (`ReadonlyDocumentStore`). Writes exist only on a route's
  `req.runtime` and act as the calling user (`src/shared/sdk/runtime.ts`).
- `SettingStore` (`src/server/core/documents/primary/settings/SettingStore.ts`)
  mirrors Foundry Setting documents. It is GM-only with no route, and has a
  privileged `getValueByKey` used internally for
  `core.combatTrackerConfig.skipDefeated` (Core ADR-0028 Phase 7). Module
  document services list Setting as intentionally absent.
- `runtime.dataStore` is scoped per module, not per world. `useModuleSettings`
  stores client-only values in localStorage.
- Core connects to Foundry through a service account (CoreSocket transport, Core
  architecture §3). Whether that identity can write world documents is not
  established here.
- There is no module lifecycle hook that runs with write access, and no
  per-world migration ledger.

## What a module can do today, and why it is not enough

A module route plus a UI trigger can migrate data with the caller's rights: a GM
visiting a module page migrates the world, and an owner opening a sheet migrates
that Actor. Shadowdark has this prototyped (`src/server/api/migrations.ts`,
`src/ui/hooks/useDataMigrations.ts`), but it is not wired into any page pending
this proposal. Its limits:

- It runs only when a GM happens to open a module page, not when the module loads.
- It cannot reach unlinked token deltas or world compendium packs.
- It has no world-scoped ledger, lock, progress or GM-facing report.
- It needs a module-specific client trigger, which every system module would
  re-implement.

## Proposed contracts

### A. Declared, read-only world settings

- **Declaration.** `info.json` gains `worldSettings`, for example
  `[{ "key": "shadowdark.usePulpMode", "type": "boolean", "default": false }]`.
  The default is required because Foundry stores only changed values, and Core
  cannot see system registrations.
- **Scope.** A module may declare only keys in its own system namespace
  (`<systemId>.*`), plus an optional Core-curated `core.*` allowlist. Undeclared
  and foreign keys are denied, so other packages' settings, which may hold URLs or
  tokens, stay private.
- **Server.** `runtime.settings.get(key)` returns
  `{ value, source: 'world' | 'default' }` from `SettingStore.getValueByKey`. It
  is available at initialize and on requests.
- **Client.** `useWorldSetting(key)` returns the same, updates live from Setting
  `modifyDocument` events, and resets on world switch.
- **Out of reach.** Client-scoped settings remain unavailable; they live in each
  browser.
- **Versioning.** An additive `module-api` minor version, and a
  `ui-extension-api` minor for the hook.

### B. Module data migrations run by Core

- **Declaration.** The module declares migrations in its server entry: an
  ordered list of `{ id, version, description, scope, migrate }`.
  - `scope` lists document kinds: Actor, owned Item, world Item, embedded
    ActiveEffect, unlinked token delta, world compendium pack.
  - `migrate(document, context)` is pure and returns a patch or `null`. Shadowdark's
    `planEffectMigration` already has this shape.
- **Runner.** Core runs pending migrations for each world after the world is
  ready and the module is loaded. Candidate identities: the service account, or
  the first connected GM; this is an open question below. Core holds one runner
  lock per world.
- **Ledger.** A per-world, per-module record in Core persistence stores each
  migration's id and version, time, counts and outcome. A completed version never
  reruns; a failed run resumes.
- **Writes.** Batched (`commit`), idempotent, and limited to the patch returned.
  Each write is access-checked against the runner identity and recorded.
- **Production safety** (Core treats worlds as production-connected).
  - The GM sees pending migrations, with a dry-run count, in Core's admin or GM
    UI.
  - Each world either requires one GM approval per migration version or opts into
    automatic runs. Automatic runs could be the default for modules that mark a
    migration `safe` (key renames that only fix what the system itself ignores).
  - Reports list migrated, unresolved and failed items, with a backup
    recommendation before the first run.
- **Versioning.** An additive `module-api` minor version. Modules without
  migrations are unaffected.

## Alternatives considered

| Option | Why not (alone) |
| --- | --- |
| Route plus UI trigger in each module (prototyped) | Depends on a GM visiting; no tokens or packs; no ledger or lock; duplicated in every module. |
| Apply old keys at read time (compatibility mapping) | SheetDelver would show values native Foundry does not, and the stored data stays wrong. |
| Leave it to users (repair button) | Players and GMs should not need system-schema knowledge. |
| Direct Foundry transport or private Core imports from the module | Violates the module boundary and authorization model. |

## Shadowdark consumers ready for these contracts

- `src/logic/world-settings.ts`: one seam (`usePulpMode`, `autoConsumeAmmunition`).
  It currently returns native defaults labelled `native-default`.
- `src/logic/effect-key-migration.ts`: a pure planner implementing native
  `Update_251001_1.updateEffects` with two documented deviations. It already
  matches the `migrate(document)` shape and is covered by
  `effect-conformance.test.ts`.
- `src/server/api/migrations.ts`: the interim caller-bound route. It can be
  removed, or kept as an owner-level fallback, once Core runs migrations.

## Open questions for Core

1. Which identity runs migrations: the service account (does it hold GM write
   rights in every supported Foundry build?), or a connected GM?
2. Automatic, approval-required, or per-world configurable? What default?
3. Reaching unlinked token deltas and world compendium packs: does Core need
   scene/token write support first?
4. Rollback: snapshot before a run, or rely on the Foundry world backup guidance?
5. Where the ledger lives (Core persistence per world), and how it is shown in
   the admin UI.
6. Whether `worldSettings` should also allow a curated, read-only `core.*` set
   (e.g. tracker configuration) for modules.
