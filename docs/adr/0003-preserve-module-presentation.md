# ADR-0003: Preserve Shadowdark presentation through behavior changes

Status: User review corrections implemented and isolated-verified; target card layout confirmed, remaining functional review open
Date: 2026-10-20

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
