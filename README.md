# Sheet Delver - Shadowdark RPG Sheets Module

### About
While not yet feature-complete, offers robust support for Shadowdark it Sheet Delver:
- **Character Sheets**: Full support for Shadowdark character sheets with a clean, modern UI.
- **Auto-Calculations**: Automatic calculation of Stats, HP, AC, and Inventory flexibility.
- **Inventory Management**: Drag-and-drop equipment, slot tracking, and toggleable states (Equipped/Stashed/Light).
- **Treasure & Wealth**: Dedicated section for treasure items with total wealth tracking and "Sell" functionality.
- **Gear Selection**: Integrated compendium browser for quickly adding standard gear, armor, and weapons.
  Phone/tablet rows show complete wrapping names/descriptions and labelled cost/
  slots; desktop retains columns. A native modal dialog keeps its header above
  HUD stacking contexts with 44px close/Add controls, Escape and focus restoration.
  No portal dependency or additional SDK minimum is required.
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

The sheet retains its SDK `SharedContentModal` mount for Core versions admitted
by the `>=0.17.0` minimum. On Core with ADR-0062's persistent media host,
that compatibility component is inert and produces no duplicate overlay.
Core 0.16.0 first provided the required module-api 1.3 combat-stat manifest
contract; this branch targets the user-approved Core 0.17.0 minimum and
validation/release toolchain. The user accepted this correction iteration on
October 13, 2026, including the responsive Gear picker. Automated generator
fixtures pass; an exhaustive fresh-wizard/native matrix is not claimed.

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

The development checkout requires SheetDelver Core `>=0.17.0` and
`ui-extension-api >=3.0.0 <4.0.0` (SDK 3.x). The UI API gate keeps it
incompatible with released Core 0.17.x. Before module release, raise the
Core minimum to `>=0.18.0` after Core 0.18.0 is published. Core renders the
dashboard's generator and importer cards; both open module-owned tool pages.
The importer no longer depends on a packaged `react-dom` portal. Sheets and shared chat/dice
themes remain module-owned. Its combat-HUD initiative modal reuses the same
SDK roller frame/theme as sheet rolls: square frame, X close control, fields
and footer. Core's formula/audience are read-only; it returns only a roll
choice or manual final total. No sheet bonus or audience selector is copied
into the HUD. CI and
release packaging target Core `v0.18.0`; publish Core first.
Notification progress/lifecycle adoption is not required.
ADR-0061 hardening verification (October 14): offline module tests, explicit
source typing and isolated packaging pass on the integrated SDK/UI 3.1 host.
The actual wrapper preserves a supplied keep-highest formula in the rendered
HUD fixture; native Shadowdark participation still needs operator acceptance.
The October 14 presentation correction is rendered at320/375/1280 in both
Core appearances; the module skin is retained. This is not released-Core
compatibility or native rules-parity certification.
Core owns player-world readiness and interruption presentation; module pages
only manage Shadowdark resource loading and Actor-specific errors.

Successful sheet rolls are presented by Core chat/dice, without a second success
notification. Roll failures and item/effect feedback remain visible. Run the
offline regression from the Core checkout:

```sh
npx tsx data/local/modules/shadowdark/src/tests/roll-feedback.test.ts
```
