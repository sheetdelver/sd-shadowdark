# ADR-0002: Native data and behavior parity

**Status:** In progress

**Date:** October 18, 2026

**Scope:** Shadowdark module only; implementation and local checkpoint commits authorized.

**Audit:** [Post-release native parity](../audits/2026-10-18-spellcasting-and-native-parity.md)

**Predecessor:** [ADR-0001](0001-native-alignment-and-resource-cards.md), Completed; its accepted scope and explicit deferrals remain intact.

## Context

After release 0.9.5, the user reported characters rejected as non-spellcasters,
incorrect spell-selection behavior and disagreement with owned inventory.
The live Core 0.19.3 instance confirmed incomplete actor/item data and a working
Priest whose valid owned spells disappear from the picker's known selection.
Read-only native-data probes also established an alternate-list defect for
Knight of St. Ydris. The audit records exact evidence and its limits.

The user requested a wider comparison than the reported symptoms. The expanded
source and controlled-native-method pass found incorrect limited-use spend
ordering, incomplete potion identification, Player focus semantics applied to
NPCs, inferred language rarity/counts and zero critical-threshold handling
(SD02-09–13). It also records matching native weapon/armor/slot calculations and
six feature-gap follow-ups. Existing twelve offline suites still pass; they do
not cover the newly reproduced behaviors. This ADR selects those confirmed
corrections in addition to SD02-01–08; the feature backlog remains separately
scoped. The title and filename reflect this broader data and behavior scope.

Current preparation correctly applies native casting grants in stock Wizard and
Priest controls. Replacing that behavior with class-name inference would conceal
missing data. At the same time, a missing catalog source must not make an owned
spell disappear, and a failed or filtered catalog must never become a deletion
instruction. We need a coherent ownership and spell workflow, not another layer
of UI repairs.

This is a new corrective scope. It does not reopen the completed Core migration
implementation or assert that an admin effect-key migration reconstructs all
historical character content.

## Proposed decisions

### 1. Keep native eligibility and explain failures precisely

Use released native 4.0.6 as authority. Separate:

- Actor class identity, including its progression table.
- Active effect-granted casting classes, item-only casting permissions and ability
  override, and the distinct NPC casting model.
- Each spell's exact native Class references and the resolved casting ability.
- The class's alternate spell-list reference for advancement.
- Owned item identity, optional catalog provenance and current availability.

Follow native effect suppression, transfer, phase and priority. Do not grant
casting from a class label, a spell name, a roll bonus or an inferred ability.
Report “missing casting grant”, “spell has no class reference”, “class unavailable”
and “class does not match this actor's grant” distinctly, without leaking denied
content. Unknown data is not a non-caster classification.

### 2. Use one shared spell model with bounded reference inputs

Extend the existing module preparation/action path, rather than adding another
caster calculator. Publish the inputs needed by paper, tabs, cards, management,
creation and advancement from common environment-neutral helpers. Server routes
re-read the actor and dependencies under the caller before executing actions.

A candidate owned-spell row contains actor/item identity, current source fields,
optional provenance, exact class refs, resolved labels, classification (ordinary,
granted or unresolved), casting availability/reason and management eligibility.
Catalog rows remain separate exact documents. Counts, limits and missing-data
states come from the shared model; React formats, groups and records intent.

Resolve only dependencies actually needed for the selected actor/action through
public host capabilities. Match exact UUIDs, recheck scope/revision after awaits,
and retire stale results. No cross-user world cache, direct socket, private Core
import or scan of every actor is introduced. Demonstrate how caller-specific
dependency data reaches the UI without entering the user-invariant registry.
If a required preparation lifecycle is genuinely absent, record a small public
contract reproducer and external dependency rather than silently diverging UI
and server results.

### 3. Preserve ownership independently of the catalog

Use actor plus embedded Item ID for owned spells. Keep source-less, renamed,
duplicate, custom, lost and currently unreadable-origin spells visible. Their
own readable contents remain usable; optional origin metadata is not required
to display or cast a mechanically complete owned spell.

Never merge ownership by catalog UUID, display name or terminal ID. Never infer
a source reference to make a picker happy. Show ambiguity/unresolved class
grouping explicitly. Consolidate live granted-spell mapping consumers while
preserving native grants and counts; missing provenance needs a diagnostic or
explicit resolution, not name-based exclusion from limits.

