# ADR-0009: GM treasure and item generator

**Status:** Implemented — current workflows accepted for checkpoint; final installed release smoke remains
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

## Selected source approach — revised October 28

Use available native Foundry data, **original SheetDelver generation tables** for
missing content, and manual input. The user selected original content after
reviewing the costs and incomplete coverage of Basic Fantasy, d20 SRD and Open5e.
External dataset research/import is no longer a prerequisite for Mundane Items.
The earlier open-OSR direction is retained below as historical/optional research,
not an implementation gate. No external dataset has been imported.

The publisher's [licensing FAQ](https://www.thearcanelibrary.com/blogs/shadowdark-blog/faq-on-the-shadowdark-rpg-third-party-license)
explicitly permits similar table layouts with original creative content. Author
our own entries, combinations and weights; do not transcribe, rearrange or make
row-by-row synonym replacements of the official tables. Label the bundled source
**SheetDelver Originals**, without suggesting official content or exact book
probabilities. Generic materials, objects and gemstone names need not be invented
fantasy words; the authored selection, descriptions and combinations must stand
on their own. Do not ship the missing official rulebook tables.

The FAQ's separate digital-tool permission discussion remains recorded in the
audit. Original table authorship addresses this content-source decision; it is
not a blanket conclusion about permission for the application. Native code's MIT
license likewise does not transfer rights in book content or project permissions.
No external contact is part of this work.

Store the original tables as small module-owned data files with stable IDs,
explicit dice/ranges, relevant part roles and necessary follow-ups. Reuse SDK
rolls and the existing item review/save flow. Values and any adjustments are
explicit, editable generator choices, not claimed official rules. Keep manual
entry and native templates available; no PDF ingestion, external API dependency,
Core change or parallel workflow engine is needed.

The user authorized implementation after checkpointing the editor on October27.
The first slice is recorded below. The user accepted the Mundane Items/card-preview
checkpoint on October28 and selected continuing to the next category, Boons.
Random Treasure is accepted for now; release placement remains undecided.

## Proposed experience

Expose **Treasure & Items** in the GM dashboard section. Reuse the Core module
page header and the connected white sheet of Generator/Creator, existing field
blocks, dice controls, source pickers, rich-text editor and review styling. No
new pre-header, nested window, card grid design or separate dice system.

1. **Choose generation.** Treasure by level/context; a specific item category;
   or random magic item where an available table supports it. Show which sections
   can be rolled from Foundry or SheetDelver Originals and which use manual results.
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
4. **Save, optionally assign.** Save completed items to the world Items directory
   under SheetDelver/type folders. Save and assign additionally creates a copy for
   an explicit GM-selected character. Reset the completed category workflow after
   confirmed success and show a concise saved/assigned outcome. Handle coins and
   nonphysical rewards explicitly; do not turn every reward into gear, automatically
   sell items, grant XP or modify equipped state.

The default scope is GM authoring. It does not simulate player crafting costs,
materials, downtime or success checks; those are not established by these pages.
Existing actor ownership rules still apply to the selected recipient. GM section
placement is presentation only: server routes must authorize the caller as GM.

## Accepted category-based redesign — October 27

User review found that the first slice's generic **Result source → Item details
(Create from) → Review** mechanism does not support the intended workflow.
Replace that entry flow rather than adding a longer table picker to it. This is
the accepted design; the final implementation ledger identifies the first
delivered slice and what remains open.

### Layout and navigation

Keep one shared header and reuse the connected Creator/Generator paper surface
inside each category page. The user selected **one tab per category**, in the
order below, superseding the initial single generic form/category selector.
Reuse the module's existing tab styling; ten tabs must remain navigable on small
screens without shrinking text or widening the whole page. No nested windows or
new page chrome.

Each tab owns a dedicated multipart workflow, with category-specific fields,
ordering and conditional branches. Shared controls, source adapters and save
services are reusable; a common sequence must not be forced onto unlike recipes.
Switching tabs preserves each unfinished draft in page memory. This is not a new
persisted-draft/reload-recovery feature. World/account context changes still retire
stale drafts. Reset only the completed tab after saving/assignment succeeds;
other tabs' drafts are unaffected.

| Category | Draft and selection behavior |
| --- | --- |
| 1. Random Treasure | Available native Treasure 0–3 or a labeled OSR alternative. Retain the selected table's own context; do not label an OSR table as an official Shadowdark level band. Resolve results into appropriate category drafts. |
| 2. Mundane Items | Original SheetDelver tables, available native templates and manual entry. Include luxury objects, gems and jewelry, keeping quantity and per-item value separate. |
| 3. Boons | Nonphysical rewards/benefits. Preview and manual description remain possible without pretending a boon is ordinary gear. Recipient application requires an explicitly supported native shape. |
| 4. Magic Items / Attributes | Select a complete available magic item or generate an additive property for a compatible draft. Attribute controls are also available from the other relevant categories, including boons where applicable. |
| 5. Armor | Select a native armor/shield base, then optional material, feature, bonus, benefit or curse. Preserve native base mechanics and show any unresolved conversion. |
| 6. Potions | Available potion template or supported/manual potion effect and appearance. Do not replace an absent potion table with arbitrary spells. |
| 7. Scrolls / Wands | Choose subtype, available exact Spell document(s) within implemented native capabilities, then optional attributes. The first slice's single-spell support remains the current limit. |
| 8. Utility | Miscellaneous useful physical or magical items; distinct from the ordinary equipment/valuables section. Preserve exact native templates where selected. |
| 9. Weapons | Select a native weapon base, then optional attributes; preserve damage, properties and explicit ammunition quantities. |
| 10. Personalities | Optional personality details attach to a chosen item; generated text can be drafted independently but is not delivered as unrelated inventory. |

The section names organize the tool in terms familiar from Shadowdark; they do
not reproduce official table rows or certify equivalent OSR probabilities.
Category visibility is not a promise of rollable coverage. Where no suitable
source is verified, offer manual input with a clear explanation.

### Multipart category recipes — full-rulebook review

The ten categories are entry points into different multipart recipes, not ten
single-table buttons followed by the same generic form. The full V4.9 rulebook,
printed pp. 269–295, was reread and category layouts on pp. 278–295 visually
checked after the user identified this omission. The following inventory records
structure and dependencies, not table rows or probability distributions.

