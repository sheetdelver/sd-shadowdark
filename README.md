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

[ADR-0002](docs/adr/0002-native-data-and-behavior-parity.md) is complete within
its selected scope: exact native class/list handling, owned-spell identity,
validated creation/advancement, safe partial-operation review, reactive catalogs,
native action ordering and language choices. See the [completed audit](docs/audits/2026-10-18-spellcasting-and-native-parity.md)
and [native acceptance record](docs/audits/2026-10-19-adr-0002-native-acceptance.md#v13-completion-and-final-closeout--october-19-2026)
for both-generation evidence and the final recovery-layout qualification.

Incomplete historical characters require [exact-source GM review](docs/native-source-remediation.md).
Unknown write outcomes remain blocked until reviewed; separate writes have no
rollback guarantee. Broader automation/catalog proposals F01–F06 remain deferred.
The [validation record](docs/audits/2026-10-18-adr-0002-validation.md) identifies
verified candidates and checkpoints. Version 0.9.6 includes these corrections;
compatibility remains unchanged.

## Third-party license

This product is an independent product published under the Shadowdark RPG Third-Party License and is not affiliated with The Arcane Library, LLC. Shadowdark RPG © 2023 The Arcane Library, LLC.
