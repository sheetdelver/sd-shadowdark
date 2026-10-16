# Shadowdark ADR-0001: Native Alignment and Resource Cards

**Status:** Proposed — implementation in progress (offline evidence recorded; native/operator acceptance pending)
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
