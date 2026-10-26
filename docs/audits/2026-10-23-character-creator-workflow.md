# Character Creator workflow audit

Date: 2026-10-23
Status: October 26 refinement checkpoint approved; native acceptance/recovery recheck and shell SDK gate remain open
Decision: [ADR-0005](../adr/0005-character-creator.md)

## October 26 checkpoint

User requested annotation/checkmarks and a local commit of the selected Creator
and sheet refinements. ADR-0005 now contains the completed refinement checklist.
Latest verification:32 source cases, seven mounted Creator groups, explicit
module typing and package build pass. Sheet geometry has source/archive-CSS
checks; five ActorPage lifecycle cases and presentation checks passed during the
sheet correction. Compiled creation/recovery routes passed before the final
informational ability-guidance addition. Evidence below distinguishes those
artifacts rather than claiming every historical check ran against the latest one.

CC-R01 presentation corrections and CC-R02 picker implementation are checkpointed.
CC-R03 remains a public SDK dependency; CC-R04/CC-07 remain native acceptance,
including operator recheck of the prior duration-only receipt. No live data was
changed. Core is clean/read-only; module version0.9.6 and requirements are
unchanged. Push, PR and release remain user-owned follow-up actions.

## Class ability guidance — October 25

Added selected-Class hints to Ability Scores using existing Creator presentation.
Exact core Fighter/Thief guidance comes from the native Player Quickstart Stats
page (`quickstart-guides.db/stats__QHTrjIWK9cBCx5KZ.json` at native reference
9677d16b3903b3b640f00d4efd48249142ac8334). Casting ability and fixed Class Ability
checks use caller-readable native fields; no name matching or score assignment.
Level0 omits the disabled Class's guidance. General CON/attack help is separate.
The Quickstart specifies 3d6 in order and an optional full reroll when none reaches
14; no official standard array was found or added. A house-rule array is unselected.

32 planner/writer/helper checks and seven source browser groups pass, including
mounted Fighter hints and native/custom casting, referenced ability checks,
level0 and unknown-class behavior. Explicit typing and packaging pass. Desktop
Ability Scores capture inspected. Logs:
`/tmp/sd-creator-ability-{tests,types,browser,package}.log`; captures:
`/tmp/sd-creator-ability-browser/scores-{390,1280}.png`.
Latest runtime archive SHA256:
`bf5e825c557a4c843639a3485c7b9ab3197a9d2071bd2d3fedc5a5367c0f87a6`.
No live changes, commits, contract/version bumps or retained test services.
Native Creator acceptance remains open; final documentation postdates packaging.

## Permanent-duration recovery correction — October 25

Operator re-entry screenshot shows the original request, with differences only
on legacy duration fields of three Item effects (diagnostics capped at20 paths).
The read-only saved receipt has all seven fields null for Ability Score
Improvement (Int/Str/Dex). Foundry v14.367 local reference
`common/documents/active-effect.mjs` lines47–67,191–203,229–239 establishes the
schema/migration change. The exact empty legacy duration now compares as the
v14 permanent-effect shape; real timing, expiry, expired state, start values and
unknown properties are not discarded. No live Actor or receipt was edited.

A fresh Creator visit now suppresses completed historical receipts after its
status check, while the current creation's success stays visible and uncertain
requests retain recovery. The original dispatched request can settle through
normal status reconciliation, without another Actor creation.

31 planner/writer checks pass, including legacy-to-v14 duration reconciliation,
no replay, a subsequent distinct create, and rejection of actual timing/start
changes. Seven mounted source workflow groups pass; the existing desktop case
now also confirms re-entry to an editable fresh form after completion without
another write. Explicit typing, packaging and compiled creator routes pass.
These are offline checks; operator re-entry still verifies the actual saved
Actor has no additional differences. Other historical native gates stay open.
Logs: `/tmp/sd-creator-duration-{tests,types,browser,package,compiled}.log`.
Runtime archive SHA256:
`5f92c3adbe0d5f84b197c67d7d05a5f14b604d03f6251a8d8dfe44109a5f824f`.
Final docs postdate the archive. Core unchanged; no services retained or commits.

## Final content-only sheet height — October 25

