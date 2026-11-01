# ADR-0008: Shared character base editor

**Status:** Completed — user verified the editor and accepted closeout
**Date:** 2026-10-27

---

## Context and decision

The readiness review identified no post-creation editor for base scores or
maximum HP. Only the paper sheet allowed name editing. The user selected all
three and explicitly chose one shared modal on both sheets, replacing inline
paper-name editing. Routine current HP, luck and resource counters stay inline.

Both Player sheet headers use **Edit · destination view · Rest**, in that order,
with pencil, left/right swap and campfire icons. The paper sheet offers **Tabbed**;
the tabbed sheet offers **Single**, matching the settings terminology. **Edit** opens the **Edit character**
modal for owners/GMs. This replaces the earlier asymmetric view-button labels. Reuse
`ModuleDialog`, its focus/escape handling, the rest dialog's styling, and existing
header-button conventions. Name, six **base** scores and **base maximum HP** have
Save/Cancel and field-local validation. No spinner or second confirmation.
Read-only current sheet totals explain that talents, boons and effects remain
separate. These totals describe the saved character, not a preview of unsaved edits.

Defaults come from preserved source `actor.system`, never `derived`. Native
4.0.6 `PlayerSD.attributeModel` and `_ActorBaseSD` specify integer scores/HP with
minimum zero and no upper bound. This editor is for permanent corrections, so
creation roll limits do not apply. Name must be nonempty. Current HP is neither
healed nor clamped as a side effect; lowering maximum HP does not silently edit it.

`character-edit.ts` builds a sparse patch of changed paths. ActorPage sends it in
one request to the existing public actor-update endpoint. Effects, items, unrelated
fields and current HP are excluded. Existing Core ownership/write validation
remains authoritative. The caller view exposes `canEdit` from the owner read;
no new write route, Core change or transport is required.

Open is guarded against pending sheet operations. Busy state blocks duplicate
submission/dismissal. Realtime changes to these source values require explicit
reload before saving; unrelated actor updates do not discard the draft. This is
a UI stale-edit guard, not an atomic server compare-and-swap contract. Failure
retains the modal and does not claim success or automatically repeat the write.

## Verification

- [x] Source defaults differ from effect-adjusted values in a meaningful fixture.
- [x] One sparse patch; Cancel/no change sends none; zero/large integers accepted,
  missing, negative, fractional and unsafe integers rejected.
- [x] Actual paper and tabbed sheet/provider/modal workflows at 390/1000 pixels:
  name/score/HP save, local validation, Cancel, external edit/reload and failure.
- [x] Existing effect and current HP preserved; screenshots inspected at phone
  and desktop widths; no horizontal modal overflow.
- [x] Explicit module TypeScript with host JSX declarations passed.
- [x] Affected native-parity suite: 33 checks passed, including owner/observer
  editor capability. Isolated 0.9.6 archive packaging passed against Core 0.22.2.
- [x] Four mounted sheet workflows also passed with the Tailwind stylesheet
  extracted from the final archive (source UI, packaged CSS). This is not a full
  managed-install/native acceptance claim.
- [x] User reported the edit modal verified and explicitly approved ADR closeout
  on 2026-10-27. The final button order, destination labels and swap icon were
  also accepted. This is user acceptance of the selected workflow, not a claim
  of an exhaustive native-version matrix.

Maintained checks: `src/tests/character-edit.test.ts` and
`src/tests/character-edit.browser.mjs`. Browser tests use an isolated SDK boundary,
not a production connection. No version/compatibility change is part of this ADR.
