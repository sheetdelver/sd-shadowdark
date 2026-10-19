# Shadowdark module working agreement

Read this file, then `temp/AGENT-HANDOFF.md` when present and the module-owned
ADR/audit it names. Read [module architecture](docs/architecture.md) for technical
context. The Core handoff is not this repository's work queue.

## Scope and repository ownership

This is an independent SheetDelver system-module repository. Keep its code,
tests, documentation, audits and handoff here. Core and sibling modules are
read-only unless the current user explicitly selects work in those repositories.
An unavailable host contract is an external dependency to report, not permission
to edit Core, import private host code or add a direct Foundry transport.

Use public `@sheet-delver/sdk` entry points. Core owns source/prepared stores,
authorization, world/session lifecycle and shared chat, notifications and dice
presentation. The module owns system rules and its UI. Keep browser UI,
server-only orchestration and environment-neutral rules separated. Do not add a
second world cache/lifecycle or treat module-prepared data as native browser data.

## Git and release boundaries

- Check this repository's branch, status and version before work. Preserve
  unrelated changes, stashes, parked research and native reference checkouts.
- Feature implementation belongs on a user-authorized module branch, not main.
  A task that explicitly authorizes a branch needs no repeated permission.
- Other Git mutations and remote writes need their own scoped user authority.
  Do not infer commit/push/merge/tag/release permission from implementation work
  or an earlier release. Do not reset, discard or rewrite unrelated history.
- When a PR merge is authorized, use squash merge with branch deletion after
  required checks pass; verify merge and removal of that feature branch.
- `info.json` owns module version/compatibility. During implementation, prepare
  terse changelog notes without version bumps. Do not change Core versions,
  compatibility minima or CI toolchain pins as incidental housekeeping.
- Follow this module's CI/release workflows and the host's documented packaging
  contract. Release publication is a separate authorized operation.

## Data and verification discipline

- Native source fields, prepared results and caller-visible projections are
  distinct. Preserve canonical identities and original source data.
- Use native rules for the selected release. Record version/source provenance.
  Missing data must produce a clear unavailable/unsupported state, not invented
  formulas, dice, defaults or same-name document substitutions.
- Share preparation/action logic across sheets, cards, dialog defaults and
  server execution. UI may format/filter/select; it must not duplicate rules.
- Route caller operations through the public request runtime. Keep permission,
  privacy, source-preservation and failure behavior in regression coverage.
- Use SDK rich-text/URL handling and shared roll/confirmation components.
  Never use native browser alert/confirm/prompt for application flows.
- Treat host .env/settings as production-connected. Do not start Core or connect
  to live Foundry for a test without task-specific authority. Prefer offline
  fixtures and isolated outputs; never copy credentials into documentation.
- Browser tests are isolated development tools, not runtime/backend dependencies.
  Inspect listeners before starting/stopping a needed service and record any
  retained test process in the local handoff.
- Match tests to changed behavior. For confirmed defects, establish a meaningful
  failing case, then prove the fix with the same input and an independent oracle.
  Passing mocks/prepared fixtures do not establish native/operator acceptance.
- Native browser comparisons and Core browser sessions use separate disposable
  accounts. Serialize probes that change the same user's permissions/settings
  or log that user out; session interference is not a product acceptance result.

## Documentation ownership

- `AGENTS.md`: durable working rules and verification entry points.
- `CLAUDE.md`: imports this module's AGENTS.md; do not maintain a second rules copy.
- `temp/AGENT-HANDOFF.md`: one replaceable local task snapshot, when present.
  Keep verified facts, user reports, unknowns, permissions and next steps distinct.
  `temp/` is ignored; a missing local handoff is not an error in a clean clone.
- `docs/architecture.md`: technical behavior and supported boundaries.
- `docs/adr/`: module decisions/plans; `docs/audits/`: durable findings/evidence.
  Number ADRs independently in each module, starting at 0001; identify Core
  decision references explicitly as Core ADRs.
  A handoff names one active module audit. Preserve historical reports and
  deferrals; old unchecked research does not become active work by itself.