### 4. Make spell changes explicit, validated and recoverable

Replace client-side catalog set subtraction with explicit intent:

- Additions identify the exact readable source document.
- Removals identify the exact owned Item and require deliberate user intent.
- Requests bind to actor, caller, world/context and the reviewed relevant actor
  state. Changed assumptions require refresh/review before further writes.

Use a module server operation over existing public SDK writes. Preflight all
known constraints before mutations; preserve fields/effects when copying native
items. Never schedule a removal merely because a catalog omitted a row. For a
replacement, failed or uncertain addition must not remove the old spell.

Return explicit per-operation completion/uncertainty and reconcile retries with
fresh source. Prevent duplicate confirmed additions and repeating confirmed
deletions. Define whether replay protection survives restart; do not promise
durable atomic transactions from a series of SDK writes. Do not add whole-world
maintenance for ordinary owned-spell management. Cancel before submission is a
no-op; after partial completion, present actual results and an accurate recovery
choice using shared UI.

### 5. Align lists, filters and progression without fabricating limits

Resolve alternate list identity from native `system.spellcasting.class` while
using the actor class's own progression table. The Knight/Witch distinction is
a required regression. Advancement uses the native target-minus-current table
requirements, with exact per-tier validation on the server before any write.
Creation evaluates planned native grants before enforcing caster requirements.

Represent zero, positive and unknown/invalid limits separately. A resolved native
table's explicit null denotes no learned spells at that level/tier; it is not the
same as an absent or invalid table. A zero limit does not mean unlimited. Existing over-limit inventory is preserved and explained.
Required choices with an empty/failed catalog remain incomplete; they must not
silently vanish from advancement. Ordinary inventory editing and GM exceptions
are distinct from rules-guided advancement; any exception must be explicit,
authorized by existing owner/GM policy and must not silently bypass the wizard.

Use one caller-bound catalog for the current declared-pack and world-spell
features. Preserve partial-source failure states. Native `sourceFilters` is a
world Array setting with proven default `[]`; consume it through the existing
world-context API, applying native source-title filtering to choices. Existing
owned items/grants do not disappear when browsing filters change.

Broader third-party pack discovery is a capability investigation with a concrete
boundary: current exact present-UUID reads are possible, while arbitrary pack
enumeration/hydration is not established by that fact. Do not claim a full native
catalog if the public host supports only a defined subset. Do not invent a host
blocker for world Items, exact present UUIDs or Array settings that already have
public contracts.

### 6. Reuse shared dialogs and spell presentation

Move spell selection to the existing SDK dialog pattern used by resource cards.
Retain a consistent stack with floating tools, cards, roller and confirmation.
Provide dialog naming, focus containment/restoration, keyboard selection and
expansion, dismissal policy, scroll containment and reachable actions.

Reuse shared native range/duration/card facts. Missing range is not `Close`, and
native plural duration labels do not acquire another `s`. Preserve manual state
on harmless refresh; reconcile changes in actor/class/source/access explicitly.

### 7. Diagnose and repair historical data only with evidence

Trace the real failure shapes from the audit before introducing a repair:
missing casting grants, missing spell Class references and the Knight's wrong
grant value. Compare exact source, module preparation and native preparation.
Fix a current creation/import/grant-copy writer if it still produces the defect.

For deterministic historical transformations with proven preconditions, use a
new module migration point through the existing Core admin maintenance process.
Do not edit the two published effect-key steps, weaken required scope, introduce
a player migration route or repair during render/bootstrap. Prove the current
patch/reference contract supports the planned transformation before shipping it.
Preserve custom data and distinguish not-applicable from ambiguous/unresolved.

Without exact provenance or an independently justified structural precondition,
do not guess a grant or spell identity. Provide an explicit GM remediation plan
using exact document selections/native editing, with a preview of affected
fields; do not silently use an invented migration-parameter contract. Existing
source-less but otherwise complete spells need no repair just to be manageable.
Current live data remains unchanged during this documentation pass.

### 8. Keep scope and compatibility honest