The user rejected viewport-minimum sheet height: the white panel must end after
its content. Removed flex growth from the sheet containers and put dock clearance
outside the sheet background. Only the transparent page canvas retains its
viewport minimum. No top gap or black frame; footer remains dashboard-only as
the user clarified. This supersedes the viewport-fill interpretation below.

Source and archive-CSS geometry checks pass for both modes at 390/1440px.
Changing viewport height from 1000 to 1400px leaves sheet height unchanged.
The controlled desktop paper ends at869px; long mobile paper grows to2153px.
Tab bodies remain controlled, so these measurements prove shell behavior, not
native character content parity. Logs/captures:
`/tmp/sd-sheet-content-height.log`, `/tmp/sd-sheet-content-height/`,
`/tmp/sd-sheet-content-archive-css.log`, `/tmp/sd-sheet-content-archive-css/`.
Packaging passes (`/tmp/sd-sheet-content-package.log`); current runtime SHA256:
`50d00ba7bd1f2764d55a3c9f4e2a679b9aa8a14235ac7be55020ff4f150d4174`.
Final docs postdate packaging. Core unchanged, no services retained, uncommitted.

## Superseded viewport-fill interpretation — October 25

The operator rejected the width-only correction: sheets still had a top gap,
and the paper view retained a black surround. Both layouts now meet navigation
directly and use a growing flex column. Viewport height is a minimum, not a fixed
height: short sheets extend to the viewport bottom and longer content grows the
page naturally, without an internal scroll box. The user explicitly confirmed
content-driven vertical growth. Paper removes its outer black canvas, border,
shadow, margin and nested width cap; content padding and field borders remain.
Dock clearance is inside the sheet background, not an external bottom gap.

Explicit typing and packaging pass. The composed shell probe now checks the
actual requested geometry in both modes at 390/1440px, with generated source CSS
and archive CSS: sheet top equals nav bottom (53px), sheet bottom reaches at
least the 1000px viewport, paper width equals the container width, the paper
background is white, and no horizontal page overflow. The long mobile paper
view grows to 2233px, demonstrating content growth beyond the minimum. Desktop
paper capture inspected. The fixture still controls tab bodies/transport; this
is layout evidence, not full native content acceptance. No Core/live changes.

Evidence: `/tmp/sd-sheet-fill-types.log`, `/tmp/sd-sheet-fill.log`,
`/tmp/sd-sheet-fill-check/`, `/tmp/sd-sheet-fill-archive-css.log`,
`/tmp/sd-sheet-fill-archive-css/`, `/tmp/sd-sheet-fill-package.log`.
Latest runtime archive SHA256:
`a7fc88ffa647f9388a82cfa14845b82d1ef19cb19847c4bea4d833c3ff19df58`.
Final documentation postdates the archive. Earlier width-only evidence below
is superseded for height/frame acceptance. Changes remain uncommitted.

## Sheet navigation and width correction — October 25

Operator screenshots show duplicate Dashboard navigation in both sheet layouts.
ActorPage retained its old navigation while ShadowdarkSheet mounted the new
shared header. ActorPage now replaces its old bar with ModulePageHeader; the
sheet content has no navigation header of its own. Core remains unchanged.
The reported shrinking is not proven to originate in the header: the outer
1024px cap already existed before adoption. The correction widens that shared
page container to 1280px and removes the tabbed content's redundant 1024px cap.

Explicit module typing, the presentation suite and all five existing ActorPage
lifecycle checks pass. An isolated composed ActorPage/ShadowdarkSheet/paper-sheet
probe verifies both view modes at 390 and 1440px: exactly one Dashboard button
and page navigation, full-width bar, 1280px desktop container, no horizontal
page overflow and working Dashboard action. Transport/context and tab bodies
are controlled; this is shell/layout verification, not live Actor acceptance.
Desktop captures were inspected. The same geometry passes with CSS extracted
from the new archive. No running host or native connection was used.

