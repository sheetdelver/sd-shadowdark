# Proposal: module data migrations and world data access (Core/SDK)

Status: **Original module proposal, reviewed with corrections below — not implemented.** Written October 16, 2026
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


## Core review corrections — October 16, 2026

This preserves the original proposal as historical reasoning. The Core-aware
review at `ff65695` replaces the assumptions below; the implementation design is
**Core ADR-0064: Module World Context and Data Migrations**. Module corrections
remain in the [active audit review addendum](2026-10-15-native-alignment.md#independent-review-addendum--october-16-2026).

1. **Existing authority:** modules can already update owned Actors/Items/effects
   through caller-bound requests. The missing capability is Core-owned maintenance
   orchestration. CoreSocket already supports writes and confirmed Store ingress;
   configured service-account identity is not proof of GM authority. Do not borrow
   an arbitrary connected GM or make adapter initialization writable.
2. **Settings are rule inputs, not permissions:** SettingStore exists and excludes
   user-specific rows in its privileged world lookup. Foundry 14 has client, world
   and user scopes. No raw Setting dump or privileged lookup should be exported.
   Defaults apply only after a ready snapshot proves the world value absent;
   unreadable/invalid/version-unknown states are explicit. Namespace alone does
   not authorize client exposure. Declarations need schemas, source versions and
   audience policy.
3. **Lifecycle is essential:** same-world recovery does not initialize the adapter
   again. A settings hook alone leaves shared prepared Actors and module registry
   inputs stale. Add immutable context/dependency revisions and refresh before
   prepared publication, then filtered SDK invalidation. The module adoption is
   larger than replacing one function.
4. **Scene and pack infrastructure exists:** SceneStore already mirrors Token/
   ActorDelta trees, and Core has native version-aware pack-access rules in its
   combat manager. General SDK exposure is missing; do not propose a second scene
   cache or permissions engine. Maintenance can use narrow internal target
   handlers without exposing whole Scene documents to module UI.
5. **Migration safety is lifecycle correctness:** prefer a Core runner on an
   explicitly authorized service identity, automatic after an operator's bounded
   world/module grant. A module `safe` flag cannot grant writes. Use a fenced lease,
   durable per-target journal, server-derived world identity, conflict/readback
   handling and explicit partial states. SDK `commit` currently dispatches
   sequentially, so do not assume an atomic or single-round-trip batch.
6. **Completion is not permanent eligibility:** new old-format imports, concurrent
   clients and restored worlds can need repair after a version was marked complete.
   Reconcile source predicates/fingerprints at bootstrap; never advance the native
   system's own migration version. Preserve ActorDelta semantics and world-pack
   locks; package packs are excluded.
7. **Prototype is not ready:** its registered endpoint remains reachable despite
   the unwired UI. Slash-containing marker keys fail Core validation; paging starts
   at 1 while Core starts at 0. The planner returns a change plan rather than a
   document patch; current EC tests cover its replacement table, not direct planner
   or route execution. RV-02 records actual failing probes. Remove or repair/test
   the prototype instead of adapting it unchanged.
8. **Additional generic gaps:** expose effective caller/pack capabilities through
   host policy, and preserve canonical UUIDs in Actor detail projections. Do not
   return raw permission maps to adapters or conflate shared rule preparation with
   caller-specific authorization. Generic pack UUID reads currently do not inherit
   the combat manager's pack policy automatically.

No code, contract version, release metadata, native setting or world document was
changed by this review. Automatic migration is the desired future workflow, not
an operation performed or authorized against the current world in this pass.

## Admin upgrade ownership revision — October 16, 2026

The user subsequently selected **Core's admin upgrade workflow** as the migration
entry point. This supersedes this report's original post-ready/GM-triggered runner
and the Core review's standing automatic-bootstrap grant. Core ADR-0064 Decision 3
now defines release-declared migrations, a live-world dry-run, exact admin plan
approval and a durable maintenance job spanning file promotion, restart, document
migration, verification and candidate activation. Ordinary bootstrap only assesses
compatibility or resumes that approved job; it cannot start a new repair.

Module responsibilities are a dedicated, separately loadable pure planner entry,
versioned migration metadata/eligibility/dependencies, native schema tests and
lossless serialization. The release migration indicator is derived from packaged
requirements and verified against the archive. No privileged module SDK write
method or owner/GM repair fallback is selected. Retire the current migration
route/hook when adopting the contract; its confirmed RV-02 defects remain open.

Core's archive and admin restart machinery exists, but it currently checks package
governance only, deletes the prior package after registry success and has no
world-migration journal or maintenance drain. Core owns those changes. Required
world migrations block an active-module upgrade when the selected world is stopped;
admin starts it and reruns dry-run. Source switches, first install, other worlds,
restores and later old-format imports need explicit readiness/repair handling.

SheetDelver maintenance blocks its users while Foundry remains running. It does
not lock native clients or make world writes atomic. Core must check actual service
rights, source conflicts and data compatibility before rollback/downgrade. Offline
native database edits and automatic native-user kicks are deferred. The original
world-settings/context proposal remains live-update oriented and independent of
this upgrade workflow. No source or released contract has changed in this pass.

### Catalog and external-restore refinement

Core ADR-0064 now selects a conventional **root migration.json** mapping native
system milestones (e.g. Shadowdark4.0.6, not module0.9.4 or Foundry14.367) to
`migrations/<version>/` directories. Each holds `definition.json` and pure
check/plan/verify logic, compiled for distribution. Definitions declare affected
scopes/dependencies; hooks handle conditional/custom transformations. Migration
maps and logic paths are removed from the proposed info.json surface. Release
metadata may summarize catalog presence/integrity, derived from the same catalog.

Required checks run on fresh source at every bootstrap/replacing reconciliation,
even when Core's journal says completed. Restored legacy data, a failed check or
unknown required compatibility blocks world readiness: clients see unavailable;
admin sees the module/step/reason and can prepare a same-version repair job. The
module cannot initiate repair from those checks or writable initialization.

Core's existing socket already writes as the configured Foundry user. Native
v13/v14 source enforces that identity's document permissions; Core's proposed
connection policy now requires a full-GM service account in every served world,
not only for migration. Enforcement and targeted native acceptance remain pending. Modules get no elevated request runtime.
Native-user lockout is excluded. The first delivery supplies no world backup,
restore or migration undo; admin acknowledges that limit and is advised to back
up through Foundry. Journal/readback/resume remain, and an external restore is
rechecked. These refinements supersede broader rollback/lockout suggestions above.

The user confirmed this as a general Core startup requirement: an Assistant or
unknown service-account role blocks readiness with an admin-only instruction to
change that account to Gamemaster in Foundry and retry. ADR-0064 G0a covers initial
connection, reconnect/world switch and active demotion. It does not restrict human
Assistant users or let modules promote accounts. Operator docs now state the role;
no source enforcement or live promotion has occurred in this documentation pass.