| Category / pages | Parts to expose and preserve |
| --- | --- |
| Random Treasure, 269–277 | Context and available source → treasure result → quantity/value and any fixed type, bonus, tier, benefit/curse or virtue/flaw requirements → matching category recipe. A named native item uses its exact template; only specified additions are resolved. Multiple rewards remain distinct. |
| Mundane Items, 278–279 | Choose luxury item or gemstone/valuable path. Luxury creation has separate feature/material and item-form columns and possible nested form details. Optional unique features apply to luxury objects, gemstones and jewelry. Gemstones have a value reference, not a random gem distribution; do not invent probabilities from its rows. Quantity, material value and unusual size/value adjustments remain explicit. |
| Boons, 280–281 | Choose Oath, Secret or Blessing. Oaths supply a favor/promise; Secrets combine Detail 1 and Detail 2; Blessings supply a benefit with applicable duration/uses. These are alternative paths, not three required additions to every boon. Utility/XP assessment remains GM judgment; do not award XP automatically. |
| Magic Items / Attributes, 282–283 | Optional random item type routes to a category; Qualities determines benefit/curse counts; Personality determines virtue/flaw counts or no personality. Resolve those counts through the relevant category/personality tables. The three-part name/idea generator is a separate naming aid, not an item type or mechanical effect. Bonus is a distinct armor/weapon component. |
| Armor, 284–285 | Armor type/base → bonus → appearance feature → each required armor benefit and curse → any personality/naming additions. A material-plus-reroll result preserves the material while resolving the base type again. The benefit/curse counts come from the originating result, chosen qualities source or manual decision. |
| Potions, 286–287 | Separate Feature 1, Feature 2 and Feature 3 components → required potion benefits and curses → nested choices such as an affected stat, damage type or potency. Do not collapse the feature columns into one field or silently copy a single die result across them. Mixing Potions has two effect columns and changes existing effects; it remains a distinct deferred operation, not ordinary potion creation. |
| Scrolls / Wands, 288–289 | Subtype → its own feature table → fixed or selected tier → that tier's spell result and exact native Spell selection. A separate Curses/Benefits selector chooses the family of tables used for those additions; the selected family then supplies each required benefit/curse. Personality is a separate branch. An upstream fixed tier skips tier generation. |
| Utility, 290–291 | Physical type/form → feature → each required utility benefit and curse → any personality/naming additions. Nested targets/variants remain attached to their originating property. |
| Weapons, 292–293 | Weapon type/base and any ammunition quantity → weapon bonus → feature → each required weapon benefit and curse → any personality/naming additions. Armor and weapon bonus tables are distinct sources and must not be collapsed into one assumed distribution. |
| Personalities, 294–295 | Required virtues and flaws → nested detail choices → personality trait from its two-axis table → alignment chosen by the GM unless a result states it. Attach to the selected item; do not change the character's alignment. |

The book says an item can have some or all qualities; do not force every branch
onto every item. A complete existing template does not require regenerating its
properties. The chapter's magic-item recipe does not establish mandatory magic
qualities/personality for every mundane item or boon; applying extra properties
there is explicit GM authoring, subject to compatibility.

### Next selected tab: Mundane Items — October 28

The user accepted Random Treasure for now and selected Mundane Items as the next
category to develop, followed by one category at a time. This specification is implemented in the October28 slice recorded below;
operator acceptance of its content and workflow remains open.
The source audit rechecked full-book printed278–279 and the open alternative's
actual coverage; see the supporting audit's October28 entry.

Keep the existing connected paper page, shared header, category tabs and completion
controls. Inside Mundane Items, offer **Luxury object**, **Gemstone**, and
**Jewelry** paths. Jewelry is a luxury subtype with its own authoring path; ordinary gear remains available through existing native-item selection,
not a newly invented book table. A complete native item can still skip generation.

1. **Choose the path and source.** Use an available native item, manual results
   from the GM's reference, or SheetDelver Originals for a supported part. Do not advertise a roll where the selected source supplies no table.
2. **Build the object.** Luxury: material/feature, form and any follow-up detail,
   each independently editable. The book does not provide
   a general luxury-price formula. Gemstone: identity, value each, optional explicit
   size/quality adjustment, then quantity. The official gemstone list is a value
   reference, not a random distribution. Jewelry: form and description, followed
   by value; original form and value controls remain separate.
   All three paths offer an independently editable optional **Unique feature**.
   It contributes to the assembled description; it does not silently change
   value or mechanics. Any value adjustment remains explicit.
3. **Review the assembled item.** Show editable final name, description, quantity,
   value each, calculated total and inventory space. Generated parts must visibly
   contribute to the result; replacing one part retains unrelated edits. Native
   icons and mechanics remain when a template is used. Manual gemstones must use
   native Gem documents rather than generic Basic items. Jewelry and luxury
   objects use the supported physical item shape and appropriate library folder.
4. **Save / assign.** Reuse the existing review and receipt flow. An unchanged
   native item remains assignment-only. New or modified items may be saved and
   optionally assigned. Reset this path only after confirmed completion.

The original-content slice supplies separately editable object forms,
materials/workmanship, gemstone identity/appearance, jewelry forms and optional
unique features shared across all three paths. Author any needed nested details
alongside their parent results. Quantity and value remain explicit. Start with
small useful tables; table sizes, probabilities and value suggestions are our own
design decisions to review with the content, not a copied book distribution.
Keep original table content separate from native system mechanics and source
values. An unavailable or unwanted generated part can always be entered manually.

Completion for this slice means the three paths produce native items end to end,
part replacement and totals behave correctly, and field-local validation plus
save/assignment/reset work in the existing desktop/mobile paper layout. Extend
the existing treasure source and mounted suites for representative complete flows;
do not add separate suites for every input or source row. Random Treasure needs
only a regression check if shared behavior changes.

### Substep behavior and source coverage

Render each tab's relevant recipe parts as ordered subsections on its own
connected paper page, with the assembled result visible. Some paths branch or
combine columns; each tab controls its own progression rather than sharing a
forced stepper. Each generated part has
its own result, source, Roll/Reroll when supported, and manual edit. Display required
counts (benefits, curses, virtues, flaws) and expose unresolved nested choices by
the affected field. Unused optional parts need not be completed.

Keep these kinds of tables distinct: a selector routes to a category; a count
result can set several counts together; text columns contribute separate parts;
a nested result adds child choices; a two-axis table requires both coordinates;
a value reference does not imply any random roll. In particular, the Qualities
and Personality rows supply paired counts, not unrelated rolls for each count.
The proposed UI treats combination columns as separately editable parts; exact
roll coupling follows verified source instructions, never a blanket rule that
all columns roll together or all roll independently.

Preserve upstream constraints through the recipe. If a treasure result specifies
a bonus and one benefit, show those supplied values and resolve the benefit;
do not reroll qualities to replace that requirement. GM changes are explicit
manual overrides and retain origin/history without claiming unchanged source
results. Reducing a count or changing a family marks affected existing parts for
resolution; it must not silently delete them or grant extra stale effects.

Open-source suitability is assessed **per substep**, not just per category. The
content inventory must list category/part, official page reference, available
native UUID or exact open source/version, result kind, dependencies, conversion
needs and manual fallback. A useful OSR weapon table alone does not provide its
feature, bonus, benefit, curse and personality tables. Source changes may use a
different procedure; surface that difference rather than pretending to reproduce
the official generation probabilities. Do not auto-roll a book-only substep.

Represent a recipe as ordered parts with stable IDs, parent dependencies and
source provenance. This extends the module's shared draft model; avoid a general
workflow engine. Resolve/revalidate only affected descendants after an edit. A
readable partial preview stays available, but saving or assignment requires all
selected, necessary parts to be resolved or explicitly converted to descriptive
manual content. Existing single-item review/receipt handling remains reusable.

### Build and edit a result

Each category tab has its own creation flow. Its common completion boundary is
**Review → Save**, or **Review → Save and assign → Reset this tab**. Source choices are available Foundry tables/templates,
SheetDelver Originals, and manual input. Separately selected open alternatives remain possible. Filter table choices
by declared relevance/capability; do not expose unrelated class, mishap or other
non-item tables. Native naming tables may be offered only for their naming role.
User-added sources need explicit category assignment, not guessed behavior from
table names or prose. Do not silently fall back between data sources.

Keep the base item, individual attributes and personality as independently
editable parts. **Reroll** replaces the selected part; **Add attribute** appends
another compatible part. Neither may erase unrelated parts. Changing a base or
source revalidates dependent parts and visibly identifies those needing a choice;
it must not leave stale mechanics or silently discard independent manual content.
Any payload-affecting edit retires the final delivery review.