Logs/captures: `/tmp/sd-sheet-types.log`, `/tmp/sd-sheet-header-lifecycle/results.json`,
`/tmp/sd-sheet-layout.log`, `/tmp/sd-sheet-layout-check/`,
`/tmp/sd-sheet-layout-archive-css.log`, `/tmp/sd-sheet-layout-archive-css/`,
`/tmp/sd-sheet-package.log`. Latest runtime archive SHA256:
`82aa9ebdcf26fa65a0ae59d97159951abee98b82fec571a41281804f9a614add`.
Audit closeout postdates packaging. Creator workflow evidence below is from the
preceding archive; it was not rerun for this sheet-only correction. Operator
recheck remains pending. No version changes or commits.

## Latest corrections — local validation and creation verification

User reported invalid HP values accepted into the draft, validation at page ends,
and an opaque post-create verification warning. Creator issues now carry an
explicit field/choice target; the UI renders messages beneath that input or
selection group. Numeric editing rejects invalid integer/range input before
submission: HP 1..Class hit die, acquisition level within character level,
nonnegative XP/coins/quantities and bounded values. No invented maximum 18 is
applied to effective scores. Re-entering a retained valid value clears a rejected
input error. Name/notes limits and treasure/gem numeric guards apply in their own
forms. Final server validation remains authoritative. Transport/recovery failures
remain beside their action rather than being mislabeled as a numeric field error.

Read-only inspection of the local receipt for the user-reported request confirmed
a dispatched create with a returned Actor ID. No stored receipt or native Actor
was changed. The native saved source is not available from that receipt, so the
actual mismatch cause is **unconfirmed**. Do not infer a normalization exception
from the screenshot, expected payload or passing offline cases.

When an owner-readable Actor has the exact creation marker but differs in saved
fields, recovery now exposes Review created character and optional Verification
details (bounded field paths and request ID, no duplicated source payload).
The primary text explains that the character exists and needs checking. Final
confirmation uses the character name/level rather than internal receipt language.
Strict source comparison, caller ownership, marker checks and no-replay behavior
are retained. Normalization rules are unchanged. User will recapture the initial
popup and recheck after these edits; live/native acceptance remains open.

Verification: explicit module typing, 30 planner/writer cases, seven source
browser groups, package contracts, compiled routes and seven archive browser
groups pass. Existing browser cases now cover field-local required-name errors,
rejected negative XP with correction, rejected d8 HP above 8, and a controlled
saved-character mismatch that exposes its field path and opens the existing
Actor without another create. That fixture is not evidence of the user's native
mismatch cause. Desktop field-error capture inspected; both widths retain the
single-column HP layout and inline dice.

Latest runtime archive SHA256:
`e6588f5cc6966e04461e8aa0227c89560e487fbc611ba0e516775bfba432a597`.
Logs: `/tmp/sd-creator-fields-{types,planner,browser,package,compiled,archive-browser}.log`.
Captures: `/tmp/sd-creator-fields-browser/hp-validation-{390,1280}.png`
and `/tmp/sd-creator-fields-archive-browser/`.
Final audit/handoff edits postdate this archive. Older archive identities below
are historical. Core and live data are unchanged; no test services retained.

## Latest HP layout correction

User clarified that the level cards must be stacked in one column, not split
across two columns, and requested Roll all HP above them. Each card retains its
input/die pair on one line. These structural layout properties now travel with
the component rather than relying on the newly appended presentation stylesheet
rules; previous isolated captures had the pair inline, but the user's running
session still showed the die underneath. That discrepancy is recorded rather
than claimed resolved by earlier screenshots.

Roll all HP uses the existing per-level roll route and replaces all entries only
after every requested result returns under the current draft/context. Individual
rollers remain independent. The total uses the existing HP calculation route.
Missing HP now produces one actionable message, Enter or roll HP for each level,
instead of separate internal current/max field paths. Existing browser cases
check card stacking and input/die alignment at both widths, Roll all and an
individual reroll, totals, level changes and retained creation behavior.

Verification: explicit typing, package contracts/compiled routes and all seven
packaged browser groups pass. Desktop HP capture inspected; geometric assertions
verify single-column stacking and inline input/die centers at 390 and 1280 widths.
Current runtime archive SHA256:
`eb19d120edc6c674b5a9321dc6041f50adf4a20801a7a534fe86a668eddc0272`.
Logs `/tmp/sd-creator-hp-stack-{types,package,compiled,browser}.log`;
captures `/tmp/sd-creator-hp-stack-browser/hp-{390,1280}.png`.
Docs/handoff postdate the archive. Native/operator acceptance remains open;
Core and live data unchanged. No test services retained.

