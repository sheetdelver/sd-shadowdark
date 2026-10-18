# SheetDelver — Shadowdark RPG

Character sheets and tools for playing Shadowdark RPG with SheetDelver.

## Features

- Interactive character sheets and a paper-style view.
- Equipment browsing, inventory slots, treasure and wealth management.
- Ability rolls, formatted chat cards and a guided level-up wizard.
- Character generation and Shadowdarklings.net JSON import.
- Mobile-friendly gear browsing and Combat HUD initiative rolling.
- Spell, item and monster detail cards.
- Live world settings and admin-managed effect migrations.

<img src="https://github.com/sheetdelver/sheetdelver/blob/main/images/sheets/shadowdark/sd-character-sheet.png" alt="Shadowdark character sheet" width="25%">
<img src="https://github.com/sheetdelver/sheetdelver/blob/main/images/sheets/shadowdark/sd-paper-view.png" alt="Shadowdark paper-style sheet" width="25%">

Requires **SheetDelver Core 0.19.2 or later**.

Verified with native Shadowdark4.0.6 on Foundry13.351 and14.367. Core owns
world maintenance approval; the module does not repair data from player sheets.

See the [releases](https://github.com/sheetdelver/sd-shadowdark/releases),
[changelog](CHANGELOG.md), [module architecture](docs/architecture.md) and
[working guidance](AGENTS.md).

Known post-release native behavior gaps are tracked in the
[active audit](docs/audits/2026-10-18-spellcasting-and-native-parity.md) and proposed
[ADR-0002](docs/adr/0002-native-data-and-behavior-parity.md). The plan covers
native class/list handling, incomplete existing actor data, owned-spell identity,
safe selection, resource action ordering, identification and language choices.
The audit separates confirmed matches, defects and feature gaps. Its corrections
are not yet implemented.

## Third-party license

This product is an independent product published under the Shadowdark RPG Third-Party License and is not affiliated with The Arcane Library, LLC. Shadowdark RPG © 2023 The Arcane Library, LLC.

ADR-0002 implements exact caller-bound spell dependencies, explicit owned-spell
management with partial-operation receipts, native action phases and separate
language choices. Historical omissions require [exact-source GM review](docs/native-source-remediation.md).
Native A02 acceptance remains open; controlled-upstream checks are not Foundry
acceptance. Compatibility and module version remain unchanged.