For example: **Weapons → base sword → attribute → optional personality → review**.
Replacing an attribute retains the sword, quantity and personality. Preserve
native item/spell artwork; do not substitute a generic treasure icon when source
art exists. Attributes display whether mechanics are supported or descriptive.
Repeated numeric/effect properties require an explicit supported stacking policy;
never assume every generated addition stacks or applies to every category.

Random treasure may produce an editable list of results. Resolve follow-up tables
into visible parts of that list, preserving source constraints. Bound recursion
and detect cycles; unavailable/unsupported follow-ups remain manual choices.
A direct category can still produce a single result without creating a bundle.
Gems/jewelry review shows name, quantity, value each and calculated total; differently
valued results stay separate. Inventory space remains explicit. Valuable items do
not increase Actor currency, award XP or sell themselves. Coin delivery is a
separate explicit operation, not an Item-value side effect.

### External open-data research — optional, superseded as the next step

The October28 original-content decision above supersedes the following audit/import
sequence as required work. Retain it only if external content is selected later.

Start the content audit with **Basic Fantasy fourth-edition treasure, gems/jewelry
and magic-item tables**. Its text/tables use CC BY-SA 4.0; artwork is separately
restricted. Cairn's CC BY-SA text/relic collection is a supplementary candidate,
not a verified substitute for every missing table family. Verify the exact source
release and individual content before import. Boon/personality and other category
coverage remains unknown until that inventory is complete. See the supporting
audit for research links and limitations.

Store approved alternative tables as versioned module data with attribution,
license notices, stable table/result IDs, category roles, dice/ranges, explicit
quantity/value fields and follow-up references. Retain the license requirements
for adaptations and record conversion decisions. No runtime website scraping,
book PDF ingestion, native-pack replacement or silent equivalence to Shadowdark.

Adapt native draws, open-data draws and manual input into a shared structured
draft. Reuse Core SDK rolls; native documents continue through Registry. Open data
is local module-owned content, not fake Foundry UUIDs or a second compendium cache.
Server orchestration validates table identities/results and compatibility; UI
formats the choices. Extend the existing treasure logic/routes, source pickers,
rich-text controls and exact-once delivery evidence rather than introducing a
parallel generator engine. No Core change is selected or currently established
as necessary.

Mapping an open result into Shadowdark is separate from resolving its roll.
Never equate another system's spell level with a Shadowdark tier, apply its AC or
charge rules blindly, or attach effects by matching names. Retain supported native
mechanics; label other properties for GM adjudication. Review and delivery should
make the actual payload understandable without exposing implementation internals.

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
or scrape the user's PDF or silently modify native packs. An explicitly selected
open-data package may supply alternative tables under the conditions below; it
must not recreate the unavailable official distributions. Runtime Foundry tables
use supported public source/access contracts. Missing sources leave manual entry
available, never silently switch the selected source.

Track provenance per draft section: Foundry table UUID/result and revision for a
native draw; package/table/version/result identity for an open-table draw; manual
entry for externally determined results. Preserve the origin of subsequently
edited values without claiming they remain unmodified draws. Source/page notes
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

## World-item library and completion — selected tab workflow

Saving a reusable world Item is now selected scope, superseding the earlier
single actor-owned-item-only delivery boundary and deferral of world-item library
publishing. The implementation ledger below now records folders, library saving and reset
for the first delivered workflows; the other recipes remain planned.

Unchanged native templates offer **Assign to character** only, with an unchanged-source
note and no library/folder creation. Modified and new item workflows offer
**Save item** and **Save and assign**. Save requires
no recipient. Save and assign includes an explicit character selector (assignment
means its inventory, not changing a User document or granting world-item ownership).
Show the proposed world folder and, when applicable, recipient in the final review.
The reviewed draft creates a world Item first; assignment then creates an owned
copy from that exact saved document. The reusable original remains in the library.
Preserve its source artwork, supported effects and spell links; omit world-folder
membership and library ownership from the actor-owned copy.

In Foundry's Items directory, create folders on first successful save as needed:

```text
SheetDelver
  Armor
  Weapons
  Mundane Items
  Gems & Jewelry
  Potions
  Scrolls
  Wands
  Utility
  Boons  (only for results represented by a supported native Item)
```

All these are Foundry `Folder` documents with document type `Item`, regardless
of their display label; the parent reference is the native `folder` field. These
are world documents, not filesystem directories or compendium packs. The Item
root is separate from the existing combat Actor root even if both are named
SheetDelver. Folder labels use the project's SheetDelver spelling.

Route by the finished item's category, not the originating tab: random treasure
that yields armor belongs in Armor. Magic attributes and personalities attach to
the parent result and do not create standalone Items/folders. Scrolls and Wands
share a creation tab but use separate output folders. Create only categories
actually used. Pure currency and narrative rewards must not be forced into an
invalid Item type to make the folder model fit; retain their explicit separate
application boundary. No currency write is implied by saving an item.

Find/reuse the root by document type and top-level parent, then the category child
under that exact root. Module-created folders carry stable role markers. An
unambiguous existing folder at the intended path can be reused without taking
ownership, renaming it or deleting its contents. Preserve user folder changes;
if multiple folders match or a marked folder has conflicting type/parent, report
the exact conflict rather than choosing arbitrarily. Recheck before creation and
serialize this module's world-scoped folder creation. Do not claim distributed
uniqueness from an in-process lock. Unknown create results require exact receipt/
marker readback rather than blind recreation. Never perform automatic cleanup of
user folders or previously saved items.

A successful Save resets the active tab to a fresh draft. A successful Save and
assign resets only after both steps are confirmed. Keep the active tab selected,
return its viewport/focus to the start and show a compact confirmation naming the
saved item and recipient, with an Open character action where useful. Do not make
users hunt for an off-screen completion banner. Other tabs' unfinished work stays
intact. A failed or unknown step retains the operation and draft; it does not reset
or allow an accidental duplicate completion. A saved-but-unassigned item remains
saved, with a clear retry-assignment action. Reset is a UI action, not deletion.

Reuse saved world Items through public document reads and the existing native
Items directory. A new library-management CRUD page, compendium publishing,
bulk distribution and editing existing saved originals are not implied here.
Deliberately saving a new item with an existing name may create a new document;
name matching must never overwrite an unrelated original. World saves remain
GM-only by default; folder placement is organization, not proof of permission or
secret protection. Existing fully-disclosed assignment restrictions remain until
separate hidden-content support is accepted.

### Verified public contracts and required evidence

Read-only code inspection confirmed `ModuleRequestRuntime.documents` supplies
`list/get/create` for Folder and Item, and `documents.items.create` supplies Actor
inventory copies. The mounted module-document adapter exposes Folder and Item
stores and dispatches these creates through the caller-bound transport. Core's
combat folder helper demonstrates type/parent-aware reuse, but it is private Core
code and must not be imported into the module. Use the public SDK; no direct store
mutation, direct socket or module-owned replacement cache. The module dataStore
holds workflow receipts, not the authoritative world-item library.

Before shipping, prove a focused save-and-assign path: missing folders created,
existing folders reused, one world Item saved, one owned copy assigned, correct
category placement, and only the successful tab reset. Include a saved-world-item/
failed-assignment recovery case and lost acknowledgement without duplicates. These
are static contract findings and a test plan, not live native acceptance. No Core
change is selected or presently shown necessary.

## Writes, visibility and recovery

A draft contains drawn/manual results, per-section provenance, source revisions and
the proposed native payload. Revalidate caller access, GM role, recipient and
sources at commit. Create through public runtime document APIs; no direct socket,
private Core import or second compendium cache.

