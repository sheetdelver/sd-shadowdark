# ADR-0003: Preserve Shadowdark presentation through behavior changes

Status: User review corrections implemented and isolated-verified; target card layout confirmed, remaining functional review open
Date: 2026-10-20

## Current review status — 2026-10-22

The user verified the legacy wand correction (SD-UI22) working and requested a
commit/checkpoint of the accumulated repair pass. Further work is still intended;
this is not ADR closeout or release authorization. Earlier pending-review notes
are superseded for the explicitly verified wand flow.

Latest user verification confirms spell lists/selection and level-up grants work
after the SD-UI16/SD-UI18 corrections. This is acceptance of the tested flows,
not a claim of exhaustive manual class/talent coverage. Broader sheet review
remains open; historical pending-retest notes retain their checkpoint context.

The user subsequently confirmed language behavior and text/formula formatting.
Their new Destined Effects warning is tracked separately as SD-UI19 below.

The user explicitly confirmed that additional Shadowdark review remains. Core's
ADR closeout and published0.20.0 release do **not** close this module ADR or
authorize its release. The current checkpoint includes the subsequent SD-UI14–22 corrections;
remaining work is the user's review and correction of any further findings.

- Confirmed by the user: the illustrated background-card layout, optional monster
  artwork and informational reference-card behavior.
- Implemented and isolated-tested, awaiting completion of module review: restored
  dialog styling (spell/language/Boon/Effect and other inspected surfaces), spell
  picker labels, bounded language customization/full catalog, focus eligibility,
  responsive sheets/tools and their interaction with the retained rule/recovery
  paths. Do not infer blanket acceptance from the separate artwork confirmations.
- Compatibility: Core0.20.0 is now published; the required SDK3.5.0/module-api1.7.0/
  UI3.3.0 baseline is available. This removes the publication dependency only.
- Release is held for user review. ADR0001/0002 remain closed for their previously
  accepted native behavior scope; new findings belong in this active audit.

The [whole-UI audit](../audits/2026-10-20-presentation-regressions.md) remains the
current inventory and verification record, including all42 changed UI paths and
later user corrections. The subsequent SD-UI13 background finding below is implemented; it does not
close the remaining operator review.

## Context

The user reported visibly inconsistent dialogs after native alignment and spell
parity work and requested a review of **all** UI changes. The
[presentation audit](../audits/2026-10-20-presentation-regressions.md) inventories
42 changed paths since the pre-alignment UI. ADR-0001/0002 remain closed for
their selected behavior scope.

## Decision

Preserve Shadowdark's paper surface, black rules, serif uppercase headings,
square controls and offset shadows. Restore management-dialog typography,
spacing, controls and picker width through the current shared `ModuleDialog`;
resource cards retain their bounded responsive shell and use the artwork treatment specified in the 2026-10-21 addendum. Keep all focus, suspension,
layering, scrolling, permission and recovery behavior.

Declare `assets/presentation.css` in `module/ui.tsx`, using the existing public
stylesheet contract. Scope it to `.sdk-module--shadowdark`. Both local and
packaged modules receive the same styles without Core changes or a new API floor.
New required status/recovery controls must receive intentional styling too.

Do not revert prepared data, exact owned spell management, native actions,
language grants, source identity, permissions or advancement receipts to restore
an older appearance. Keep corrected responsive inventory rows and accessible
buttons. Fix demonstrated layout clipping with narrow responsive changes.

## Acceptance

- Record a disposition for every changed UI path, including helpers/deletions.
- Render paper/standard sheets, all seven tabs, tools, cards and management
  dialogs at 360/768/1024/1440 in both host appearances.
- Preserve keyboard containment, dismissal, focus return, shared roller and HUD
  clearance in existing accessible shells.
- Verify explicit source typing, scoped/packageable CSS, archived UI loading,
  maintained consumer behavior and unchanged compiled logic/server/hooks.
- Treat fixture assets, legacy accessibility limits and untested rare modal
  states explicitly; don't label snapshots complete native acceptance.
- Keep version, compatibility, migrations and public SDK requirements unchanged.

## Boundaries

This branch repairs presentation and records user visual review as pending.
No operator Foundry access, commit, push or release follows from the branch
authorization. Release-workflow reuse and D&D presentation remain separate.

## Addendum: spell, language, Boon and Effect review — 2026-10-20

