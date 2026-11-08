# Shadowdark 1.0 readiness review

Date: 2026-10-27
Status: Updated November4 — naming, card sharing and Boon effects implemented and user accepted

## Baseline and conclusion

Reviewed SheetDelver Shadowdark 0.9.6 at `ea0fa11` on
`fix/restore-module-presentation`, against the locally available native
Shadowdark `release-4.0.6`, commit
`9677d16b3903b3b640f00d4efd48249142ac8334`. The installed local Foundry v14
system is also 4.0.6. This is an exact local baseline, not a claim about the
latest upstream version. Core checkout is 0.22.2.

The selected Creator, rest and sheet refinements are accepted. The review found
no new demonstrated correctness blocker in that scope. The module is a credible
1.0 candidate as a player companion, with explicit boundaries around Foundry
scene and combat automation. Source inspection is not exhaustive runtime parity
or a fresh native v13/v14 acceptance run.

Latest checkpoint includes MAX XP at level 10, manual Renown, and shared class
ability use/loss controls. [ADR-0007](../adr/0007-renown-and-ability-card-controls.md)
is completed. Existing Creator/rest acceptance remains recorded in the
[workflow audit](2026-10-23-character-creator-workflow.md).

## Player workflow comparison

| Area | Current module outcome | Remaining boundary |
| --- | --- | --- |
| Identity and sheets | Both views, titles, background/deity, languages, boons, rich-text notes and effects | Native document authoring remains broader |
| Creation and progression | Generator, Shadowdarklings importer, Creator and advancement; levels 0–10, native grants and tier table | Custom unsupported effects remain outside the accepted scope |
| HP and recovery | Current HP editing, ration choice, successful-rest recovery and explicit exclusions | Shared base editor implemented and user accepted (ADR-0008) |
| Ability scores and checks | Prepared scores/modifiers, checks and attack modes | Shared base editor implemented and user accepted (ADR-0008) |
| Spells and class abilities | Cast/use, limited uses, loss/restoration, modern/legacy consumable handling | Full native damage/target/chat automation remains deferred |
| Inventory and money | Equipment, stashing, quantities, slots, coins, treasure/gems, crawling-kit contents | Some native item-authoring conveniences are absent |
| Optional controls | Pulp luck, manual Renown, maximum-level XP display | Renown is manual; no automatic social-event awards or conditional roll bonuses |
| Lights | Toggle, remaining-time display and chat message | Native tracker, scene-light and expiry automation remain Foundry-owned |
| Reference tools | Monster Stats, source filters and independent declared compendiums | Arbitrary undeclared-pack discovery remains deferred |

## Identified improvements and decisions

**R10-01: Selected and implemented October 27 in [ADR-0008](../adr/0008-character-base-editor.md), with name editing added; user verified the modal and approved closeout on October 27.** Original finding: edit base ability scores and maximum HP. This is the most useful small
addition before 1.0, but not an existing-flow defect. Native
`system/templates/actors/player/abilities/stats.hbs` and `hp.hbs`, together with
`PlayerSheetSD._onToggleEditStats/_onToggleEditHp`, expose owner edit modes.
Our `AbilitiesTab.tsx` and `ShadowdarkPaperSheet.tsx` display/roll scores and edit
current HP, without the equivalent base-score/max-HP edit mode. A shared explicit
edit action would support corrections and permanent changes. It must distinguish
saved base values from effect-adjusted totals and preserve existing effects;
reuse the public update path and existing controls. That earlier limitation is resolved by the accepted shared editor.

**R10-02: Completed November4; user verified and accepted.** Share an owned item card to chat. Native
`PlayerSheetSD._onItemChatClick` calls `shadowdark.chat.showItemCard` using the
exact item UUID. The original review found no general share action in our shared
detail cards. This convenience is now implemented through existing SDK chat
presentation without a Core change.

