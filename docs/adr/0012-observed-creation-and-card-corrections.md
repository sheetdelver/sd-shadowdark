# ADR-0012: Observed creation and card corrections

**Status:** Completed — automated checks and operator verification accepted
**Date:** 2026-11-08

---

## Scope

Correct November 8 observations 24–28 and 30 from the production web review.
The user also requested every native Class/Ancestry creation path and subsequent
level progression be tested.
Mörk Borg observation 29 belongs to that module; no Core change is required.

## Decisions

- Initialize the optional native `bonus.backstabdice` accumulator to zero on the
  prepared Player clone before effects. Retain independent bonuses and the
  situational Backstab selection. Other unknown formula references still fail.
- Spell picker descriptions use the existing informational description renderer,
  retaining Foundry labels without embedded roll/link controls or guessed Actor
  context. Original documents are unchanged.
- Later-level HP gains update stored current/maximum HP, not effect-adjusted
  maximum HP. Permanent effects remain on their original Items. This deliberately
  corrects the native 4.0.6 `_finalizeLevelUp` pattern of writing prepared maximum
  back as base: Stout must not compound each level. First-level CON behavior is
  unchanged. Previously inflated Actor HP is not automatically repaired.
- Effect labels match both key and operation; ADD damage and MULTIPLY damage are
  distinct. Weapon attack type/range is labelled **Attack**, leaving **Type** for
  the Item type.
- An owned Spell with no Class stays unavailable and tells the player to ask
  their GM to set its Class in Foundry from the original spell. Do not infer from
  the name or overwrite uses/effects. No legacy migration is selected.
- The expanded matrix exposed Generator grants of both Elf/Kobold alternatives.
  Restore its existing ancestry-choice UI, submit exact selected identities and
  validate the native pool/count at preparation and final creation. Existing
  level-zero Actors retain their exact owned choice on advancement; alternatives
  are not added implicitly. Stale asynchronous UI loads cannot replace newer
  ancestry choices.

## Presentation and ownership

Reuse the existing Creator/Generator fields, paper styling, card facts and picker
shell. No navigation, layout, new modal, SDK or transport changes. The narrow
UI changes are readable descriptions, corrected labels and restoration of the
existing choice control. Phone and desktop rendered checks are in the audit.

## Verification and limits

See [the audit](../audits/2026-11-08-observed-production-issues.md). Automated
creation uses the pinned native source and isolated SDK storage, including the
real final writers. It is not a Foundry browser or production write test. The
matrix covers every supplied class/ancestry path, not every possible combination
of awards, equipment, stats and spells. The sequential progression matrix retains the same Actor through levels 0–10,
including both Warlock choice routes, spent resources, wounds and replay fences.
Existing focused suites cover alternative
award families, invalid grants, permissions and retry behavior.

The user confirmed verification on 2026-11-08 and authorized a patch release.
Compatibility requirements are unchanged. Historical inflated HP and malformed
legacy spells remain GM-managed; no automatic migration was added.
