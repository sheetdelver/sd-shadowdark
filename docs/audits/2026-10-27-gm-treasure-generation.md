# GM treasure and item generation audit

Date: 2026-10-27
Status: Rules/native comparison complete; implementation proposed in ADR-0009

## Sources and scope

User-supplied full **Shadowdark RPG V4.9**, printed pages 269–295 (PDF pages
273–299). Extracted all relevant pages and visually checked the layout/range
relationships on printed pages 282, 288 and 292. This is not the limited
Quickstart. Native baseline: Shadowdark release-4.0.6,
`9677d16b3903b3b640f00d4efd48249142ac8334`, under `temp/shadowdark` in the Core
workspace. This audit summarizes rules; it does not reproduce the book's tables.

The selected request is GM authoring/generation and adding results to a character.
Pages 269–295 provide treasure and magic-item generation, not a complete crafting
cost/time/material progression. Do not invent a crafting economy under this scope.
General cards-to-chat remains deferred for separate discussion.

## Rules and implementation implications

| Printed pages | Authority | Required behavior |
| --- | --- | --- |
| 269–277 | Treasure overview; four level bands (0–3, 4–6, 7–9, 10+) | Choose monster level for carried loot or discovering character level for unguarded treasure. Wandering-monster treasure chance is conditional, not a blanket chance on every roll. Preserve table values, quantities, explicit bonus/tier/quality instructions and named items. Treat d100 00 as 100. |
| 278–279 | Valuables, gems, item traits, luxury combinations | Keep material value and quantity separate from coins. Some results require secondary rolls. Gear slots can require GM judgment; do not automatically sell loot or award XP. |
| 280–281 | Oaths, secrets, blessings | Nonphysical rewards are not ordinary equipment. Keep them distinct; blessing mechanics and XP value may require GM judgment. |
| 282–283 | Magic-item type, qualities, personality, naming | Resolve type, benefit/curse counts and personality branches separately. Armor/weapon bonus applies to actual mechanics. A generated name is not an Item document or a rule effect. |
| 284–285 | Armor | Separate type, bonus, feature, benefit/curse. Mithral result requires a type reroll; retain the material rather than outputting a fictitious armor type. |
| 286–287 | Potions | Features and effects come from these tables, not an arbitrary spell list. Mixing potions is a separate optional flow; nested outcomes and effect order require explicit review. |
| 288–289 | Scrolls and wands | Distinct feature tables, weighted tier selection, then explicit d12 spell table for that tier. Benefit/curse category has its own selector. A treasure result's fixed tier takes precedence over rolling a new one. Do not substitute all known class spells. |
| 290–291 | Utility | Physical form, feature and benefit/curse are separate; many effects are narrative or conditional. |
| 292–293 | Weapons | Weighted type/bonus, feature and benefit/curse; ammunition results include quantity rolls. Preserve the native base weapon's damage and properties. |
| 294–295 | Personality | Virtue/flaw, trait and GM-selected alignment are separate. Conscious-item behavior is not a forced character alignment or automatic opposed roll. |

Specific treasure-row instructions override generic generation defaults: for
example a fixed bonus, fixed tier or stated count of benefits must not be rolled
away. Named magic items should resolve to their exact existing native template
when available, not be rebuilt by guessing from the name.

## Native data coverage

`data/packs/rollable-tables.db` contains **67 actual RollTable documents** in this
checkout. Folder and embedded-result JSON files are not additional tables.
Relevant complete table identities:

- Treasure 0–3: `Compendium.shadowdark.rollable-tables.RollTable.Pi9nnnLeXpTKCSMY`
- Name 1: `Compendium.shadowdark.rollable-tables.RollTable.8piSI566ZPW7kA87`
- Name 2: `Compendium.shadowdark.rollable-tables.RollTable.OQWo5AQe0XOcVWjD`
- Name 3: `Compendium.shadowdark.rollable-tables.RollTable.yC1cHYZvhs05Rm1N`

The full higher-level treasure and armor/potion/scroll/wand/utility/weapon/
personality table families are absent as RollTables in this baseline. Files named
“Magic Item” and “Make a Random Magic Item” include folders/results, not evidence
of a complete generator. Native `data/macros/generate-random-magic-item-name.js`
only combines three naming-table results and whispers a name to GMs.

Native `UtilitySD.createItemFromSpell` is an item-shape convenience, not the book's
random generator. Modern Scroll uses `system.spellUuid`; Wand uses
`system.spells[{uuid,lost}]` and `system.broken`. The existing magic-items pack
supplies templates/effects for named loot. Generic procedural text does not
prove a corresponding automated effect exists.

## Reusable SheetDelver capabilities and remaining proof

