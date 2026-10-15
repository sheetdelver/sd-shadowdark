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