The user's screenshots identified SD-UI06–08 after the first presentation pass.
The Gem Bag remains the visual reference: serif headings/actions, compact sans
labels, white square fields, heavy rules and offset shadows. Apply these roles to
field contents, not only the dialog shell. Custom Boon and Add/Edit Effect share
`sd-editor-form` / `sd-form-field`; effect keys retain their deliberate monospace.
Keep native effect definitions, all change rows and lossless updates intact.

Spell management uses consistent Known spells / Available spells labels and
Details/Add/Remove controls. Do not print document UUIDs or Item IDs as routine
row labels or status text. Same-name owned copies use human copy numbers; exact
Item IDs remain the removal/request identity. Saved-operation receipts remain
unchanged internally, including retry identity and confirmed IDs. Initial catalog
loading must not claim the user's choices changed.

### Guided language editing policy

This user-selected policy supersedes unrestricted **SheetDelver sheet editing**
from ADR-0002. It does not rewrite the native-parity finding: native 4.0.6
`system/src/apps/CompendiumItemSelectors/LanguageSelector.mjs` permits ordinary
inventory edits without creation quotas. The allowances themselves come from
`CharacterGeneratorSD._loadLanguages` / `_updateLangData`: explicit Ancestry and
Class fixed/common/rare/select/selectOptions fields. No implicit INT, Common,
Background or name-derived rarity is introduced. Reference commit:
`9677d16b3903b3b640f00d4efd48249142ac8334`.

The sheet now uses these native allowances for guided selections:

- Show Common/Rare selected/allowed headers. Include fixed grants and homogeneous
  restricted pools. For a pool spanning rarities, show selected counts and the
  separate class/ancestry allowance instead of claiming two independent quotas.
- Allocate each exact Language UUID to at most one independent choice slot.
  Restricted class/ancestry pools never become unrestricted rarity choices.
- Existing fixed grants cannot be deselected. Existing extra, custom and unreadable
  languages are retained unless explicitly removed; they create no new slots.
  Effect-granted languages are shown separately and do not consume choices.
- Removal-only edits and underfilled selections remain possible. Missing required
  source data disables the reviewed editor with retry; it never guesses allowances.
- The inventory-mode `languages/plan` resolves owner-authorized Actor and readable
  sources. `languages/manage` rechecks owner, current context, Actor source and
  plan review under the module Actor queue, validates the shared allocation, then
  sends one primary Actor patch. The UI no longer directly patches languages.
- A changed Actor/plan/context retires the draft. Unchanged saves write nothing.
  An unconfirmed save requires a fresh primary-source review; no automatic retry.
  This is one SDK patch with prewrite checks, not a cross-client transaction or
  an assertion that external Foundry edits cannot race the final patch.

This selected behavioral correction means the final logic/server archive is no
longer expected to match the original presentation-only archive byte for byte.
Migration catalog/hooks, release version and compatibility remain unchanged.

### Closeout checks

Source/route cases cover independent grants, exact replacement, retained extras,
fixed removals, stale source/context, owner denial and review order stability.
Mounted checks cover quotas, draft retirement, failures/retry, duplicate spells,
initial loading and original spell-operation identity. Render expanded Boon and
Effect fields as well as loaded language/spell pickers in installed archives;
check typography, control bounds, keyboard containment and mobile scrolling.
Record results in the active audit. Operator approval is still pending; no live
Foundry test or release follows from these isolated checks.

## Addendum: full language catalog, native focus and illustrated cards — 2026-10-21

User review found SD-UI09–11. This addendum supersedes the earlier sheet-editor
restriction on fixed grants and homogeneous restricted pools. Creation and
advancement still validate exact native grants and their independent pools.

- **SD-UI09:** Inventory-mode language browsing always loads the caller-readable,
  source-filtered catalog, including when no discretionary choices are granted.
  `languageEditingPlan` converts classified fixed grants and homogeneous pools
  into Common/Rare totals. An owner may replace a default language within its
  rarity total; defaults are labelled as defaults, not disabled grants. All rows
  remain visible at capacity; additions are disabled until a selection makes room.
  Mixed-rarity pools remain independently allocated rather than doubling their
  count across both headers. Unclassified grants are not assigned guessed rarity.
  Existing extras/custom/unreadable entries remain until explicitly removed and
  do not create new slots. Existing source/context/owner checks and one-patch
  persistence remain. This is user-selected bounded customization, not a claim
  that native's unrestricted inventory editor enforces these totals.