- Keep tracked decisions understandable without ignored reports. Do not use
  architecture/ADR/audit files as repeated agent startup or permission notices.
  Record scope decisions once in the decision record and current authority in
  the handoff. Update documentation and tests with the implementation.

## Shadowdark rules and current design constraints

Use the native item/template's actual damage, properties, formulas and actions.
Keep Player and NPC schemas distinct, including NPC explicit ability modifiers
and AC. Preserve independent fixed/rolled mastery grants, exact choice counts,
multi-change effects and source templates; unresolved required choices must
block the affected write before creation.
Advancement follows native `LevelUpSD._finalizeLevelUp`, including XP carryover
above level zero and first-level HP from the hit die plus prepared CON (minimum1).
Generator and server share `logic/advancement.ts`; prepare grants before HP.
Advancement completion requires all grant receipts and the final Actor patch;
a target-level event is not completion. Keep exact confirmed IDs, frozen HP/XP
and request identity through retries. Fully dispatched advancement may settle automatically when the exact final
Actor source and every confirmed grant ID match. This updates module receipts
only; it never repeats a Foundry write. Partial writes and unknown grant IDs
retain explicit exact-source review; never recreate from names/origins or silently
start a replacement.
Document consumers must use the route's actual bare-document response shape.
Use native source and handler comparisons for these rules;
successful writes alone do not establish parity.

The active post-release plan is [Shadowdark ADR-0002](docs/adr/0002-native-data-and-behavior-parity.md),
with findings SD02-01–13 in the [native parity audit](docs/audits/2026-10-18-spellcasting-and-native-parity.md).
SD02-R1–R3 have corrective implementation and offline regression evidence
(advancement recovery, final creation validation and management-source refresh).
SD02-R1b has independent offline verification: acknowledged writes keep exact IDs
through bookkeeping failures and require primary-source reconciliation before
continuation. SD02-R1a-R1 permits zero-write retirement even when an independent
Actor edit invalidates the old source snapshot. Preserve that edit and require
fresh preparation; never require the player to undo unrelated changes when this
operation made none. Partial/unknown outcomes never qualify for a zero-write
restart. SD02-V1 adds the maintained advancement, final-creation and native-parity
handler suites to CI using the pinned static native reference below.
Native v14 evidence is recorded in the
[acceptance report](docs/audits/2026-10-19-adr-0002-native-acceptance.md).
SD02-N14-01/02 are corrected with offline and targeted native v14 evidence.
Caller projection refresh settles proven complete advancement or retires proven
zero-write attempts under the Actor queue. Only unresolved operations expose the
caller-safe review indicator, independent of XP. UI never edits receipts directly;
server bookkeeping transitions preserve the original record and never write
Foundry documents. Recovery opens its saved request without new Class preparation.
Malformed selection input returns typed validation errors before writes.
The selected A02-01–15 v14 matrix is complete on the final corrected archive;
v13 and final D6/D7 closeout remain open. Use the native report’s current ledger
instead of historical pending paragraphs. Correction checkpoint: `b962bf0`.
Follow its checkpoints; do not treat its existence as branch, live-write or release authority.
[ADR-0001](docs/adr/0001-native-alignment-and-resource-cards.md) and the
[native-alignment audit](docs/audits/2026-10-15-native-alignment.md) remain completed
within their selected scope. Their released-system baseline, future-version
exclusions and explicit deferrals remain. Local source checkout details belong
in the handoff. Existing legacy effect fixtures do not establish v14 serialized-effect parity.

Spell corrections must distinguish actor class, active casting grants, alternate
spell-list identity, progression table and optional source provenance. Never
infer a casting grant from a class name or infer a Spell identity from its name.
Owned spell identity is the Actor plus embedded Item ID; catalog filtering must
not hide or implicitly remove owned items. Preserve custom/source-less and
duplicate copies. Successful effect-key migration is not proof that all native
character content exists. Diagnose missing data and prove repair preconditions
before proposing new admin migration steps; keep applied history unchanged.

