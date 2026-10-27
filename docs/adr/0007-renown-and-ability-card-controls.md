# ADR-0007: Renown and class-ability card controls

Status: Completed — user accepted controls and approved checkpoint
Date: 2026-10-27

## Scope and native evidence

The user selected manual Renown controls in both sheets and class-ability use
and lost-state controls on the shared resource cards. The supplied Cursed Scroll 6
p. 18 explains Renown: it begins at CHA modifier, changes with level/social
outcomes, and supplies conditional carousing/reaction bonuses. The page gives
no numeric floor or ceiling. The user separately requested a control minimum
equal to the lowest starting CHA modifier (−4) and no gameplay maximum.

Native Shadowdark 4.0.6 PlayerSD defines `system.renown` as an integer defaulting
to zero; its Details template is an unconditional manual field. Native modifier
calculation bottoms at −4. ClassAbilitySD supplies `limitedUses`,
`uses.available`, `uses.max`, `lost` and `loseOnFailure`. The native ability list
allows manual loss toggling, and SheetDelver already exposes use/loss controls
on its Abilities tab. This change does not invent new ability resources.

## Decision

- Reuse Pulp Luck's bordered, square −/input/+ presentation for Renown, without
  spinners. Allow signed integer input down to −4 and no gameplay upper cap.
  Reject invalid edits; preserve existing values on render. This is a user-selected
  input bound, not a claim that the book limits how far Renown can fall.
- Place Renown below Luck and beside a one-column Level/XP block in the tabbed
  Abilities view. Place it directly below Luck on the paper sheet. A shared
  RenownControl uses `system.renown` and the existing actor update/draft path.
- Preserve saved Renown; do not initialize or recalculate existing characters
  from current CHA or level. Starting Renown and social awards are entered by
  the player. No automatic level awards or conditional roll bonuses are added.
- Extract the existing ability-row counter/loss behavior into
  AbilityStateControls, shared with owned Class Ability cards. Limited-use
  abilities show available/max and −/+ bounded at zero and the native max.
  Unlimited abilities omit the counter. Loss can be marked or restored manually.
  Use the existing exact-owned-item update path, disable pending controls, and
  preserve normal roll consumption and rest recovery.
- Catalog cards remain read-only. No Core, SDK, compatibility or release-version
  change is required. Existing declined/deferred features remain deferred.

## Validation

Use the existing mounted consumer harness for signed Renown editing, the −4
boundary, values above the book's highest bonus band, mobile/tablet/desktop
column fit, and limited/unlimited ability card loss/use updates. Run explicit
module typing. Record the results and operator acceptance in the active module
audit; source fixtures and browser checks do not establish live Foundry acceptance.

Explicit module typing, six responsive Renown workflows and two ability-card
workflows pass; screenshots were inspected. The user accepted the controls and
approved checkpoint on October 27.

- [x] Renown controls in both requested positions.
- [x] Signed input, requested −4 minimum and no gameplay maximum.
- [x] Shared owned-ability use and lost/restore controls.
- [x] Focused typing/browser checks and user closeout.