Use the existing operation/receipt pattern for the delivery boundary. Bind one
request to the reviewed draft, output category and optional recipient; retain
confirmed folder, world Item and embedded Item IDs. Track library save separately
from assignment so retrying the latter cannot repeat the former. A
lost acknowledgement requires readback by exact evidence, never an automatic
replacement grant. Folder creation, world save and actor assignment are separate
writes, not an atomic transaction. A multi-item or coin-plus-item delivery likewise
is not atomic; show confirmed and unresolved portions and resume only proven
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
| G03 | Dedicated category tabs and recipe/substep inventory; implement one complete native/manual armor or weapon tab with world save and optional assignment | Relevant substeps and independent rerolls; type-aware folder reuse; one saved Item and optional owned copy; retry without duplicate save; active tab resets only on success; desktop/phone user review |
| G04 | Audit/license exact open sources, then deliver the gems/jewelry path within Mundane Items and result-list review | Source/version attribution; quantities, per-item and total values correct; reroll preserves unrelated parts; reviewed valuable saved/assigned in its folder without Actor currency changes |
| G05 | Extend verified sources to mundane/random treasure, armor/weapons, magical attributes, potions, utility, scrolls/wands and personalities; handle boons separately | A complete demonstrated category at a time; source coverage explicit; compatible effects only; native spell/template identities retained; unsupported properties remain manual |
| G06 | Add selected bundle/coin/nonphysical delivery capabilities and complete release review | Confirmed/unresolved portions visible without duplicates; no automatic sale/XP; installed archive and desktop/mobile user acceptance; README describes shipped coverage only |

Potion mixing, player crafting, compendium publishing, a dedicated library manager,
reusable saved generation recipes and public cards-to-chat remain later scope decisions.
Saving completed world Items under SheetDelver/type folders is now selected above. Do not silently add
them while implementing the generation flow.

### Deferred: user-supplied table importer (SD-TREASURE-IMPORT)

**Status:** Deferred — reconsider after the complete generator is stable and its
category workflows have user acceptance. Selected for later investigation on
October28; not required for implementation or release of the current generator.

Explore optional import of user-supplied tables from PDFs or other formats into
the relevant category/recipe parts. Original SheetDelver tables remain the
complete built-in alternative, and manual entry remains available. Imported
content would be user-supplied local data, not bundled with module releases or
published as a shared table collection.

Future investigation should establish practical formats/extraction accuracy,
preview and correction of rows/ranges/follow-ups, category mapping, storage and
source provenance, and applicable content permissions. User-supplied import is
not assumed to settle licensing questions. No importer, PDF parser, upload
service or additional dependency is selected now. Reopen only when the generator
is stable and the user explicitly selects this follow-up.

## Proportional validation

Use representative fixtures for available-table draws, manual missing-table
follow-ups, source constraints and native item shapes. Do not build an exhaustive
reference suite for book tables the application does not implement. One mounted GM workflow should cover draft → review → delivery and a
small set of authorization/recovery failures. Reuse current inventory, spell,
wand and rest tests; add a regression only where generated payload behavior
requires it. Avoid another exhaustive test matrix without a player-visible
feature increment. Add representative cases for paired counts, multi-part
features, a nested choice and an upstream fixed constraint as those behaviors
ship; do not enumerate every official result. Complete and demonstrate each
vertical slice before extending more table families.

## Review decisions

- [ ] Confirm this tool's first release scope and its placement after/before 1.0.
- [x] Use available Foundry tables and manual external results; ship no missing official rulebook tables (initial user decision, October 27).
- [x] Plan ten category sections with independently editable additions and explicitly labeled open OSR alternatives (user reassessment, October 27).
- [x] Author original SheetDelver tables instead of requiring external datasets (October28). External imports are no longer a current gate.
- Deferred: optional user-supplied table import after stabilization; see SD-TREASURE-IMPORT.
- [x] Use dedicated category tabs with independent workflows, save reusable world Items under SheetDelver/type, optionally assign, then reset the successful tab (user decision, October 27).
- [x] Implement dedicated tab workflows and save/assign/reset; current work accepted for checkpoint October31. Final installed release smoke remains separate.
- [x] Retain fully disclosed item delivery and reject unidentified templates; remove the redundant recipient acknowledgement per October31 user review. Hidden-identity authoring is outside this scope.

## First working slice — October 27

Checkpoint `a1cd965` contains the accepted sheet editor and this source decision.
The user then authorized beginning implementation and reassessing the result.

- GM dashboard tool **Treasure & Items** uses the Creator's connected paper,
  shared Core page header, existing compendium picker and rich-text editor.
- Caller-readable declared RollTables are selectable. Draws use Core rolls with
  chat disabled and Registry range/result handling. No table content is bundled.
  Formula support initially matches Registry's simple `XdY` contract; other
  formulas and unresolved linked results require manual resolution.
- A table result is a visible reference, not a claim that its prose was fully
  interpreted. Explicit currency amounts can populate value; the GM reviews
  quantity, remaining constraints and follow-ups.
  Native linked physical items can be selected; table text never silently grants
  coins, effects or inventory. **Apply to item details** explicitly copies text
  results into a fresh manual draft, replacing the name/description and clearing
  previous template/spell identity, effects, quantities and value. It remains
  available after rerolls; recipient and GM source note are retained. Review
  and disclosure are reset. Explicit whole-number GP/SP/CP amounts in result
  text populate Item value, including comma-grouped numbers and mixed currencies.
  “Each” stays a per-item value; quantity is still entered separately. Ambiguous
  alternatives, ranges and dice expressions remain manual. No pricing table is
  bundled or consulted. Manual drafting works with no available tables.
- Manual Basic treasure, native physical templates and one-spell Scroll/Wand
  creation are available. Native templates retain their source icon, effects and
  mechanics; spell-derived Scrolls/Wands use the selected Spell icon (user-selected
  presentation behavior beyond the native utility’s minimal payload). No generic
  icon replaces an available source image. New
  description text remains manual. The exact Crawling Kit stays in the existing
  inventory bundle workflow. Spell selection uses available native spells with
  search/tier filtering, independent of recipient class or known spells.
- Review displays the payload's name, type, recipient, quantity, value, slots,
  source, linked spell, description and retained effect names. Native payload
  shapes follow PhysicalItemSD and UtilitySD.createItemFromSpell in 4.0.6.
- This slice delivers fully disclosed items only, with an explicit disclosure
  checkbox. Unidentified templates are refused. Private source notes/table
  provenance stay in caller-bound module receipts, not actor Item flags.
- One reviewed embedded Item create through the public SDK. No coin, XP, sale,
  equip or Actor-stat changes. Confirmed outcomes scroll into view and offer
  Open character / Create another item.
- Durable caller/world/request receipts fence the create. Same-ID retries never
  repeat a dispatched write. A lost response is checked by its exact marker on
  the recipient; an absent/ambiguous match stays unresolved. Status for a specific
  request never substitutes an older successful delivery. Locks serialize this
  process; the public SDK supplies no distributed transaction/CAS guarantee.
- Same-world source refresh preserves manual entries and retires review; account,
  world and connection changes clear the draft. Replays still require GM and
  recipient access. Unknown delivery restores from server receipts on revisit.

**Implemented:** G01 and the bounded G02 draft/review/single-item path, including
manual missing-table follow-ups and native scroll/wand shapes from G04.
**Not implemented:** coin/bundle delivery, automatic recursive follow-ups,
procedural bonus/effect authoring, nonphysical rewards, private/unidentified-item
projection, potion mixing or multi-spell wand authoring. G03–G06 remain open;
this is not a claim of a complete book generator or release acceptance.