Compare native behavior in order as well as final values. Limited-use abilities
spend before rolling/posting; Potion identification swaps active/alternate
name/description and enables effects before consumption. Maintain ordered source/receipt regressions for SD02-09/10; action descriptions alone are not execution evidence.
Player focus is not an NPC exemption, and zero disables a native critical
threshold. Languages use native rarity and separate explicit class/ancestry choice
counts/pools, not English name inference or a nonempty-options fallback. Maintain
the audit's coverage matrix and distinguish controlled native-method probes from
real Foundry acceptance. F01–F06 feature proposals remain separately scoped.

Effect definitions come from native data only: compendium documents (copied
with their effects) and `src/data/native-predefined-effects.ts`, generated from
the pinned `config.mjs`. Never hand-write effect keys or tables. Pre-4.0 keys are
reported with native's own migration replacement (`logic/legacy-effect-keys.ts`),
not applied. `effect-conformance.test.ts` must keep every native pack key mapped
to a consumer (`logic/effect-key-coverage.ts`); when the supported native release
changes, regenerate the key snapshot and predefined effects and rerun it with
the native reference present.

Compendium content reaches callers only through the `server/access.ts` policy:
Core's `req.runtime.access.canReadPack` for every pack, checked after awaited
cache reads, with no fallback when `access` is absent. `getSystemDataForUser`
builds from the caller's own reads; never serve the warmed registry projection
to a caller another way. Action routes keep request identity bound to runtime,
user, Actor and body, recheck access on replay and never reroll after a context
change.

World settings come only from Core's world context (`info.json.worldSettings`,
`context.world`, `req.runtime.world`, prepared `derived.ruleInputs`); never read
Setting documents or substitute a default for an unavailable value.
Setting-dependent requests send the prepared context revision, and routes map a
context retired mid-request to 409 through `contextConflict`. Browser caches of
caller data follow `ui/context/system-index-store.ts` (new generation per scope
or context change; current index data or an explicit failure). Active collection
consumers use `useShadowdarkCollections`: declare demand, observe each required
collection's loading/ready/failed state, show its reason and retry, and require
all relevant collections before enabling dependent actions. Empty successful
collections are ready; failed reads are never empty-success. Do not copy shards
into component state or rely on a stable `fetchPack` callback to signal refresh.
Core 0.19.2 corrects CG-9: ownership-only changes publish the existing
`world:contextChanged` hint, including events with empty `keys`. Consume that
event without requiring a changed module-setting key; never read Setting
documents or poll privileged data. Verify mounted consumers across revoke,
restore, late responses and reconnect on the released host.
Actual consumer browser regressions supplement the store suite. Data repair runs only as packaged pure hooks in
`migrations/<native version>/` through Core's admin job; never add a caller
route, initialization or render path that migrates. The root `migration.json`
is active. Hooks read only declared relations (module-api 1.6), never whole-kind
references; keep `ActorDelta` a target kind so Core enumerates token deltas. A
delta Item's type is its own stored `type` (Foundry replaces, never merges, base
Items); never borrow a base Item or Actor type for it. Changing a published or
applied step needs a new stable step ID. Live world writes retain their scoped
authorization boundary.

Resource details must consume the shared prepared view/action path. Future Core
card SDK/encounter features and historical Actor repair are separately scoped.
Migration step requiredness is a correctness policy, not a lock-error workaround.
Both effect-key steps are required. Core 0.19.2 uses native lock precedence:
`core.compendiumConfiguration[packId].locked` overrides the verified package
ownership default; world packs default unlocked. `metadata.locked` is not an
override. Explicit locks, unreadable configuration or unknown provenance still
block required scope; never auto-unlock, elevate or downgrade failures.
Intentional-lock exclusions require a separately selected host policy, not
`required: false`. Keep tests faithful to the actual Setting contract.
Core 0.19.2 also fixes CG-10 (SDK error recognition across managed JS boundaries)
and CG-5 (shared roller keyboard/layout behavior). Reuse public SDK error and
modal components and test the installed archive; do not copy these fixes into
the module. The ADR records RV-12/13 adoption evidence and separates
Core native evidence from the module's completed, scoped A01 acceptance. CG-4/6/8
retain their qualified status; no Core changes are authorized by module work.

## Verification commands

