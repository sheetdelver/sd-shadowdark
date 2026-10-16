# Shadowdark module architecture

`info.json` is the compatibility authority. The module requires Core 0.18.0,
UI API 3.1 and module API 1.3; the complete ranges are declared there.

Initialization warms the runtime-backed registry. The adapter then prepares
Actors deterministically for sheets, cards and rolls without writing derived
values back to Foundry. Preserve explicit NPC AC rather than deriving it from
Player equipment rules. Combat stat suggestions are defaults; saved GM choices
take precedence.

Core owns authorization, world/session lifecycle and shared chat/media/dice
presentation. Generator/importer pages own only their resource loading and
Actor-specific operations. Spell-description references are not starting
inventory; do not convert linked templates into owned items implicitly.

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
  (`{ kind, pack, documentType, id }`) because Core's Actor detail response
  rewrites whole `Compendium.` strings into names. Raw reference fields in that
  response are therefore labels, not identities; editors send diff patches and
  never echo them. A terminal ID or name is never treated as an identity.

The registry indexes declared packs only (including the `shadowdark.monsters`
Actor pack). `attach` resets it and a load from an older runtime cannot publish.
World and embedded documents are always read through `req.runtime`, so Core's
caller projection applies; the shared resolver serves declared compendium UUIDs only.

Compendium content reaches callers under one policy, `server/access.ts`. Core
does not expose native pack permissions to modules, so the monster pack is
GM-only on every route that can return it: `document/[uuid]` and every other
caller-bound resolution (`resolveDocumentFor`), `fetch-pack/monsters`, the
`index` name index (monster names are left out for players) and bestiary cards.
System-level reads (`resolveDocument`, `getCollection` without a GM caller) never
serve that pack. The policy is checked on each request, so a GM's earlier read
is not served to a player. When Core provides caller pack capabilities, they
replace this policy on all routes together.

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
potions go through `POST actors/[id]/actions`, which re-reads the Actor through
the caller, requires owner access, refuses unavailable actions before rolling,
rolls through `req.runtime.rolls` and then applies native consequences: lost
spell on failure (not on focus checks), scroll consumed, wand spell lost and
wand broken on a critical failure, limited uses and loss on failure, potion
consumed after confirmation. Consequence writes are sequential, not atomic;
each outcome is reported and the response `state` is `complete` or `partial`.

A `requestId` is bound to the adapter runtime (world/epoch), the user, the
Actor and the request body, for ten minutes (process-local). Repeating it with
the same body re-checks owner access, then returns the first result with
`replayed: true` without rolling or consuming again; reusing it with a different
body is a 409 conflict. A failure before a result exists (refusal, unavailable
action, failed roll call) can be retried. Once a roll is evaluated it is final:
a chat failure after that is returned in `warnings`, and a replay of a
`partial` result re-reads the Actor and applies only the consequences it does
not already show. The sheets send a new id per action, so this replay path
serves client retries of the same request.

World settings: modules cannot read Foundry world settings, so
`logic/world-settings.ts` returns the native registered defaults, marked
`source: 'native-default'` in code. Luck therefore uses standard mode.

Luck presentation (user decision, October 16): no visible label in either mode,
and the unverified setting is not shown in the UI. Pulp off shows only the
centred tick box (`luck.available`). Pulp on shows only a number input
(`luck.remaining`), with −/+ spinner buttons where there is space; the paper
sheet's compact box shows the input alone. Pulp on is not reachable until Core
exposes `usePulpMode`. See the audit's world-settings research note.

Not implemented, stated in the UI: luck spending, rest and recovery, ammunition
consumption (`autoConsumeAmmunition` unreadable), damage auto-roll, duration
expiry and custom change types.

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
the server and ignores client-supplied class objects. The importer resolves
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
labels, because Core's Actor detail response replaces `system.class` UUIDs with
names. Owned physical items also show inventory controls on
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

The Bestiary dashboard tool lists world NPCs visible to the caller and, for GMs,
the declared monster pack (the `server/access.ts` policy above).
It is read-only: no spawn, encounter or sharing action.

## Known alignment limits

[Shadowdark ADR-0001](adr/0001-native-alignment-and-resource-cards.md) and the
[native-alignment audit](audits/2026-10-15-native-alignment.md) record findings,
dispositions and external dependencies. Offline tests and fixtures are not
native/operator acceptance, which remains pending. Development-only 4.1 behavior
is outside the supported baseline.

## Distribution and verification

`info.json` declares the module version and API compatibility. CI/release
workflows currently use the released Core `v0.18.0` toolchain. Release assets
include the package archive, checksum, catalog manifest and release history.
A module release tag identifies the matching manifest version.

Repository workflow and verification commands live in [AGENTS.md](../AGENTS.md).
The shared contracts are described in Core's
[module authoring guide](https://github.com/sheetdelver/sheetdelver/blob/v0.18.0/docs/MODULE_AUTHORING.md)
and [release process](https://github.com/sheetdelver/sheetdelver/blob/v0.18.0/docs/RELEASING.md).

## Independent review limitations (October 16, 2026)

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
This enforcement is pending in Core, and does not change human Assistant/player
module permissions. No module-side role promotion or privileged fallback is allowed.