Validation: `treasure.test.ts` uses native 4.0.6 data for table and payload checks,
GM/access refusal, unchanged Actor money/XP, and duplicate/lost-ack recovery.
`treasure.browser.mjs` mounts the actual tool with real routes and isolated SDK
stores at 390/1000 pixels, covering manual/table input, spell picker, source
refresh, review, disclosure and recovery. No live Foundry writes or native
operator acceptance are claimed. User review is the next gate.


First-slice verification completed on Core0.22.2 / module0.9.6:

- [x] Native-backed source suite and explicit module/UI/migration typing.
- [x] Source UI and real handler workflow at 390/1000px; screenshots inspected.
- [x] Isolated module contract validation and archive packaging.
- [x] The same two browser workflows using the archive's compiled UI and Tailwind
  stylesheet. The handler/runtime boundary remains an isolated fixture, not a
  native Foundry or full managed-host acceptance claim.
- [x] User walkthrough identified repeated-apply/value defects (corrected) and selected the category-based redesign above. This is reassessment, not acceptance of the existing layout as final.

The checkpoint archive SHA256 is
`e28cabeb9a9e1e2b226b1dff8179f5dc114f3aeef05a04efe30219c97aabe874`.
No release metadata or Core source changes were made.

The subsequent source-icon, repeated text-result application and explicit value
corrections have focused source/mounted checks and typing. The archive above
predates those corrections; it is not their packaged acceptance evidence.


## First tab/library slice — October 27 implementation

User approved the direction and iterative refinement. Implemented the first
bounded native/manual weapon workflow and shared completion path; this does not
claim that all ten recipes or open OSR content are complete.

- [x] Category navigation uses the existing paper tab styling, with horizontal
  overflow confined to the tab bar on narrow screens. Draft fields survive tab
  changes in page memory; no persistent draft feature was added.
- [x] Weapons: exact native base selection, additional attack/damage bonus from
  native predefined effect definitions, independent feature, benefits/curses,
  virtues/flaws, trait and item-alignment entry. Explicit Add/Remove controls
  govern counts; empty selected entries block review beside that entry. Nested
  details are entered manually. Bonus is explicitly additive to retained base
  effects, not a claimed replacement of an existing magic weapon's total bonus.
- [x] Native template images/damage/effects remain; arbitrary entered properties
  become sanitized descriptive text, not invented active mechanics. Original
  descriptions remain independently editable.
- [x] Save item creates a GM-visible world Item in the type-specific child of the
  Item-directory SheetDelver root. An Actor-directory root of the same name is
  distinct. Existing Item folders are reused; only needed categories are created.
- [x] Save and assign saves first, then creates the Actor-owned copy without the
  world folder/ownership. Saving and assignment are recorded separately; readback
  settles lost acknowledgements and explicit resume only sends an undispatched
  step. Existing direct-delivery receipts remain supported.
- [x] Confirmed completion resets the owning tab and focuses its start with a
  visible saved/assigned confirmation. Other tab drafts remain. Unfinished saved
  operations return to their category on revisit and do not reset prematurely.
- [x] Random Treasure now offers the verified native Treasure 0–3 source only;
  irrelevant class/mishap tables are excluded. Existing manual/native templates
  and one-spell Scroll/Wand authoring use the new library completion path.

Still open: the dedicated multipart recipes for armor, potions, mundane/utility,
magic attributes and scrolls/wands; standalone boon/personality workflows; sourced
subtable rolls/automatic dependencies, full count/constraint propagation and
all open OSR datasets. Armor/Potions currently select native templates; Boons and
Personalities explicitly explain that their standalone workflow is not ready.
No missing official table contents/probabilities were introduced. G03 has a
working manual weapon/library slice, not user acceptance of the entire redesign.

Validation uses the existing `src/tests/treasure.test.ts` and
`src/tests/treasure.browser.mjs`, extended for this useful increment rather than
new suites per subtable. Source checks pass for preserved native shapes, generated
bonus changes, typed folder reuse, save-only, assignment, lost-world-save and
lost-assignment acknowledgements, plus permission failure after save and authorized
resume without a duplicate original. Mounted checks at390/1000px pass for repeated
text application, value replacement, field-local validation, tab retention,
independent edits, correct folder save, success-only reset and assignment readback.
Source and packaged screenshots were visually reviewed against the Creator paper
layout; no page-wide horizontal overflow is present.

Explicit module/UI/migration typing, module contract validation and isolated
packaging passed on Core0.22.2/module0.9.6. The archive's compiled UI and both
packaged stylesheets pass those same two mounted workflows with real module
handlers and isolated document fixtures. SHA256:
`f472a3eda383c452ee8058423570ed22872964c001b055e0756d3924fd2fdb94`.
This is not live Foundry/native acceptance. Core and release metadata remain
unchanged; no services, commits or remote operations were started for this slice.


## Source reuse refinement — October 27

The first pass established tabs, a manual weapon recipe and shared save/assignment;
it did not complete the category-specific tables or multipart selections above.
The user identified duplicate scroll/wand options and unnecessary library copies.

- [x] Magic Items excludes scroll/wand authoring and recognized native scroll/wand
  templates, including legacy Basic/Weapon forms. Scrolls / Wands owns those
  controls and supports selecting existing templates. Random Treasure can still
  resolve a scroll/wand result.
- [x] An unchanged native template displays an unchanged-source note and requires
  a character for assignment. It creates no world Item or folder. Both UI and
  server use the shared comparison; modifying content offers library saving and
  reverting the edits restores assignment-only behavior. Source notes and routing
  do not count as item modifications.
- [x] Native prices (`system.cost.gp/sp/cp`) are retained in catalog/form/payload,
  prefilled on selection and shown as a source value alongside editable inputs.
  Inspection found no catalog price stripping; native-backed and mounted checks
  cover the existing prefill. Missing source prices are not inferred from a book.
- [x] Direct assignment retains exact-source provenance and lost-response recovery;
  successful completion resets the tab with an assignment-specific confirmation.

The existing two treasure suites cover this refinement, including changed/reverted
content, recipient validation, zero library/folder writes for unchanged assignment,
legacy categories, native values and lost assignment acknowledgements. Source and
390/1000px mounted workflows and explicit typing passed. Other category recipes,
subtables and OSR content remain open; this refinement does not close ADR-0009.


Packaged UI/styles verification also passed the same390/1000px mounted workflows;
source and packaged screenshots retain the Creator paper layout. Contract validation
and isolated packaging passed. Archive SHA256:
`efed6a436cec776dbb8a412697916dd87d48b9440fc01329aa658613c53aba00`.
Handlers use isolated SDK fixtures; this is not native/live acceptance. Versions
remain unchanged and this refinement is uncommitted.


## Mundane Items implementation — October 28

- [x] Luxury, gemstone and jewelry paths, plus existing native-item selection.
- [x] SheetDelver Originals revision1: eleven tables / 90 authored entries; no
  external dataset or official table transcription. Original forms/materials,
  gem identities/cuts, jewelry forms, nested details, shared optional unique
  features and suggested values have explicit editable results.
- [x] Choose, roll or manually edit each part. Parent-specific details must be
  resolved; changing a parent retains and flags stale detail beside its field.
  Custom names and unrelated parts survive individual rerolls.
- [x] Roll object assembles the form, workmanship/cut, applicable detail and
  suggested value together, preserving notes and unique features. Failure/context
  change leaves the prior draft intact. Manual price entry clears the old price
  source; feature text never silently changes price or adds mechanics.
- [x] Native Gem creation, Basic luxury/jewelry creation, assembled descriptions,
  quantity and value-each/total review, correct folder destination, optional
  assignment and successful completion reset through existing services.