Run from a configured Core/toolchain checkout with this repository available at
`data/local/modules/shadowdark` (or adapt that path to the isolated CI data root):

```sh
npx tsx data/local/modules/shadowdark/src/tests/weapon-rules.test.ts
npx tsx data/local/modules/shadowdark/src/tests/prepared-actor.test.ts
npx tsx data/local/modules/shadowdark/src/tests/actor-enricher.test.ts
npx tsx data/local/modules/shadowdark/src/tests/presentation.test.ts
npx tsx data/local/modules/shadowdark/src/tests/roll-feedback.test.ts
npx tsx data/local/modules/shadowdark/src/tests/importer-mapping.test.ts
npx tsx data/local/modules/shadowdark/src/tests/native-alignment.test.ts
npx tsx data/local/modules/shadowdark/src/tests/boundaries.test.ts
npx tsx data/local/modules/shadowdark/src/tests/action-phases.test.ts
npx tsx data/local/modules/shadowdark/src/tests/languages.test.ts
npx tsx data/local/modules/shadowdark/src/tests/effect-conformance.test.ts
npx tsx data/local/modules/shadowdark/src/tests/world-adoption.test.ts
npx tsx data/local/modules/shadowdark/src/tests/migration-hooks.test.ts
npx tsx data/local/modules/shadowdark/src/tests/system-index.test.ts
npx tsx data/local/modules/shadowdark/src/tests/native-parity.test.ts
npx tsx data/local/modules/shadowdark/src/tests/advancement-recovery.test.ts
npx tsx data/local/modules/shadowdark/src/tests/creation-validation.test.ts
node data/local/modules/shadowdark/src/tests/verify-types.mjs
npm run module:check -- shadowdark
```

Root TypeScript excludes module source; explicitly include the module when
checking types. Use isolated package output when validating distribution.
The current workflow is `.github/workflows/ci-shadowdark.yaml`; inspect its pinned
host version before running compatibility checks. Tools may run from Core,
but module work does not authorize changing Core files or generated settings.
CI checks out `Muttley/foundryvtt-shadowdark` at
`9677d16b3903b3b640f00d4efd48249142ac8334` (release-4.0.6) into the isolated
toolchain's `temp/shadowdark`. All 17 source suites run against that static
reference; missing required native fixtures fail rather than silently skip.
This is source-only testing and does not require a running Foundry service.

Maintained consumer checks: `src/tests/collection-consumers.browser.mjs` renders
the actual providers/pickers/Spells/Generator with a controlled SDK boundary and
blocks outgoing browser traffic. CI installs Playwright 1.56.1 in a temporary
directory, outside runtime dependencies. Locally set `SHADOWDARK_PLAYWRIGHT_MODULE`
to that install's `index.mjs` and, if needed, `SHADOWDARK_CHROME` to a browser
executable, then run `node <module>/src/tests/collection-consumers.browser.mjs <out>`.

Maintained real-host checks: `src/tests/pack-maintenance.core.ts --run-isolated
--archive=<tgz> --out=<new-dir> --generation=13|14 --locations` via the pinned toolchain's
`tsx`. `SHADOWDARK_CORE` selects a configured, read-only Core v0.19.2 checkout;
`SHADOWDARK_NATIVE_REFERENCE` selects the static release-4.0.6 source checkout.
`SHADOWDARK_FOUNDRY_REFERENCE` optionally selects the static generation's native
client source (otherwise `Core/temp/foundry-v13.mjs` or `foundry-v14.mjs`) for
lock-contract provenance. The harness copies Core into its output, binds random loopback ports, uses the
public bootstrap CLI/admin workflow and a controlled upstream, and stops its
services. `--inventory=30,30 --inventory-only` (or `60,40`) repeats eligible
pack completeness/oracle/restart/restore checks. Never point this harness at an
existing data directory or Foundry service. This is simulated upstream evidence,
not native acceptance. Lock fixtures use `core.compendiumConfiguration`, with
absent/null/false eligibility and explicit-lock/unreadable/malformed/provenance
failures. Results record observed Core version/commit and archive/native-source
hashes; omitted scopes are explicitly skipped. Both required hook identities
and applied history must remain unchanged.

