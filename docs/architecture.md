# Shadowdark module architecture

**Automatic completion correction (October 19):** SD02-N14-01/02 pass offline
and targeted native v14 checks. The existing caller Actor projection now joins
the shared Actor queue and refreshes only that caller's owned advancement
receipt. A fully dispatched operation with exact final primary source and all
confirmed grant IDs settles automatically; zero-write attempts retire using the
existing policy. This is local bookkeeping, with no Foundry writes or new
world cache. Uncertain/partial/mismatching source remains blocked. A boolean
`advancementPending` exposes review on either sheet independently of XP without
leaking another caller's receipts. Review loads its original request directly,
not a new level's Class/Patron prerequisites. Invalid selection shapes/references
return typed validation errors. See the [native evidence](audits/2026-10-19-adr-0002-native-acceptance.md#automatic-completion-correction-and-native-recheck).
Remaining v14 variants and v13 acceptance are still open; Core/SDK are unchanged.

**Corrective implementation (October 19):** R1b's acknowledgement and receipt
separation and R2/R3 remain covered. SD02-R1a-R1 removes old-source equality from
proven zero-write retirement, preserving independent Actor edits and requiring
fresh preparation. CI now invokes all 17 maintained source suites with the pinned
native reference. The original review and corrective evidence are recorded in
[SD02-R1a-R1](audits/2026-10-18-spellcasting-and-native-parity.md#sd02-r1a-r1--zero-write-actor-edits-still-block-restart-p1).
Native D6/final D7 and A02 acceptance remain open; see the newer v14 record above.

**Active follow-up (October 18):** the post-release 0.9.5
[native parity audit](audits/2026-10-18-spellcasting-and-native-parity.md) and
[ADR-0002](adr/0002-native-data-and-behavior-parity.md) cover newly observed
actor-data omissions, alternate spell lists, owned-spell accounting and selection
safety, plus action phases, Potion identification, NPC focus/outcomes and language
fields (SD02-01–13). The audit includes bounded matching native-method controls,
a model coverage matrix and separately scoped F01–F06 feature proposals.
ADR-0002 implementation is in progress. The released0.9.5 gap descriptions below
are historical baseline; current corrections are recorded here and in its checkpoint record.
Independent review of `dbbe93f2` identified SD02-R1–R3. Corrective checkpoints now
verify durable advancement completion/recovery, final creation spell validation
and current facts in mounted spell management through offline regressions.
See the [review findings and corrective checkpoints](audits/2026-10-18-spellcasting-and-native-parity.md#independent-implementation-review--october-18-2026).
The older acceptance below remains scoped evidence, not a claim that every
historical actor or spell-management workflow has been validated.

**Current status (October18, completed):** ADR-0001's selected native alignment,
resource cards and G8 adoption are accepted on actual Foundry13.351/14.367 with
native Shadowdark4.0.6 and Core0.19.2. The [final ADR closeout](adr/0001-native-alignment-and-resource-cards.md#final-native-v14-acceptance-and-closeout--october-18-2026)
records evidence and retained qualifications. Explicit feature deferrals and
CG-4/6/8 remain separately qualified; historical pending text is not a new queue.

The [adoption evidence](audits/2026-10-15-native-alignment.md#core-0192-adoption-implementation--october-18-2026)
separates controlled results from the completed native acceptance. Resource dialogs
clear floating tools at active layer160 and lower to90 while suspended beneath
the shared SDK roller/confirmation. Phone footer actions remain reachable while
the host retains its shared dialog focus/lifecycle.

`info.json` is the compatibility authority. Its Core floor is **>=0.19.2**;
the CI checkout, reusable release workflow and `core_ref` select **v0.19.2**.
Module API `>=1.6.0 <2.0.0`, UI API
`>=3.2.0 <4.0.0` and roll-engine API `>=1.0.0 <2.0.0` remain unchanged. Aggregate
SDK 3.4.0 is informational and has no manifest field. `info.json` owns the module release version; SDK/API versions do not change
with a module point release.

Initialization warms the runtime-backed registry. The adapter then prepares
Actors deterministically for sheets, cards and rolls without writing derived
values back to Foundry. Preserve explicit NPC AC rather than deriving it from
Player equipment rules. Combat stat suggestions are defaults; saved GM choices
take precedence.

Core owns authorization, world/session lifecycle and shared chat/media/dice
presentation. Generator/importer pages own only their resource loading and
Actor-specific operations. Spell-description references are not starting
inventory; do not convert linked templates into owned items implicitly.

## Caller spell preparation

`logic/spell-model.ts` supplies owned Item-ID rows, exact identity/list/grant
inputs and explicit known/unavailable progression limits. `callerLookups` reads
only the selected Actor's bounded dependencies through public caller capabilities;
these never enter the registry. The sheet's caller-view route uses the same
preparer as actions, compares source reviews around awaited reads, and rejects
stale results. ActorPage retires responses by Actor, caller, role, world and
connection; public Item/context events refresh dependency results.

Advancement uses the exact alternate list, the Actor Class's own table and native
planned/active grants. Mandatory tier choices are validated before all writes;
missing catalogs and invalid progression do not waive choices. HP/XP computation
is unchanged. Generic Core preparation remains synchronous and user-invariant.

The spell picker consumes `derived.spellModel` owned rows and the shared caller
spell catalog. Management sends exact additions and owned Item-ID removals to
`actors/:id/spells/manage`; it never subtracts the catalog from inventory. The
server validates the reviewed source, list, tier, progression limit and native
source filters before writes. Adds run first and stop removal on failure or
uncertainty. Durable module operation receipts preserve confirmed identities;
unknown creates require explicit inventory review. The process queue is not a
distributed transaction. Partial receipts from another process require fresh
review; completed receipts never repeat their writes.

`fetch-pack/spells` and `spells/list` use one catalog over readable declared packs
and caller-visible world Items. The collection store retains rows plus explicit
partial-source warnings/retry, under its existing world/caller/context lifecycle.
Native `sourceFilters` is a world Array (default[] proven4.0.0–4.0.6) read from
Core context, filtering choices by native source title without changing owned
items. Known exact undeclared-pack reads and catalog discovery are separate.
The picker uses ModuleDialog, shared range/duration facts and separate owned
removal/addition controls. Search survives refresh; authority changes retire intent.

## Known spell workflow gaps in 0.9.5

Casting actions are shared, but spell management is not yet a unified model.
`SpellsTab` derives class sources/counts/limits; `SpellSelectionModal` represents
selection by catalog UUID; adapter/server level-up uses another class/list path.
The current picker omits source-less owned spells, collapses duplicate origins
and can derive removals from missing catalog rows. Add failures do not stop its
subsequent removals. These are SD02-03–07 correction targets, not supported
inventory semantics. Paper/tabs/cards must retain owned Item identity and the
same source-based availability reasons in the proposed replacement.

Native casting eligibility comes from active grants. A class's casting ability,
its alternate spell list and its progression table serve different purposes.
Knight of St. Ydris uses the Witch list with Knight's own spells-known table;
current advancement ignores that list override. Missing Class references on a
Spell and missing casting grants on an Actor need separate diagnostics and a
proven repair disposition, not class-name or spell-name inference.

Current synchronous lookups use declared pack data. Public Core 0.19.3 supports
caller world/embedded reads and exact known, present compendium UUID reads;
connecting these bounded dependencies to preparation is module work to prove.
Arbitrary pack catalog discovery is a distinct capability question. Native
`sourceFilters` is not yet declared/consumed by the module. The existing world
Array-setting contract can support it without inventing a settings transport.

These statements describe observed current gaps. Proposed remedies, acceptance
and historical-data qualifications are owned by ADR-0002 and its active audit.

## Native language inventory and creation choices

`logic/languages.ts` projects stored rarity and validates exact fixed grants plus
separate ancestry/class/common/rare pools. Unknown rarity is explicit. Counts
come from native Class/Ancestry fields; there is no inferred Common/INT allowance
or Background pool. A nonempty selectOptions array with select0 grants nothing.
Native Number/Array initial values are0/[]; invalid/required unavailable inputs
block creation instead of providing a guessed rule. Fixed/restricted refs resolve
exactly through the caller, separate from browsing/discovery.

The caller language-plan route supplies one bounded form plan and current readable
rows. Generator and advancement use it with the shared generation lifecycle and
accessible choice controls. The module creation route validates assignments before
public SDK Actor creation; advancement validates before HP/XP/items and checks its
Actor source/context again. Existing languages survive advancement.
Details and the ordinary inventory picker impose no creation quota, classify by
source field only, retain custom/unreadable entries and make unchanged saves a
no-op. Actor identity exposes current caller-readable language rarity/labels.

## Released0.9.5 action and language baseline before ADR-0002

The released baseline executor spent limited uses after the result, despite native
spend-before-roll/chat ordering. Potion use posts before identifying and updates
only the identified flag; native also swaps name/description and enables effects.
Incomplete consumption therefore leaves inconsistent source. NPC spell failure
inherited the Player focus exemption. Shared outcome evaluation treats
a zero critical-success threshold as always successful, while native disables it.
SD02-09/10/11/13 define corrections and ordered-state/failure evidence.

Registry and language UI infer rarity from names, ignoring `system.rarity`.
The general language-limit helper also infers allowances from nonempty pools and
combines restricted choices. Native fields already provide explicit counts and
separate class/ancestry pools; ordinary language editing has a distinct contract.
SD02-12 plans one field-based projection and validation path across consumers.

New controlled comparisons match native defaults for 31 weapons, 69 physical
item slot records, nine no-effect armor configurations, four mixed inventory/coin
configurations and nine ordinary roll outcomes. These are bounded source/method
comparisons; they neither establish whole-system parity nor replace A02 native
acceptance. The twelve existing offline suites pass despite the new defects.

## Initiative

Preparation exposes `derived.initiative.value` and `derived.initiative.advantage`
from Player DEX or an explicit NPC modifier, initiative bonus and supported
numeric effects. Native 4.0.6 source fields include
`system.roll.initiative.bonus` and `system.roll.initiative.advantage`.
A modern zero advantage overrides legacy advantage arrays. Keep signed zero
explicit in the formula, such as `1d20+0`.

Core resolves a saved GM override first, then the module formula, then its
generic fallback. A GM reference must exist on the current prepared Actor;
`@derived.initiative.value` is the prepared modifier path.
The SDK roller frame displays the resolved formula/audience read-only and
returns a roll choice or final manual total. It does not execute native
Foundry browser hooks or import the sheet's bonus/audience controls into the HUD.

## Source, prepared view and identity

Native authority is released Shadowdark 4.0.6 (`release-4.0.6`). The adapter
prepares one module view from serialized source and publishes it as `derived`
(`computed` is an alias of the same object). It is SheetDelver's preparation of
native rules, not native browser-prepared data. Preparation never mutates source:
raw items, effects and reference fields stay as Foundry stored them.

- `logic/effects.ts` reads ActiveEffects in both shapes: Foundry 14
  `system.changes` (string `type`, `phase`, `priority`) and legacy top-level
  `changes` (numeric `mode`). When both are present, `system.changes` wins, as in
  Foundry 14 `migrateData`. Owner-qualified refs (`ActiveEffect.<id>`,
  `Item.<itemId>.ActiveEffect.<id>`) address writes; the serializer writes the
  effect's own shape and keeps unknown change fields. Suppression (stashed,
  unequipped Weapon/Armor, unidentified), transfer and situational state follow
  native `ActiveEffectSD`.
- `logic/actor-preparation.ts` follows `PlayerSD`/`NpcSD`: `base` → `value`
  migration, `initial` then `final` effect phases ordered by priority, bounded
  Player modifiers (−4..+4), explicit NPC modifiers and AC, native best/bonus
  armor AC, slots `10 + effects + max(0, STR − 10)`, spellcasting classes and
  initiative. Effects on `system.bonuses*` and `system.attributes.ac` are
  rejected as in native `applyRules`.
- `logic/formula.ts` resolves numbers, `@path` references, arithmetic, rounding
  functions and dice terms without `eval`. A missing reference is a failure with
  a diagnostic, never zero.
- `logic/roll-keys.ts` ports `_getActiveEffectKeys` for `system.roll.*` selectors
  (ADD, then MULTIPLY, then OVERRIDE). Situational effects are listed as options;
  the roll UI does not select them yet.
- `logic/identity.ts` parses exact UUIDs. Views carry structured references
  (`{ kind, pack, documentType, id }`) with prepared labels. Core 0.19 keeps
  canonical source strings in Actor responses and adds a separate,
  caller-filtered `referenceLabels` map (Core 0.18 rewrote `Compendium.` strings
  into names); the sheets and cards present the prepared labels, so neither
  response shape shows a raw UUID or loses a label. Editors send diff patches and
  never echo reference fields. A terminal ID or name is never treated as an
  identity. Prepared labels come from user-invariant preparation, so a label for
  a reference held by a visible Actor is part of that Actor's projection.

The registry indexes declared packs only (including the `shadowdark.monsters`
Actor pack). It is a system-level warmed projection used for user-invariant
preparation lookups. `attach` (a new runtime) and `refresh` (a world-context
change) start a new generation: a load from an older generation cannot publish,
and the previous projection keeps answering synchronous lookups until the new one
replaces it whole. World and embedded documents are always read through
`req.runtime`, so Core's caller projection applies; the shared resolver serves
declared compendium UUIDs only.

Compendium content reaches callers under one policy, `server/access.ts`: Core's
effective native pack capability for the calling user,
`req.runtime.access.canReadPack(pack)` (module-api 1.5). It applies to every
pack, as the world's compendium ownership configuration sets it, and to every
serving path: `document/[uuid]` and every other caller-bound resolution
(`resolveDocumentFor`, `resolveReadable`), `fetch-pack/*` collections, the
`index` route and Core's `/api/system/data`, bestiary list and cards, class spell
lists, level-up sources and table draws, effect choice options, the generator and
the importer. Rows are filtered after the awaited cache read and single documents
are checked before and again after it, so a revocation applies to warm caches at
once and a GM's earlier read is never served to a player. There is no system-level
serving path and no fallback: a runtime without `access` reads no pack content.
A collection whose rows are all unreadable is refused (403). Core 0.19.2 applies
native role ownership on both Foundry 13 and 14 (a Player reads packs that grant
`PLAYER: OBSERVER`); the module adds nothing to Core's answer.

`getSystemDataForUser` (the host hook behind `/api/system/data`, also served by
the module `index` route) builds the caller's name index and class titles from
the caller's own `compendium.findAll` reads, rechecks each row against `access`,
and adds the native rule tables. It never returns the warmed projection. The
legacy `getSystemData` remains for Core's full-GM path.

Effect keys follow native 4.0.6. `logic/effect-key-coverage.ts` maps every key
in the pinned native packs to its consumer (actor data, roll-key selector, choice
template, native no-op, or out of scope such as scene light). Pre-4.0 keys
(`system.bonuses.*`, `system.abilities.<stat>.bonus|base`, and others in native
`Update_251001_1`) are not applied, matching native. Each is reported on its
effect with the native 4.0 replacement (`logic/legacy-effect-keys.ts`). Effect
definitions come only from compendium documents and the generated
`data/native-predefined-effects.ts`. Languages added by effects appear as
granted, not as editable languages. Level-up HP rolls apply
`system.roll.hp.advantage`.

## Actions and consequences

`logic/actions.ts` is the single action preparer for checks, weapon and NPC
attacks, owned/scroll/wand/NPC spells, Class Abilities and potions. Sheets,
cards, dialog defaults and the server use it. An unsupported situation is
`available: false` with a reason; there is no generic d20 fallback.

Each Weapon attack mode is a separate action with its own label: the weapon's
type (Melee or Ranged), an added Thrown attack for Thrown melee weapons, and for
Versatile weapons both grips (one-handed and two-handed damage), stored grip first.
Native rolls one stored grip and toggles it on the sheet; SheetDelver offers both
as actions without writing the grip. A two-handed grip is unavailable while a
shield is equipped. Sheet attack lists and inventory details omit unavailable
modes; the item card shows them disabled with the reason. The server only rolls
modes the weapon has.

Attacks roll through the existing item-roll hook. Spells, Class Abilities and
Potions use the owner-bound module action route and one common preparer.
`planPrerequisites` runs before the result: a limited ability spends first; an
unidentified Potion swaps active/alternate fields and activates every owned
effect by exact parent/ID. The effect group follows native Promise.all semantics.
Only successful prerequisites permit roll/no-check chat. Potion use then deletes
the whole owned Item, independent of quantity. Partial source remains explicit.

An Actor operation queue serializes module action/management requests in this
process. It is not a distributed CAS/transaction. Write-ahead operation receipts
through SDK DataStore bind world, caller, Actor, request and body; they contain
operation outcomes, not a second world store. Unknown spend/result calls stop;
the same request never rolls/posts/spends again after an uncertain result. A
known result can retry outstanding consequences after fresh source/ownership/
dependency checks. Completed durable receipts replay without writes. Partial
receipts without their process continuation need fresh review after restart or
lease expiry. No automatic claim resolves a lost upstream acknowledgement.

The Actor provider retains the exact request for explicit recovery. Its dialog
suspends the resource card and distinguishes pending prerequisites, uncertain
results and outstanding consequences. Actor/unmount changes retire UI results.
Player owned-spell actions alone allow focus to exempt loss; NPC cards hide it
and the server applies NPC loss even to a crafted focus request. Scroll/Wand
rules remain distinct. Zero disables critical thresholds, missing thresholds
retain native defaults, and manual totals establish no natural critical.

World settings: `info.json.worldSettings` declares the two native settings the
rules use, `shadowdark.usePulpMode` (default false) and
`shadowdark.autoConsumeAmmunition` (default true): world-scoped Booleans,
identical in native releases 4.0.0–4.0.6, so declared for exactly that range,
`affectsPreparation: true`, `exposure: authenticated`. Core resolves each to the
stored world value, the declared registered default when no world row exists, or
unavailable (not ready, unsupported native version, invalid value).
`logic/world-settings.ts` turns a Core snapshot into rule inputs and never
substitutes a default for an unavailable value. Preparation reads
`context.world` and records the inputs and their context revision in
`derived.ruleInputs`; request routes read `req.runtime.world`; the browser reads
the prepared Actor. Re-preparation for an option-dependent roll uses the Actor's
own recorded inputs. No route reads Setting documents, localStorage or Actor data
for these values.

Luck: `derived.luck.mode` is `pulp`, `standard` or null (unavailable), with
native `hasLuckToken`. Presentation (user decision, October 16): no visible label
in either mode. Standard shows only the centred tick box (`luck.available`);
Pulp shows only a number input (`luck.remaining`), with −/+ spinner buttons where
there is space; the paper sheet's compact box shows the input alone. The "Luck"
box headings stay. Unavailable shows an inert placeholder whose accessible name
and tooltip give the reason; no mode is guessed. Writes go through
`POST actors/[id]/luck` with the mode the sheet showed and the Actor's prepared
context revision; the route re-reads the mode from the request's world context
and refuses a stale or unknown mode (409) before writing the caller's own patch.

Ammunition: with `autoConsumeAmmunition` on, a Player weapon with an
`ammoClass` states native's behavior (one ammunition per attack, refused without
any) and that SheetDelver does not consume it; off, nothing is stated; unknown,
a diagnostic says so. Consumption itself is not implemented.

World context changes: Core calls `onWorldContextChanged` before it rebuilds
prepared Actors. A setting-only change needs nothing from the adapter (values
reach preparation through `context.world`); a declared pack change or same-world
recovery rebuilds the registry before the hook returns, and a failure rejects so
Core keeps the world unavailable. The rebuild reads Core's compendium cache:
content Core itself did not re-read (for example a pack edited in Foundry while
SheetDelver was disconnected) is not seen until Core does (audit CG-4). Setting-dependent requests (actions, rolls,
luck) send `X-SheetDelver-Context-Revision`; Core refuses a stale one (409) and
the page reloads the re-prepared Actor. When the context changes while a request
is already running, Core fails the request runtime's reads with a plain `Error`;
the index, collection, luck and action routes check `world.assertRevision`
against the revision captured at the start (`server/access.ts`
`contextConflict`) and answer 409 instead of an internal 500.

The browser's caller-scoped caches (`ui/context/system-index-store.ts`, used by
`ShadowdarkUIProvider`) belong to one world, user, role and connection. A change
of any of these, Core's `world:contextChanged` event or a manual retry starts a
new generation: in-flight requests are aborted, the retry timer cleared, late
responses discarded, the index and collection shards dropped, and a replacement
index request starts at once, even while the first request is still pending.
The index request ends in current data or an explicit, retryable failure (the
sheet shows an alert with Retry). Each collection independently records loading,
ready or failed, including a denied/unavailable/read-error reason. An HTTP 200
array, including `[]`, is ready; an invalid response, denied read or failed read
never populates a successful empty cache. Collection retry retries failed shards
and preserves successful shards. There is no automatic collection failure loop.

`useShadowdarkCollections` registers active demand in that same store. Mounts
before index readiness wait for the current index; a context/caller/role/world/
connection change reloads each demanded shard after its replacement index is
ready. Requests are deduplicated across consumers. The last consumer leaving
aborts unused pending reads and settles their promises; retirement discards late
results even when transport ignores abort. Provider renders also mask data from
a different scope before its layout effect applies that scope. Gear retains
search and expanded categories, Spells and the spell/language/mastery/details
pickers show collection-specific failures and Retry, and dependent selections
are gated until current data is ready. Generator requires ancestries, classes,
backgrounds, deities and languages for both modes, and patrons for level 1.
It derives identity documents from current full collection rows; document reads
and derived async results are retired on generation changes/unmount. Manual form
values survive refresh; missing selected identities must be selected again.

For the index, 5xx, 429 and 409 responses are retried with backoff;
other client errors fail at once. The action replay key
does not include the context revision and recovery does not change the adapter
generation, so a replay after a context change returns the recorded result and
never rolls again.

Not implemented, stated in the UI: luck spending, rest and recovery, ammunition
consumption, damage auto-roll, duration expiry and custom change types.

## Weapon and mastery preparation

Weapons use native 1h/2h damage and properties resolved by exact declared-pack
UUID; blank handedness follows the native rule. STR is never added to damage
implicitly. Missing damage stays **Damage unavailable** with the source field.
Thrown modes are separate attack rows. `NPC Attack` uses its own damage, ranges
and item bonuses. Inventory shows **Base damage** separately from **Actor
damage**. A Foundry 14 Weapon Mastery effect (`type: "add"`, value
`1+floor(@level.value/2)`, `phase: "initial"`) gives a level-1 STR 9 Longsword
`+0 d8+1` on every surface.

Mastery and other choices come from declared base weapons/armor/spells and the
39 native predefined effects. `REPLACEME` is resolved in both shapes; unresolved
required choices block creation before any write. Fixed/rolled grants keep exact
counts. Learning a spell validates a Spell source on the class list and copies
the full document with `_stats.compendiumSource`. Level-up resolves grants on
the server and ignores client-supplied class objects. Finalization follows native
4.0.6 `LevelUpSD._finalizeLevelUp`: advancement from level zero sets XP to zero;
otherwise it subtracts the Actor's current level × 10 and preserves the remainder
(level 1 with 25 XP becomes level 2 with 15 XP). This is the server's single XP
write path for advancement; it does not repair previously discarded XP.
`logic/advancement.ts` shares HP calculation between Generator and server:
prepare the assembled grants first; level1 replaces HP with `max(hit die +
prepared CON modifier, 1)`, while later levels add the die to prepared current
and maximum HP, retaining wounds. Existing Actor HP is not retrospectively
repaired. The level-up UI reads bare documents from the module's caller-safe
`document/:uuid` route; missing required references block completion.
The importer resolves
references first and asks for confirmation before creating unresolved or custom
items. Existing Actors are not repaired.

## Sheets, cards and bestiary

Both layouts read the prepared view. Edits are Actor-scoped drafts with
debounced writes cancelled on Actor change, sequenced responses, optimistic
rollback with an error, and shared confirmation dialogs. The paper sheet lists
every attack. Selecting a spell, item or feature opens one module dialog
(`ResourceDetailModal`) built from `logic/resource-cards.ts`. On tablet and
desktop the card is 24rem × 24rem and grows to 34rem wide and 88dvh tall for
longer content; phones use the full width. Cast and Use
delegate to the shared action and open the SDK RollDialog above it, and Drink
asks for confirmation. An owned spell card's Class comes from the prepared view's `spellClasses`
labels (robust to both Core 0.18's name rewrite and Core 0.19's preserved UUIDs). Owned physical items also show inventory controls on
their card (Equip/Unequip for Weapon and Armor, Stash/Retrieve, Light/Put out
for native light sources, quantity). `logic/inventory-controls.ts` follows the
native sheet handlers: equipping clears stashed and stashing clears equipped;
equipping a shield switches equipped two-handed Versatile weapons to one hand
and unequips other two-handed weapons; lighting a source puts out any other lit
source. Light sources come from `system.light.isSource`, not item names. The
inventory row uses the same helper. Scene light, light chat cards and the light
tracker are not run. Cards show
the current identified presentation only, never the alternate identification
fields. Descriptions go through `logic/description.ts` and the SDK sanitizer.

The Bestiary dashboard tool lists world NPCs visible to the caller and, when the
caller's pack capability allows it, the declared monster pack (the
`server/access.ts` policy above).
It is read-only: no spawn, encounter or sharing action.

## Known alignment limits

[Shadowdark ADR-0001](adr/0001-native-alignment-and-resource-cards.md) and the
[native-alignment audit](audits/2026-10-15-native-alignment.md) record findings,
dispositions and external dependencies. Offline tests and fixtures are not
native/operator acceptance, now completed for the selected scope above. Development-only 4.1 behavior
is outside the supported baseline.

## Distribution and verification

`info.json` declares the module version, API compatibility and world settings.
CI checkout, the reusable release workflow and its `core_ref` all use the
Core `v0.19.2` toolchain. CI also runs on `migration.json` and
`migrations/**` changes. Release assets include the package archive, checksum,
catalog manifest and release history. A module release tag identifies the
matching manifest version. With the root `migration.json`, packaging compiles
each hook to confined `.cjs`, rewrites the packaged definition and writes a
`sheet-delver-release.v2` manifest whose catalog digest and step count Core
derives from the packaged catalog.

Repository workflow and verification commands live in [AGENTS.md](../AGENTS.md).
The shared contracts are described in Core's
[module authoring guide](https://github.com/sheetdelver/sheetdelver/blob/v0.19.2/docs/MODULE_AUTHORING.md),
[world context and migrations](https://github.com/sheetdelver/sheetdelver/blob/v0.19.2/docs/MODULE_MIGRATIONS.md)
and [release process](https://github.com/sheetdelver/sheetdelver/blob/v0.19.2/docs/RELEASING.md).

## Effect-key migration

Stored pre-4.0 effect keys are repaired only by Core's admin-approved maintenance
job, never by a module route, initialization, preparation or rendering. The root
`migration.json` names the native milestone `4.0.6`; `migrations/4.0.6/` holds
`definition.json` (`dataReadVersion` `>=4.0.0 <=4.0.6`) and synchronous pure
`check`/`plan`/`verify` hooks over `effect-keys.ts`, which uses
`logic/effect-key-migration.ts`. Both steps share those hooks and the parameter
`nativeSpellSlugs`, generated from the native spells pack.

| Step | Required | Targets | Reads |
| --- | --- | --- | --- |
| `shadowdark-effect-keys-4.0` | yes | `ActiveEffect`, `ActorDelta` | relations: `parent` and `baseActor`, field `type` only |
| `shadowdark-effect-keys-4.0-world-packs` | yes | `WorldPack` | relation: `parent`, field `type` only |

Paths are `changes` and `system.changes`. Neither step declares whole-kind
`reads.targets` or `reads.packs`, so each hook receives only its target and the
projected `type` of the related documents, and Core can refresh just the
affected roots during execution. `ActorDelta` is a target kind (the hooks report
non-effects as current) because Core enumerates unlinked token deltas only when
that kind is selected; their Items and effects then arrive as `Item` and
`ActiveEffect` targets with `baseActorUuid`.

Scope and results follow native `Update_251001_1`: Player Actor-level effects and
every Item effect, `.this` keys for Weapon parents, each effect's stored shape,
order, unknown fields and priorities kept, Weapon Mastery's extra change appended,
and keys native cannot migrate left alone. Parent types come from Foundry's own
merge rules, never a guess:

- A token delta's `type` is optional; `ActorDelta.applyDelta` drops a null or
  absent value, so the base Actor's type applies, and a stored delta type wins.
- A token delta Item is a complete Item that replaces the base Actor's Item of
  the same id; Foundry never merges the two (`#mergeEmbeddedCollection`) and
  validates it against the full Item schema. Its type is its own stored `type`.
  A delta Item without one is invalid in Foundry and has no inherited type, so
  its effects block with that identity. There is no base-Item lookup.
- A missing parent relation, an Actor or Item without a stored type, or a
  spell-advantage value that is not a native spell (by slug or SheetDelver 0.9.4's
  stored name) is unresolved with an actionable reason. In the required step
  this blocks the world until it is repaired in Foundry; Core shows the reason
  to administrators.

World-owned Actor/Item packs are covered by a required step: every eligible
effect must verify before readiness. Pack-only legacy data requires maintenance;
an unresolved effect blocks with its identity and repair reason. System and
package packs, tombstones and lazily null deltas are not targets.

**Strict lock policy (RV-09):** Core 0.19.2 refuses enumeration when any world
Actor/Item pack is locked or unreadable, even if its effects might be current.
The module leaves its lock, permissions and contents untouched. The catalog
description explains that administrators must inspect those pack locks and
service-account access in Foundry, then retry/check/review; retry is not write
approval. Intentionally locked packs cannot currently be excluded while requiring
every eligible unlocked effect. That policy would need a Core provision for
scoped enumeration and visible exclusions. `required: false` does not express it.
Core 0.19.2 corrects CG-7: an absent or null lock override defaults to unlocked
for proven world packs; metadata is not an override. Unavailable/malformed
configuration and unresolved provenance still block. The strict module policy
does not acquire an intentional-lock exclusion merely from this correction.

Core 0.19.2 plans the complete inventory in its own workers with no global
deadline (each hook keeps Core's one-second bound). Because `dataReadVersion` is
`>=4.0.0 <=4.0.6`, Core refuses to serve a world whose native system version is
outside that range while this catalog is installed.

## Independent review limitations (October 16, 2026)

*Superseded by the Core 0.19.1 implementation (October 17): RV-05 and RV-08 are
fixed with offline and isolated real-Core evidence; RV-06 has isolated real-Core
recovery evidence; the migration catalog is active. The paragraphs below are the
historical review-time state.*

The [independent review addendum](audits/2026-10-15-native-alignment.md#independent-review-addendum--october-16-2026)
qualifies the supported behavior described above. The module-only corrections
are in place and covered offline (see the audit's
[module correction pass](audits/2026-10-15-native-alignment.md#module-correction-pass--october-16-2026)):
one compendium caller policy on every route (RV-01), request identity and
reconciliation for action replays (RV-03) and spell card classes from prepared
labels (RV-04). The migration prototype route and hook were removed; the pure
planner `logic/effect-key-migration.ts` remains, with direct planner and
serializer tests, for Core's eventual runner (RV-02). No caller can migrate
data today; existing Actors keep their stored keys, which are reported.

Still open: the native-default settings seam does not read the current world
setting (RV-05; the luck presentation itself is the user's decision above, not a
pending correction), and registry attachment reset does not cover Core's
retained adapter on same-world recovery (RV-06). Both need the Core contracts below.

Core ADR-0064 proposes bounded settings/context and permission contracts. Its
migration design is now an admin-owned release upgrade job: the module provides a
separate migration.json catalog/version-directory definitions with pure
check/plan/verify hooks, while Core previews, authorizes, gates access,
executes and verifies changes across restart. No module maintenance-write runtime
or owner repair fallback is selected. Ordinary bootstrap may resume an approved
job but cannot start new repairs. It must check fresh data even when its ledger
says complete, blocking world readiness after an incompatible external restore.
Native-user lockout and world backup/undo are excluded; admin receives a backup
limitation warning. World-setting context continues to refresh live.
Nothing in this module currently implements those proposed APIs.
Native/operator acceptance and real host-boundary checks remain pending; the
module's ADR stays open.

Core ADR-0064 G0a also requires a full-Gamemaster **service account** for every
world connection, with lower-role/demotion blocking and admin correction/retry.
This enforcement shipped in Core 0.19.0 and does not change human Assistant/player
module permissions. No module-side role promotion or privileged fallback is allowed.

## Pack-permission signal boundary (CG-9)

Core 0.19.2 advances the world-context revision on effective ownership changes,
restoration and override removal. The normal `world:contextChanged` publication
may have empty `keys`; the module invalidates on the event itself, not on a
specific setting name. Core keeps raw ownership data private. New generations
retire index and collection requests, clear cached data, and refetch mounted
consumer demand. Fresh failures show explicit reasons and retry. The module
must verify these paths through the installed host as well as the controlled
consumer suite; it must not add privileged Setting reads or polling. This fixes
the ownership-only signal gap reported on 0.19.1, not the separately recorded
CG-4 content-freshness concern across an offline interval.

Required creation/advancement fixed references fail before writes if unavailable.
Native talents and separate talentChoices are not interchangeable. Exact caller
Class dependencies are authoritative; copied origins cannot fill a missing read.
Secondary grants retain owned inventory with unknown progression. Historical
missing grants/refs require the reviewed exact-source remediation guide; published
migration history is unchanged.

The module Actor view is a bounded caller SDK read, dependency resolution and
independent source re-read, normalized once with a compact review token. Context
changes retire visibility/interactions while mounted UI state awaits current
authority. Fetch callback identity is not a world scope. Class collection browsing
is not a prerequisite for an already resolved world Class. Catalog world pages
follow the SDK's zero-based contract.

Identity labels follow the exact reference. An owned copy is a label source only
when the reference itself addresses that Actor+embedded Item. Caller identity
lookups remain bounded and permission-checked. Hidden/absent action Actors return
404; explicit owner denials retain403, including durable receipt replays. Explicit
native session kicks and ordinary transport loss have separate recovery evidence.

Owner-bound workflows share an SDK guard that distinguishes a visible non-owner
(403) from hidden/absent source (404) using observer visibility only after an
unsuccessful strict owner read. No denied operation writes. Pending action UI
callbacks retire with context/scope; late results require source review and cannot
authorize replay under a new context. Generator SDK creation avoids the generic
Core Actor writer's demonstrated string-array cleaning.

World Item detail/directory hints coalesce into the same collection generation
invalidation as context changes; pending catalog responses retire and open pickers
retain search. HP rolls read the exact referenced Class die, never an unrelated
owned copy or an unavailable-source fallback.

Final controlled evidence and package identity are recorded in the
[ADR-0002 validation record](audits/2026-10-18-adr-0002-validation.md).
Actual native A02-01–15 acceptance remains open on both generations.

### Advancement operation completion

`server/advancement-operation.ts` persists a bounded advancement plan/receipt,
not world data. Grants run before the frozen Actor patch. Exact confirmed IDs
survive retries. A proven zero-write refusal/stale attempt retires durably and
requires fresh preparation; partial refusals can resume, while uncertain outcomes
stop for explicit exact-source review. Pending partial advancement blocks replacement requests.
Restart continuation requires review; unavailable/changed rules and unrelated
Actor edits require remediation rather than guessing. The mounted workflow uses
a completed operation response, never a level-change event, as its success signal.

### Final Generator write validation

Level-one `characters/create` repeats the authoritative new-character advancement
preparation, checking exact identities, current revision and canonical grant
review against both the earlier prepared plan and the final submitted Items.
Counts/lists/tiers and complete native source fields must agree; a client plan
hash alone is never trusted. Generator copies prepared grants intact and forwards
the choices/review. Gear keeps its separate creation flow. Level-zero creation,
ordinary inventory edits and authorized GM imports retain their own contracts.

### Open spell-management facts

SpellsTab stores Class UUID/tier identity, deriving current source/list/limits
from the latest prepared view. The modal stays mounted across alternate-list
changes; search/details survive while intent is masked against new authority
facts. Stored operation requests/receipts remain bound to their original list
and IDs and are never rebound as new intent. Retry errors preserve known receipts.

Corrective archive verification runs compiled public apiRoutes against the public
SDK test runtime, independently of source-route tests. Advancement responses
expose operation receipts rather than saved grant payloads. This offline contract
evidence does not satisfy deployment's full-GM guard or native acceptance.

Proven zero-write attempts retire automatically after current owner/caller and
context verification. Durable no-write receipts permit retirement even when an
independent Actor edit invalidates the old source snapshot. Preserve current
Actor data and require a new current plan. The pre-write source guard returns
the retired result immediately when it discovers such an obsolete attempt.
Partial writes retain the source-restoration check.
Only a durable terminal disposition releases the
active block; retained journals can never replay after retirement. Operation
reviews share the Actor queue with writes, so review cannot retire in-flight work.
Partial operations retain explicit reconciliation and independently verified
restoration controls, without module rollback or stale-rule replay.

Native SDK acknowledgements, primary-source verification and journal persistence
are separate outcomes. Returned Item IDs remain authoritative after a receipt
save fails. Acknowledged grants reconcile their own exact IDs, full planned
source and Actor parent; other grant/operation IDs are excluded. Receipt or
verification failure stops later writes and cannot downgrade an acknowledged
creation to an uncertain outcome or authorize another creation. Reconciliation
must persist first. Lost acknowledgements/failed reads never establish zero writes.
A total journal outage leaves the durable started fence; an exact response ID
must be retained for later review. No distributed transaction/CAS is implied.
The mounted workflow retires old review reads across write attempts, preserves
known receipts on errors, uses the current review revision and reports completion
only from the confirmed full-operation response. See [recovery](advancement-recovery.md).