Implement only in this module on a newly authorized feature branch. Core and
sibling repositories remain read-only. Module version 0.9.5, Core floor >=0.19.2,
API ranges and workflow pins remain unchanged in this planning pass. Validate
proposed public capabilities on the supported floor and current released host;
bump requirements only if a demonstrated dependency demands it, at an authorized
implementation/release step. Source-filter declaration alone needs no SDK bump.

Ammunition automation, situational-effect selection and scene/light automation,
native 4.1+, historical CG-4/6/8 and future Core card/encounter features remain
separate decisions. Preserve existing HP/XP, mastery, permissions, world-context,
card and migration corrections. No release or Git operations are authorized by
this ADR's existence.

The audit's F01–F06 inventory supplies concrete follow-up steps for automatic
damage/healing, ammunition, timed lights/effects, targeting/momentum/chat,
situational selection and broader catalogs. It does not authorize those features
incidentally. The earlier “rest automation” note was not an established
native 4.0.6 feature: identify an actual native handler before claiming a parity
gap. No source change, native write or new Core work is authorized by this plan.

### 9. Make supported resource actions follow native phases

Correct SD02-09/10 in the existing shared action and execution path. Express
prerequisite resource/identification writes separately from post-result writes;
the server must execute the model's phases, not merely display them as text.

For Class Abilities, cancellation/eligibility checks precede spending; a confirmed
limited-use decrement precedes rolling or no-check chat. Failed or uncertain
spending prevents the result from starting. A confirmed spend followed by a roll
failure is reported as such and must not become a fresh spend on retry. Define
same-request and distinct-request resource handling using actual public SDK
guarantees; no claim of distributed atomicity or durable replay without proof.

For an unidentified Potion, native identification swaps active/alternate name
and description and enables its effects before use is posted and the document
consumed. Preserve this transition, unknown fields and exact item/effect IDs.
Reconcile partially completed identification or uncertain deletion with fresh
source; never swap again merely because a request was retried. Deleting the
owned Potion is native behavior; do not substitute quantity decrement.

Prepare actor-specific spell loss/focus policy once (SD02-11). Player focus does
not establish an NPC exemption; UI and server must enforce the same policy.
Keep Scroll consumption and Wand loss/break independent. Match native zero
critical-threshold disabling without conflating zero and missing values
(SD02-13). These are supported-action corrections, not a new migration service.

### 10. Preserve native language fields and distinct choice pools

Correct SD02-12 across Registry, Details, picker, generator and advancement.
Project `system.rarity` directly, retaining unresolved/invalid states rather than
guessing from English names. Use exact UUIDs. Keep native fixed grants, class and
ancestry restricted counts/options, and common/rare choices distinct. Explicit
zero stays zero even if an options array remains populated. Do not infer an
allowance from pool size or merge two required pools into an unrestricted slot.

Separate creation requirements from native ordinary language editing. Existing
custom/extra languages are preserved. Document an intentional product restriction
as such; do not attribute invented quotas to native code. Keep required creation
validation server-side before writes, using shared authoritative data. The pinned
native Background model has no language-choice schema, so custom extensions need
explicit treatment rather than assumed native rules.

## Implementation checkpoints

The table defines the acceptance gates; the implementation record below tracks current evidence. Each
implementation update must name the finding, affected surfaces, evidence,
remaining limits and changed files. Save one local prior ADR snapshot before
substantial status revisions, then update this decision record rather than
appending contradictory completion statements.