- [x] Creator paper layout, square controls and shared indigo dice buttons reused.
  Source browser checks pass at390/1000px with no page-width overflow, actual dice
  artwork and inputs/rollers on one row. No new navigation/header design.
- [x] Operator acceptance of original table content, suggested prices and the
  complete Mundane Items flow (October28 checkpoint). Current prices/weights are generator design
  choices, not an assertion of official Shadowdark economy rules.

October28 checkpoint: the user accepted the current work, including the card
preview, and authorized committing it before proceeding to the next segment.
This closes the UI-review gate for this increment. It does not assert a new
live Foundry save/assignment acceptance run or independently validate every
original table row/price; those broader claims are not implied by the checkpoint.

Existing treasure source and mounted suites were extended; no new test suite was
introduced. Source checks cover nested-form replacement, native Gem save/assign,
shared unique features, quantity totals, jewelry folders, source provenance and
GM restrictions. Existing Random Treasure, weapons, source reuse and recovery
regressions pass. Explicit module typing passes. Browser evidence is isolated;
no live Foundry/native acceptance is claimed. Packaging evidence follows below.

Random Treasure remains accepted for now. Other category recipes remain open;
ADR-0009 is not closed. SD-TREASURE-IMPORT remains deferred until stabilization.

Pricing refinement during review: the initial shared8–200GP suggestion pool was
not calibrated by item type. The user clarified that the book is the reference.
Gemstone suggestions now span40–350GP, close to the book's40–360GP ordinary-gem
reference range, without assigning copied gem-name/price pairs. Luxury suggestions
remain8–200GP; jewelry uses15–300GP. The book gives no universal luxury/jewelry
price formula: those two pools are original suggestions requiring GM judgment,
not validated official equivalents. All three use distinct editable price draws;
size/quality changes remain manual and native template costs remain authoritative.

Final verification: focused source regressions, explicit module typing, contract
validation and isolated packaging passed. The compiled archive UI with both
packaged stylesheets passed the full mounted workflow at 390/1000px; screenshots
were inspected for layout, dice artwork and value totals. Archive SHA256:
`fb0a9d868bfb5f86373e2d9e6f429d8387e1227a377345f499969540ca4776d4`.
These checks use isolated SDK stores, not a live Foundry installation. Operator
acceptance remains open; no version or compatibility requirement changed.

### Item card preview refinement

The user requested the intended icon within a card preview. Reuse the established
resource card's faded artwork, inset black title and paper body; no separate icon
panel or new card design. Complete drafts preview while editing, and final review
shows the server-prepared item using the same component. Incomplete drafts keep
their existing field validation. Source images remain authoritative; new items
use the native default for their type, explicitly saved in the payload. The
preview is informational and exposes no owned-item actions or document writes.

Verified with the existing treasure source suite, explicit typing and source/
compiled-archive browser workflows at 390/1000px. Mounted checks cover native
template/spell artwork and compare the reviewed gemstone image with the assigned
Item. Screenshots inspected using local native icon files; no live Foundry
connection. Contract validation and packaging passed. Artifact SHA256:
`161a388a186c8fe089488364415194fd35e85121c908f8b3aa12f8e578f509ef`.

## Next segment: Boons — October 28

Checkpoint `2a4e0a0` contains the accepted accumulated tool, cache and Mundane/card
work. The user authorized proceeding to the next segment; Boons follows Mundane
Items in the agreed tab order. Full-book pp.280–281 and native4.0.6
`BoonSD`, `_BaseItemSD`, `PlayerSheetSD._onCreateBoon` and `BOON_TYPES` were
rechecked before implementation. Native Boon is nonphysical: its system fields
add `boonType` and acquisition `level` to the base description/source/properties.
It does not own price, slots, quantity, use counters or expiration fields.

- [x] Oath: one favor/promise; Secret: independent detail and subject combined
  into one statement; Blessing: benefit plus optional duration/limits text.
- [x] Four SheetDelver Originals tables, six equally likely rows each. These
  are independently authored prompts, not the official rows or probabilities.
  Every field permits manual entry, selection and independent SDK rolling.
- [x] Roll boon resolves only the selected path; Secrets roll each part
  separately. Results apply together after success. Notes, manual limits and
  custom names survive rerolls; switching types retains their separate parts.
- [x] Reuse the connected paper, Creator dice controls, rich-text editor and
  resource-card preview. Longer prose uses textareas beside the same dice control.
  Errors remain adjacent to the affected field. Level gained is editable 0–10.
- [x] Save native Boon to SheetDelver / Boons; optionally assign an owned copy.
  The shared receipt flow handles unknown saves/assignment without replay.
  Preview uses the native Boon icon and shows subtype and acquisition level.
- [x] No cost/slots/quantity controls or physical fields in the payload. No
  automatic XP, currency, Actor changes beyond the assigned Item, generated
  active effects, use tracking or rest resets. Blessing text remains GM-managed.
- [x] Operator review of the Boons flow and original prompt content. User accepted
  the increment and authorized checkpoint/commit and continuation on October28.

Only this category is selected. Magic Items / Attributes is the following tab,
not part of this increment. Optional PDF/table importing remains deferred.

Verification: the existing source suite, explicit typing, module contract and
packaging passed. Source and final compiled-archive mounted workflows cover all
three paths at390/1000px; final packaged screenshots were inspected with the
native icons and expanded prose fields. Archive SHA256:
`f99c46c0876d18c65978521167236c37d428a8ef1bccf6a1cff4da61e63caf12`.
No live Foundry acceptance is claimed; the Boons increment remains uncommitted
for operator review after the preceding checkpoint.

Checkpoint follow-up: the user accepted Boons and selected continuation to Magic
Items / Attributes. This closes the Boons UI/content review gate; no additional
live Foundry write or native-version acceptance run is inferred.

## Shared Attributes and Personality — October 29

The October28 prototype treated Magic Items / Attributes as a separate tab with
item-type, count and name suggestions. The user corrected that model: attributes
are additions to the item being built. This decision supersedes that prototype.
Boons checkpoint `9e2f094` remains accepted; this revision is uncommitted for review.

Book relationships checked against full Shadowdark RPG printed pp.284–295:
Armor, Potions, Utility and Weapons have their own benefit/curse tables.
Scrolls/Wands select among those families. Item Personality on pp.294–295 supplies
shared virtues/flaws, rather than separate personalities for each physical type.
Missing official rows are not redistributed. The previously approved original
alternatives/manual-entry policy still applies; no external dataset is added.

- [x] Remove standalone Magic Items / Attributes and Personalities navigation.
  Keep their retired category IDs for recovery of existing operations only.
- [x] Reuse one component within each builder, with independent Attributes and
  Personality switches. Both begin off. Disabling retains entries for re-enabling
  but excludes that section from validation and the saved description.
- [x] Attributes supplies benefits/curses; Personality supplies virtues/flaws,
  personality trait and GM-chosen alignment. Add/remove individual results; no
  count suggestion roller or extra count-resolution workflow.
- [x] Each result supports a nearby die, table selection and manual text entry.
  A reroll replaces only that result. Source/table and edited status remain visible.
  A family change preserves existing entries and changes future result choices.
- [x] Native type/category selects Armor, Potion, Utility or Weapon tables.
  Scrolls/Wands expose the family selector. General drafts with no specific
  physical family also allow that choice. Virtues/flaws share Item Personality.
- [x] Ten original alternative tables, six equally likely rows each: eight
  type-specific benefit/curse tables and two shared personality tables. These
  are SheetDelver Originals suggestions, not official distributions or native
  effects. Manual official results can be entered by the user from their book.
