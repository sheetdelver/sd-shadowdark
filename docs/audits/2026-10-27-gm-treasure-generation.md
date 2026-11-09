# GM treasure and item generation audit

Date: 2026-10-27
Status: Completed — selected workflows accepted and released under ADR-0009

Current disposition: [ADR-0009 closeout](../adr/0009-gm-treasure-and-item-generator.md#closeout--november-8-2026)
supersedes the staged implementation/review notes below. Naming/card sharing and
Boon effects are completed in ADR-0010/0011. Imports and potion mixing remain
deferred; historical source research does not reopen them.

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

## Boons implementation — October 28

Following checkpoint `2a4e0a0`, reread and visually inspected full-book printed
pp.280–281 (PDF284–285). The paths are Oath, Secret and Blessing; Secrets combine
two details. Utility determines any GM-assessed XP; this generator does not grant
XP. Native4.0.6 `system/src/models/items/BoonSD.mjs` extends `_BaseItemSD` with
`boonType` (oath/secret/blessing) and `level`. `PlayerSheetSD._onCreateBoon` creates
that shape. Boons are not physical items and have no native duration/use-counter
fields. No declared pack Boon templates were found in the local native checkout.

Implemented three paths with four original six-row tables, manual entry,
independent part rolls and atomic whole-boon rolls. These prompts do not copy
the official entries or distributions. Blessing limitations remain descriptive;
no effects or rest counters are synthesized. The native Boon payload preserves
the selected subtype and acquisition level, uses its native icon, and routes to
SheetDelver / Boons through the shared save/assignment recovery service.

Source tests passed for all three paths, native nonphysical payloads, validation,
escaped descriptions, no Actor money/XP change and lost-save recovery without
duplicate creation. Source mounted workflows passed at390/1000px for all paths,
part rerolls, missing Secret subject correction, navigation retention, preview,
save-only and assignment/reset. Source screenshots were visually inspected;
longer prose fields were then expanded to textareas for readability on phones.
Explicit module typing passed. Final packaged UI verification is recorded below.
No Core edit or live Foundry connection; native operator acceptance is pending.

Final contract/package checks and compiled-archive workflows passed at390/1000px.
The textarea refinement exposed an implicit-label issue after entering duration
text; an explicit label/input association corrected it and the same workflow
then passed. Packaged screenshots were inspected for all three paths, card
artwork, readable prose and no page overflow. Source evidence:
`/tmp/sd-boons-source.log`, `/tmp/sd-boons-types.log`,
`/tmp/sd-boons-browser/results.json`. Final archive evidence:
`/tmp/sd-boons-package.log`, `/tmp/sd-boons-archive-browser/results.json`.
Archive SHA256:
`f99c46c0876d18c65978521167236c37d428a8ef1bccf6a1cff4da61e63caf12`.
Browsers exited; no service retained. Version/compatibility remain unchanged.

The user subsequently accepted the Boons increment and authorized committing it
before continuing to Magic Items / Attributes. UI/content acceptance is recorded;
no new live Foundry write or native-version test is inferred from that approval.

## Magic Items / Attributes — October 28 (superseded prototype)

User accepted Boons; checkpoint `9e2f094` precedes this increment. Re-read full-book
printed pp.282–283 (PDF286–287), including the type/quality/personality separation
and three-part naming aid. Native4.0.6 `_PhysicalItemSD` has a magicItem flag;
native Boons remain nonphysical. No property prose is interpreted into effects.

Implemented six labeled original suggestion tables, shared attribute authoring,
type navigation that preserves existing drafts, explicit name application and
retained-extra resolution when counts shrink. Complete native items still support
direct assignment without library duplication. New properties preserve original
mechanics/artwork/effects and append escaped descriptions; manual category-specific
property results remain explicit pending their respective tab increments.

Existing source tests cover count requirements and reductions, independent naming,
source preservation, unchanged-source detection, native Boon shape, and save/
assignment without replay or Actor money/XP changes. Mounted390/1000px tests cover
type navigation/draft retention, missing result correction, count reduction,
personality prerequisites, explicit name application, preview and successful
assignment/reset. These tests passed before the final bounded count suggestions
and required-label refinement; final package evidence follows below.

Final source regressions and explicit typing passed after those refinements.
Contract validation and packaging passed. Final compiled-archive mounted
workflows passed at390/1000px; screenshots were inspected for the shared controls,
native icon, card descriptions and no page overflow. Native icons were read from
the local installation; test writes use isolated SDK stores only. Existing
catalog request counts remain one initial load and one explicit context refresh.
Evidence: `/tmp/sd-magic-source.log`, `/tmp/sd-magic-types.log`,
`/tmp/sd-magic-browser/results.json`, `/tmp/sd-magic-package.log`,
`/tmp/sd-magic-archive-browser/results.json`. Archive SHA256:
`97fcafa8759ff73ba948ef219db66813bae99d3919231e6a81940993954d06ab`.
No service retained, Core edit, version/compatibility change or new Git commit
after the Boons checkpoint. Operator review of this increment remains open.

## Shared additive sections — October 29

User correction supersedes the separate type/count/name prototype. Re-read full
book pp.284–295 and visually inspected the Item Personality page. Benefit/curse
families are type-specific; virtues/flaws are shared. ADR-0009 records the current
procedure and deferred naming/type aids. The official missing rows remain absent.

One shared component now supplies independently optional Attributes and Personality
inside the existing builders. Ten original alternative tables have 60 rows total;
individual results support roll/select/manual editing. Native/legacy item types
select the applicable family; scrolls/wands choose one. Changes to a family or
switch preserve draft text. Disabled sections are omitted from validation/output.
Old category identities remain recoverable without replaying saved writes.

The existing source suite checks family routing (including legacy wands), valid
property provenance, independent switches, missing required input, escaped prose,
native effect/artwork preservation, native Boon shape and exact save/assignment.
The existing mounted workflows exercise both sections, single-result rerolls,
manual curses, selected flaws, scroll/wand family changes, draft retention,
preview/assignment/reset and unchanged catalog request counts at390/1000px.
Source and typing passed; desktop/phone rendered layouts were inspected. All
writes use isolated SDK fixtures; native/operator acceptance remains open.

Final evidence: source regressions and explicit typing passed after the correction;
contract validation and packaging passed. The compiled archive and its stylesheets
passed the full mounted workflows at390/1000px, including Scrolls/Wands changing
families before rerolling. Packaged desktop/phone screenshots were inspected:
inline dice remain beside text fields, source tables are identified, and the page
has no horizontal overflow. Catalog counts remain unchanged.
Evidence: `/tmp/sd-additives-source.log`, `/tmp/sd-additives-types.log`,
`/tmp/sd-additives-browser/results.json`, `/tmp/sd-additives-package.log`,
`/tmp/sd-additives-archive-browser/results.json`. Archive SHA256:
`b81d9c0161689bed8fcf6e932a68fb3309c81e66453a6f17e5060665555baa69`.
No services retained. Core is unchanged on main; no version or compatibility bump.
The corrected increment is uncommitted for operator review.

## Armor procedure — October 29

The user selected individual category workflows, starting with Armor's missing
existing/build distinction. Re-read and visually inspected full-book printed284
(PDF288). The native4.0.6 `ArmorSD` schema, ordinary gear documents, magic armor
and `ItemImporterSD._buildArmorObj` establish the AC/attribute/modifier and base
identity fields. Native ordinary shields contribute modifier2; an authored +2
therefore produces modifier4. Using a second AC effect would double the addition.
Native mithral entries already supply their slots/properties/baseArmor identity.

Implemented the dedicated Armor procedure from ADR-0009, exact source reset and
clear, per-part rolls, native artwork and AC preview. Seven ordinary types are
available in the pinned gear snapshot; the application reads the pool dynamically
rather than copying that count or their mechanics into code. Armor bonus/feature
alternatives contain4/8 equally likely original rows. No official table rows were
bundled and no active effect is inferred from feature prose.

Existing treasure source regressions now cover native gear eligibility, GM type
rolls, plate/shield AC, mithral preservation, base identity, native effects/icons/
prices, validation, source immutability and exact library/assignment. Mounted
workflows at390/1000px cover both paths, reset/clear, per-part roll/select/manual
input, custom-name retention, icon refresh, delivery and builder reset. Initial
source/type/browser checks passed; final archive evidence follows below.
No live Foundry connection, production writes or operator acceptance is inferred.

Final Armor verification: source regressions, explicit typing, module contract
validation and packaging passed. The compiled archive's complete browser workflow
passed at390/1000px, including the AC preview, native reset/clear and Armor save/
assign/reset. Packaged screenshots were inspected for the connected-paper layout,
inline rollers, full-width feature choices, source notes and actual base artwork.
No horizontal page overflow or browser errors; catalog request counts unchanged.
Evidence: `/tmp/sd-armor-source.log`, `/tmp/sd-armor-types.log`,
`/tmp/sd-armor-browser/results.json`, `/tmp/sd-armor-package.log`,
`/tmp/sd-armor-archive-browser/results.json`. Archive SHA256:
`4d39788c4affb2bf26a3db4defa5c3c2e0edab57b069c3459986ce6b3bbbf2ab`.
No services retained. Core remains unchanged; current work is uncommitted for
operator review. Other dedicated category procedures remain open in ADR-0009.

### Armor icon and start-over correction

Operator reported a broken Mithral Chainmail icon and requested Clear beside
Refresh sources. The type thumbnail used a raw relative path instead of the SDK
image resolver. Earlier browser fixtures used an identity resolver and served
Foundry assets from the tool origin, masking the defect. The existing browser
suite now separates the Foundry asset origin and checks the resolved URL and
loaded image. Before the fix it failed at both390/1000px on that exact URL check.
The thumbnail now uses useSDK().resolveImageUrl, preserving its original artwork.

Clear is beside Refresh sources and resets the complete Armor draft, recipient,
preview/review, errors and optional sections without a write or catalog reload.
It replaces the lower Reset armor button. Existing-item Reset to source and
Clear item retain their distinct purpose. The same browser workflow checks Clear
against a filled, reviewed draft before continuing the normal build/save flow.

Correction verified: explicit typing, contract/package checks and the updated
compiled-archive browser workflow passed at390/1000px. Both packaged screenshots
were inspected; the type icon loads from the resolved Foundry asset origin and
Clear sits beside Refresh sources. Clearing a reviewed form removes its values,
recipient and review without writes or extra catalog requests.
Evidence: `/tmp/sd-armor-icon-before/results.json` (reproduced failure),
`/tmp/sd-armor-icon-types.log`, `/tmp/sd-armor-icon-package.log`,
`/tmp/sd-armor-icon-archive-browser/results.json`. Archive SHA256:
`19dd4a8470bfd0a0b3eec7f815094a5d5ea6d09023f1ed8b97ac98ebb2537aa1`.
No live Foundry writes or retained services. Changes remain uncommitted.

## Potions — October 29

User accepted Armor, including the corrected icon and Clear placement, and
selected continuation. That operator gate is checked in ADR-0009. Potions is the
next category in the agreed tab sequence. Re-read full-book printed286–287 and
visually inspected its three feature columns. Reviewed native4.0.6 PotionSD,
PhysicalItemSD, magic fields/default artwork and the existing potion action.

Implemented separate build/existing paths, three original/manual features,
per-feature and atomic all-feature rolling, potion property context, native
Potion output and shared preview/save/assignment/reset. Three new original tables
contain18 independently authored rows. No official missing rows or distributions
are copied. Mixing and interpretation of prose into mechanics remain deferred.

Existing treasure source checks cover feature validation/provenance/escaping,
real Potion payload/icon, empty generated effect/formula data, recognition by the
existing potion action, native source preservation and exact library/assignment.
The existing browser workflow covers both paths, source reset/clear, individual
and combined rolls, manual text retention, potion-specific property rolls,
resolved native/default images, preview and save/assign/reset at390/1000px.
Source, explicit typing and initial browser workflows passed; rendered source
layouts were inspected. Final packaged evidence follows below. All writes use
isolated SDK fixtures; no native/live acceptance is claimed for this increment.

Final Potions verification: source suite, explicit module/UI typing, contract and
packaging passed. Source and compiled-archive browser workflows passed at 390 and
1000px; packaged screenshots were inspected. No horizontal overflow or browser
errors. Catalog requests remained initial load plus intentional refresh.
Evidence: `/tmp/sd-potion-source.log`, `/tmp/sd-potion-types.log`,
`/tmp/sd-potion-browser/results.json`, `/tmp/sd-potion-package.log`,
`/tmp/sd-potion-archive-browser/results.json`. Archive SHA256:
`8f92c13dfdb522c65e2e44aff31efe9e8cc60e03d0781b7f77d60a48c2c10857`.
No live Foundry writes, retained services or Core changes. Potions awaits operator
review; changes remain uncommitted and release metadata is unchanged.


## Remaining category procedures and permanent mechanics — October 29

User selected all remaining categories before a combined review and asked to
support permanent effects. Full-book printed288–295 was re-extracted, and the
Scroll/Wand, Utility and Weapons layouts visually inspected. Source references:
native4.0.6 WeaponSD, BasicSD, PhysicalItemSD, PlayerSD selected-ammunition handling,
and the module's generated predefined-effect snapshot and existing item suppression.
The book's structure informs the workflows; no missing table prose or distribution
is bundled. Eight new original tables supply43 equally likely alternatives.

Implemented separate Scroll/Wand feature+tier+spell selection, Utility form+feature,
and native Weapon/ammunition type+bonus+feature procedures. Existing-item paths and
source artwork/price preservation remain. Type/spell draws use current authorized
native pools. Tier changes clear spell choice; exact preparation rejects a wrong
or unavailable tier/source. Utility icons follow original forms only while their
text remains unedited. Basic ammunition exposes quantity entry/2d6 and records its
bonus as manual: native firing consumes selected ammo but does not apply its
Item effects to that weapon's roll. No passive global attack bonus is synthesized.

Permanent modifiers use nine allowlisted native definitions (AC, six stats, slots,
initiative advantage). Tests prove prepared AC/stat/initiative changes, suppression,
armor field/effect additivity without duplication, and exactly +2 attack from a
+2 Weapon. Unsupported types/keys, duplicates and malformed amounts are rejected;
source effects remain and no Actor source fields change. New temporary/conditional
mechanics are not inferred from descriptive properties. This selection supersedes
the earlier wholly-descriptive limitation only for these explicit controls.

Existing source suite, explicit typing and source browser390/1000px pass. Mounted
checks include real original/dynamic rolls, tier invalidation, empty tier behavior,
manual-part retention, Clear/reset, resolved artwork, preview and exact save/assign.
Native effect conformance passes93/93; weapon/choice fixtures pass. A broader legacy
boundary suite passes55/57: C4 failed spell/focus and RV-03 chat failure mismatch on
spellLoss bookkeeping. Both reproduce on an isolated git-archive of committed
baseline9e2f094; no relevant spell/chat implementation changed. Preserve this
validation limitation rather than labeling all suites green.

Evidence: `/tmp/sd-remaining-source.log`, `/tmp/sd-remaining-types.log`,
`/tmp/sd-remaining-browser-final/results.json`, `/tmp/sd-remaining-effects.log`,
`/tmp/sd-remaining-weapons.log`, `/tmp/sd-remaining-boundaries.log`,
`/tmp/sd-remaining-boundaries-baseline.log`. Packaged evidence follows below.

Final archive verification passed: contract/package checks and compiled UI/CSS
workflows at390/1000px. Screenshots of Scroll/Wand, Utility and Weapon builders
were inspected; native artwork, adjacent rollers, connected paper, card previews
and modifier lists render correctly with no horizontal page overflow or browser
errors. Catalog count remains two (initial load plus intentional refresh), including
remount. Browser exited; no test services retained. Archive SHA256:
`5bca8a23cbefe52784c68c5cbab0b429adebec9c8e4545e2f9eaf4a69b54483d`.
Evidence: `/tmp/sd-remaining-package.log`,
`/tmp/sd-remaining-archive-browser/results.json` and its rendered screenshots.
Core remains clean/unchanged; no version bump or Git write. Potions and the new
procedures/modifiers remain ready for operator review, not operator accepted.


## Scroll review refinements — October 31

Removed the Personality authoring section for new/recognized native scrolls; wands
retain it. Selecting a scroll template disables draft personality additions while
preserving copied source description/effects. Attributes are unchanged.

Spell choices now show tier plus casting Class labels resolved through exact native
class references and the caller-readable classes collection in the existing cached
catalog. Missing references display Class unavailable. Same-name native Wizard and
Priest Light spells remain distinct, searchable by class, and retain their UUIDs.
No class-based eligibility filter or new cache lifecycle was added.

Existing source suite, explicit typing, contract/package and compiled browser checks
pass at390/1000px. Picker screenshots inspected; checks verify same-name class labels,
class-name search, absent scroll Personality and retained wand Personality. Catalog
request count remains two (initial load plus intentional refresh). Browser exited.
Evidence: /tmp/sd-scroll-review-source.log, /tmp/sd-scroll-review-types.log,
/tmp/sd-scroll-review-package.log, /tmp/sd-scroll-review-browser/results.json.
Archive SHA256: ba1178ade616658175709b67485a7e8ab78bc0c69097f6205cfbeada81703bd4.
Earlier baseline spell-loss boundary failures remain separately recorded; those
unrelated suites were not rerun for this UI refinement. No Core/release/Git writes.


## Dedicated spell-item attributes — October 31

Replaced cross-family selection/rolling with subtype-specific Wand and Scroll
benefit/curse tables. Four original alternative tables contain six entries each.
New and recognized legacy templates select the appropriate family automatically;
existing draft properties and native template mechanics remain preserved. Roll,
select and manual editing remain available. Conditional outcomes stay descriptive,
with no inferred passive effects or casting/resource changes. Scrolls still omit
Personality. ADR-0009 records the selected correction.

The existing treasure source suite, explicit module typing, contract/package checks
and compiled-archive browser workflows pass at390/1000px. Regression coverage
checks family resolution, source provenance, manual edit preservation, absent
cross-family controls and retained native spell links. Desktop Wand and phone
Scroll screenshots were inspected against the existing shared Attributes layout;
no visual redesign or new control pattern was introduced. Browser checks report
no horizontal page overflow or browser errors. Catalog requests remain two
(initial load plus intentional refresh). The browser exited without retained services.

Evidence: /tmp/sd-spell-tables-source.log, /tmp/sd-spell-tables-types.log,
/tmp/sd-spell-tables-package.log, /tmp/sd-spell-tables-browser/results.json.
Archive SHA256: c04304c27551c2a9bd3560f88cb4dbb28db90d0943157d7ff363a1e334c0260e.
Core is unchanged. No live Foundry writes, version changes or Git mutations.
Operator acceptance remains pending; the previously recorded baseline boundary
failures are unchanged and those unrelated suites were not rerun for these tables.


## Editor boundary, item effects and save review — October 31

The shared embedded editor theme now has a black paper border, including the
Treasure/Creator overrides. Shared item cards show effect names, changes and
state; the separate treasure name-only list was removed. Owned cards filter by
exact Item owner and use prepared state shared with the Effects tab. Previews
show enabled/disabled rather than asserting Actor activation. Legacy and v14
changes use the existing canonical reader. Native labels are used where known;
custom keys/formulas remain literal. The redundant recipient checkbox/server
acknowledgement is removed. Authorization, source-note privacy, identification
restrictions and current-review validation remain enforced.

Existing treasure source tests and explicit module typing pass. New regression
cases cover same effect IDs on different owners, v14-over-legacy precedence,
active/disabled/non-transferred/situational states, unequipped/stashed suppression,
preview status and absent effects. Delivery without disclosure acknowledgement
succeeds; an outdated review still performs zero writes.

Contract/package and compiled UI/CSS browser workflows pass at390/1000px, including
assignment/recovery without the checkbox, computed editor borders and effect
changes inside the preview card. Desktop editor and phone utility card screenshots
were inspected against the existing paper UI. No horizontal page overflow or
browser errors; catalog request count remains two (initial plus intentional refresh).
The browser exited and no test service is retained. Evidence:
/tmp/sd-card-effects-source.log, /tmp/sd-card-effects-types.log,
/tmp/sd-card-effects-package.log, /tmp/sd-card-effects-browser/results.json.
Archive SHA256: ccd35d2beb389d0a5bd9f0c46143392f0c1b999d2ca49e95dee554acd5a010ce.
The artifact precedes documentation and whitespace-only cleanup. Core is unchanged;
no live Foundry connections/writes, Git mutations or version changes occurred.
Operator review remains pending. Earlier baseline boundary failures remain recorded
and those unrelated suites were not repeated for this presentation change.


## Accepted checkpoint — October 31

After reviewing the shared editor border, item-card effects and simplified review,
the user accepted checkpointing and committing the current implementation. This
includes the completed category builders and shared properties documented above.
ADR-0009 is Implemented; individual earlier “awaiting review” notes are historical.
Final installed release smoke, compatibility alignment and the two known baseline
boundary-test failures remain listed in the current readiness report. No release
metadata or deferred feature scope changes accompany the checkpoint.
