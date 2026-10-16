# Shadowdark native alignment audit — October 15, 2026

Status: **Review complete; module corrections implemented with offline evidence
(see [implementation dispositions](#implementation-dispositions)); native/operator
acceptance pending.**
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
| SD01-14 | Fixed (offline) | `ui/ShadowdarkPaperSheet.tsx`, `ui/components/LuckControl.tsx`, `ui/components/ResourceDetailModal.tsx` | — | BR 8 attack rows, spell → card → Cast, keyboard; item cards keep equip/stash/light/quantity (`ui/components/ItemStateControls.tsx`, `logic/inventory-controls.ts`; red: BR "card keeps Unequip" on the pre-fix card) | Luck shows both native fields because the Pulp setting is unreadable. |
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

### Research note: world settings are not readable by modules (open)

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
'native-default' }`. Its consumers are `ui/components/LuckControl.tsx` (Pulp count
selector versus standard token) and the ammunition diagnostic in
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
| Luck `available` / `remaining`, `usePulpMode` setting | sheet editing only | paper, Details | Edit only; setting unreadable | Tooltip explains | BR |
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

All eight module suites pass (`weapon-rules`, `prepared-actor`, `actor-enricher`,
`presentation`, `roll-feedback`, `importer-mapping`, `native-alignment` 44/44, `effect-conformance` 83/83,
`boundaries` 42/42). Explicit module TypeScript check: clean. `npm run module:check
-- shadowdark`: passed. Packaging into an isolated data directory: 9 entries
(`LICENSE`, `README.md`, `info.json`, compiled `dist/` entries and scoped CSS),
no tests or local files. The boundaries suite's native pack oracle reads
`temp/shadowdark/data/packs` from the Core checkout and reports itself as
skipped when that reference is absent (as in CI).