The selected public Share to chat action and optional naming control are now
implemented using existing SDK services; no Core change was needed. Current
scope and verification are in [ADR-0010](../adr/0010-item-naming-and-chat-sharing.md).
The November3 decisions below record the selection that preceded implementation.

November4 Boon follow-up: item Attributes/Personality removed; explicit native
effect authoring added using shared custom-boon controls. See
[ADR-0011](../adr/0011-boon-effect-authoring.md). Targeted source, typing and
phone/desktop browser checks pass. The user confirmed the current work works as
expected on November4 and authorized its checkpoint commit. ADR-0010 and ADR-0011
are completed; user acceptance is distinct from automated evidence.

### Optional follow-up decisions — 2026-11-03

- Naming aids: investigate a small optional action beside the existing name
  field. User requires no interruption or extra mandatory creation steps.
  Proposed behavior is a suggested name with explicit application; retain manual
  names and ordinary category-generated names unless the user applies a suggestion.
- Potion mixing: exploratory only. Recommend a collapsed optional section or
  separate action within the Potions tab, independent of normal potion creation.
  Rules/source availability and resulting item/quantity handling need a focused
  audit before selecting implementation. Do not imply complete mixing automation.
- Hidden-identity authoring: declined by the user, replacing its deferred status.
  Do not add it to the release queue. This decision does not remove existing
  native identification behavior or current disclosure restrictions.
- Cards to chat: user accepted an action on the existing item card. Reuse shared
  SDK chat presentation and the existing card action area; sharing must not cast,
  spend resources or apply effects. Existing light-chat code demonstrates a public
  runtime chat-card path; content and permissions still need implementation review.
- Table/PDF import: remains deferred. Uniform Shadowdark layouts are a useful
  extraction target; verify public RollTable/compendium write capabilities before
  selecting work. Any missing Core contract is a separate dependency, not authority
  to bypass the SDK or change Core as part of this module follow-up.

**R10-03: Superseded as a standalone proposal by the broader rules-based GM generator audit and [ADR-0009](../adr/0009-gm-treasure-and-item-generator.md).** Original finding: create a scroll, wand or potion from a spell. Native
`PlayerSheetSD._createItemFromSpellDialog/_createItemFromSpell` uses
`shadowdark.utils.createItemFromSpell`. Our source pickers and owned consumable
flows do not offer that conversion utility. This is an optional item-authoring
feature, not evidence that existing consumables fail.

## Existing deferrals remain deferred

The F01–F06 ledger in the
[native parity audit](2026-10-18-spellcasting-and-native-parity.md) remains the
scope authority. This review does not select those features:

- F01: automatic damage/healing rolls beyond prepared formulas and primary checks.
- F02: ammunition spending/empty-supply enforcement. Current action guidance
  explicitly tells the player to adjust ammunition manually.
- F03: native timed light/effect and scene automation. Timer display and torch
  chat have since shipped in this branch; the older ledger's missing-chat/display
  wording is superseded by that delivered work, not by full tracker parity.
- F04: targeting, momentum and native interactive damage/reroll chat behavior.
- F05: complete situational-effect selection UI.
- F06: broader arbitrary pack discovery; current declared source filtering and
  optional community monster packs are already supported.

Draft restoration/additional exit protection was declined. Dashboard redesign
and other systems' work stay outside this review. Do not infer a new obligation
from an older pending paragraph or turn these deferrals into release blockers.

## Before publishing 1.0

1. Select the supported Core baseline and align documentation, manifest and CI.
   Today README says 0.22.0+, manifest says >=0.20.0 with UI API >=3.6, and CI
   validates v0.22.0. Recommend 0.22.2, which includes the verified compendium
   freshness correction. No requirements or workflow pins were changed here.
2. Add concise user-facing limitations to README: manual ammunition and the
   boundaries of damage/scene automation. Keep ADR/development history out of it.