- [x] Keep native artwork, effects, prices and mechanics. Preview and delivery use
  the same escaped additive description. Physical items receive magicItem=true;
  Boons retain their nonphysical schema. Text does not synthesize ActiveEffects.
- [x] Preserve connected paper, SDK header, existing controls and card preview.
  No new Core contract, transport, cache or dependency is introduced.
- [x] Current shared sections accepted for checkpoint October31, including dedicated spell-item properties.

Random item-type generation and three-part naming are removed and deferred until
explicitly selected again. Optional user-table/PDF importing also remains deferred.
Dedicated category procedures (such as Armor base/bonus/features) remain separate
increments; these shared property tables do not mark those workflows complete.

Verification uses the existing treasure source and mounted browser suites, not a
new suite. Source/typing and source UI checks pass; final archive evidence is in
the GM audit. No live Foundry writes or operator acceptance are inferred.

## Category-specific procedures: Armor first — October 29

The user identified the missing context in the remaining generic tabs. Shared
Attributes and Personality are additions; they do not replace each category's
own creation procedure. Implement and reassess each type individually, beginning
with Armor. Preserve the existing connected-paper UI and native card/icon reuse.

Armor has two explicit paths:

- **Existing native item:** choose a complete native Armor document. Preserve
  its price, AC, properties, effects and artwork. Reset to source discards draft
  modifications and restores that selected source; Clear item removes the
  selection and its derived fields. Unchanged items remain assign-only.
- **Build armor:** roll/select an ordinary armor type, roll/select bonus0–3, and
  roll/select or manually enter a cosmetic feature. The selected type supplies
  native mechanics/artwork; this produces a customized Armor item, not a Basic
  item described as armor. Shared additive sections follow this procedure.

Type choices use caller-readable, nonmagical Armor documents in the declared
native gear source with usable AC fields. This includes supplied mithral variants;
no missing mithral mechanics or same-name replacement is invented. Type rolls
choose equally from that available pool. Bonus suggestions use four equally
likely original alternatives; features use eight original cosmetic alternatives.
These are explicitly labeled alternatives, not reproductions of the missing book
rows/distributions. A GM can enter an externally rolled feature and select type/
bonus manually. Do not silently simulate the book's mithral-reroll procedure.

The bonus adds to native `system.ac.modifier`, including a shield's existing
modifier. Do not also create an AC ActiveEffect. Preserve source AC base/attribute,
properties, effects and slots. Preserve an existing baseArmor identifier (e.g.
mithral chainmail); otherwise use the same Foundry slug helper as native armor
mastery to retain the base identity when renamed. Positive bonuses set magicItem.
Prices begin at the base item's value and remain editable, not an inferred magic
item valuation. The preview displays the same AC formula and icon as the payload.

Individual rolls replace their own part. Changing type refreshes its native
fields/artwork while retaining bonus, feature and shared additives. Automatic
names follow type/bonus until edited; custom names are retained. Clear beside Refresh sources
clears the complete builder and recipient and retires any pending review. Source reset/clear controls are also reused wherever
an existing native item is selected in the other implemented tabs.

- [x] Armor procedure, native fields, shared additions and preview implemented.
- [x] Inline validation; existing source and mounted workflow checks extended.
- [x] Operator review of Armor, including the icon and Clear correction. User
  accepted this point and selected the next category on October29.

At the Armor checkpoint, the following dedicated category work remained. These
procedures are now implemented in the subsequent increments below:

| Type | Dedicated procedure |
| --- | --- |
| Weapons | Existing item or new type, bonus, feature; native damage/properties/icon |
| Potions | Existing item or new potion with its three feature parts and potion properties |
| Scrolls / Wands | Separate features, tier and spell selection; applicable property-family choices |
| Utility | Existing item or new form and feature; appropriate native shape/icon |

Random Treasure remains accepted for now. Mundane and Boons keep their accepted
procedures. Missing official prose tables follow the original/manual policy.
Potion mixing, naming/type navigation aids and user-table importing remain
separate deferred work. No Core, version, compatibility or release change.

Armor review correction: the type icon must use the public SDK image resolver,
just like the preview card. Raw Foundry-relative paths resolve against the tool
page and can break. The Clear action sits beside Refresh sources; source-specific
Reset to source / Clear item remain separate existing-item controls.

## Potions — October 29

Armor's procedure and icon/Clear correction are user accepted. The next selected
category is Potions. Full-book pp.286–287 supplies three separate feature columns
and potion-specific benefit/curse tables; potion mixing is a distinct procedure
and remains deferred. Native4.0.6 PotionSD extends PhysicalItemSD, includes the
magic fields and defaults magicItem to true. The native default icon is reused.

- [x] Existing native potion path preserves description, price, icon, effects,
  formula and other source mechanics. Unchanged sources assign without another
  library item; Reset to source and Clear item retain their established meaning.
- [x] Build potion path has three individually required appearance features.
  Each supports original selection/roll and manual entry. Roll all features
  replaces just those three parts atomically; name, properties and other fields
  remain intact. A failed sequence leaves the prior feature set intact.
- [x] Three new original alternative tables, six equally likely entries each.
  These are not official rows/distributions. Shared potion benefit/curse tables
  and the shared personality section remain independently optional. Manually
  entered property results must include any needed targets, duration and uses.
- [x] New items use native type Potion, native potion artwork and magicItem=true.
  The three features and shared additions append escaped description text.
  No formula, spell association or ActiveEffect is inferred from prose. Such
  items expose the existing native-aligned potion action; actual authored
  benefit/curse outcomes remain GM-managed. Existing templates retain theirs.
- [x] Shared Refresh/Clear, card preview, field validation, library save and
  optional character assignment. Clear resets recipient/review along with the
  draft. New potions begin with the existing editable physical-item defaults,
  not an invented value for their powers.
- [x] Existing source/typing and mounted desktop/phone checks pass; final archive
  verification is recorded in the GM audit. No new test suite is introduced.
- [x] Current Potions implementation included in the accepted October31 checkpoint.

The reference UI remains the accepted Armor/Mundane connected paper, input/dice
rows, shared rich-text editor and resource card. This does not select mixing,
crafting costs, potion-effect automation, unidentified-item authoring or the next
category at that checkpoint. The subsequent user instruction selects the remaining
categories together, as recorded below. No Core or contract change or version bump.


## Remaining procedures and permanent modifiers — October 29

The user selected finishing the remaining categories before reviewing the outcomes,
and asked for permanent mechanics such as armor +1 or AC +2. This supersedes the
one-category-at-a-time review gate, not the original/manual-content policy or the
separation of temporary effects from item authoring. Random Treasure remains
accepted as-is; Magic Attributes and Personality remain shared sections, not
standalone duplicate tabs.

- [x] **Scrolls / Wands:** existing native item or a new Scroll/Wand; independent
  subtype feature, tier, and exact tier-matched Spell. Feature and tier support
  original alternatives/manual selection. Spell rolls choose equally among
  caller-readable spells at that tier, not a bundled copy of the book's spell
  table; the recipient's class does not filter GM authoring. Changing tier clears
  the old spell and retires review. Empty tiers are explicit and cannot be rolled.
  A family roll or manual family selection supplies subsequent benefits/curses.
  New items retain the selected Spell icon and native spell link; existing wands
  retain all source spells, including multi-spell templates.
