# ADR-0011: Explicit boon effect authoring

**Status:** Completed — user accepted November 4, 2026
**Date:** 2026-11-04

---

## Decision

The user rejected item Attributes and Personality in Boons, then selected
configurable mechanical effects. Keep the oath, secret and blessing workflows
and add an optional Effects section after the name. Effects are explicit GM
choices, never inferred from a rolled description or duration text.

Reuse the existing custom-boon editor's controls and native preset selection in
`BoonEffectFields`, shared by sheet custom-boon creation and GM treasure authoring.
Offer native presets with no unresolved choices or item-type restriction, plus
custom changes. Each row configures its name, key, native legacy operation,
value and enabled state, with a remove action. Legacy operations serialize through
the existing helper and migrate in native Foundry14. No new native effect keys
or copied book effect tables are introduced.

## Storage and behavior

The recipe's optional `effects` array contains authoring rows, bounded to20.
Shared validation rejects incomplete names/keys, unresolved placeholders, invalid
operations/values and malformed enabled states. The server repeats validation
before building the native Boon and before delivery. `createEffect` preserves
the existing transferring, native-compatible shape. Existing source presets
derive from the pinned native4.0.6 generated definitions.

Preview includes effect changes and enabled/disabled status. Save and assignment
retain these effects on the world Item and independent owned copy; the Actor's
base attributes are not patched. Normal preparation applies enabled effects and
suppresses disabled ones. Effects are included in the reviewed draft/payload,
so changing a row invalidates review; receipt replay does not create another copy.

The shared custom-boon modal uses the same row editor and payload builder for
new Boons. Editing an existing Boon still only patches its name/type/level;
individual effect editing remains in the established Effects tab and retains
unknown native data. No existing items are migrated or rewritten.

## Boundaries and presentation

Boons have no item Attributes or Personality sections. Duration, conditions and
use limits stay descriptive and GM-managed. This does not introduce automatic
expiration, spell grants, new daily resources, rest behavior or inferred mechanics.
Custom keys retain the established explicit authoring semantics; entering a key
does not extend native system support for it.

Reference surfaces are the existing CustomBoonModal effect rows and the treasure
builder's paper fields/sections. The reusable editor adds explicit operation,
name and enabled controls with local validation. No new modal or wizard step is
added to treasure creation. Core, SDK requirements and version metadata stay
unchanged.

## Verification

The maintained treasure suite covers native effect payloads, preview inclusion,
invalid row refusal, save/assignment preservation and replay, stale-review
refusal, AC10→12 for an enabled+2 Boon and AC10 when disabled. Browser workflows
cover both390px and1000px, absent item extras, effect editing/enabling/removal,
retention across tab switches, preview, save/assignment and successful reset.
The custom-boon mounted checks cover new effects and lossless existing-item
editing. These are isolated checks; native user verification is separate.

November4 results: treasure source suite passes; treasure browser passes at both
widths with screenshots inspected; card/custom-boon browser suite14/14 passes.
Explicit module/UI/migration typing and isolated module check/package pass.
No Core service was started and no live Foundry documents were changed.

## Acceptance — November 4

The user confirmed the implemented controls work as expected and requested a
checkpoint commit. Boon effect authoring and removal of item Attributes/Personality
are accepted. This user verification is separate from the isolated checks above.