3. R10-01 and R10-02 are completed and user accepted;
   the broader GM work replacing R10-03 is implemented and accepted for the October31 checkpoint in ADR-0009.
4. Run required CI and a focused installed-archive smoke check on the final
   release candidate. Reuse accepted workflow evidence; do not add exhaustive
   variable-by-variable tests merely because the major version changes.
5. Consolidate changelog highlights, then use the release helper under separate
   release authorization. No version bump, tag, push or publication occurred.

## Verification and limits

The implementation checkpoint already passed explicit module typing, four MAX-XP
mounted cases, six responsive Renown workflows and two owned-ability-card
workflows. Screenshots were inspected. These checks support those changes, not
all native features. User acceptance is recorded separately in ADR-0007.

Isolated packaging passed against Core 0.22.2, including module contract/boundary
checks, root TypeScript, scoped Tailwind compilation, logic/UI/server builds and
migration bundling. Archive: `shadowdark-0.9.6.tgz`, 354.3 KB; SHA-256
`5fb30a220fb97d9b55ae79d141b2bd9cab2e585cc0ec90c8f95338f5489bfc36`.
The archive uses the implementation checkpoint; this audit was written afterward.
This is build evidence, not an installed-archive browser acceptance run.

The first isolated harness lacked dependency resolution; a symlink then correctly
failed migration confinement. Copying the checkout and exposing the existing
Core dependencies resolved both harness issues without source changes. No production actors, settings,
caches or native packs were changed. No application or Foundry service was started.


## Tool catalog navigation regression — October 27

User reported loading resources on every Monster Stats/Treasure visit. Both tools
owned mount-local fetches outside the existing collection store; Treasure repeated
its full catalog fetch on each category remount. Sheet providers also discarded
their own store on unmount. Corrected by sharing the existing caller-scoped store
for the SDK browser-session lifetime and routing both tool projections through it.
Cached successes survive navigation; source/lifecycle invalidation remains active
while pages are closed. No polling, persistent browser storage or Core edit.

Focused source lifecycle checks pass, including caller/reconnect/package changes,
off-page Actor invalidation and no reload for routine Setting events. Mounted
Monster Stats checks confirm one list request across reopen, then one replacement
after off-page invalidation. Treasure at390/1000px makes two catalog requests across
the whole multi-tab/reopen workflow: one initial and one explicit context refresh.
Receipts and final write validation remain uncached. This is isolated SDK/browser
evidence; operator acceptance remains separate.


Verification also passed the existing28-case provider subset (open/pending shards,
caller/world/role changes, disconnect/reconnect, failures and retry), explicit
typing, contract validation and isolated packaging. The packaged UI and styles
passed the Treasure navigation/request-count workflow at390/1000px. Monster Stats
phone rendering preserves established styling with an explicit Refresh sources
control. Archive SHA256:
`cb38f19615e1adecaaac1f44c563feafc3f89e7f27b9b3943ffc621b471a5246`.
No release metadata, SDK minimum or Core changes; no live world was modified.


### Host-boundary correction

The operator still observed index/bestiary requests on every real navigation.
Earlier fixtures retained the SDK event bus and therefore did not prove behavior
across Core's SurfaceHost unmount. Core ADR-0076 corrects the per-page SDK bus owner
in the persistent authenticated workspace, preserving caller/role/world/session
separation. Actual Shadowdark catalog hooks composed with actual Core providers now
show zero additional catalog requests on return and refresh after an off-page
invalidation. The module-side cache implementation remains; its earlier fixtures
alone were not operator acceptance. The user subsequently confirmed persistent
cache across navigation on 2026-10-27, closing this acceptance item. Core ADR-0076
is Completed; the user subsequently reported the supporting Core release complete.

## Mundane Items increment — October 28

