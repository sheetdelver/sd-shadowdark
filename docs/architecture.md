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

## Weapon and mastery preparation

Native 4.0.6 weapon preparation is shared by attack summaries, sheet dialog
defaults and server attack rolls in `logic/weapon-rules.ts`. Resolve properties
by exact declared-pack UUID/name-index lookup; use native 1h/2h damage and
never add STR to damage implicitly. Missing damage remains unavailable.
`prepareWeaponBase` reads the selected native hand only; blank handedness derives
from an exact Two-Handed property or an absent one-handed/present two-handed die.
Player `damage.value` is not a substitute. Native `NPC Attack` uses its separate
`damage.value`, ranges and item bonuses, without Player mastery/ability modifiers.
Inventory rows and paper item details label **Base damage** separately from
**Actor damage**; Abilities/paper attacks show Actor-adjusted damage. Missing
damage carries the exact source field diagnostic rather than invented dice.
Thrown melee/ranged modes are distinct. Numeric roll effects support native
selectors, ADD/MULTIPLY/OVERRIDE and bounded arithmetic references (including
`1+floor(@level.value/2)`). Situational effects remain unselected; unsupported
effects carry preparation warnings. This is not full Foundry hook/effect parity
or a migration to the previously inspected 4.1.0 development reference.
Numeric damage effects aggregate ADD, then MULTIPLY, then ordered OVERRIDE across
all effects/Items. Prepared weapon calculations retain Actor-only effect
provenance separately from the sheet's flattened effect display, so Actor effects
are not lost and Item effects are not counted twice. The server item-roll hook
executes the attack roll only; this does not add automatic native damage chains.

Fixed class/ancestry mastery talents join the existing advancement selection
UI. New generator/import/advancement items resolve validated choice keys while
preserving formula values, and reject remaining required placeholders before
creation. Original templates and existing Actors are not repaired or rewritten.
Sheet/tool navigation flows below Core's HUD without assuming its height.
Final assembly tracks rolled occurrences and fixed-source grants. A class-fixed
mastery plus a rolled mastery requires two choices, not one; two rolled copies
also require two. Repeated aliases within one fixed source collapse, while
independent class/ancestry grants remain separate. Required/selected cardinality
must match exactly before any Actor/Item writes. The UI counts the same grants.
Already-resolved custom-template choices survive generator enrichment; importer
source-plus-choice deduplication stays unchanged. No existing Actor repair.

## Known alignment limits

The behavior above describes the bounded Core ADR-0063 implementation and its legacy
fixtures. Module 0.9.4 has confirmed v14 serialized-effect and broader rules/data
issues; those fixtures do not establish v14 or full native action parity.
[The native-alignment audit](audits/2026-10-15-native-alignment.md) records the
findings. [Shadowdark ADR-0001](adr/0001-native-alignment-and-resource-cards.md)
proposes module-owned corrections, shared resource details and bestiary support
against released native 4.0.6. Development-only 4.1 behavior is outside that baseline.

The existing weapon suite covers fourteen legacy damage fixtures across helpers,
normalization, server hooks and rendered components. Native/operator acceptance
and raw serialized-format coverage are distinct evidence requirements.

## Distribution and verification

`info.json` declares the module version and API compatibility. CI/release
workflows currently use the released Core `v0.18.0` toolchain. Release assets
include the package archive, checksum, catalog manifest and release history.
A module release tag identifies the matching manifest version.

Repository workflow and verification commands live in [AGENTS.md](../AGENTS.md).
The shared contracts are described in Core's
[module authoring guide](https://github.com/sheetdelver/sheetdelver/blob/v0.18.0/docs/MODULE_AUTHORING.md)
and [release process](https://github.com/sheetdelver/sheetdelver/blob/v0.18.0/docs/RELEASING.md).
