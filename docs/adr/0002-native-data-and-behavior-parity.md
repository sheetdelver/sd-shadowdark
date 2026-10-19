# ADR-0002: Native data and behavior parity

**Status:** In progress

**Date:** October 18, 2026

**Scope:** Shadowdark module only; implementation and local checkpoint commits authorized.

**Audit:** [Post-release native parity](../audits/2026-10-18-spellcasting-and-native-parity.md)

**Current review:** Offline review of `dbbe93f2` found SD02-R1–R3. D3/D4 and the
creation-writer portion of D5 require corrective verification; native D6 and D7
remain open. See the [review addendum](#independent-review-addendum--october-18-2026).

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

## Selected decisions

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

## D5a action phases and outcomes — October 18, 2026

SD02-09: `planPrerequisites` spends limited uses before a roll or no-check chat.
The Actor operation queue serializes distinct last-use requests. A refused or
uncertain spend prevents the result. A result call has a write-ahead phase and
is attempted once: failure/acknowledgement loss leaves the spend and an explicit
uncertain result; replay never spends/posts/rolls again. Consequence retries
reconcile the known outcome only. Durable SDK receipts survive an adapter epoch;
partial records without their process continuation require fresh source review.
This is not a distributed transaction or a guarantee that an unacknowledged
upstream roll/chat did not happen. Real Core process-restart proof remains D6.

SD02-10: Potion prerequisites swap active/alternate name and description, set
identification, preserve unknown fields and activate exact owned effect IDs.
Every activation is attempted as native's Promise.all group; any failure prevents
chat/deletion. Empty alternate name follows native's English “Unidentified
{type}” template; absent StringFields use their proven empty initial values.
Use posts only after prerequisites and deletes the owned Item, regardless of
quantity. A failed deletion leaves fully identified source; replay neither swaps
again nor repeats chat. No missing effect identity is guessed.

SD02-11: the prepared action declares Player owned-spell focus eligibility.
NPC requests cannot use the Player exemption, and NPC cards hide that control.
Scroll/Wand consumption/loss remain separate. SD02-13: zero disables critical
thresholds; missing/custom values retain native meaning. A manual total provides
no natural die and cannot establish a critical. Both effect shapes are covered.

The original native-method failure inputs now match for all12 selected D5a
checks (including six Potion failure/fallback boundaries), while the two language
checks remain explicit D5b failures. The69/31/9/4/9 controls still match. The new
maintained action-phase suite passes12/12 and actual card/Actor-provider browser
cases pass4/4. A recovery dialog retries the identical recorded payload and
suspends the resource card; uncertain results require review. Typing, native
alignment61/61, boundaries53/53 and world adoption13/13 pass. Existing mocked
runtimes now reflect confirmed source updates, so ordering checks no longer pass
merely because a write was recorded. All native A02 cases remain open.

## D5b native language fields and choice pools — October 18, 2026

SD02-12 is implemented through `logic/languages.ts`. Rarity is the stored
`system.rarity`; an unknown/missing value stays unclassified, regardless of name.
Registry, caller-prepared identity, Details and inventory picker use that field.
Ordinary language editing has no creation quota and preserves custom/unreadable
entries until explicit removal; an unchanged save is a no-op.

Creation uses independent ancestry, class, common and rare assignments, plus
exact fixed grants. Zero never becomes an allowance because a pool is nonempty.
The native Number/Array initial values are0/[]; invalid counts and required
unreadable references fail with explanations. One UUID cannot fill two pools.
Background has no native language-choice schema and contributes no invented pool.
The shared caller-bound plan resolves required exact refs, retains failures and
reads source filters through Core context. Generator and advancement render the
same plan; pending/stale plans retire with the shared caller/world generation.
Generator now creates through an SDK-backed module validation route, so incomplete
or crafted language choices cannot write an Actor. Advancement validates before
HP/XP/items, preserves existing extras and rechecks source/context before writes.

**Oracle clarification:** the original audit's language-limit probe carried the
module's implicit Common allowance into its expected aggregate. Direct execution
of native4.0.6 `CharacterGeneratorSD._loadLanguages` shows neither implicit Common
nor INT choices: all counts come from ancestry/class fields. The maintained oracle
now executes that native method (zero, INT+4 and independent positive pools)
instead of retaining that assumption. The original baseline output is preserved.
Fixed Common is supplied by the actual ancestry data when present.

Evidence:16/16 selected native-method checks pass, including the new direct
Generator cases;69/31/9/4/9 controls remain unchanged. Language rules/routes pass9/9.
The four mounted language cases fail against the checkpoint's actual picker,
Generator and rule helper (0/4), and pass current code4/4; the complete consumer
run passes38/38. All twelve required suites plus action-phase/language suites
pass, and explicit module/UI/hook typing passes on Core0.19.3. Installed floor/
current archive verification and every A02 native row remain open.

## D5 writer trace and historical disposition — October 18, 2026

The current Generator/importer shared `resolveSubItems` and advancement baggage
resolver could silently omit an unreadable fixed grant. The former also treated
native ancestry `talents` as choices when `talentChoiceCount` was zero; native
`CharacterGeneratorSD._loadAncestry/_loadClass` treats `talents` as fixed and
`talentChoices` separately. Required exact references now fail before creation/
advancement writes. Distinct same-name source documents survive enrichment.
Current resolved Spell copies retain their native Class refs, effects and source
metadata; no current writer was found fabricating the historical Knight grant.
This trace establishes possible omission paths, not the author of live records.

L01 (missing grants), L02 (missing Spell Class refs without provenance) and L04
(modified Knight grant) require explicit exact-source GM remediation. No new
migration is justified: deliberate removals/customizations cannot be distinguished
from omissions by Class title or Item name. The two required published migration
steps, identities and applied history are unchanged. See
[exact-source remediation](../native-source-remediation.md) for preview fields and
verification. Sanitized disposable copies for all three now prepare correctly
after only the reviewed edit, retaining unrelated/custom data. These tests do not
modify or establish acceptance in the operator world.

The exact Class lookup now takes precedence over all copies: a copied Class's
origin cannot satisfy a denied/missing reference. Extra active grants with owned
spells remain visible with explicitly unknown progression, rather than borrowing
a table or hiding inventory. Canonical Class selectors no longer match terminal
IDs or construct guessed pack UUIDs. New writer/copied-Class cases fail before
and pass after; the maintained parity suite is14/14. All fourteen existing suites
pass after correcting one fake resolver to expose its exact native fixture through
the public lookup path; explicit module/UI/hook typing passes.

## D6a caller lifecycle and integration hardening — October 18, 2026

The sheet now reads a bounded caller-authorized view with the same normalizer as
Core preparation, retaining title/resolved labels. A compact SHA-256 review token
replaces the full Actor POST baseline; source is re-read after dependencies.
No privileged projection or additional world store is introduced. Spells uses its
exact caller-derived Class model, without requiring unrelated Class browsing.
Denied dependencies remain explicit; unavailable/absent Actor data offers recovery
without asserting deletion. Ordinary source-copy requests require explicit
inventory intent and are distinct from rules-guided management/advancement.

Empty-key context events immediately hide and disable the old view while keeping
mounted manual state until authorization completes. Caller/world/role changes
retire the source; disconnect hides it and reconnect revalidates. Host callback
identity alone does not remount the sheet. Five actual ActorPage lifecycle cases
pass, including late responses, denial/retry, reconnect and callback replacement;
the original page fails the visibility/denial cases. Shared collection consumers
pass39/39, including world-Class management without declared Class demand.

The initial installed0.19.2 archive passed all eight360/768/1024/1440 theme cases
but exposed a sheet remount on live setting change and world Item pagination
starting at1. Both were corrected; final archive verification is ongoing and the
initial run is not recorded as passing overall. The public SDK uses zero-based
pages; a maintained route regression now requires page0 and complete world rows.
Crafted too-many, duplicate, wrong-list, wrong-tier and unauthorized extra spell
choices make zero advancement writes. Extra choices need a verified native Talent.
Creation refuses missing casting grants/unresolved Spell Class dependencies;
required selected sources cannot silently disappear. Floor/current typing passes.
All A02 native acceptance remains unexecuted.

## D6b installed public contracts and concealment — October 18, 2026

Healthy installed0.19.3 public SDK checks proved world/embedded Class reads,
source-preserving replacement, Array source-filter refresh and genuine process
restart: completed management/action receipts replay without writes and uncertain
spending does not request another result. Installed creation validates separate
language choices before its caller-bound SDK write; fixed source fields/effects
survive. Final combined runs remain in progress.

Two additional source boundaries were reproduced and corrected. The action route
now preserves Core's concealment contract: a null/hidden Actor is404, while an
explicit SDK owner denial remains403. The new maintained case fails before and
passes after, including receipt replay without disclosure/writes. Identity labels
also used the first owned Class even for a different/unavailable exact reference.
The shared identity projection now uses an owned label only for that exact Actor+
embedded Item reference; caller views resolve bounded identity refs explicitly.
The copied-Class label regression fails before and passes after. Readable owned
copies remain inventory; they cannot stand in for a referenced source.

Explicit upstream session termination is a separate observed host limitation:
after `socket.disconnect(true)`, reads recovered but the same caller's mutation
reported “user socket is not connected” on0.19.2 and0.19.3. No upstream Item write
occurred; the module retained the old Spell and returned an uncertain addition
receipt. The isolated installed harness contains `--probe-reconnect-write
--server-disconnect` for the minimal public reproduction. Ordinary transient
transport loss is tested separately with `interruptTransport`; no module relogin,
privileged fallback or Core edit is introduced. This is not CG-6's separately
qualified context-error typing issue, nor evidence of native acceptance.

The full native A02-01–15 procedure, exact fixture/source choices, before/after
oracles, account/permission scope and cleanup requirements are prepared in
[native acceptance run sheet](../native-parity-acceptance.md). Every actual native
row remains open until scoped operator authorization and execution.

## D6c writer provenance and mounted action retirement — October 18, 2026

The public generic Core Actor-create route was reproduced on released0.19.2 and
current0.19.3 with a sanitized Spell source: it deletes the Item's string-array
`system.class`. The module's validated creation route uses public
`runtime.documents.create` and preserves the same source arrays/effects, without
subsequent repair. This demonstrates an omission path relevant to L02; it does
not prove who wrote the historical operator records. Core remains read-only.
The generic route's cleaning is a precise external limitation for other callers,
not a blocker for this module's supported SDK path. Exact-source GM import also
retains the native Class identity and every fixed Talent effect.

Real SDK strict reads return null for any unmet threshold. Owner-bound module
operations now use one shared guard: an OWNER read succeeds; if null, an OBSERVER
read distinguishes visible/non-owner403 from concealed/absent404. Neither read
raises authority, and no write is attempted on denial. The guard is shared by
actions, management, advancement, inventory source copy and Actor language plans.
Durable receipts remain behind that current guard. Controlled13/13 action-phase
cases and boundaries53/53 pass; installed final verification follows.

Keeping sheets mounted during revalidation also requires retiring their action
callbacks. Empty-key context events, source revision and caller/world/connection
scope changes cancel open roll/confirmation callbacks. A pending result becomes
review-only; its late response cannot publish stale result/notice or enable a
retry. Debounced old-context writes retire. The actual card/provider browser
suite grows from4 to6 cases: the two new cases fail against `fd358ab` and pass
with this correction. Manual sheet/picker state still follows the shared store.

The native-method oracle now compares L01–L04 eligibility through actual native
`PlayerSD.isSpellCaster` and `_getSpellcastingAbility` methods, using explicitly
supplied sanitized prepared grant inputs and exact native Class documents. All20
checks pass, alongside the69/31/9/4/9 controls. This is controlled method evidence,
not a full Foundry preparation/effect lifecycle or native A02 acceptance.

## D6d final source paths — October 18, 2026

The remaining HP-roll helper used the first owned Class and could silently fall
back to1d4 after an unresolved selected Class. It now reads the exact caller-visible
Class, keeps established Class identity, validates its actual hit die and refuses
unavailable data before a roll. Only native class-less level-zero creation retains
its explicit1d4 die. HP/XP finalization and native HP-advantage handling remain.
The same mutable-copy/unresolved-source input fails before and passes after;
public installed verification also requires no roll/write when that Class is denied.

World Item edits now invalidate the existing shared collection store through the
public document/detail-directory events. Duplicate hints in one turn coalesce;
there is no second world store. Loaded and initially pending spell catalogs retire
old responses/intent while search survives. Both new actual-provider tests fail
against `b045ad1` and pass current code; all41 collection consumers pass. The final
installed harness additionally revokes/restores one world Spell while its picker
remains open. This extends context-event coverage to the actual catalog source.

Before these last source-path changes, the packaged browser run passed29 checks,
including all eight width/theme combinations; production passed21 and the released
floor's public workflow13. Full14 suites+parity+typing passed both hosts, and20
native-method checks matched. The final source archive and affected installed
checks are rerun; no intermediate run is promoted to final acceptance. Every
actual native A02 row remains open.

## Final controlled verification — October 18, 2026

The final runtime checkpoint is `50759ae`; module0.9.5 archive SHA-256 is
`76d127ee33cb463ad93f0ab5f01f0678e3e8c67d1158e106a8d8546e73ac14a3`.
All fourteen maintained suites, parity17/17 and explicit module/UI/hook typing
pass on Core0.19.2 and0.19.3. Native-source conformance is89/89; actual controlled
native-method comparisons20/20 retain the69/31/9/4/9 controls. Mounted collection/
action/Actor lifecycle cases pass41/6/5. Module checking and isolated packaging pass.
The installed final archive passes30 released-floor development checks (all eight
width/theme cases) and22 current-production checks (matrix explicitly omitted).
World Item permission/source events, pending/loaded invalidation, exact caller
privacy, creation/import source preservation,1000 additional inventory rows,
explicit replacement and real restart receipts all pass. Both migration shapes
and every location pass independent source/receipt/restart/restored-data checks;
existing required identities/history and broader inventory evidence are preserved.

See the [durable validation record](../audits/2026-10-18-adr-0002-validation.md)
for commit contents, finding-specific before/after evidence, artifact paths and
scope qualifications. Generic Core Actor creation still strips string arrays;
this module uses the proven public SDK path. Explicit session-kick recovery is
separate from passing transient reconnect, with no module workaround.
All task services stopped; operator services preserved. No native world was
contacted. **D6 native, D7 final closure and A02-01–15 remain open on both native
generations** pending confirmed disposable-world authority and execution.


## Independent review addendum — October 18, 2026

The implementation review of `dbbe93f2` reran offline suites, controlled native
methods, explicit typing on both supported Core toolchains and current module
checking. These pass, but independent handler probes/source tracing establish
three open corrections in the [active audit](../audits/2026-10-18-spellcasting-and-native-parity.md#independent-implementation-review--october-18-2026).
The pre-review ADR was saved locally before edits as
`temp/adr0002-review/ADR-0002.before-review.md`, SHA-256
`627a7220e3923136917995c2d605df1a9d4703e37b565f4f8a5921651044962b`.

| Finding | Required correction | Completion evidence |
| --- | --- | --- |
| SD02-R1 | Advancement completion must include required Item outcomes. Keep native grant-before-final-advancement ordering and safe partial-operation review/recovery. A target-level event alone cannot close the dialog as success. | First/later grant failure, uncertain receipt, final Actor-write failure and replay preserve exact source and confirmed IDs; mounted UI never announces completion prematurely. |
| SD02-R2 | Enforce native creation spell requirements at the final `characters/create` boundary using shared authoritative preparation/validation. | Missing, excess, duplicate, wrong-tier/list and changed-plan submissions make zero Actor writes; valid caster/level0 creation preserves native fields/effects. |
| SD02-R3 | Rebind open management to current Class/list/progression facts while preserving safe manual state. | Same-Class progression and alternate-list changes refresh counts/list/request identity; stale intent retires and completed/uncertain receipts remain accurate. |

These are selected implementation corrections, not requests for new Core APIs,
new migrations, feature-backlog work or a higher compatibility floor. R1 exposes
an existing finalizer/UI gap retained by this implementation; R2 is in the new
creation writer; R3 is in the revised management consumer. Public SDK writes
remain non-atomic. Correct source ordering and truthful recovery are required;
no implementation can promise that an upstream write never fails.

Earlier declarations that D0–D5 were complete are checkpoint evidence, qualified
by this addendum: **D3/D4 and the creation-writer part of D5 require corrective
verification.** Preserve passing evidence and add the missing failing-before /
passing-after cases. D6 native, D7 and A02-01–15 remain open; this offline review
provides no new live/browser/native acceptance. Follow the existing scoped
checkpoint process during remediation; this review itself authorizes no Git,
release or live operations.

### SD02-R1 correction checkpoint — October 18, 2026

Advancement now journals one caller/world/Actor/request plan through public SDK
DataStore. Native grants precede the frozen final level/XP/HP patch; HP still
prepares all planned bonuses. Confirmed Item IDs survive refused later writes,
replay and restart. Refusals can continue; unknown acknowledgements never repeat.
An explicit reviewed recovery can bind an uncertain grant only to an exact owned
ID whose complete planned fields match, then verify the original Actor after
subtracting confirmed grants. A lost final-patch acknowledgement requires review
of its exact full-source expectation. Unrelated edits, changed dependencies or
context need exact-source remediation. Incomplete operations block replacement
advancement, including another caller; these are bounded receipts, not a
transaction or distributed CAS.

The mounted workflow no longer closes on a target-level Actor event. Only a
completed server operation closes/announces success. Reopening exposes durable
receipts and the original request; the recovery panel provides retry, source
refresh and explicit exact-ID review. New regression suite
`advancement-recovery.test.ts`: ten cases fail against08997a4, ten pass after.
`parity-corrections.browser.mjs --only=R1`: two mounted cases fail before, pass
after with network blocked. Module/UI/hook typing passes on0.19.2/0.19.3;
native-alignment61/61 passes with source-mutating SDK doubles. This is offline
implementation evidence. R2/R3 and all native A02 rows remain open.

### SD02-R2 correction checkpoint — October 18, 2026

The final level-one creation writer now repeats the same server advancement
preparation with current exact sources. It requires matching Class/Ancestry,
current world revision and the earlier plan's canonical grant review, then
compares every submitted grant (including full native fields/effects/arrays) to
the freshly prepared multiset. A submitted hash alone grants no authority.
Missing/excess/duplicate/wrong-tier/wrong-list choices cannot reach Actor create;
ordinary spells remain separate from exact fixed grants and extra-Talent spells.
Overlapping ordinary/extra selections are rejected before assembly deduplication.
Generator forwards that plan and copies prepared grants without another client
enrichment/discovery pass. Level zero retains its independent flow; ordinary
inventory management and separately authorized GM imports do not use this quota.

`creation-validation.test.ts` exercises the real final writer/preparer with native
Wizard/Priest/Spell/Talent sources: eight negative groups fail on08997a4; both
positive controls pass there; all ten pass after. The original three-talents /
zero-spells bypass now returns400 and makes zero Actor writes. Valid caster,
extra-spell and level-zero cases preserve exact source data. Existing language
regressions9/9 and mounted collection/Generator checks41/41 pass; explicit typing
passes on0.19.2/0.19.3. This is offline evidence; R3 and native A02 remain open.
