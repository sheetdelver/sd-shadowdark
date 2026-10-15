# Shadowdark ADR-0001: Native Alignment and Resource Cards

**Status:** Proposed — module-only native alignment and resource cards
**Date:** October 15, 2026
**Related Core decisions:** ADR-0021, ADR-0027, ADR-0038, ADR-0049, ADR-0057, ADR-0063

## Context

After the ADR-0063 closeout and Shadowdark 0.9.4 release, operator issue 23
reported missing Weapon Mastery bonuses on Foundry 14.367 with native
Shadowdark 4.0.6. Prim, a level-1 Fighter with STR9 and Longsword mastery, shows
`-1 d8`; the expected result is `+0 d8+1`. The supplied raw effect excerpt uses
`effect.system.changes`, string `type: "add"`, a formula
`1+floor(@level.value/2)` and `phase: "initial"`. Module fixtures and readers
use top-level `changes` and numeric `mode` instead.

The user requested a complete module review against the supplied native source,
alignment with Foundry-provided data/rules/actions, removal of competing client
derivations, a review of paper and tabbed sheets, and a plan for resource cards.
This pass documents the review and corrective steps. It changes no application
code, dependency, manifest, version, source document or remote repository state.
ADR-0063 remains Completed on its recorded evidence; these are successor findings.

