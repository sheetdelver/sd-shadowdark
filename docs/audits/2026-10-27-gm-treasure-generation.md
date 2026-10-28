# GM treasure and item generation audit

Date: 2026-10-27
Status: Tab/library, manual weapon and original Mundane Items slices implemented; Mundane operator acceptance and remaining recipes are open in ADR-0009

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
data-package suggestion; The user subsequently authorized implementation after checkpoint `a1cd965`; ADR-0009 now records the first single-item slice and its remaining scope.


## Implementation checkpoint — October 27

The first GM tool slice implements available-table or manual result entry,
physical native templates, manual Basic treasure and one-spell Scroll/Wand
creation. It reuses existing page chrome, Creator styling, selectors, editor,
Registry, public SDK writes and module receipt conventions. Review and explicit
recipient delivery are implemented; the tool does not reproduce absent tables.
See ADR-0009 for the authoritative implemented/open boundary and validation.

Native data regression and mounted actual UI/route checks pass locally. Browser
fixtures cover desktop/phone layout and unknown create acknowledgement recovery;
they do not establish native operator acceptance. No Core edits or production
writes were made. Coin bundles, recursive follow-ups, new mechanical effects,
nonphysical rewards and hidden-item projection remain for reassessment.


## Category redesign and open alternatives — user reassessment, October 27

The first slice exposes a generic result-source picker and item form. User review
selected ten category sections and independently editable attributes/personality,
with similar open OSR sources where native Shadowdark tables are unavailable.
This supersedes the initial manual-only fallback policy; the exclusion of copied
missing official tables remains. ADR-0009 now owns the full layout/data/sequence
plan. No new tables or application changes were made for this planning update.

Research candidates (accessed October 27):

