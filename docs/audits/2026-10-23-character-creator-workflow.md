# Character Creator workflow audit

Date: 2026-10-23
Status: Header/UI correction accepted; remaining Creator gates open
Decision: [ADR-0005](../adr/0005-character-creator.md)

## Scope and evidence

The user requests a manual, step-based tool for reproducing a paper character at
level 0–20, with optional rolls. It is separate from random generation and the
Shadowdarklings importer. This audit inspected module source at checkpoint
`5ea2bc3` and static native Shadowdark 4.0.6, commit
`9677d16b3903b3b640f00d4efd48249142ac8334`. No Foundry connection, write, service
startup or new implementation test was performed for this planning audit.

Monster Stats is checkpointed in `5ea2bc3`. The prior
[presentation audit](2026-10-20-presentation-regressions.md) retains its evidence
and remaining review qualifications. The user's final artwork report was
“it's fixed now,” followed by authorization to checkpoint. This audit does not
close all of ADR-0003 or the settings pilot in ADR-0004.

## Findings

| ID | Verified source behavior | Consequence for the creator |
| --- | --- | --- |
| CC-A01 | `src/ui/tools/Generator.tsx` offers levels 0/1, prepares first-level grants, assembles Player data and posts to `characters/create`. `src/server/api/languages.ts::handleCreateCharacter` expressly validates levels 0/1 and re-prepares the creation plan. | Reuse assembly and validation primitives; a new arbitrary-level plan/commit boundary is needed. Do not relax the existing guard or bypass its source review. |
| CC-A02 | `src/server/api/level-up.ts::finalizeLevelUp` requires the next level only; existing-Actor advancement uses locks, durable receipts and embedded writes. | Do not create a temporary world Actor and run advancement repeatedly. Build a virtual draft; create the finished Actor only at confirmation. |
| CC-A03 | Native `_fields/actorFields.mjs::level` has integer/minimum 0 and no maximum. Native `models/items/ClassSD.mjs::spellsknown` defines levels 1–10 and tiers 1–5; `apps/LevelUpSD.mjs::getData` explicitly reads progression only through 10. | Accept requested levels 0–20; do not label extrapolated spell slots or unsupported high-level grants as native rules. Preserve explicitly entered higher-level content with the limitations in ADR-0005. |
| CC-A04 | `logic/actor-preparation.ts` applies supported Item effects before exposing effective abilities and HP. Native `LevelUpSD._finalizeLevelUp` adds grants before reading CON. `logic/advancement.ts` adds CON only for first-level HP, minimum 1; later levels add the hit-die total. | Paper scores/max HP may already include bonuses. Adding the same effects to those numbers doubles the bonus. Require a source/effective-value reconciliation with a prepared round-trip assertion. Manual HP must not require invented historical rolls. |
| CC-A05 | `server/importer.ts` expects Shadowdarklings `rolledStats`, uses `json.level || 1`, subtracts certain transferred additive HP effects, then creates the Actor and Items separately. | It is not a general paper import engine; its level-0 fallback, export-specific bases and partial-write loop must not be copied. Its HP subtraction is evidence of this problem, not a general inverse-effect solution. |
| CC-A06 | `level-up-engine.ts::calculateAdvancement` handles odd-level talents, patron alternatives and talent handler additions; it sets first-level required boons to 1. Native `LevelUpSD.getData` reads `class.system.patron.startingBoons`. `validateState` mostly checks minimum selection counts. | Extract a testable requirement plan that respects native data and independent choice slots. Existing advancement is a reuse candidate, not proof that arbitrary-level counts are correct. Compare native cases before changing shared behavior. |
| CC-A07 | `level-up-engine.ts::getChoices` filters instruction prose and deduplicates by name. `assembleFinalItems`, `logic/stat-choices.ts` and `logic/talent-choices.ts` resolve concrete effects and required allocations. | Keep result groups and exact UUIDs. A table result containing several Items is one award, not several independent talent selections. Preserve repeatable awards and distinct same-name sources. Reuse the resolved-choice validators, not name deduplication. |
| CC-A08 | `logic/spell-grants.ts`, `server/spell-grants.ts` and advancement assembly separate fixed grants, ordinary spells and extra choices. Grant flags record casting Class and acquisition level. | Automatically materialize fixed spells; reserve one choice per extra grant; exclude known/fixed/selected spells canonically. Noncaster spell grants must survive. Shune's tier depends on acquisition level, not final character level. |
| CC-A09 | `logic/languages.ts` and `server/languages.ts` model fixed languages and separate native choice pools. Existing server validation checks the exact selection set. | Reuse pool-aware validation and current picker behavior. A transcription exception must be explicit, not a fabricated extra class allowance. |
| CC-A10 | `Generator.tsx` has editable scores and calls `actors/randomize/stats`; `server/api/randomize-character.ts` currently generates all six 3d6 scores with `Math.random`. Native `CharacterGeneratorSD._randomizeStats` rolls 3d6. | Reuse the input layout and native formula. Use the public roll runtime for new explicit dice controls; single-stat rolling should not reroll all six behind the scenes. Share any extracted helper without broad generator redesign. |
| CC-A11 | `module/ui.tsx` already registers player tools. Gear/compendium selectors, level-up sections, rich text and the shared dialog shell exist. `ownedCopy` preserves native Item effects. | Add `creator` through existing registration. Reuse source selectors and stateless sections after extracting their live-Actor coupling. Equipment is current inventory, not a level-derived allowance or mandatory starting kit. |
| CC-A12 | Public SDK `DocumentStore.create` accepts one Actor payload; the current creation route includes owned Items. `DocumentOpOptions` exposes no idempotency key or `keepId` option. The SDK supplies scoped `dataStore`, list/get and caller-aware writes. `advancement-operation.ts` receipts are keyed to an existing Actor. | One request is preferable to sequential writes, but is not an exactly-once or atomicity guarantee. Add a creator-specific operation record and prove safe outcome reconciliation before shipping. Do not assume caller-supplied Actor IDs survive or reuse an Actor-bound advancement journal unchanged. |