The selected Mundane Items recipe is implemented for operator review: luxury,
gemstone and jewelry paths, original editable generation tables, optional unique
features, value totals and the existing library save/assignment flow. The
[GM audit](2026-10-27-gm-treasure-generation.md) and
[ADR-0009](../adr/0009-gm-treasure-and-item-generator.md) contain the current
scope, source/pricing decisions and evidence. Focused source regressions, explicit
typing, contract validation, packaging and compiled UI workflows at 390/1000px
passed. Operator acceptance of the content/prices and native flow remains open.
Other category recipes and optional user-table importing remain outside this
increment; this does not close ADR-0009 or authorize release preparation.

October28 follow-up: the user accepted the Mundane/card preview checkpoint,
committed as `2a4e0a0`, and selected continuation. The Boons tab is implemented for
review with native Oath/Secret/Blessing items, original/manual parts, card preview
and shared save/assign behavior. The GM audit and ADR-0009 retain its evidence and
manual-effect boundaries. Other category recipes and release preparation remain
separate; this does not reopen accepted player-sheet work.

The user accepted Boons; checkpoint `9e2f094` records it. The October29 correction
replaces the Magic Items prototype with shared, independently optional Attributes
and Personality sections inside the builders. Type-specific benefit/curse tables
and shared personality alternatives support roll/select/manual entry. ADR-0009
and the GM audit own the current scope and evidence. Naming/type aids are deferred.
Operator review is open. Dedicated category procedures and release preparation
remain separate; this does not reopen accepted player-sheet work.

October29 Armor follow-up: the user selected per-category procedures after the
shared additive correction. Armor now has existing-item reset/clear and a native
base/bonus/feature build flow with icon and AC preview. It awaits operator review.
Weapons, Potions, Scrolls/Wands and Utility retain distinct remaining procedures
in ADR-0009; generic/shared controls do not mark these complete. No release or
compatibility change is selected.

Armor is now user accepted, including the image/whole-form Clear correction.
Potions is implemented for review with its own three-feature procedure, native
Potion output, optional shared properties and existing-item handling. Its scope
and evidence are in ADR-0009 and the GM audit. Potion mixing and remaining
category procedures are still separate; no release is selected.


October29 continuation: user selected completion of the remaining GM treasure
categories before combined review. Scrolls/Wands, Utility and Weapons now have
separate procedures; optional supported permanent equipment modifiers are included.
ADR-0009 and the GM audit own scope, verification and manual boundaries. Potions
and these new increments await operator acceptance. Two legacy spell-loss boundary
assertions fail identically on committed baseline9e2f094 (55/57); this validation
limitation is recorded separately from passing treasure, typing, conformance and
browser checks. No release/version/compatibility change or new Core work.


## Current assessment — October 31 checkpoint

The user accepted checkpointing the completed treasure-category implementation and
latest UI refinements. Random Treasure, Mundane Items, Boons, Armor, Potions,
Scrolls/Wands, Utility and Weapons have their selected flows. Shared Attributes
and Personality replace duplicate tabs; scrolls omit Personality. Supported
permanent equipment modifiers and shared item-card effect details are included.
The embedded editor border and simplified save review are accepted. ADR-0009 is
Implemented; no further selected builder implementation is outstanding.

Relevant source regressions, explicit typing, contract/package and compiled
390/1000px UI checks pass. The GM audit records exact evidence and distinguishes
these checks from native acceptance. Current Core checkout is0.22.3; manifest,
README and CI still have the different historical minimums described above.
No minimum or release version was changed for this checkpoint.

Before release:
1. Resolve the two existing boundary-test failures (C4 and RV-03) around spellLoss
   bookkeeping. They reproduce on baseline9e2f094; they are not introduced by this
   work, but the required CI suite cannot be considered green with them unresolved.
2. Select the release scope/version and supported Core baseline, then align the
   manifest, README and CI pins under release preparation authority.
3. Run required CI and a focused final installed-archive smoke for native
   save/assign/reset and equipment effects. Checkpoint approval is not evidence
   of every native case. Preserve accepted player-workflow evidence.
