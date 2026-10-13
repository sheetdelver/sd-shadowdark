# Sheet Delver - Shadowdark RPG Sheets Module

### About
While not yet feature-complete, offers robust support for Shadowdark it Sheet Delver:
- **Character Sheets**: Full support for Shadowdark character sheets with a clean, modern UI.
- **Auto-Calculations**: Automatic calculation of Stats, HP, AC, and Inventory flexibility.
- **Inventory Management**: Drag-and-drop equipment, slot tracking, and toggleable states (Equipped/Stashed/Light).
- **Treasure & Wealth**: Dedicated section for treasure items with total wealth tracking and "Sell" functionality.
- **Gear Selection**: Integrated compendium browser for quickly adding standard gear, armor, and weapons.
- **Interactive Toggles**: Custom icons for managing item states directly from the inventory list.
- **Formatted Chat**: Rich chat messages for rolls and abilities with inline roll buttons.
- **Character Import**: Import characters via JSON from Shadowdarklings.
- **Level Up Wizard**: Guided level-up process with talent/boon rolling and choice resolution.
<img src="https://github.com/sheetdelver/sheetdelver/blob/main/images/sheets/shadowdark/sd-character-sheet.png" width="25%">
<img src="https://github.com/sheetdelver/sheetdelver/blob/main/images/sheets/shadowdark/sd-paper-view.png" width="25%">

### Prepared Actor Lifecycle

This module requires SheetDelver `module-api >=1.3.0` for its optional Combat
Manager stat suggestions. HP, AC, and level are suggested before Player ability
scores; the GM's saved selection takes precedence. Its runtime-backed
registry is warmed during initialization, then the adapter deterministically
prepares each source Actor once per source revision. Dashboard, sheet, card,
roll, and initiative paths consume that shared prepared model; preparation
does not write derived values back to Foundry.
NPC preparation preserves the monster's explicit AC instead of deriving it
from DEX and equipment; the Lizardfolk fixture checks this value.

The generator and importer do not turn a spell's description links (including
Light's three optional light-source templates) into starting inventory. Those
description references are preserved; existing Actor inventory is not changed.

The ADR-0062 development checkpoint removes the sheet's shared-media mount in
favor of Core's persistent host. Before release, either retain the compatible
SDK mount or raise the minimum Core version to the release supplying that host;
the current `>=0.15.1` range also admits Core without it. Responsive review and
a fresh generated wizard remain acceptance checks.

From this module's local checkout inside the Sheet Delver repository, run the
behavior-preserving contract check with `npx tsx src/tests/prepared-actor.test.ts`.

### Distribution

Pull requests and changes to `main` validate the module contract and build its
distribution package using the pinned Sheet Delver toolchain. To publish a
release, first set the workflow's Sheet Delver reference to a stable core
release tag, update `info.json`, and push the matching module tag (for example,
module version `0.7` uses tag `v0.7`). The release workflow publishes the
archive, checksum, and `sheet-delver-manifest.json` consumed by the module
catalog.

### Third-Party Licenses

**Shadowdark RPG**
This product is an independent product published under the Shadowdark RPG Third-Party License and is not affiliated with The Arcane Library, LLC. Shadowdark RPG © 2023 The Arcane Library, LLC.

## SDK Feedback Compatibility

The module requires SheetDelver Core `>=0.15.1` and
`ui-extension-api >=2.1.0 <3.0.0` (SDK 2.1.0). Core renders the dashboard's
generator and importer cards; both open module-owned tool pages. The importer
no longer depends on a packaged `react-dom` portal. Sheets and shared chat/dice
themes remain module-owned. CI and release packaging use Core
`v0.15.1`. Notification progress/lifecycle adoption is not required.
Core owns player-world readiness and interruption presentation; module pages
only manage Shadowdark resource loading and Actor-specific errors.

Successful sheet rolls are presented by Core chat/dice, without a second success
notification. Roll failures and item/effect feedback remain visible. Run the
offline regression from the Core checkout:

```sh
npx tsx data/local/modules/shadowdark/src/tests/roll-feedback.test.ts
```
