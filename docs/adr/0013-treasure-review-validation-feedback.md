# ADR-0013: Treasure review validation feedback

**Status:** Completed — isolated checks and operator verification accepted
**Date:** 2026-11-08

---

Observation31: Review item rejects an empty weapon feature, but its inline error
is above the viewport and the field has no visible required marker.

Keep the established build-recipe requirements. Shared required TreasurePart
fields display an asterisk, identify invalid input and associate the inline
message with the textarea. After local or server validation fails and the busy
fieldset unlocks, focus and scroll to the first invalid control or inline error
in document order. Errors stay beside their fields. Existing native-item paths
remain available without creating a new feature recipe. No backend or rule change.

Mounted tests reproduce the failure at390/1440 before the change and verify
visible focus, required marking and no prepare call for the invalid draft after
the change. Completing the feature continues through the existing review/save
flow. See [the audit](../audits/2026-11-08-treasure-review-feedback.md).

The user observation log confirms the working-tree fix at 390/1440px on
2026-11-08: focus/error visible, then valid review succeeds. No item saved.