`src/tests/installed-consumers.core.ts` accepts the same archive/output/generation
arguments plus `--production` (public build/start) or `--focus-only` (explicitly
omits the width/theme matrix). It uses public archive preview and maintenance
entry/review/approval, real Core SDK/components and mounted module consumers.
Set the same isolated Playwright/browser variables as above. Production copies
dependencies inside its workspace for Turbopack confinement. Test-owned trust
override/backup acknowledgement apply only to its disposable data directory.
Never reuse operator settings or claim these controlled-upstream checks are native.
`--probe-reconnect-write` reduces verification to a same-session OWNER write
before/after transient transport loss. `--server-disconnect` selects an explicit
native session kick instead; keep that diagnostic result separate from ordinary
reconnect and never add automatic relogin to make it pass. Resource dialog tests
also cover floating-tool clearance and yielding to shared SDK dialogs.

ADR-0002 regressions additionally run `src/tests/native-parity.test.ts` and
`node --import tsx src/tests/native-parity.oracles.mjs` from the configured Core
toolchain, with the read-only native4.0.6 reference available. `--baseline` records
known failures and is never passing acceptance. Caller-bound spell dependencies
remain request-local and use the common preparer; never warm private world
Class/Spell documents into the user-invariant registry.

Spell inventory management uses explicit additions and owned Item-ID removals;
never derive deletion from catalog membership. The shared spell catalog exposes
partial-source failures, and native sourceFilters affects browsing only. Durable
operation receipts may reconcile confirmed IDs, never guessed names/origins;
partial operations from another process need fresh review.

Actions have prerequisite, one-result-attempt and consequence phases. Preserve
confirmed spending/identification on later failure. Unknown roll/chat receipts
never authorize another result call; partial durable records without a process
continuation require fresh review. Potion effect activation is a complete native
group with exact owned parent/IDs. Actor-specific focus and zero critical
thresholds belong to the shared action model.

Language rarity comes only from system.rarity; unknown remains unclassified.
Creation uses native Class/Ancestry fixed/common/rare/select fields with separate
restricted pools and server validation. No implicit Common/INT or Background
allowance is added. Ordinary inventory editing has no creation quota and retains
custom/unreadable entries. Source filters constrain browsing, not fixed grants.

For owner-bound operations, SDK strict get reads can return null at a higher
threshold even when observer-visible. Use the shared requireOwnedActor guard to
retain403 versus concealed404 semantics. Context revalidation preserves mounted
manual state but retires action callbacks/results; keep both browser regressions.
Actor creation uses the caller SDK route, never the generic writer that strips
native Item string arrays. Level-one creation revalidates the exact native plan
at the final writer; earlier UI/preparation success never validates a changed
Actor body. Preserve the complete prepared grant multiset and separate ordinary,
fixed and extra spells; ordinary inventory/import flows have distinct authority.

World Spell catalog changes use public Item document/detail-directory hints,
coalesced through the existing shared store; cover loaded and pending consumers.
Advancement HP dice come from the exact selected Class; missing source is an
explicit failure, not an owned-copy or generic-die fallback.

Corrective advancement coverage: `src/tests/advancement-recovery.test.ts` and
`src/tests/parity-corrections.browser.mjs` (offline mounted consumers). Native
pack fixtures use the pinned read-only source; no transports/services are needed.

Final creation regressions: `src/tests/creation-validation.test.ts` (real writer
and shared preparation with exact pinned native sources).

Open spell management keeps stable Class/tier identity and derives current list/
progression facts. Retire intent on those facts, preserving search and exact
original operation receipts. Corrective mounted checks run in CI.

Final archive offline verification: `node src/tests/packaged-corrections.mjs
--archive=<tgz> --out=<new-output> --core=<configured-toolchain>`. This executes
compiled public apiRoutes with `@sheet-delver/sdk/testing`, not a live host. Core
archive preview must retain its full-GM deployment guard when no service account
is configured; do not invent credentials or bypass it to label an offline install
passed. Source suites, compiled contracts and native acceptance are distinct.