- **SD-UI10:** Native `system/templates/actors/player/spells.hbs` exposes focus
  only for `system.duration.type === "focus"`. Shared `prepareSpellAction`
  additionally retains the Player/owned-Spell boundary. Instant, timed, permanent
  and unspecified durations do not gain focus loss exemption, including crafted
  requests. A stale checked control cannot carry focus into an updated action.
  NPC and Scroll/Wand consequence rules are unchanged.
- **SD-UI11:** Resource artwork is an absolute, full-width background clipped
  inside the card body, faded at top/bottom behind the title and properties.
  The modal top bar owns Close; a separate inset, centered black title panel
  overlays the body. Type is in the property list, not a title subtitle. Failed
  or absent artwork leaves a compact readable card. `CardNotes` lives below the
  body divider and above controls/actions, including read-only/bestiary cards.
  The body and bounded footer scroll independently on short screens; shared
  dialog keyboard, suspension and action orchestration remain intact.

Reference remains native release-4.0.6 at
`9677d16b3903b3b640f00d4efd48249142ac8334`. Isolated-host verification uses Core
0.19.8 at `9ae8442d18445a0472a1be4236c8f6b973e7008b`; this is not a compatibility
floor change. No migration, version, dependency, Core or release changes.
See the active audit for exact final checks and archive identity. User visual
approval remains open; isolated fixtures do not claim fresh native acceptance.

## Addendum: installed native monster artwork — 2026-10-21

The user accepted the background-card treatment and authorized its checkpoint
`f1da5eb53930fe2772c9117aeb6de1ee41ecd388`. The subsequent selected scope is
optional community monster artwork, implemented through the separately approved
Core ADR-0067 SDK capability. Existing card layout, native rules, migrations,
version0.9.6 and compatibility floors remain unchanged.

The module first reads an authorized NPC and exact compendium identity. Only the
two native placeholder portraits are eligible: `cowled_token_red.webp` from the
native4.0.6 NPC default and `cowled_token.webp` retained in its bundled monster
pack. `monsterPortraitRef` accepts a canonical compendium Actor reference or
preserved `_stats.compendiumSource`/legacy source reference on a world NPC. It
never matches names. Custom portraits, PCs and missing/ambiguous origins remain
unchanged. The first installed check caught the older placeholder and a regression
now covers it alongside the current default.

`resolveMonsterArtwork` uses optional `runtime.artwork.resolve`. Core owns native
package discovery, activation, preferences, priority, asset fetching and caller
visibility. Shadowdark never fetches the native module manifest/mapping itself.
It adopts Core SDK3.5.0/module-api1.7.0 structurally and optionally: older supported
hosts preserve the original artwork. No new minimum or hard dependency on the
community package is declared. Unknown/disabled/inaccessible/failed providers
leave the original view usable. No Actor or prototype Token is rewritten.

Bestiary list/cards carry a view-only image and original fallback, and display
provided credit with Data notes below the content divider. `ArtworkImage` retries
the original image once if optional art fails. Native package-preference/context
changes retire pending cards and reload the mounted list, preserving search and
source filters. World/user/role/connection changes retire stale results.