## Current HP follow-up — per-level blocks

The user clarified that HP must expose one block per level, with an input and
its roller side by side. This supersedes the intermediate single-total entry
layout. Total HP calculates automatically below the blocks via existing roll/HP
routes, with no current/max form or replacement confirmation. Level zero uses
CON-based calculation without Class dice. Both internal effective HP values are
set to the calculated total; new characters start at full HP. Legacy draft and
recovery receipt shapes remain unchanged.

Increasing level retains earlier die entries and adds blank required blocks;
decreasing level drops higher entries. Changing Class clears the old die entries.
Ability/grant/identity changes invalidate the total until recalculation on the HP
step. The existing server calculator still rejects unsupported HP effect/history
semantics; it does not invent chronology. The optional deity clear action now
says Clear selection and has secondary styling rather than a second None value.

Earlier single-total UI evidence (archive `77c50a…`) predates this clarification
and is not acceptance of the current layout. Explicit typing and seven source
mounted groups pass, including typed per-level results, individual rollers,
automatic level-zero HP, full starting HP and increasing level 3→4 while keeping
the first three entries and requiring the fourth. Phone HP layout was visually
inspected: input and die remain side by side. No Core or live-world changes.
Package contracts/compiled routes and all seven archive-mounted groups pass.
Desktop archive HP layout was visually inspected as well. Current runtime archive
SHA256: `8036654be86baafc7d011bdb2e5b0ba0390cc0f706c96684cabdba8aa8e01b4e`.
Logs: `/tmp/sd-creator-hp-levels-{types,browser,package,compiled,archive-browser}.log`.
Captures: `/tmp/sd-creator-hp-levels-archive-browser/hp-{390,1280}.png`.
Final documentation postdates that runtime archive. These are offline checks;
operator/native acceptance remains open. No test services retained.

## Follow-up — required stages and direct score rolls

The user requested that required entries block advancing and that score rolls
replace immediately. Next and forward stage tabs now check the same fresh plan
as final creation; earlier stages remain reachable. Required name, ancestry,
background, alignment and above-zero Class prevent skipping Identity. Incomplete
scores, grants, languages/Spells and HP likewise block later stages. Loading or
retired plans cannot authorize forward navigation.

