# ADR-0009: GM treasure and item generator

**Status:** Proposed — audit and plan requested; implementation not selected
**Date:** 2026-10-27

---

## Context

The user selected exploration of GM item/treasure generation using the full
Shadowdark RPG pp. 269–295, followed by adding results to a character. The narrow
“convert a spell into an item” idea is superseded for this proposal. Cards-to-chat
remains deferred for discussion. This is separate from the accepted player-sheet
work and is not automatically a 1.0 release gate.

The [rules/native audit](../audits/2026-10-27-gm-treasure-generation.md) records
sources, table coverage and item schema evidence. The native pack contains only
part of the needed generation data. No new Core contract is assumed necessary.

## Selected source approach — October 27

The user selected existing available Foundry tables plus manual entry for missing
sections. **Do not ship missing rulebook tables**, whether as pack documents,
lookup arrays, embedded result text or equivalent hardcoded generation rules.
The GM consults their source material outside SheetDelver, rolls externally when
needed, then enters the resulting name, value or other item details.

The publisher's [licensing FAQ](https://www.thearcanelibrary.com/blogs/shadowdark-blog/faq-on-the-shadowdark-rpg-third-party-license)
distinguishes roll tables and digital tools. See the audit for evidence and
uncertainties. This source choice replaces the proposed supplementary table
package; it is not a legal conclusion about digital-tool permissions. Native
code's MIT license does not establish rights over book tables or transfer native
project permissions to SheetDelver.

Keep this ADR Proposed: the source approach is selected, implementation and
release scope are not. No external contact is part of this work.

## Proposed experience

Expose **Treasure & Items** in the GM dashboard section. Reuse the Core module
page header and the connected white sheet of Generator/Creator, existing field
blocks, dice controls, source pickers, rich-text editor and review styling. No
new pre-header, nested window, card grid design or separate dice system.

1. **Choose generation.** Treasure by level/context; a specific item category;
   or random magic item where an available table supports it. Show which sections
   can be rolled from Foundry and which require manual results from outside the app.
   Choosing a recipient here may suggest a level but must not silently change
   the loot table. A GM may generate without assigning anything yet.
2. **Resolve the draft.** Show an ordered result list with the rolls and required
   follow-ups. Lock explicit treasure-row constraints; reroll only a selected
   unlocked part. Changes invalidate only dependent choices. Nested results
   remain visible until resolved, not arbitrary items labeled “Choose.” Missing
   follow-up tables open manual fields in this same flow, not a dead end. A fully
   manual draft is also valid; do not require an initial available-table roll.
3. **Review.** Editable name, quantity, value, slots, appearance/description and
   native base template. Separate bonuses, benefits, curses and personality.
   Label each mechanic as supported or descriptive/manual. Show destination and
   disclosure/identification choices. No actors or inventory mutate while rolling.
4. **Add to character.** Explicit GM-selected actor and item selection. After a
   confirmed write, show the actual created item(s) and an Open character action.
   Handle coins and nonphysical rewards explicitly; do not turn every reward
   into gear, automatically sell items, grant XP or modify equipped state.

The default scope is GM authoring. It does not simulate player crafting costs,
materials, downtime or success checks; those are not established by these pages.
Existing actor ownership rules still apply to the selected recipient. GM section
placement is presentation only: server routes must authorize the caller as GM.

## Data and rules

Prefer current caller-readable native templates and RollTables by exact UUID.
Use `Registry.draw` and existing source/gear helpers where their contracts fit.
Do not call native browser macros or require a running Foundry browser. Treat
raw table text, linked documents, currency, quantities, boons and nested tables
as distinct results. Do not parse all prose into executable rules.

For missing table families, provide ordinary result-entry fields: name, quantity,
value/currency, slots, description, and category-specific details such as a bonus
or selected spell. These are fields for the GM's result, not a reproduction of the
missing table's rows, ranges, probabilities or named result lists. Do not import
or scrape the user's PDF, silently modify native packs, or add bundled fallback
tables. Runtime tables must be available through supported public source/access
contracts; an absent or inaccessible source falls back to manual entry.

Track provenance per draft section: Foundry table UUID/result and revision for a
native draw; manual entry for externally determined results. Source/page notes
are optional. Do not invent a roll receipt or require a die result for manual
input. Switching a section to manual preserves its editable result and clears
any claim that the edited value is an unchanged native draw.