| Gate | Work and evidence needed to pass |
| --- | --- |
| D0 — reproduce and classify | Record approved branch/base/runtime identities. Convert audit L01–L04 into sanitized mechanical fixtures. Reproduce SD02-02 world-Class and SD02-03 Knight cases using real module functions. Reproduce SD02-04/05/07/08 with mounted consumers/fake writes. Establish which failures are stored data, projection, missing resolution or UI behavior; compare native preparation for the affected shapes. |
| D1 — prove capability and design | Document the shared spell model and public caller-bound dependency/catalog path. Prove world/embedded/known-pack reads, Array setting refresh and stale-read retirement on the supported host. Define write/retry guarantees from actual SDK behavior. Narrowly record any unavailable host capability; continue independent module corrections. |
| D2 — shared native class and spell model | Correct SD02-02/03 and duplicated grant/count logic. Distinguish actor class, grant, alternate list and progression. Carry all owned rows by Item ID into paper, tabs and cards. Verify native effect shapes, NPC/item-only casting and source preservation. |
| D3 — safe selection and advancement | Correct SD02-04/05/07 end to end: explicit intent, server preflight, exact required counts, no-op unchanged save, zero/unknown limits, partial/uncertain results and safe retry. No invalid request may advance the actor, debit XP or change HP/items. Preserve the existing HP/XP calculation and mastery-choice invariants. |
| D4 — catalog and dialog | Correct SD02-06/08: one complete-or-explicitly-partial caller catalog, source-filter context updates, world spells, shared dialog lifecycle and shared formatting. Cover both layouts, mounted invalidation, actor/source changes, denied access and restored access. |
| D5 — historical data disposition | Correct any proven current writer. For each L01/L02/L04 shape, record deterministic repair with a new admin migration step, explicit exact-source GM remediation, or an evidenced not-applicable result. Test repairs on disposable copies and preserve unknown/custom fields. Never claim a generic migration reconstructed ambiguous content. |
| D5a — action phase and outcome parity | Maintain failing-before regressions for SD02-09/10/11/13 using native event/state oracles. Implement prerequisite versus post-result phases, exact identification, actor-specific focus/loss and zero-threshold behavior. Prove spend/write/roll failure ordering, concurrent last-use requests and safe replay under the documented process/restart limits. |
| D5b — native language choices | Maintain SD02-12 rarity/zero-count regressions and separate-pool cases. One shared field-based projection serves Details, selection, creation and advancement. Preserve existing ownership and native editing semantics; invalid required choices produce no writes. |
| D6 — integrated/native acceptance | Run the acceptance matrix below against the final packaged module on an isolated released Core instance, then actual native 13/14 with scoped disposable data. Establish both user-visible behavior and source correctness. Use actual native comparisons, not only modeled effect shapes or successful HTTP responses. |
| D7 — closeout | Every selected finding has evidence and disposition. Update audit, architecture, README, AGENTS and handoff, with terse implemented changelog notes. Keep native/visual unknowns open. Request/use separately scoped commit/release authorization; do not pre-bump metadata. |

### Acceptance matrix

| ID | Required cases and oracle |
| --- | --- |
| A02-01 | Real failure shapes: missing grant, missing spell Class refs, wrong Knight grant, and working source-less Priest. Compare stored native source and native prepared eligibility with module diagnostics; verify exact repair on disposable copies. |
| A02-02 | Stock Wizard/Priest/Witch/Seer and Knight; no-caster and item-only permissions; multiple casting grants; suppressed/disabled effects; NPC spells. Both legacy and v14 serialized effects, with actual native runs recorded separately. |
| A02-03 | Knight level 2 → 3 selects one Witch tier-one spell, uses Knight limits and retains correct XP/HP/grants. Creation/import and ordinary advancement preserve spell classes, effects and exact source metadata where present. Empty/failed required catalogs cannot finish. |
| A02-04 | Source-less, duplicate-source, same-name/different-source, renamed, custom, missing-source, lost and granted owned spells. Both layouts/cards/counts match actual embedded inventory. Unchanged open/save and cancelled selection produce zero writes. |
| A02-05 | Native zero/positive/unknown limits, tier requirements, over-limit existing inventory, selected duplicates and crafted too-few/too-many requests. Re-read constraints on server; invalid submissions produce no actor/item/XP/HP write. |
| A02-06 | Catalog source removed/filtered/denied during selection, world read failure, context or user/role change, reconnect and late response. Preserve owned inventory and deliberate unsaved intent where valid; retire invalid scope. Explicit retry recovers without an endless spinner. |
| A02-07 | Add failure, remove failure, response loss, duplicate submit, actor edited elsewhere and restart during uncertainty. Compare source before/after per operation; no unintended deletion or duplicate confirmed addition. Document replay scope and recovery precisely. |
| A02-08 | Exact world Class/Spell, Actor-embedded references, known compendium UUID, absent/denied pack and duplicate names. UI and server agree; no hidden content/labels leak through a warmed privileged cache. Test OWNER, OBSERVER, LIMITED, NONE and GM on disposable fixtures. |
| A02-09 | Installed picker/card/roller at 360, 768, 1024 and 1440 pixels in both themes: accessible names/roles, Tab/Shift-Tab containment, Escape/dismissal, focus return, nested cleanup, scroll and reachable phone actions. Native duration/range labels match shared card facts. |
| A02-10 | Final archive on both supported native generations: representative creation/import, management, casting/focus/scroll/wand consequences and any new deterministic migration. Independent source comparison, second-run no-op, restored-data/restart behavior as applicable; remove only task fixtures and stop only task services. |
| A02-11 | Limited-use checked/no-check abilities: native spend-before-result ordering, zero uses, cancelled dialog, failed/uncertain spend, roll failure after confirmed spend, post-result loss failure, same-request replay and distinct last-use requests. Compare ordered events and surviving source; never claim safety from final count alone. |
| A02-12 | Identified/unidentified Potion: active/alternate name/description, effect enablement, native empty-name fallback, use then consumption. Refuse identification/effect/delete writes independently; retry must preserve exact native surviving state without repeated swap/use. |
| A02-13 | Player versus NPC spell failure/focus; unsupported submitted focus cannot bypass NPC loss. Retain Scroll/Wand cases. Ordinary/custom/zero critical thresholds and manual unknown-natural results match native outcome semantics and UI/server flags. |
| A02-14 | Custom/localized rare/common Language names, exact source rarity, explicit zero with populated options, independent class/ancestry pools, fixed grants, denied references, existing extras and cancelled/no-op edits. Compare native generator and ordinary editor contracts separately. |
| A02-15 | Preserve confirmed controls: 69 native physical slot records, 31 weapon default-grip/damage records, nine no-effect armor configurations, four mixed inventories/coin boundaries and nine ordinary roll outcomes, or a maintained equivalent with an independent native oracle. Record unsupported/deferred F01–F06 explicitly instead of claiming whole-system parity. |