- [Basic Fantasy fourth-edition SRD mirror and license notice](https://jmhimara.github.io/bfrpg/): release 128 text, charts and tables under CC BY-SA 4.0, with artwork exclusions. This is an unofficial mirror, not the current-release authority.
- [Treasure](https://jmhimara.github.io/bfrpg/treasure.html) includes treasure types and gems/jewelry; [Magic Items](https://jmhimara.github.io/bfrpg/magicItems.html) includes category and form/effect subtables. These are candidate coverage, not a completed Shadowdark conversion.
- [Author's fourth-edition listing](https://www.lulu.com/shop/chris-gonnerman-and-erik-wilson/basic-fantasy-rpg-core-rules-4thed-coil-bound/paperback/product-5rnqgm.html) identifies release 142 and CC BY-SA. The official downloads site was blocked by the research browser. Obtain and verify the chosen official source revision before importing; do not silently mix mirror release 128 with release 142.
- [Cairn](https://cairnrpg.com/) states CC BY-SA 4.0 for its text. Its [Reliquary](https://cairnrpg.com/second-edition/wardens-guide/reliquary/) supplies item descriptions/effects and recharge conditions, not a complete replacement treasure-table system.

Verified: suitable candidate families and published licensing notices exist.
Unknown: exact approved package contents, every requested category's coverage,
conversion of monetary/power/spell assumptions, and native effect mappings.
In particular, do not promise open boon/personality tables before verifying them.
No final content package or redistribution compliance review is claimed. No table
text, art, source pack or additional mechanics were imported. Runtime use of native
sources, optional open data and manual input must remain visibly distinguishable.

Next implementation milestone is the category/base/addition workflow using current
sources, followed by one complete open gems/jewelry slice. Existing tests and
receipt handling are reused; representative draw/value/edit/delivery cases replace
any proposal for exhaustive tests of unimplemented table content.


## Multipart recipe correction — October 27

The user correctly identified that the initial category redesign still understated
the official sections' multipart creation. Reread the full V4.9 printed269–295
and visually inspected every category page278–295 (PDF282–299). ADR-0009 now
contains the authoritative category/subtable matrix and dependency behavior.

Key corrections: luxury feature/form/unique-feature parts; gemstone reference
versus random distribution; the three alternative boon paths and two-part
secrets; magic type routing, paired quality/personality counts and separate
three-part naming; category-specific type/bonus/feature/benefit/curse parts;
three potion feature columns; scroll/wand benefit/curse-family selection;
personality nested details, two-axis trait and GM alignment. Potion mixing is
inventoried but retains its explicit deferral. Source instructions and page layout
are evidence for these distinct parts, not authorization to bundle their rows.

UI sequencing and dependency handling are implementation decisions described in
the ADR, not claims of one mandatory sequence prescribed verbatim by the book.
Open alternatives need subtable-by-subtable coverage and conversion review. An
OSR category match alone does not fill all of its required parts. No missing
book distributions or open datasets were added; this was a documentation repair.


## Dedicated tabs and saved world Items — October 27

User selected independent type tabs because their multipart recipes differ, plus
saving completed Items into an on-demand SheetDelver/type folder hierarchy in the
world Items directory, optional immediate character assignment and resetting the
successful workflow. ADR-0009 records the canonical behavior and revised G03.
This supersedes the previous world-item-library deferral. It does not select a
new library-management UI, compendium publishing or saved generation recipes.

Read-only contract inspection: `src/shared/sdk/runtime.ts` exposes caller-bound
`documents.list/get/create` and `documents.items.create`; Core's
`src/server/shared/utils/moduleDocumentServices.ts` maps Folder and Item reads to
primary stores and dispatches creates through the bound request. The existing
`ensureSheetDelverActorRoot` combat helper in
`src/server/services/combats/CombatManagerService.ts` demonstrates document-type/
parent-aware folder reuse. The module must use public contracts, not import that
helper or stores. Folder `type: Item` and `folder` parent distinguish the new root
from combat's Actor root. SDK dataStore is operation bookkeeping, not Foundry
library storage. No Core edit or live write was performed.

Required implementation proof remains: concurrent/repeated folder reuse, exact
world save plus owned copy, saved-but-unassigned recovery, and successful-only tab
reset. Type-specific tabs and saved library Items are planned, not implemented.


## First tab/library implementation evidence

Implemented the dedicated weapon recipe with native bonus effects and manual
qualities, category draft retention, world-item folder save, optional assignment
and success-only reset. The authoritative implemented/open boundary and archive
checksum are in ADR-0009. The unchanged native source reference remains4.0.6.

The extended existing source suite and mounted actual UI/routes passed. Evidence
covers type-specific folders distinct from combat Actor folders, reuse on later
saves, original retained after assignment failure, authorized retry without a
second original, and exact-marker reconciliation after lost save/copy responses.
Both390px and1000px mounted workflows preserve other tab drafts after completion.
Explicit typing, contract validation, packaging and the compiled-archive UI/CSS
workflow also pass. Screenshots were inspected. No live world was modified;
operator review of this first slice is still required. Remaining subtable coverage
and OSR source selection are not certified by these checks.


## Source reuse and category correction

User review confirmed that most category-specific recipes/tables remain missing;
the implemented tabs were an initial foundation, not a completed book generator.
Magic Items duplicated scroll/wand controls. Corrected its filter using existing
modern/legacy capability helpers; Scrolls / Wands now accepts native templates too.

Unchanged-source assignment skips library and folder creation. Server comparison
uses source defaults and meaningful recipe additions, with revert-to-original
support. New/modified drafts retain save-only or save-and-assign. The mounted
workflow verifies the note, required recipient, action labels, source price and
zero new library entries, including a lost acknowledgement. Native cost inspection
in `PhysicalItemSD.defineSchema` confirms `system.cost.gp/sp/cp`; the catalog already
retained those fields. Prefill is verified rather than replaced with a guessed price.

The existing source and browser suites plus explicit types pass. Browser evidence
uses actual module handlers and isolated stores at390/1000px, not a live Foundry
world. Native acceptance remains with the operator; missing recipe content remains
open in ADR-0009.

The packaged UI and declared stylesheets pass the same mounted flows; screenshots
retain the existing paper presentation. Contract validation and isolated packaging
passed. The current archive hash is recorded in ADR-0009. No Core changes or
release metadata changes were made.


## Mundane Items source coverage — October 28

Selected next scope: Mundane Items; the user considers Random Treasure adequate
for now. Read and visually checked full V4.9 printed278–279 (PDF282–283).
The chapter describes nonmagical valuables, with luxury-object composition and
gemstone valuation as distinct procedures. It does not supply a random ordinary
adventuring-gear generator or a general formula for valuing all luxury objects.

| Part | Verified source coverage | Implementation consequence |
| --- | --- | --- |
| Luxury material/feature, form, nested detail | Book-only tables in the reviewed baseline | Separate manual inputs; preserve independent parts. No bundled official choices or weighted fallback. |
| Unique feature | Book-only table in the reviewed baseline; user clarified shared applicability | Optional manual detail for luxury objects, gemstones and jewelry. Preserve it independently; absence must not block creation and it does not automatically alter value. |
| Official gemstones | Value reference, without roll ranges | Manual/native value selection; do not infer uniform random odds. |
| Open gemstones | Basic Fantasy4e release128 mirror: base category/value, optional adjustment, independent identity table | A labeled alternative with its own values; resolve value adjustments before quantity totals. Quantity generation is conditional on its hoard procedure, not mandatory for every single gem. |
| Open jewelry | Same source: form table and separate value roll | Distinct form/value controls with manual override; no claim that it supplies the official luxury or unique-feature tables. |
| Existing physical sources | Native4.0.6 gear/magic-items packs retain costs and icons | Preserve normal template behavior. Neither pack contains top-level Gem documents in this checkout; embedded adventure gems do not establish a declared general gemstone catalog. |

Rechecked [Basic Fantasy treasure](https://jmhimara.github.io/bfrpg/treasure.html)
and its [source/license notice](https://jmhimara.github.io/bfrpg/) on October28.
The mirror explicitly identifies fourth edition release128, Chris Gonnerman,
and CC BY-SA4.0 for text/tables, with artwork separate. It is an unofficial mirror;
the official downloads page returned403 during this check. Do not describe it as
a fresh authoritative latest-release check or silently mix it with another release.
No open dataset or book table was imported in this audit. Pinning and attributing
adapted data is still part of the implementation, rather than a completed gate.

ADR-0009's next-tab specification records the proposed user flow and bounded
acceptance checks. Existing generic controls do not yet satisfy this specification.
This audit changed documentation only; no live Foundry actions or runtime checks
were performed or claimed for a completed Mundane Items workflow.


## Original table content selected — October 28

The user selected authoring original generation tables instead of continuing to
search external datasets for every missing procedure. Re-read the publisher's
[FAQ](https://www.thearcanelibrary.com/blogs/shadowdark-blog/faq-on-the-shadowdark-rpg-third-party-license):
its table-layout answer permits similar layouts with original creative content.
That supports original authorship, not copying or lightly rewriting book rows.
Its separate answer about digital GM/VTT tools remains a distinct permission
question; this finding does not claim that authorship resolves the application's
licensing position.

Basic Fantasy/d20/Open5e investigations are source research, not remaining gates.
No external content was imported. The selected next scope is original Mundane
Items tables and their native-item authoring flow. Unique features apply to gems,
jewelry and luxury objects. The current specification is in ADR-0009; no table
content or new runtime implementation has been delivered in this decision update.


## Mundane Items implementation evidence — October 28

Implemented the selected original-content procedure; the earlier source-search
findings remain historical, not incomplete implementation gates. ADR-0009 records
the shipped-in-source behavior and open operator acceptance. Original rows live
in `src/data/mundane-tables.ts` and do not reproduce the missing official tables.
The current native4.0.6 Gem model extends PhysicalItem without extra fields;
Gem/Basic payloads retain native quantity, costs and slot semantics.

The existing source suite passed with representative luxury nested detail,
gemstone save/assign, unique-feature description escaping, value totals, jewelry
routing and GM-only original rolling. Both390/1000px mounted workflows use actual
module handlers with isolated document stores and pass all three paths, per-part
reroll preservation, tab retention, actual dice-icon rendering and success reset.
Catalog requests remain one initial load plus the deliberate context refresh.
Evidence: `/tmp/sd-mundane-source.log`, `/tmp/sd-mundane-browser/results.json`,
`/tmp/sd-mundane-types.log`. Source screenshots were inspected; packaged evidence
is recorded separately after its verification. No production connection or Actor
mutation was used. Original content and suggested-price acceptance remain with
the operator; passing fixtures do not establish native acceptance.

Final price refinement uses distinct original suggestion pools by item type.
Gemstones use 40–350 GP against the book's 40–360 GP ordinary-gem reference range;
luxury and jewelry suggestions remain original design choices, not official
equivalents. Native template values remain preserved and every price is editable.
Source regressions and explicit typing passed after this refinement.

Contract validation and isolated packaging passed in
`/tmp/sd-mundane-package-wu8tzhcg`. Archive SHA256:
`fb0a9d868bfb5f86373e2d9e6f429d8387e1227a377345f499969540ca4776d4`.
The compiled UI and packaged stylesheets passed the same mounted workflows at
390/1000px, including final gemstone values and quantity totals. Screenshots were
visually inspected; dice icons render beside the inputs and neither width has
page overflow. Results: `/tmp/sd-mundane-archive-browser/results.json`; build log:
`/tmp/sd-mundane-package.log`. Browser handlers use isolated SDK stores; this is
not live/native acceptance. Browsers exited; no service was retained.

### Item artwork preview — October 28

Complete drafts and final reviews now reuse the existing resource card, including
its artwork, title, value and assembled description. The shared payload builder
preserves template/spell images and explicitly supplies native default artwork
for newly authored item types. The spell catalog now includes its existing image
and type; previewing adds no requests or writes.

Focused source tests and explicit typing passed. Source and compiled-archive
mounted checks passed at 390/1000px, including template/spell image selection,
gemstone image rendering and saved-image equality. Screenshots were visually
reviewed with native icon assets read from the local installation. Evidence:
`/tmp/sd-treasure-preview-source.log`, `/tmp/sd-treasure-preview-types.log`,
`/tmp/sd-treasure-preview-browser/results.json`,
`/tmp/sd-treasure-preview-archive/results.json` and
`/tmp/sd-treasure-preview-package.log`. Archive SHA256:
`161a388a186c8fe089488364415194fd35e85121c908f8b3aa12f8e578f509ef`.
No Core changes, live Foundry actions, version changes or Git mutations.

October28 operator checkpoint: user accepted the current Mundane Items/card
preview work and authorized committing the accumulated GM tool/cache changes
before continuing to the next category. UI review is accepted; no fresh live
Foundry write evidence is inferred from that acceptance. Next segment: Boons.