The Class picker excludes the exact native Level 0 Class using one shared
constant; the server already rejects it for adventurers. At level zero the
planner continues to select that Class automatically. Core rules p14 includes
background and alignment at both starting levels. Both now have a required marker
and server validation; an empty alignment is Choose…, not None. Deity stays
optional at level zero: it is not a required entry in that starting-level list,
and the pinned native generator offers its selector at level zero too
(`system/templates/apps/character-generator.hbs`, background/alignment/deity
partials and `CharacterGeneratorSD.mjs`). No class-specific deity policy changed.
Rule text checked in the [core rules, p14](https://anyflip.com/agkyz/ktro/basic).

Single-score and Roll all actions immediately replace selected scores with no
modal. Creator Back/discard and final creation confirmations remain. Existing
planner validation cases now cover missing background/alignment and invalid
adventuring Class; the mounted suite includes blocked Next and tab navigation,
returning to earlier steps, the Level 0 picker exclusion and immediate rerolls.

Source verification: 30 planner cases, explicit typing, and seven mounted
workflow groups pass. Package contract validation and compiled creator routes
pass. All seven mounted groups also pass against the final compiled UI and
packaged styles. Archive SHA256:
`833caa3c375eb4ef78a1f2b29977c84671b6e1d477e1611c0343a08c3d57d15e`.
Logs: `/tmp/sd-creator-step-{planner,types,browser,package,compiled,archive-browser}.log`;
archive screenshots: `/tmp/sd-creator-step-archive-browser`. These supersede
prior archive identities for runtime review; final audit/handoff edits postdate
this archive. Native/operator acceptance is still open. Core is unchanged;
module refinements remain uncommitted, with no live service or data changes.

## Current refinement — October 25

The current decision is ADR-0005's **Rules-guided refinement**. It supersedes
historical manual-deviation allowances below. The user retained the procedural
review, ordered by stage; a sheet-replica redesign is not selected. Earlier header
acceptance remains valid, but it does not establish acceptance of these new changes.

Implemented in the existing module branch:

- Removed the Reviewed banner; reused Generator name dice/ancestry endpoint and
  score controls. Typed scores have no spinners or exposed storage-basis selector.
- Matched independent awards to native Class/Patron level entitlements; enforced
  source pools, ordinary Spell quotas and fixed/granted/selected Spell identity
  exclusion in both the picker and final preparation. Missing or extra choices
  cannot be waived. CC-R02 now has corrective offline evidence, pending operator
  confirmation; this does not reopen completed sheet/advancement acceptance.
- HP calculation validates one Class die per level, uses existing native advantage
  and advancement helpers, and prepares constant bonuses once. Direct entry
  remains available without invented historical rolls.
- Reused Treasure/Gem Bag and Core RichTextEditor; valuables are bounded draft
  entries converted to native items, notes are sanitized, and Creator omits sale
  operations. Review lists final values and links errors to their originating step.

Verification on Core 0.22.0 / SDK 3.8.0 / UI 3.6.0:

- 30 real-planner/writer cases passed, including no-waiver progression/language/
  Spell limits, source identity, HP advantage/constant bonus, valuables, sanitized
  notes and retained recovery behavior. Creator contracts and presentation pass.
- Explicit module/UI/server typing passes. Six source mounted workflow groups
  pass, using actual Core PageHeader, ConfirmationModal and RichTextEditor,
  including phone/desktop entry, independent grants and caster selection caps.
- Module contract validation and isolated packaging pass. Compiled planner/writer
  checks pass for round-trip data, complete payload, duplicate/uncertain recovery
  and revoked-source preflight. Archive identity and final mounted checks follow
  below. These are controlled offline checks, not native acceptance.

Final isolated archive: `shadowdark-0.9.6.tgz`, SHA256
`b5b5ed1220f213e5e68029e23734adbb4cab970e9a559566d2b4dee9766d4af7`.
All six mounted groups pass against its compiled UI and packaged styles.
Desktop review and phone scores were visually inspected: sequential sections,
compact notes and intact score/control layout. The isolated fixture blocks asset
requests, so screenshots do not verify the die SVG itself; the Creator uses the
Generator's existing `/icons/dice-d6.svg`, verified present in Core. The archive UI run caught a
transient editor crash after saving notes when an inline theme object caused
editor recreation on every review refresh. A stable module-level theme fixes
that; the same phone/desktop save-and-create cases now pass. This is module
integration evidence, not a Core change. Documentation-only audit/handoff edits
postdate the archive; its runtime code matches the final source.

Local evidence: `/tmp/sd-creator-rules-{planner,contracts,presentation,browser}.log`,
`/tmp/sd-creator-rules-final-types.log`, `/tmp/sd-creator-refinement-package.log`,
`/tmp/sd-creator-refinement-compiled-final.log`, and
`/tmp/sd-creator-rules-archive-browser.log`. Source/archive screenshots accompany
those browser output directories. No test services intentionally retained.

Core v0.22.0 publication was independently verified; the earlier publication
block is satisfied. README now reflects the already-declared UI 3.6 contract.
No Core code, release versions, compatibility requirements or native data changed.

Remaining limits: native v13/v14 creation acceptance (CC-R04/CC-07); shell-wide
discard protection (CC-R03); operator acceptance of this refinement. Native
caster tables currently define levels 1–10, so missing higher-level progression
blocks completion. Arbitrary campaign exceptions have no new bypass. Conditional
or replacing numeric effects without a recoverable original value remain
unsupported rather than guessed. General numeric storage controls stay internal.

## Original planning scope and evidence

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
| CC-R01 | **Checkpointed.** Original presentation rejection was corrected; shared-header adoption and subsequent sheet frame/height corrections are recorded above. | Preserve the accepted conventions in ADR-0005; historical rejection is not an active feature stop. |
| CC-R02 | **Implementation checkpointed October26.** Shared grant eligibility and exact fixed/selected spell exclusions now apply to picker and server allowances, with focused mounted coverage. | Native acceptance remains part of CC-R04/CC-07; prior permissive transcription plan is superseded by the rules-guided decision. |
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