Tests should target these real behaviors, not add unrelated fault scenarios as a
substitute for the failing workflows. Run the existing twelve suites, explicit
module/UI/hook typing, module checking and isolated packaging after implementation.
Record final archive identity, runtime/source versions and actual selected cases.
Prior ADR-0001 results remain useful regression evidence, not proof of A02.
Prepare the full matrix before requesting native testing and complete all selected
cases on one build before asking the operator to switch to the other. Do not
repeat unrelated Core migration acceptance as a substitute for module workflows.

## Risks and alternatives

Native name-slug matching is part of casting-class eligibility, but it does not
justify treating equal names as equal documents or mutation targets. Catalog
filters must never determine what the actor owns. Broadening a shared cache with
caller documents would create privacy and stale-data risks; use scoped inputs.
Client-only validation would leave direct requests and stale dialogs incorrect.

Automatic replacement of all old actors from current templates was rejected:
it would erase legitimate customization and cannot reconstruct absent provenance.
Automatic casting permission based on a class title was rejected because native
uses active grants. A new Core migration service was not proposed: released
contracts already supply admin-managed migration, caller reads and writes and
versioned world settings; any further host need requires a concrete reproducer.

## Planning checkpoint

October 18, 2026: audit and proposed ADR prepared, live read-only evidence and
offline controls recorded, module guidance/index/architecture/handoff updated.
Expanded after the user's coverage review: SD02-09–13 and gates D5a/D5b,
A02-11–15, native model coverage matrix, matched controlled outcomes and F01–F06
follow-ups added. Previous ADR text saved locally before expansion. All twelve
unchanged offline suites pass; the new defect probes reproduce independently.
No application, test, migration, manifest, workflow or release metadata changed.
The initial audit made no Git or remote changes. The user subsequently authorized
a documentation checkpoint and preparation for remediation; the module handoff
records its branch/commit and execution order. Implementation is authorized; all A02 native acceptance remains pending. F01–F06 retain their separate scope decisions.

## Implementation checkpoint D0 — October 18, 2026

The implementation starts at documentation checkpoint `f5838a8` on
`fix/adr-0002-native-parity`, with a clean tree. A byte-for-byte pre-edit ADR
snapshot has SHA-256
`7617ae3d29dae71e4082440f05aa31b624e93f3ab2f0951eaf95b6c8f88bb348`.
Native authority was verified clean at release-4.0.6, commit
`9677d16b3903b3b640f00d4efd48249142ac8334`. Core remains read-only.