- [x] **Utility:** existing item or new form plus appearance feature. Parts roll
  independently or atomically together. The six original forms use matching
  Foundry icons; custom/edited forms use the Basic default, avoiding stale artwork.
  Existing sources retain their artwork. Native Basic output has treasure=false;
  actual additions set magicItem. Price remains explicit GM input for new forms.
- [x] **Weapons:** existing source or ordinary native gear base, including Basic
  ammunition. Type rolls use caller-readable gear; bonus and feature have separate
  original tables. Native damage, properties, price, slots and art are retained;
  baseWeapon identity survives a rename. Weapon bonuses add native attack/damage
  effects once. Basic ammunition offers quantity entry or 2d6; bonuses are clearly
  recorded as manual because native selected-ammunition handling consumes the
  item without applying its effects to the firing weapon. No global attack bonus
  is granted by merely carrying arrows. Thrown Weapon items remain weapons.
- [x] Each remaining builder shares Refresh/Clear, source reset/clear, connected
  paper controls, exact preview/save/assign and successful completion reset.
  Unchanged existing items assign without another library copy. Ammunition goes
  under Weapons; Scrolls/Wands have their respective folders; Utility uses Utility.
- [x] Eight new original tables contain 43 equally likely choices. Missing official
  prose tables/distributions remain unshipped. Original data and dynamic readable
  source pools are labeled; manual entry is available for appearance/properties.

### Permanent mechanics

Permanent modifiers are explicit structured choices, not inference from prose or
item names. This increment permits the supported native predefined definitions
for additive AC, six ability scores, gear slots and initiative advantage. Numeric
amounts are nonzero safe integers; initiative advantage uses one grant. Duplicate
modifier types in one draft are rejected; the amount belongs in one entry. The
UI states that these additions stack with existing source effects and armor/weapon
bonuses. The generated native snapshot is unchanged; arbitrary effect keys,
formulas, durations and modes are not accepted.

Armor's existing bonus continues to update native ac.modifier, never both that
field and a duplicate effect. An independently selected AC modifier is explicitly
additional. Weapon bonuses use the two native weapon-specific definitions. Other
new modifiers are allowed on equipment types Basic, Gem, Armor, Weapon and Wand;
new grants on Potion, Scroll and Boon are rejected. Original template effects are
always preserved, including on consumables. Changing to an incompatible template
keeps any draft modifiers visible for removal rather than leaving a hidden blocker.

Native equipment suppression is preserved: Weapon/Armor effects require equipped,
identified, unstashed items; Basic/Gem/Wand effects apply while carried, identified
and unstashed. Modifiers have no expiry and no daily reset. They are attached to
the created Item; no permanent Actor source edit is made. Preview and final review
list the exact included effect names. Conditional benefits, spell/potion outcomes,
blessings, charges, temporary effects and prose consequences remain GM-managed.

### Verification and review

- [x] Extend existing treasure source and mounted browser suites; no new suite or
  runtime dependency. Exact source re-resolution, GM/pack checks, tier mismatch,
  malformed modifiers, native preservation, source equality and save/replay covered.
- [x] Preparation verifies utility AC/stat/initiative changes and their suppression;
  armor +2 plus an explicit AC +2 applies once each; weapon attack bonus increases
  by exactly +2. Native effect conformance and weapon fixtures pass.
- [x] Source desktop/phone workflows exercise tier retirement, actual spell/type
  rolls, all-feature rolls, manual text retention, modifier editing, ammunition,
  resolved artwork, previews, saving/assignment and reset. Catalog lifetime remains
  initial load plus intentional refresh.
- [x] Contract/package and compiled UI/CSS browser checks at390/1000px; packaged
  screenshots inspected, artwork loaded, no overflow/errors, catalog reuse intact.
- [x] Current Potions, Scrolls/Wands, Utility, Weapons and permanent-modifier implementation accepted for checkpoint October31.
- [ ] Final installed release smoke covering native save/assignment and equipment effects. Offline evidence and checkpoint approval do not establish exhaustive native acceptance.

A broader legacy boundary check reports 55/57 passing. The two failures, C4 failed
spell loss/focus and RV-03 chat failure after a result, reproduce on committed
baseline 9e2f094 with the same spellLoss bookkeeping mismatch. No spell-loss or
chat implementation is changed by this increment. They are a separate existing
validation limitation, not represented as passing by these checks.

Potion mixing, naming aids, user-table/PDF import, conditional-effect automation
and extra draft protection keep their existing decisions. No Core change, version
bump, compatibility change, commit or release is authorized by implementation.


### Scroll personality exclusion — October 31

User removed Personality from scroll authoring. New scrolls and recognized native
scroll templates hide the complete Personality section; selecting a scroll template
disables any personality additions from the previous draft. Wands retain Personality.
Existing template description/effects are preserved; this does not rewrite saved
items or remove their native content. Attributes remain available for both subtypes.

Spell picker follow-up: choices show tier and each referenced casting Class name.
The catalog resolves only caller-readable Class documents by exact canonical UUID;
missing/unreadable references say Class unavailable rather than guessing from a
spell name. Same-name spells remain separate choices with their own native UUIDs.
The existing picker search includes this class label. This changes presentation,
not tier pools, class eligibility or the saved Spell identity.


### Dedicated spell-item attributes — October 31

The user selected replacing cross-family choices for scrolls/wands with dedicated
spell-focused tables. The earlier book-inspired family selector was inappropriate
for our independently authored properties, whose potion entries assume drinking.
This decision supersedes family selection/rolling in the earlier Scrolls/Wands
procedure; it does not change the book or claim its tables are reproduced.

Four new SheetDelver Originals tables provide six equally likely results each:
Wand benefits, Wand curses, Scroll benefits and Scroll curses. They describe casting,
reading, preparation, handling and consequences of using the actual item. All support
roll/select/manual entry through the existing controls. The selected subtype fixes
the family, including native legacy templates; the family dropdown and family-roll
button are removed. Before selecting an existing spell item, no attributes section
is shown. Wands retain Personality; scrolls do not.

Previously entered properties and existing template contents remain intact; their
provenance stays visible. New choices use the correct subtype tables. Conditional
bonuses, use limits and consequences remain GM-managed prose: no passive equipment
effect, casting eligibility, spell link, consumption or failure rule is inferred or
changed. The separate permanent-modifier authoring boundary remains unchanged.


### Review clarity and card effects — October 31

The user rejected the recipient-disclosure checkbox: assigning an inventory item
already exposes its details and the checkbox provides no privacy control. Remove
the checkbox and its server acknowledgement requirement. This supersedes that
confirmation gate only; source-note separation, existing unidentified-template
restriction, GM authorization and current-review validation remain intact. Keep
the concise note: “Written benefits and curses require manual handling.”

The embedded description editor uses the shared module theme with a visible
black paper border, including its editing body. Shared item cards now include
Effects within the card, replacing the separate name-only treasure-preview list.
Reuse the existing card section typography and spacing; no new card layout.
Each effect shows its changes and state. Owned sheets use exact Item ownership
and prepared activation/suppression, matching the Effects tab. Catalog/treasure
previews label effects enabled/disabled without implying an equipped Actor.
Known keys use native labels; unknown changes retain their key and operation.
This is read-only presentation, including formula text, without new automation.


### Accepted implementation checkpoint — October 31

The user accepted the current work and authorized committing it after the editor,
item-effect card and review refinements. All selected category builders and shared
sections are implemented; the earlier per-increment review notes are historical.
The remaining release work is explicit scope/version selection, compatibility
alignment, required CI and a focused final installed smoke. Existing baseline
spell-loss test failures remain recorded in the GM audit and readiness report.
Deferrals remain deferred; checkpoint approval does not authorize a release.