4. Finalize concise feature/limitation notes and use the release helper only after
   separate authorization. No release bump, tag, push or publication is selected.

Optional table/PDF import, naming aids, potion mixing, hidden-identity authoring,
cards-to-chat and prior native-automation deferrals remain outside this checkpoint.


## Compatibility alignment and failure diagnosis — October31 follow-up

User authorized compatibility alignment in Shadowdark. Manifest minimum
>=0.20.0 → >=0.22.3; README and CI/release pins0.22.0 →0.22.3, including the CI
artifact fingerprint. Core's local v0.22.3 tag/release checkout is present and
matches the user's prior release report. SDK3.8.0 and module-api1.7.0/UI3.6.0/roll
API1.0.0 contract minima are unchanged. Module release version stays0.9.6.
This completes baseline alignment; it does not authorize version bump/publication.

Both recorded boundary failures assert the entire old spell patch equals only
`system.lost: true`. Current consequences additionally write spellLoss reason and
casting Class for the rest utility. C4 covers failed spell loss versus focus;
RV-03 covers a chat transport failure and replay without repeated consequences.
The extra provenance field triggers both exact-object assertions. Existing REST
regressions explicitly require the provenance for rest/penance/unknown handling.
This evidence points to stale assertions, not a demonstrated runtime regression.
Those assertions have not been changed in this compatibility-only follow-up;
the user asked for the explanation first. Final CI/smoke remains after resolution.


Alignment verification: isolated module check passes (contract compatibility,
source boundaries, root typing, scoped CSS and logic/UI/server dry bundles), log
/tmp/sd-core-baseline-check.log. The existing presentation suite passes updated
version/pin/API assertions, then fails its settings-list equality because it omits
the previously tracked playerShowLightRemaining entry. This is an additional stale
expectation to reconcile during test cleanup; later assertions have not yet run.
Log /tmp/sd-core-baseline-presentation.log. No runtime settings changed here.
No Core modifications, module version bump or new commit accompanies alignment.


## Validation cleanup resolved — October31

The user authorized proceeding after the diagnosis. Only tests/harness and
compatibility documentation changed; application behavior is unchanged.

- Boundary expectations now explicitly require both lost=true and recovery
  provenance (reason=rest and the exact casting Class). Focus exemption and
  chat-failure replay assertions remain. Boundary suite passes57/57.
- Presentation expectations include the existing torch-time world setting and
  GM-only Treasure tool. Compatibility assertions target Core0.22.3.
- Native-alignment checks reflect the accepted shared Edit modal and spinner-free
  Pulp −/+ controls in both views. Suite passes64/64.
- The action consumer's focus fixture now explicitly declares focus duration;
  paired instant-duration cases verify its absence. Suite passes8/8.
- The collection harness loads module Tailwind utilities as installed modules do;
  host CSS cannot discover ignored module source. This resolves the artificial
  luck-control overlap. CI invokes this harness with the existing tsx toolchain.
  Suite passes104/104; the rendered tabbed luck controls were inspected.
- Packaged Creator and migration checks use the aligned Core minimum.

All23 source suites listed in module CI pass locally, along with49 release-tool
checks, explicit module/UI typing, module contract/boundary checks and packaging.
Browser actor lifecycle, corrective consumers and Creator workflows also pass;
compiled Treasure UI/CSS passes390/1000px. Compiled Creator contracts verify exact
creation round trips, recovery and source-revocation preflight. Earlier failing
logs remain historical and are superseded by these reruns.