The installed package1.3 supplies mappings for `shadowdark.monsters` and community
content monsters. This adoption does not add the community compendium to the
bestiary's source catalog: existing readable native monsters and world NPCs with
canonical origins are the selected scope. Core can resolve other readable mapped
packs for later module workflows. Runtime use of installed artwork does not grant
redistribution rights. No community assets are copied into Shadowdark archives.
See the [upstream project](https://github.com/PrototypeESBU/foundryvtt-shadowdark-community-tokens)
for provider provenance and its asset-specific licensing information.

SD-UI12 in the presentation audit records source comparisons, isolated installed
checks and limitations. Actual local package installation was observed; its active
native-world state is unconfirmed. The acceptance fixture explicitly enables the
package in a synthetic upstream. Native/operator acceptance and publication are
not implied by those checks.

### Optional Core combat artwork policy

`ShadowdarkAdapter.resolveDisplayArtwork` opts in to Core ADR-0067's generic
read-only display hook. It shares `monsterPortraitRef` with bestiary artwork: only
NPCs with exact canonical Actor origins and either verified cowled placeholder
qualify. The currently displayed image is checked, preserving custom Combatant
and Token images even when the Actor portrait is a default. Combat manager
portraits use portrait art; HUD images sourced from a Token/Combatant request token
art. Actor fallback requests portrait art. Missing capability/provider/origin or
an aborted request returns null, retaining the original. No source is mutated.

The supplied caller runtime is used; the initialization runtime is not used for
artwork authority. Older supported hosts simply omit invocation of the optional
hook. Module version and compatibility declarations remain unchanged. Core owns
caller authorization, image precedence, deadlines and stale-result retirement.
Dashboard cards are not automatically covered by this hook. No Shadowdark package
IDs, default-image paths or rules are added to Core.

The display-artwork policy also consumes optional host-verified
`context.compendiumSourceUuid`. Core encounter copies intentionally lack native
origin stamps; the SDK field supplies their exact recorded source after Core
checks encounter registration and folder agreement. The module does not inspect
Core-private flags or match monster names. Existing copies require no repair or
recreation; custom current images still decline replacement.


### Release compatibility amendment — 2026-10-22

The user explicitly requested raising Shadowdark's requirements as part of Core
SDK closeout. This supersedes the earlier unchanged-floor instruction for the
next module release: Core>=0.20.0, module-api>=1.7.0<2.0.0 and UI>=3.3.0<4.0.0.
Both validation and publication workflows pin v0.20.0. SDK3.5.0 and those API
versions were already assigned to the unreleased Core package/artwork/reference
contracts; no additional SDK increment is required. Roll-engine-api is unchanged.
Core must publish before module CI/release. Module version0.9.6 remains until its
release helper runs. No new native testing is implied, and this Core closeout does
not close unrelated module functional review. Optional native-art fallback and
original-source reference authorization remain unchanged.

Compatibility closeout verification: presentation assertions pass, migration hooks19/19,
release-tool regressions49/49, parsed workflow pin agreement and real Core
compatibility acceptance/rejection checks pass. No hosted CI or new-floor install
was claimed before Core publication.


## 2026-10-22 amendment: tool canvas backgrounds (SD-UI13)

The user reported white tool-page surroundings where sheets correctly showed the
Core theme canvas. Generator (including its failure state), importer and bestiary
now leave their outer canvas transparent. Existing white paper panels remain;
bestiary cards/inputs explicitly retain black text while outside labels and status
text inherit the host foreground. Generator errors stay in a readable white panel.

Core owns the world-image/color precedence (Core ADR0070), including loading and
missing-tool states. Shadowdark does not set a custom page color. Its transparent
tools therefore use world artwork when present, otherwise the current Core theme.
A module can opt into the documented scoped CSS fallback color without importing
Core state. Core0.20.0 alone restores theme-colored surroundings with this module
patch; the new Core repair is needed for tool world artwork. No module version or
compatibility change is made here. Release and full operator review remain open.

Verification: presentation regression failed before the opaque importer root was
removed and passes afterward. Seven real-component browser checks pass at390px
and1280px with compiled module CSS and Core preflight, including the generator's
failed-collection panel. Core's separate browser test covers world-image/color
precedence and lifecycle. See the owning audit for commands and limits.

SD-UI13 universal-host clarification: Core ADR0070 now centralizes the canvas in
the player layout/shared CSS, including dashboard, combat and future routes. SDK
SurfaceHost applies it to both actorPage and tools. The optional module color is
a documented SDK-host CSS contract; no per-module hook or settings UI is needed.
This supersedes the intermediate tool-only background wrapper.

SD-UI13 acceptance — 2026-10-22: the user verified the final shared background
behavior, including the universal Core/SDK host correction, and authorized this
local checkpoint. SD-UI13 is accepted. Remaining ADR0003 review is not implicitly
closed; publication, pushes and merges remain user-owned.


## Review corrections: language counts, spell choices and rich text — 2026-10-22

SD-UI14–17 are the next operator-selected correction pass. ADR0003 remains open;
Custom Boon and Add/Edit Effect styling have now been accepted by the user.

- Language headers show selected/currently-available totals even when a class
  choice spans Common and Rare. The existing allocation matcher reserves choices
  in the other category before computing capacity; one shared choice never grants
  two slots. Help describes the shared allowance. Retained extras, exact pools,
  source checks and removal-only editing remain unchanged.
- First-level Priest preparation includes the exact upcoming Turn Undead talent
  when marking its automatic spell. It cannot fill an ordinary starting choice.
  Creation preparation writes no Actor/Items and returns invalid choices to the
  editable form. Existing-Actor preflight errors explicitly carry
  `advancementWrites: "none"` only after absence of the original saved request is
  established and before write orchestration begins. Unknown/partial outcomes
  retain their original receipts and recovery; an HTTP error alone proves nothing.
- Known spells remain visible and gray in available lists. Exact canonical owned
  origins are checked across spell lists and regardless of whether the spell was
  learned normally or through a talent/boon. Ordinary and extra advancement choices
  use the same exclusion. Save/finalize handlers recheck before writes. Existing
  duplicate or custom copies remain; no name-based matching or automatic deletion.
- All description consumers use `logic/description.ts`, including the legacy
  `formatDescription` alias. Foundry inline rolls accept their optional `{Label}`.
  Actor-dependent formulas consume the caller-visible prepared `rollData` shared
  with actions. `logic/formula.ts` handles bounded deterministic parenthetical die
  counts, including native Cure Wounds, without rolling during rendering. Missing
  context retains the authored label without an executable roll; catalog facts
  say “Varies by character”. Reference views remain informational.

### Rich-text ownership decision

Core `src/shared/sdk/utils.ts::processHtmlContent` sanitizes already-enriched HTML;
it is not a Foundry template interpreter. Foundry generic inline-roll/link syntax
is potentially reusable in a future SDK enricher, while Shadowdark owns actor
roll data and `[[check DC stat]]`. This pass corrects the module's existing shared
renderer rather than changing the Core contract or duplicating a card-only parser.
Every consumer benefits from labels; actor-bound consumers additionally supply
prepared roll data. Editors retain source markup for editing and persistence.
Arbitrary Handlebars/JavaScript, eager dice evaluation, other systems' custom
commands, embeds and full Foundry TextEditor parity are not implemented or claimed.
Any future cross-system SDK extraction must separate syntax, caller context,
system-specific enrichers and action dispatch, keeping Core sanitization last.

Provenance and verification are in SD-UI14–17 of the active presentation audit.
Module version, compatibility, migrations and Core code are unchanged. No live
Foundry writes, release or commit is implied by offline checks.


### SD-UI16b/16c: actual ownership and automatic grant fulfillment

SD-UI16b separated fixed-grant entitlement from actual ownership but proposed a
manual Add/Save repair. The user rejected that policy: a granted spell must be
added automatically, appear in Known spells, and remain unavailable for a second
selection. SD-UI16c supersedes that intermediate implementation.

Creation and advancement now include missing fixed native Spell Items in their
original plans. Existing owner sheets automatically apply missing fixed grants
through a dedicated POST and refresh actual inventory. Read-only views only
report availability; observers never apply grants. Exact native mapping and
caller-readable source documents establish entitlement, independent of ordinary
quotas or browsing filters. No class-name/description inference or invented choice
is allowed. Talent/boon choice grants retain their existing selection workflow.

The automatic route shares the Actor queue, respects outstanding advancement,
rechecks source/context/ownership, and persists Actor/source receipts across
callers and reloads. Ambiguous writes cannot be repeated. Failed automatic grants
remain visible with retry; they neither block world startup nor masquerade as
owned/castable spells. The picker disables granted entries during completion and
shows real saved grants in Known spells afterward. This is the selected grant
lifecycle correction, not general migration/repair authority.

Verification and limitations are in the audit's SD-UI16c. Operator review remains
open; no live Foundry data changes or release operations were used for testing.


### SD-UI16d: complete native spell-grant handling

The user expanded SD-UI16c beyond fixed Turn Undead: audit native spell-granting
talents/boons, including grants to non-spellcasters. Five exact native choice
templates now share list/tier eligibility between UI and final validation.
Independent repeated/mixed grants require distinct eligible choices. Saved Spell
Items retain grant provenance, are excluded from ordinary quotas, and supply the
native casting Class through shared preparation. Shune retains INT even when
another active Class has a higher modifier. Ordinary progression, item-only
casting and source effects remain distinct.

The approved SheetDelver interpretation for Shune is
`max(1, floor(acquisitionLevel / 2))`; the published entry's rounding/minimum are
not explicit. [The module rules document](../rules/spell-grants.md) records that
interpretation, native source references, complete grant handling and limits.
Historical unknown choices are preserved, never fabricated. SD-UI16c fixed-grant
receipts remain unchanged. Offline verification is recorded in the active audit;
ADR closeout and operator acceptance remain pending.

### SD-UI18: complete talent choices across creation and advancement

The user reported Wizard creation failing on unresolved Spellcasting Advantage
and expanded review to +1/+2 stat grants. Required spell effect targets now have
a picker and authoritative final validation, alongside weapon and armor targets.
Only actual owned/planned spells qualify; the advantage talent itself grants no
Spell. Fixed Magic Missile Advantage retains its resolved target.

Native table restrictions survive processing: Warlock requires two distinct
stats, unrestricted distributions permit either two stats or two points in one,
and named native bonuses retain their original effects. Each distribution has
its own allocation; repeated rolled grants are preserved. Native distribution
RollTables are recognized by document identity and converted into Talent effects.
Invalid choices return validation errors before writes and remain correctable.

[SheetDelver talent handling](../rules/talent-choices.md) documents these decisions.
The active audit records source inventory, final-writer and mounted UI coverage.
Operator review remains open; no existing Actor repair or Core change is implied.

### SD-UI19: validate roll references against completed data

Native Destined stores its situational roll effects before the effect supplying
`bonus.destineddie`. The module reported missing references during the earlier
application step, even though action preparation could resolve them afterward.
Known roll-selector reference diagnostics now run after Actor preparation, using
the completed roll data. Phase/priority application and source data are unchanged;
missing suppliers still produce visible diagnostics. This applies to supported
roll selectors generally, without a Destined-specific default or suppression.
The audit records native-order regressions and pending user verification.

### SD-UI20: legacy scroll visibility and retained spent Items

The user reported Burning Hands/Hold Portal scrolls present in inventory but absent
from Spells from items, and explicitly requested single-use scrolls marked spent
instead of deleted. Native4.0.6 stores these two sources as Basic Items with exact
Spell UUIDs in their descriptions. Shared source-aware handling exposes them
alongside modern Scrolls without changing stored types or matching names.

The action route now records a spent flag before the roll attempt through its
existing prerequisite/receipt machinery. All outcomes retain the Item; new casts
are refused. Inventory, spell list and cards show the same state with manual
discard available. This supersedes earlier native-deletion policy for SheetDelver
scroll actions only. [Scroll handling](../rules/scrolls.md) records exact sources,
failure semantics and the native-UI boundary. Operator verification remains open.

SD-UI20 follow-up: the user still saw no item spells. Gear Add was dropping all
source metadata, which the initial fixtures preserved. The Add callback now uses
the shared owned-copy helper. Existing source-less Basic magic Items qualify only
when their complete native name, artwork and linked description match one of the
two legacy scrolls; conflicting origins or partial matches do not qualify. This
adds read-only capability recognition without repairing stored inventory. The
audit distinguishes this correction from the unsuccessful first user retest.

### SD-UI21: scroll/wand critical failures and mishaps

The user verified core rules p49 and retained spellcaster/list restrictions,
then identified the missing mishap roll and clarified wand failure/rest/breakage.
Scroll visibility remains independent of casting permission. A natural critical
failure now schedules the applicable supported mishap after inventory writes,
through the shared spell action path and caller-bound Core dice/chat services.
The original request receipt owns this follow-up; retries never repeat the cast
or an uncertain mishap. A wand critical failure breaks it even if numeric bonuses
lift the total above its DC. Rest-cleared lost entries do not repair broken wands.

Exact native Wizard tables and Magical Dabbler's explicit Wizard rule are supported.
Witch/alternate Witch casting calls for Diabolical tables, which are absent from
the pinned packs; report manual resolution rather than use a different table.
Priest/Seer penance is distinct. Additional rolls/effects instructed by table text
remain manual, and custom class policies are not guessed. Rules and boundaries
are recorded in `docs/rules/scrolls.md`; the active audit tracks offline evidence
separately from outstanding user acceptance.

### SD-UI22: native legacy wand cards

The user's Blind/Deafen screenshot exposed a gap in SD-UI21: native legacy wands
are stored as Weapon/Basic, while the earlier wand fixtures used modern Wand.
Shared capability recognition now covers all three native legacy templates,
including complete-signature historical copies whose Gear Add lost origins.
Cards and spell actions exclude fabricated melee/damage behavior and preserve
casting-class restrictions. Failure/breakage persist in module flags for legacy
types; modern fields remain unchanged. Restore after rest clears lost spells on
unbroken wands without repairing breakage. No source migration or automatic curse
application is introduced. The active audit records verification; user review
remains open, and this correction does not close the ADR.
