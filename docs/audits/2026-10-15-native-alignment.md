# Shadowdark native alignment audit — October 15, 2026

**Current independent verification (October 18, Core 0.19.2 checkpoint):** the selected Core fixes CG-5/7/9/10 are released. Module implementation remains preserved and open for RV-12/13 adoption and the full M5/A01 acceptance matrix. See the [checkpoint review](#core-0192-checkpoint-review--october-18-2026). Earlier dates and Core-unavailable statements below are historical, not instructions to repeat Core work.

**October 17 implementation (superseded where corrected below):** G8 adoption is implemented against released Core
v0.19.1 (module-api 1.6 relations; root catalog active). RV-05, RV-06 and RV-08
are closed with offline and isolated real-Core evidence; M4 is met in isolation;
M5 and native A01-01–10 remain open. New Core observations CG-4–CG-8. See the
[Core 0.19.1 adoption evidence](#core-0191-adoption-evidence--october-17-2026).

**October 17 resumption:** Core v0.19.1 is published with SDK3.4/module-api1.6.
The prior Core0.19.0 blockers are historical; module G8 may resume. Eleven existing
module suites and explicit module/migration typing pass on the released host.
RV-08, relation-aware complete migration/catalog activation, real-host composition
and module native acceptance remain unfinished. The old inactive-catalog and v13
pack-denial harness expectations require updating. See the
[resumption checkpoints](../adr/0001-native-alignment-and-resource-cards.md#core-0191-resumption-and-module-corrective-checkpoints--october-17-2026).
No application source or compatibility metadata changed in this review.

**October 16 adoption update:** Core ADR-0064 is included in **v0.19.0** (local
tag/package verified at `2f71597`; user reports publication), with its selected
native v13/v14 gate complete. Earlier Core-unavailable statements
below describe the inspected historical baselines. The module's G8 adoption is
partly implemented and verified offline, including against Core v0.19.0's own
code. The [independent G8 verification](#independent-g8-verification--october-16-2026)
confirms a UI loading race (RV-08), migration capacity/parent-reference gaps,
lost hook diagnostics and a Core v13 pack-policy regression. M4 is partly met,
M5 and native A01 evidence remain pending; Core fixtures do not certify the module.
Follow the [ADR-0001 adoption addendum](../adr/0001-native-alignment-and-resource-cards.md#addendum-core-contract-adoption-and-release-order-october-16-2026)
for G8 checkpoints, actual contract floors, release order and evidence boundaries.

Status: **Implementation independently reviewed October 16; substantial offline
coverage passes, but confirmed corrections remain open.** The
[independent review addendum](#independent-review-addendum--october-16-2026)
supersedes broad "Fixed (offline)" labels where noted. Native/operator acceptance
remains pending.
Implementation plan: [Shadowdark ADR-0001](../adr/0001-native-alignment-and-resource-cards.md).
This is the module-owned technical evidence record. Its findings are independent
of the completed ADR-0063 closeout. The review itself changed no application code,
versions or Foundry data; the later implementation is recorded at the end.

The selected implementation scope is module-only. Core-owned findings remain
external dependencies, as defined in the ADR's ownership section. Module
[AGENTS.md](../../AGENTS.md) owns working instructions; this report owns findings,
evidence and checkpoint dispositions. Current branch/task state belongs in the
module-local handoff.

## Baseline and evidence limits

| Source | Verified baseline | What it establishes |
| --- | --- | --- |
| SheetDelver Core | `main`, `8c43170`, package 0.18.1 | Source inspected; no fresh publication check. |
| SheetDelver Shadowdark | `main`, `09b2633`, manifest 0.9.4 | Clean implementation baseline before these documentation additions. |
| Operator issue 23 | Core 0.18.1 / module 0.9.4 / Foundry 14.367 / native Shadowdark 4.0.6 | User reports Prim's Longsword as `-1 d8`, expected `+0 d8+1`, and supplies a v14 effect excerpt. |
| Installed native reference | `foundryvtt/data/v14/Data/systems/shadowdark`, manifest 4.0.6 | Released/installable parity target; not a fresh Actor capture. |
| Primary local native reference | Core-local `temp/shadowdark/system`, manifest 4.0.6; clean detached HEAD at tag `release-4.0.6`, commit `9677d16b3903b3b640f00d4efd48249142ac8334` | User-authorized release pin; use this local source for implementation. All five fingerprinted files match the installed native reference. |
| Earlier development comparison | Preserved local `develop` branch at `82dfd12b4d61a70c23dc9e1f3b735900fdc788f2`, manifest 4.1.0 | Historical comparison only; not the active checkout or corrective acceptance target. |
| Foundry v14 source | `common/data/active-effect.mjs`, `common/documents/active-effect.mjs`, `client/documents/active-effect.mjs` | Nested changes schema, legacy migration/getter shims and preparation phases. |
| Existing product screenshots | Site assets S02 phone paper, S03 desktop paper, S04 phone advanced | Reviewed existing images, not a newly tested browser session. S02 corroborates the reported row. |
| Synthetic offline probes | Existing module helpers and in-memory document runtimes | Reproduce specific failures below without sockets, HTTP servers or real documents. |

The user clarified that 4.0.6 is the latest installable release. The
[Foundry package listing](https://foundryvtt.com/packages/shadowdark) and
[published release](https://github.com/Muttley/foundryvtt-shadowdark/releases/tag/release-4.0.6)
confirm the baseline as of October 15, 2026. The reference checkout was then
switched to the existing local release tag with explicit user authorization;
no fetch or remote write was needed and `develop` was preserved. Released 4.0.6
defines native parity. Development-only additions are future notes, not missing
current-release functionality or closeout blockers.

No native UI session, live service, world write, browser acceptance run or full
regression suite was performed. The older local player JSON is not a current
Prim capture. A requested in-app browser for the external reference was
unavailable; no rendered review of that SPA is claimed. Reference webpages and
its primary repository were read instead. Prior ADR-0063's passing tests remain
historical evidence for their fixtures, not proof of v14 raw-data parity.

**Evidence labels:** **P** = reproduced by an offline probe; **S** = confirmed
implementation/source discrepancy; **R** = operator report or existing screenshot;
**V** = acceptance scenario still requiring verification. Priority P0 means an
access-boundary correction before expanding document/card reads; P1 means rules,
data preservation or action correctness; P2 means presentation/coverage work.

## Pipeline examined

```text
Foundry serialized source + declared packs + supported settings
  → Core primary stores (source authority)
  → adapter preparation / rules / registry
  → Core PreparedActorStore (module-prepared, not native-browser-prepared)
  → authorized Actor projection (currently recursively rewrites UUIDs)
  → ActorPage / ActorContext / UIContext
  → paper sheet or tabbed sheet / item modal / RollDialog
  → Core roll service → adapter getRollData / caller-bound document writes
```

Other paths reviewed: module document/collection/spell/effect routes;
generator/importer/advancement/table processing; effect and boon editors;
manifest declarations; native Player/NPC/Light models, item models and sheet
templates. Findings concern this whole route, not only `prepareWeaponAttack`.

## Findings

### SD01-01 — Serialized v14 effects are silently ignored (P1; P/S/R)

[weapon-rules.ts](../../src/logic/weapon-rules.ts), `activeChanges` and
`prepareWeaponAttack`, read top-level `changes` and numeric `mode`.
[rules.ts](../../src/logic/rules.ts), `applyEffects`, does the same.
Foundry v14 serialized effects instead carry `system.changes` with string
`type` and `phase`. Foundry's instantiated document compatibility getters
explain why native 4.0.6 can still use `.changes`/`.mode`; plain JSON has no getters.

The same synthetic level-1 STR -1 Longsword Actor with two mastery changes
(`system.roll.melee.bonus.longsword` and `.damage.longsword`, each
`1+floor(@level.value/2)`) produces:

| Shape | To hit | Damage | Warnings |
| --- | --- | --- | --- |
| Legacy `{ changes: [{ key, mode: 2, value }] }` | 0 | `d8+1` | none |
| V14 `{ system: { changes: [{ key, type: "add", value, phase: "initial" }] } }` | -1 | `d8` | none |

The general evaluator additionally turns strings/arrays/formula values into
`Number(value) || 0`, checks only `disabled`, and has no native phase/type
semantics. A synthetic ADD of `"wizard"` to spellcasting classes becomes `0`;
adding the level formula to HP maximum 8 leaves 8. Item suppression and transfer
rules differ between general and weapon paths. Weapon evaluation skips
situational effects with no selection flow and accepts numeric damage effects
only; native `_getActiveEffectKeys` also handles string damage expressions.

**Correction/exit:** one lossless version-aware effect reader, native suppression
and typed application rules, explicit unsupported diagnostics. Preserve
phase/priority/owner identity. Native roll-selector ADD → MULTIPLY → OVERRIDE
is a distinct algorithm from general phased ActiveEffect preparation; do not
apply one global sort to both. Test actor/item effects, selected situational
effects, all selector families, dice-valued damage, disabled/stashed/unequipped/
unidentified states, dual serialized shapes and no double application. C1/C3/C4.

### SD01-02 — Choice and effect writes can lose or leave unresolved data (P1; P/S)

[talent-choices.ts](../../src/logic/talent-choices.ts) substitutes and validates
only legacy changes. A v14 Weapon Mastery template returns with
`system.roll.melee.bonus.REPLACEME` intact, and its validation passes. Independent
grant/cardinality corrections from ADR-0063 remain valuable but do not cover this.

[AddEffectsModal](../../src/ui/components/AddEffectsModal.tsx) reads only the
first legacy change and saves a single-change replacement. Its mode labels
also reverse 3/4: native 3 is DOWNGRADE, 4 is UPGRADE. `mode || 2` loses CUSTOM
zero. [CustomBoonModal](../../src/ui/components/CustomBoonModal.tsx) flattens
legacy changes and reconstructs effects; nested effects disappear from its
editable representation. Neither round trip preserves all phase/priority,
flags, duration, status and transfer metadata.

[effects.ts](../../src/server/api/effects.ts) merges/deduplicates by effect ID
alone and finds the first Actor/Item effect matching that ID for update/delete.
Embedded effect IDs require their parent identity. A separate helper,
`normalizeItemData` in rules.ts, strips effect metadata; it is imported but not
called by the normal Actor normalization path, so this is a helper risk rather
than evidence that every incoming effect is stripped there.

**Correction/exit:** typed owner + effect identity, exact before-write choice
validation, lossless multi-change editor and version-correct patch serializer.
No-op saves must preserve original unknown fields. Unsupported editing becomes
read-only with an explanation, not destructive simplification. Test colliding
embedded IDs, multi-change mastery, zero/CUSTOM, cancellation, partial failures
and generator/import/level-up paths in both serialized shapes. C1/C5.

### SD01-03 — Player/NPC ability and HP projections disagree (P1; P/S)

`calculateAbilities` assumes every Actor stores a score and uses truthy defaults.
Native NPCs store modifiers directly. Player modifiers are bounded to -4…+4.
Offline results: NPC DEX `{mod:3}` becomes `{value:10,mod:0}`; Player score 0
becomes 10; score 24 yields +7 instead of native +4. Initiative already uses a
different bounded/NPC-aware implementation, creating disagreement within one Actor.

General effects modify a copy, while `ShadowdarkNormalizer` returns original
`system`; `computed.maxHp` is read but never assigned. Effective HP/abilities
can therefore differ across sheet, server roll and combat paths. `info.json`
combat suggestions still reference Player `.base`, while 4.0.6 migrates to `.value`.

**Correction/exit:** explicit Player/NPC schemas, nullish/validated handling,
one effective-stat projection and correct suggested paths. Preserve source and
existing GM-selected combat paths. Test scores 0/8/9/10/18/24, NPC positive and
negative modifiers, HP effects, initiative and server rolls against one oracle. C3/C4.

### SD01-04 — AC and carrying calculations use guessed rules (P1; P/S)

`calculateAC` recognizes shields by name, reads `ac.base`/`ac.value`, guesses
that base ≥15 forbids DEX, and overwrites AC in item order. Native 4.0.6 uses
`ac.base`, `ac.attribute`, `ac.modifier`, best body armor, additive bonus armor
and relevant AC effects. Synthetic DEX +3 plus native shield
`{base:0,modifier:2}` gives 13 instead of 15. Custom body armor
`{base:15,attribute:"dex",modifier:0}` gives 15 instead of 18.

Carrying capacity uses a talent-name `Hauler` branch and legacy
`bonuses.gearSlots`; native preparation starts `system.slots` at 10, applies
effects and adds the STR adjustment. Quantity/free-carry/coin/gem arithmetic
must be compared with native inventory aggregation, not just an individual
item getter. No claim that every current slot calculation is wrong.

**Correction/exit:** native schema-driven AC and slot preparation; test custom
names, armor order, multiple armor, non-DEX/blank attributes, shields, magic
modifiers, source zero, NPC AC, effect-granted slots and quantity boundaries. C3.

### SD01-05 — Core display resolution destroys reference identity (P1; S)

Core `src/server/services/actors/ActorService.ts::getActorById/resolveUUIDs`
recursively replaces every string starting `Compendium.` with a name. This
includes canonical class/property/UUID/sourceId references, not only labels.
Server rolls use the prepared store before this transformation. Module
normalization also rewrites spell `system.class` references into display names.

**Correction/exit:** preserve canonical references and explicit display labels
in module-controlled paths using existing SDK contracts. Core's generic resolver
correction is an external dependency and must not be implemented in this task.
Test raw → prepared → actual HTTP projection → UI → command with duplicate names
and renamed/custom documents; identify affected cases that remain externally
blocked. No client name-based repair or false full-parity claim. C2.

### SD01-06 — Document route bypasses caller-bound reads (P0; P/S)

[document.ts](../../src/server/api/document.ts) ignores `req.runtime` and calls
the singleton adapter. [Registry](../../src/server/Registry.ts) uses documents
attached during base-runtime initialization. Core's
`createModuleRuntime.ts` explicitly supplies system-level reads; its
`DocumentResolver` supports world and embedded UUIDs, not only compendiums.
Consequently the generic module route can resolve world documents without the
caller's visibility projection. Registry hydration can also retain the result
in shared collections. This is a source-confirmed authorization-path defect,
not a claim that a real user has obtained private content.

An offline fake-runtime probe requested `Item.synthetic`: the base resolver was
called once, the supplied denying caller resolver zero times, and the handler
returned HTTP status 200. No real private document was requested.

**Correction/exit:** caller-bound world/embedded reads, exact declared-compendium
scope for system reads, and no caller-specific world documents in shared pack
caches. Audit consumers (`document`, spell learning, table hydration, card
lookups), preserving permission errors. Prove denied/limited/observer/owner/GM
behavior, journal Secret and whisper projections, and cache isolation offline
before adding card/bestiary fetch paths. Core authorization policy stays Core-owned. C1.

### SD01-07 — Fuzzy lookup and cache lifetime obscure source authority (P1; P/S/V)

Registry lookup accepts terminal-ID matches before exact UUID/pack matching.
The probe requesting `Compendium.custom.gear.Item.same` returned
`Compendium.shadowdark.gear.Item.same`. Name/class substring matching and spell
list Name+Tier deduplication can collapse distinct documents. `resolveDocumentName`
also permits suffix matching and renders an unresolved UUID tail as a label.

Registry's five-minute derived cache survives `attach` without an explicit
reset; UI collections add another cache. Test invalidation on pack changes,
world/runtime epoch changes and failed hydration. Stale-world disclosure has
not been demonstrated; the lifecycle is a required verification case.

**Correction/exit:** canonical full identities, explicit supported UUID aliases,
deterministic ambiguous/missing states, pack revision/epoch invalidation and
readiness diagnostics. No same-name or same-last-ID substitution. C1/C2.

### SD01-08 — Roll defaults and native action semantics are incomplete (P1; S)

[ActorContext](../../src/ui/context/ShadowdarkActorContext.tsx) fabricates a
name-only virtual Spell when name lookup succeeds, chooses abilities from
hardcoded class names, then falls back to INT. `calculateSpellBonus` reads
legacy bonus fields; native roll selectors and signed advantage are not handled
as one action model. Adapter `getRollData` uses a different spell/ability
calculation, can read absent raw `.mod`, and accepts supplied `itemData` when an
owned item is not found. Non-Spell/non-Weapon item types fall through to a generic
attack d20 rather than a typed unsupported action.

Native Player `castSpell` checks lost spells, broken wands, caster/item ability,
and applies spell loss, scroll consumption or wand spell-loss/breakage after the
result. `useAbility` handles limited uses and loss on failure. `usePotion` has
identification/consumption behavior. Existing module cast controls are not proof
these workflows exist. Magic-item UI primarily selects the first top-level
`item.spells` entry; native Scroll/Wand references must be resolved with their
triggering item identity and per-spell state. Native critical thresholds and
multiplier exist already in 4.0.6; they are not a 4.1-only addition.

**Correction/exit:** one native-backed action preparer used by both layouts,
cards, dialog defaults and server execution. Resolve authoritative source on
the server; preserve explicit user roll adjustments as adjustments. Model
eligibility, choice, pending/result/consequence, cancellation and failed writes.
Use Core roll/chat/dice services. Never recreate Foundry browser globals or
silently execute a generic d20 for an unsupported item. C4/C7.

### SD01-09 — Generation, progression and spell learning have parallel authorities (P1; S)

`MASTERY_WEAPONS`/`MASTERY_ARMOR`, `data/talent-effects.ts`,
`data/roll-table-patterns.ts`, talent handlers, `TableService`, UI level-up
state and server assembly encode overlapping rules. `SpellsTab` derives sources
and limits using names and a guessed `ceil(level/2)` tier fallback. The spell
learn route forces `type: Spell`, copies only selected fields and does not check
the resolved source type/capability/choice policy before creation. Core write
ownership is necessary but is not validation of native system eligibility.

Importer gear misses can be silently dropped; basic-item misses construct
inventories with inferred slots/quantities. Ammo quantity 1 becomes 20 by name.
Treat documented import-format conversion separately from unsupported guesses.

**Correction/exit:** native declared templates/tables/class data determine
choices and grants. Versioned compatibility maps are allowed only where native
code itself supplies semantics, with source provenance/tests. Client rolling
and generation are allowed, but cannot invent missing table outcomes, item dice,
properties or spell capabilities. Preview unresolved/ambiguous imports; require
an explicit user-supplied custom value or stop the affected write. Preserve
independent grants, exact counts and pre-write validation. C5.

### SD01-10 — Prepared and client-derived data overlap (P1; S)

Rules normalization, `ShadowdarkNormalizer`, ActorContext, `SpellsTab`, paper
sheet and inventory/detail components independently infer parts of capability,
item grouping, spell class, slots, names and roll defaults. The sheet uses
`computed.showSpellsTab || shouldShowSpellsTab(actor)`, so an authoritative false
causes recalculation. Paper and ActorContext instantiate separate level-up hooks.
Shared weapon helpers are a useful existing foundation, not a completed unified
projection. Normalization mutates its working item descriptions/class fields;
those edits must not be mistaken for unchanged source fields.

**Correction/exit:** one typed prepared Actor/item/action view; one projection
per revision, no rules in React. UI may sort/filter/format/select and keep drafts.
Dialog selection-dependent rules reuse the same pure module function as server
execution. Avoid adding a third canonical object under another name. C2/C3/C6.

### SD01-11 — Item/effect identity is inconsistent in presentation (P1; P/S)

Normalizing a raw embedded item with `_id: "sword"` leaves `id` absent.
`ItemModal` updates `items.${item.id}...`; some delete controls likewise use
only `id`, despite display keys accepting `_id`. Attack-derived clones add an ID
alias but inventory items do not. This probe establishes a supported raw-shape
failure; it is not evidence that every current producer omits `id`.

The normalizer allocates `allFoundryEffects` from Actor effects but never uses
it, returning only Item effects. An Actor-only effect becomes an empty sheet
effect list. The effects API builds another list with different identity rules.

**Correction/exit:** canonical typed actor/item/effect references and one effect
view with owner/provenance/active state. Every mutation addresses the same source
identity used to display it. Test `_id`-only input and repeated IDs under different
parents. C2/C5/C6.

### SD01-12 — Optimistic writes and reloads lack coherent failure handling (P1; S/V)

ActorContext drafts are keyed only by path; pending debounces have no unmount
cleanup or actor/epoch guard, and immediate writes do not cancel the older
same-path timeout. One boolean represents multiple concurrent saves.
Optimistic deletes filter `items` but not derived attacks/inventory and have no
complete rollback/reconciliation path. ActorPage fetches have no request-order
guard; mutation handlers catch errors without consistently rejecting to callers.
Spell management does not consistently check HTTP success. Treasure sale sends
separate coin/deletion operations without a coherent completion result.

These are source-visible failure paths; races and affected onscreen outcomes
still need deterministic UI tests. **Correction/exit:** actor+epoch+revision
scope, stale-response suppression, cancel/flush policy, pending operation counts,
visible errors and refresh/rollback. Plan multi-document operations with explicit
partial-success reconciliation; do not claim atomicity the SDK does not offer. C6.

### SD01-13 — Description handling is neither uniform nor a safe card boundary (P1; S/V)

The logic-layer `formatDescription` strips UUID targets into labels and inserts
inline-roll HTML; it is not an HTML sanitizer. `ItemModal`, `GearSelectionModal`
and several Generator descriptions directly render content without consistently
using SDK `processHtmlContent`. InventoryComponents already uses the safe SDK
alias exported by `sheet-utils`; reuse that established path. String and
`{value}` descriptions follow different paths. No browser exploit was attempted.

Native `_PhysicalItemSD.toggleIdentified` swaps the current name/description
with alternate identification fields. Do not mistakenly show the stored alternate
identity on a player card. Existing Actor access does not by itself establish
which native GM-only/item fields should enter a new card projection.

**Correction/exit:** caller-authorized card projection, shared safe HTML handling,
typed UUID/roll actions and source-preserving editors. Test malformed HTML, unsafe
URLs, object descriptions, unavailable links, restricted alternate identity and
sanitization without source rewriting. C1/C2/C7.

### SD01-14 — Paper sheet hides capabilities and lacks detail navigation (P2; S/R/V)

[Paper sheet](../../src/ui/ShadowdarkPaperSheet.tsx) silently limits attacks to
five. Talents truncate without a detail affordance; the talent-only collection
does not represent every Class Ability/Boon. Spell clicks roll immediately.
Several clickable cells/rows are divs without keyboard semantics. Patron
visibility and light/ration grouping use name checks. Luck edits only the
standard boolean, not native Pulp remaining tokens. “Free to Carry” is an empty
placeholder. S03 shows truncated talent names and spells without detail cards.

**Correction/exit:** all attacks accessible with explicit overflow, feature
details, capability-driven sections and source-defined light/consumable roles;
keyboard buttons with labels/focus and no color-only state. Spell/title click
opens the detail card; Cast is an explicit card action. Preserve a compact paper
layout. Verify zero/large counts, long names, observers and NPC data. C6/C7/C8.

### SD01-15 — Tabbed sheet/modals require responsive and lifecycle review (P2; S/R/V)

Abilities: prepared attacks already reused; verify complete NPC/stat semantics.
Inventory: detail/edit behavior has SD01-11/12/13 dependencies.
Spells: duplicate rule derivation, first-spell magic-item path and management
errors above. Details: long names, class/boon actions and source identities.
Notes: round-trip description/value variants and safe rich content.
Effects: missing Actor effects, ambiguous parents and destructive editing above.

`ItemModal` uses a private fixed overlay without dialog/focus/Escape contracts.
Advanced tab visibility/overflow uses independently filtered/reordered state;
test disappearing active tabs and resizing. S02/S04 show the floating host tray
over nearby content; reachability of all controls still requires scrolling tests,
not an inference from a cropped screenshot. Check header/HUD offsets, modal
stacking, bottom safe areas and theme integration. C6/C7/C8.

### SD01-16 — Native capability coverage is not explicitly declared (P2; S/V)

Use the matrix below to bridge real gaps and distinguish intentional exclusions.
NPCs cannot be treated as Players with fewer fields. The module manifest does
not declare a monster Actor pack; registry aggregation reads Items/RollTables,
so a working bestiary requires an explicit declared Actor source and access
policy. Class Ability documents are declared but deserve explicit indexing and
action presentation, not accidental fallback categorization. C0/C4/C7.

### SD01-17 — Fixture coverage bypasses the reported boundary (P1; S)

Existing weapon fixtures use legacy changes/modes. Component rendering exercises
prepared test shapes, not the whole raw v14 → HTTP identity transformation →
dialog → server command path. NPC attacks are covered without proving NPC stat
preparation. A large render-case count does not replace version/source coverage.

**Correction/exit:** first record red regressions for the probes and boundary
cases, then repair, then demonstrate green on unchanged fixtures. Keep shape
contracts, native oracle expectations, pipeline tests and browser acceptance
separate. Report unsupported cases and unperformed native checks explicitly. C0/C9.

## Native capability and gap matrix

“Planned” means work proposed by this audit, not already implemented or newly
authorized code. Source anchors are native `src/models/PlayerSD.mjs`,
`NpcSD.mjs`, `_ActorBaseSD.mjs`, `items/*`, actor templates and dice helpers.

| Native capability | Current coverage / gap | Proposed disposition |
| --- | --- | --- |
| Player statistics, AC, HP, slots, initiative | Present; inconsistent effect/schema handling | Correct under C3, preserve shared initiative integration. |
| Weapon modes/properties/damage | Shared bounded helper; v14 failure, incomplete selector features | C3/C4 native-backed action preparation and explicit unsupported states. |
| Ability checks, roll advantage, critical settings | Multiple formulas; native selector/critical coverage incomplete | C4 unified check/attack/spell config; prove 4.0.6 critical semantics. |
| Spells and caster/item eligibility | Present UI, legacy guesses | C4/C5 authoritative class/spell references, limits and actions. |
| Scrolls, multi-spell wands, broken/lost state | Partial display/first-spell action | C4 resolve each spell and triggering item; native result consequences. |
| Class Abilities, limited uses, loss on failure | Item support without equivalent typed action flow | C4 and C7 feature card/action support. |
| Talents/boons/effects/conditions | Editors exist; raw v14 and round trips fail | C1/C5 read/edit/preserve; no generic d20 substitution. |
| Inventory, gems, treasure, ammunition | Partial; guesses and multi-write failure cases | C3/C5/C6 reconcile native quantities, classification and sale workflow. |
| Identification and potions | No complete native-equivalent workflow established | C4/C7 explicit supported action and role-safe presentation. |
| Standard/Pulp luck, rest/recovery | Standard luck boolean; full recovery/settings path not established | C0 inventories native settings; C4 implements verified state transitions or labels unsupported pending explicit scope decision. |
| Generator/import/advancement/tables | Significant existing workflows with duplicate maps and fallbacks | C5 keep generation; source all rules/results and preserve unresolved evidence. |
| NPC stats, movement/dark adaptation, attack counts/specials/features/spells | NPC AC and basic attacks partly covered, no complete card | C3/C7 typed NPC projection and module bestiary/detail presentation. |
| Light Actor, dropped/picked-up scene light, timers/time hooks | Item toggle is not native lifecycle parity | Display available state; scene/time automation stays separate under DW-04 until selected. |
| Native macros, browser hooks, scene targeting, combat automation | No parity established; server cannot invoke browser-only APIs | Document capability boundary; no browser/runtime dependency or arbitrary macro execution. Separate scope if requested. |
| Development-only 4.1 damage advantage/exploding dice | Additional Player damage config in the `develop` snapshot, absent from released 4.0.6 | Informational future scope; not a current parity defect, implementation requirement or acceptance blocker. |
| Core-wide card SDK/monster actions | Not implemented | Explicitly deferred DW-13; module presentation can be completed first. |

## Resource-card design brief

Use one module-local resource-detail controller and modal frame, with typed
content for Spell, physical Item/Weapon/Armor, Magic Item/Scroll/Wand/Potion,
feature and NPC. “Magic Item” is a presentation kind, not an invented native
document type; native `system.magicItem` and actual type determine it.

One exact document reference opens one authorized prepared view. Owned resources
carry Actor + embedded Item identity; compendium/world resources remain distinct.
Open the current owned instance, not a same-name compendium template. Card data
includes identity, kind, title, optional image, source label, fact rows, safe
description, availability/diagnostics and typed actions. It does not contain a
second rule engine, unfiltered source document or client-trusted formula.

| Card | Content from native data | Actions / constraints |
| --- | --- | --- |
| Spell | Title, tier, class/source labels, range, duration, complete description, lost state, prepared casting facts | Cast opens existing SDK RollDialog with the same action as advanced sheet; explain disabled/unavailable. |
| Weapon/Armor/Item | Properties, base and Actor-adjusted damage or AC, quantity/slots/cost when defined, equipment state and description | Existing permitted actions; separate details from destructive editing. Never fill absent damage with a guessed die. |
| Magic resource | Actual type, identified current presentation, spell choices, broken/lost/uses state and known description | Each authorized native action resolves its triggering item and current spell state. Alternate hidden identity is excluded. |
| Feature | Full description, source, uses/recovery and supported check facts | Use/check only when supported; passive features remain readable. |
| Monster/NPC | Name, level, alignment, HP/AC, native modifiers, movement/dark adaptation, attack count/ranges/damage/special text, spells and features | Complete module read-only browse/detail first. No spawn, encounter insertion, sharing or Core combat command implied. |

Paper spell labels open details; Cast then opens the host roller. Advanced spell,
inventory, feature and bestiary links use the same content view. Preserve card
state on cancel; on success refresh from the current prepared revision. Prevent
duplicate Cast submissions and invalid stale actions. A compendium preview with
no Actor context must not pretend to cast for an unspecified Actor.

The current SDK exposes RollDialog, ConfirmationModal, LoadingModal,
RichTextEditor and SharedContentModal. SharedContentModal is a compatibility
no-op for Core's shared-media host, **not** a generic resource dialog. Reuse the
host's roll/confirmation flows; implement one accessible module-local resource
frame if no suitable public frame exists. Do not import private Core components
or expand the SDK in this pass. Requirements: dialog naming, focus trap/restore,
Escape/backdrop behavior, keyboard navigation, scrollable long content, mobile
safe areas, themed contrast and correct nesting with the roll modal.

Layout references, not content dependencies:

- [Limpjellyfish spell cards](https://limpjellyfish.itch.io/limpjellyfishs-old-school-spell-cards): compact titled spell cards with tier/class organization; adapt information hierarchy, not downloadable artwork.
- [Kids Play TTRPGs monster cards](https://kidsplayttrpgs.blogspot.com/2024/04/shadowdark-monster-cards-z.html): compact monster-stat presentation. The page describes third-party art without permission; do not bundle those assets.
- [Shadowdark Resources](https://dickloraine.github.io/shadowdark-resources/#/magic-items) and its [source repository](https://github.com/dickloraine/shadowdark-resources): resource categories and reusable output formats. The SPA's rendered interactions were not inspected.

Use currently authorized Foundry content/images through existing URL handling.
Printable/export cards, external content scraping and redistributed card libraries
are not required by this design.

## Implementation handoff and checkpoints

Shadowdark ADR-0001 defines C0–C10 in dependency order. The mapping is:

| Checkpoint | Findings covered | Required evidence |
| --- | --- | --- |
| C0 baseline/contract | 16,17 | Native version matrix, source fields/settings/action inventory, raw-shape fixtures and red regressions. |
| C1 access/effect boundary | 01,02,06,07,13 | Caller-bound reads, identity isolation, lossless effect reader; denied and multi-shape cases. |
| C2 identity/projector boundary | 05,07,10,11,13 | Module paths preserve canonical UUIDs; one typed view, no source mutation. Core rewriting remains an explicit external dependency where it blocks acceptance. |
| C3 effective rules | 01,03,04,10 | Native-backed stats/AC/slots/weapons plus diagnostics, one result across surfaces. |
| C4 native actions | 08,16 | Eligibility/options/results/consequences; cancelled/retried/failed actions preserve state correctly. |
| C5 creation/editing | 02,09,11 | Correct choices, source preservation, lossless effects, explicit unresolved imports. |
| C6 client consolidation | 10,11,12,14,15 | Remove competing derivations; stale-write/fetch and rollback tests. |
| C7 cards/bestiary | 13,14,15,16 | Shared authorized content and module NPC browse/details; Cast delegates to C4. |
| C8 responsive/accessibility | 14,15 | Both sheets/all tabs/cards at phone/tablet/desktop, keyboard and permissions. |
| C9 parity/acceptance | All | Red-before/green-after tracked tests, actual boundary coverage, native/operator outcomes labeled honestly. |
| C10 documentation/closeout | All | Coverage matrix reconciled, explicit deferrals, clean release preparation only when separately authorized. |

No finding is closed by editing its description, adding a warning while retaining
an invented value, or a test that asserts the faulty output. Each closure records
the source rule, failing case, code owner, unchanged-input passing result and
remaining limitation. Keep unresolved statuses visible; no blanket “native parity”.

## Offline evidence ledger

Temporary logs are convenience artifacts, not required to understand this record:
`/tmp/sd-adr0064-offline-probes.log` and `/tmp/sd-adr0064-resolver-probes.log`.
No tracked test files were added in this documentation-only slice.

| Probe input | Actual existing behavior | Native/contract expectation |
| --- | --- | --- |
| Same L1 mastery in legacy/v14 shapes | `0,d8+1` versus `-1,d8`, no diagnostics | Same rules result, `0,d8+1`. |
| V14 mastery REPLACEME + Longsword choice | Placeholder remains; guard passes | Resolved selector or reject before writes. |
| NPC DEX `mod:3` | `value:10,mod:0` | Keep explicit +3, no invented score. |
| Player STR score 0 / 24 | 10,+0 / 24,+7 | 0,-4 / 24,+4. |
| DEX+3, native bonus armor +2 | AC13 | AC15. |
| DEX+3, native base15 armor allowing DEX | AC15 | AC18. |
| ADD `wizard` class / formula to HP8 | Classes become 0 / HP stays8 | Native typed class membership / formula evaluates to +1. |
| Raw `_id` item and one Actor-only effect | Item `id` absent / sheet effects empty | Usable canonical item identity / effect represented once. |
| Document handler with denying caller and synthetic base reader | Base read1, caller read0, status200 | Caller policy applied; denied world read not returned. |
| Request UUID from other pack with same terminal ID | Wrong pack returned | Exact requested identity or unavailable. |

Native source fingerprints (SHA-256; files were read, not executed). The released
column now applies to both the pinned local tag and installed reference; the
development column retains the earlier comparison, not the active checkout:

| File under native `src/` | Released 4.0.6 | Historical 4.1.0 development snapshot |
| --- | --- | --- |
| `models/PlayerSD.mjs` | `81b8bd3b42dacce07b771376efacaad0402f3c6961ec217d537e73fd7f0edfe0` | `998b9296d8bff19c9ebf86cc8721d184b5ab5ae4d3f1635ac9d3a3dae816ae3b` |
| `models/_ActorBaseSD.mjs` | `a8853ff6a29482f075353689b938ef61d8149179d90c4500f8cd873e1a6ca942` | Same |
| `documents/ActiveEffectSD.mjs` | `a01476f978e9a9fc28b98287e3a11a5b5325a4f8ac0e0072612c307945855334` | Same |
| `models/NpcSD.mjs` | `db07ae075e8d60176f197c345c865bb57ba8027690a30c23b4b9aef8b968a9dc` | `bcbb0103d0b108b5ea04ffca00846e9d402429ee9694e1a820eadd1fca6b88dd` |
| `models/items/ArmorSD.mjs` | `b4672d354ea6c031fa171f8c902a5827f19aa78ffb82598e8daa545320060897` | Same |

Primary native project: [foundryvtt-shadowdark](https://github.com/Muttley/foundryvtt-shadowdark).
Local snapshots establish the inspected versions; a moving upstream branch is
not a substitute for these fingerprints. Native browser/operator comparison is
still pending and must be recorded separately from these source-derived oracles.

## Implementation dispositions

Recorded on module branch `fix/adr-0001-native-alignment` (from `e95fc47`, module
0.9.4, changes uncommitted for review) against Core 0.18.1 at `ff65695` (the
review inspected `8c43170`; the SDK surface used by this module is unchanged
since `v0.18.0`, the CI pin). Native authority throughout: tag `release-4.0.6`,
commit `9677d16b3903b3b640f00d4efd48249142ac8334`; the five fingerprints above were
rechecked and match.

"Fixed (offline)" means a failing case on the unchanged code now passes against
a source-derived oracle. It is **not** native/operator acceptance, which remains
pending for every finding. Evidence: **NA** `src/tests/native-alignment.test.ts`,
**BD** `src/tests/boundaries.test.ts`, **BR** the isolated browser run below.
Paths are relative to `src/` unless noted.

| ID | Disposition | Changed paths | Native authority | Failing → passing evidence | Remaining limitation |
| --- | --- | --- | --- | --- | --- |
| SD01-01 | Fixed (offline) | `logic/effects.ts`, `logic/foundry.ts`, `logic/formula.ts`, `logic/roll-keys.ts`, `logic/actor-preparation.ts`, `logic/weapon-rules.ts` | `ActiveEffectSD.mjs`, `_ActorBaseSD._getActiveEffectKeys`, `dice.resolveFormula`; Foundry 14 `BaseActiveEffect.migrateData`, `applyActiveEffects` phases | NA A01-01 (6 surfaces `-1 d8` → `+0 d8+1`), SD01-01 class ADD and HP formula; BD suppression/transfer/situational/phase/priority/selector cases | Duration expiry and custom (hook) change types are reported, not applied. |
| SD01-02 | Fixed (offline) | `logic/talent-choices.ts`, `logic/talent-handlers.ts`, `server/api/effects.ts`, `ui/components/AddEffectsModal.tsx`, `ui/components/CustomBoonModal.tsx`, `data/native-predefined-effects.ts` | `config.mjs` PREDEFINED_EFFECTS; Foundry 14 change types/modes | NA v14 REPLACEME replaced and unresolved placeholder blocks; BD owner refs, lossless edit, no-op save, legacy mode labels | Two native predefined entries are unusable as shipped and are refused with reasons. |
| SD01-03 | Fixed (offline) | `logic/actor-preparation.ts`, `info.json` combat paths | `PlayerSD` attributeModel/migrateData, `NpcSD` | NA NPC DEX +3, Player score 0 → -4, 24 → +4, HP formula | — |
| SD01-04 | Fixed (offline) | `logic/actor-preparation.ts` | `PlayerSD.prepareDerivedData`, `ArmorSD` | NA shield AC 15, base 15 + DEX AC 18, order independence 16, slots 10 + max(0, STR − 10) | Native free-carry/gem bag aggregation is matched for fixtures only. |
| SD01-05 | Module consumers fixed; **Core rewrite external** | `logic/identity.ts`, `logic/prepared-view.ts`, `logic/normalization.ts`, `ui/DetailsTab.tsx`, `ui/pages/ActorPage.tsx` | — (identity contract) | NA canonical mastery source survives `hostActorProjection` (a replica of Core's rewrite) | See external dependencies: raw reference strings in the Actor detail response are still replaced by names. |
| SD01-06 | Fixed (offline) | `server/api/document.ts`, `server/api/effects.ts`, `server/api/spells.ts`, `server/api/level-up.ts`, `server/api/actions.ts`, `server/api/bestiary.ts`, `server/ShadowdarkAdapter.ts` | Core caller runtime policy (ADR-0038) | NA denied world read now 404; BD caller projection, privileged-then-denied, denied Actor effects | Uses Core's projection; journal/whisper behavior is Core-owned. |
| SD01-07 | Fixed (offline) | `server/Registry.ts`, `logic/identity.ts`, `ui/context/ShadowdarkUIContext.tsx` | Declared packs in `info.json` | NA cross-pack terminal ID no longer substituted; BD stale-load guard, alias only within declared pack, same-name ambiguity | The table-pattern map remains a module convenience over exact table UUIDs. |
| SD01-08 | Fixed (offline) for implemented actions | `logic/actions.ts`, `server/api/actions.ts`, `server/ShadowdarkAdapter.ts`, `ui/SpellsTab.tsx`, `ui/components/ResourceDetailModal.tsx` | `PlayerSD.castSpell/useAbility/usePotion`, `NpcSD.castSpell`, `_getSpellcastingAbility` | BD SD01-08 and C4 (spell loss, scroll, wand break, limited uses, potion, replay); NA attack modes (Melee/Thrown and Versatile grips labelled distinctly, shield blocks the two-handed grip, server refuses absent modes): 6 red on the pre-fix logic → green; sheets omit unavailable modes while the card explains them (red without the filter) | Luck spend, rest/recovery, ammunition and damage auto-roll are not implemented; each is explicit. |
| SD01-09 | Fixed (offline) | `server/api/spells.ts`, `server/api/level-up.ts`, `server/api/level-up-engine.ts`, `server/importer.ts`, `server/api/import.ts`, `ui/components/ShadowdarkImportForm.tsx`, `ui/tools/Generator.tsx`, `utils/TableService.ts`, `utils/Sanitizer.ts` | Native class spell lists, item types | BD learn rejects non-Spell, level-up ignores client class objects, import needs confirmation | Extra-spell tier is not limited (no native rule found). |
| SD01-10 | Fixed (offline) | `logic/prepared-view.ts`, `logic/rules.ts`, `ui/*Tab.tsx`, `ui/ShadowdarkPaperSheet.tsx`, `ui/sheet-utils.ts` | — | NA paper/advanced render the prepared rows | `computed` remains an alias of `derived`, not a second computation. |
| SD01-11 | Fixed (offline) | `logic/prepared-view.ts`, `logic/effects.ts`, `ui/EffectsTab.tsx`, `ui/InventoryComponents.tsx` | Foundry `allApplicableEffects` | NA `_id`-only item id and Actor-only effect; BD same id on Actor and Item listed once each | — |
| SD01-12 | Fixed (offline) | `ui/context/ShadowdarkActorContext.tsx`, `ui/pages/ActorPage.tsx`, `ui/InventoryTab.tsx` | — | BR debounced edits, Actor switch cancels pending write, failed delete rollback | Reconnect/world switch with a live host is untested. |
| SD01-13 | Fixed (offline) | `logic/description.ts`, `logic/resource-cards.ts`, UI HTML sinks | SDK `processHtmlContent` | BD cards omit alternate identification; description sanitized without rewriting source | — |
| SD01-14 | Fixed (offline) | `ui/ShadowdarkPaperSheet.tsx`, `ui/components/LuckControl.tsx`, `ui/components/ResourceDetailModal.tsx` | — | BR 8 attack rows, spell → card → Cast, keyboard; item cards keep equip/stash/light/quantity (`ui/components/ItemStateControls.tsx`, `logic/inventory-controls.ts`; red: BR "card keeps Unequip" on the pre-fix card) | Current UI shows only the assumed standard token; actual world mode is unavailable (RV-05). |
| SD01-15 | Partially verified | `ui/ShadowdarkSheet.tsx`, `ui/components/ModuleDialog.tsx`, tabs/modals | — | BR all tabs at 360/390/768/1280, short height, 200% zoom | Core HUD/tray/safe-area overlap not rendered offline (Core-owned). |
| SD01-16 | Fixed (offline) | `info.json` (`shadowdark.monsters`), `server/api/bestiary.ts`, `server/api/collections.ts`, `ui/tools/Bestiary.tsx`, `module/ui.tsx` | Native `monsters` pack metadata | BD GM-only compendium list, NPC card fields; BR bestiary | Compendium monsters are GM-only (no pack ownership in the SDK). |
| SD01-17 | Fixed (offline) | `tests/native-alignment.test.ts`, `tests/boundaries.test.ts`, `tests/fixtures/native-406.ts`, updated `tests/weapon-rules.test.ts`, `tests/fixtures/weapon-cases.ts`, `tests/prepared-actor.test.ts`, `tests/presentation.test.ts`, `.github/workflows/ci-shadowdark.yaml` | Native pack source oracle | NA 9/30 on unchanged code → 30/30 | Fixture totals are not native parity. |

### External dependencies and blocked cases

- **SD01-05 (Core).** `ActorService` replaces every string that *starts with*
  `Compendium.` and matches a declared pack index entry with that entry's name,
  recursively over the Actor detail response. Module views avoid it by carrying
  structured references. Still affected in the client: `system.class`,
  `ancestry`, `background`, `deity`, `patron`, `languages[]`; item
  `system.properties[]`; spell `system.class[]`; scroll `system.spellUuid`; wand
  `system.spells[].uuid`; `flags.core.sourceId` and `_stats.compendiumSource`.
  Embedded `@UUID[...]` enrichers in descriptions are not affected. Consequence:
  sheet editors send diff patches and never echo those fields; server actions
  re-read source through the caller. Client-side identity comparison of these raw
  fields (part of A01-06) is blocked. Proposed Core fix: stop rewriting source
  fields or add a separate label map, after a consumer inventory.
- **System settings (SDK contract).** `shadowdark.usePulpMode` and
  `shadowdark.autoConsumeAmmunition` cannot be read by modules; see the research
  note below. Until then the module uses the native defaults through one seam
  (`logic/world-settings.ts`): luck shows the standard token only (Pulp off), and
  ammunition is never consumed (stated on the attack).
- **Compendium ownership (SDK contract).** Pack permission configuration is not
  exposed, so compendium monsters are offered to GMs only.
- **Core layout (C8).** HUD, floating tray and safe-area insets were not
  rendered; overlap checks need a host render.

### Effect conformance audit (October 16, 2026)

Trigger: a user saw a character with CON 9 and an "Ability Score Improvement
(Con) +2" stay at 9, and some casters with no casting class.

**Native data.** The pinned 4.0.6 packs use 59 distinct effect keys on effects
their parents actually list. Every one has a known consumer:

| Use | Keys |
| --- | --- |
| Actor data | 15 |
| Roll-key selectors | 37 |
| Choice templates (`REPLACEME`) | 5 |
| Native no-ops | 2 |

- The two native no-ops: `system.roll.dex.advantage` (Stone Skin Advantage on
  Hide) has no native reader, and `system.attributes.ac.all` (Dire Wolf) is
  excluded for armor items.
- The 14 pre-4.0 effects (`system.bonuses.*`, `wis.base`) in the packs are
  orphaned files that their parent items do not list, so Foundry never loads
  them.
- The module's roll-key bases equal native's 18 `_getActiveEffectKeys` bases
  exactly.
- A representative native effect for each family gave native-expected results in
  both serialized shapes: abilities, AC (armor/mastery/unarmored/value), HP,
  slots, attack/damage/critical/die upgrade/extra dice, advantage, stat, spell,
  initiative, spellcasting fields and `system.bonus.*` formula data.

**Root cause of the reports.** SheetDelver 0.9.4 and earlier kept a hand-written
effect table (`src/data/talent-effects.ts` `SYSTEM_PREDEFINED_EFFECTS`) using
pre-4.0 keys: `system.abilities.<stat>.bonus`, `.base`, and `system.bonuses.*`,
including `system.bonuses.spellcastingClasses`.

- Native's migration (`Update_251001_1`) renames these keys once, at world
  upgrade. Effects written later keep them.
- Native 4.0.6 rejects `system.bonuses.*` and writes `.bonus` to an unused field.
  So those characters lose the bonus in Foundry too: CON stays 9, and the caster
  class is never granted.
- SheetDelver silently wrote `.bonus` keys to an unused field, with no
  diagnostic.

**Changes.**

- `logic/legacy-effect-keys.ts` ports native's migration table. Preparation
  reports each pre-4.0 change on the effect itself (Effects tab), naming its
  native 4.0 equivalent, and does not apply it.
- The legacy table was removed. The Registry and `custom-maps` now serve the
  generated native predefined effects; the `actor-enricher` import was dead.
- Effect-granted languages are shown as granted (`identity.grantedLanguages`)
  without being written back.
- Level-up HP rolls apply `system.roll.hp.advantage` (native LevelUpSD and
  `applyAdvantage`, giving `2dNkh`).
- Two importer talent mappings pointed at documents that do not exist in 4.0.6
  ("+1 Ranged Damage", "HP Advantage"). They were removed, so those bonuses now
  show as unresolved.

**Guardrail.** `src/tests/effect-conformance.test.ts` (83 cases, in CI) and
`logic/effect-key-coverage.ts`:

- Every snapshot key (`tests/fixtures/native-406-effect-keys.json`) must have a
  consumer.
- With the native reference present, the snapshot, roll-key bases, predefined
  effects and importer mappings are re-derived from native source and compared.
- Representative effects run against hand-derived native oracles.
- Keys the module writes must be native 4.0 keys.

Red: a copy with the fixes reverted fails 11 of 81 cases (pre-4.0 reporting,
granted languages, HP advantage). Green: 83/83.

**Open decision.** Existing characters with pre-4.0 keys still show the
unmodified value; this matches native Foundry, which ignores those keys too. The
user wants these migrated automatically, without player involvement. A pure
planner (`logic/effect-key-migration.ts`) and a caller-bound route
(`server/api/migrations.ts`, with `ui/hooks/useDataMigrations.ts`) are
prototyped but not wired into any page. The platform-level approach is written
up in the [Core/SDK proposal](2026-10-16-core-sdk-world-data-proposal.md).
(Later: the route and hook were removed in the
[module correction pass](#module-correction-pass--october-16-2026); the planner remains.)

### Research note: world settings are not readable by modules (open)

*Resolved by Core v0.19.0 and G8-A (October 16): the module now declares and reads both settings through Core's world context; see [G8 adoption evidence](#g8-adoption-evidence--october-16-2026). The note below is the historical analysis.*

Recorded October 16, 2026 for later research; no Core change was made or proposed
as part of this module work. Verified against Core `ff65695` and native 4.0.6.

**What the module needs.** Native `src/settings.mjs` registers both settings with
`scope: "world"`: `shadowdark.usePulpMode` (default `false`; Pulp luck uses
`luck.remaining` instead of the `luck.available` token) and
`shadowdark.autoConsumeAmmunition` (default `true`). Other systems have similar
world-level rule switches, so the gap is not Shadowdark-specific.

**What Core has today.**

- `src/server/core/documents/primary/settings/SettingStore.ts` mirrors Foundry
  Setting documents (bootstrap plus `modifyDocument` updates). Its ownership is
  GM-only, no route exposes it, and a privileged `getValueByKey` is used
  internally.
- That store was wired in Core ADR-0028 Phase 7 (settings slice, July 5, 2026)
  for one internal need: combat progression reading
  `core.combatTrackerConfig.skipDefeated`.
- Module document services list Setting among types intentionally absent
  (`src/server/shared/utils/moduleDocumentServices.ts`).
- The only SDK settings API is `useModuleSettings`: per-browser localStorage for a
  module's own options, not Foundry world data.

**Why it is probably GM-only (inference, not a recorded decision).** The store was
added for an internal consumer, so the safest default was chosen. Setting rows hold
every package's world configuration, and Core has no classification of which keys
are safe to share; other modules may keep URLs or tokens there. To verify: whether
Foundry v14 delivers world-scoped settings to every connected client (if it does,
player-visible world settings are not a Foundry-level secret, though an allowlist
would still be prudent).

**Details any fix must handle.**

- Foundry stores only changed values, so an untouched setting has no Setting row.
  Core cannot see system registrations, so the reader needs the declared default.
- Client-scoped settings live in each browser's storage, not the world, and remain
  out of reach.
- Values must follow live changes and reset on world switch.

**Generic fix sketch (for research; nothing here is specific to Shadowdark).**

- Modules declare readable world settings in `info.json`, each with key, type and
  default.
- Core allows only keys in the module's own system namespace (`<systemId>.*`),
  plus at most a curated `core.*` list.
- A read-only `req.runtime.settings.get(key)` on the server and a
  `useWorldSetting(key)` hook on the client return the stored value or the
  declared default, with live updates from the existing Setting events.
- This would be an additive module-api minor contract.
- Tests: undeclared or foreign keys are denied, defaults apply, updates propagate,
  and a world switch resets values.

**Rejected stopgaps.**

- A per-browser module setting: not the world's truth, and each user would have
  to set it.
- Inferring the mode from Actor data.
- Private Core imports or a direct Foundry transport.

**Proposal.** See the [Core/SDK world data proposal](2026-10-16-core-sdk-world-data-proposal.md)
(contract A).

**Module seam.** `src/logic/world-settings.ts` returns `{ value, source:
'native-default' }`. Its consumers are `ui/components/LuckControl.tsx` (Pulp number
input versus standard tick box, neither labelled) and the ammunition diagnostic in
`logic/actions.ts`. A future contract would replace this one function.

### Field and action coverage inventory

| Native source (4.0.6) | Preparation owner | Consumers | Status | Diagnostic when unavailable | Test |
| --- | --- | --- | --- | --- | --- |
| Effects: `system.changes` / legacy `changes`, type/mode, phase, priority, disabled, transfer, situational, suppression | `logic/effects.ts` | preparation, roll keys, Effects tab, editor | Supported; duration expiry and custom types not applied | Effect diagnostics list | NA, BD |
| Player abilities `base`/`value`, bounded mod | `actor-preparation.ts` | sheets, actions, combat suggestions | Supported | — | NA |
| NPC explicit `mod`, AC | `actor-preparation.ts` | NPC sheet, cards | Supported | — | NA |
| HP `base`/`max`/`value`, level, XP | `actor-preparation.ts` | sheets | Supported | Formula failure diagnostic | NA |
| AC: armor base/attribute/modifier, best + bonus armor, `system.attributes.ac.*` effects | `actor-preparation.ts` | sheets, combat | Supported | — | NA |
| Gear slots: 10 + effects + STR bonus, per-item usage, free carry, stashed | `actor-preparation.ts` | Inventory, paper | Supported | — | NA |
| Roll keys `system.roll.*` (stat/melee/ranged/attack/spell/initiative, `.bonus`/`.damage`/`.advantage`) | `roll-keys.ts` | actions, dialog defaults, server | Supported; situational shown, not selectable | Unresolved value diagnostic | NA, BD |
| Weapon damage 1h/2h, properties, thrown, NPC Attack | `weapon-rules.ts`, `actions.ts` | sheets, cards, server | Supported | "Damage unavailable" + field | weapon suite, NA |
| Spellcasting classes, spell ability, tier, lost | `actor-preparation.ts`, `actions.ts` | Spells tab, paper, cards, server | Supported | Unavailable reason | BD |
| Scroll / wand (per spell) / NPC spell | `actions.ts` | Spells tab, cards, server | Supported with consequences | Unavailable reason | BD |
| Class Ability uses, lose on failure | `actions.ts` | Talents and Abilities tabs, cards, server | Supported | — | BD |
| Potion use | `actions.ts` | item card (from Inventory), server | Supported (confirmation, no roll) | — | BD |
| Luck `available` / `remaining`, `usePulpMode` setting | sheet editing only | paper, Abilities | Edit only; setting unreadable | None in the UI by user decision (no label); recorded in code and docs | NA |
| `autoConsumeAmmunition` setting | — | attacks | Not supported | Attack diagnostic | BD |
| Rest / recovery, damage auto-roll | — | — | Not supported | Not offered | — |
| Light source active | Inventory toggle | Inventory | State only; no scene light/timer (DW-04) | Tooltip | — |
| Identification | `resource-cards.ts` | cards, inventory | Current identified presentation only | "Unidentified" label | BD |
| Predefined effects, mastery choices | `data/native-predefined-effects.ts`, `talent-choices.ts` | editor, level-up, generator, importer | Supported; 2 native entries refused | Reason text | BD |
| Monsters pack, world NPCs | `server/api/bestiary.ts` | Bestiary tool | Read-only; compendium GM-only | Visible notice | BD, BR |

### Isolated browser evidence (BR)

A local, ignored harness rendered the actual module components (both layouts,
cards, editors, bestiary) in headless Chrome with the network blocked, Core's
module Tailwind build and stubbed SDK services; it is a development tool, not a
dependency. 38 checks passed: at 360×740, 390×844, 768×1024, 1280×800 and
1280×500, paper shows all 8 attack rows with `+0 d8+1` and no horizontal
overflow; paper spell → card is a named modal with contained focus, Escape and
focus return; Cast opens the host roll dialog above an inert card, cancel restores
it and one action request is sent with a request ID; linked `@UUID` opens a
document card with Back; every advanced tab (including the overflow menu) has
no overflow and no unnamed control; a thrown weapon's card shows distinct
**Melee attack** / **Thrown attack** actions and measures 384×384 at tablet and
desktop sizes (full width on phones); weapon cards offer Unequip and Stash
(Stash sends the native `{ stashed: true, equipped: false }` write) and a lit
Torch card offers Put out and quantity but no Equip. Also: per-spell wand rows with lost reasons,
multi-change effect editing with no-op save, debounced HP edits and pending-write
cancellation on Actor switch, failed delete rollback with an error, NPC sheet,
bestiary disambiguation and keyboard-opened NPC card at 360/1280, and 200% zoom
of 1280×800 (640×400 CSS viewport) for both layouts. Fixes found by the run:
narrow-screen inventory column headers overflowed (now hidden below `sm`), and
coin, HP and XP inputs lacked accessible names. A user report then showed the
resource dialog passed `inert=""`, which React 19 treats as false; it now passes
a boolean, and the run asserts the attribute, unfocusable card controls under
the roll dialog and an empty React console-error log. Not covered: the real Core HUD,
tray and safe areas; observer/GM role variants; very large lists.

### Verification commands run

All nine module suites pass (`weapon-rules`, `prepared-actor`, `actor-enricher`,
`presentation`, `roll-feedback`, `importer-mapping`, `native-alignment` 44/44, `effect-conformance` 83/83,
`boundaries` 42/42). Explicit module TypeScript check: clean. `npm run module:check
-- shadowdark`: passed. Packaging into an isolated data directory: 9 entries
(`LICENSE`, `README.md`, `info.json`, compiled `dist/` entries and scoped CSS),
no tests or local files. The boundaries suite's native pack oracle reads
`temp/shadowdark/data/packs` from the Core checkout and reports itself as
skipped when that reference is absent (as in CI).


## Independent review addendum — October 16, 2026

### Scope, baseline and independently repeated evidence

Review requested after checkpoint `33ed227` on `fix/adr-0001-native-alignment`,
module 0.9.4. Core is `ff65695` / 0.18.1. An uncommitted user-review addendum
already existed in ADR-0001; it was preserved. This review changes documentation
only. No source fixes, world writes, native acceptance, release or Git mutation
were performed. Earlier "uncommitted implementation" statements describe the
pre-checkpoint report, not the current code baseline.

Native reference remains clean at `release-4.0.6`,
`9677d16b3903b3b640f00d4efd48249142ac8334`. Local Foundry 14.367 client settings
source was inspected; this is not a connected-world observation.

Independently repeated on the checkpoint source:

- All **nine** tracked suites pass: weapon-rules, prepared-actor, actor-enricher,
  presentation, roll-feedback, importer-mapping, native-alignment **44/44**,
  boundaries **42/42**, effect-conformance **83/83**. Native-reference drift
  checks ran with the reference present. The earlier "eight" count was a typo.
- Explicit module TypeScript check passes, with module `src/` and `module/`
  included, `noEmit` and no incremental output. A root-only check excludes modules.
- The existing isolated browser harness passes **38** checks. Network was blocked;
  no Core/Foundry service was started. Actual module components are rendered, but
  host dialogs, SDK services and Actor HTTP projection are stubs/simulations.
- Visual inspection of the paper phone sheet confirms the Prim-like Longsword
  `+0 d8+1` row. Inspection of the short-height spell card exposed RV-04 despite
  all 38 checks passing. Existing assertions do not cover every displayed fact.
- Four additional synthetic probes establish RV-01–04 below. The migration
  pagination probe uses Core's actual in-memory document list implementation.
  No real private document or live permission boundary was probed.

Scratch evidence: `/tmp/sd-review-20261016/` holds named suite logs, `typecheck.log`,
`browser.log`, `browser/report.txt`, screenshots and `probes.ts`, `pagination.ts`,
`card.ts` with their logs. These are optional local artifacts; the reproducible
inputs and outcomes below are the durable evidence. Packaging, released-host CI
and native/operator tests were **not** repeated in this review; their previous
reported results remain historical evidence, not new verification.

### Validated implementation and corrected dispositions

| Area | Independently supported result | Remaining gate |
| --- | --- | --- |
| C0/C1 effects; SD01-01/02/11 | Nested v14/legacy effect reading, source-preserving metadata/owner references, mastery counts and representative typed changes pass tracked cases. | Unsupported phase/custom/duration behavior remains explicit; migrations have separate defects (RV-02). |
| C2/C3 shared rules; SD01-03/04/10 | Player/NPC distinctions, HP/AC/slots, authoritative weapon dice and shared action rows pass representative fixtures. | Not complete native parity; card facts still bypass prepared labels (RV-04). |
| C1 access; SD01-06/07 | Caller-bound world/embedded reads and exact identity tests pass. | Reopen external compendium route coverage: RV-01. Registry attach guards do not establish same-world recovery freshness: RV-06. |
| C4/C5 actions and creation; SD01-08/09 | Supported spell/scroll/wand/ability/potion consequences, validation and cancellation cases pass. | Replay authorization/reconciliation remains defective (RV-03); settings and explicitly unsupported actions remain open. |
| C6/C7 sheets/cards/bestiary; SD01-12/13/14/16 | Shared views, inventory controls, HTML/identification selection and usable spell/item/NPC card flows exist. | Broad fixed labels are qualified by RV-01/03/04/05; basic module browser passes do not establish host permission/lifecycle parity. |
| C8/C9; SD01-15/17 | Nine suites, explicit typing and 38 isolated interactions repeated. | Real Core HTTP/projection/dialog/chrome, permission revocation/recovery and A01-01–10 native acceptance remain pending. |
| C10 | Module documentation and handoff exist and are updated. | ADR stays open; no blanket closeout or release-ready claim. |

### RV-01 — Generic document access bypasses the monster restriction (P1, module)

`src/server/api/bestiary.ts` and `collections.ts` require GM for compendium
monsters, but `document.ts` delegates to
`ShadowdarkAdapter.resolveDocumentFor`, whose compendium branch calls the shared
registry without a caller check. The generic index also needs the same policy
inventory; hydration does not establish caller permission.

Synthetic probe: a non-GM request for
`Compendium.shadowdark.monsters.Actor.fixture-monster`, with a fake registry
returning a synthetic NPC, receives **200** through `document/[uuid]` and **403**
through `bestiary/[uuid]`. Only the resolver was stubbed; both route handlers and
the adapter dispatch path were real. This establishes inconsistent route policy,
not a claim that live restricted content was accessed.

**Correction:** centralize caller-aware serving of every compendium document,
collection, index and linked card. Until Core provides generalized native pack
access, enforce the existing conservative monster policy consistently. Once the
Core capability exists, use it across all routes rather than keeping a parallel
GM-only policy. Do not fix only the visible bestiary button. Add direct generic
UUID/index tests, privileged-read-then-denied tests and post-change invalidation.
SD01-06/16 are partial until this gate passes.

### RV-02 — Registered migration prototype violates current SDK contracts (P1, module)

`src/server/index.ts` registers `migrations/effect-keys`. The UI hook is unused,
but **the server endpoint is reachable through module routing**; it is not inert
code merely because no page invokes it.

Confirmed failures in `src/server/api/migrations.ts`:

1. `markerKey` produces `migrations/shadowdark-4.0-effect-keys/<worldId>`.
   Core `createModuleRuntime.validateDataStoreKey` rejects `/`. Calling the real
   handler with its GET marker lookup and Core's real validator returns **400**,
   `DataStore key must be a flat logical name`. The GM POST marker lookup fails
   before scanning as well.
2. `listAll` starts `page=1`. Core `moduleDocumentServices.applyQuery` uses zero-based
   pages (`slice(page * pageSize, ...)`). With one synthetic eligible Actor in the
   real in-memory ActorStore and a deliberately permissive fake marker store to
   isolate this second defect, page 0 returns one Actor; the route processes **0**,
   writes **0**, and records completion. Worlds of 100 or fewer records are skipped;
   larger collections lose their first 100 records of each type.
3. Scope derives from caller-supplied `worldId`; DataStore has no trusted world
   namespace. GET lacks an explicit GM gate (normally masked by the invalid key).
   The route has no lease/concurrency fencing and marks runs with unresolved keys
   complete when writes did not fail. These are static findings, not live probes.
4. `effect-conformance.test.ts` covers the native replacement table and writer
   keys but does **not import/call `planEffectMigration`** or the migration route.
   The secondary proposal/handoff statement that the planner is covered by that
   suite overstates the evidence. Add planner/serializer round-trip, idempotency,
   unknown metadata, multi-replacement, unresolved and route enumeration tests.

**Correction:** retire/unregister the interim route when adopting the Core runner,
or correct and explicitly test all of its existing contracts before retaining it.
Do not wire the hook as a shortcut. Core infrastructure is a genuine missing
capability, but these defects are module bugs, not permissions limitations.

### RV-03 — Action replay bypasses current authorization and request identity (P1, module)

`src/server/api/actions.ts` stores process-global results under
`userId:actorId:requestId`; `remember` returns a cached promise before `execute`
re-reads owner access. The key lacks world/epoch and request-body identity, and is
not cleared by adapter teardown. Failed promises are all evicted despite the
comment saying only pre-roll failures may retry.

Synthetic potion probe: first request returns **200**, with one owner read and
one consumption write. After the same runtime denies ownership, replay returns
**200**, still only one read. Changing `itemId` while reusing the request ID also
returns **200** with no new read. Thus a reused request can disclose stale results
or claim success for a different action. Cross-world collision and retry after a
post-roll/chat error are additional static risks; they were not exercised live.

**Correction:** verify current subject/world/resource access on every response,
including replay; bind cache entries to lifecycle and canonical request identity;
reject a different request body under an existing key. Separate pre-roll failure,
roll-completed, writes-partial and reconciled result states. Do not reroll because
chat/transport failed after evaluation. Re-read/reconcile partial writes without
double consumption. Core's proposed context identity helps lifecycle scoping but
permission rechecks and payload validation can be fixed in the module now.
C4/C6/SD01-08/12 remain partial.

### RV-04 — Spell cards discard an available prepared class label (P2, module)

The reviewed screenshot `browser/card-spell-1280x500.png` says **Unavailable
class** for the Wizard fixture. `resource-cards.ts#spellFacts` reparses
`item.system.class` after Core replaced its UUID strings with names, even though
`prepareShadowdarkView` already preserved `derived.items[].spellClasses` as
structured references with labels.

Synthetic probe using the existing `hostActorProjection` simulator: card Class
is **Wizard** before projection and **Unavailable class** afterward; the same
projected prepared item still holds `spellClasses[0].label = "Wizard"` and the
exact structured compendium reference. This confirms a module consumer defect
in addition to the real Core UUID rewrite.

**Correction:** build owned-card class facts from the prepared item view; keep
preview-document preparation in its appropriate shared projection path. Add
assertions for every requested card fact through the host projection, including
multiple classes and unavailable source. No name-to-UUID guessing is needed.
SD01-05/10 and C2/C7 are not fully fixed by the current structured-reference work.

### RV-05 — Native defaults are presented as current world mode (P1 dependency; module presentation correction)

`world-settings.ts` always returns the registered defaults. `LuckControl` takes
only `.value`, ignoring `source`, and offers edits to `luck.available` while the
actual world may be in Pulp mode. The displayed checkbox has no explanation of
that missing authority. A proven schema default is valid only for an absent
setting in a ready world snapshot, not for an unreadable world.

**Correction:** adopt Core's declared setting snapshot and distinguish stored,
proven-default and unavailable results. Until available, visibly label/disable
affected mode-specific controls rather than presenting standard mode as verified.
*(Superseded October 16 by user decision: no visible label in either mode; Pulp off shows only the tick box; Pulp on shows only a number input, with −/+ spinner buttons where there is space (not in the paper sheet's compact box). The interim labelling
is not applied; see the module correction pass.)*
Keep ammunition unsupported until both setting and consequence behavior are
implemented; exposing the setting alone does not implement consumption. The
secondary proposal's statement that one function replacement completes adoption
is too narrow: UI, preparation, actions, context revisions and tests all need it.

### RV-06 — Attach reset is not same-world recovery invalidation (P1 integration gap)

`Registry.attach` clears cached rows and guards old attachment loads. However,
Core `WorldBootstrapper.runRecovery` refreshes pack rows and rebuilds prepared
Actors without `adapter.initialize`; the existing registry stays attached and
retains its projection/TTL. Synchronous `getCachedSystemData/getCachedDocument`
do not refresh it. A later collection read may refresh only the registry, leaving
already-prepared Actors on different reference data.

This is a source-verified lifecycle gap, not a freshly executed live reconnect
failure. Add a Core-owned pack/context revision notification and a module refresh
barrier before prepared rebuild. Test same-world recovery, dependency-only change,
stale work and disposal; do not claim `attach` tests cover these paths. Module
review of its `reset` generation fencing is also needed if reset becomes public
refresh behavior. C1/C2/C6 remain partial for this case.

### RV-07 — Evidence and handoff claims need narrower wording (documentation)

The suites use fake request runtimes and a replica of ActorService UUID rewriting;
the browser harness uses stub host dialogs and SDK. Neither runs the full real
Core source → prepared Store → HTTP → UI → action pipeline. Preserve their useful
coverage, but describe it as simulation. All A01 native cases remain pending.
Migration planner coverage was overstated (RV-02); "eight" suites was corrected
above; the prior handoff mixed committed/uncommitted and pushed/not-rechecked
statements. The current handoff must report known local state and user-reported
remote state separately. No new native acceptance, publication or release claim
is made by this review.

### Corrective checkpoints after review

- [x] M1: close RV-01 across every module route; RV-03 replay reauthorization,
      request identity and partial-result tests. Existing green suites must remain green.
      *(Offline, [module correction pass](#module-correction-pass--october-16-2026).)*
- [x] M2: fix RV-04 using prepared card facts; make unavailable setting behavior
      explicit (RV-05). Assert semantic labels, not only geometry/click success.
      *(RV-04 done offline; RV-05 presentation decided by the user, see the correction pass.)*
- [x] M3: remove or correctly quarantine/test the registered migration prototype;
      add direct pure planner/serializer coverage (RV-02) before Core adoption.
      *(Route and hook removed; planner/serializer cases EC-5.)*
- [x] M4: adopt separately implemented Core context/settings, permissions and
      migration contracts; prove RV-06 refresh semantics with real host integration.
      *(Met October 17 with an isolated real Core 0.19.1 process, see the
      [Core 0.19.1 adoption evidence](#core-0191-adoption-evidence--october-17-2026);
      native confirmation is part of M5.)*
      *(Partly met, [G8 adoption evidence](#g8-adoption-evidence--october-16-2026):
      settings, refresh and permissions adopted and verified against Core v0.19.0
      code offline; migration catalog staged inactive (CG-1); Core's real recovery
      lifecycle not exercised.)*
- [ ] M5: run actual host-boundary and approved native/operator acceptance;
      reconcile SD01/C/A01 dispositions without converting pending work into passed.
      *(Isolated host boundary done October 17; native/operator acceptance not run.)*

Core follow-up is proposed as **Core ADR-0064, Module World Context and Data
Migrations**. That proposal extends existing stores/transport; it does not remove
module-local correction obligations above. This review does not implement either
repository's corrections or authorize migrations against any world.

### Migration ownership follow-up — October 16, 2026

Core ADR-0064 now proposes migration through the **admin release upgrade job**,
with a required running-world preview and a durable maintenance/restart boundary.
This replaces standing automatic-bootstrap repair proposals. The module supplies
versioned pure plans, receives no privileged write runtime, and retires its caller
migration route/hook upon adoption. Ordinary startup assesses compatibility or
resumes an approved Core job only. M3's immediate quarantine/removal and direct
planner tests remain necessary; M4 adopts the final packaged planner/metadata
contract after Core implements it. See the [secondary report's ownership revision](2026-10-16-core-sdk-world-data-proposal.md#admin-upgrade-ownership-revision--october-16-2026).
No RV finding or native acceptance has been closed by this design change.

Catalog refinement: M4 adopts a separate migration.json with version-directory
definitions and check/plan/verify hooks, not migration fields in info.json. Add
restored-data fixtures proving required checks detect old source despite completed
journal markers and block host world readiness until admin maintenance. Current
Core proposal excludes native lockout and world backup/undo implementation; admin
acknowledges the limitation and is advised to back up using Foundry. M3 planner/
serializer regressions and all RV findings remain pending.

## Module correction pass — October 16, 2026

The user selected the module-only review corrections (no Core/SDK change) on
`fix/adr-0001-native-alignment`, after docs commit `d7e01ba`. Each new case was
first run against the unchanged source and failed (14 of 14 in boundaries and
native-alignment; the EC-5 route case and a planner case in effect-conformance),
then passed after the change. Offline evidence only; no Core, Foundry, world or
native acceptance run.

| Finding | Change | Evidence | Status |
| --- | --- | --- | --- |
| RV-01 | `server/access.ts` holds one caller policy (monster pack GM-only until Core exposes pack capabilities). `resolveDocumentFor` takes the caller and refuses restricted packs with `permission_denied`; system-level `resolveDocument`/`getCollection` never serve them; the `index` name index omits monster names for players; bestiary, collections, document, spells, actions and level-up routes all use it. Level-up routes now return SDK error codes instead of 500. | Boundaries RV-01 × 5: player 403 / GM 200 through `document/[uuid]` using the review's synthetic UUID; GM-then-player sequence; index filtering; collection and system-level reads; spell learning with a monster UUID returns 403 without the name (before, it read the monster through the unrestricted resolver). SD01-16 bestiary case now runs the real policy. | Fixed (offline) |
| RV-02 | Route `migrations/effect-keys`, `server/api/migrations.ts`, `ui/hooks/useDataMigrations.ts` and `derived.pendingMigrations` removed. Planner kept; it no longer writes `priority: null` onto untouched changes that had no priority (found by the new direct case). Marker constants removed. | EC-5 × 6: legacy and Foundry 14 shapes, multi-change replacement order and phase, unknown fields, idempotency, unresolved keys, `.this` scope, no `migrations*` route registered. | Fixed (module part); runner awaits Core ADR-0064 |
| RV-03 | Replay key includes the adapter runtime generation (incremented on each `initialize`), user, Actor and request id; the body fingerprint must match (else 409). Every replay re-reads the Actor with owner access first. A result exists once the roll is evaluated: later chat failures become `warnings`; a `partial` replay applies only consequences the re-read Actor does not show. Failures before a result remain retryable. The sheet shows warnings. | Boundaries RV-03 × 6: revoked owner → 403 with no disclosure (the review's potion probe); changed `itemId` → 409; identical replay `replayed: true` with one roll; manual-roll chat failure keeps the result and the `lost` write; partial ability result consumes the use once and retries only `lost`; a new runtime does not replay. | Fixed (offline) |
| RV-04 | Owned and NPC spell cards take Class from the prepared item view's `spellClasses` labels; previews of unprojected documents still resolve their own references. | Native-alignment RV-04 × 3 through `hostActorProjection`: Wizard after projection; two classes in order; unavailable class stays explicit; full fact list. Browser `card-spell-1280x500` shows Class Wizard. | Fixed (offline) |
| RV-05 | User decision replaces the review's interim labelling/disabling: no visible label in either mode; Pulp off shows only the tick box; Pulp on shows only a number input, with −/+ spinner buttons where there is space (not in the paper sheet's compact box). `LuckControl` Pulp mode is now a number input (was a −/count/+ stepper everywhere). The unverified setting stays in code (`source: 'native-default'`) and documentation. | Native-alignment C8 luck cases: tick box only, no label; Pulp input plus spinner; compact input only (red before the input change). | Presentation done; reading the setting awaits Core (M4) |
| RV-06 | Not changed; needs Core's context revision notification. | — | Open (Core) |
| RV-07 | Documentation: this section states offline scope; the ADR and architecture describe the corrections without claiming host integration. | — | Ongoing |

Verification after the change: weapon-rules, prepared-actor, actor-enricher,
presentation, roll-feedback and importer-mapping exit 0; native-alignment
**47/47**, boundaries **53/53**, effect-conformance **89/89** (native reference
present; 48/48 after the luck input change). Explicit module TypeScript check and `module:check` pass. The isolated
browser harness passes **38** checks with stubbed host services. Still pending:
real Core HTTP/runtime integration, native/operator A01-01–10, reading the
actual Pulp setting (RV-05), RV-06 and Core ADR-0064 adoption (M4/M5).

## G8 adoption evidence — October 16, 2026

Implementation of [ADR-0001 G8](../adr/0001-native-alignment-and-resource-cards.md#g8-implementation--october-16-2026)
on `fix/adr-0001-native-alignment` (from `af24b8e`, uncommitted) against Core
v0.19.0 (`2f71597`) and native `release-4.0.6` (`9677d16b`, every 4.0.0–4.0.6 tag
inspected for the two settings, `Update_251001_1` and spell names: identical).
No Foundry, live world, production configuration or Core edit was used. Core's
working tree stayed clean.

### Tracked module suites (module offline)

| Suite | Result | New or changed cases |
| --- | --- | --- |
| weapon-rules, prepared-actor, actor-enricher, roll-feedback, importer-mapping | exit 0 | Weapon-rules level-up assembly passes a caller with Core-shaped capabilities. |
| presentation | exit 0 | Compatibility floors, unchanged roll range, no `sdkVersion`, both world-setting declarations. |
| native-alignment | **51/51** | Luck from world context (stored/default/stored false/unavailable), unlabelled controls, placeholder, live false → true → false in both sheets; Core 0.19.0 response replica keeps UUIDs and shows labels. |
| boundaries | **53/53** | RV-01 and SD01-16 now driven by Core-shaped `access`: restricted monsters, a runtime without capabilities denied (even for a GM session), unfiltered rows rechecked. |
| effect-conformance | **89/89** | EC-5 order follows native (Weapon Mastery damage change appended). |
| world-adoption (new) | **12/12** | Rule inputs; ammunition statement without writes; ruleInputs revision and re-preparation; caller-built system data; GM-warmed then player; any-pack revocation; revocation during an awaited read; no-capability denial; refresh on pack change/recovery only; stale load cannot publish; failed refresh rejects; luck route per mode with 409 for stale/unknown; replay after a context change returns without rolling. |
| migration-hooks (new) | **15/15** | No-op; v13 and v14 shapes; unknown fields, priorities, phases; `.this`; appended mastery change; NPC Actor-level out of scope; NPC-owned Item in scope; delta base type and inherited Item type; partial delta not filled; spell slug, 0.9.4 name and blocking value; missing parent blocks; mixed shape; isolated bundles without host globals equal direct results; catalog schema; staged inactive; spell slugs equal the native pack. |

The new suites were written after the code. Each guarded line was then removed
in turn and the suite rerun: no post-read recheck, no row recheck in
`getSystemDataForUser`, no-op context hook, refresh without a generation bump, an
allow-all fallback without `access`, and no luck mode check each made at least
one case fail (the revocation-during-read case first passed vacuously and was
corrected to revoke inside the read).

Module TypeScript (explicit include, Core root config) passes. `module:check`
passes on an isolated copy (123 files scanned, import boundary clean). Isolated
packaging with the v0.19.0 toolchain produces `shadowdark-0.9.4.tgz` with a
`sheet-delver-release.v1` manifest carrying the new floors and world settings and
no migration files. The same copy with the catalog moved to its root packages
three `.cjs` hooks and a `sheet-delver-release.v2` manifest with a Core-derived
catalog digest and one step.

### Actual-host offline harness (11/11)

Untracked harness `temp/audit-report/adr0001-host-adoption.ts`, run from the Core
root with an isolated data directory. It calls Core v0.19.0 code directly; only
Core's world-ready signal is stubbed for the system-data route.

| Check | Result |
| --- | --- |
| Core `ModuleWorldContextService` + `SettingStore` with this `info.json` | Registered defaults without rows; both keys projected to a player; stored false → true → false refreshes, `affectsPreparation`, and re-prepares luck `standard → pulp → standard`; invalid stored value and native 4.1.0 are unavailable. |
| Core `ensureInitialized` revision fence | Stale `X-SheetDelver-Context-Revision` → 409 `world-context-changed`; current passes. |
| Core `createModuleRequestRuntime` with native pack policy (v14) | Restricted monsters: player sees Light/Wizard, Assistant and GM all three; GM-warmed document then player 403; collection 403; bestiary `compendiumAvailable: false`; live configuration revoking spells → player 403 with warm caches, Assistant unaffected. |
| Same policy on generation 13 | Player reads no pack, Assistant all (CG-3). |
| Core `/api/system/data` route | Player 200 with the module projection (keys `titles, nameIndex, PREDEFINED_EFFECTS, BOON_TYPES, EFFECT_TRANSLATIONS`); an adapter without the hook → 403 `caller-projection-required`. |
| Core `discoverMigrations` / `packageMigrations` | Source and packaged catalogs valid. |
| Core `planWorldMigrations` + `applyMigrationPatch` + `migrationEnvelope` | Player Actor effect, owned Weapon effect and world Talent effect planned; NPC Actor-level effect and partial delta untouched; tombstone not enumerated; patched sources keep custom fields, priorities and order; envelopes `ActiveEffect` with parents `Actor.pc`, `Actor.pc.Item.sword`, `Item.talent`; second plan current. An unresolvable spell advantage blocks check-only (reason dropped, CG-2). |

### Migration cost (Core planner, check-only, 5 s budget)

| Inventory (synthetic Players) | Effect targets | Actor source | With declared references | Without references (comparison) |
| --- | --- | --- | --- | --- |
| 9 × 8 Items | 36 | 0.14 MB | 303 ms | 32–63 ms |
| 20 × 20 Items | 140 | 0.70 MB | 3.6–3.8 s | — |
| 30 × 30 Items | 300 | 1.5 MB | budget exceeded | 0.5–1.0 s |
| 60 × 40 Items | 720 | 4.0 MB | budget exceeded | 1.7–3.2 s |
| 100 × 40 Items | 1,200 | 6.7 MB | budget exceeded | budget exceeded |

Synthetic, single process, no native latency. These measurements are why the
catalog is staged inactive (ADR CG-1).

### Isolated browser harness (43/43)

`temp/audit-report/adr0001-browser.mjs` now prepares Actors with a Core-shaped
world snapshot. The 38 earlier checks still pass; five new checks (one per
viewport, 360–1280 px) confirm in both layouts: tick box in standard mode, number
input in Pulp mode (spinner on the tabbed layout only), the placeholder when the
setting is unavailable, no overflow, all controls named. Stubbed host services;
not a real Core UI review.

### Still pending

Real Core UI (HUD, tray, dialogs) with this module; Core's real recovery
lifecycle; native v13/v14 acceptance of settings, permissions and A01-01–10;
catalog activation (CG-1) and its native preview/apply/readback.

## Independent G8 verification — October 16, 2026

Baseline: module `fix/adr-0001-native-alignment` at `af24b8e` plus its existing
uncommitted adoption; Core `main`, released v0.19.0 at `2f71597`; native reference
`release-4.0.6` at `9677d16b`. This pass changed documentation only, with isolated
scratch probes and no live Foundry connection. The
[ADR addendum](../adr/0001-native-alignment-and-resource-cards.md#independent-g8-verification--october-16-2026)
owns the remaining checkpoints. Existing code changes were preserved.

### Fresh passing verification and its limits

- All eleven module suites pass: native-alignment 51/51, boundaries 53/53,
  effect-conformance 89/89, world-adoption 12/12, migration-hooks 15/15, and the
  six weapon/preparation/enrichment/presentation/feedback/import suites.
- TypeScript explicitly including module source and migration hooks passes.
  The scratch configuration resolves Core's existing type roots and Next env
  declarations; the first incomplete scratch setup was corrected before this run.
- Module checking and packaging pass in a copied, isolated data directory using
  Core's installed dependencies. The normal staged-catalog package is v1 and
  omits migrations. The separate host harness activates a temporary copy and
  checks compiled `.cjs` hooks/catalog parity; that is different evidence.
- The supplied `temp/audit-report/adr0001-host-adoption.ts` passes 11/11 again.
  It invokes actual Core services and route handlers, not a serving HTTP process
  or `WorldBootstrapper` recovery. Its `/api/system/data` fixture returns the
  expected keys with an empty `nameIndex` because the isolated registry has no
  installed module. Separate synthetic caller-projection cases check populated
  names and permissions. Do not describe this as full host composition or native
  acceptance. Its v13 denial assertion proves current behavior, not correctness.
- A separate isolated Chrome probe mounted the real UI provider with stable
  SDK/event stubs and all network blocked; it reproduced RV-08 below. This did
  not rerun the prior 43-layout-check harness or real Core UI acceptance.

### RV-08 — Context change during initial index load stalls the provider (P1)

Source: `src/ui/context/ShadowdarkUIContext.tsx`, `reset` and the index-fetch
effect. `reset` increments a ref, sets null data and clears collections. If the
index is still null, none of the fetch effect's dependencies changes for a
context event. The response then fails the generation check; no new fetch
replaces it. A collections rerender alone does not restart that effect.

Reproduction: mount connected with stable `fetchWithAuth` and event objects;
hold the first `/api/modules/shadowdark/index` response; emit
`world:contextChanged`; resolve the held response successfully; flush React work.
Observed: `{requests: 1, loading: true, data: null}`. Expected: a replacement
request for the new context and eventual current data or a defined failure.
The existing suites remain green, so add the failing reproduction before fixing
the provider. Also cover user/role changes during loading, old retry retirement
and loaded collection invalidation; those additional cases are required follow-up,
not claimed reproductions from this review.

### Confirmed Core dependencies

**CG-1 / CR64-09 (P1): whole-plan deadline and repeated references.** Fresh
`planWorldMigrations(checkOnly=true)` measurements from the supplied harness:

| Players × embedded Items per Player | Effect targets | Serialized Actor bytes | Time/result |
| --- | --- | --- | --- |
| 9 × 8 | 36 | 138,349 | 308 ms, complete |
| 20 × 20 | 140 | 697,721 | 3,826 ms, complete |
| 30 × 30 | 300 | 1,536,091 | 5,013 ms, computation-budget exception |

All effects in this benchmark already use current keys. There are two Actor
effects and an Item effect on every fourth Item. Timings are machine-dependent
synthetic measurements, not native throughput or a supported capacity boundary.
They prove the present required startup check can fail on already-current data.
Core's global `Date.now() + 5000` deadline is distinct from the per-hook 1 s VM
guard. Each effect receives all requested non-pack Actor/Item/ActorDelta rows,
including repeated embedded data, and is serialized into new VM invocations.
Complete asynchronous computation and bounded dependency input are needed; simply
increasing five seconds or asking the user to accept it does not close adoption.

**World-pack parent dependencies / CR64-10 (P1):** construct a Player Actor
`Compendium.world.review.Actor.pc` with a legacy AC effect. Expanding the real
Core targets and using the current module catalog checks zero pack targets.
Adding `WorldPack` in the scratch catalog visits them, but the effect check
cannot find its parent. Adding exact `reads.packs: ['world.review']` yields one
valid effect operation. Core has the transport and target support; its generic
hook dependency selector is missing. A distributable module cannot know arbitrary
world pack IDs. An ancestor-scoped, digest-bound input must preserve parent type
and partial-delta provenance without passing the whole world to each effect.
Whole-parent `effects`/`items` array writes are not an allowed v0.19.0 fallback.

**CG-2 / CR64-11 (P2):** in that same probe the module hook says:
`The Actor type for Compendium.world.review.Actor.pc.ActiveEffect.e is not available (Compendium.world.review.Actor.pc).`
The Core result becomes only
`shadowdark-effect-keys-4.0: Compendium.world.review.Actor.pc.ActiveEffect.e: source check/plan unavailable`.
Core discards check/plan/verify reasons in its generic catch. Preserve bounded,
sanitized step/target/stage reasons for admin recovery; do not dump document data.

**CG-3 / CR64-12 (P1):** compare Core's `canReadNativePack` /
`canReadCombatActorPack` with local native v13 `CompendiumCollection.getUserLevel`,
`visible` and `testUserPermission` in `temp/foundry-v13.mjs`. Executing the native
role evaluator with `{PLAYER: 'OBSERVER', ASSISTANT: 'OWNER'}` for a role-1 user
returns level 2 (OBSERVER). Core's predicate returns false for that identical
case on generation 13. The generation-14-only branch was reused for general
pack reads, causing a real regression affecting all modules. Do not weaken
Shadowdark access checks or treat empty player collections as native parity.

The user selected a related Core ADR-0064 corrective follow-up after these module
annotations. None of these defects is corrected by this documentation pass.
The unchanged deferrals and native A01 scope stay as recorded; M4 is partial,
M5 open, RV-06 partial and RV-08 open. Scratch paths live only in the handoff;
the reproduction descriptions here remain usable without those files.

Documentation validation: 100 local file/anchor links across the edited Core and
module documents/handoffs resolve; both repositories pass `git diff --check`.
All 130 module source, migration, manifest and workflow files match the scratch
copy used before annotations; this review preserved the implementation.


## Core 0.19.1 status review — October 17, 2026

Confirmed the published release/tag and public SDK versions; inspected current
manifest/workflow pins, provider, catalog, hooks, module architecture and tests.
Reran all eleven module suites under Node22.23.3 against local Core0.19.1; all
pass. Explicit module/migration TypeScript inclusion passes. Native reference
remains `release-4.0.6` / `9677d16b3903b3b640f00d4efd48249142ac8334`.

Confirmed adoption work: RV-08 is still present by source review; root catalog
is absent; hooks still use whole-kind references; world packs are not selected;
compatibility/toolchain still targets Core0.19.0/API1.5. The old host harness
asserts the now-fixed v13 denial and its system-data route allows an empty name
index. Those are obsolete acceptance expectations, not new Core regressions.

Narrowing migration reads must preserve ActorDelta enumeration and resolve a
partial delta Item's inherited native type. Core's bounded baseActor projection
cannot include its whole items array; module work must demonstrate a correct
public-contract path and account for any retained broad dependency cost. This
review does not claim that a proposed relation-only rewrite already works or
that Core needs another change. Required steps and acceptance are in the
[ADR resumption addendum](../adr/0001-native-alignment-and-resource-cards.md#core-0191-resumption-and-module-corrective-checkpoints--october-17-2026).

No fresh packaging, browser/reconnect or native acceptance was performed here.
M4 remains partial; M5 and native A01 gates remain open. Source/hook/manifest/
workflow hashes are preserved; no Core or sibling-module file was changed.

## Core 0.19.1 adoption evidence — October 17, 2026

Implementation record and dispositions:
[ADR-0001 Core 0.19.1 implementation](../adr/0001-native-alignment-and-resource-cards.md#core-0191-implementation--october-17-2026).
Host: Core `v0.19.1` (`10213980`, SDK 3.4.0, module-api 1.6.0), Node 22.
Native reference `release-4.0.6` (`9677d16b`). Foundry v13/v14 sources read
locally for ActorDelta semantics only; no Foundry was run or connected.

### Module offline (12 suites, explicit typing)

| Suite | Result |
| --- | --- |
| native-alignment | 51/51 |
| boundaries | 53/53 |
| effect-conformance | 89/89 |
| world-adoption | 13/13 (new: mid-request context change → 409, unchanged context → 500) |
| migration-hooks | 19/19 (relations; delta type rules; world-pack identities; active root catalog; bundled hooks equal direct results) |
| system-index | 12/12 (RV-08: pending/loaded invalidation, rapid changes, scope changes, disconnect/recovery, 503/network/409 retry, 403 fails at once, retry-timer cancellation, release/StrictMode remount, shard sharing) |
| weapon-rules, prepared-actor, actor-enricher, presentation, roll-feedback, importer-mapping | exit 0 |

Explicit module/UI/migration TypeScript inclusion: clean. Mutation checks
(each guard removed, the suite turned red, file restored by SHA-256): store
invalidation restart, retry-timer clearing, 409 retry, typeless delta Item
borrowing a type, stored delta type ignored, hooks reading references instead
of relations, mid-request conflict unmapped — 7/7 caught.

RV-08 failing-before evidence remains the independent browser reproduction
recorded above (old provider: one request, null data, loading forever); the
store suite's first case is its regression.

### Packaging and CI sequence

A clean extract of the released toolchain (`git archive v0.19.1`, fresh
`npm ci`; Node 24.21 locally, CI pins Node 22) ran the workflow sequence:
`managed:generate`, `module:check`, all 12 suites from
`.module-ci-data/local/modules/shadowdark` and `module:package`; all exit 0
(v2 manifest, 2 steps). Separately, on an isolated copy:

`module:check` passed; `module:package` produced `shadowdark-0.9.4.tgz`
(`sha256:c48b2593daf6314dac21b3102675dfa35d64bf6fa505fea800cb601a48951184`) with a `sheet-delver-release.v2` manifest: catalog digest
`sha256:763ecdde06f15664a0de502253e8987b5095b4c6aecec273034ac9007d7ee531`, 2 steps, floors Core `>=0.19.1` / module-api `>=1.6.0 <2.0.0`.
Independently, Core's `discoverMigrations` over the extracted archive derived the
same digest; the packaged definition names six `.cjs` hooks whose code digests
match; no `require`/`import` remains; the packaged plan hook produced
`system.roll.ranged.bonus.this` for a Weapon parent through Core's runner.

### Isolated real Core 0.19.1 (not native)

`temp/audit-report/adr0001-core0191-host.ts`: real manager, Core and Next from a
copied v0.19.1 workspace, isolated data directory, a controlled Foundry upstream
(socket.io, literal update application, no schema cleaning) serving native 4.0.6
compendium sources and a world with pre-4.0 keys in every location: Player and
NPC Actor effects, owned and world Items (Weapon/Talent/Armor/Basic), v13
`changes` or v14 `system.changes` shapes, unknown fields and priorities, an
unlinked token delta (null delta `type`, full delta Weapon and Talent Items,
Item and effect tombstones), a lazy null delta, linked and actorless tokens, an
NPC-based delta, unlocked world Actor and Item packs and a locked world pack.
The installed baseline is the published 0.9.4 artifact; the candidate is this
branch's packaged archive, through Core's public admin archive dry-run and
maintenance APIs. The oracle is hand-derived from native `Update_251001_1`.

| Check (generations 14 and 13; 5 Players + 5 NPCs × 12 Items) | Result |
| --- | --- |
| Normal serving with published 0.9.4 | pass |
| Advisory archive dry-run with a bogus spell-advantage effect and a typeless delta Item | blocked; both blockers carry the hook reasons (CR64-11 diagnostics end to end); no writes, no maintenance record |
| After Foundry-side deletion of both sources | 79 operations = oracle (95 effect targets checked); `world.vault` reported as an advisory exclusion; every patch only `changes`/`system.changes` |
| Maintenance enter → authoritative review | equal to oracle; `/api/actors` 503; no writes |
| Approve; receipt withheld at write 26; SIGKILL of the maintenance Core | replacement resumed automatically (no resume request), completed, normal serving |
| Source oracle | every Actor, Item, Scene/token delta and world-pack document exactly equals the hand-derived result; 79 unique writes, no duplicates (including the withheld batch) |
| Full restart | bootstrap check no-op, serving, no writes |
| Restored legacy source + reconnect | world gated; installed-source review required a fresh approval (the completed ledger gave none); repaired to the oracle, 79 writes |
| Player `/api/system/data` | 200, 1,003 names (v13 and v14) |
| Pack policy | monsters/spells denied for the Player after a warm read: spells collection 403, bestiary without pack rows, names withheld; Assistant unaffected; restored on reconfiguration |
| Pulp Mode setting | revision 1 → 2, prepared `luck.mode` follows; stale-revision luck write 409 `world-context-changed`; mismatched mode 409; fresh write 200 |
| Action replay | Class Ability rolled once (one chat message, one use consumed); replay returns the same roll; after an ammunition-setting change the stale revision is 409 and the fresh replay returns the recorded roll without rolling or consuming |
| Retained-adapter reconnect | same Core PID, adapter not re-initialized, registry rebuilt, Pulp change made while disconnected applied (revision 3 → 4); pack content added while disconnected not visible (CG-4) |

Costs (generation 14, final archive):

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

### Isolated real-host presentation (not native)

`temp/audit-report/adr0001-core0191-ui.ts`: same host composition with the
packaged module installed, native quickstart pregens (Zaldini the Red, Jorbin
Ironhelm) owned by the Player, login through Core's real login view, headless
Chrome (isolated development tool).

| Case | Result |
| --- | --- |
| Bootstrap with the candidate installed | migration check no-op; serving |
| Login | Core's login view, Player |
| 320/390/820/1440 × dark/light (8 cases per generation, v14 and v13) | paper sheet; tabbed sheet with Abilities, Details, Inventory, Spells, Talents, Effects, Notes; no horizontal overflow; appearance background follows the theme |
| Module dialogs (spell, attack, inventory, monster cards) | focus enters, Tab 6/6 contained, Escape closes, focus returns, in every case |
| Core roll dialog | opens; focus does not enter, Tab 0/6, Escape ignored (CG-5); closed with ✕ |
| Core HUD | dice tray and game chat open over the sheet without overflow |
| Bestiary | native monsters listed; monster card keyboard-correct |
| Live Pulp Mode toggle (on, then off) | paper and tabbed luck controls switch without reload; index refetched; no stuck loading; no page or console errors |

Portrait images are broken only because the controlled upstream serves no
Foundry asset files.

### Core observations

Reproductions on Core v0.19.1, unmodified.

- **CG-4 — recovery pack freshness.** Host harness, retained-adapter step: add a
  document to `shadowdark.spells` in the upstream, then disconnect all sockets.
  Core reconnects and logs `Hydrated 0/15 declared packs for shadowdark (15
  skipped, fresh; 0 missing)`; the new name never appears. Cause:
  `CompendiumService.getFreshnessIndex` returns the cached in-memory index when
  present, and `computeHash` covers only `_id` and name.
- **CG-5 — RollDialog keyboard.** UI harness: focus a sheet roll button, press
  Enter. Core's `SheetRollDialog` (`RollDialog.tsx`) renders
  `role="dialog" aria-modal="true"` but does not use `useModalFocus`: focus stays
  on the trigger, Tab moves through the page behind, Escape does nothing.
- **CG-6 — untyped mid-request context error.** UI harness, live Pulp toggle,
  before the module change: Core logged `Failed to get Shadowdark system data
  Error: World context changed; refresh this action`, thrown by the request
  world handle's `assertRevision` through `moduleDocumentServices` `ensureScope`;
  a plain `Error`, not an `SdkError`.
- **CG-7 — world-pack lock default.** Core `packIsWritableWorld`:
  `(config?.locked ?? metadata.locked ?? true) === false`. Foundry v13/v14
  `CompendiumCollection#locked`: `this.config.locked ?? (this.metadata.packageType !== "world")`.
  Whether native world-pack metadata carries `locked` is unverified.
- **CG-8 — packaging reproducibility.** Package the same source at two paths:
  the compiled hooks differ only in esbuild `// <relative path>` comments and,
  inside a tree with Core's `tsconfig.json`, a `"use strict"` prologue. One source
  gave catalog digests `9c438e84…`, `763ecdde…` and (CI layout) `e0982de3…`.


## Independent G8 review — October 17, 2026

Review against Core `10213980` / v0.19.1 and module branch
`fix/adr-0001-native-alignment` / `af24b8e` plus the reported uncommitted work.
Core, module source, manifests and workflows were unchanged by review. All 12
module suites and explicit module/UI/migration TypeScript passed independently.
Local native reference remains clean at `release-4.0.6` (`9677d16b`).
The retained host evidence files have 13 checks for each generation and 8 for
each larger inventory, without recorded errors; those long workflows were not
rerun in this review. New probes cover omitted cases, as detailed below.

### RV-09 — high: advisory world-pack step can leave legacy data while reporting current

Locations: `migrations/4.0.6/definition.json`, second step `required: false`;
Core read-only references `planner.ts` (`planWorldMigrations`) and
`installedWorldCompatibility.ts` (`checkInstalledWorldCompatibility`).

Independent planner reproduction with the current compiled hooks:

- One Player in `world.review`, with one ActiveEffect containing
  `system.bonuses.rangedAttackBonus`: check-only visits 2 targets, returns zero
  blockers and an exclusion saying `maintenance required`.
- Replace it with `system.bonuses.advantage = "Not A Spell"`: full planning
  returns zero operations, zero blockers and an unresolved diagnostic/exclusion.
- The same world-pack effect would block if its step were required. Making it
  advisory relaxes all target errors, not only locked-pack enumeration.

Independent public installed-world reproduction: supplied final v2 archive
(catalog digest `sha256:763ecdde06f15664a0de502253e8987b5095b4c6aecec273034ac9007d7ee531`),
unmodified actual Core 0.19.1, controlled upstream, generation 14, native version
4.0.6. No world Actor/Item effects need migration; an explicitly unlocked world
Actor pack contains the sole legacy effect. `/api/status` becomes initialized;
`/admin/module-migrations` says **Up to date**, `checked: 2`, zero writes, and the
stored legacy key is unchanged. Core ignores advisory exclusions when publishing
successful installed checks. This is an omitted acceptance case, not a failed
write or a reason to remove Core's safety fences.

The advisory workaround is **not accepted as complete G8-B coverage**. The strict
existing API can require the pack step, but then blocks even on a locked pack
whose contents may already be current. A policy that excludes intentional locks
while requiring every eligible unlocked target needs an explicit scope decision
and may need a Core enumeration/status provision. Do not silently choose partial
migration, automatically unlock packs or bypass permissions. See the ADR's
[corrective checkpoints](../adr/0001-native-alignment-and-resource-cards.md#independent-g8-review-and-corrective-checkpoints--october-17-2026).

CG-7's source discrepancy is confirmed for absent lock fields: the Core helper
returns not writable for `{packageType:"world"}` plus empty configuration, while
both pinned native `CompendiumCollection.locked` getters return false. This
review did not inspect a live world's transmitted metadata. That native check
is still needed; it does not justify downgrading all unlocked-pack failures.

### RV-10 — medium: loaded gear picker loses its collections on context refresh

Locations: `src/ui/context/ShadowdarkUIContext.tsx` stable `fetchPack` callback;
`src/ui/components/GearSelectionModal.tsx` load effect depends only on `isOpen`
and `fetchPack`.

Actual provider and GearSelectionModal in isolated Chrome, after provider
readiness: index and gear/magic-items/properties requests succeed and Rope is
visible. Emit `world:contextChanged` while the picker remains open. The index
request count increases from 1 to 2; each collection remains at 1 request;
Rope disappears and no error is shown. Closing/reopening is an accidental recovery,
not automatic adoption. An initial child fetch before the provider's setScope
also returns null; consumers must react when scope becomes ready.

### RV-11 — medium: collection failure is not a completed UI state

Locations: `src/ui/context/system-index-store.ts` `fetchCollection` catch;
`src/ui/SpellsTab.tsx` classes effect/loading text;
`src/ui/tools/Generator.tsx` load effect, readiness and `unavailable` expression.

Actual provider/components in isolated Chrome; 200 index, 403 classes:

- Open Spells after provider readiness. One classes request returns 403;
  **Loading classes…** remains, with no alert or retry.
- Render Generator with successful ancestries and other shards, failed classes.
  All six requests settle; the form is shown without an alert or retry because
  the failure expression requires missing ancestries. Failed class data is
  indistinguishable from an empty class list to the user.

These runs have no page errors. Collection status must distinguish unavailable,
loading and a successfully empty list. Test partial success and recovery in the
actual consumers, including required data for the selected generator mode.

### Other decisions and Core findings

- The delta-Item decision is correct on the inspected native sources:
  `temp/foundry-v13.mjs` lines 13530–13540 and v14 lines 16207–16217 replace the
  same-ID base embedded document. Do not revive the earlier inherited-type
  assumption or add a broad base-Item lookup.
- The installed native-version-change gap is now exercised: stop the above
  isolated serving instance, change its controlled world to native 4.1.0,
  restart with the same installed catalog. It stays uninitialized with a
  maintenance gate; admin status is `blocked`, reason `Unsupported native source
  data-read version`; zero writes. This is bootstrap evidence, not a live/native
  version switch. Keep the supported range and document its operational effect.
- CG-4/CG-5 remain supported by source inspection and the retained isolated host/UI
  evidence. The review does not claim fresh full-matrix or native verification.
- CG-6's module revision check uses the public contract, which is appropriate;
  it is not permission for private Core imports or message-text matching.
- CG-8 is a concrete release-history concern: Core's compiler uses esbuild's
  ambient working-directory/tsconfig behavior and hashes resulting hook bytes.
  Keep one published artifact and its historical hooks immutable. Repacking from
  another layout is not proven compatible merely because source is unchanged.
  Report this to Core; no extra SDK version bump is prescribed here.

### Evidence and next work

Local reproductions and logs: `temp/g8-independent-review/` (`results.json`,
`ui-probe.mjs`, `ui-probe-results.json`, `plan-probe.ts`,
`plan-probe-results.json`, `installed-probe.ts`, `installed-probe-results.json`).
Actual isolated host workspace `/tmp/sd-g8-installed-review-zRN7HT`.
Tracked findings above are self-contained; ignored scripts are conveniences.
All review services stopped; no native Foundry or production configuration used.
The original ADR snapshot is recorded in the handoff. Module corrections RV-09–11
precede closeout; M4 is partial, M5 and native A01-01–10 remain open. Core-owned
follow-ups are external and do not authorize changes outside this module.

## RV-09–11 correction evidence — October 17, 2026

Module-only correction pass on `fix/adr-0001-native-alignment`, preserving the
existing uncommitted implementation. Core v0.19.1 (`10213980`) and native
release-4.0.6 (`9677d16b`) were read-only. No native Foundry service was contacted.
ADR snapshot before this pass: 111,492 bytes, SHA-256
`09a5b5139b78072d7bbb36d22eaaffd2e7358a0c80d0d0fd101fac7f31024ad2`.
Historical review findings and larger-inventory evidence above are retained.

### RV-09 — required completeness restored

**Before:** the maintained `migration-hooks.test.ts` required-step regression
failed (18/19 passed). The maintained `pack-maintenance.core.ts` also failed
against the preserved advisory archive using actual isolated Core's public
installed-source workflow: initialized `true`, admin **Up to date**, zero writes,
legacy key retained. Its assertion requires that exact pack-only world to stay
unavailable. This independently repeats the review's production-consequence
case; it is not just an assertion about a JSON flag.

**Correction:** the world-pack step is required, with an explicit description of
Core's strict scope and operator remediation. Pure hooks, relations, step IDs/
revision and source schemas are unchanged. Every eligible pack effect must
verify. Locks/permissions are never changed by the module or test workflow.
No advisory exclusion or caller repair substitutes for completeness.

**After:** the maintained real-host harness uses an isolated installed archive,
random loopback ports, the public bootstrap CLI/admin HTTP workflow, and a
controlled upstream with legacy effects exclusively in an unlocked world Actor
pack. Separate controlled generation 13/14 runs pass **9/9 checks each**:

1. Bootstrap requires maintenance, gates serving and makes no unapproved write.
2. Review contains the expected effect identity and bounded change-array patch;
   approval makes exactly one write and the entire source equals a separately
   constructed native-rename oracle, including IDs, unknown fields and shape.
3. A full process restart does no writes, retains the verified source and reports
   **Up to date** through `/admin/module-migrations` after fresh checks.
4. Actual caller collection requests demonstrate classes 403 while ancestries
   still return 200; restoring pack ownership permits current classes again.
5. After stop → restore legacy pack data → restart, serving is gated and a different fresh review is required.
   The prior approval returns 409; fresh approval restores the same oracle.
6. An unresolved eligible pack effect cannot yield clean readiness; its public
   diagnostic contains the unknown spell/repair reason. Zero writes.
7. An explicitly locked world pack blocks with Core's lock/unreadable explanation;
   lock, content and zero-write state are verified unchanged.
8. A controlled upstream pack-read refusal blocks with its permission/read reason,
   without replacing it with an empty pack or performing a write.
9. An Assistant service account is refused with Core's full-GM authority
   diagnostic; no elevation or write occurs. This diagnostic is exposed via
   `/admin/module-upgrades`, separately from migration status.

The final archive is also rerun through the complete public workflow. Larger
eligible-pack runs supplement, rather than replace, the earlier mixed-inventory
1,029/2,529-write evidence: 30 Actors × 30 Items yields **930** required effects;
60 × 40 yields **2,460**. They check full-source equality, exact bounded writes,
no-op restart, real caller permission recovery and fresh review after restore.
The first 60×40 attempt exceeded the harness's 180-second execution allowance;
its task-owned services were stopped. The maintained allowance was raised to
600 seconds for the fresh isolated repeat; this did not change Core or migration
requiredness. Final run results are recorded below.

**Remaining Core boundary:** strict requiredness blocks when *any* world Actor/
Item pack is locked or unreadable, even if its data might be current. The public
enumeration reason is generic; the module catalog and architecture explain
inspection of world Actor/Item locks and service-account access before retry/
review. Core must provide explicit enumeration scope and visible exclusion/
readiness evidence to exclude intentional locks while still requiring every
eligible unlocked target. `required: false` cannot implement this policy.
CG-7's absent-lock default discrepancy and omission of advisory exclusions from
installed status remain external findings. The tested strict policy does not
depend on either being fixed, and does not claim intentional-lock exclusion.

### RV-10 — reactive collections in open consumers

**Before:** the maintained actual-provider/consumer browser regression failed for
loaded gear invalidation, a consumer mounting before provider readiness, pending
initial gear invalidation and caller/role/world changes. The complete initial
matrix passed **0/17**; logs/screenshots preserve the original behavior. The
loaded-gear case specifically expects all three collections to fetch twice and
the same open picker to show the row again, keeping its search.

**Correction:** active demand is registered in the existing scoped store by
`useShadowdarkCollections`. Index readiness starts demand once; replacement
contexts/scopes retire old requests and reload demanded shards. Requests are
deduplicated; last-consumer unmount and provider release abort and settle pending
work, including transports that ignore abort. Generation checks reject late
responses and provider rendering masks another scope's cached rows. Gear's
component-local load promise is removed. Search/category state stays local and
survives refresh. Details/language/spell/mastery and bonus-spell consumers use
the same shared path; Generator identities come from current full collections,
with its document reads/derived async work retired on generation/unmount changes.

**After:** maintained store regressions pass **15/15** and actual-consumer browser
coverage includes loaded/pending invalidation, pre-readiness mounting, loaded/
pending caller/role/world changes, disconnect/reconnect, consumer/provider
unmount, stale response suppression and deduplication. A caller change followed
by 403 cannot expose the preceding caller's loaded gear. Search persists across
gear, spell and Details picker invalidation. Installed Core/Next/SDK checks also
exercise loaded and initial-pending gear refresh using real world-context events.

### RV-11 — explicit collection failure and recovery

**Before:** actual Spells with index 200/classes 403 never leaves Loading classes;
Generator renders its form when ancestries succeeded but classes failed. Both
maintained consumer assertions fail against the original source. Index-only
success and an empty fallback are insufficient acceptance evidence.

**Correction:** collections independently publish loading, ready and failed
states, with denied/unavailable/read-error explanations. Only a valid response
array populates success; `[]` is explicitly ready. Failure is terminal until
retry or context replacement, preventing fetch loops. Retry reloads failed
shards while preserving current successful ones. Shared explanations/Retry reach
Spells, Gear, Generator, spell/language/Details/mastery and bonus-spell pickers;
current readiness gates dependent actions. Generator requires all five identity/
language collections in both modes and additionally patrons at level 1. Missing
selected identities must be chosen again; guessed name-index documents and
retained privileged collection rows are not substitutes.

**After:** the maintained consumer matrix exercises partial gear/Generator
success, classes 403/503/404, network failures, malformed response bodies, valid
empty collections and successful selective retries. The spell/language picker
cannot save while required data failed; mastery consumers deduplicate failed
reads and recover. The level-1 Generator test proves patrons are required only
for that selected mode and the mode survives failure/recovery. Real installed
Spells and Generator checks use actual caller-denied classes and restore native
pack ownership through the controlled upstream, then observe recovery.

### Validation, artifacts and remaining gates

- All **12 module suites pass** against released Core v0.19.1, with the static
  native reference present: migration hooks **19/19**, system index **15/15**,
  native alignment **51/51**, boundaries **53/53**, effect conformance **89/89**,
  world adoption **13/13**, and the six smaller suites.
- Explicit module/UI/migration and maintained host-harness TypeScript passes via
  `src/tests/verify-types.mjs`. It includes Next's public declarations directly,
  so a clean toolchain needs no generated Next server files. Root-only typing
  continues to be insufficient.
- Module contract/boundary checking and isolated packaging pass using a clean
  `git archive v0.19.1` toolchain, with output under `/tmp/sd-rv-corrections`.
  Physical module copies are used because Core intentionally confines hook paths.
- Final candidate `shadowdark-0.9.4.tgz` SHA-256
  `2fcacac74dc0accbcefc5829611afcec6cae588ecf757ec97ad57d8234a7d971`;
  v2 catalog digest `sha256:b6dbabe17ce3ebfb147c705eea536460ab188227e60864e465ae11bc83bf5dcb`,
  two required steps. The preceding archive `e3310c21…` has identical migration
  hooks/catalog; only a final level-up readiness guard changes its UI bundle.
  Both archive provenances remain explicit in the evidence.
- Local logs, failing-before snapshots, browser results/screenshots, ADR snapshot
  metadata and final package: `temp/rv09-rv11-corrections/`. Maintained test entry
  points live under `src/tests/`; Core run roots and installed-browser screenshots
  live under `/tmp/sd-rv-corrections/`. Final matrix/results are listed in the
  handoff and the supplemental results paragraph below.

RV-09–11 implementation corrections are ready for independent re-review; no
native acceptance or release is claimed. M4 has renewed isolated evidence under
the strict scope; **M5 and native A01-01–10 remain open**. The ADR's existing
native requirements still govern disposable v13/v14 acceptance, approved
fixture/write/cleanup scope and backup-warning acknowledgement after review.
Core CG-4 (recovery pack freshness), CG-5 (RollDialog keyboard), CG-6 (untyped
mid-request context conflicts), CG-7, CG-8 (packaging/history determinism) and
advisory-status omission remain external. No Core fix is hidden in module code.
Compatibility stays Core >=0.19.1, module-api >=1.6.0 <2.0.0, UI/roll unchanged;
module 0.9.4 unchanged, no sdkVersion. Work remains uncommitted.

### Additional Core dependency CG-9 — pack ownership changes lack Player invalidation

The installed-browser run found a separate host observability gap after passing
the loaded/pending Gear context checks. Changing only
`core.compendiumConfiguration` ownership after classes had loaded did not refresh
the Player's index/classes and did not produce a classes failure alert. Fresh
requests enforce the new denial (proven through the real public caller routes).
Core's `SystemService` refreshes world context for a Setting change, but
`ModuleWorldContextService.refresh` publishes only changed declared module
settings; compendium ownership is not one. The Setting invalidation bridge is
GM-only. The public SDK has no pack-capability-change signal for the Player.

Consequently the module cannot retire that existing projection on this change
alone; it needs a public Core caller-data/capability invalidation event, without
exposing Setting data. No module-side Core-setting declaration, raw socket or
polling cache is introduced. This remains a concrete external dependency,
separate from RV-10's supported context/scope invalidation and RV-11's failed-read
state. Installed denial tests mount after verifying the real 403; recovery tests
restore ownership **and trigger a declared Pulp context change**. These prove the
supported path, not automatic recovery on an unannounced ownership change.

### Final supplemental results and cleanup

- Maintained actual-consumer browser matrix: **26/26** (initial unchanged-source
  subset **0/17**). Final twelve-suite rerun, explicit typing, module checking,
  package validation and `git diff --check` pass.
- Public Core workflow: controlled shapes 13/14 **9/9 each**, final archive
  **9/9**. Larger packs **930 effects: 5/5** and **2,460 effects: 5/5**, including
  independent full-source equality after both approved writes and restored-source
  approval, plus a genuine no-op restart. The larger repeat completed after the
  harness window adjustment; no Core timeout/policy workaround was introduced.
- Final-archive installed Core/Next/SDK browser checks, using the public bootstrap
  CLI/HTTP setup: controlled generations **13 and 14, 8/8 each**. These include
  open loaded/pending gear, real classes 403 with retry, Generator partial failure,
  and declared-context recovery. No uncaught page errors. The earlier broader
  eight width/appearance cases passed; its added ownership-only recovery check
  exposed CG-9, so that overall run is not represented as a full pass.
- CG-9's final g14 browser observation is explicit: fresh classes HTTP **403**,
  index requests **7 → 7**, classes requests **4 → 4**, loaded class still visible,
  **0** class-failure alerts before any declared-context change. Both public-setup
  browser evidence files retain the corresponding probe. This is an external
  missing invalidation signal, not a passing live-permission-revocation test.
- Final runtime source equals the physical source copy used to package archive
  `2fcacac7…`; `package-provenance.json` proves byte-identical migration files
  across that archive and the preceding broader-tested `e3310c21…`. Core's public
  fresh-check catalog digest equals the final manifest digest. CG-8 across
  different future packaging layouts/history is still unresolved.
- Consolidated machine-readable result/provenance/preservation record:
  `temp/rv09-rv11-corrections/validation-summary.json`; final archive, manifest and
  checksum in its `package/` directory. Logs and browser result JSON/screenshots
  are alongside it. Core and installed-browser run roots are
  `/tmp/sd-rv-corrections/core-*` and `/tmp/sd-rv-corrections/ui-public-g13|g14`.
- All task-owned Core/Next/upstream/browser processes exited. Listener/process
  inspection confirmed no retained task service; unrelated listeners were left
  alone. Core/native reference remain clean. Branch/HEAD unchanged, no staged
  changes, version/compatibility unchanged. All work is uncommitted for review.


## RV-09–11 independent verification — October 18, 2026

Independent review accepts the three module corrections for the scope recorded
in the [ADR verification](../adr/0001-native-alignment-and-resource-cards.md#rv-0911-independent-verification--october-18-2026).
No new module implementation blocker was confirmed. The following results were
rerun on Node 22.23.3 with Core 0.19.1 read-only:

| Check | Independent result |
| --- | --- |
| Twelve module suites | All pass; hooks 19/19, store 15/15 included |
| Maintained explicit typing | Pass, including module UI/migrations/test harnesses |
| Actual collection consumer browser matrix | 26/26; no page errors |
| Final packaged archive identity | SHA-256 `2fcacac74dc0accbcefc5829611afcec6cae588ecf757ec97ad57d8234a7d971` matches |
| New actual isolated Core public workflow, controlled v14 effect shape | 9/9: pack-only gate, approval/full-source oracle, restart no-op, fresh caller denial/recovery, restore/fresh approval, unresolved/locked/unreadable/full-GM blocks |
| Native Foundry | Not run; no live instance contacted |

The original RV-09 public consequence is now corrected: the sole legacy effect
in an unlocked world pack cannot serve as Up to date. Approval writes only its
change array; unchanged source content is independently compared. Locks and
permissions remain unchanged. RV-10's loaded/pending gear reproductions recover,
and RV-11's failed/empty/partial collections have explicit status and gated
consumers. The strict locked-pack boundary remains deliberate, not solved by
these module corrections.

CG-9's classification is independently supported by read-only Core inspection:
`SystemService` routes Setting changes through `WorldBootstrapper.refreshWorldContext`;
that path returns without a changed declared setting or pack notification.
`ModuleWorldContextService.refresh` compares only declarations; Setting events
remain GM-only, and `src/shared/sdk/events.ts` has no public caller-capability
change signal. The two recorded installed-browser probes support the same
consequence. No fresh automatic ownership-invalidation pass is claimed.

Local independent logs: `temp/rv09-rv11-independent-review/` (suite logs,
`results.json`, `consumers/results.json`, `host.log`, ADR snapshot metadata and
source preservation inventory). New host evidence:
`/tmp/sd-rv09-independent-host-20261018/results.json`. The retained implementation
runs still establish their documented larger-inventory, g13 and installed UI
scope; they were not all repeated. All review services were stopped.

Next: scoped native v13/v14 acceptance with this exact candidate, or separately
selected Core follow-up. Native testing must record CG-9/other known host gaps
honestly; these dependencies prevent an unqualified all-deliverables closeout.
Module source, catalog, metadata, workflow, versions and Git state unchanged.

## Native v14 acceptance — October 18, 2026

This is fresh native evidence, superseding “native not run” only for the cases
below. The operator authorized the prepared fixture/write/cleanup scope and
launched `shadowdark-test` at loopback port 30000. Foundry **14.367**, native
Shadowdark **4.0.6**, and passwordless **Gamemaster (role 4)** were verified.
The exact reviewed `shadowdark-0.9.4.tgz` archive (SHA-256
`2fcacac74dc0accbcefc5829611afcec6cae588ecf757ec97ad57d8234a7d971`)
ran through a copied, isolated released Core **0.19.1** workspace and external
data directory. No operator Core configuration was used. Existing Foundry was
neither restarted nor replaced.

### Verified native results

| Area | Executed evidence |
| --- | --- |
| Required migration | Public installed-source bootstrap gated readiness. Preview proposed exactly **8 fixture ActiveEffects**: world Actor, owned Item, world Item, unlinked ActorDelta and its Item, world Actor pack and its owned Item, and world Item pack. Only full stored change arrays changed. Independent literal-key oracle matched complete native sources after approval, excluding `_stats` bookkeeping. Existing world documents were unchanged. |
| Restart / restored data | Real supervisor restart served current sources without further source changes. Restoring one fixture effect's legacy array required a new review; the old approval returned 409. Fresh approval corrected exactly that one effect; full independent source comparison passed. This is **8 initial + 1 deliberately restored writes**, not a large-inventory run or fresh lost-receipt/crash test. |
| Native rule oracle | A real native browser prepared the fixture copies of Prim, Binx and Goblin. Core matched their six ability scores/modifiers as applicable, HP, AC (18/9/11), Player slot limits (12/13), and four displayed attack configurations. Dice formatting differences (`1d8 + 1` / `d8+1`) were normalized only for comparison. No module planner or formula helper supplied the native oracle. |
| Original mastery defect | On the fixture, disabling its separate +2 STR talent recreated STR 9: mastery enabled gave **+0 d8+1**, disabled gave **−1 d8**. Re-enable/restore preserved the full native multi-change effect. Current original Prim includes that separate STR talent, so its unchanged-source result is +1 d8+1. |
| Casting / replay | Copied an intact spell from the native spell pack onto the fixture. Manual success and failure applied the correct modifier/outcome; failure marked only that exact embedded Item lost. Identical request replay returned the recorded result; changed-body reuse returned 409. Two fixture chat outputs were recorded and removed. This does not establish every spell/item action or native random-dice outcome. |
| Missing source data | Copied Binx's original spells have no stored casting-class references. The module explains unavailability; native `PlayerSD._getSpellcastingAbility` also rejects this missing input. No class was guessed and existing spells were not repaired. |
| Settings / stale requests | Native Pulp Mode changes refreshed open simple and tabbed sheets. Native ammunition changes reached prepared authoritative rule inputs. An earlier context revision was rejected with 409 before mutation. |
| RV-10 / RV-11 consumers | Open Gear refetched on a native declared-setting event and retained its search. Native 403 produced explicit collection failure/retry after a supported invalidation; restoring access and Retry recovered. Generator partial classes denial blocked creation with an explanation; Retry recovered after access restoration. |
| Generator / importer / level-up | Native-backed level-zero preview and level-up data reads resolved successfully. An unresolved import requested confirmation and left Actor sources unchanged. Full creation/finalization and every choice combination were not executed in this native pass. |
| Presentation | Actual Core/Next/SDK with native upstream: **8 width/theme cases** (320/390/820/1440, light/dark), seven advanced tabs, spell/weapon/basic-item/monster detail samples, bestiary, chat and dice tray. No horizontal overflow or uncaught page errors. Module detail dialogs passed focus entry, containment, Escape and return. Eight additional ready-state paper captures verified the current Prim row; early loading-overlay screenshots are not final visual evidence. Core roll-dialog keyboard failure remains CG-5. |
| Caller boundaries | Nonowner Actor detail concealed with 404; LIMITED card 200/detail 404/effect write 404. OBSERVER card/detail 200, effect write refused with unchanged source, but wrong HTTP **500** (new CG-10). Owner effect toggles worked. Fresh denied pack requests returned 403; automatic retirement of already-loaded rows failed as CG-9. |

### Confirmed Core dependencies

**CG-7 — absent world-pack lock default, now native-confirmed.** A newly created
world Actor pack exposed no `locked` metadata property. With its configuration
entry absent, actual native `game.packs.get(id).locked` was **false**. Core's fresh
bootstrap reported `Migration check blocked: Required world pack is locked or
unreadable`, with readiness false and no source writes. Explicit `locked:false`
on the fixture allowed the required scope to execute. Only fixture configuration
was temporarily changed. Requiredness must remain intact; excluding intentionally
locked packs still needs a separate host scope/readiness provision.

**CG-9 — ownership-only invalidation, now native-confirmed.** With Rope loaded in
the Player's open picker, revoke the native gear pack's PLAYER access. A fresh
HTTP read returns 403, but the previous row remains and index/gear request counts
remain **1→1 / 1→1**. Changing a declared setting then retires the row and renders
the 403 explanation. Restoring permission plus Retry recovers. Core needs a
caller-capability invalidation signal; a fresh-read authorization pass does not
establish live revocation. No module polling or Setting-document access was added.

**CG-5 — shared roll dialog, now native-backed rendered-confirmed.** All eight
captures measured no focus entry, 0/6 contained Tab moves, no Escape close and
no focus return for Core's roll dialog. Module resource dialogs passed those
checks. Layout success must not be described as full keyboard acceptance.

### CG-10 — managed JavaScript boundary loses SDK error identity (new)

**Observed:** give the test Player OBSERVER access to its fixture Actor and POST
the owned Item's valid effect reference to `actors/<id>/effects/toggle`. The
effect remains unchanged, but the response is sanitized HTTP 500
(`code: internal-error`) instead of permission-denied 403. Owner requests work;
LIMITED requests are concealed before this write path. This is a failed error
contract, not an unauthorized-write finding.

**Independent isolation:** in the copied Core workspace, call the exact packaged
effect route with a test runtime whose effect update throws the host's
`SdkError('permission_denied', 'Intentional probe')`. The packaged handler returns
500/internal. Host `@shared/sdk` and `@sheet-delver/sdk` resolve to the same
constructor there. Across an adjacent external-data-directory **`.js`** importer,
however, constructors differ and both `isSdkError` checks return false. The same
probe as **`.mjs`** shares the constructor and both checks return true. No native
connection or modified application source is involved in this isolation.

This identifies the managed JS / CommonJS-versus-ESM SDK loading boundary in the
tested external data-directory configuration. Core's guard throws a typed SDK
denial; the module already uses the public `isSdkError` helper. Its `instanceof`
identity does not survive that loading combination. Do not extrapolate this to
every installation layout, or label it a native Foundry permissions failure.
Do not fix it with per-module message matching, elevated reads/writes, or an
invented module-local error taxonomy.

Core follow-up checkpoints:

1. Reproduce with an actual managed `.js` archive and an external configured data
   root, not only local TypeScript imports or a same-constructor mock.
2. Define consistent managed ESM loading/packaging and/or a validated SDK error
   identity contract across supported runtime boundaries. Preserve safe handling
   of unknown exceptions and legitimate 404 concealment.
3. Verify permission_denied→403, not_found→404, conflict→409 and validation→400
   across the real package boundary; unknown internal exceptions remain sanitized
   500. Check development and supported production launch modes and data layouts.
4. Repeat the native OBSERVER effect denial with full unchanged-source proof, then
   re-run module routes that consume host SDK errors. Keep caller identity and
   write authorization unchanged. Revisit a release/minimum only after the host
   fix is selected; no compatibility/version metadata changed in this pass.

### Gates, cleanup and evidence limits

RV-09–11 remain corrected for their stated strict scope and supported context
signals. M5 remains open: CG-5/7/9/10 prevent an unqualified acceptance claim;
v13 and the unexecuted A01 scenarios remain outstanding. CG-4/6/8 retain their
previous status; neither reconnect freshness nor packaging-history determinism
was resolved by these tests. A01-04/05 were sampled as specified above, not fully
completed. Native v14 success in these cases does not establish v13 compatibility.

Cleanup independently restored **9 Actors, 0 world Items, 2 Scenes, 4 Users**,
all original pack identities and temporary settings, and the original chat
membership. Existing source comparisons reported **zero differences** apart from
ignored `_stats` bookkeeping. Recorded fixture IDs, test-user settings, two test
packs and two action chat messages were removed. All acceptance Core/Next/browser
processes stopped; the operator's Foundry listener remained on port 30000.

Local replay scripts: `temp/native-a01-v14/`; run evidence:
`/tmp/sd-a01-native14-77rMWw/`. Key records are `migration-results.json`,
`native-parity.json`, `ui/results.json`, `paper-ready/results.json`,
`live-ui/results.json`, `actions.json`, `permissions.json`, `generation.json`,
`sdk-boundary-probe.json`, `sdk-identity-check*.json`, `recovery.json` and
`cleanup.json`. The first action harness expected 403 for a concealed nonowner
read; it therefore ended red after the successful action checks. The corrected
separate permission run verifies 404 concealment and separately records CG-10
as failed. Initial native login, Rope-label, tab-selection and migration-status
wait mistakes were harness issues and are not product findings. Resource sampler
output contained no samples at this logging level; **no fresh memory/capacity
claim** is made. Prior larger controlled inventories remain separate evidence.

ADR saved before annotations at
`temp/adr-snapshots/0001-before-native-v14-acceptance-20261018.md` (121,499 bytes,
SHA-256 `8da4805392b687362c23878199c7067df5f5c91eb5159df2124a3a7c9e700c8e`).
Only module documentation, handoff and ignored acceptance resources changed.
Core and module runtime sources, hooks, manifests, workflows, release versions,
Git index and remote state were untouched.

## Core 0.19.2 checkpoint review — October 18, 2026

### Baseline and disposition

The user selected module resumption and a preservation commit. Reviewed module
branch `fix/adr-0001-native-alignment`, starting HEAD
`af24b8e84cd0be1a7c2eb750f15e5d41321a8300`, with **55 modified tracked files and
18 untracked implementation/test files**, nothing staged. The checkpoint includes
that accumulated work plus this review's documentation reconciliation. It is
not a release-readiness or complete-native-acceptance claim.

Core is read-only, clean at released tag `v0.19.2`, commit
`b010f590e56d87e3fcd6fce42c7894028e5f0c3a`, package 0.19.2. Publication is reported
by the operator; local tag/package identity was independently checked. Native
reference remains clean at `release-4.0.6` / `9677d16b`. Module version 0.9.4,
Core minimum >=0.19.1 and workflow pins remain unchanged in this checkpoint.
SDK3.4/module-api1.6/UI3.2/roll1.0 are unchanged by the supporting Core release.
Local verification used Node24.21.0; the repository CI continues to select Node22.
A local pass is not evidence that the updated remote CI has run.

CG-5/7/9/10 are resolved by released Core CR64-23–26/R1. Its tracked ADR records
fresh focused native v13/v14 acceptance and independent review. The four old
host-blocked statements no longer describe the selected host. CG-5 concerns
shared UI, not migration completeness. CG-4/6/8 retain their separate qualified
status; no blanket Core-finding closure is inferred. Core documentation's older
publication-pending wording predates the tag and is not a renewed module hold.

Review inspected the catalog and bounded hooks, settings/preparation/context
paths, caller projection and post-await pack checks, request-scope fencing,
registry refresh and shared browser cache/consumer demand. Both migration steps
remain required, missing type/relations produce explicit unresolved reasons,
and source changes are confined to the stored effect arrays. There is no new
caller/initialization/UI migration route. The existing implementation remains
intact; this review changed module documentation/handoff only.

### Fresh verification on the released host

| Check | Result and limits |
| --- | --- |
| Twelve maintained suites | PASS: weapon-rules, prepared-actor, actor-enricher, presentation, roll-feedback, importer-mapping, native-alignment, boundaries, effect-conformance, world-adoption, migration-hooks, system-index. |
| Explicit module/UI/migration typing | PASS using `src/tests/verify-types.mjs`; not inferred from Core's module-excluding root config. |
| Actual module collection consumers | PASS26/26 using `collection-consumers.browser.mjs`, actual providers/components and controlled SDK. This is not an installed-Core visual/native matrix. |
| Module contract and bundling | `module:check` PASS. Isolated real-directory `module:package` PASS, including confined hook compilation and required catalog. |
| Public real-Core workflow, v14-shaped upstream | Six checks pass: pack-only readiness gate/no premature write, exact approved source transformation, genuine restart no-op, caller pack denial/recovery, restored-data stale-approval409/fresh approved repair, and unresolved-value blocking. Two confirmed effect writes total: initial migration plus the deliberate restored-data repair. Full harness then FAILS at its obsolete metadata-only locked fixture; later unreadable and service-role cases were not reached. |
| Public real-Core workflow, v13-shaped upstream | PASS with `--inventory-only`: five positive migration/restart/caller/restore checks, the same two exact writes and independent source comparison. Negative cases are intentionally not executed by that option, not counted as passes. |
| Native acceptance | No new native Foundry connection or write. Earlier module sampled-v14 and Core focused-v13/v14 evidence remain separately qualified. No new capacity or full M5/A01 claim. |

The maintained full v14 host runner waits for a locked explanation, times out,
and returns exit1. Its durable `maintenance.json` is at **stage `review`**.
This is consistent with Core's corrected world-pack default: the fixture's
configuration is `{}`, so `packMetadata.locked:true` is not an actual native
lock. The runner's last transient `fetch failed` during supervised replacement
is not itself evidence of a migration regression. Fix the fixture and rerun the
entire negative matrix before calling it green; do not change requiredness or
Core lock policy to satisfy the old assertion.

The first packaging attempt used a symlinked source directory and failed
`Unconfined migration path`. Repeating with a real isolated module copy succeeded.
That first failure belongs to the review setup, not a module correction. The
final test archive is `shadowdark-0.9.4.tgz`, SHA-256
`7ebc48467bce29306f9f73fe04a48c42d7a6640cc1cf4c5a381a06946779443b`.
It was built from a real copy under the checkpoint output's `data/local/modules/`
and used unchanged for both workflows. Given recorded CG-8, this hash is tied
to that build/layout and does not assert reproducibility across other paths.

### Remaining module work

**RV-12 — release-floor/pin mismatch:** `info.json.coreVersion`, CI checkout,
release-workflow ref and `core_ref` must all select 0.19.2. Otherwise the module
still admits the defective host. Preserve module0.9.4, SDK/API ranges and native
4.0.6 data-read range. This is planned corrective adoption, not already done.

**RV-13 — stale host-test contract and identity:** fix the real native
`core.compendiumConfiguration` override in the maintained lock case; retain
strict true-lock/unreadable/unresolved gating and add relevant native-default
coverage. Derive actual version/commit and archive identity for results. The
maintained runner currently hard-codes `core:'v0.19.1'` even on 0.19.2; this
review records the actual identity separately rather than rewriting those raw
results. Legacy `core0191/` helper naming is cosmetic, not a runtime requirement.

The [ADR resumption checkpoints R19-A–F](../adr/0001-native-alignment-and-resource-cards.md#core-0192-checkpoint-and-resumption--october-18-2026)
are the current implementation queue. They include final installed-package
permission, ownership-refresh and shared-roller verification on the released
host, then the full remaining A01 matrix. Existing RV-09–11 corrections remain
preserved; this review found no new confirmed production migration defect.
M4 evidence is retained, with final release adoption verification outstanding;
M5/ADR stay open. Intentional-lock exclusion, unselected Core findings and
previously deferred feature work must not be silently folded into this task.

### Evidence and preservation

Local evidence lives in `temp/checkpoint-core0192-20261018/`: twelve suite logs,
`validation-summary.json`, consumer results, package, both host results and
`host-summary.json` with the actual Core identity. `initial.patch` and
`before-hashes.json` preserve the starting changes. ADR was saved before edits
as `0001-before-checkpoint.md`, SHA-256
`577b7813913ddbfe791bc3832a04119f5b84fa3055b7711eb7e9a37ff4379708`.
Tracked evidence here is self-contained; ignored files support local replay.
All isolated harness services were stopped. The operator's Foundry on30000
was neither contacted nor stopped. Core and sibling repositories were not edited;
no native data, release versions, remote state or tags changed. The user-authorized
module checkpoint commit preserves the reviewed accumulated source and docs.