Automate constraints and follow-ups only when supported by available source data
and existing helpers. Preserve explicit constraints from an available treasure
result; ask the GM to supply missing follow-ups. Do not encode absent armor,
weapon, tier or spell distributions from the book.

For both scrolls and wands, **use available caller-readable Foundry spells in the
spell picker**. The GM selects the actual spell document, including after rolling
against their book outside the app; retain its exact UUID for native item
behavior. Search and tier filters may use the available spell metadata. This
picker is not limited to the recipient's class or known spells. Available spell
documents are supported content, not excluded by the missing-table policy.

The distinction is selection versus random generation: do not treat all installed
spells as a replacement random table with invented probabilities. An available
appropriate RollTable may supply the result; otherwise the GM selects it manually.
Do not silently resolve a typed name to a document.

Validate structured inputs and native item compatibility, not whether a manual
result matches an unavailable table. Unresolved spell/template links remain
visible and must be resolved before promising functional native mechanics;
descriptive-only results must be labeled accordingly. Reuse modern native
Scroll/Wand fields and existing consumable logic after creation.

Only produce active mechanics backed by actual supported native item/effect
schemas. Retain other benefits/curses as descriptive rules with a manual label.
Do not claim that every generated daily ability is automatically handled by rest.
Personality may remain description; it must not overwrite the recipient's
alignment or force automatic opposed checks.

## Writes, visibility and recovery

A draft contains drawn/manual results, per-section provenance, source revisions and
the proposed native payload. Revalidate caller access, GM role, recipient and
sources at commit. Create through public runtime document APIs; no direct socket,
private Core import or second compendium cache.

Use the existing operation/receipt pattern for the delivery boundary. Bind one
request to the reviewed draft and recipient; retain returned embedded IDs. A
lost acknowledgement requires readback by exact evidence, never an automatic
replacement grant. A multi-item or coin-plus-item delivery is not an atomic
transaction; show confirmed and unresolved portions and resume only proven
unwritten work. Begin with a single-item delivery before adding bundles.

Keep GM draft notes and undisclosed identities/curses private. Verify serialized
player responses, not just hidden UI. If current projection cannot protect a
chosen disclosure mode, keep those details in the GM draft and offer an explicit
safe public description; do not start a Core change without demonstrating and
selecting the missing contract. No chat output is part of this ADR.

## Actionable implementation sequence

| ID | Deliverable | Completion evidence |
| --- | --- | --- |
| G01 | Inventory available runtime table/template sources; define typed drafts and manual fields for missing sections | Exact source IDs and coverage; no bundled missing tables; drawn/manual provenance survives edits |
| G02 | One vertical slice: GM tool, native Treasure 0–3 draw or manual result, resolve missing follow-up manually, review, add one exact item | Unauthorized caller rejected; source/manual distinction retained; successful delivery; uncertain response cannot duplicate |
| G03 | Treasure/valuables result entry, available-table draws, coin and bundle review | Missing higher bands remain usable through manual entry; quantities/values preserved; no automatic XP/sale |
| G04 | Armor/weapons and scrolls/wands from available or manual results | Source constraints preserved; explicit template/spell links; native item behavior retained; no hardcoded missing distributions |
| G05 | Potions, utility and personality, then nonphysical rewards | Supported/manual effect distinction; no arbitrary spell substitution; chosen identification mode does not leak hidden data |
| G06 | Release review | Focused desktop/mobile walkthrough including missing-table flow; compiled archive; user GM acceptance; README distinguishes available draws from manual entry |

Potion mixing, player crafting, world-item library publishing, reusable saved
recipes and public cards-to-chat are later scope decisions. Do not silently add
them while implementing the generation flow.

## Proportional validation

Use representative fixtures for available-table draws, manual missing-table
follow-ups, source constraints and native item shapes. Do not build an exhaustive
reference suite for book tables the application does not implement. One mounted GM workflow should cover draft → review → delivery and a
small set of authorization/recovery failures. Reuse current inventory, spell,
wand and rest tests; add a regression only where generated payload behavior
requires it. Avoid another exhaustive test matrix without a player-visible
feature increment. Complete and demonstrate each vertical slice before extending
more table families.

## Review decisions

- [ ] Confirm this tool's first release scope and its placement after/before 1.0.
- [x] Use available Foundry tables and manual external results for missing sections; ship no missing rulebook tables (user decision, October 27).
- [ ] Confirm disclosure behavior for unidentified/cursed generated items after
  the caller-projection capability check.

These are proposal decisions, not permission requests for the already-authorized
sheet editor. No generator runtime implementation has been started.