- GM dashboard section and shared page header: existing Monster Stats declaration.
- Caller-readable declared compendiums and exact identities: Registry/access helpers.
- Table draws/range matching and exact linked-item hydration: `Registry.draw`.
  It accepts simple dice formulas and reports unresolved references; it is not a
  general recursive treasure resolver. Text/coin/nested results need typed planning.
- Shared dice UI and request runtime; existing Creator/advancement orchestration.
- Native copies and item preparation: gear additions/resolver, `ownedCopy`, prepared
  inventory/card logic. Reuse them, not a second item schema or equipment engine.
- Public embedded Item creation and actor patches; existing operation receipts
  demonstrate how to avoid duplicate grants after uncertain writes.

Before transferring secrets, verify public actor/item projections. A collapsed
card or native unidentified flag alone is not evidence that GM-only curses,
identity or notes are absent from player responses. Keep private generation notes
server-side until disclosure is intentionally selected and proven safe.

No live native actors were created or changed in this audit. No capability gap
has been established that requires a Core change. Required proof is bounded to
GM authorization, data sources, native item shapes and reliable delivery.

## Recommendation

Build a GM **Treasure & Items** tool with a source-aware draft, review and explicit
recipient action. Start with treasure plus armor/weapons and table-driven
scrolls/wands; follow with remaining item families and nonphysical rewards.
Use available Foundry data where it exists. For missing table families, the user
selected manual entry of externally determined results, with per-section
provenance. Do not distribute missing tables or hardcode their equivalent rules.
Full implementation plan and source decision are in
[ADR-0009](../adr/0009-gm-treasure-and-item-generator.md).


## Content/licensing investigation — October 27

The missing tables must not be treated solely as unfinished implementation.
Public publisher guidance distinguishes reusable item content from roll tables.

**Documented sources (accessed 2026-10-27):**

- [Arcane Library licensing FAQ](https://www.thearcanelibrary.com/blogs/shadowdark-blog/faq-on-the-shadowdark-rpg-third-party-license): the standard license permits reprinting monsters, spells and magic items, but excludes classes and roll tables. The publisher says digital character builders, GM helpers and VTT tools have required special permission, and the published FAQ says further licenses of that sort are not being extended. This is the publisher's stated policy, not an assessment of any private agreement or SheetDelver's specific integration.
- [Official Shadowdark page](https://www.thearcanelibrary.com/pages/shadowdark): identifies the Third-Party License V1.1 and links the Creator Kit. The kit's Dropbox contents were not readable through the browsing tool; this investigation does not claim a new line-by-line review of that downloadable license.
- [Native system README](https://github.com/Muttley/foundryvtt-shadowdark): expressly limits the MIT statement to software code, separately identifies the Shadowdark Third-Party License, and records permission for supplied artwork. This is not evidence of blanket MIT rights over all book/pack content.

**Local comparison:** GM Quickstart V2.4 contains Treasure 0–3 on printed42–43
and the three-column Magic Item Idea Generator on printed45. Those correspond
to the native RollTables identified above. It includes a magic-item qualities
overview on44, but not the full rulebook's subsequent category-specific generator
tables. The native system also includes other core/zine content, so calling the
entire system “Quickstart only” would be incorrect.

**Inference and limit:** this pattern is consistent with a permitted-content
boundary, rather than merely missing programming. No maintainer statement or
private agreement was found explaining each omitted table individually. Do not
state that every omission was definitively mandated by licensing.

**Effect on proposal:** replace “supply the missing tables” as an ordinary data
task with a rights/source decision first. A free Quickstart, OSR description,
MIT code license, or the presence of a document in a user's installed compendium
is not proof of permission to redistribute the book's tables in SheetDelver.
Runtime access to user-installed data and bundling data are different operations;
this review does not resolve the permission scope of SheetDelver's architecture.
No contact has been sent, no table data has been bundled, and no legal conclusion
about existing functionality is asserted. ADR-0009 remains Proposed for user
review. The user subsequently selected no distribution of missing tables;
a supplementary full-book table package is no longer part of the proposal.
This decision does not establish an exemption from digital-tool policy.

## Selected response to missing tables — October 27

Use existing available Foundry tables through current access/source contracts.
When a section lacks a table, accept the GM's externally rolled or chosen result
as manual input in the same draft/review flow. The source book remains outside
the application. Names, quantities, values and category-specific details are
editable; functional spells/templates require explicit native document links.
Manual entries are not certified against unavailable book tables and must not
be presented as Foundry rolls. No PDF ingestion, copied result lists or bundled
fallback distributions are selected. This supersedes the earlier supplementary
data-package suggestion; ADR-0009 remains Proposed pending implementation scope.
