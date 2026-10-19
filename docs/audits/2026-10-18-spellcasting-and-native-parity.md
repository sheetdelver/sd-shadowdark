# Post-release audit: spellcasting, spell ownership and native parity

**Date:** October 18, 2026

**Status:** Active — implementation checkpoint reviewed offline. SD02-R1–R3 remain open; maintained checks pass. Actual native A02-01–15 remains open. See the [independent review](#independent-implementation-review--october-18-2026).

**Decision record:** [ADR-0002](../adr/0002-native-data-and-behavior-parity.md)

**Predecessor:** [Completed ADR-0001 audit](2026-10-15-native-alignment.md)

## Initial audit outcome (before implementation)

The reported casting failures are observable in the running application. They
have several causes, not one universal failure to recognize casting classes.
There are also confirmed module defects in spell ownership accounting, selection
safety, alternate class spell lists and modal behavior. The old acceptance
fixtures did not cover these complete workflows or the actual affected actors.

The initial review concentrated on those workflows. After the user's scope
challenge, a second source pass examined native actor/item models, preparation,
inventory, languages, action execution, roll outcomes and world settings. It
established **SD02-09–13** beyond the reported spell symptoms. This is a broader
source/controlled-method audit, not full native gameplay or rendered acceptance.
The coverage matrix below states exactly what was compared and what remains open.

The current effect-key migrations do not promise to reconstruct missing talents,
missing spell class references or lost item provenance. A successful migration
job therefore does not establish that every actor is a complete native character.
No new Core migration failure was established by this audit.

Highest priorities are SD02-01 through SD02-05, SD02-07, SD02-09/10 and SD02-12.
In particular, do not
use the current selection catalog as a complete representation of owned spells:
saving a reduced catalog can remove an owned spell, and failed additions do not
prevent subsequent removals. Those destructive paths were traced without
executing writes on the operator's world.

## Baseline and method

| Surface | Observed baseline |
| --- | --- |
| Module checkout | `main`, clean before this audit; 0.9.5, commit `5e46fba243fa230c8ff32916abe3c5ae397d6490` |
| Core checkout | `main`, 0.19.3, commit `90c13e5e57d88913cd3bae6bf6b9e6f0b995bad1`; read-only |
| Native reference | Local `temp/shadowdark` in the Core workspace, detached at `release-4.0.6`, commit `9677d16b3903b3b640f00d4efd48249142ac8334`; unchanged |
| Running application | User-authorized `localhost:8000`; Core 0.19.3, selected **local** Shadowdark 0.9.5, native system 4.0.6, Foundry generation 14 |
| Runtime qualifications | The status response established generation 14, not the exact current Foundry build. Actor `_stats.coreVersion` is historical document metadata, not proof of the running build. A managed release archive was not inspected in this pass. |
| Operations | Source comparison; pure preparation and adapter reads with an in-memory runtime; authenticated live GETs through Core; login/logout only for audit sessions |

The expanded pass additionally executed selected **actual native methods** with
controlled in-memory collaborators and compared them with current module
functions/routes. Its simulated item updates, failed writes, rolls and chat
never reached Core or Foundry. Native field cleaning, browser hooks, sockets,
concurrency and rendered interactions are not established by those probes.

The live instance was initially stopped and was then started by the user.
The review read actor list/detail, exact caller-bound Actor documents, module
collections, system metadata and source selection. It did not roll, learn,
delete, advance, repair, migrate, change settings or permissions, or start/stop
operator services. Authentication material is not included in these records.

Browser control was unavailable (no browser provider; opening the in-app browser
also failed). Live evidence below is **API evidence**, not screenshots or
native Foundry browser acceptance. UI findings identify source behavior and
actual data inputs; responsive layout, focus and interaction acceptance remain
implementation checkpoints.

Native paths below are relative to the pinned native repository. Module links
are relative to this repository. Core paths are reference-only and do not create
authorization for Core edits.

## Live evidence and independent controls

| Case | Observed data and prepared behavior | Conclusion and limit |
| --- | --- | --- |
| L01 — four existing pregens | Creeg Greythorn and Zaldini the Red have Wizard references; Elbin Grizzlegut and Iraga Draguul have Priest references. Their 13 owned spells have class references, but their actor/item data exposes no casting-class grant. All 13 prepared actions say `This character is not a spellcaster.` | Missing native grant data explains the current preparer's refusal. Who removed/omitted the grants, and whether a native browser supplies anything different, remain unverified. A spellcasting roll bonus is not a casting-class grant. |
| L02 — existing Wizard and Witch | Both actors have a working `system.spellcasting.classes` effect. All six owned spells omit `system.class`; all six actions say `The spell names no casting class.` | These are not non-casters. The item references are incomplete. No catalog source identity was recorded on these spells, so name matching cannot safely repair them automatically. |
| L03 — working Priest control | Two owned spells have correct class references and available casting actions. Neither has `_stats.compendiumSource` or `flags.core.sourceId`. The live tier-one catalog contains six choices; the current picker receives **zero known inputs**, hence zero initial selections. | Casting works, but the ownership/selection model misrepresents valid existing inventory. No save was submitted. |
| L04 — existing Knight | The owned Spellcasting talent grants `knight-of-st.-ydris`. The native 4.0.6 Knight template grants `witch` and uses the Witch list. This actor has no owned spells. | A concrete data mismatch, not proof that the current writer caused it. Preserve the actor until an exact, reviewed correction is established. |

Live Actor document reads used the module's caller-bound document endpoint, which
reads Core's primary Actor store through `req.runtime.documents.get`; the sheet
detail was compared separately. This is stronger than inspecting a UI label but
does not replace an independent Foundry `_source`/native-preparation comparison.

The offline control loaded the **unmodified native 4.0.6 quickstart pack** and
hydrated its separately stored embedded item/effect records by their `_key`
relationships. Eight Player pregens were prepared with the existing module.
The four stock casters expose all 13 casting actions as available. The same
eight actors were evaluated with modeled v14 `system.changes` shapes: again all
13 actions were available. All 16 inputs were unchanged after preparation.
The v14 conversion is a modeled serialization control, not a new native v14 run.

Two further read-only probes exercised existing module functions:

- A Wizard with its casting grant retained and four spells referencing a valid
  world Class UUID has four unavailable actions with the current catalog-only
  lookups. Supplying that exact Class document to the same preparer makes all four
  actions available. No name substitution or product source change was used.
- `ShadowdarkAdapter.getLevelUpData` for Knight level 2 → 3 requires one tier-one
  spell but returns zero options. Native Knight's alternate list is Witch, for
  which the pinned pack has 46 spells. Knight's level-two tier-one allowance is
  null; Witch's is four. Using the Witch progression table for Knight is also wrong.

Ignored local evidence is in `temp/adr0002-audit/`: `source-probes.json`,
`native-pregens.json`, `live-api.json`, `live-item-diagnostics.json` and
`live-collections.json`. Live extracts are local only. The facts, cases,
provenance and reproduction instructions in this report are the durable record;
a clean clone does not need these ignored files to understand the findings.

## Findings

P1 means incorrect rules, lost/duplicated inventory or incomplete required work;
P2 means misleading presentation, incomplete supported catalog behavior or
accessibility. These priorities do not imply authorization to change live data.

### SD02-01 — distinguish incomplete actor data from caster eligibility (P1)

**Evidence:** L01, L02 and L04 above; native
`system/src/models/PlayerSD.mjs` `prepareBaseData`, `prepareDerivedData`,
`isSpellCaster`, `_getSpellcastingAbility` and `castSpell`;
[actor preparation](../../src/logic/actor-preparation.ts),
[spell actions](../../src/logic/actions.ts) and
[effect normalization](../../src/logic/effects.ts).

Native Player preparation resets casting classes and obtains them through
effects. A class title or `ClassSD.isCastingClass` alone does not authorize an
actor to cast. Each spell separately names exact Class documents used to resolve
the casting ability. Bard-style item permissions and NPC spellcasting are
different paths. A Warlock with an empty native casting ability must not become
a generic caster because its name sounds magical.

The current messages expose the final failure but not a useful explanation of
missing grants versus absent spell references versus unresolved references.
The working world data and stock controls demonstrate why a blanket Wizard/Priest
fallback would conceal the problem and invent permissions.

**Required work:** add one structured diagnostic path, capture sanitized examples
of the actual data shapes, compare them with native preparation, and trace
creation/import/grant copying to determine whether current writers still produce
incomplete records. Correct any demonstrated current writer before planning
historical repair. Present exact missing fields/effect states and an appropriate
GM repair route. Source-less owned spells are valid inventory; missing provenance
alone must not prohibit casting or force a migration.

Deterministic bulk corrections, if justified, need a **new** migration step and
the existing Core admin workflow. Existing applied steps remain unchanged.
Missing grants and references with no reliable origin require an explicit exact
source choice or native GM editing; do not infer identity from name, terminal ID,
class title or description. Nothing in this audit establishes the historical
writer or authorizes repairing the operator world.

**Closeout:** L01/L02/L04 mechanical shapes have an independently checked native
result, clear diagnosis and a verified repair disposition; repaired disposable
copies cast correctly without changing unrelated items, effects or custom fields.

### SD02-02 — reference resolution is narrower than native casting (P1)

**Evidence:** world-Class probe;
[adapter `lookups`](../../src/server/ShadowdarkAdapter.ts),
[normalization lookups](../../src/logic/normalization.ts),
[action route](../../src/server/api/actions.ts),
[registry](../../src/server/Registry.ts).

Native `_getSpellcastingAbility` resolves the spell's Class UUIDs with `fromUuid`.
Module preparation instead uses the declared-pack projection, with a limited
owned-Class provenance fallback. A valid world Class cannot resolve there.
The action route fetches world-linked Scroll/Wand spells, but does not similarly
resolve those spells' Class dependencies. Thus a supported read surface exists
without being connected to the shared casting model. World-linked item spells
can also be unavailable in the sheet before the route could resolve them.

**Required work:** build a bounded dependency result for the actual actor's
referenced classes/spells, retaining exact identities, permissions, world/context
revision and explicit missing/denied states. Feed the same rules into prepared
display and server execution. Keep caller-specific results out of the shared
privileged registry. Prove the public host lifecycle supports any preparation
integration chosen; do not add a private store import or a global world scan.

**Closeout:** exact world/embedded/declared-pack cases work consistently across
paper, tabs, cards and execution; hidden, removed or stale dependencies refuse
without disclosing content. An unavailable dependency never becomes “not a caster.”

### SD02-03 — class, casting grant, spell list and progression are conflated (P1)

**Evidence:** Knight probe; native `system/src/apps/LevelUpSD.mjs` reads
`class.system.spellcasting.class` for the spell list while taking counts from the
actor's class; native Knight Class `0uVUOXKuX9xfJ600` points to Witch Class
`KGnBAFiTiLHZJUND`, and talent `XRW3jhpTni15hwFc` grants `witch`.
[Adapter level-up data](../../src/server/ShadowdarkAdapter.ts),
[server grant validation](../../src/server/api/level-up.ts),
[SpellsTab](../../src/ui/SpellsTab.tsx),
[level-up state](../../src/ui/components/levelup/useLevelUp.ts).

The adapter queries spells using the actor Class UUID and ignores its alternate
list. Server `verifyGrants` likewise requires that UUID in the spell's class list,
so valid Witch selections for Knight are rejected. The management tab locates a
class by the granted slug and can use the Witch progression table instead of
Knight's. These are separate native concepts even when they usually coincide.

**Required work:** one shared model for actor class identity, active grants,
resolved spell-list identity, casting ability and progression source. Respect an
empty list override and the native non-caster sentinel; do not treat the sentinel
as a UUID. Derive advancement requirements from the correct class/level and list
membership from the alternate list. Initial creation must evaluate planned
native grants without writing them; existing actors use their actual grants.

**Closeout:** Knight level 2 → 3 offers the proper Witch choices, accepts one valid
tier-one selection and keeps Knight counts; Wizard/Priest/Witch/Seer, non-casters,
item-only casting and multiple active grants retain native behavior.

### SD02-04 — owned spell identity is replaced by catalog provenance (P1)

**Evidence:** L03; [SpellsTab](../../src/ui/SpellsTab.tsx) `knownFor`, `knownSpells`
and `ownedSources`; [picker](../../src/ui/components/SpellSelectionModal.tsx)
`availableSpells` and selection initialization;
[prepared items](../../src/logic/prepared-view.ts).

Counts use embedded spell rows, while the picker removes all rows without a
catalog source. A `Map<sourceUuid, item>` then collapses two owned copies of one
template into one row. Current known-class accounting also depends on resolved
label slugs, so an unresolved class can disappear from totals. The source-less
Priest control is a real affected case, not a malformed synthetic fixture.

**Required work:** Actor ID plus embedded Item ID is ownership identity;
provenance is optional. Maintain owned rows independently of available catalog
choices, preserve duplicates and custom fields, and expose unresolved grouping
without hiding items. An optional catalog association must not overwrite or
deduplicate an owned item. Do not reproduce native SpellBook's name-based
“known” indicator as an identity rule; it is not a reliable mutation key.

**Closeout:** source-less, duplicated, renamed, custom, lost and granted spells
are visible and counted consistently, and opening/saving unchanged selection
produces zero writes. Physical inventory may continue to exclude Spell items:
native owns them in the spellbook, distinct from carried gear.

### SD02-05 — selection save can remove spells without explicit removal intent (P1)

**Evidence:** [SpellsTab `saveSelection`](../../src/ui/SpellsTab.tsx) and
[picker `handleSave`](../../src/ui/components/SpellSelectionModal.tsx).

Initial selection is the intersection of known sources and the current catalog.
Save returns only current catalog rows. A previously owned spell whose source is
absent, hidden or filtered can consequently enter `toRemove` without a deliberate
deselection. The same risk occurs after a catalog change while the picker is open.
The client attempts additions individually, catches failures and still proceeds
to deletions. Retrying can create duplicates after an uncertain create response.
This is a source-traced data-loss path; it was not executed on live actors.

**Required work:** submit explicit additions by exact source and explicit removals
by owned Item ID, with a reviewed actor/context baseline. Validate ownership,
source readability, selection constraints and freshness on the server before
mutations. Do not delete because a row was absent from a catalog or because its
read failed. A failed/uncertain replacement must not discard the old spell.
Use supported SDK writes with truthful per-operation outcomes and safe retry;
do not claim transaction atomicity or cross-restart idempotency without evidence.

**Closeout:** stale catalogs, partial reads, permission changes, concurrent edits,
failed additions/deletions, lost receipts and retries preserve untouched inventory
and never duplicate a confirmed addition. Cancellation before submission writes
nothing; partial completion is visible and can be reconciled without repeating it.

### SD02-06 — catalog sources and failure states are inconsistent (P2)

**Evidence:** [picker](../../src/ui/components/SpellSelectionModal.tsx),
[class spell-list endpoint](../../src/server/api/spells.ts),
[registry](../../src/server/Registry.ts), [manifest](../../info.json);
native `system/src/documents/CompendiumsSD.mjs` and
`system/src/apps/SourceFilterSettings.mjs`.

The picker reads only the declared `spells` collection. The existing list endpoint
also includes caller-visible world Spell documents, but is unused by the picker
and silently reports success if its world read fails. Neither catalog implements
native `shadowdark.sourceFilters`. Native's spellbook scans Item compendiums and
filters non-empty `system.source.title` against that setting; an empty setting
allows all sources. Native does not automatically add world Items to that scan;
world-spell browsing is a SheetDelver addition already present in its API.

**Required work:** use one caller-bound catalog contract with explicit source
coverage and ready/failed/unavailable states. Declare/read source filters through
the existing world-context contract using the proven native Array default `[]`,
not direct Setting access. Filtering choices must not filter owned inventory or
revoke existing casting grants. Separate exact referenced-document resolution
from discovery of arbitrary third-party/world packs.

**Closeout:** declared packs and the existing world-spell feature agree between
picker and endpoint; failed reads are not empty success. Source-filter changes
retire stale requests and refresh choices. Broader pack discovery has either a
proven public implementation or an explicit, accurately scoped external dependency.

### SD02-07 — selection limits and required advancement choices can be bypassed (P1)

**Evidence:** [picker](../../src/ui/components/SpellSelectionModal.tsx)
uses truthiness for `maxSelections`, including `maxSelections || 99`;
[level-up completion](../../src/ui/components/levelup/useLevelUp.ts) checks required
spells only when `availableSpells.length > 0`;
[finalize](../../src/server/api/level-up.ts) and
[assembly](../../src/server/api/level-up-engine.ts) verify selected spell sources
but do not derive/enforce the full native required spell count independently.

Zero is treated as unlimited in the picker; a changed limit does not itself
invalidate Save. Undefined/invalid limits and real zero are not modeled separately.
An empty catalog can skip the wizard's required-spell guard. Combined with
SD02-03, Knight level 2 → 3 can offer no spells despite a nonzero requirement.

**Required work:** distinguish finite zero, positive limits, and unknown data;
use the shared native progression model. Native table nulls mean no learned
spells for that level/tier (native subtraction coerces them to zero); an absent
or invalid table is a different, unresolved state. Preserve existing over-limit inventory
without deleting it automatically. Enforce the appropriate contract for each
workflow: advancement requires exact new choices; ordinary ownership management
must distinguish a rules-guided choice from an explicit GM exception. Re-read and
validate server-side before any actor/item write, not only in React controls.

**Closeout:** zero, unknown, negative/invalid and shrinking limits; required empty
catalogs; wrong tiers; duplicate choices; crafted excess/insufficient submissions;
and actor/context changes are covered. Invalid required work yields zero writes.

### SD02-08 — spell picker bypasses shared dialog and formatting behavior (P2)

**Evidence:** [picker](../../src/ui/components/SpellSelectionModal.tsx),
[resource dialog](../../src/ui/components/ResourceDetailModal.tsx),
[shared spell facts](../../src/logic/resource-cards.ts).

The picker implements its own fixed `z-50` overlay instead of the module's shared
SDK dialog pattern. It has no dialog role/modal semantics, focus containment,
Escape handling or focus restoration, and its close/selection icon buttons lack
accessible labels. Expandable rows are pointer-only divs. The source establishes
these gaps; actual clipping and focus traversal were not observed in a browser.

It also formats duration separately (including adding another `s` to values whose
native type is already plural) and supplies `Close` for missing range. Existing
resource-card formatters already handle native duration/range enums. Active
resource dialogs use a different layer and suspension behavior, so another
independent overlay risks repeating the earlier floating-tool conflicts.

**Required work:** adopt the existing SDK dialog lifecycle, accessible named
controls and keyboard expansion, and reuse authoritative spell facts. Render
missing data honestly. Keep current selection through harmless refreshes, but
retire/reconcile it explicitly when actor, source or permission scope changes.

**Closeout:** real installed-browser checks of paper/tab entry points, nested card
and roller, Tab/Shift-Tab/Escape, focus return, scroll containment, phone footer
reachability and four widths in both themes. Save failures remain actionable.

## Expanded findings from the native behavior pass

### SD02-09 — limited-use abilities spend after the roll, contrary to native ordering (P1)

**Native authority:** `system/src/models/PlayerSD.mjs:useAbility`. After dialog
and hook cancellation, native checks and decrements `system.uses.available`
**before** calling `rollFromConfig` or posting a no-check ability to chat.

**Module:** [action executor](../../src/server/api/actions.ts) rolls/posts first,
then calls [planConsequences](../../src/logic/actions.ts). Preparation describes
the use as `before-roll`, but execution places it after the result.

**Executed comparison:** a one-use WIS ability, DC 10, with a failed check:

| Case | Native method | Current module route |
| --- | --- | --- |
| Ordinary failed check | Spend → roll → mark lost; zero uses left | Roll → spend → mark lost; same final count, different order |
| Roll operation throws | Spend succeeded; zero uses left | No spend; one use remains, HTTP 500 |
| Spend operation throws | Roll never starts | Roll already occurred; result reports a partial consequence |

This is an ordinary resource-action ordering defect, not a migration issue.
Same-request replay protection does not protect two distinct requests spending
the same last use; current writes also use the original actor snapshot. The
concurrent outcome is source-traced and still needs a dedicated reproducer.

**Required work:** represent prerequisite writes separately from post-result
consequences in the shared action model. Re-read eligibility, honor cancellation,
then confirm the spend before rolling/posting. A failed or uncertain spend must
not permit the roll. Record completed phases so retry does not spend twice or
reroll; after a confirmed spend followed by roll failure, explain the actual
state instead of silently retrying a fresh action. State process/restart limits
honestly and prove handling of distinct requests against the same resource.

**Closeout:** the three rows above, no-check abilities, zero uses, cancellation,
duplicate/repeated requests and two concurrent last-use requests. Compare ordered
events and final native source, not only HTTP success or final count.

### SD02-10 — potion identification changes only a flag (P1)

**Native authority:** `PlayerSD.usePotion` and
`models/items/_PhysicalItemSD.mjs:toggleIdentified`: identify first, swap active
and alternate name/description, enable effects, render/post, then delete.

**Module:** the [executor](../../src/server/api/actions.ts) posts first and only
writes `system.identification.identified = true` before deleting. It does not
perform the name/description swap or native effect transition.

**Executed comparison:** an unidentified `Cloudy vial`, alternate name
`Healing Potion`, distinct descriptions and a disabled effect, with deletion
deliberately refused in both controlled runtimes:

- Native retains the identified Healing Potion, known description, old disguise
  in alternate fields and enabled effect; event order identify/effect/chat/delete.
- Module retains `Cloudy vial` with the old description and disabled effect,
  despite `identified: true`; event order chat/update/delete, response `partial`.

Successful deletion conceals this inconsistent intermediate state. Native deletes
the owned Potion document; do not invent quantity-decrement semantics here.

**Required work:** share an exact native identification transition, preserving
unknown fields and the inverse/disguise data. Apply caller-authorized prerequisite
writes before announcing use, then consume. Reconcile partial field/effect writes
and uncertain deletion without a second swap, repeated chat or unrelated effects.
Use public item/effect writes; no direct native transport is justified.

**Closeout:** already identified/unidentified potions, empty alternate-name native
fallback, effects, successful use, identification failure, effect failure,
deletion failure and replay against re-read source. Compare native state at each
phase, including the surviving item after incomplete consumption.

### SD02-11 — Player focus exception is also applied to NPC spells (P2)

**Native authority:** `PlayerSD.castSpell` preserves an owned spell on failed focus;
`NpcSD.castSpell` marks a failed spell lost without that Player exception.

**Module:** [planConsequences](../../src/logic/actions.ts) applies `!options.focus`
to every owned Spell without an actor-specific loss policy. The
[resource dialog](../../src/ui/components/ResourceDetailModal.tsx) offers focus
for owned spell cards without distinguishing the actor kind.

**Executed comparison:** an NPC spell with a failed roll and `focus: true` is lost
by the actual native NPC method; the module route returns 200 with `lost: false`.
No real actor was cast or changed.

**Required work:** prepare the actor-specific loss/focus policy once and consume
it in dialog and server execution. Reject or normalize an unsupported focus
option server-side; hiding a checkbox alone is insufficient. Preserve Player,
Scroll and Wand semantics independently.

**Closeout:** Player normal/focus, NPC normal/submitted-focus, Scroll consumption,
Wand failed spell/critical break, and replay. Assert both availability and writes.

### SD02-12 — language rarity and allowances are inferred instead of read (P1)

**Native authority:** `models/items/LanguageSD.mjs` stores `system.rarity`;
`CompendiumItemSelectors/LanguageSelector.mjs` decorates rarity from that field.
`models/_fields/itemFields.mjs:languageChoices` supplies distinct `common`, `rare`,
`select`, `selectOptions` and `fixed`. `CharacterGeneratorSD._loadLanguages`
preserves separate class/ancestry restricted-choice counts and pools. The native
existing-character language selector saves chosen UUIDs; it does not impose the
module's inferred creation quota on ordinary editing.

**Module:** [Registry.categorize](../../src/server/Registry.ts) overwrites projected
rarity using [isRareLanguage](../../src/logic/rules.ts), which searches English
name fragments and defaults unknown names to common. The language picker repeats
that rule; generator/advancement consume the resulting projected `rarity`.
`getLanguageLimits` merges independent pools, guesses one choice for a nonempty
pool, and uses truthiness where native explicitly stores zero.

**Executed comparisons:** a valid custom Language named `Star Tongue` with
`system.rarity: "rare"` becomes `rarity: "common"` in the actual Registry.
A class with `select: 0` and a retained nonempty `selectOptions` list gives the
current helper an extra choice (`maxCommon: 2`, rather than its own base one).
Native keeps that restricted selection count zero. Names and examples are
synthetic controlled data, not deductions about the user's characters.

**Required work:** preserve native rarity and exact UUIDs in one shared language
projection. Unknown rarity/reference is unresolved, not common by default.
Use explicit counts with separate class/ancestry pools for creation; do not infer
count from pool contents or convert restricted choices into unrestricted common
slots. Preserve fixed, custom and pre-existing languages. Keep ordinary language
editing separate from generator validation; document any deliberate product
restriction rather than calling it native parity. Consolidate picker, Details,
generator and advancement consumers.

**Closeout:** rare language with an unfamiliar/localized name; common language
whose name contains a rare-language fragment; explicit zero with stale options;
two independent restricted pools; unresolved/denied refs; existing extra languages;
and no-op save. Invalid required creation choices must cause zero writes.

### SD02-13 — zero critical threshold does not disable critical success (P2)

**Native authority:** `dice/RollSD.mjs:criticalSuccess/criticalFailure` explicitly
returns false when the threshold is zero. This is distinct from a missing
threshold, which uses the native default.

**Module:** [evaluateOutcome](../../src/logic/actions.ts) compares the natural roll
directly with the threshold. At success threshold zero, every positive natural
result becomes a critical success. The prepared action accepts numeric zero.

**Executed comparison:** natural/total 15, DC 10, both critical thresholds zero:
native critical success is false, module critical success is true. Nine control
cases with ordinary 20/1 thresholds match native success/critical outcomes.
This audit did not establish a live actor using a zero threshold.

**Required work/closeout:** preserve native disabled-versus-missing threshold
semantics in shared outcome evaluation. Test zero, ordinary/custom thresholds,
unknown natural/manual results and the actual prepared-effect path. Do not
change damage or grant rules to compensate for an incorrect outcome flag.

## Duplication and broader coverage review

The shared action preparer is a sound base. This pass does **not** recommend
another client caster calculator. Divergence includes spell management:
`SpellsTab` calculates source/limits/counts, the picker applies another identity
model, and level-up derives and validates a different list. Exact Turn Undead
grant mappings also occur in both `prepared-view.ts` and `ShadowdarkAdapter.ts`;
`data/talent-effects.ts` retains a separate ID-only mapping. Consolidate the live
consumers during this correction and verify/remove unused mappings only after
checking callers. Language classification has another split across Registry,
rules, Details and selection. Action descriptions and actual execution phases
also disagree. Consolidate those responsibilities without inventing a second
preparer or treating a display description as an executable consequence.

| Area reviewed | Result / disposition |
| --- | --- |
| Effects, weapon mastery, damage order, Player/NPC stats | Shared preparation/action code and prior scoped evidence retained; existing suites rerun. New no-effect armor and native weapon/slot controls below. Neither proves all effect combinations or complete combat execution. |
| Casting permissions and exact class references | SD02-01/02; current actor omissions are separate from missing reference support. |
| Spell ownership, management and selection | SD02-04/05/07/08; confirmed source defects plus live inventory evidence. |
| Creation, import, class grants and advancement | SD02-01/03/07; preserve current HP/XP/mastery corrections; reproduce complete creation/import spell lineage, not just successful writes. |
| Paper and tabbed sheets | Both consume prepared actions; paper lists owned Spell rows directly, tabs add independent management logic. Keep one inventory model and show the same reasons/counts. Neither may hide owned spells merely because casting is unavailable. |
| Cards, Scroll/Wand spells, focus and consequences | SD02-09/10/11/13 expose action ordering, identification and outcome defects despite passing suites. SD02-02/08 also cover dependencies/dialogs. |
| Physical inventory, slots, equipment and treasure | New comparisons confirm selected slot/armor/weapon calculations. Native equip/shield/stash handlers match the current planned control writes on source inspection. Sales use native per-document cost, not an invented quantity multiplier; multi-write failure/concurrency remains unexecuted. Potion defect is SD02-10. |
| Languages, ancestry and class choice data | SD02-12; native rarity and distinct choice counts/pools are not preserved consistently. |
| Caller privacy and cache refresh | Existing caller gates and collection lifecycle retained. New dependency/catalog/selection paths need their own deny/revoke/reconnect evidence; no public-cache shortcut. |
| Settings and content sources | SD02-06; current Pulp/ammunition settings remain. Source-filter adoption uses an existing contract. |
| Required effect migrations | Prior requiredness, pack lock policy, recovery and native evidence remain valid for their declared corrections. Missing item data is not covered by that statement. New deterministic repair needs its own step and proof. |
| Other native automation | See evidence-backed feature inventory below; retained deferrals are not silently implementation requirements. |

### Executed native-method comparisons and their limits

The ignored `temp/adr0002-audit/broad-probes.mjs` and `broad-probes.json` capture
this additional pass. The durable reproductions and native method names are here;
the implementation agent must add maintained regressions, not depend on ignored
files. No application or test source was changed by the probe.

| Comparison | Result | Limit |
| --- | --- | --- |
| Native `_PhysicalItemSD.slotsUsed` vs `prepareItemBasics` | **69** native gear records agree | Valid native schema data; not malformed-source cleanup |
| Native `WeaponSD.prepareBaseData/getDamageFormula` vs `weaponBase` | **31** native weapons agree on default grip and actual die | Empty native damage is represented as unavailable/null; no invented damage. No extra claim about effect-modified or rolled damage |
| Native `PlayerSD._calcArmorClass` vs `prepareActorCore` | **9** configurations agree: no armor, each of seven native armors, all together | DEX +2; active-effect lookup is a no-effect collaborator, not an independent effects engine |
| Native `ActorBaseSD.getSlotUsage` vs module preparation | **4** mixed inventories agree at 0/100/101/201 coins, with repeated item/free carry, sorting and stashing | Native slot getters executed; not inventory mutation or concurrent economy acceptance |
| Native `RollSD` getters vs `evaluateOutcome` | **9** ordinary threshold configurations agree; zero-critical case differs | Controlled die totals; not dice randomness or Core chat rendering |
| Native ability, potion and NPC spell methods vs module route | SD02-09/10/11 discrepancies reproduced | Actual methods, in-memory update/roll/chat boundaries; no native browser/document cleaning |
| Registry and language-limit helpers vs native fields/generator source | SD02-12 reproduced | Native language UI was source-read, not rendered or executed |

All **twelve existing offline suites pass** on the unchanged implementation
(`weapon-rules`, `prepared-actor`, `actor-enricher`, `presentation`, `roll-feedback`,
`importer-mapping`, `native-alignment`, `boundaries`, `effect-conformance`,
`world-adoption`, `migration-hooks`, `system-index`). The new defect probes still
reproduce. Passing the previous suites therefore does not close this report.
No new type/build/package or native acceptance is claimed for documentation edits.

### Native model inventory and coverage disposition

This matrix accounts for the 22 concrete native Item models and Player/NPC
preparation. It is a coverage inventory, not a claim that every field, combination
or native action was executed. Unproven rows remain unproven at closeout.

| Native model(s) | Module surface and current assessment |
| --- | --- |
| Player, NPC, `_ActorBaseSD` | Shared preparation, stats/checks, AC/slots/initiative and actions. New AC/slots/outcome controls plus existing suite evidence; fresh native stat/effect/order comparison still required for changed rules. |
| Weapon, Armor | Actual damage, grip, equipment, properties, AC. Native default weapon/armor controls agree; effect permutations retained in suites. Automatic attack/ammunition/damage workflow remains partial (F01/F02). |
| Basic, Gem | Native physical/treasure/coin/grouped slot fields; shared inventory/card path. Slot controls agree. Sale failure recovery, gem-bag and custom-item dialogs not newly rendered/executed. |
| Potion | Supported consume action; native identification transition is incomplete (SD02-10). |
| Spell, Scroll, Wand | Class/list/grant/ownership findings SD02-01–08, NPC policy SD02-11. Existing scroll/wand failure suites pass; dependency, full UI and native result acceptance remain open. |
| Class Ability | Shared action/uses/loss controls exist; spend timing and failure behavior differ (SD02-09). |
| Class, Ancestry, Language | Native class/list/progression and fixed/restricted/random language fields; SD02-03/07/12. Creation/advancement must compare exact grants and independent choices, not just successful creation. |
| Background, Deity, Patron | Reference/descriptive data, alignment and exact patron boon-table reference inspected. No new defect established; custom/missing-reference and complete patron workflows lack new native acceptance. Background has no native language-choice schema; do not invent one as a native rule. |
| Talent, Boon, Effect, Property | Native item/effect identity, flags and descriptions feed shared effects/cards/choice logic. Existing effect/mastery suites pass. A native Effect item and embedded ActiveEffect are distinct; duration/token/scene automation is not established by effect preparation (F03). |
| NPC Attack, NPC Special Attack, NPC Feature | Explicit attack bonus/damage/critical fields, special description/feature data remain separate from Player stats. Source comparison and existing suites retained; bestiary presentation is not proof of all native attack chat/feature behaviors. |

### Native feature gaps and proposed follow-up work

These items are actionable investigation/feature records, **not silently selected
corrections** to replace SD02-01–13. Retained deferrals require an explicit scope
decision before implementation. Unknown capability is not yet a Core defect.

| ID / native authority | Current gap | Work and checkpoint when selected |
| --- | --- | --- |
| F01 — automatic damage/healing, `dice/dice.mjs:rollFromConfig/rollDamageFromMessage`, `settings.mjs:rollDamage` | Native world setting defaults true; native can roll damage after a successful spell or attack (attack without target also qualifies), with later chat damage controls. Module prepares formulas but spell/ability route rolls only the main check; generic attack metadata is not execution of native damage logic. | Trace public roller/chat contract end to end. Define one module-owned compound action using actual formulas and critical multipliers, consume authoritative setting, and reuse shared presentation. Prove successful/failed casts, no-target/target attacks, healing, setting off, manual follow-up and no duplicate damage. Do not automatically apply HP without an explicit authorized target action. |
| F02 — ammunition, `PlayerSD.rollAttack`, `ItemSD.usesAmmunition` | Module reads/explains `autoConsumeAmmunition` but neither spends nor refuses an empty supply. | Select full caller-owned attack consequence work; prove native selection and quantity rules, spend-before-roll ordering, empty/off/unknown setting, cancellation and safe replay. Preserve native ammo matching instead of choosing by display-name guess. |
| F03 — lights and timed effects, `apps/LightSourceTrackerSD.mjs`, `models/items/EffectSD.mjs`, native sheet light handlers | Inventory light controls update flags only; no native scene updates, clock, expiry, chat tracker or token icons. | Inventory exact timer/scene authority and settings. Decide which operations remain in Foundry and which need a public host feature. Prove one owner of time advancement, pause/reconnect and no duplicate consumption before adding automation. No independent client clock masquerading as native authority. |
| F04 — targeting, momentum and shared chat controls, `dice/dice.mjs:setRollTarget/roll`, `documents/ChatMessageSD.mjs` | Native browser selection, damage application/reroll controls and momentum hooks are not supplied merely by Core rolling a formula. | Separate module rules from Core target/chat capabilities. Specify authorized target identity, audiences, resource changes and lifecycle; prove existing SDK first, then record any minimal missing host contract. |
| F05 — situational effect selection | Preparers expose options; card text calls for manual adjustment; no complete shared selection UI. | Reuse shared dialog, send exact selected keys to existing server preparation, and verify selected/unselected formulas without creating duplicate effect logic. |
| F06 — broader pack catalog | Known exact UUID reads exist; arbitrary pack discovery/hydration remains unproven. | Capability proof from SD02-06, then caller-filtered enumeration with explicit failure states if supported. No blanket SDK-blocker assertion. |

Settings reviewed also include native light-tracker controls, `enableTargeting`,
`useMomentumMode`, `rollNpcHpWhenAddedToScene`, `useClockwiseInitiative`, passive
effect/HP animation preferences, debugging and native migration markers. These
are not all module settings to copy blindly. Native migration markers remain
native-owned; scene/initiative behavior needs the feature ownership decision
above; UI preferences need an explicit product mapping. Currently the module
declares Pulp/ammunition only; source filters are selected in SD02-06, while
`rollDamage` belongs to proposed F01.

The initial broad “rest automation” note was not backed by a specific native
4.0.6 handler. Manual spell/ability restoration exists; this audit does **not**
assert a missing automatic native rest feature without identifying its authority.
Native 4.1+, historical CG-4/6/8 and the future Core encounter/card SDK retain
their existing exclusions/qualifications.

## Core/SDK feasibility: verified surfaces and limits

Read-only inspection used Core 0.19.3 `src/shared/sdk/runtime.ts`,
`src/shared/sdk/world.ts`, `src/server/shared/utils/createModuleRuntime.ts` and
`src/server/shared/utils/moduleDocumentServices.ts`.

| Need | Current contract / implication |
| --- | --- |
| Read an exact visible world/embedded document | Caller `documents.get/list/fetchByUuid` already exist. The module already resolves world/Actor-embedded documents in `resolveDocumentFor`; wire bounded dependencies into the same rule path. |
| Read a known compendium UUID | Caller `compendium.getById` can resolve an exact undeclared-but-present pack record within the system under Core's native permission checks. Module Registry rejects undeclared packs earlier. This is not a blanket Core inability to read known UUIDs. |
| Discover an arbitrary pack's entire catalog | `access.packs()` lists readable metadata, but `compendium.findAll` is still type-scoped to declared packs. Present-record lookup does not establish enumeration or live hydration of unknown packs. Verify through the public host before proposing an extension. |
| Read native source filters | Existing versioned world settings support arrays. No new SDK version is indicated merely to declare `shadowdark.sourceFilters`. Validate entries against the native string-list semantics. |
| Change owned items | Caller item/document writes exist. Their presence does not imply an atomic multi-step replacement or durable replay ledger; verify exact failure/receipt behavior. |
| Bulk historical repair | Reuse released admin migrations for proven deterministic changes, with a new step. Neither caller authority escalation nor a direct Foundry transport is needed or authorized. Missing provenance cannot be solved by permission escalation. |

The SDK's broad “declared packs” descriptions are less precise than the current
exact-UUID implementation. Implementation must test the actual public contracts
and keep the distinction above. No Core source modification, version bump or
new Core issue is authorized or justified solely by this audit.

## Implementation handoff and acceptance

[ADR-0002 checkpoints](../adr/0002-native-data-and-behavior-parity.md#implementation-checkpoints)
are the implementation queue. Record each finding as fixed, awaiting evidence,
or explicitly scoped/deferred with a reason. Do not close data integrity cases
because unit fixtures pass; do not describe source inspection as rendered or
native acceptance. ADR-0001 remains Completed within its original selected scope.

## D0 implementation baseline — October 18, 2026

The maintained `src/tests/native-parity.test.ts` reproduces SD02-03 and SD02-07:
Knight level 2→3 needs one tier-1 spell but offers zero of the native Witch
list's 46; a crafted request choosing none writes the Actor once. The
`native-parity.oracles.mjs` harness calls the actual released native methods
with in-memory collaborators and finds eight failing checks: disabled critical
threshold, three ability order/failure cases, Potion deletion-failure state,
NPC focus loss, language rarity and explicit zero language choices. Its
69/31/9/4/9 independent parity controls pass. No operator documents were used.
Use `--baseline` only to record the failures; default execution is strict.

Core public SDK documentation establishes synchronous, user-invariant Actor
preparation and caller-bound asynchronous exact document reads as distinct
contracts. Caller dependency delivery and installed-host proof are D1 work; no
Core blocker is claimed from the current module's declared-pack restriction.

## Shared-model implementation evidence — October 18, 2026

SD02-01: sanitized L01/L02/L04 mechanical shapes now distinguish missing grants,
missing Spell Class refs and a grant mismatch; no history is inferred or repaired.
SD02-02: actual caller-view route resolves world/embedded Class dependencies,
keeps them out of the registry, rejects source changes during reads, and leaves
inputs unchanged. Installed-host proof remains D1/D6 work.
SD02-03: the same Knight fixture changes from zero offered spells to46 exact
Witch-list documents with one tier-1 choice and unchanged Knight identity.
SD02-04: shared owned rows preserve two source-less copies as separate Item IDs;
mounted management validation remains pending.
SD02-07: explicit null/zero and unavailable limits are distinguished. The crafted
missing-choice advancement changes from one Actor write to400 and zero writes.
The maintained native-parity suite passes6/6 controlled checks; module/UI/hook
typing passes. These are module/source tests, not native Foundry acceptance.

## D3/D4 correction evidence — October 18, 2026

- SD02-04: two source-less duplicates remain separate owned rows with Item IDs.
  An unchanged mounted save emits empty intent; a deliberate removal identifies
  only the selected duplicate. Catalog omissions never establish deletion.
- SD02-05: failed creation leaves the old spell; restored permission retries the
  same receipt. Lost create acknowledgement leaves both copies and stops all
  later removals. Restart-shaped started receipts never create again. Deletion
  retry does not repeat confirmed additions; unrelated source edits yield409.
  These controlled tests do not assert distributed/atomic writes.
- SD02-06: world-read denial gives partial coverage and keeps readable pack rows.
  Valid empty results remain complete. Native sourceFilters is consumed through
  world context; no Setting transport or privileged fallback was added.
- SD02-07: zero disables additions; unknown limits are explicit. Advancement
  requires exact Class/list/count data before HP/XP/items and remains incomplete
  when a required catalog is empty. HP/XP controls still pass61/61 alignment.
- SD02-08: the actual picker has shared dialog semantics/focus containment,
  keyboard expansion and Escape/restoration; shared duration displays2 Rounds
  and missing range is Unavailable. Pending invalidation retires a late catalog
  while retaining search and owned rows.

`collection-consumers.browser.mjs --parity-only --baseline=f5838a8` exercises the
old maintained picker with the same current fixtures/assertions:0/5 pass. Current
code passes5/5 and34/34 including the previous RV-10/11/RV-16 controls.
`native-parity.test.ts` passes11/11 controlled cases. Explicit module/UI/hook
typing passes on Core0.19.3; final packaged/public Core0.19.2 proof is pending.
No actual native A02 case is marked passed by these results.

## D5a correction evidence — October 18, 2026

- SD02-09 failing-before event order `roll→spend→loss` becomes native
  `spend→roll→loss`; a roll exception leaves0 uses, and spend failure makes no
  result call. No-check chat, two concurrent last-use requests, lost spend/result
  receipts, exact retry and adapter-epoch receipt restoration are maintained
  regressions. Restored permission retries only a definitively refused spend.
- SD02-10 the original deletion-failure fixture now retains the native known
  name/description, reverse disguise and enabled effects. Six actual native
  usePotion/toggleIdentified failure/fallback comparisons agree on state and
  ordered operations. Additional route tests preserve unknown fields, quantity
  and another Item's colliding effect ID, and activate other effects even when
  one fails. No chat/deletion follows a failed activation group.
- SD02-11 the same failed NPC focus input now loses the spell as native does;
  actual Player/NPC resource cards expose/hide focus from the shared action policy.
- SD02-13 disabled thresholds now yield no critical; custom/default thresholds,
  unknown natural and prepared legacy/v14 override effects pass.

D5a native-method checks12/12 and action-phase cases12/12 pass. The69-slot,
31-weapon,9-armor,4-inventory and9-outcome independent controls remain intact.
The action consumer browser run passes4/4 with real module cards/provider and
a controlled SDK boundary; its simulated roller is not shared-Core/native UI
acceptance. Durable receipt restart was tested with an adapter-epoch change and
serialized datastore; final installed Core restart remains required. Source
rechecks/ownership/dependency checks precede replay; no privileged receipt is
served after access revocation. No new Core limitation is claimed here.

## SD02-12 implementation and corrected native count oracle — October 18, 2026

The original rare-label fixture now projects `Star Tongue` as rare; `Draconic`
with stored rarity common remains common, and an invalid rarity is unclassified.
No English-name table or unknown→common fallback remains. Ordinary inventory
editing retains unavailable/custom entries, ignores creation quotas and sends
no update on unchanged save.

Creation/advancement share exact fixed grants and four explicit assignment pools.
Missing, duplicate, extra and wrong-pool requests fail before writes. Required
denied language content is an error, not empty success; restored exact sources
create the expected source with unknown fields preserved. Retired context returns
409 before creation. Later advancement cannot smuggle in ordinary language edits.

A direct native `_loadLanguages` oracle corrects the audit probe's implicit Common
assumption: neither Common nor INT adds an unconfigured allowance in this native
workflow. With select0 and a nonempty pool, all native counts are0. An INT+4 input
still has0 when the fields give0. Positive ancestry/class/common/rare pools remain
independent. Fixed Common comes from ancestry source, not a label lookup. The
earlier probe remains historical evidence of module behavior; its inferred
aggregate was not native authority.

`languages.test.ts` passes9/9 rules/real-handler cases. Four actual picker/
Generator browser cases are0/4 against `f5838a8`,4/4 current (including pending
plan retirement and keyboard dialog). All consumers38/38, all fourteen maintained
suites and explicit typing pass. Actual native-method comparisons16/16 and
69/31/9/4/9 controls pass. These are controlled/source/browser results, not native
A02 acceptance. The new Generator creation route uses public caller SDK writes;
installed-host creation/permissions remain D6 proof, with no Core blocker claimed.

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

See the [durable validation record](2026-10-18-adr-0002-validation.md)
for commit contents, finding-specific before/after evidence, artifact paths and
scope qualifications. Generic Core Actor creation still strips string arrays;
this module uses the proven public SDK path. Explicit session-kick recovery is
separate from passing transient reconnect, with no module workaround.
All task services stopped; operator services preserved. No native world was
contacted. **D6 native, D7 final closure and A02-01–15 remain open on both native
generations** pending confirmed disposable-world authority and execution.


## Independent implementation review — October 18, 2026

Reviewed `f5838a86992646cb1742162b918e330f5294bcb8..dbbe93f2f8c5a2f56a95cecd2ea4e777a2f38b66`
on `fix/adr-0002-native-parity`, including runtime checkpoint `50759ae6`.
The module worktree was clean before this review. This pass read source/diffs,
compared pinned native4.0.6 code and ran offline checks with in-memory SDK doubles.
It did **not** contact Core/Foundry, run a browser/live acceptance harness, start a
service or change application source, versions, Git history or remote state.

### Independent checks

- All15 maintained `src/tests/*.test.ts` suites pass (the prior fourteen plus
  `native-parity.test.ts`). Native parity17/17, effect conformance89/89,
  native alignment61/61 and boundaries53/53 retain their results.
- `native-parity.oracles.mjs` passes20/20 selected native-method comparisons;
  its69/31/9/4/9 control counts are retained. These remain controlled methods,
  not a native preparation/browser run.
- Explicit module/UI/hook typing passes with Core0.19.3 and the isolated
  Core0.19.2 floor toolchain. Current Core's module checker passes with zero
  warnings, including SDK boundaries and dry bundles.
- Native reference remains clean at `9677d16b3903b3b640f00d4efd48249142ac8334`.
  The migration catalog/hooks have no changes from the documentation checkpoint.
  The retained archive's SHA-256 independently matches
  `76d127ee33cb463ad93f0ab5f01f0678e3e8c67d1158e106a8d8546e73ac14a3`.
  Packaging, installed UI and native acceptance were not rerun in this pass.

Independent handler probes and logs are retained locally in
`temp/adr0002-review/`. They call real exported module handlers and mutate only
in-memory fixtures. They assert the defects below, so a successful probe exit
means **reproduced failure**, not corrective acceptance. The durable descriptions
below include inputs, results and remediation without depending on ignored files.

### SD02-R1 — high: advancement can report completion before required Item writes

**Open; D3 and A02-03/05/07.**
[Finalization](../../src/server/api/level-up.ts) patches level/XP/HP before its
sequential embedded Item writes. A later failure returns a truthful partial-error
string, but no resumable operation record. The
[level-up hook](../../src/ui/hooks/useShadowdarkLevelUp.ts) treats an observed
target level alone as success, closes the modal and announces `Level Up Complete!`.
An ordinary Actor update event can therefore hide the later Item failure.
This ordering/UI gap predates this checkpoint; the new selected D3 workflow
still relies on it and its existing tests do not cover the combined outcome.

**Reproducer/result:** exact native Knight Class and Witch casting grant, level2,
35XP,8/8HP, valid single Witch tier1 selection and HP roll3. Let the Actor patch
succeed, then refuse the first Item create with an SDK permission error. The
handler returns500 with `Actor updated and 0 of 1 items created`; source is now
level3,15XP,11/11HP with **zero new spells**. Repeating the same request returns400
`Advancement must be exactly one level.` No second write occurs, but the mandatory
spell has no advancement-resume path. The automatic success notification is
source-traced in this review, not freshly mounted/browser-tested.

Native `system/src/apps/LevelUpSD.mjs::_finalizeLevelUp` creates talents/spells
before publishing level/XP/HP. Its absence of a distributed transaction does not
justify showing success for a partially applied module operation.

**Correction/checkpoint:** require an authoritative completed operation result
before success/closure. Publish advancement only after required grants have
confirmed outcomes; retain the existing calculation using all planned native
bonuses. Record exact confirmed IDs and uncertain operations so retry/review can
finish safely without duplicating grants, spending XP twice or guessing outcomes.
Reordering alone is insufficient if some Item writes succeed before another
fails. Exercise first/later Item refusal, lost acknowledgement, final Actor-patch
failure, duplicate request and intervening Actor events; prove accurate UI and
source recovery. Use existing public SDK facilities; no Core change or atomicity
claim is established as necessary by this finding.

### SD02-R2 — medium: the final creation writer bypasses required spell choices

**Open; D3/D5 and A02-03/05/10.**
[The new creation route](../../src/server/api/languages.ts) checks exact identities,
language pools, a casting grant and unresolved Class references, then submits the
client's Actor body to the SDK. It never enforces required starting spell counts
or binds the body to the earlier `level-up/finalize` preparation. UI validation
and an earlier successful preparation are not validation of this final request.

**Reproducer/result:** readable world Class copied from native Wizard, its
unchanged spell progression and all three exact native fixed Talent copies,
readable ancestry, zero language quotas for isolation, and **no Spell Items**.
The Class requires three tier1 spells at level1. `characters/create` returns200
`success:true` and performs one Actor create with zero spells. This is a direct
handler bypass; the normal happy-path wizard was not observed skipping choices.
A changed/stale client submission can reach the same unvalidated write boundary.

**Correction/checkpoint:** share authoritative creation/advancement validation at
the final write boundary, or bind an exact server-prepared creation plan and
revalidate it there. Resolve current exact sources, distinguish required ordinary
spells from granted/extra spells, and reject missing/excess/duplicate/wrong-tier/
wrong-list selections before Actor creation. Preserve unknown source fields and
all native arrays/effects. Cover valid level0 and native caster creation as
positive controls. Ordinary inventory edits and explicitly authorized GM imports
remain separate; do not invent quotas for those workflows or silently exempt the
guided Generator endpoint.

### SD02-R3 — medium: open management retains an obsolete source object

**Open; D4 and A02-06/09. Source-inspection finding.**
[SpellsTab](../../src/ui/SpellsTab.tsx) stores the whole `SpellSource` object in
`manage`. Refresh replaces `derived.spellModel.sources`, but the effect only
closes management if that `classUuid` disappears. It never substitutes the fresh
source when the same Class has a new progression limit or alternate list.
The modal key, owned grouping, addition list, request `listUuid` and limit still
come from `manage.source`. The Actor page deliberately keeps these consumers
mounted through revalidation; clearing picker intent does not refresh this object.

For example, an open tier1 dialog at limit3 still enforces3 after the current
Actor/Class now allows4. If the same Class's alternate list changes, it continues
showing/submitting the old list until closed and reopened. The server does
revalidate current sources/limits: this finding does **not** establish an invalid
server write or bypass of access controls.

**Correction/checkpoint:** retain stable selection identity and derive facts from
the current prepared source, or explicitly retire/rebind the dialog on changed
list/progression identity. Preserve harmless search/manual state where possible;
retire unsafe intent and preserve accurate receipts. Add mounted consumer cases
for same-Class level/table changes and same-Class alternate-list changes, not only
catalog membership, ownership changes or a removed casting grant. Confirm the
next request and displayed count/list use the new source and stale intents cannot
submit. No new mounted/browser run was performed during this review.

### Disposition

The earlier passing evidence is retained. It does not cover these three gaps.
D3/D4 and the final creation-writer part of D5 need corrections before claiming
implementation completion. D6 actual native and D7 closeout remain open on both
generations. No new migration/Core blocker was established; no SDK/version bump
is justified by these findings. F01–F06 and accepted ADR-0001 scope are unchanged.

### SD02-R1 corrective evidence — October 18, 2026

**Corrected offline; native acceptance remains open.** Maintained
`advancement-recovery.test.ts` calls the real finalizer with pinned native Knight
and Witch sources. Ten previously failing cases now pass: first/later refusal,
confirmed-ID continuation, lost create acknowledgement/exact-ID review, final
patch refusal/lost acknowledgement, duplicate concurrent/replayed requests,
restart and interrupted-started records, reopened receipts, replacement-operation
blocking and unrelated-edit rejection. The Knight2/35XP/8HP fixture stays
2/35XP/8HP after grant refusal; completion creates exactly two grants, then
publishes3/15XP/11HP once. Frozen patch retry never repeats grants or XP/HP math.

Two actual mounted-hook cases fail against08997a4 and pass after: an Actor event
at the target level before the response cannot close or notify; partial results
and reopen retain exact request/confirmed IDs. Only `state:complete` completes
UI. Controlled SDK boundary, all browser network blocked. Explicit typing passes
on both Core toolchains; updated native-alignment source-outcome tests pass61/61.
Logs: `temp/adr0002-corrections/r1-{before,tests}.json`,
`r1-browser{,-before}/results.json`, `r1-{floor-types,types,alignment}.log`.
The journal has no distributed-atomicity guarantee. Unconfirmed absent writes,
unrelated changes or stale rules require explicit exact-source remediation;
there is no name/origin matching, automatic recreate or transaction claim.

### SD02-R2 corrective evidence — October 18, 2026

**Corrected offline; native acceptance remains open.** The final creation
boundary revalidates current native choices through shared advancement
preparation and compares the full prepared grant multiset with the submitted
Actor. There is no trusted client quota or hash-only acceptance. World/source
changes retire the old plan; ordinary, innate/fixed and extra-Talent spells do
not substitute for one another. Plan metadata travels through the actual
Generator/useLevelUp path; prepared native data is copied intact.

`creation-validation.test.ts`: ten groups pass. Eight negative groups fail
against08997a4 with real Actor-write outcomes; caster/level-zero positive controls
pass before and after. Coverage includes final-body and plan tampering, missing/
excess/duplicate/wrong-tier/list, stale same-quota source/progression/revision,
native fixed-granted spell exclusion, separate native extra spell, and exact
arrays/effects/unknown fields/source preservation. Original bypass400/zero writes.
Language9/9 and actual mounted collection/Generator41/41 checks pass; explicit
module/UI/hook typing passes on both Core toolchains. Artifacts:
`temp/adr0002-corrections/r2-{before,tests,languages}.json`,
`r2-{types,floor-types}.log`, `r2-consumers/`.
No migration, import quota, compatibility change or Core dependency was added.