Maintained regressions now exercise actual module routes and native methods,
using sanitized fixtures. `native-parity.test.ts --baseline` reproduces the
Knight's empty alternate catalog (0 rather than 46) and an invalid advancement
writing HP/XP despite a missing required spell. `native-parity.oracles.mjs
--baseline` reproduces SD02-09–13 and retains the independent native controls
(69 physical slots, 31 weapons, nine armor combinations, four inventories, nine
roll outcomes). Baseline mode reports failures explicitly; ordinary invocation
returns failure until corrected. This is controlled upstream evidence, not
Foundry acceptance. D1–D7 and A02-01–15 remain open.

## D2 shared model and advancement preflight — October 18, 2026

`logic/spell-model.ts` separates exact Class identity, active grants, alternate
list and progression. Owned rows retain Actor/embedded Item identity without
requiring provenance; the Turn Undead mapping is shared. Explicit table null is
zero; missing, negative and invalid entries stay unavailable. Knight progression
now offers the native 46-spell Witch list while retaining Knight counts.

`callerLookups` resolves only the selected Actor's Class, owned Spell Class refs
and linked Scroll/Wand Spell/Class dependencies. Results are request-local;
permission checks surround compendium reads. The caller view and execution use
`prepareShadowdarkView`/`prepareActorCore`, without populating the user-invariant
registry. ActorPage retires late responses across source/context/caller/world/
connection changes and refreshes on public Item events. The view compares its
source review before and after dependency reads. Core's generic cached preparation
remains synchronous; bounded caller enrichment belongs to the module sheet route.

Server advancement validates exact alternate-list membership and mandatory tier
counts against planned/actual native grants before writes. The UI no longer
waives required spells when the catalog is empty or deduplicates by name.
Six sanitized regressions pass, including zero writes for the previously accepted
missing-choice request. Explicit module/UI/hook typing passes on current Core.
The existing native-alignment suite passed 61/61 before the advancement preflight;
full rerun follows this checkpoint. Installed 0.19.2/0.19.3 public-interface proof,
managed intent, catalog/UI and native acceptance remain required.

## D3/D4 explicit inventory intent and caller catalog — October 18, 2026

Spell management now sends exact source additions and deliberate owned Item-ID
removals to one owner-bound server operation. It preflights list/tier, quotas,
source filters, permissions and a source review before writing. Additions precede
removals; an unsuccessful/uncertain addition stops replacement. Durable SDK
DataStore receipts store operation identities, review hashes and outcomes, not a
world-data cache. Confirmed operations are not repeated. An interrupted create is
uncertain, never identified by a name/origin guess. Process-local Actor queues
serialize these operations; the public SDK supplies no distributed CAS/atomicity.
Partial receipts from a previous server process require fresh inventory review;
completed receipts replay without writes. Installed restart proof remains D6.

The picker keeps source-less/duplicate owned rows independently of catalog data.
Cancel/unchanged save has no writes. Failed reads cannot generate removals.
Unresolved class rows remain visible/count separately and block quota additions
until exact-source resolution. Existing excess is preserved. Progression errors
and empty required catalogs block advancement; its Class is resolved from the
actual Actor when omitted by the request.

The existing shared collection store now accepts an explicit complete/partial
spell catalog. It combines caller-readable declared packs and world Items, keeps
per-source failures, and exposes recovery without treating missing data as empty
success. It does not claim arbitrary undeclared-pack discovery (F06).
`shadowdark.sourceFilters` is an authenticated preparation-affecting world Array;
native declarations/default[] match across4.0.0–4.0.6. Choices follow native source
title filtering; owned content and grants are unaffected.

Spell selection uses ModuleDialog and shared range/duration formatting. Owned
removal and catalog addition buttons are keyboard operable, named and distinct.
Refresh retains search; changed authority retires intent. Resource-card stacking
uses suspension. The five new actual-consumer browser regressions fail against
`f5838a8` (0/5), pass against the implementation (5/5), and the complete maintained
consumer run passes34/34. Eleven controlled native-parity cases pass; explicit
typing passes. The older suites retain their assertions, with caller/Class
fixtures corrected to exercise the now-required preflight; native alignment is
61/61, boundaries53/53 and world adoption13/13. Final floor/current installed
archive checks and all A02 native acceptance remain pending.
