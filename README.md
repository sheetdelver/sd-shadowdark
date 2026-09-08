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
