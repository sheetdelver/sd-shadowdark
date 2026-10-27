# Shadowdark 1.0 readiness review

Date: 2026-10-27
Status: Comparison complete; release preparation not yet selected

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
| HP and recovery | Current HP editing, ration choice, successful-rest recovery and explicit exclusions | Direct permanent maximum-HP correction is absent |
| Ability scores and checks | Prepared scores/modifiers, checks and attack modes | Direct base-score correction after creation is absent |
| Spells and class abilities | Cast/use, limited uses, loss/restoration, modern/legacy consumable handling | Full native damage/target/chat automation remains deferred |
| Inventory and money | Equipment, stashing, quantities, slots, coins, treasure/gems, crawling-kit contents | Some native item-authoring conveniences are absent |
| Optional controls | Pulp luck, manual Renown, maximum-level XP display | Renown is manual; no automatic social-event awards or conditional roll bonuses |
| Lights | Toggle, remaining-time display and chat message | Native tracker, scene-light and expiry automation remain Foundry-owned |
| Reference tools | Monster Stats, source filters and independent declared compendiums | Arbitrary undeclared-pack discovery remains deferred |

## Newly identified improvements — not selected for implementation

**R10-01: Selected and implemented October 27 in [ADR-0008](../adr/0008-character-base-editor.md), with name editing added; user verified the modal and approved closeout on October 27.** Original finding: edit base ability scores and maximum HP. This is the most useful small
addition before 1.0, but not an existing-flow defect. Native
`system/templates/actors/player/abilities/stats.hbs` and `hp.hbs`, together with
`PlayerSheetSD._onToggleEditStats/_onToggleEditHp`, expose owner edit modes.
Our `AbilitiesTab.tsx` and `ShadowdarkPaperSheet.tsx` display/roll scores and edit
current HP, without the equivalent base-score/max-HP edit mode. A shared explicit
edit action would support corrections and permanent changes. It must distinguish
saved base values from effect-adjusted totals and preserve existing effects;
reuse the public update path and existing controls. Until selected, make these
changes in Foundry.

**R10-02: Deferred for further user discussion.** Share an owned item card to chat. Native
`PlayerSheetSD._onItemChatClick` calls `shadowdark.chat.showItemCard` using the
exact item UUID. Our shared detail cards do not expose a general share action.
This is a convenience feature; existing SDK chat presentation should be checked
before proposing any Core change.

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
3. R10-01 is completed and user accepted. R10-02 remains deferred for discussion;
   the broader GM proposal replacing R10-03 remains proposed in ADR-0009.
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