The inspected baseline is Core 0.18.1 at `8c43170`, Shadowdark module 0.9.4 at
`09b2633`. **Native 4.0.6 is the released, installable parity target.** The user
clarified this baseline; the [Foundry package listing](https://foundryvtt.com/packages/shadowdark)
and [latest published release](https://github.com/Muttley/foundryvtt-shadowdark/releases/tag/release-4.0.6)
corroborate it as of October 15, 2026. Installed native 4.0.6 source matches it.
The authoritative source is native tag `release-4.0.6`, commit
`9677d16b3903b3b640f00d4efd48249142ac8334`. The five audited native files match
the installed 4.0.6 source byte-for-byte. Earlier 4.1.0 development comparisons
are historical context; development-only additions are not current module defects
or corrective acceptance requirements. Local checkout state belongs in the module
handoff; this decision is tied to the release tag regardless of checkout location.
Foundry v14 source confirms legacy effect getters exist on instantiated native
documents, explaining why native `.changes`/`.mode` code works while raw JSON
does not. A module-prepared Actor is not native Foundry browser preparation.

The [module audit](../audits/2026-10-15-native-alignment.md) holds detailed source
anchors and technical evidence. Shadowdark ADR numbering is independent of
Core and starts at 0001. Finding IDs SD01-01–17 and acceptance IDs A01-01–10
belong to this module decision. Agent workflow belongs in the module's
[AGENTS.md](../../AGENTS.md), and current task state in its local handoff.

## Ownership and external dependencies

Implementation covers this module's code, tests and documentation through existing
public Core/SDK contracts. Core changes, other modules and future Core card
integration are outside scope. SD01-05's Core recursive UUID rewrite remains an
external dependency. Module-owned identity handling can be corrected independently;
any acceptance case that needs a host contract change remains explicitly blocked.
The module must not conceal that limitation with guessed data, private transports
or a competing source store/lifecycle. Source-unavailable features retain an
explicit unavailable state. C0/C4 contract gaps and C8 host-layout gaps follow the
same boundary. A recorded external dependency is not a passed or fixed finding.

## Evidence and findings

Static source review covered the module adapter/registry/rules, Core projection
and runtime boundaries, server routes, generator/importer/advancement, both
sheets and their tabs/modals, manifest and current tests. Native Player/NPC/Light,
item, effect, dice and sheet sources were compared. Existing site screenshots
S02/S03/S04 were inspected. Synthetic probes invoked existing helpers and fake
in-memory document readers without live services or document writes.

| ID | Finding and evidence | Priority / owner |
| --- | --- | --- |
| SD01-01 | V14 mastery produces `-1 d8` with no warnings; identical legacy data produces `0 d8+1`. General effects also coerce strings/formulas to zero and differ on suppression/transfer. | P1 / module |
| SD01-02 | V14 REPLACEME survives mastery selection and validation. Effect editor replaces multi-change data with one legacy change; mode3/4 labels are reversed. Boon editor reconstructs effects; bare effect IDs conflate parents. | P1 / module |
| SD01-03 | NPC DEX+3 becomes0; Player score0 becomes10; score24 gets+7 instead of native bounded+4. Effective HP/system/stat paths diverge; combat suggestions still use `.base`. | P1 / module |
| SD01-04 | Native shield `ac.modifier:2` is ignored; DEX+3 plus shield gives AC13 instead of15. Base15 armor allowing DEX gives15 instead of18. Slots use talent-name/legacy-field rules needing native comparison. | P1 / module |
| SD01-05 | Core Actor detail recursively replaces compendium UUID strings with names, including canonical references. Module spell normalization also replaces class references. Server and browser then see different identities. | P1 / module consumers in scope; Core rewrite external dependency |
| SD01-06 | Generic module document route ignores caller runtime and reads the base system-level resolver, which accepts world/embedded UUIDs. Synthetic denied-caller probe invokes base reader and returns200. No real private content was accessed. | P0 / module using existing Core policy |
| SD01-07 | Registry returns another pack's document for the same terminal ID. Name-based spell matching/deduplication loses identities. Epoch/pack invalidation of registry/UI caches needs tests. | P1 / module |
| SD01-08 | Spell defaults use class-name/INT guesses and fabricated name-only spell objects; server uses another calculation. Native checks, spell/wand/scroll consequences, Class Ability uses and potion actions lack one complete typed flow. | P1 / module; Core services reused |
| SD01-09 | Generation/advancement/spell management duplicate maps and limits. Mastery choices are hardcoded; missing imports may drop gear or infer quantities/slots. Spell learning does not validate native source type/eligibility and drops fields. | P1 / module |
| SD01-10 | Several projectors and React components independently derive names, spell capabilities, slots/groups and roll defaults. Authoritative false can trigger a fallback recomputation. | P1 / module |
| SD01-11 | Raw `_id` items retain no `id` while some UI writes use only `id`. Actor-only effects disappear from the normalized sheet list. | P1 / module |
| SD01-12 | Debounces/drafts lack complete actor/epoch cancellation; fetch ordering, error propagation, optimistic rollback and multi-write reconciliation need correction and race tests. | P1 / module |
| SD01-13 | Description rewriting is not sanitization; some HTML sinks bypass the SDK sanitizer. New cards must preserve native identified presentation and exclude unauthorized alternate/GM-only fields. No exploit was run. | P1 / module authorized projection |
| SD01-14 | Paper sheet truncates attacks at five, lacks feature details, uses immediate spell rolls, name-based sections and boolean-only luck; clickable divs lack keyboard semantics. | P2 / module |
| SD01-15 | Advanced tabs and custom modals need complete accessibility, active-tab lifecycle, HUD/safe-area/scroll checks. Existing screenshots alone do not prove all controls unreachable. | P2 / module; Core layout defects are external dependencies |
| SD01-16 | Native capability coverage is implicit. NPC features/specials/movement/spells and module bestiary need a typed projection and declared Actor source; native scene/time hooks remain separate. | P2 / module |
| SD01-17 | Legacy fixtures and prepared component inputs do not exercise the actual v14 raw → HTTP → UI → server path. Prior passing render counts did not cover that boundary. | P1 / tests and acceptance |

P0 addresses caller visibility before expanding resource lookup. P1 addresses
correctness/data preservation; P2 addresses presentation/coverage. These are
implementation priorities, not claims of live exploitation or complete native
compatibility. The module audit records source anchors and native file hashes.

## Proposed decisions

### 1. Preserve Foundry source and identify every derived value

Use exact native source fields, canonical UUIDs and declared pack data first.
Keep source, module-prepared values and caller-authorized presentation distinct.
Core owns stores, lifecycle, authorization and shared presentation services;
Shadowdark owns Shadowdark rules. Preparation remains pure/deterministic under
ADR-0038, with immutable hydrated context loaded before readiness.

Raw data does not serialize every native getter or prepared formula. Where a
derived rule is necessary, use a bounded module implementation tied to the
supported native version's source and independent expected cases. Reuse an
environment-neutral native helper only if its dependency/license boundary is
suitable; do not instantiate a hidden Foundry browser/runtime. Do not claim
that locally prepared data was supplied by native Foundry.

Missing data never authorizes invention. An absent weapon die remains
**Damage unavailable** with a diagnostic naming the relevant field. Unknown
caster ability, property, action, table result or source reference is similarly
unavailable/unsupported, with an actionable reason. Defaults are allowed only
when the native schema/rule or explicit user choice establishes them. Do not
turn missing numbers into zero if zero would falsely imply a valid result.

### 2. Unify effects without erasing native semantics

One module boundary recognizes legacy and v14 serialized effects and exposes a
lossless canonical view including owner, change key/value/type, phase, priority,
disabled/suppression/transfer/situational state and original fields. Define
precedence for a payload containing both shapes and prove it cannot double-apply.
Write back in the supported version's format without discarding unknown metadata.

Separate general phased preparation from native roll-selector aggregation.
Preserve native typed values and ADD/MULTIPLY/OVERRIDE grouping where that native
method specifies it. Do not impose numeric weapon evaluation on class arrays,
strings or every effect phase. Supported formula syntax is explicit and safe;
unsupported syntax yields diagnostics, never eval, guessed values or silent omission.

### 3. One prepared view and one action preparer serve every surface

Define a typed module Actor/item/effect/resource view within the existing prepared
contract. Include identity/provenance, effective stats, inventory groups/capacity,
feature/spell capabilities, action availability and diagnostic state. Reuse
existing generic `derived` fields expected by Core. Choose one canonical module
view; any transition alias must only reference/project that view, not recompute it.

The audit recommends a future Core correction to recursive UUID-to-name
substitution, following a consumer inventory and regression checks; that change
is outside the module-only scope. Keep module labels separate and record any
resulting public-contract dependency explicitly. No system-name condition in Core.
Use exact identities for world, compendium and owned documents; treat aliases
as explicit parsed forms, not terminal-ID/name guesses.

UI components may format, filter, sort, select and manage drafts. They must not
derive system rules, invent spells, infer caster classes from names, or select
fallback damage. Selection-dependent action preparation can use one shared pure
module helper; server execution revalidates current source/revision/permissions
and calls the same logic. User-entered roll adjustments remain explicit overrides
of individual components, not a substitute for authoritative defaults.

### 4. Caller authority applies to every route and card

Use `req.runtime` for world/embedded reads and writes. System-level initialization
can index declared compendiums but cannot serve an arbitrary world UUID to a
caller. Scope compendium hydration to exact declared packs. Never share cached
caller-specific documents or card projections across subjects/epochs. Retain
Core's journal/whisper/ownership projections and structured permission errors.

Cards select only permitted fields, including native current identified state.
Native alternate identity storage is not player-visible card content by default.
Use SDK safe rich-text/URL handling and typed reference actions; presentation
sanitization must not rewrite source/editor content.

### 5. Resource cards are a module feature first

Add one module-local resource-detail controller/modal with typed layouts for
Spell, Item/Weapon/Armor, magic resources, features and NPCs. Every layout uses
the same authorized prepared data as both sheets. Magic resource is a
presentation category based on native type/fields, not a new native Item type.

| Kind | Minimum details | Action behavior |
| --- | --- | --- |
| Spell | Title, tier, class/source, range, duration, full description, lost/available state and casting facts | Paper spell click opens card; Cast opens existing SDK RollDialog. Advanced sheet delegates to the same action. |
| Item/Weapon/Armor | Title, properties, quantity/slots/cost when defined, description, equipment state, base versus Actor-adjusted damage/AC | Permitted existing actions use exact embedded identity; editing/destruction remain explicit. |
| Magic resource | Native identified presentation, spell choices, uses/lost/broken state and details | Resolve triggering item and selected spell; unavailable actions explain why. |
| Feature | Full name/text, source, uses/recovery and supported check facts | Passive details or native-backed Use/Check; no generic attack fallback. |
| Monster/NPC | Level/alignment, HP/AC, explicit ability modifiers, movement/dark adaptation, attack counts/ranges/damage/specials, spells/features | Module bestiary browsing and complete read-only cards. No implied spawn/encounter/share action. |

Compendium preview and owned instance are distinct. Preview without an Actor
does not offer a fictitious cast. Handle loading, denied, missing, unsupported,
empty and stale state. Cast cancellation restores the card; success reconciles
with current prepared data; repeat clicks cannot double-consume resources.

SDK RollDialog and ConfirmationModal remain the host action frames. The current
SharedContentModal compatibility component is inert and is not a general resource
dialog. If no suitable public dialog frame exists, use one accessible module-local
frame; no private Core imports or SDK expansion are required. It must implement
dialog semantics, focus containment/return, Escape behavior, scrollable content,
keyboard access, mobile safe areas, active theme and orderly modal stacking.

The user-provided [spell-card reference](https://limpjellyfish.itch.io/limpjellyfishs-old-school-spell-cards),
[monster-card reference](https://kidsplayttrpgs.blogspot.com/2024/04/shadowdark-monster-cards-z.html)
and [resource catalog](https://dickloraine.github.io/shadowdark-resources/#/magic-items)
inform compact information hierarchy. Card content comes from authorized Foundry
documents; no imported third-party artwork/content library or export/printing
feature is required. Future Core consumption/generic card SDK is DW-13 and
explicitly outside this implementation plan.

## Implementation sequence and checkpoints

All boxes are pending. For every checkpoint, record changed paths, the source
oracle, red-before/green-after evidence, remaining limitations and the next
dependency in the module audit. A restatement of a finding is not its resolution.

### C0 — Pin scope, sources and failing boundary cases

- [ ] Inventory released native 4.0.6 actor/item schemas, effect forms, roll
  selectors, relevant settings, templates/tables and action consequences. Label
  historical 4.1.0 development comparisons separately; their additions do not add
  implementation or acceptance obligations to this correction.
- [ ] Record full native/module/Core versions and reference hashes. Keep sanitized
  raw-source fixtures distinct from native prepared/result oracles and
  module-prepared expected output. Do not relabel synthetic Prim-like data as a
  captured Prim Actor. A native capture requires an approved local instance or
  user-provided data; no default production socket.
- [ ] Add focused red regressions for SD01-01/02/03/04/06/07/11; reproduce issue23
  through the actual adapter and HTTP projection, not just a helper. Add both
  v13/legacy and v14 shapes where compatibility is claimed.
- [ ] Produce a field/action coverage inventory: native source, preparation owner,
  consumer, supported status, diagnostic and test. Include settings such as Pulp
  mode; if the runtime cannot provide needed settings, define a narrowly scoped
  generic contract change for review instead of private transports or defaults.

**Gate:** failing cases are independently justified, source versions are pinned,
and there is no claim of native acceptance without a native oracle/capture.

### C1 — Repair access and serialized-effect boundaries

- [ ] Route world/embedded lookups through caller runtime; restrict shared pack
  lookup to declared exact UUIDs. Test denied users and restricted journal/chat
  projections, including after a privileged read. Inventory every caller of the
  singleton resolver, including spell learn/table/card paths.
- [ ] Add canonical lossless effect reading/serialization with original metadata,
  owner identity, phase/priority and numeric/string mode mapping. Resolve mixed
  shape precedence, unknown types and zero values explicitly.
- [ ] Implement native suppression/transfer/situational selection rules in the
  relevant preparation/action stages. Preserve unsupported changes for editing
  and diagnostic display; do not silently discard them.
- [ ] Prove registry cache reset/rebuild across epoch/pack changes, no ambiguous
  cross-pack terminal-ID match and no caller world data in shared collections.

**Gate:** issue23 shape is visible to the rule layer; denying caller reads are
honored; effect and lookup data round-trip without loss. Access gate precedes C7.

### C2 — Preserve identity and define the single prepared contract

- [ ] Inventory this module's consumers of Core Actor detail UUID substitution.
  Preserve canonical references and explicit labels in module-owned paths using
  the existing public SDK. Record the Core recursive rewrite as an external
  dependency; do not edit Core or other modules to remove it in this work.
- [ ] Define typed module view and canonical references for Actor, embedded Item,
  effect owner and compendium resource; normalize `_id`/`id` access once.
- [ ] Split raw fields, prepared results and caller projection. Include preparation
  completeness/provenance; remove mutations that replace canonical source
  references with names. Keep Core's prepared lifecycle/revision guarantees.
- [ ] Define one reference/description handling path using existing SDK sanitation
  and permission APIs. Cache only data appropriate to its scope and epoch.

**Gate:** module-controlled HTTP/SDK paths preserve exact identities and source
bytes; both layouts and server resolve the same item despite duplicate/changed
names. Mark cases still affected by Core rewriting as externally blocked, not
passed. No Core changes belong in this module-only implementation.

### C3 — Align effective statistics, inventory and weapon preparation

- [ ] Implement Player/NPC-specific ability rules, bounded Player modifiers,
  effective HP, initiative and manifest suggested stat paths. Preserve explicit
  NPC AC/modifiers and saved GM overrides.
- [ ] Replace armor name/AC-threshold guesses with native base/attribute/modifier,
  best-armor/bonus-armor and effect-selector rules. Prove order independence.
- [ ] Align slots, quantities, free carry, coins/gems, stashed/equipped categories
  and effect-granted capacity against native aggregation and settings.
- [ ] Extend shared weapon preparation through C1 effects: property/base/name/this/
  all selectors, melee/ranged/thrown/handedness, numeric and supported dice/string
  damage, upgrades/extra dice, and native roll configuration. Preserve missing
  damage diagnostics and base-versus-Actor labeling.
- [ ] Expose all results through C2; a later sheet/card must not reconstruct them.

**Gate:** source-backed expectations agree across prepared Actor, combat fields,
paper/advanced/inventory/detail views, dialog defaults and server roll inputs.

### C4 — Make actions explicit and native-backed

- [ ] Build one typed preparer for checks, attacks, spells and Class Abilities,
  including ability selection, bonuses, signed advantage, applicable situational
  choices, thresholds/critical configuration and diagnostics.
- [ ] Resolve spells and magic resources by full source and triggering item
  identity. Handle multiple wand spells, NPC casting fields, lost/broken state,
  class/item eligibility and exact native ability metadata. Remove class-name,
  name-only virtual spell and arbitrary item-data fallbacks.
- [ ] Use existing Core roll/chat/dice contracts for execution. Revalidate source,
  ownership and action eligibility on the server. Model explicit manual modifiers
  without trusting supplied content to establish identity or permission.
- [ ] Implement and verify supported native post-result consequences: spell loss,
  scroll consumption, wand loss/breakage, limited uses, ability loss, potion use,
  standard/Pulp luck and bounded rest/recovery. Inventory each rule's setting and
  source. If existing SDK lacks the necessary result/write boundary, document
  the precise generic gap for approval; do not add private transports or silently
  declare the workflow complete.
- [ ] Design cancellation, duplicate-submit protection, write failure and retry
  reconciliation. Do not reroll or double-consume on a network retry, or promise
  multi-document atomicity without platform support.

**Gate:** identical inputs give identical default action/result semantics from
paper, advanced and card entry points. Unsupported actions are explicit; a
generic d20 is not a fallback. Native browser/scene hooks remain out of scope.

### C5 — Correct generation, advancement, imports and editors

- [ ] Feed mastery and other choices from declared native definitions/templates;
  retain fixed/rolled grant independence and exact counts. Support v14 placeholders
  and reject unresolved choices before any write in every creation path.
- [ ] Reconcile client/server/table/talent maps into one source-backed rules path.
  Validate class/spell/source type, grant eligibility, language/stat choices and
  limits on the server. Preserve full allowed source fields/effects on copying.
- [ ] Replace silent importer loss/guesses with a preview of unresolved references
  and explicit supported conversion rules. Keep user-entered custom items distinct
  from resolved native items. Never infer damage from a familiar weapon name.
- [ ] Make effect/boon editing multi-change and lossless with correct mode labels,
  stable owner-qualified identity, disabled/suppressed visibility and no-op
  round-trip preservation. Use shared confirmation/error UI, not native alerts.

**Gate:** raw templates are unchanged; invalid/cancelled operations write nothing;
creation and editing preserve both formats and all unrelated metadata. Existing
Actor repair/migration is not authorized (DW-11 remains deferred).

### C6 — Consolidate sheets and mutation state

- [ ] Remove competing React rule derivations and redundant level-up ownership.
  Both layouts consume C2/C3/C4; authoritative false/zero are respected.
- [ ] Scope drafts, dialogs, item selection and caches to Actor/epoch/revision.
  Cancel stale debounce timers, sequence requests, reconcile optimistic changes,
  expose failures and use per-operation pending state.
- [ ] Fix ID-only write paths and effect-list duplication/omission. Handle deleted
  or permission-revoked resources while a modal is open.
- [ ] Give spell management, treasure sales and other multi-write flows explicit
  completion/partial-failure behavior. A caught error must not look like success.
- [ ] Remove paper's silent five-attack cutoff; expose complete features, free carry
  and capability-based sections. Test tab disappearance/overflow and return state.

**Gate:** tests exercise rapid edits, actor switches, reconnect, denied/failed writes,
deletion and out-of-order responses; sheet values and actions stay synchronized.

### C7 — Implement resource details and module bestiary

- [ ] Define authorized card view models and one modal/controller. Reuse full owned
  instance data and shared safe descriptions; no second projector in the component.
- [ ] Add paper spell → card → Cast → SDK RollDialog; use the same route from
  advanced sheets. Support item/magic/feature cards with appropriate actions.
- [ ] Declare exact native Actor pack(s) needed for a module bestiary after checking
  their metadata and permission policy. Extend module indexing to Actor/NPC data;
  do not request all packs or derive monsters from item/name guesses.
- [ ] Complete module browsing/preview and NPC card fields from C3, including
  attack counts, special text, movement and features. World NPC reads stay
  caller-bound. Provide a working module entry point, not just an unused component.
- [ ] Keep Core card SDK, encounter insertion, monster spawning and sharing out of
  this slice. Record the proven module view as evidence for deferred DW-13.

**Gate:** all requested card kinds work through real module data paths; spell
casting delegates to C4, hidden fields stay excluded, long/missing content and
permission changes are handled. No fabricated rules or static demonstration-only cards.

### C8 — Verify both layouts, tabs and modal interaction

- [ ] Cover paper and advanced Abilities, Inventory, Spells, Details, Notes and
  Effects at 360/390/768/1280px widths, including short viewport height and zoom.
- [ ] Check empty and large lists, >5 attacks, long names/descriptions, multi-spell
  wands, NPCs, observers/owners/GMs, standard/Pulp luck and unsupported states.
- [ ] Verify keyboard access, named buttons/dialogs, focus containment/return,
  Escape, scroll reachability, touch targets, theme contrast and non-color state.
- [ ] Check Core HUD/floating-tray overlap, sticky headers, tab overflow and modal
  stacking/safe areas in isolated rendering. Record demonstrated Core layout
  defects as external dependencies; do not edit Core or add fixed system-specific
  offsets to conceal them.

**Gate:** retain screenshots/interaction results for the actual revised components;
existing marketing screenshots and server-render counts alone do not satisfy this.

### C9 — Validate parity and obtain explicit acceptance evidence

- [ ] Run tracked module regressions (including new cases), explicit module typing,
  module checking and isolated packaging against the supported released Core
  toolchain. Root TypeScript alone excludes module code. Core tooling may be
  used read-only; keep test/package artifacts isolated and do not modify Core.
- [ ] Exercise raw source → adapter → prepared store → caller HTTP/SDK projection
  → both layouts/card → dialog → server execution; include errors and action
  consequences. Compare to independent native source-derived or captured oracles.
- [ ] Run isolated browser checks with network blocked except local test fixtures;
  no application/backend dependency on Playwright or a running Foundry browser.
- [ ] Perform the native/operator matrix below only with approved local/test-world
  access. Record versions, expected/actual, actor/resource, evidence and status.
  If unavailable, leave it pending; offline success is not native acceptance.

**Gate:** every SD01 finding maps to passing evidence, an explicit limitation or
a user-accepted deferral. No blanket closeout from a total test count.

### C10 — Reconcile documentation and release readiness

- [ ] Update module development/compatibility/action documentation and terse
  changelog notes. Document any future Core/SDK requirement in the module audit;
  do not edit Core architecture/SDK/module-authoring documents in this work.
- [ ] Reconcile the coverage matrix and module audit dispositions, keeping unknowns
  distinct from fixes. Keep the implementation handoff and evidence in the module;
  report any proposed root tracker/ADR reconciliation to the user without editing
  Core-owned documents or local root trackers.
- [ ] Close/archive only after agreed acceptance or an explicit user closeout on
  stated limitations. Do not reopen ADR-0063 or promote unrelated deferred work.
- [ ] Produce a module release-readiness summary with the supported native/Core
  baseline, verification evidence and remaining external dependencies. Repository
  release authorization and versioning rules are maintained in AGENTS.md.

## Required regression and acceptance matrix

| ID | Scenario | Acceptance evidence / current status |
| --- | --- | --- |
| A01-01 | Prim-like L1 mastery, native 4.0.6 on Foundry14; Actor and Item effects | All surfaces `+0 d8+1`; effect disable/enable changes once; raw/native comparison. **Pending.** |
| A01-02 | Effect schema/type/phase/priority, selector/property/this/situational, formula/dice/string values | Correct native behavior or explicit unsupported state; legacy compatibility, no double application/loss. **Pending.** |
| A01-03 | Player/NPC scores/modifiers, HP, armor/shields/custom attributes, slots and combat | Shared authoritative results, source unchanged and GM overrides respected. **Pending.** |
| A01-04 | Spell, NPC spell, multi-spell wand, scroll, Class Ability, potion, luck/recovery | Correct eligibility/defaults and result consequences; cancel/retry/failure safe. **Pending.** |
| A01-05 | Generator/import/level-up and effect/boon edit | Full native source/effects retained, exact choices, no unresolved placeholder or guessed data. **Pending.** |
| A01-06 | Duplicate names/IDs, renamed content, missing packs and reconnect/world switch | Canonical identity, readiness, invalidation and visible unavailable state. **Pending.** |
| A01-07 | Denied/limited/observer/owner/GM world/embedded/compendium/card reads | Existing Core visibility, Secret/whisper and identification boundaries maintained; no cache bypass. **Pending.** |
| A01-08 | Paper, every advanced tab and all card kinds; phone/tablet/desktop/keyboard | Complete accessible content/actions, no trapped controls or HUD/modal collisions. **Pending.** |
| A01-09 | Rapid edits, Actor switch, stale responses, deletion/permission change, failed partial write | Correct reconciliation with current Actor; no stale/double action or false success. **Pending.** |
| A01-10 | Released 4.0.6 compatibility across claimed Foundry builds/serialized shapes | Prove each claimed combination; development-only 4.1 notes create no support claim or acceptance blocker. **Pending.** |

## Scope boundaries and decisions to settle at C0

Confirmed baseline: correct released native 4.0.6, including the reported v14
path, and preserve existing claimed legacy support with actual fixtures. The
4.1.0 `develop` snapshot is comparison context only. Features unique to it are
neither missing 4.0.6 parity nor work required for this ADR's closeout. Supporting
a future release needs separate selection and its own parity evidence. Do not
change installed native versions or compatibility minima simply to make tests pass.

Module-owned spell/item/magic/feature/NPC cards and a usable module bestiary are
part of this proposal. Future Core-wide card SDK and monster/encounter actions
are explicitly deferred (DW-13). Scene light/time/targeting hooks require separate
scope (existing DW-04); arbitrary native browser macros are not a server feature.
Historical Actor repair remains DW-11. Parked D&D runtime research remains parked.

If native settings or post-roll consequences reveal a missing public contract,
bring forward the precise requirement and a generic design before implementation;
do not silently expand to a Foundry-runtime project. No uncertainty about those
future choices prevents documenting or fixing the proven raw-effect/identity gaps.

## Alternatives rejected and consequences

- Adding only `effect.system?.changes` to the weapon helper leaves type mapping,
  mastery writes, general effects, editor data loss and tests unresolved.
- Copying another formula map into React recreates the mismatch across layouts.
- Replacing unresolved references with same-name items or default dice hides
  missing authority and can act on the wrong document.
- Treating legacy fixture success as v14/native acceptance repeats the original
  verification gap.
- Running a hidden native browser/runtime or importing private Core transports
  violates established ownership and is unnecessary for this bounded correction.

This plan is larger than a weapon hotfix because the same boundary failure spans
creation, preparation, display and actions. C1–C3 can provide an early corrective
milestone once independently verified; cards depend on those corrected data
contracts. Splitting delivery does not silently close the remaining checkpoints.
The proposed result is one source-backed rules/action path with two sheet layouts
and reusable resource details, accompanied by explicit capability limits.
