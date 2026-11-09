# Observation31 — Treasure review feedback

Baseline Shadowdark1.0.1,d208547. Branch:fix/treasure-review-feedback.
Decision: [ADR-0013](../adr/0013-treasure-review-validation-feedback.md).

- [x] Baseline regression fails at390/1440: Review leaves focus away from the
  empty Weapon feature and its error off screen.
- [x] Required part markers, invalid/described-by semantics and first-error
  focus/scroll implemented. Wait for the busy fieldset to unlock before focusing.
- [x] Source browser workflow passes at390/1440, including the invalid-draft
  no-request assertion and existing valid review/save/assignment paths.
- [x] Explicit module typing and isolated packaging pass. Installed archive
  workflow passes at390/1000/1440, including review, save and assignment.
  Phone and desktop error screenshots visually reviewed.
- [x] User observation log confirms 390/1440px review/error focus and successful
  corrected review on 2026-11-08; nothing saved.

The error remains under its input. No new top/bottom banner, relaxed recipe
validation, Core change, production document mutation or version bump.
