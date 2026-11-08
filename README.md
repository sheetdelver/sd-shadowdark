# SheetDelver — Shadowdark RPG

Character sheets and tools for playing Shadowdark RPG with SheetDelver.

## Character sheets

- **Edit character:** change the name, base ability scores and base maximum HP in one shared dialog on either sheet. Talent, boon and effect bonuses stay separate.
- **GM Treasure & Items:** assign unchanged native items directly without creating library duplicates. Native prices fill in automatically. Preview the item card and its artwork before saving or assigning. Save new or customized items under SheetDelver/type folders in Foundry’s Items directory, with optional immediate assignment to a character. Category tabs retain unfinished entries while you switch. Armor supports building from a rolled or selected native armor type, bonus and cosmetic feature, with the type’s artwork, properties and base price. Bonuses update AC, including shields; the preview shows AC. Existing items can be reset to their source or cleared. Potions supports existing items or a new potion with three independently rolled, selected or manually entered features, plus optional potion benefits/curses and personality. Roll all features together, preview the result, then save and optionally assign it. New potion effects remain GM-managed. Weapons supports existing items or building from a rolled/selected native weapon or ammunition type, bonus and feature, preserving damage, properties, artwork and price. Weapon bonuses apply to attack and damage; ammunition quantities can be rolled, with ammunition bonuses recorded for manual application. Scrolls/Wands has separate feature choices, selectable/rollable tiers, exact spells from that tier and dedicated spell-focused benefit/curse tables. Spell choices show casting class and tier, and can be searched by class. Spell artwork and casting links are retained. Utility items combine a form and feature, with matching artwork for original forms, or start from an existing item. Native treasure draws remain available. Mundane Items builds luxury objects, gemstones and jewelry using original tables or manual choices, with optional unique features, suggested values and quantity totals. Individual parts can be rerolled without replacing the rest. Boons supports oaths, two-part secrets and blessings, with original prompts or manual entry, level gained and optional assignment. Boons also have an optional Effects section: choose a native preset or custom change, adjust its operation/value, and enable or disable it. Configured effects appear in the preview and are retained when saving or assigning. Blessing durations and uses are descriptive and managed by the GM. Item builders have optional Attributes (benefits/curses). Personality (virtues/flaws) is available for items other than scrolls. Boons use their own oath, secret or blessing details and have neither item Attributes nor Personality. Roll or choose original results, or enter your own. Benefits and curses automatically use the item’s Armor, Potion, Utility, Weapon, Wand or Scroll tables. Item personalities share their own tables. Each result can be rerolled or edited separately; native effects are preserved and added descriptions remain GM-managed. An optional Permanent modifiers section adds native AC, ability-score and gear-slot adjustments or initiative advantage to equipment. The preview lists included effects; equipment bonuses respect native equipped/carried, stashed and identification rules. Armor bonuses update AC without a duplicate effect. Temporary, conditional and daily-use effects, plus coin rewards, remain manual.
- Interactive tabbed and paper-style character sheets.
- Ability checks, attacks and spellcasting with dice rolls and formatted chat cards.
- Spell, talent, equipment and monster detail cards. Item cards list their effects and changes; owned items show active, disabled or suppressed status. Owners can share an owned item card to public chat without using the item.
- Talent acquisition levels, with repeated talents grouped on the paper sheet.
- Pulp Mode luck counters with −/+ buttons in both sheet views.
- Manual Renown tracking with signed input and −/+ controls in both sheets.
- Class ability use counters and lost/restore controls on shared detail cards.
- Red character names and a skull indicator at zero hit points.
- Shared rest controls to recover HP and eligible spells, abilities and daily uses, with optional personal ration consumption and separate recovery and exclusion lists.

<img src="https://github.com/sheetdelver/sheetdelver/blob/main/images/sheets/shadowdark/sd-character-sheet.png" alt="Shadowdark character sheet" width="25%">
<img src="https://github.com/sheetdelver/sheetdelver/blob/main/images/sheets/shadowdark/sd-paper-view.png" alt="Shadowdark paper-style sheet" width="25%">


## Character creation and advancement

- Character Generator and Shadowdarklings.net JSON import.
- Step-by-step Character Creator for entering existing characters at levels 0–10.
- Character creation and advancement are capped at level 10, following the Shadowdark core rules (Level Advancement, p. 39).
- Ancestry-based random names, ability score inputs and rolls, and class ability guidance.
- Level-based talent, language and spell choices, with spells organized by tier and already-known spells excluded from selection.
- Per-level HP inputs, individual and combined rolls, and maximum-roll shortcuts.
- Equipment, starting gold, treasure, gems and rich-text notes.
- Final character review and direct navigation to the created sheet.
- Guided level-up wizard with native class grants and choices.

## Spells and equipment

- Known spells and spells supplied by scrolls and wands, with class and spell-list eligibility.
- Mark lost / Restore controls on the Spells tab and owned spell cards.
- Spellcasting mishap rolls and distinct wand failure, rest recovery and breakage states.
- Spent scrolls remain in inventory for manual discard and cannot be cast again.
- Equipment browsing, inventory slots, treasure and wealth management.
- Crawling Kits expand into their individual inventory items.
- Active light sources display their remaining time. Lighting or extinguishing a source posts a chat card, with remaining time when enabled by the world setting.

## Tools and settings

- Optional treasure name suggestions from native tables, with Apply and Dismiss beside the name field.
- Monster Stats under GM Tools, with source, name, level, alignment and movement filters.
- Monster rows open detailed stat cards; optional community monster sources and artwork are supported when available.
- Combat HUD initiative rolling.
- Sheet-view preferences in Settings.
- Responsive layouts and shared navigation across sheets and character tools.
- Dashboard HP and AC refresh after sheet changes.

## Requirements

Use SheetDelver Core **0.22.3 or newer**, providing module-api **1.7.0** and
ui-extension-api **3.6.0**. Optional native artwork packages are not required.

Features described here reflect the current module checkout. See the
[changelog](CHANGELOG.md) for released and unreleased features.

## Third-party license

This product is an independent product published under the Shadowdark RPG Third-Party License and is not affiliated with The Arcane Library, LLC. Shadowdark RPG © 2023 The Arcane Library, LLC.