Native references above are relative to the pinned repository's `system/src/`;
the module's CI already checks out that exact static reference. Source entry:
[native 4.0.6 reference](https://github.com/Muttley/foundryvtt-shadowdark/tree/9677d16b3903b3b640f00d4efd48249142ac8334/system/src).
Core SDK inspection used `src/shared/sdk/runtime.ts` and
`src/server/shared/utils/moduleDocumentServices.ts` in the local Core 0.21.0
checkout, read-only. Existing module floors must also be verified during delivery.

## Recommended workflow and implementation gates

Use the seven stages and CC-01–CC-08 tasks in ADR-0005. The critical gates are:

1. Explicit distinction between entered paper totals and native source values,
   proven by preparing the assembled Actor with all selected effects.
2. A requirement/award model preserving exact table outcomes, repeatable grants
   and acquisition-sensitive choices without demanding an invented life history.
3. Manual content entry at levels beyond available progression, with clear review
   warnings and no generated slots, automatic clamping or fabricated tier rules.
4. One final creation dispatch, caller-bound durable receipts and no automatic
   retry after an unknown outcome. Source/permission changes must invalidate the
   review before writing.

## Unverified and intentionally separate

- No native acceptance of arbitrary-level creation, effect reconciliation,
  creation marker preservation or interrupted-create recovery is claimed.
- Custom system versions/content can differ from the pinned fixtures. Missing
  source data must remain unavailable; no same-name substitutions.
- The exact native representation of any manually recorded exception must be
  proven during CC-01/02. Do not inject unsupported effect keys or new casting
  permissions to force a match.
- Persistent editable drafts, bulk import, multiclass rules, modifying existing
  Actors and new Core contracts are not part of this plan.
- Prior deferred work remains deferred. ADR-0001/0002 remain closed. This report
  becomes the active module audit for the selected creator planning scope;
  historical presentation findings remain in their linked report.

## Implementation evidence — October 23

The planning findings above describe the `5ea2bc3` baseline. Current uncommitted
implementation adds typed draft/award contracts, source-based requirement and
numeric planners, creator preparation/roll/HP routes, the seven-stage wizard and
a caller/world-bound final-dispatch journal. Existing Generator level0/1 guards
and the advancement one-level writer remain intact.

`creator-contracts.test.ts` uses pinned native4.0.6 source documents; its starting
boon regression first failed (`1 !== 3`) and now passes using Class data.
`character-creator.test.ts` exercises the real creator planner/routes/journal and
public SDK testing boundary. Twenty controlled groups pass, covering levels,
paper/base round trips, repeated awards, injured HP, native fixed Turn Undead,
Shune chronology/noncaster casting provenance, unknown high-tier rejection,
review changes, same-ID/double-submit serialization and uncertain recovery.
Logs: `/tmp/sd-creator-contracts-baseline.log`, `/tmp/sd-creator-tests.log`.
These are offline facts, not native-client/operator acceptance.

Positive marker/source evidence can reconcile receipts without another write.
Absent/ambiguous/edited or non-owner-readable evidence never authorizes a new
creation. Public create has no keepId/idempotency guarantee; the process queue
does not claim a cross-process transaction. The exact operation marker and
normalization still need native13/14 acceptance under separately scoped authority.

Public tool navigation has no dirty/discard hook. Only settings panels expose
`onDirtyChange`; the creator cannot use that contract to guard shell navigation.
Creator-owned Dashboard navigation uses SDK confirmation. This is a precise
external CC-04 dependency; no Core modifications/private imports are authorized.
Final mounted, released-floor and distributable evidence follows below, retaining
the limitations rather than inferring native passes.

## Final offline verification

The earlier implementation paragraph records the first20 passing groups. The
final creator suite now passes **28/28**, adding all bonus-Spell families,
independent Warlock allocations, the real native Amulet of Vitality override,
legacy scroll/wand states, typed zero-write preflight, explicit nonrepeatability,
nested UUID/order preservation, v13/v14 effect-shape comparison and immutable
confirmed outcomes after later Actor edits. Its seven nonrepeatable sources are
independently checked against native prose; Black Lotus explicitly permits keeping
duplicates, and Force GM Reroll remains an independent repeatable award.

| Evidence | Result / limits |
| --- | --- |
| Source suites | All21 pass using configured read-only Core0.20.0 and static native4.0.6. Includes creation-validation, advancement-recovery, native-parity, preparation, languages, effect-conformance and both new creator suites. The starting-boon regression uses a native Class clone with startingBoons3 to prove field consumption; it does not claim a stock three-boon Class exists. |
| Creator mounted source |5/5 groups:390/1280 manual wizard, Back, no preview writes/default rolls, explicit replacement confirmation, actual Gear Add callback, exact repeated-grant/mastery submission, paper STR16→source12→prepared16, current HP0, delayed review and explicit status retirement across callers. Network blocked; request bindings call real offline planner/routes. |
| Retained mounted consumers | Monster Stats6/6; corrective advancement/Spells18/18. Shared compendium selector keeps its existing default shell and offers the creator an opt-in ModuleDialog frame. |
| Released-floor typing / contract | Explicit module typing and module:check pass with Core0.20.0. UI wire types are environment-neutral; no server imports leak into UI. CSS is scoped below `.sdk-module--shadowdark`. |
| Final compiled creator | Public archive API/Adapter with SDK/testing passes numeric round trip, one complete payload with repeated grants/spent scroll/quantity, replay, uncertain recovery and revoked-source zero-write preflight. Retained packaged-corrections probe also passes. No Core service/native transport used. |
| Final archive UI/styles |5/5 mounted groups using actual dist/ui.js, assets/shadowdark.tailwind.css and declared assets/presentation.css. These are controlled SDK mounts, not installed-world/native acceptance. Reviewed phone/desktop screenshots; no horizontal overflow, square controls/serif headings/heavy borders retained. |

Archive built with Core0.20.0:
`/tmp/sd-creator-package-7qjp_cbm/dist/modules/shadowdark-0.9.6.tgz`, SHA256
`09f696e3779b5ff98e6529f3dc59ba171e3b42383bb7abfbece6626b1616daf5`.
Final documentation/evidence updates do not alter its runtime bytes; the README
creator feature/acceptance qualification is included. No version/floor/pin change.

Evidence logs: `/tmp/sd-creator-{contracts,tests,floor-types,contract,package}.log`,
`/tmp/sd-creator-regressions.json`, per-suite `sd-creator-regression-*.log`,
`/tmp/sd-creator-{browser,monsters,existing-workflows}.log`,
`/tmp/sd-creator-compiled-final.log`, `/tmp/sd-creator-retained-compiled.log`, and
`/tmp/sd-creator-final-archive-browser.log`. Screenshots/results under
`/tmp/sd-creator-final-archive-browser`; phone and desktop review images inspected.
Initial harness path/dependency/CSS issues were corrected before passing runs;
they are not counted as acceptance failures. All browsers close; no retained service.

Reproduce from a configured Core checkout, adapting `MODULE` to the module path:

```sh
npx tsx "$MODULE/src/tests/creator-contracts.test.ts"
npx tsx "$MODULE/src/tests/character-creator.test.ts"
SHADOWDARK_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs npx tsx "$MODULE/src/tests/character-creator.browser.mjs" /tmp/new-creator-browser
node "$MODULE/src/tests/verify-types.mjs"
npm run module:check -- shadowdark --data-dir /tmp/isolated-module-data
npm run module:package -- shadowdark --data-dir /tmp/isolated-module-data
node "$MODULE/src/tests/creator-packaged.mjs" --archive=/tmp/isolated-module-data/dist/modules/shadowdark-0.9.6.tgz --out=/tmp/new-creator-compiled --core="$PWD"
```

The isolated data root contains only a copied module and toolchain dependency
link; it is never operator data. `SHADOWDARK_NATIVE_REFERENCE` selects the static
native checkout for new creator fixtures; older suites use `SHADOWDARK_NATIVE`.
The compiled probe writes `ui-paths.json`; the mounted runner accepts its `ui`,
`css`, `presentation` paths via `SHADOWDARK_CREATOR_UI`, `SHADOWDARK_CREATOR_CSS`,
`SHADOWDARK_CREATOR_PRESENTATION` for archive-byte verification.

CC-07 is pending separate native test-world authority: compare all six selected
transcript families on native13/14, including marker round-trip, schema defaults,
prepared/native score and HP equality and interrupted creation without duplicates.
Shell-initiated discard protection remains the precise missing public tool SDK
capability. Offline checkpoint readiness does not waive either gate or grant
Core changes, Git mutations or release authority. ADR0001/0002 remain closed.

## Independent review and operator UI correction — October 23

D&D work was separately checkpointed and paused. This review did not modify its
runtime or Core. Shadowdark remains on `fix/restore-module-presentation`, based
on `5ea2bc3`, with all creator changes uncommitted.

Fresh bounded review on Core0.21.0 passed creator contracts, all28 creator
planner/writer cases and five mounted workflows at390/1280. Source inspection
confirmed one final Actor payload, durable dispatch fencing and distinct
paper/base comparisons. These are controlled SDK tests, not native acceptance;
the prior floor/archive checks remain the implementing agent's recorded evidence.
No full source suite or packaging rerun was needed for that read-only review.

| ID | Finding / disposition | Acceptance |
| --- | --- | --- |
| CC-R01 | **UI rejected by the operator.** The separate cream panels/sticky sidebar, header and generic control styling did not follow the established Generator. Functional/mounted passes did not establish visual approval. Current work is UI correction only; new features are stopped by explicit user direction. | Follow ADR-0005's concrete Generator reference. Inspect desktop/phone identity, scores, grants and review; obtain operator acceptance. |
| CC-R02 | **Spell picker eligibility/duplicates (code review).** `CharacterCreator` grant choices call the unfiltered `choose('spells',…)`; ordinary choices exclude fixed/ordinary selections but not spells selected through grants. Server `prepareCreator` rejects ineligible or duplicate choices, so this is a picker/usability gap rather than evidence of invalid creation. | After the current UI correction, reuse shared grant eligibility and exact selected/fixed identities; mark unavailable/selected choices consistently. Preserve legitimate paper ordinary-list deviations. One focused mounted case should cover a grant/ordinary duplicate and an ineligible grant. No rule or picker feature repair in this UI-only pass. |
| CC-R03 | **Shell discard protection remains open.** Current Core tool host renders tools without a dirty-state contract; settings-panel `onDirtyChange` does not cover tools. Drafts remain memory-only. | Separately selected public Core hook and actual shell navigation check; current module-owned Back confirmation is not sufficient. No private host imports or Core edits. |
| CC-R04 | **Native/operator creation acceptance remains open.** Marker/default normalization, prepared/native equality and interrupted creation have offline evidence only. | Complete CC-07 with explicit disposable native13/14 authority. No live probe or write performed by this review. |

The initial UI correction extracted a provisional `CharacterToolHeader` from Generator for both character tools, preserving the Generator's randomize action. The
creator adopts centered content, compact step navigation, white bordered identity
and score panels and the existing form hierarchy. No server/rule/recovery code
changed in this correction. Agent guidance now requires existing UI references
for any new module surface; ADR-0005 owns the specific correction and feature stop.

### UI-only verification and latest direction

After the presentation correction, explicit module typing and the shared
presentation suite pass. All five existing mounted creator workflows pass again;
identity/scores/grants/review captures were inspected at390/1280. Evidence:
`/tmp/sd-creator-ui-types.log`, `/tmp/sd-creator-ui-presentation.log`,
`/tmp/sd-creator-ui-final.log`, `/tmp/sd-creator-ui-final/results.json` and captures.
These checks preserve behavior but do not close CC-R01: the user subsequently
clarified the universal two-part, Core-owned, module-themed header requirement.
ADR-0005's superseding header direction is authoritative. That provisional extraction was subsequently replaced by the approved Core adoption below. No native write, Shadowdark commit or publication was performed.

### Core-owned header verification — latest checkpoint

Core ADR-0073 and this module's ADR-0005 now govern the implemented header.
`ModulePageHeader` supplies Shadowdark tokens/content to injected Core
`PageHeader`; Generator, Creator, Importer and Monster Stats share both rows.
The common sheet container renders navigation only before either layout branch.
Generator actions and Creator/Importer discard callbacks remain module-owned.
No server, rule or creation-recovery behavior changed in this header correction.

Explicit module typing, shared presentation, source Creator five mounted groups,
packaged Creator five groups (including Back cancel/confirm), and seven retained
tool canvas checks passed. The actual Core renderer is used by browser fixtures;
all external network traffic is blocked. Captures at 390/1280 cover identity,
scores, grants and review. These are isolated host/SDK checks, not native-world
or operator acceptance. CC-R01 through CC-R04 remain qualified as above.

Isolated archive `shadowdark-0.9.6.tgz` SHA256:
`06713dc31d7499e1fc90441dbcdb6a491ddd972a9381e76902c1ea9c7d1e943c`.
This archive includes the corrected UI and passed module contract/package checks
against the current Core branch. SDK 3.7→3.8 / UI 3.5→3.6; module UI minimum
3.3→3.6, CI/release pins 0.20→planned 0.22.0. Release version stays 0.9.6.
Supporting Core publication must precede remote CI; the forward pin is not yet
an available released toolchain. Earlier Core 0.20 floor evidence is historical.

Local evidence: `/tmp/sd-header-module-presentation.log`,
`/tmp/sd-header-module-types-final.log`, `/tmp/sd-core-header-creator.log`,
`/tmp/sd-header-archive-creator.log`, `/tmp/sd-header-tools.log`,
`/tmp/sd-header-package.log`; captures `/tmp/sd-header-archive-creator` and
`/tmp/sd-header-tools`. No services intentionally retained.

### Operator correction — Creator Back confirmation

The operator reported Back to Dashboard did nothing. Creator omitted the required
`isOpen` prop on Core ConfirmationModal. Conditional mounting alone does not open
that component; the same call also handles score replacement, calculated HP and
final creation. Other existing module confirmation calls already provide isOpen.
Creator now provides it explicitly.

The prior browser seam replaced ConfirmationModal with an always-visible stub,
so its earlier passes did not verify the actual host modal contract. The existing
mounted workflow now injects Core's real ConfirmationModal alongside PageHeader
and queries its alertdialog semantics. Before the fix, real-modal creation and
score confirmations timed out; after the fix, the same workflow verifies visible
confirmation, cancellation and confirmed Dashboard navigation. No new suite or
rule/writer behavior was added. Logs: `/tmp/sd-creator-real-confirm-before.log`
and `/tmp/sd-creator-real-confirm-after.log`.

The preceding archive predates this one-prop repair and must not be described as
its evidence. Operator also confirmed that restarting development refreshed a
stale separate stylesheet after the header change; isolated fixture passes did
not cover stylesheet hot reload in that running session.

Final verification: all five mounted Creator workflow groups pass with the real
Core confirmation modal; explicit module/UI/migration typing passes. Changes
remain uncommitted. No running Core/Foundry service was started or restarted.

### Operator UI closeout — October 23

User verified the Back repair and accepted the corrected presentation, then
requested closeout. **CC-R01 is closed** for this header/UI correction. Earlier
UI rejection and test limitations remain historical evidence, not a continuing
presentation block. CC-R02 (spell picker), CC-R03 (shell discard), and CC-R04 /
CC-07 (native creation acceptance) remain open; the overall Creator ADR stays
Accepted. No further features were implemented by this closeout.

Core ADR-0073 is Completed. Planned supporting publication is Core 0.22.0 with
SDK 3.8.0 / UI 3.6.0. Module CI requires that tag; release versions and Git state
remain unchanged. Source real-modal verification and user acceptance cover the
latest repair; the prior package is not relabeled as containing it.

Checkpoint authorization: after accepting the UI closeout, the user authorized
local commits of Core and Shadowdark work. This includes the existing Creator
implementation and records its remaining gates; it is not full native acceptance
or authorization to push, merge or release.
