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

The native-alignment plan is [Shadowdark ADR-0001](docs/adr/0001-native-alignment-and-resource-cards.md),
with evidence in the [native-alignment audit](docs/audits/2026-10-15-native-alignment.md).
Its released-system baseline and future-version exclusions are explicit there;
local source checkout details belong in the handoff. Existing legacy effect
fixtures do not establish v14 serialized-effect parity.

Effect definitions come from native data only: compendium documents (copied
with their effects) and `src/data/native-predefined-effects.ts`, generated from
the pinned `config.mjs`. Never hand-write effect keys or tables. Pre-4.0 keys are
reported with native's own migration replacement (`logic/legacy-effect-keys.ts`),
not applied. `effect-conformance.test.ts` must keep every native pack key mapped
to a consumer (`logic/effect-key-coverage.ts`); when the supported native release
changes, regenerate the key snapshot and predefined effects and rerun it with
the native reference present.

Compendium content reaches callers only through the `server/access.ts` policy
(`resolveDocumentFor` with the caller, caller-filtered index and collections);
do not add a route that reads restricted packs another way. Action routes keep
request identity bound to runtime, user, Actor and body, and recheck access on
replay.

Resource details must consume the shared prepared view/action path. Future Core
card SDK/encounter features and historical Actor repair are separately scoped.
Core-owned findings in the audit remain external dependencies; never hide them
with guessed values or label them fixed without evidence.

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
npx tsx data/local/modules/shadowdark/src/tests/effect-conformance.test.ts
npm run module:check -- shadowdark
```

Root TypeScript excludes module source; explicitly include the module when
checking types. Use isolated package output when validating distribution.
The current workflow is `.github/workflows/ci-shadowdark.yaml`; inspect its pinned
host version before running compatibility checks. Tools may run from Core,
but module work does not authorize changing Core files or generated settings.