Evidence: /tmp/sd-final-boundaries.log, /tmp/sd-final-presentation.log,
/tmp/sd-final-source/*.log, /tmp/sd-final-release-tests.log,
/tmp/sd-final-types.log, /tmp/sd-final-package.log,
/tmp/sd-final-actions-rerun/results.json,
/tmp/sd-final-collections-rerun/results.json,
/tmp/sd-final-browser/{actor-lifecycle,parity-corrections,character-creator}/results.json,
/tmp/sd-final-treasure-browser/results.json, /tmp/sd-final-creator-compiled.log.
Archive SHA256: cfd9a47dbcf19ce228cc3ec4f88ef8e8e1326d10dd7e06089bd31d27a8b19bdd.
Archive runtime/manifest are current; final test/documentation-only cleanup came
after packaging. Local toolchain is Core0.22.3/Node24.21.0; hosted CI pins Node22.
No GitHub workflow was dispatched and no live Foundry service was used.

The two original boundary failures and additional stale assertions/harness defects
are resolved. Compatibility alignment is complete. Remaining release gates are
final live installed-Foundry smoke, hosted CI on the proposed commit, release
version selection and separately authorized publication. No new commit, push,
version bump or tag is included in this cleanup. All browser processes exited.


## Installed native smoke — October31

The user launched local Foundry14.367 world `shadowdark-test` (Shadowdark4.0.6).
A separate Core0.22.3 workspace/data directory installed the packaged module;
root production configuration was not used. Through the installed public module
routes, the authenticated GM loaded the native catalog, prepared/saved/assigned
a disposable item with price12gp and AC+2, and replayed the same request. Native
source readback confirmed exact inventory identity, price and ActiveEffect.
Installed sheet preparation showed AC12; a native stash update changed it toAC10
and reported suppressed(stashed). Replay made no duplicate.

All disposable Actor/Item/Folder data was removed. Whole-source comparisons
(excluding transport _stats) confirm original Actor/Item/Folder data unchanged.
No existing character, item or setting was edited. The isolated Core process
was stopped; the user's Foundry instance remains running. Evidence:
/tmp/sd-release-native-smoke/results.json and smoke.log. Archive SHA256:
6908816efb487c20a6289ed1c9ef526ba935c2a39a1a76668fecef2bd1fb5a80.
This proves the focused installed API/native persistence smoke; UI rendering was
covered by the earlier packaged browser suite, not a new live browser session.

Hosted CI remains pending. Workflow inspection shows feature-branch pushes do
not trigger validation: it runs for main pushes, PRs to main, tags or explicit
workflow_dispatch. No PR currently exists for this branch. No remote write or
workflow dispatch has been performed during this check. Version0.9.6 remains.


## Accepted follow-up checkpoint — November 4

- [x] Optional native-table name suggestions with explicit apply/dismiss.
- [x] Owned-item Share to chat through the public SDK.
- [x] Remove item Attributes and Personality from Boons.
- [x] Shared explicit Boon effect controls, validation, preview and persistence.
- [x] User confirmed the current implementation works as expected.

Targeted treasure source checks and38/38 action-phase checks pass. Mounted treasure
flows pass at390/1000px; the expanded card/custom-boon suite passes14/14. Explicit
module/UI/migration typing and isolated module check/package pass. Naming also
passed extracted-archive UI/CSS checks before the Boon extension. These are
automated isolated results, separate from the user's acceptance; no new native
write or full native acceptance run is claimed.

PR16's hosted Validate Module run41262306466 passed on prior commit82e7a25. This
supersedes the October31 pending-CI/no-PR note above, but does not establish hosted
CI for this new checkpoint. The user handles pushing and PR/release operations.
Module0.9.6 and compatibility requirements remain unchanged. Imports and potion
mixing stay deferred; hidden-identity authoring remains declined.


## Release CI correction — November 8

PR16 validation at bda154c passed source regressions but failed two styled card
checks: the workflow invoked action-consumers.browser.mjs with plain Node, which
could not resolve the Tailwind compiler's extensionless TypeScript dependency.
The local check had used tsx. CI now uses the existing tsx toolchain for this
harness, consistent with collection, Creator and treasure browser tests. The
corrected local invocation passes14/14; no runtime code or assertion changed.
Hosted validation must pass on the corrected commit before merging/releasing.
