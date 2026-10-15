# Shadowdark module development

## Contracts and ownership

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

## Validation

### Weapon and creation corrections (ADR-0063)

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
or a migration to the supplied 4.1.0 reference.
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

`npx tsx data/local/modules/shadowdark/src/tests/weapon-rules.test.ts` adds the
versioned attack, formula and mastery creation fixtures to the checks below.
It includes tracked React server-render checks of actual inventory/item modal,
Abilities and paper components using the same fourteen versioned fixtures as
the normalizer/helper/server checks. Optional local browser evidence additionally
checks actual provider dialog defaults and responsive layouts; no browser is
required at application runtime or added as a backend dependency.

From the Core checkout with this module in `data/local/modules/shadowdark`:

```sh
npx tsx data/local/modules/shadowdark/src/tests/importer-mapping.test.ts
npx tsx data/local/modules/shadowdark/src/tests/actor-enricher.test.ts
npx tsx data/local/modules/shadowdark/src/tests/roll-feedback.test.ts
npx tsx data/local/modules/shadowdark/src/tests/presentation.test.ts
npx tsx data/local/modules/shadowdark/src/tests/prepared-actor.test.ts
npm run module:check -- shadowdark
```

Core's root TypeScript check excludes module source. Include module sources
explicitly for interface changes, and use isolated package output for release
validation. Successful sheet rolls use Core chat/dice feedback rather than a
second success notification.

## Distribution

CI and release workflows pin Core `v0.18.0`. Keep their toolchain references
aligned with the tested minimum and update compatibility before publication.
The module tag must match `info.json.version`; published tags are immutable.
Release CI publishes the archive, checksum, catalog manifest and release history.
Keep user-facing notes concise in [CHANGELOG.md](../CHANGELOG.md).

See Core's [module authoring guide](https://github.com/sheetdelver/sheetdelver/blob/v0.18.0/docs/MODULE_AUTHORING.md)
and [release process](https://github.com/sheetdelver/sheetdelver/blob/v0.18.0/docs/RELEASING.md)
for the shared workflow. Verification history belongs in audits/ADRs, not the
module overview.
