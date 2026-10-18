# Shadowdark ADR-0001: Native Alignment and Resource Cards

**Status:** Implementation in progress — Core 0.19.2 is the selected supporting release. The accumulated module implementation is checkpointed; RV-12/13 cover remaining release-floor and host-harness adoption. M5 and the complete native A01-01–10 matrix remain open. See the [Core 0.19.2 checkpoint and resumption](#core-0192-checkpoint-and-resumption--october-18-2026), which supersedes earlier statements that CG-5/7/9/10 still block on Core.
**Date:** October 15, 2026
**Related Core decisions:** ADR-0021, ADR-0027, ADR-0038, ADR-0049, ADR-0057, ADR-0063, ADR-0064

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
The review pass documented the findings and corrective steps without code
changes; the implementation that followed is recorded in the checkpoints below.
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

Implementation is in progress on module branch `fix/adr-0001-native-alignment`
(created from `e95fc47`, module 0.9.4; changes uncommitted for review). A checked
box means the module work is implemented with **offline** evidence: red-before on
the unchanged code, green-after with an independent source-derived oracle. It is
not native/operator acceptance; that column stays pending below. Per-finding
paths, authority, evidence and limitations are in the module audit's
[implementation dispositions](../audits/2026-10-15-native-alignment.md#implementation-dispositions).

Evidence shorthand: **NA** `src/tests/native-alignment.test.ts` (44 cases; the
first 30 were 9/30 on unchanged code; the 6 attack-mode cases failed on the
pre-fix logic; 4 inventory-control rule cases and 1 hidden-mode case added
(red without the sheet filter); 3 luck cases; 44/44 after), **BD**
`src/tests/boundaries.test.ts` (42 cases; cannot load on unchanged code because
the routes and helpers it covers did not exist), **BR** the isolated browser run
(38 interaction checks) described in the audit.

### C0 — Pin scope, sources and failing boundary cases

- [x] Inventory released native 4.0.6 actor/item schemas, effect forms, roll
  selectors, relevant settings, templates/tables and action consequences. Label
  historical 4.1.0 development comparisons separately; their additions do not add
  implementation or acceptance obligations to this correction.
  — Audit [coverage inventory](../audits/2026-10-15-native-alignment.md#field-and-action-coverage-inventory);
  All 39 native predefined effects are generated from `src/config.mjs` into
  `src/data/native-predefined-effects.ts`; two are flagged unusable with native reasons.
- [x] Record full native/module/Core versions and reference hashes. Keep sanitized
  raw-source fixtures distinct from native prepared/result oracles and
  module-prepared expected output. Do not relabel synthetic Prim-like data as a
  captured Prim Actor. A native capture requires an approved local instance or
  user-provided data; no default production socket.
  — Fingerprints rechecked; `src/tests/fixtures/native-406.ts` labels its Actor
  "Prim-like" synthetic source and replicates Core's projection separately.
- [x] Add focused red regressions for SD01-01/02/03/04/06/07/11; reproduce issue23
  through the actual adapter and HTTP projection, not just a helper. Add both
  v13/legacy and v14 shapes where compatibility is claimed. — NA (21 red).
- [x] Produce a field/action coverage inventory: native source, preparation owner,
  consumer, supported status, diagnostic and test. Include settings such as Pulp
  mode; if the runtime cannot provide needed settings, define a narrowly scoped
  generic contract change for review instead of private transports or defaults.
  — Pulp mode and `autoConsumeAmmunition` are unavailable to modules; the audit
  proposes a read-only allowlisted system-settings contract (external, not built).

**Gate:** met offline. No native capture exists; no native acceptance is claimed.

### C1 — Repair access and serialized-effect boundaries

- [x] Route world/embedded lookups through caller runtime; restrict shared pack
  lookup to declared exact UUIDs. Test denied users and restricted journal/chat
  projections, including after a privileged read. Inventory every caller of the
  singleton resolver, including spell learn/table/card paths.
  — `server/api/document.ts`, `effects.ts`, `spells.ts`, `level-up.ts`, `actions.ts`,
  `bestiary.ts` use `req.runtime`; the shared resolver serves declared compendium
  UUIDs only. NA/BD SD01-06 (denied read, privileged-then-denied, embedded reads).
  Journal/chat projections are Core's and are reached only through `req.runtime`.
- [x] Add canonical lossless effect reading/serialization with original metadata,
  owner identity, phase/priority and numeric/string mode mapping. Resolve mixed
  shape precedence, unknown types and zero values explicitly. — `logic/effects.ts`,
  `logic/foundry.ts`; NA A01-02 mixed payload, BD SD01-02 serializer cases.
- [x] Implement native suppression/transfer/situational selection rules in the
  relevant preparation/action stages. Preserve unsupported changes for editing
  and diagnostic display; do not silently discard them. — BD SD01-01 cases.
  Duration-based expiry is not modeled (no world time); see audit limitations.
  Effect conformance (Oct 16): every native 4.0.6 pack key mapped to a consumer;
  pre-4.0 keys from SheetDelver 0.9.4 reported with native's migration
  replacement instead of being silently dropped; the hand-written legacy table
  was removed. `effect-conformance.test.ts` guards drift (audit section
  "Effect conformance audit").
- [x] Prove registry cache reset/rebuild across epoch/pack changes, no ambiguous
  cross-pack terminal-ID match and no caller world data in shared collections.
  — `server/Registry.ts`; BD SD01-07, NA SD01-07.

**Gate:** met offline.

### C2 — Preserve identity and define the single prepared contract

- [x] Inventory this module's consumers of Core Actor detail UUID substitution.
  Preserve canonical references and explicit labels in module-owned paths using
  the existing public SDK. Record the Core recursive rewrite as an external
  dependency; do not edit Core or other modules to remove it in this work.
  — Structured `DocumentRef` values in `derived` survive projection (NA SD01-05).
  Raw source reference fields remain rewritten by Core; affected cases are listed
  in the audit. **External dependency, not fixed.**
- [x] Define typed module view and canonical references for Actor, embedded Item,
  effect owner and compendium resource; normalize `_id`/`id` access once.
  — `logic/prepared-view.ts`, `logic/identity.ts`; NA SD01-11.
- [x] Split raw fields, prepared results and caller projection. Include preparation
  completeness/provenance; remove mutations that replace canonical source
  references with names. Keep Core's prepared lifecycle/revision guarantees.
  — `logic/normalization.ts` no longer mutates source; NA "source data is not mutated".
- [x] Define one reference/description handling path using existing SDK sanitation
  and permission APIs. Cache only data appropriate to its scope and epoch.
  — `logic/description.ts` (SDK `processHtmlContent`); UI caches are world-scoped.

**Gate:** met for module-controlled paths. Cases depending on raw source reference
strings in the Actor detail response are **externally blocked** by SD01-05.

### C3 — Align effective statistics, inventory and weapon preparation

- [x] Implement Player/NPC-specific ability rules, bounded Player modifiers,
  effective HP, initiative and manifest suggested stat paths. Preserve explicit
  NPC AC/modifiers and saved GM overrides. — `logic/actor-preparation.ts`,
  `info.json` combat paths `derived.abilities.<key>.value`; NA SD01-03.
- [x] Replace armor name/AC-threshold guesses with native base/attribute/modifier,
  best-armor/bonus-armor and effect-selector rules. Prove order independence. — NA SD01-04.
- [x] Align slots, quantities, free carry, coins/gems, stashed/equipped categories
  and effect-granted capacity against native aggregation and settings.
  — Native slot formula and per-item usage; NA "slots start at 10".
- [x] Extend shared weapon preparation through C1 effects: property/base/name/this/
  all selectors, melee/ranged/thrown/handedness, numeric and supported dice/string
  damage, upgrades/extra dice, and native roll configuration. Preserve missing
  damage diagnostics and base-versus-Actor labeling. — `logic/roll-keys.ts`
  (port of `_getActiveEffectKeys`), `logic/weapon-rules.ts`; NA A01-01, weapon suite.
- [x] Expose all results through C2; a later sheet/card must not reconstruct them.

**Gate:** met offline: prepared Actor, caller projection, both layouts, dialog
defaults and server roll agree on `+0 d8+1` (NA A01-01, BR).

### C4 — Make actions explicit and native-backed

- [x] Build one typed preparer for checks, attacks, spells and Class Abilities,
  including ability selection, bonuses, signed advantage, applicable situational
  choices, thresholds/critical configuration and diagnostics. — `logic/actions.ts`.
- [x] Resolve spells and magic resources by full source and triggering item
  identity. Handle multiple wand spells, NPC casting fields, lost/broken state,
  class/item eligibility and exact native ability metadata. Remove class-name,
  name-only virtual spell and arbitrary item-data fallbacks. — BD SD01-08.
  Each weapon attack mode is its own labelled action: the weapon's type, an added
  Thrown attack (`PlayerSD.getAttacks`) and both grips of a Versatile weapon
  (`WeaponSD.getDamageFormula`; stored grip first). A two-handed grip is
  unavailable while a shield is equipped, and the server refuses modes the weapon
  lacks. Sheets (paper, Abilities, inventory details) omit unavailable modes;
  the card keeps them disabled with the reason. — NA SD01-08 attack-mode cases (user report: two identical "Dagger
  Attack" buttons).
- [x] Use existing Core roll/chat/dice contracts for execution. Revalidate source,
  ownership and action eligibility on the server. Model explicit manual modifiers
  without trusting supplied content to establish identity or permission.
  — `server/api/actions.ts` via `req.runtime.rolls`; BD C4 owner/unavailable cases.
- [ ] Implement and verify supported native post-result consequences: spell loss,
  scroll consumption, wand loss/breakage, limited uses, ability loss, potion use,
  standard/Pulp luck and bounded rest/recovery. **Partial:** spell loss, scroll
  consumption, wand loss/breakage, limited uses, ability loss and potion use are
  implemented (BD C4). Luck is edited, not automated; the Pulp setting is unreadable, so luck uses the native default (standard token) via one seam (`logic/world-settings.ts`, audit research note);
  rest/recovery and ammunition consumption are not implemented and say so.
- [x] Design cancellation, duplicate-submit protection, write failure and retry
  reconciliation. Do not reroll or double-consume on a network retry, or promise
  multi-document atomicity without platform support. — Request-ID replay (process
  local, 10 minutes), sequential reported consequences; BD C4, BR cast/cancel.

**Gate:** met for implemented actions; remaining consequences are explicit gaps.

### C5 — Correct generation, advancement, imports and editors

- [x] Feed mastery and other choices from declared native definitions/templates;
  retain fixed/rolled grant independence and exact counts. Support v14 placeholders
  and reject unresolved choices before any write in every creation path.
  — `logic/talent-choices.ts`, `server/api/level-up-engine.ts`; NA/BD SD01-02.
- [x] Reconcile client/server/table/talent maps into one source-backed rules path.
  Validate class/spell/source type, grant eligibility, language/stat choices and
  limits on the server. Preserve full allowed source fields/effects on copying.
  — BD SD01-09 learn/level-up. The table pattern map remains a documented convenience.
- [x] Replace silent importer loss/guesses with a preview of unresolved references
  and explicit supported conversion rules. Keep user-entered custom items distinct
  from resolved native items. Never infer damage from a familiar weapon name.
  — `server/importer.ts`, `ShadowdarkImportForm.tsx`; BD SD01-09 import.
- [x] Make effect/boon editing multi-change and lossless with correct mode labels,
  stable owner-qualified identity, disabled/suppressed visibility and no-op
  round-trip preservation. Use shared confirmation/error UI, not native alerts.
  — `AddEffectsModal.tsx`, `CustomBoonModal.tsx`, `server/api/effects.ts`; BD SD01-02, BR.

**Gate:** met offline. No existing Actor repair (DW-11 deferred).

### C6 — Consolidate sheets and mutation state

- [x] Remove competing React rule derivations and redundant level-up ownership.
  Both layouts consume C2/C3/C4; authoritative false/zero are respected.
- [x] Scope drafts, dialogs, item selection and caches to Actor/epoch/revision.
  Cancel stale debounce timers, sequence requests, reconcile optimistic changes,
  expose failures and use per-operation pending state.
  — `context/ShadowdarkActorContext.tsx`, `pages/ActorPage.tsx`; BR rapid edits/Actor switch.
- [x] Fix ID-only write paths and effect-list duplication/omission. Handle deleted
  or permission-revoked resources while a modal is open. — NA/BD SD01-11; cards show
  an unavailable state when their item disappears.
- [x] Give spell management, treasure sales and other multi-write flows explicit
  completion/partial-failure behavior. A caught error must not look like success.
  — BR failed delete rollback; sale credits only removed items and reports failures.
- [x] Remove paper's silent five-attack cutoff; expose complete features, free carry
  and capability-based sections. Test tab disappearance/overflow and return state. — BR.

**Gate:** met offline for rapid edits, Actor switch, failed writes and stale
responses. Reconnect and live permission revocation need a running host (pending).

### C7 — Implement resource details and module bestiary

- [x] Define authorized card view models and one modal/controller. Reuse full owned
  instance data and shared safe descriptions; no second projector in the component.
  — `logic/resource-cards.ts`, `components/ResourceDetailModal.tsx`, `ModuleDialog.tsx`.
- [x] Add paper spell → card → Cast → SDK RollDialog; use the same route from
  advanced sheets. Support item/magic/feature cards with appropriate actions. — BR.
  Cards use a compact fixed size (24rem × 24rem on tablet/desktop) that grows to
  34rem wide and up to 88dvh tall for longer content; phones use full width.
  Owned physical item cards keep the inventory controls the old item modal had
  (equip/unequip, stash/retrieve, light/put out, quantity), now from one shared
  rule helper (`logic/inventory-controls.ts`, native `PlayerSheetSD` handlers
  including the shield and single-lit-source side effects) used by both the card
  and the inventory row. The unused `ItemModal` was removed. A user report
  found the regression; BR "card keeps Unequip" fails on the pre-fix card.
- [x] Declare exact native Actor pack(s) needed for a module bestiary after checking
  their metadata and permission policy. Extend module indexing to Actor/NPC data;
  do not request all packs or derive monsters from item/name guesses.
  — `info.json` declares `shadowdark.monsters` (native pack metadata: Actor, NPC).
- [x] Complete module browsing/preview and NPC card fields from C3, including
  attack counts, special text, movement and features. World NPC reads stay
  caller-bound. Provide a working module entry point, not just an unused component.
  — Dashboard tool `bestiary`; BD SD01-16, BR. Compendium monsters are GM-only
  because Core does not expose pack ownership to modules.
- [x] Keep Core card SDK, encounter insertion, monster spawning and sharing out of
  this slice. Record the proven module view as evidence for deferred DW-13.

**Gate:** met offline with fixture data; native content acceptance pending.

### C8 — Verify both layouts, tabs and modal interaction

- [x] Cover paper and advanced Abilities, Inventory, Spells, Details, Notes and
  Effects at 360/390/768/1280px widths, including short viewport height and zoom. — BR.
- [ ] Check empty and large lists, >5 attacks, long names/descriptions, multi-spell
  wands, NPCs, observers/owners/GMs, standard/Pulp luck and unsupported states.
  **Partial:** >5 attacks, long names, multi-spell wands, NPCs, luck fields and
  unavailable states are covered; observer/GM role variants and very large lists
  were not rendered.
- [x] Verify keyboard access, named buttons/dialogs, focus containment/return,
  Escape, scroll reachability, touch targets, theme contrast and non-color state.
  — BR (contrast judged from screenshots, not measured).
- [ ] Check Core HUD/floating-tray overlap, sticky headers, tab overflow and modal
  stacking/safe areas in isolated rendering. **Partial:** tab overflow and modal
  stacking under a host-roll-dialog stand-in pass; the real Core HUD, tray and
  safe-area insets were not rendered offline (Core-owned; pending).

**Gate:** screenshots and interaction results exist for the revised components;
host-chrome checks remain pending.

### C9 — Validate parity and obtain explicit acceptance evidence

- [x] Run tracked module regressions (including new cases), explicit module typing,
  module checking and isolated packaging against the supported released Core
  toolchain. Root TypeScript alone excludes module code. Core tooling may be
  used read-only; keep test/package artifacts isolated and do not modify Core.
  — All eight suites pass; explicit module `tsc` clean; `module:check` passed;
  packaging into an isolated data directory produced a 9-entry archive. Core
  0.18.1 tooling was used; its SDK surface is unchanged from the pinned `v0.18.0`.
- [x] Exercise raw source → adapter → prepared store → caller HTTP/SDK projection
  → both layouts/card → dialog → server execution; include errors and action
  consequences. Compare to independent native source-derived or captured oracles.
  — NA A01-01 chain and the native pack oracle in BD (Weapon Mastery + Longsword
  from native 4.0.6 pack source, migrated to the Foundry 14 shape).
- [x] Run isolated browser checks with network blocked except local test fixtures;
  no application/backend dependency on Playwright or a running Foundry browser. — BR.
- [ ] Perform the native/operator matrix below only with approved local/test-world
  access. Record versions, expected/actual, actor/resource, evidence and status.
  If unavailable, leave it pending; offline success is not native acceptance.
  **Pending:** no approved Foundry access in this task.

**Gate:** not met — native/operator acceptance pending.

### C10 — Reconcile documentation and release readiness

- [x] Update module development/compatibility/action documentation and terse
  changelog notes. Document any future Core/SDK requirement in the module audit;
  do not edit Core architecture/SDK/module-authoring documents in this work.
- [x] Reconcile the coverage matrix and module audit dispositions, keeping unknowns
  distinct from fixes. Keep the implementation handoff and evidence in the module;
  report any proposed root tracker/ADR reconciliation to the user without editing
  Core-owned documents or local root trackers.
- [ ] Close/archive only after agreed acceptance or an explicit user closeout on
  stated limitations. Do not reopen ADR-0063 or promote unrelated deferred work.
  **Open:** not closed.
- [ ] Produce a module release-readiness summary with the supported native/Core
  baseline, verification evidence and remaining external dependencies. Repository
  release authorization and versioning rules are maintained in AGENTS.md.
  **Pending** native acceptance and release authorization.

## Addendum: user review follow-ups (October 15–16, 2026)

After the first implementation pass, the user reviewed the branch in a local
host and reported the issues below. Each was handled within this ADR's scope
unless noted. "NA", "BR" and "EC" refer to the native-alignment suite, the
isolated browser run and `effect-conformance.test.ts`. The work was
checkpointed in commit `33ed227`; native/operator acceptance remains pending.

| # | Report | Finding | Change | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| R1 | User-added Notes combat-tracking row broke the build | `"layout": { 3, 3, 12 }` is invalid JSON | `info.json` layout uses `columnSpan`/`rowSpan`/`textRows` (Core `ModuleCombatStatLayout`); `prepared-actor` test checks only numeric rows as Player stats | Core `parseCombatStatAttributes` accepts the row; `module:check` | Fixed |
| R2 | Console error on Attack: `inert=""` | React 19 treats `""` as false, so the card stayed interactive under the roll dialog | `ModuleDialog` passes a boolean `inert` | BR asserts `inert`, unfocusable card controls and no React console errors | Fixed |
| R3 | Weapon card showed two identical "Dagger Attack" actions | Attack modes (melee/thrown, Versatile grips) shared one label | `weaponAttackModes` (native `getAttacks` + `getDamageFormula`): labelled modes on every surface; both Versatile grips; two-handed blocked by an equipped shield; server refuses absent modes | NA 6 cases (red on pre-fix logic); BR distinct Melee/Thrown buttons | Fixed (C4/C7) |
| R4 | Cards far too large | Card used a 48rem dialog | `ModuleDialog` `card` size: 24rem × 24rem on tablet/desktop, grows to 34rem wide and 88dvh tall; phones full width | BR measures 384×384 | Fixed (C7/C8) |
| R5 | Item cards lost equip/stash/light | Regression: moving to the shared card dropped the old item modal's inventory controls | `logic/inventory-controls.ts` (native `PlayerSheetSD` equip/stash/light, shield and single-lit-source side effects) used by the card and inventory row; `ItemModal` removed; name-based light and "Consume Ration" not restored (not native) | NA 4 rule cases; BR red "card keeps Unequip" on the pre-fix card, then green | Fixed (C6/C7) |
| R6 | Blocked two-handed attack broke the paper layout | Unavailable modes were listed as greyed "Damage unavailable" rows | Sheets (paper, Abilities, inventory details) omit unavailable modes; the card keeps them disabled with the reason; paper row width hardened | NA hidden-mode case (red without the filter) | Fixed (C6/C8) |
| R7 | Luck showed "Token" and "Pulp" fields | `shadowdark.usePulpMode` is unreadable by modules | `logic/world-settings.ts` seam (native defaults, marked `native-default` in code); no visible label in either mode; Pulp off shows only the tick box; Pulp on shows only a number input, with −/+ spinner buttons where there is space (not in the paper sheet's compact box) | NA 4 luck cases | Partial: Core/SDK contract A in the proposal |
| R8 | CON 9 with an "+2 CON" improvement stays 9; casters without a casting class | SheetDelver ≤ 0.9.4 wrote pre-4.0 keys (`.bonus`, `system.bonuses.*`) that native 4.0.6 also ignores; the module dropped them silently | Hand-written legacy table removed; pre-4.0 keys reported on their effect with native's `Update_251001_1` replacement; effect-granted languages shown; level-up HP rolls apply `system.roll.hp.advantage`; two non-existent importer mappings removed; conformance guard and AGENTS rule added | EC 83 cases (red 70/81 with fixes reverted); all 59 native pack keys mapped | Fixed (reporting); existing data needs migration (R9) |
| R9 | Migrate old data automatically, without player action | SDK writes are request-bound; there is no load-time write hook, no per-world ledger, and tokens and packs are unreachable | Pure planner `logic/effect-key-migration.ts`; caller-bound route and hooks prototyped but not wired; [Core/SDK proposal](../audits/2026-10-16-core-sdk-world-data-proposal.md) (world settings and Core-run module migrations) | Planner covered by EC; route untested against a host | External dependency: user is implementing the Core changes |

## Required regression and acceptance matrix

"Offline" records module evidence; "Native" stays pending until an approved
Foundry 14 / native 4.0.6 comparison is performed.

| ID | Scenario | Acceptance evidence / current status |
| --- | --- | --- |
| A01-01 | Prim-like L1 mastery, native 4.0.6 on Foundry14; Actor and Item effects | All surfaces `+0 d8+1`; effect disable/enable changes once; raw/native comparison. **Offline: passes** (NA, BD native pack oracle, BR). **Native: pending.** |
| A01-02 | Effect schema/type/phase/priority, selector/property/this/situational, formula/dice/string values | Correct native behavior or explicit unsupported state; legacy compatibility, no double application/loss. **Offline: passes** (NA, BD); situational choices are listed but not selectable in the roll UI. **Native: pending.** |
| A01-03 | Player/NPC scores/modifiers, HP, armor/shields/custom attributes, slots and combat | Shared authoritative results, source unchanged and GM overrides respected. **Offline: passes** (NA). **Native: pending.** |
| A01-04 | Spell, NPC spell, multi-spell wand, scroll, Class Ability, potion, luck/recovery | Correct eligibility/defaults and result consequences; cancel/retry/failure safe. **Offline: partial** (BD C4, BR); luck automation, rest/recovery and ammunition are explicit gaps. **Native: pending.** |
| A01-05 | Generator/import/level-up and effect/boon edit | Full native source/effects retained, exact choices, no unresolved placeholder or guessed data. **Offline: passes** (BD SD01-02/09). **Native: pending.** |
| A01-06 | Duplicate names/IDs, renamed content, missing packs and reconnect/world switch | Canonical identity, readiness, invalidation and visible unavailable state. **Offline: partial** (NA/BD SD01-07/05). **Externally blocked** for raw source reference fields rewritten by Core (SD01-05); reconnect not exercised. |
| A01-07 | Denied/limited/observer/owner/GM world/embedded/compendium/card reads | Existing Core visibility, Secret/whisper and identification boundaries maintained; no cache bypass. **Offline: passes** for module routes (BD SD01-06/13/16). **Native: pending.** |
| A01-08 | Paper, every advanced tab and all card kinds; phone/tablet/desktop/keyboard | Complete accessible content/actions, no trapped controls or HUD/modal collisions. **Offline: partial** (BR); real Core HUD/tray/safe areas pending. |
| A01-09 | Rapid edits, Actor switch, stale responses, deletion/permission change, failed partial write | Correct reconciliation with current Actor; no stale/double action or false success. **Offline: partial** (BR, BD C4); live permission change pending. |
| A01-10 | Released 4.0.6 compatibility across claimed Foundry builds/serialized shapes | Prove each claimed combination; development-only 4.1 notes create no support claim or acceptance blocker. **Offline:** legacy and Foundry 14 serialized shapes covered. **Native: pending.** |

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


## Addendum: independent Core-aware review (October 16, 2026)

The checkpoint `33ed227` was independently reviewed against Core `ff65695` and
native 4.0.6. The preceding user-review addendum was already present and is
preserved. Nine tracked suites, explicit module typing and 38 isolated browser
checks pass again; native/operator A01-01–10 remain pending. These results do
not establish full Core HTTP/runtime integration or release readiness.

The [independent review](../audits/2026-10-15-native-alignment.md#independent-review-addendum--october-16-2026)
records corrective evidence and M1–M5 gates. It qualifies earlier checked boxes
and "Fixed (offline)" dispositions as follows:

| Review ID | Correction required | Affected checkpoints |
| --- | --- | --- |
| RV-01 | Generic document route returns a synthetic monster to a non-GM while bestiary denies it; unify caller policy across all resource routes. | C1/C7; SD01-06/16 |
| RV-02 | Registered migration route uses invalid slash keys and one-based paging against Core's zero-based list; a permissive-marker probe skips an eligible Actor and marks completion. Direct planner/route coverage is absent. | C5/C9; migration follow-up R9 |
| RV-03 | Cached action replay returns before owner recheck; same request ID with changed item returns old success. Add world/request identity and partial-result reconciliation. | C4/C6; SD01-08/12 |
| RV-04 | Spell card loses Class despite correct structured label already in the prepared view. Use the canonical prepared card facts. | C2/C7; SD01-05/10 |
| RV-05 | Native-default Pulp value is not a verified world value; reflect unavailable settings and adopt the eventual authoritative context. *(Presentation superseded by the user's luck decision, see the correction pass; adoption remains.)* | C0/C3/C4/C6 |
| RV-06 | Core same-world recovery retains the adapter; registry attach tests do not prove dependency refresh before prepared rebuild. | C1/C2/C6/C9 |
| RV-07 | Simulated runtimes/HTTP projection and stub host dialogs are offline evidence; correct planner-test and stale handoff claims. | C9/C10 |

R9 means a **proposed** Core-owned migration mechanism, not completed automatic
repair or authorization to mutate historical Actors. Core already has write
transport, settings, Scene/ActorDelta data and native pack-permission policies;
the module needs bounded capabilities and lifecycle support, not direct privileged
access. The secondary SDK proposal now contains a Core-review correction addendum.
Core ADR-0064 is the follow-up design for that work. Module ADR-0001 remains open
until corrections and acceptance are reconciled; the new Core proposal is not
an excuse to defer independent module fixes.

### Core dependency refinement — admin-owned migration upgrades

The October 16 follow-up selects Core ADR-0064's **admin upgrade** dry-run/apply
workflow for migration execution. Release metadata and a separate pure planner
belong to the module; Core owns the reviewed world-specific job, maintenance,
transport, restart recovery and activation. New repairs must not run from module
pages, ordinary bootstrap or writable initialization. Bootstrap may resume an
already authorized admin job. World-setting snapshots still refresh live.

This supersedes automatic-bootstrap/owner-fallback suggestions in the secondary
proposal, whose [ownership revision](../audits/2026-10-16-core-sdk-world-data-proposal.md#admin-upgrade-ownership-revision--october-16-2026)
records the Core audit. RV-02 remains unfixed; eventual contract adoption removes
the caller migration route/hook and tests the planner/serializer directly. Existing
module corrections and native acceptance remain open; this is documentation only.

The subsequent catalog refinement moves migration maps/paths out of info.json:
use a module-owned migration.json and native-version directories with definitions
and check/plan/verify hooks. Required fresh-source checks block world readiness
when a Foundry backup restore reintroduces legacy data, regardless of Core's
completed journal. Core provides admin reasons/repair, a backup limitation warning
and resumable execution; native lockout and world backup/undo are outside scope.
No implementation or acceptance disposition changes in this documentation pass.

The confirmed Core service-account policy is now full Gamemaster for all world
connections, with role-failure blocking/admin remediation planned under Core
ADR-0064 G0a. It is not a new restriction on ordinary Assistant players and is
not implemented by this module documentation pass.

### Module correction pass (October 16, 2026)

The user selected the review findings that need no Core/SDK change. Details and
red/green evidence are in the audit's
[module correction pass](../audits/2026-10-15-native-alignment.md#module-correction-pass--october-16-2026).
Gates M1, M2 and M3 are met offline. For M2's RV-05 part the user decided the
luck presentation (below); reading the actual setting is M4.

| Review ID | Module change | Status |
| --- | --- | --- |
| RV-01 | One compendium caller policy (`server/access.ts`) on every route: document, collections, name index, bestiary, spells, actions, level-up. Monster pack GM-only until Core exposes caller pack capabilities. | Fixed (offline) |
| RV-02 | Caller migration route, UI hook and `pendingMigrations` removed; pure planner kept, with direct planner/serializer cases. Effects are not migrated by any caller; R9 now waits on the Core ADR-0064 runner. | Module part fixed |
| RV-03 | Action request id bound to runtime, user, Actor and body; replays recheck owner access; post-result chat failures become warnings; partial results reconcile without rerolling. | Fixed (offline) |
| RV-04 | Spell card Class from the prepared view's `spellClasses` labels. | Fixed (offline) |
| RV-05 | User decision replaces the review's interim labelling: no visible label in either mode; Pulp off shows only the tick box; Pulp on shows only a number input, with −/+ spinner buttons where there is space (not in the paper sheet's compact box). The unverified setting stays in code (`source: 'native-default'`) and docs, not the UI. Pulp input implemented and tested. Reading the real setting waits on Core. | Presentation done; adoption open (Core) |
| RV-06 | Unchanged: needs Core context revisions. | Open (Core) |

This pass changes no versions or compatibility pins and closes no A01 case.
ADR-0001 remains open.

## Addendum: Core contract adoption and release order (October 16, 2026)

### Current boundary and evidence

Core ADR-0064 was initially reviewed at Core `838212c` on
`feat/adr-0064-world-context-and-migrations`. It is now included in **Core v0.19.0**:
the user reports publication, and the local release tag/package/contracts were
verified at `2f71597` on `main`. Core release availability no longer blocks adoption.
Its selected native acceptance
passed on Foundry **14.367 and 13.351**, both with native Shadowdark **4.0.6**.
This establishes the Core runner, context and authorization boundaries in the
recorded fixture scope. It does **not** establish this module's rules, migrations,
settings consumers or A01 acceptance. Core remains open for G8 and user review.

The module baseline is `af24b8e` on `fix/adr-0001-native-alignment`, version
**0.9.4**. It still returns native defaults, lacks `onWorldContextChanged` and
the host's `getSystemDataForUser`, and has no packaged migration catalog. Its
existing `getSystemDataFor(caller)` is a different module method, not the new
host hook. RV-02's caller migration route/UI hook were already removed; preserve
that removal. M1–M3 remain recorded offline results; **M4/M5 and G8 remain open**.

This addendum supersedes earlier statements that Core's UUID preservation,
world context, pack capabilities, migration runner and recovery barrier are
still unimplemented. They are available in the inspected Core checkout; module
adoption remains necessary. The earlier proposal and review remain historical
evidence, not alternative APIs. No implementation or new test result is claimed
by this documentation pass.

In the supporting Core checkout, read `docs/MODULE_MIGRATIONS.md`,
`docs/MODULE_AUTHORING.md`, `docs/RELEASING.md` and Core ADR-0064, especially its
"Native v13 acceptance and G8 handoff" section. Public types are exported through
`@sheet-delver/sdk`, `/server` and `/react`; Core's internal source may be read to
understand behavior but must not become a module import or editable dependency.

### Compatibility and release sequence

| Authority | Current module / Core state | Adoption requirement |
| --- | --- | --- |
| Core application | Core v0.19.0 is released; local tag/package verified at `2f71597` | Set `compatibility.coreVersion` to `>=0.19.0` and verify against that release. Core 0.18.1 does not contain these contracts. |
| Aggregate SDK | Supporting checkout exports 3.3.0 | Informational SDK surface version; do not invent an `sdkVersion` manifest field or a second version authority. |
| `module-api` | Module declares `>=1.3.0 <2.0.0`; supporting host supplies 1.5.0 | Adopt `>=1.5.0 <2.0.0`. Migration packages must exclude 1.4 and older. |
| `ui-extension-api` | Module declares `>=3.1.0 <4.0.0`; supporting host supplies 3.2.0 | Adopt `>=3.2.0 <4.0.0` when consuming the new world-setting hook/context events in this pass. |
| `roll-engine-api` | `>=1.0.0 <2.0.0` | Keep unchanged; no new roll contract is required. |
| Module release | `info.json.version` is 0.9.4 | Keep unchanged during implementation; prepare terse changelog notes. Release preparation is separate. |
| Validation / release toolchains | `ci-shadowdark.yaml` uses `ref: v0.18.0`; `release-shadowdark.yaml` uses `core_ref: 'v0.18.0'` | Update both to `v0.19.0` and test packaging with that toolchain before publication. |

Core publication is complete according to the user; the next step is to implement
and test this module against **v0.19.0**, then prepare its separately authorized
release. The earlier temporary development-host/minimum exception is no longer
needed. Apply the exact application/API floors and both workflow pins above during
adoption. Do not lower an existing stricter minimum or substitute Core's package
number for API compatibility. This documentation pass changes no manifests or
workflow pins and does not claim the module has been tested against the release.

Publishing Core first is distinct from upgrading an active installation. In the
new Core, non-full-GM `/api/system/data` needs `getSystemDataForUser`; without it
the host returns 403. Test both that endpoint and module-owned data routes before
deploying the Core/module pair to players. Do not disable this protection or
expose the privileged initialization cache to restore compatibility.

### G8-A — Adopt authoritative settings throughout the module

- [x] Declare exact `info.json.worldSettings` keys and bounded native-version
  ranges, schema, default provenance, `affectsPreparation` and exposure. Native
  `release-4.0.6` commit `9677d16b3903b3b640f00d4efd48249142ac8334`,
  `src/settings.mjs`, registers world Boolean `shadowdark.usePulpMode` with
  default **false** and `shadowdark.autoConsumeAmmunition` with default **true**.
  Use `=4.0.6` for provenance/coverage unless additional versions are inspected;
  never infer coverage from GitHub main or change key capitalization.
  *(Done: both keys, `>=4.0.0 <=4.0.6` after inspecting every 4.0.x tag.)*
- [x] Replace `logic/world-settings.ts`'s unconditional native-default seam with
  host results. Preparation consumes `context.world`/`context.contextRevision`;
  request actions use `runtime.world`; browser consumers use authorized prepared
  data or `useWorldSetting` from the public React entry point. Share the same rule
  inputs across paper/tabbed sheets, cards, dialogs and server actions.
  *(Done: preparation, actions, bestiary, level-up and both sheets; the browser reads the prepared Actor.)*
- [x] Distinguish `world`, `registered-default` and `unavailable`. A missing world
  override may use the host's proven registered default; unreadable/invalid or
  unsupported context may not silently become standard mode. Preserve false and
  reject invalid types. Do not read raw Setting documents, localStorage or Actor
  guesses as world configuration. These two settings are Boolean; do not broaden
  their schemas merely to reproduce Core's separate zero/null scalar tests.
  *(Done.)*
- [x] Preserve the agreed luck presentation: no visible control label, tick box
  when Pulp is off, numeric input when on, spinner buttons only where space permits.
  Handle unavailable context without displaying a guessed mode; explain failure
  through existing status/diagnostic facilities. Acquiring the ammunition setting
  does not establish consumption behavior: keep that feature's existing deferral
  explicit unless separately selected and verified.
  *(Done, plus an explained placeholder when unavailable; ammunition consumption stays deferred.)*

Checkpoint: source-backed default/override/unavailable tests plus actual host
context integration, live false→true→false Pulp refresh, and revision-aware dialog
and action behavior. No duplicated client rule calculations or fabricated data.

### G8-B — Package lossless admin-run effect migrations

- [ ] Adapt the retained `logic/effect-key-migration.ts` planner to a root
  `migration.json` using `schemaVersion: "sheet-delver-migrations.v1"` and
  `systemVersions: { "4.0.6": "migrations/4.0.6" }` for the audited milestone.
  These are native-system versions, not module/Core/Foundry versions. Follow the
  host's exact `definition.json` schema for required steps, stable IDs/revisions,
  dependencies, supported source versions/generations, targets, paths and hooks.
  Keep migration maps and entry pointers out of `info.json`.
  *(Catalog and definition done, but staged at `migrations/migration.json`, not the root: see the G8 implementation record.)*
- [x] Supply synchronous pure default-export check/plan/verify hooks over the
  public `MigrationHookInput` contract. Declare all required reference/setting
  reads and parameters. Hooks get frozen source/context, not a runtime or a
  privileged writer; use the existing native-derived key mapping and lossless
  serialization. Do not hand-author substitute effects, formulas or damage dice.
  *(Done: `migrations/4.0.6/{check,plan,verify}.ts`.)*
- [ ] Account for affected Actor and Item effects, their embedded forms, supported
  world-pack documents and persisted ActorDelta overrides through Core's target
  contract. Scope each step to actual fields; do not transform the same child both
  through its parent array and through a child target. Preserve custom/unknown
  fields, omitted fields, effect order/phase/priority, canonical IDs and both raw
  v13/v14 shapes. Unrelated custom data is preserved; an unresolved required
  transformation is a blocker with a reason, never a guessed replacement.
  *(Actor, Item, embedded and ActorDelta effects done; world packs not targeted (their parents are unreadable without exact pack IDs).)*
- [x] Preserve delta tombstones and partial overrides. Never fabricate null
  deltas or materialize inherited base Actors into them; Core enumerates actual
  persisted targets and skips valid empty deltas. System/package packs are read
  references only and must not be unlocked or migrated. Keep historical shipped
  hook IDs/code immutable; use new steps for later corrections.
  *(Done.)*
- [x] Validate the packaged `.cjs` hooks and rewritten definitions with the real
  packager, not just the TypeScript planner. Check the derived
  `sheet-delver-release.v2` migration summary/digest in isolated output; do not
  manually maintain a second release migration flag/catalog. Ensure module CI
  triggers include `migration.json` and `migrations/**` as well as running the new
  regressions, so a hook-only change cannot bypass validation.
  *(Verified in an activated temporary copy with the Core v0.19.0 packager and
  planner; CI triggers and tests added. Normal packaging of the current inactive
  catalog remains v1 without migrations.)*

Checkpoint: unchanged/current data is a no-op; repeat execution is idempotent;
unresolved required data blocks readiness; preview writes nothing; approved admin
application preserves unrelated bytes/fields; verification rejects incomplete
conversion. Reintroduced legacy source must require a fresh check/approval even
when a previous job completed. Keep caller/UI migration execution absent. Module
initialization, normal reads and rendering must never start repairs. Core owns
maintenance, full-GM service authority, transport, journal and backup warning.

### G8-C — Refresh dependencies before preparation and invalidate stale work

- [x] Implement bounded, read-only `onWorldContextChanged(next, { keys, recovery,
  packs })` handling and refresh the registry inputs before Core's prepared rebuild.
  Same-world recovery retains the adapter; `initialize`/`attach` alone is insufficient.
  *(Done; the actual Core bootstrap recovery lifecycle was not exercised.)*
- [ ] Fence async loads against runtime/context changes and disposal. Replace
  obsolete projections, including pack-dependent labels/choices and module UI
  caches, without building another source store or world lifecycle. Preserve old
  immutable snapshots as old, never mutate them into current values.
  *(Partly met: registry fencing passes offline; the independent G8 review below
  identifies RV-08, a UI invalidation race during initial loading.)*
- [x] Use the saved context revision for setting-dependent actions/dialogs via
  `X-SheetDelver-Context-Revision` or the public assertion. Stale work must refresh
  or reject; request replay must retain RV-03's identity/permission checks and must
  not reroll an already evaluated action to recover from changed context.
  *(Done: actions, rolls and the new luck route.)*

Checkpoint: a setting-only change, pack-content change and same-world recovery
reach preparation and every affected consumer; old async loads cannot overwrite
new state. Required refresh failure remains unavailable until recovery instead
of serving stale rules. Test through actual host lifecycle composition as well
as focused module cases; a registry attachment mock alone does not close RV-06.

### G8-D — Adopt caller-safe system and resource projections

- [x] Implement the exact adapter `getSystemDataForUser(context)` contract using
  the supplied caller-bound `documents`, `compendium`, `access` and `world`.
  Build caller-visible collections/indexes from authorized reads, not an exported
  privileged bootstrap cache with only monster names removed.
  *(Done; also served by the module index route.)*
- [x] Replace `GM_ONLY_PACKS`/`GM_ONLY_COLLECTIONS` assumptions on every serving
  path with `context.access` / `req.runtime.access.canReadPack` and caller-bound
  resolution. Cover module index, collections, bestiary/cards, document lookup,
  spell/level-up/generator/importer sources and actions. Native effective pack
  access applies to any pack, not just monsters. Missing capabilities cannot
  become an allow-all fallback. No raw permission map or settings dump is needed.
  *(Done on every serving path.)*
- [x] Retain canonical UUIDs and use prepared labels or Core's separate authorized
  `referenceLabels` for presentation. Reconcile earlier defenses against Core's
  recursive UUID rewrite with the now-preserving contract; do not reverse-map
  labels or remove useful identity/source-preservation protections blindly.
  *(Done: Core 0.19.0 response replica test; structured refs and prepared labels kept.)*

Checkpoint: real `/api/system/data` and module endpoints work for authorized
players and Assistant/GM callers without leaking restricted names/content.
Include denied/limited/observer/owner views, GM-warmed caches followed by player
reads, and live permission revocation with caches warm. Full-GM service-account
enforcement does not mean every human caller must be a full GM. Identification,
private fields, owner writes and RV-03 replay safeguards remain intact.

### G8-E — Verify adoption and reconcile acceptance

- [x] Run the nine tracked module suites, new adoption regressions, explicit module
  TypeScript inclusion, module checking and isolated packaging. Root typing alone
  excludes module code. Exercise actual Core adapter/route/preparation contracts;
  keep mocked, actual-host offline and native evidence distinct.
  *(Done, plus the actual-host offline harness.)*
- [ ] Review paper and tabbed sheets, resource cards and affected roll dialogs
  with the real host UI, including responsive layouts, theme, keyboard access,
  HUD/tray/modal overlap and live context updates. Stubbed dialogs cannot close
  the real-host layout gates.
  *(Pending: only the isolated browser harness with a stubbed host was run.)*
- [ ] Prepare module-specific native acceptance on supported v13/v14 with native
  4.0.6: migration preview/apply/readback/no-op/restored-source blocking, settings
  refresh, caller projections and representative corrected rules. Measure the
  module's actual target inventory and hook costs. Core's generic fixtures and
  small-world measurements are not substitutes. Live work requires a separately
  approved disposable world/fixture scope; never infer production-write authority
  from Core's previous native acceptance.
  *(Plan prepared in the G8 implementation record; not run (needs an approved disposable world).)*
- [x] Update this ADR, the active audit, architecture, terse changelog and local
  handoff with exact host/module/native versions and evidence. Reconcile M4/M5,
  RV-05/RV-06 and A01 individually. Mark only evidenced gates complete; identify
  any remaining Core gap with a concrete public-contract reproduction and continue
  independent module work. Do not edit Core to make a module test pass.
  *(Done for this implementation pass.)*

Migration/settings/caller adoption is the selected next implementation checkpoint.
It does not revive deferred historical repair outside the declared effect-key
scope, automatic ammunition/luck/rest behaviors, native scene/time hooks, or the
future Core card/encounter SDK. Keep those dispositions explicit. ADR-0001 stays
open until its remaining selected acceptance/release-readiness gates are reconciled;
neither publishing Core nor passing existing module fixtures closes it.

## G8 implementation — October 16, 2026

Implemented on `fix/adr-0001-native-alignment` from `af24b8e` against Core
**v0.19.0** (`2f71597`, SDK 3.3.0 / module-api 1.5.0 / UI 3.2.0 / roll 1.0.0) and
native Shadowdark `release-4.0.6` (`9677d16b`). Uncommitted for user review. The
audit's [G8 adoption evidence](../audits/2026-10-15-native-alignment.md#g8-adoption-evidence--october-16-2026)
lists every case and measurement. Evidence classes are kept apart: **module
offline** (SDK-shaped fakes), **actual-host offline** (Core v0.19.0's own
services, routes, packager and planner, isolated data directory, no Foundry),
**isolated browser** (real module UI, stubbed host) and **native** (none yet).

### Compatibility

`info.json`: Core `>=0.19.0`, module-api `>=1.5.0 <2.0.0`, UI `>=3.2.0 <4.0.0`,
roll-engine unchanged, no `sdkVersion` field, version 0.9.4 unchanged.
Validation workflow `ref` and release workflow `core_ref` are `v0.19.0`; the
release workflow's reusable-workflow ref moves to `@v0.19.0` with it, so the
packager and toolchain match. CI also triggers on `migration.json` and
`migrations/**` and runs the two new suites.

### What changed

| Checkpoint | Implementation |
| --- | --- |
| G8-A settings | `worldSettings` declares `shadowdark.usePulpMode` (default false) and `shadowdark.autoConsumeAmmunition` (default true): world Booleans identical in every native 4.0.0–4.0.6 tag, so declared for exactly that range, `affectsPreparation`, `authenticated`. `logic/world-settings.ts` maps Core results to rule inputs; unavailable never becomes a default. Preparation records `derived.ruleInputs` (values and context revision) and `derived.luck.mode`/`hasLuckToken`; routes use `req.runtime.world`. Luck keeps the user's presentation and shows an explained inert placeholder when unavailable. Ammunition: the setting decides the stated native behavior; nothing is consumed. |
| G8-B migrations | Step `shadowdark-effect-keys-4.0` (revision 1, required, ActiveEffect targets, paths `changes`/`system.changes`, reads Actor/Item/ActorDelta for parent types, `nativeSpellSlugs` parameter generated from the native spells pack) with pure hooks over the existing planner. The planner now appends Weapon Mastery's extra change after all changes, as native pushes it. **Staged inactive** at `migrations/migration.json` because of CG-1 below. |
| G8-C refresh | `onWorldContextChanged`: setting-only changes need no work; a declared pack change or recovery rebuilds the registry before returning (generation-fenced, whole replacement, rejects on failure). Actions, rolls and the new `POST actors/[id]/luck` route send `X-SheetDelver-Context-Revision`; the page and UI caches reload on `world:contextChanged` and user/role change. Replay identity is unchanged by context changes, so no reroll. |
| G8-D projections | `getSystemDataForUser` builds names/titles from the caller's own compendium reads, rechecked per row; the `index` route serves the same projection. `server/access.ts` now uses `req.runtime.access.canReadPack` on every serving path (documents, collections, bestiary, spells, level-up, table draws, effect choices, generator, importer), checked before and after awaited cache reads; no capability means no pack content. `GM_ONLY_PACKS` and system-level `resolveDocument` are gone. |

### Core contract gaps and observations (concrete reproductions)

- **CG-1 (blocks catalog activation): migration references are whole kinds.**
  `hookInput` passes every row of each `reads.targets` kind to every hook call,
  with no ancestor-only selection, and each call is a fresh VM with the input
  embedded as source. The effect step needs only each effect's parent type.
  Reproduction (actual-host harness, Core `planWorldMigrations` check-only,
  synthetic Players with 2 Actor effects and an effect on every fourth Item):
  9 Players × 8 Items, 36 effect targets → 303 ms; 20 × 20, 140 targets, 0.7 MB
  Actor source → 3.6–3.8 s; 30 × 30, 300 targets, 1.5 MB → "Migration
  computation budget exceeded". Without references the same 300 targets take
  0.5–1.0 s, 720 take 1.7–3.2 s and 1,200 exceed the budget (per-call VM cost),
  but then parent types are unknown and every legacy effect is unresolved. A
  bootstrap check that exceeds the budget holds the world unavailable at every
  start, and once a catalog has run Core refuses a later catalog-less version.
  Activation therefore waits for ancestor-scoped references (or an equivalent
  bounded parent context) and computation that scales with the complete inventory.
  The independent G8 review below selects a Core correction; accepting the
  measured five-second limit is not the completion path.
- **CG-2: hook reasons are dropped.** `planWorldMigrations` turns an
  `unresolved` check into `"<step>: <uuid>: source check/plan unavailable"`;
  the hook's actionable reason (which change, what to edit) is not shown.
- **CG-3 (confirmed regression): Foundry 13 players read no packs.** Core's
  `canReadNativePack` denies every pack below Assistant on generation 13
  (`canReadCombatActorPack` returns false when generation ≠ 14). Character-
  building collections, names and compendium cards are empty for v13 players;
  the module adds no fallback. Independent comparison with native v13's pack
  ownership implementation confirms this is a Core regression (see below).
- World-pack effects are not targeted: their parents are pack rows, readable
  only through `reads.packs` with exact pack IDs, which a module cannot know.

### Reconciliation

| Gate | Disposition |
| --- | --- |
| RV-05 | **Adopted**: actual world setting through Core's context; module offline and actual-host offline (Core `ModuleWorldContextService` and SettingStore: default, stored false → true → false, invalid, unsupported version). Native toggle in Foundry pending. |
| RV-06 | **Partly verified offline**: refresh before rebuild, registry generation fence, recovery without initialize and failure rejection pass; Core's revision fence is verified with `ensureInitialized`. RV-08 below leaves UI refresh incomplete. Core's real recovery lifecycle (`WorldBootstrapper`) and a native reconnect are not exercised. |
| M4 | **Partly met**: settings, context refresh and caller permissions adopted and verified offline against actual Core code; migration hooks implemented and packaged, activation blocked by CG-1. |
| M5 | **Open**: real host UI review, actual Core process, and native acceptance not run. |
| A01-01–10 | Unchanged individually: offline status as recorded in the acceptance matrix; **native pending for all ten**. A01-04 luck now follows the world mode; A01-07 caller reads now follow Core capabilities (actual-host offline); A01-06 identity holds with Core 0.19.0's preserved UUIDs (replica test). None is closed. |

### Native acceptance plan (not run; needs approval)

On a disposable v14 (14.367) and v13 (13.351) world with native 4.0.6, a
dedicated non-production SheetDelver data directory and explicit write scope:
toggle Pulp Mode and ammunition in Foundry and confirm both sheets, luck writes
and attack statements follow without reload; player/Assistant/GM pack reads with
a restricted monster pack, then a live revocation with warm caches; non-GM
`/api/system/data`; A01-01–10 as listed; and, only if the catalog is activated,
preview/apply/readback/no-op, restored-source blocking and measured inventory
cost on the world's real Actor/Item/effect counts.

ADR-0001 remains open.

## Independent G8 verification — October 16, 2026

This review inspected the uncommitted adoption on `af24b8e` against released
Core v0.19.0 (`2f71597`) and native Shadowdark 4.0.6. It changed documentation
only. The pre-review ADR was saved before annotation (73,694 bytes; SHA-256
`8f301285f52caad33bd15874a08f3bf76895ae2a4454469dd929d985ebc5f233`).
The [audit evidence](../audits/2026-10-15-native-alignment.md#independent-g8-verification--october-16-2026)
records reproductions and distinguishes tested code from pending integration.

All eleven module suites, explicit module typing, isolated module checking and
normal packaging pass again. The supplied actual-Core-code harness passes
11/11. These results support the settings, lossless effect transforms, caller
projection and server revision-fence implementations; they do not close the
following findings.

| Finding | Verified result | Owner and disposition |
| --- | --- | --- |
| **RV-08: context invalidation can leave the UI loading forever** | With the initial index response pending, emit `world:contextChanged`, then resolve that old response. The actual provider discards it but starts no replacement: one request, null data, loading true. Reproduced in isolated Chrome with the real provider and stable stubbed SDK services. | Module correction required. G8-C/RV-06 remain partial. |
| **CG-1: five-second planner ceiling** | Already-current data with 30 Players, 900 embedded Items and 300 effect targets exceeds Core's whole-plan deadline. Bootstrap compatibility uses the same planner, so the failure can recur without any migration writes being necessary. | Core **CR64-09**, required correction; not an accepted inventory limit. |
| **Pack effect parent context** | Core can enumerate and write world packs. A `WorldPack` target without exact `reads.packs` cannot receive its pack parent; adding the particular pack ID makes the same effect plan successfully. | Core **CR64-10** must supply declared, bounded parent/ancestor dependencies for arbitrary world-pack IDs. Module then includes these effects in its catalog. |
| **CG-2: lost diagnostics** | The hook identifies the missing parent Actor type, while Core returns only `source check/plan unavailable`. | Core **CR64-11**; preserve bounded actionable reasons in admin results. |
| **CG-3: v13 pack policy** | Native v13 grants a Player OBSERVER access for `{PLAYER: 'OBSERVER', ASSISTANT: 'OWNER'}`; Core denies that same Player every pack on generation 13. | Core **CR64-12**, confirmed regression rather than a policy choice. Keep module capability checks. |

### Five-second limit and migration completeness

The five-second deadline is an implementation choice in Core's synchronous
`planWorldMigrations`, not a Foundry requirement or a deadline for the entire
approved upgrade job. It is separate from the one-second pure-hook VM guard
and the adapter context-refresh timeout. Repeatedly copying all declared Actor/
Item/ActorDelta references into each effect invocation, then creating a new VM,
makes a modest inventory hit the plan ceiling. Parent scoping alone does not
remove the whole-plan ceiling or repeated invocation cost.

The selected correction is complete, progress-reporting computation across the
required inventory, with responsive admin access and recoverable execution under
maintenance. Do not close the finding by accepting five seconds, dropping targets,
enlarging only the timeout, or moving repair into the module UI. A genuinely
unresolved source, changed dependency or failed/uncertain write must still stop
with useful recovery information; maintenance cannot make those writes safe by
itself. Core owns the continuation, approval, journal and readback protections.

### Remaining implementation checkpoints

1. **Module UI refresh:** make invalidation a reactive request dependency so a
   context event starts the replacement index fetch even when data is already
   null. Retire old responses and retries. Prove initial-load and loaded-cache
   changes, user/role/world changes and recovery end in current data or an explicit
   failure state, never permanent loading. Preserve caller-scoped collection data.
2. **Core follow-up:** the user selected corrective work under existing Core
   ADR-0064, CR64-09–12. Its previous native evidence remains valid for its recorded
   small-fixture scope. The module must not add private Core imports, direct
   transports, pack-ID guesses or elevated caller access to work around these gaps.
3. **Finish migration adoption:** after the corrected Core contract is available,
   use bounded parent dependencies, add world-owned Actor/Item pack effects, and
   activate the root `migration.json`. Verify an actual v2 archive contains the
   catalog, rewritten definitions and compiled hooks. Normal packaging today is
   v1 with no migrations; a staged nested catalog is not operational adoption.
   Keep native Player/NPC and delta semantics, unknown fields, IDs and lossless
   serialization. Do not replace entire `effects`/`items` arrays as a workaround:
   those are not permitted migration write paths in Core v0.19.0.
4. **Actual host composition:** review the module in an isolated real Core UI
   (both sheets, cards, dialogs, HUD/tray, widths/themes/keyboard) and exercise
   Core's retained-adapter recovery path. Calling a hook directly and rendering
   stubbed dialogs do not establish these results. This is remaining verification
   work, not evidence of a new unavailable SDK feature or a new permission gate
   for already-authorized isolated testing.
5. **Module native acceptance:** on the scoped disposable worlds, verify the
   full migration/check/no-op/restore workflow and current settings/pack access
   for v13 and v14, then A01-01–10. Measure actual inventory and confirm no required
   target was skipped. Core's earlier native fixtures do not replace this gate.
6. **Compatibility and release:** retain current version metadata in this review.
   Before publishing adoption, require the tested Core release containing the
   corrections and any newly versioned parent-reference contract; pin both CI and
   release toolchains to it. Core 0.19.0 / module-api 1.5 / UI 3.2 are the existing
   floor, not proof the follow-up contract already exists. Decide new contract
   versions with Core implementation; do not invent an `sdkVersion` field or a
   release number here.

Catalog activation is a temporary technical hold, not a permanent approval
ritual or permission to omit migrations from the completed feature. M4 remains
partial; M5 and all ten native A01 gates remain open. RV-05 has offline adoption
evidence; RV-06 remains partial because of RV-08 and untested real recovery.
This addendum supersedes stronger completion claims above. No new Git operation,
release, world write or application source change was performed by the review.


## Core 0.19.1 resumption and module corrective checkpoints — October 17, 2026

Core **v0.19.1** is a published, non-prerelease supporting release. Its tag and
local package provide SDK **3.4.0**, module-api **1.6.0**, UI API **3.2.0** and
roll-engine **1.0.0**. The user confirmed Core work is merged/squashed, its branch
deleted and the point release created, and selected resuming module work. No new
Core SDK/contract bump is requested. Earlier CG-1/CG-2/CG-3 and CR64-09–12
statements describe Core 0.19.0; they are not current reasons to leave adoption
inactive. The corrected host has complete maintenance computation, declared
bounded relations, actionable diagnostics and native v13 pack policy. Core's
qualified acceptance does not establish this module's hook/UI/native acceptance.

Verified release: [Core v0.19.1](https://github.com/sheetdelver/sheetdelver/releases/tag/v0.19.1).
Use its public migration contract and SDK types even where an older paragraph in
the released guides still calls the correction unreleased. Do not edit Core.

### Current module evidence

The existing module branch is `fix/adr-0001-native-alignment`, checkpoint
`af24b8e`, manifest version0.9.4, with substantial uncommitted G8 implementation.
This review preserves application source, hooks, manifest and workflows. All
**eleven existing suites** pass against Core0.19.1/Node22.23.3; native-alignment
51/51, boundaries53/53, effect-conformance89/89, world-adoption12/12 and
migration-hooks15/15. Explicit module/UI/migration TypeScript inclusion passes.
These are offline regression results, not full adoption acceptance. No new
packaging, rendered host or native execution is claimed by this review.

The catalog still lives at `migrations/migration.json`; the root catalog is
absent. Its definition targets only ActiveEffect and declares whole-kind
Actor/Item/ActorDelta reads. Hooks consume `input.references`, not the new
`input.relations`. The existing migration test explicitly asserts root catalog
absence. The old ignored host harness also expects v13 player pack reads to be
denied, which is obsolete. Update these expectations rather than treating their
old green result as evidence of completed adoption.

RV-08 remains present in `ShadowdarkUIContext`: reset increments a ref and sets
already-null data to null, without changing the index-fetch effect's dependencies.
The prior reproduced pending-load race remains unresolved by the current source.
A fresh browser reproduction was not rerun in this status review.

### Implementation sequence and checkpoints

1. **Compatibility and preservation.** Continue the existing approved module
   branch and preserve all uncommitted work. Adopt Core `>=0.19.1` and, when using
   bounded relations, module-api `>=1.6.0 <2.0.0`. Pin CI checkout, reusable release
   workflow and `core_ref` consistently to `v0.19.1`. Keep UI/roll requirements
   unchanged; do not add `sdkVersion` or bump Core/module release versions.
   These are module compatibility requirements, not new SDK version definitions.
2. **RV-08.** Make index invalidation a reactive request dependency. Retire old
   responses and retry timers on context, world, caller/role, connection and
   unmount changes. Clear caller-scoped collections. Prove pending initial load,
   loaded caches, rapid invalidation, retries and recovery resolve to current
   data or an explicit failure instead of permanent loading. Preserve manual
   state and request replay safeguards; do not add another world store.
3. **Complete effect-key adoption.** Consume declared parent/ancestor/base
   relations and include arbitrary world-owned Actor/Item packs. Keep Player/NPC,
   Weapon `.this`, unknown fields, effect order/shape, IDs, mixed v13/v14 data,
   null/partial deltas and tombstones lossless. Do not infer a type from a name
   or invent a weapon die, effect or formula. Unsupported required source remains
   unresolved with a specific reason; no silent skipping or caller-side repair.
4. **Do not lose delta coverage when narrowing reads.** Core enumerates unlinked
   deltas only when the selected target/read kinds include ActorDelta. The old
   whole-kind reads currently provide that selection. Merely replacing them with
   relations would omit deltas unless the catalog retains explicit selection.
   Also, a partial delta Item can lack `type`; `baseActor.source.type` alone
   cannot identify its inherited Item type. The relation projection forbids whole
   `items`/`effects` arrays and offers no `baseItem` relation. Prove a supported,
   source-derived path for this case. Existing explicit broad reads remain a
   public compatibility option, but must be deliberately justified, tested and
   measured if needed; do not silently keep broad references in every hook or
   falsely claim bounded-only coverage. Report a concrete remaining contract gap
   only if the public surface cannot support the required semantics. No Core edit.
5. **Activate and package.** Move the completed catalog to root `migration.json`
   and remove the obsolete inactive-catalog assertion. Produce and inspect a real
   v2 release artifact with its catalog, rewritten definitions, compiled confined
   hooks, required contract floor and digests. A temporary activated copy alone
   does not finish operational adoption. Preserve any actually published/applied
   historical step identities and exact hook bytes; this local untracked staged
   prototype is not evidence that a migration has been published.
6. **Actual host workflow.** Test the installed module through an isolated real
   Core0.19.1 instance/public admin workflow: advisory check, authoritative review
   and approval, complete execution/readback, restart/recovery, fresh no-op,
   externally restored-source gating and repair, source/permission/context changes.
   Use representative and larger module effect inventories with independent
   before/after oracles, all target locations and measured costs. Do not impose a
   module batch ceiling or manual continuation to fit the old five-second limit.
   Keep Core's exact approvals, source fences and uncertain-write recovery intact.
7. **Context, caller and UI acceptance.** Exercise the real retained-adapter
   reconnect/recovery path and populated non-GM `/api/system/data`; no empty-index
   pass or direct-hook call substitutes for them. Verify settings updates and
   current v13/v14 pack access, warm-cache revocation and action replay. Review
   both sheets, every tab, card kind, roll dialog, luck control and bestiary with
   real Core HUD/tray, four widths, both themes and keyboard/focus. Keep all
   surfaces on one prepared view/action path and preserve the native data oracle.
8. **Close only evidenced gates.** Reconcile RV-05/RV-06/RV-08, M4/M5 and each
   A01-01–10 separately. Native module tests require newly identified disposable
   worlds, endpoints, fixture/write/cleanup scope and backup acknowledgement.
   Finish independently authorized offline work before requesting that scope.
   Core's old fixture authorization/evidence is not module native acceptance.

Update module AGENTS/architecture/audit/ADR/changelog/handoff with implementation
and results. Keep one current module audit. Preserve historical evidence while
removing stale Core-blocked wording from current summaries. Deferred automatic
luck spending, rest/recovery, ammunition consumption, damage auto-roll,
duration expiry/situational UI, broad historical Actor repair and future Core
card/encounter integration remain deferred. Spell/item/monster detail cards
already exist; finish their correctness and real-host integration, not a redesign.

This review changed documentation only, with the ADR saved first (81,111 bytes,
SHA-256 `a19c6a5fb578bce816a40faf3417336dc3757ca8f143c512c59ccd8c44668175`).
No Git mutation, source/version change, live Foundry connection or service start.

## Core 0.19.1 implementation — October 17, 2026

This pass implements the resumption checkpoints above on the existing branch
(`fix/adr-0001-native-alignment`, HEAD `af24b8e`), preserving all earlier
uncommitted G8 work. Changes are uncommitted for review. Core, sibling modules
and the native reference were read-only (Core `git status` clean at `v0.19.1`).
The ADR was saved before this record (`temp/adr-snapshots/0001-before-core-0191-implementation-20261017T205849Z.md`, 89,067 bytes, SHA-256 `9d090e74b3793395ca9709e0fa6b2ca7888c97be00fc7ebf5cf7d12a39f462a4`).

### Compatibility

`info.json` requires Core `>=0.19.1` and module-api `>=1.6.0 <2.0.0` (declared
relations); UI `>=3.2.0 <4.0.0`, roll-engine `>=1.0.0 <2.0.0` and version 0.9.4
are unchanged, with no `sdkVersion` field. The CI checkout, the reusable release
workflow and `core_ref` all name `v0.19.1`; CI also runs the new
`system-index.test.ts`. No published or applied migration history exists: no
module tag contains `migration.json` or `migrations/`, the published 0.9.4
manifest is `sheet-delver-release.v1`, and the local Core journal holds no
jobs. The never-published step therefore keeps its ID and revision 1.

### What changed

| Area | Change |
| --- | --- |
| RV-08 | `ui/context/system-index-store.ts` owns the caller index/collection lifecycle; `ShadowdarkUIProvider` subscribes to it. Each scope (world, user, role, connection), `world:contextChanged` or retry starts a generation: in-flight requests aborted, retry timer cleared, late responses discarded, caches dropped, replacement request started even while the first is pending. It ends `ready` or `failed` (sheet alert with Retry; generator failure panel), never permanent loading. 5xx/429/409 retried with backoff. |
| Mid-request context change | Core fails a running request's reads with a plain `Error` (CG-6). `server/access.ts` `contextConflict` checks `world.assertRevision` against the revision captured at the start; the index, collection, luck and action routes answer 409 instead of an internal 500. |
| Migration hooks | `effect-keys.ts` reads only `input.relations` (`parent`/`baseActor`, field `type`); no whole-kind references. Delta rules below. |
| Catalog | Root `migration.json` active. Required `shadowdark-effect-keys-4.0` targets `ActiveEffect` and `ActorDelta` (delta enumeration) with relations `parent` + `baseActor`; advisory `shadowdark-effect-keys-4.0-world-packs` targets `WorldPack` with `parent`. Same hooks/parameters. |
| Tests | New `system-index.test.ts` (12); `migration-hooks.test.ts` rewritten on relations (19, replaces the inactive-catalog assertion); `world-adoption.test.ts` +1 mid-request conflict (13); presentation floors. |

### Token-delta Item type: public-contract resolution

Foundry source (local v13 and v14 installations, read-only; identical in both)
settles the inherited-type question without a broad read or a new relation:

- `EmbeddedCollectionDeltaField` validates each non-tombstone element against
  the full `BaseItem` schema (`_cleanElement`/`_validateElements`).
- `EmbeddedCollectionDelta#initialize` builds a managed document from the delta
  element alone; `ActorDelta.#mergeEmbeddedCollection` replaces base records by
  ID and never merges fields; the server `EmbeddedDeltaMixin` adopts the whole
  document on its first change.
- Native `MigrationRunnerSD.migrateSceneTokens` passes each delta Item's own
  source to `updateItem`, so native uses the delta Item's own `type`.

A delta Item's type is therefore its stored `type`. A typeless delta Item is an
invalid Foundry document with no inherited type; its legacy effects block with
an actionable reason (`Token delta Item … stores no type … Repair or restore it
in Foundry`). For token delta Actor-level effects, `ActorDelta.toObject` drops a
null optional `type`, so `delta.type ?? baseActor.type` is native's synthetic
type; the `baseActor` relation supplies it. No broad declared reads remain, so
Core can refresh only affected roots during execution.

### Evidence

| Class | Scope | Result |
| --- | --- | --- |
| Module offline | 12 suites against Core 0.19.1 | All exit 0: NA 51/51, BD 53/53, EC 89/89, world-adoption 13/13, migration-hooks 19/19, system-index 12/12 and six smaller suites. Explicit module/UI/migration TypeScript passes. |
| Mutation | 7 guards removed one at a time | Each turned a case red; files restored byte-for-byte (SHA-256 checked). |
| Packaging | `module:check`, `module:package` on an isolated copy | v2 manifest, catalog digest ``sha256:763ecdde…`` (2 steps) re-derived by Core's `discoverMigrations` from the extracted archive; six compiled `.cjs` hooks with matching digests, no external imports; floors Core `>=0.19.1`, module-api `>=1.6.0`. Packaged plan hook runs through Core's runner. |
| Isolated real Core | Real manager/Core/Next from a v0.19.1 workspace copy, isolated data, controlled Foundry upstream, published 0.9.4 → this branch's v2 archive | Generation 14 and 13, 13/13 each: advisory preview blocked by both unresolved sources with the hooks' reasons, no writes; after Foundry-side repair, 79 operations equal to the oracle (world, owned, token-delta, unlocked world-pack effects; locked pack reported); isolated review; approval; a withheld native receipt plus SIGKILL of the maintenance Core at write 26 resumed automatically to completion; source oracle exact, 79 unique writes, only effect change arrays; restart no-op; externally restored legacy source gated until a fresh review and approval, then repaired to the oracle; populated player `/api/system/data` (1,003 names); pack denial and warm-cache revocation; live Pulp revision 1 → 2 with stale/mismatched luck 409; action replay without reroll across a context change; retained-adapter reconnect re-prepared with a setting changed while disconnected. Larger inventories below. Updated offline harness `adr0001-host-adoption.ts` 11/11 on 0.19.1. |
| Isolated real UI | Same host, native 4.0.6 pregens, real login | Generations 14 and 13, 12/12 each: real login view; paper and tabbed sheets with all seven tabs; spell, attack, inventory and monster cards (focus enters, Tab 6/6, Escape, focus returns); Core roll dialog, dice tray, chat and bestiary at 320/390/820/1440 in dark and light appearances; no horizontal overflow, no page or console errors; live Pulp Mode toggles reached the open paper and tabbed sheets without reload and without stuck loading. |
| Native Foundry | — | Not run. |

| Inventory (Actors / owned Items) | Effect targets checked | Writes | Advisory preview | Enter → review | Approve → serving (incl. SIGKILL) | No-op restart | Restored-source repair | Peak Core RSS* |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 / 120 (5 Players) | 95 | 79 | 0.6 s | 5.8 s | 17.1 s | 4.6 s | 17.8 s | 832 MiB |
| 60 / 1,800 (30 Players) | 1,095 | 1,029 | 5.1 s | 10.4 s | 65.2 s | 7.6 s | 74.2 s | 1.27 GiB |
| 120 / 4,800 (60 Players) | 2,655 | 2,529 | 13.8 s | 18.8 s | 164.0 s | 13.9 s | 179.8 s | 2.04 GiB |

*Sampled from the first supervised Core process only; one shared host, controlled
upstream, so costs are indicative, not capacity guarantees. Every row passed the
same checks: oracle-equal operations, exact source oracle, no duplicate writes,
interrupted execution resumed, no-op restart and restored-source repair. No
global deadline was hit; Core's planner ran a 720-effect check-only plan in
0.97 s through relations (offline harness).

### Core observations (reproductions in the audit)

| ID | Observation | Module handling |
| --- | --- | --- |
| CG-4 | Same-world recovery treats declared packs as fresh using Core's own cached index as the freshness input (`CompendiumService.getFreshnessIndex`), and the hash covers only `_id`/name. Pack content changed in Foundry while SheetDelver was disconnected is not re-read: `Hydrated 0/15 declared packs … (15 skipped, fresh)`. | The module's `onWorldContextChanged(recovery)` rebuild runs (adapter retained) but can only aggregate what Core serves. Not hidden or worked around. |
| CG-5 | Core's shared sheet `RollDialog` takes no focus, does not contain Tab and ignores Escape (it does not use Core's `useModalFocus`): 0/6 contained Tab presses at every width; only click-outside or ✕ closes it. | Module dialogs (spell, attack, inventory, monster cards) pass all four keyboard checks. Shared dice presentation is Core-owned; no module copy. |
| CG-6 | A context change during a request makes the request runtime throw an untyped `Error('World context changed; refresh this action')`. | Routes map it to 409 via `world.assertRevision` (public contract), not by message text. |
| CG-7 | Core treats a world pack without `locked` metadata or configuration as locked (`config?.locked ?? metadata.locked ?? true`); Foundry's `CompendiumCollection#locked` defaults world packs to unlocked. Not yet confirmed against native pack metadata. | World-pack step is advisory: a pack Core reports as locked is an exclusion, never a world hold. Native check required. |

**Native-version probe.** On a controlled world reporting native 4.1.0, Core's archive dry-run for this package refuses with `Unsupported native source data-read version` (`dataReadVersion >=4.0.0 <=4.0.6`). Installing this release therefore excludes worlds outside 4.0.x; by Core's code the same check gates an installed world whose native version changes. The latter was not exercised.

**CG-8 packaging reproducibility.** Core's packager embeds esbuild source-path comments relative to the packaging directory, and the `tsconfig.json` found above it adds or omits a `"use strict"` prologue. Byte-identical module source packaged at three paths gave three hook and catalog digests (`9c438e84…`, `763ecdde…`, CI layout `e0982de3…`) with otherwise identical code. Released digests stay stable only while the release workflow layout is unchanged; a published step must keep its exact hook bytes. Report to Core; the module cannot control it.

### Reconciliation

| Item | Status |
| --- | --- |
| RV-05 | **Closed (isolated real Core).** Live Pulp Mode setting changes reach preparation (revision 1 → 2) and open paper/tabbed sheets without reload; stale and mismatched luck writes 409. Native toggle in Foundry is part of native acceptance. |
| RV-06 | **Closed (isolated real Core).** Same-world reconnect retained the adapter (no re-initialization, same Core PID), rebuilt the registry and re-prepared with a setting changed while disconnected. Pack-content freshness on recovery is Core's CG-4. |
| RV-08 | **Fixed.** Store regressions (pending, loaded, rapid, scope, disconnect/recovery, retries, release) and real-host live setting change without stuck loading. |
| M4 | **Met (isolated real Core).** Context/settings, permissions and migration contracts adopted; RV-06 proven with a real host process. |
| M5 | **Open.** Actual host-boundary acceptance done in isolation; native/operator acceptance not run. |
| A01-01 | Offline passes; real host renders native pregens (attacks, AC, slots). Native pending. |
| A01-02 | Offline passes; v13 and v14 serialized effect shapes migrated losslessly on the real host. Native pending. |
| A01-03 | Offline passes. Native pending. |
| A01-04 | Offline partial; real host: Class Ability action, replay without reroll, luck mode. Luck/rest/ammunition automation deferred. Native pending. |
| A01-05 | Offline passes. Native pending. |
| A01-06 | Real-host reconnect/recovery exercised (CG-4 noted); identities preserved. Native pending. |
| A01-07 | Real host v13/v14: populated player projection, denied/permitted packs, warm-cache revocation, Assistant access. Native pending. |
| A01-08 | Real host: paper, all seven tabs, spell/attack/inventory/monster cards, Core roll dialog, dice tray, chat, bestiary at 320/390/820/1440 in both appearances; no overflow, no page errors; module dialogs keyboard-correct; Core roll dialog CG-5. Native pending. |
| A01-09 | Real host: stale revisions refused, replay safe, live permission change applied. Rapid-edit reconciliation offline only. Native pending. |
| A01-10 | Real host v13 (13.351 identity) and v14 (14.367 identity) shapes. Native pending. |

### Native acceptance requirements

Native acceptance needs new, scoped authority; earlier Core fixture approvals
do not carry over. Required from the user before any connection:

1. Disposable Foundry worlds on v13 (13.351) and v14 (14.367), Shadowdark 4.0.6,
   on the user's approved local Foundry; their URLs and world IDs.
2. A full-GM service account plus Player and Assistant users in each world.
3. Approval to create fixture Actors/Items/scenes/world packs with pre-4.0
   effect keys (all locations above, one unresolved source), to run Core's
   maintenance job that writes their effect changes, and to delete them after.
4. Acknowledgement that SheetDelver cannot undo migration writes and that a
   Foundry backup is recommended. Backup existence is not an additional hard
   prerequisite: the accepted Core workflow permits proceeding after the
   explicit irreversibility/backup warning.
5. An isolated SheetDelver data directory and this branch's packaged archive.

The run repeats the isolated workflow natively: advisory preview with the
blocker reasons, review/approval, interrupted execution and recovery, readback
against an independent before/after export, no-op restart, an externally
restored source, world-pack lock state (CG-7), Pulp/ammunition toggles in
Foundry, pack ownership and revocation for Player/Assistant, reconnect, and
A01-01–10 on both generations, with measured costs.


## Independent G8 review and corrective checkpoints — October 17, 2026

This record supersedes the implementation record's claim that only native
acceptance remains. Review preserved all application source, hooks, compatibility
metadata and workflows, the existing branch and its uncommitted work. Core stayed
read-only on released 0.19.1 (`10213980`). The previous ADR was saved byte-for-byte
before annotation (102,551 bytes, SHA-256
`9d1d8b2c5b4390495e6952506832133093d3925741f46ceb0b1676c4b71362d4`).
The module audit holds the detailed reproductions and owning boundaries.

### Verified implementation and decisions

- Independently reran all **12 module suites** and explicit module/UI/migration
  TypeScript: all pass. These suites do not cover the consumer failures below.
- The Core/API floors and CI/release pins are correct: Core `>=0.19.1`,
  module-api `>=1.6.0 <2.0.0`, toolchain `v0.19.1`. UI/roll ranges and module
  version 0.9.4 remain unchanged; no `sdkVersion` field or new SDK bump is needed.
- Root catalog activation, bounded `type` relations, delta target selection,
  source-preserving hook serialization and the index request-generation fix are
  present. Core's packager and planner ran the current hooks independently.
- **Typeless delta Items:** the agent's correction is supported by both local
  Foundry sources. `BaseActorDelta.#mergeEmbeddedCollection` inserts the delta
  record and omits the same-ID base record; it does not merge their fields.
  A base Item's type is not a valid fallback. Keep the actionable unresolved
  result for a legacy effect on such an Item. The earlier resumption paragraph's
  inherited-Item-type premise is superseded. ActorDelta's own optional Actor type
  is a separate case and still uses the declared base-Actor relation.
- **Unsupported native versions:** the 4.0.0–4.0.6 range is a deliberate supported
  boundary, not an incidental package compatibility floor. In a new isolated
  actual Core process using the supplied final archive, a serving installed
  4.0.6 world was stopped, changed to 4.1.0 in the controlled upstream, then
  restarted. Core stayed uninitialized, reported `Migration check blocked` with
  `Unsupported native source data-read version`, and made zero writes. This
  closes the untested installed-bootstrap case from the agent report. It is
  simulated upstream evidence, not native or hot-version-change acceptance.
  The operator needs a module release explicitly supporting the new native
  version; repeatedly approving this migration cannot extend that range.

### Required corrections

| ID | Finding and consequence | Correction checkpoint |
| --- | --- | --- |
| **RV-09 — high: advisory pack coverage permits incomplete readiness** | `required: false` on the world-pack step applies to every pack result, including readable, unlocked packs. An installed world with only one ordinary legacy pack effect served normally, retained its old key, made zero writes, and reported **Up to date** through `/admin/module-migrations`. A separate planner case with an unresolved effect in an unlocked pack produced zero blockers and only an exclusion. | Restore required completion for the selected migration scope. Do not use an advisory step to work around Core's lock-default mismatch. With Core 0.19.1, `required: true` is the available strict policy, but any locked/unreadable Actor/Item world pack then blocks enumeration. If the desired policy excludes genuinely locked packs while requiring every eligible unlocked effect, record that exact policy and the missing Core distinction as an external dependency; do not claim it is implemented by the current advisory flag. No permission escalation, auto-unlock or Core source edits in module work. |
| **RV-10 — medium: open gear picker does not recover after invalidation** | `fetchPack` is now stable. `GearSelectionModal` reloads only on `[isOpen, fetchPack]`; a context event clears its collections without changing either dependency. In Chrome, a loaded Rope disappeared, the index fetched again, and none of the three gear collections refetched. | Make active collection consumers observe the store's generation/readiness or an explicit subscription. Reload needed collections on context/scope recovery even while already open; retire old consumer promises and retain search/manual UI state. Cover mounting before provider readiness as well as an already-loaded picker. |
| **RV-11 — medium: collection failures are hidden or shown as endless loading** | The store reports index failure, but collection failures only log and return null. With a 200 index and a 403 classes response, the Spells tab remains at **Loading classes…** with no retry/error. The generator records the failed classes shard, but suppresses the error once `collections.ancestries` exists and renders the form. | Track collection-specific loading/ready/failed states. Distinguish a valid empty collection from unavailable or denied content. Show a useful reason and a working retry/recovery path for spells, gear and generator consumers. Derive generator readiness from all data required for its selected mode, not ancestries alone. Do not expose privileged cached rows or substitute guessed rules. |

The isolated UI reproductions render actual module providers/components with
stubbed SDK requests; they establish the module defects without claiming another
full Core UI matrix. The installed-world reproduction runs unmodified Core
0.19.1 with an isolated data directory and a controlled upstream. No native
Foundry service was contacted. The native acceptance checklist above also
corrects the report's unnecessarily strict backup-exists requirement to the
already selected backup-warning acknowledgement; it adds no new approval flow.

### Checkpoints for the corrective implementation

1. Preserve this module's existing approved branch and all current work. Begin
   with meaningful failing cases for RV-09, RV-10 and RV-11; the review's ignored
   reproductions are references, not durable regression coverage.
2. Correct collection lifecycle/status through the shared store and all affected
   consumers. Verify pending and loaded invalidation, denied and transient failed
   reads, successful empty results, reconnect, caller/role/world changes and a
   successful retry. Include an open gear picker and generator partial success;
   index-only store tests cannot close these findings.
3. Reconcile the world-pack policy before declaring G8-B complete. Prove a
   **pack-only** legacy world is detected at bootstrap and after external restore;
   a malformed eligible pack effect cannot yield clean readiness; explicit locks
   are respected; approved eligible writes complete; a subsequent check is a
   true no-op. Verify both planner results and public admin status, not just the
   presence of world-pack writes in a mixed world/pack job.
4. Keep CG-4 (reconnect freshness), CG-5 (shared roll-dialog keyboard), CG-6
   (untyped context conflicts), CG-7 (native pack-lock parity) and CG-8 (packaging
   determinism/history) explicit as Core-owned follow-ups. The new pack-only
   public status reproduction also demonstrates that Core 0.19.1 omits advisory
   check exclusions from installed-world readiness evidence. Module code cannot
   repair that status contract. Core changes need their own selected task.
5. Preserve the recorded successful large-inventory, restart, readback and
   presentation evidence for its tested scope. Rerun the affected module suites,
   explicit typing, isolated packaging and focused real-host/browser cases after
   corrections; repeat broader workflows only if those changes affect them.
   Published historical migration hooks must retain their exact digests. Record
   CG-8 before release; matching hook semantics alone does not prove immutable
   history across packaging layouts or later releases.
6. Update the ADR, active audit, architecture and handoff with individual results.
   No release/version/Git operations or native connections are authorized by this
   review. Native v13/v14 acceptance remains separately scoped as above.

### Gate reconciliation

RV-05 remains supported by the existing isolated settings evidence. RV-06 retains
its settings/recovery evidence with CG-4 still open. RV-08's original **index**
pending-load race is fixed; its broader caller-collection acceptance is not
complete until RV-10/11 pass. **M4 is partial** because RV-09 leaves migration
coverage incomplete and RV-10/11 leave collection adoption incomplete. M5 and
A01-01–10 stay open. No earlier test result is discarded, and no native evidence
is inferred from controlled upstream generations 13/14.


## RV-09–11 corrections — October 17, 2026

This module-only correction pass continues the approved branch without replacing
its earlier work. The ADR was saved byte-for-byte before editing (111,492 bytes,
SHA-256 `09a5b5139b78072d7bbb36d22eaaffd2e7358a0c80d0d0fd101fac7f31024ad2`).
The independent review above remains the historical finding; this section
supersedes its outstanding implementation state, not its evidence or native gates.

### RV-09: selected required-completion policy

Both catalog steps are **required** under Core 0.19.1. Eligible world-pack legacy
effects must be reviewed, approved, written and independently verified before
readiness; unresolved eligible effects cannot become exclusions. The second
step's description explains the strict lock boundary and operator remediation.
The catalog is unpublished and has no operator-applied history; IDs/revision,
hook source, bounded relations, ActorDelta target selection and native
4.0.0–4.0.6 read range remain unchanged. Delta Items keep their own stored type;
there is no base-Item fallback.

A locked or unreadable world Actor/Item pack blocks Core enumeration, including
one whose contents might already be current. No module code unlocks packs,
elevates permissions, repairs caller data or weakens requiredness. An operator
must inspect world Actor/Item pack locks and service-account access in Foundry,
correct the scope deliberately if appropriate, then retry and review. A retry
alone grants no writes. Core's public status retains the lock/unreadable reason;
unresolved effects additionally carry their identity and repair reason.

**External dependency:** permitting intentional locked-pack exclusions while
requiring every eligible unlocked target would need a host enumeration policy
that distinguishes those scopes and reports its exclusions/readiness explicitly.
Core 0.19.1's boolean `required` does not express that policy. CG-7 (absent-lock
default discrepancy) and the advisory installed-status omission remain Core
findings. Neither is claimed fixed. Strict completion is the implemented policy.

### RV-10: subscribed collection lifecycle

`system-index-store` retains active collection demand, alongside its existing
caller/context cache. `useShadowdarkCollections` declares that demand; after
index readiness the store fetches each required collection once, including a
consumer mounted before provider readiness. A replacement context, caller,
role, world or connection aborts old requests and reloads active demand. Late
results cannot publish; the last consumer unmount retires unused pending reads
and settles their promises even if a transport ignores abort. Provider renders
mask another scope's data before its layout effect changes scope.

The open Gear picker no longer owns a load promise or waits on `fetchPack`'s
stable identity. It observes shared status and preserves search/category state.
Spell, language, details and mastery pickers use the same path. Generator keeps
manual form values while deriving identity documents from current collections;
its document reads and asynchronous derivations retire on generation changes.
No second world store or native transport was introduced.

### RV-11: collection-specific completion and recovery

Each shard has loading, ready or failed state independently of the index. A
successful array, including `[]`, is ready. Denied (401/403), unavailable
(404/409/503), network/read failures and malformed bodies have an explicit reason;
they do not populate an empty-success cache. Failed collections stay failed
until explicit retry or context replacement, avoiding request loops. Retry
refetches failed shards while retaining successful ones in the current scope.

Spells and the pickers show shared explanations/Retry and gate dependent saves.
Generator requires ancestries, classes, backgrounds, deities and languages in
both modes, plus patrons for level 1. A partial success cannot hide another
required shard's failure. Current selected identities and mastery/bonus-spell
options must still exist in current readable data; unavailable rules are not
replaced with a guessed document or privileged cache.

### Verification and gates

The [audit correction evidence](../audits/2026-10-15-native-alignment.md#rv-0911-correction-evidence--october-17-2026)
records each reproduction, public Core status, source oracle, consumer matrix,
package and artifact location separately. Maintained tests now include actual
React consumers in an isolated browser, explicit module/UI/migration typing,
and a public-workflow real-Core harness; CI runs the consumer matrix and typing.
The earlier large mixed-inventory evidence is preserved for its original scope.

The module implementation gaps RV-09–11 are corrected under the strict scope.
M4 has renewed offline/isolated evidence and awaits independent re-review of
these corrections. **M5 and native A01-01–10 remain open.** Controlled generation
13/14 upstreams are not native Foundry acceptance. The native requirements above
remain: scoped authority, disposable v13/v14 worlds, approved fixture/write/
cleanup scope, full-GM service account with Player/Assistant users, and explicit
irreversibility/backup-warning acknowledgement. No native connection was made.
CG-4, CG-5, CG-6, CG-7, CG-8 and advisory-status visibility remain external;
release-history/hook immutability must be resolved before any separately
authorized release. Version 0.9.4, Core >=0.19.1, module-api >=1.6.0 <2.0.0 and
the existing UI/roll ranges are unchanged; no sdkVersion is added.

**Additional host dependency CG-9:** the installed correction checks found that a
pack-ownership change alone does not invalidate a Player's loaded caller data in
Core 0.19.1. Current requests enforce the new capability, but no public Player
context/capability event retires an already-loaded collection. Core must expose
such an invalidation signal without exposing Setting documents. The audit
records this separately; module scope/context recovery and explicit failed-read
handling do not claim to fix it. Native permission-revocation acceptance must
include this boundary after Core's contract is available.


## RV-09–11 independent verification — October 18, 2026

The three module correction findings are **verified fixed for their stated
scope**, using the existing uncommitted branch and released Core v0.19.1
(`10213980`). No additional module implementation defect was confirmed in this
focused review. The ADR was saved byte-for-byte before this annotation.

Independent execution on Node **22.23.3**:

- All twelve maintained module suites and explicit module/UI/migration/test
  typing pass; store 15/15 and hooks 19/19 are included.
- Maintained actual-provider/consumer browser regressions pass **26/26**, covering
  the original loaded and pending gear failures, scope retirement, partial
  collection failures, denied/empty/malformed results and retry/action readiness.
- The supplied final archive SHA-256
  `2fcacac74dc0accbcefc5829611afcec6cae588ecf757ec97ad57d8234a7d971`
  passes all **9 maintained public Core maintenance checks** in a new isolated
  actual Core 0.19.1 instance with controlled v14-shaped upstream data. Pack-only
  legacy data stays unavailable before approval; one approved bounded write
  equals the complete independent source oracle; restart is a genuine no-op;
  restored data rejects the previous approval and requires a fresh one;
  unresolved, locked, unreadable and non-full-GM cases remain blocked without
  writes, unlocks or elevation. Fresh caller denial/recovery also passes.
- The prior generation-13, larger 930/2,460-effect and installed UI matrices remain
  retained implementation-agent evidence. They were inspected, not rerun wholesale
  by this review. None is native Foundry acceptance.

**RV-09** is closed under the explicitly selected strict policy: every world
Actor/Item pack must be readable and writable for required enumeration. This
fix restores completeness; it does not implement intentional-lock exclusions or
correct CG-7's host default. **RV-10/11** are closed for public scope/context
signals and fresh collection requests. Active demand and explicit per-collection
states now drive consumers through readiness, failure and recovery.

**CG-9 is confirmed as a Core boundary by source inspection**, consistent with
both retained installed-browser probes. A Setting change invokes
`refreshWorldContext`, but without a declared module-setting change or pack-content
notification it returns before publishing `world:contextChanged`. Raw Setting
invalidation is GM-only; SDK events expose no caller pack-capability signal.
Fresh server requests enforce the changed policy, while an already-loaded Player
collection remains visible until a supported invalidation/reload. This is a
stale client projection, not evidence that the module's fresh-read authorization
checks allow denied content. Do not substitute polling, declare Core settings
as module rules, or bypass Core to conceal the gap. A future Core correction
needs an explicit repository-specific task; no SDK version change is invented.

**Gate reconciliation:** the RV-09–11 re-review requirement is complete and M4's
module-side adoption has verified isolated evidence under the above policy.
Unqualified live permission-refresh coverage remains externally blocked by CG-9;
CG-4–CG-8 and advisory-status/intentional-lock provisions retain their recorded
status. M5 and native A01-01–10 stay open. Native tests may proceed on an approved
disposable world, recording known Core gaps as failed/blocked cases rather than
waiving them or claiming full closeout. Native schema cleaning, actual pack
metadata and operator workflows still require that evidence.

Review changed only module documentation/handoff and ignored evidence. Core,
module runtime source, hook definitions, manifests, workflows, versions, Git
index and remote state were unchanged. No native connection was made. All
review-owned Core/Next/upstream/browser processes were stopped.

## Native v14 acceptance addendum — October 18, 2026

The operator subsequently approved native testing and launched disposable world
`shadowdark-test`: Foundry **14.367**, Shadowdark **4.0.6**, full Gamemaster role 4.
The reviewed 0.9.4 archive (`2fcacac7…`, full identity in the audit) ran unchanged
on isolated released Core **0.19.1**. This supersedes earlier “native not run”
statements for the executed cases only. The ADR remains **open**.

Native migration covered eight effects across world Actors/Items, owned Items,
unlinked token deltas and their Items, and world Actor/Item packs. Exact public
preview approval and complete native source readback passed. Restart was a no-op;
deliberately restoring one fixture effect required fresh approval (old approval
409) and exactly one corrective write. Existing world sources were preserved.

The original STR-9 mastery example passed (+0 d8+1, versus −1 d8 when disabled).
Actual native browser preparation matched Core for sampled Player/NPC abilities,
HP, AC, slots and attacks. Native Pulp/ammunition updates, stale-context rejection,
RV-10 open collection refresh, RV-11 denial/retry/creation gates, manual spell
outcomes and request replay passed their executed cases. Generator/importer/
level-up evidence covers preview, unresolved-import refusal and data reads;
full native creation/finalization is still unexecuted.

Eight native-backed Core UI width/theme runs covered both sheet layouts, all
seven advanced tabs, sampled resource cards, bestiary and Core overlays. Module
resource-dialog keyboard checks passed. Core roll-dialog keyboard checks failed
as the existing CG-5 finding; do not equate layout success with full A01-08.

The [native audit addendum](../audits/2026-10-15-native-alignment.md#native-v14-acceptance--october-18-2026)
records exact scope, failures, source oracles, harness corrections and cleanup:

- **CG-7 confirmed:** native world packs with absent lock configuration are
  unlocked, while Core blocks required enumeration. Keep both migration steps
  required; do not auto-unlock or silently exclude data.
- **CG-9 confirmed:** fresh native pack reads enforce revocation, but already
  loaded Player collections lack an ownership-only invalidation signal.
- **CG-10 new:** OBSERVER effect writes are refused without source changes but
  return HTTP 500. The managed `.js`/external-data-root loading boundary splits
  SDK error constructor identity; the public `isSdkError` check misses a host
  permission-denied error. The audit includes a no-network packaged reproducer
  and Core/SDK follow-up checkpoints. Module message matching or per-module
  privilege/error workarounds are not the correction.

**Gate reconciliation:** RV-09–11 remain verified for their stated policy and
supported event scope. M5 and the full A01-01–10 matrix remain open. v14 cases
above are executed evidence; v13 is unrun. A01-04/05 and portions of the
permissions, live-race, reconnect and card/action matrix remain incomplete;
CG-4/6/8 retain their prior status. Address the confirmed host dependencies and
repeat affected cases before claiming release acceptance. A future host release
and module minimum must follow the selected corrections, not a speculative bump.

All recorded test Actors/Items/Scene/packs/accounts/chat and temporary settings
were cleaned up; baseline membership and unchanged original sources verified.
All test Core/Next/browser services stopped, retaining the operator's Foundry.
This pass changed module documentation/handoff and ignored test resources only;
Core, module implementation, compatibility, versions, staging and Git/remote
state were unchanged. The pre-edit ADR snapshot and hash are recorded in the audit.

## Core 0.19.2 checkpoint and resumption — October 18, 2026

The user reports Core **0.19.2** published and selects module-only resumption.
The local Core tree is clean at tag `v0.19.2`, commit
`b010f590e56d87e3fcd6fce42c7894028e5f0c3a`; package metadata agrees. Its SDK
remains **3.4.0**, module-api **1.6.0**, UI API **3.2.0**, roll API **1.0.0**.
Core's [ADR-0064 final closeout](https://github.com/sheetdelver/sheetdelver/blob/v0.19.2/docs/adr/0064-module-world-context-and-data-migrations.md)
records focused native v13/v14 evidence for CR64-23–26/R1. This is the supporting
release requested by the earlier module findings, not a new migration API.

The selected Core dependencies are resolved: CG-7 uses native pack lock defaults
and authoritative provenance, CG-9 publishes ownership-only context changes,
CG-10 preserves typed SDK errors across managed JS loading boundaries, and CG-5
fixes shared roller focus/keyboard/nested cleanup plus narrow-screen controls.
CG-5 is a UI acceptance matter, not a migration gate. Earlier statements that
these four await Core fixes or release are superseded. Core release documentation
that still says publication/module resumption is pending predates the release;
use the verified tag and this selected adoption scope, without editing Core here.

The module implementation is preserved as a **checkpoint, not a release or ADR
closeout**. Review found the required catalog, lossless hooks, declared parent/base
relations, host-provided rule inputs, caller-safe projections, generation-based
cache retirement and mounted collection demand already implemented. Do not
restart those implementations or repeat solved Core work. The [checkpoint audit](../audits/2026-10-15-native-alignment.md#core-0192-checkpoint-review--october-18-2026)
records fresh checks and exact remaining limitations. M5 and the complete A01
matrix remain open; focused Core acceptance and prior sampled module v14 evidence
are not a substitute for unexecuted module cases.

### Remaining adoption findings

**RV-12 — supporting release is not enforced.** `info.json.coreVersion` still
allows 0.19.1, as do the CI checkout, reusable release workflow and `core_ref`.
That would permit installations/toolchains missing the four selected corrections.
Align all four references to 0.19.2; this is a host compatibility update, not a
module release-version or SDK/API bump. Preserve native parity target 4.0.6 and
`dataReadVersion: >=4.0.0 <=4.0.6`. Do not claim native 4.1 support.

**RV-13 — maintained host fixture and evidence identity predate the correction.**
`src/tests/pack-maintenance.core.ts` creates `core.compendiumConfiguration` as
`{}` even for its locked case, then sets only `packMetadata.locked`. Core 0.19.2
correctly ignores that metadata field as an override. The intended locked-world
case must set the native configuration entry. The same harness hard-codes
`core: 'v0.19.1'` in results regardless of the selected toolchain. Correct the
fixture and record observed host/package identity rather than relabeling old
results. No production migration change is justified by this obsolete fixture.

### Implementation checkpoints for the module agent

| Checkpoint | Required work and completion evidence |
| --- | --- |
| R19-A — baseline and floor | Preserve the checkpoint branch/work, inspect current status, and read this addendum plus module guidance. Set `info.json.coreVersion` to `>=0.19.2`, CI checkout to `v0.19.2`, reusable release workflow to `@v0.19.2` and its `core_ref` to `v0.19.2`. Keep module version 0.9.4 and existing API ranges. No `sdkVersion` field. Update current documentation/changelog without rewriting dated evidence. |
| R19-B — truthful host fixtures | Correct RV-13 with actual world pack configuration and verified provenance. Cover absent/null/false override as eligible world scope; true lock, unreadable/malformed configuration and unresolved provenance must block required work without writes or auto-unlock. System/package packs remain excluded even if unlocked. Use native shape evidence, not invented fields. Record actual Core version/commit, package hash, generation and scenario. Distinguish skipped cases from passes; no hard-coded 0.19.1 result identity. |
| R19-C — complete maintenance | Keep both stable steps required, ActorDelta enumeration and declared parent/base dependencies. Verify world Actor/Item, owned Item, token delta and delta Item, world Actor-pack and Item-pack effects in both serialized shapes. Check complete source/receipt equality, no writes before approval, restart no-op, restore detection, stale approval rejection and fresh approved repair. Retain the existing larger-inventory evidence; rerun at suitable size only for changed behavior or unresolved capacity concerns. Do not erase published/applied hook history, regenerate IDs/digests merely to pass a test, add caller/bootstrap/UI repair, or invent missing types/data. If hook behavior really must change, document the stable-ID/history decision first. |
| R19-D — actual installed consumers | Use the final archive on isolated released Core 0.19.2 through public routes in development and supported production mode. Ownership-only revoke/restore and override removal must clear/refetch the same open consumer, preserve appropriate manual selections/search, reject stale positive responses and reconcile reconnect without a Pulp toggle/reload. Empty-key `world:contextChanged` is a valid signal. Verify per-collection failure/retry and dependent-action gates. Test packaged OBSERVER denial403, OWNER success and intentional404 concealment with unchanged-source proof on denials. Exercise Core's actual shared roller and module resource cards at320/390/820/1440 in both themes for focus entry, both Tab directions, Escape, focus return and unclipped buttons. No module-owned replacement for Core errors/modals/events. |
| R19-E — module regressions and native matrix | Run the twelve suites, explicit module/UI/hook typing, module checking, consumer browser suite and isolated packaging. Execute the corrected real-host harness for both effect shapes. Reconcile every A01-01–10 row and M4/M5 by evidence: previously executed, freshly verified, still unexecuted, externally blocked or explicitly deferred. Native tests use only an operator-confirmed disposable endpoint/world and existing scoped fixture/account/write/cleanup authority, with the recorded backup warning; an unavailable endpoint is not a pass. Complete remaining generator/importer/level-up creation, action/consequence, privacy, race and both-sheet/card cases within that scope. Native version switching belongs to the operator. Restore baseline and stop only task-owned services. |
| R19-F — reviewable handoff | Save an ADR snapshot before revisions; update this ADR, active audit, architecture, AGENTS guidance as needed, terse Unreleased notes and the stable module handoff. Report commands, package/toolchain identities, failing-before/passing-after evidence for genuine fixes, native scope, cleanup, and the exact remaining rows. Keep Core/siblings clean and runtime release metadata unchanged. Do not close M5/ADR or claim release readiness while required rows remain unexecuted or unresolved. Further commits/remotes/releases require their own current instruction. |

**Scope qualifications:** CG-4 (pack content freshness across an offline interval),
CG-6 (host mid-request context error typing; module currently maps through public
revision checks), and CG-8 (path-dependent package hook bytes) were not selected
in the four-fix Core release. Retain their qualified findings; recheck only as
needed for a current acceptance case and report a minimal reproduction if still
relevant. Do not edit Core, read private Stores, bypass caller authority or
silently mark them fixed. Ownership-only reconnect evidence is not proof of
arbitrary pack-content refresh. Rebuilding in a new path is not proof of identical
historical hook bytes; use one recorded archive for a workflow.

Intentional world-pack locks still block the module's required scope. Core's
correct absent-lock default does not introduce silent exclusions or automatic
unlocks. Leave that policy intact; any different exclusion policy requires a
separately selected contract. Deferred luck/rest/ammunition automation and future
Core encounter/card integration remain deferred unless explicitly selected.
