# ADR-0005: Character Creator for paper-sheet transcription

Status: Accepted — header/UI correction accepted; native creation and remaining functional gates open
Date: 2026-10-23

## Current operator disposition — October 23

The user accepted the corrected UI and verified Back to Dashboard after the
ConfirmationModal repair. The presentation-specific feature stop is satisfied;
CC-R01 is closed. This does not authorize automatic expansion of scope or close
the whole Character Creator ADR. CC-R02 spell-picker eligibility/duplicates,
CC-R03 shell navigation discard protection and CC-R04/CC-07 native creation
acceptance remain open. Continue only the next work selected by the user.

Core ADR-0073 closes the shared header scope. Supporting Core **0.22.0** remains
pending, with SDK **3.8.0** / UI **3.6.0** and module toolchain pins already
recorded below. Module release version is unchanged. Historical UI stop and
implementation checkpoints below retain the decision sequence; this disposition
supersedes their pending visual-acceptance statements.

## UI correction and feature stop — October 23 operator review

The user rejected the first creator presentation, including its header. **Stop
all new feature work while correcting the UI.** Offline functional tests did not
establish visual acceptance. Do not resume the feature queue until the user
accepts the corrected presentation. Remaining functional findings stay recorded
in the workflow audit; this pass changes presentation, not creation rules.

The concrete reference is `src/ui/tools/Generator.tsx`: its navigation bar, dark
character header with icon/title/subtitle, centered max-width content, white
bordered field panels, serif headings and sans-serif controls. Reuse its header structure through the Core-owned `ModulePageHeader` adoption below; keep the Generator's existing randomize
action and the Creator's explicit discard confirmation. No new global randomize
behavior belongs in the manual creator.

Replace the separate sticky-sidebar/cream-paper layout with the established
centered form, compact step navigation and summary. Use the Generator's field
panels, underline identity controls, clear numeric fields and existing choice
modals. Preserve seven stages, entered values, preparation, recovery and write
boundaries. Core owns the surrounding world/theme background. Specific visual
corrections and acceptance evidence belong here and in the linked audit, not
in AGENTS.md or the handoff.

Acceptance: inspect identity, scores, grant controls and review at phone and
desktop sizes against the Generator; check header consistency, clear hierarchy,
readable values, keyboard access and absence of horizontal overflow. Re-run the
existing mounted creator workflows and explicit module typing after UI changes.
Native/operator creation gates remain separate. The later Core header adoption below records its contract requirement change.

### Superseding header direction — Core ownership

The user clarified that the shared header has two parts: a top navigation row
for tools and sheets, and a larger title/action row for tools. Sheets use only
the shared navigation row; character-specific portrait/name/stats remain sheet
content. The user selected Core ownership so other modules can use and theme the
same structure. Mörk Borg's ActorPage and SCVM Factory already duplicate this
pattern, confirming that it is a host-level concern.

Target contract for a separately approved Core branch:

- A shared host-rendered page header and typed public module configuration, with
  navigation-only and navigation-plus-title modes. One host surface owns one
  header; modules must not add another pre-header/nav strip.
- Module-controlled theme/style tokens and title/subtitle/icon/action content;
  Core owns markup, spacing, accessibility and responsive behavior. Default Core
  theme supplies missing styling. Do not force all systems to look like Shadowdark.
- Scope configuration/callbacks to the active page/module/session and clear them
  on retirement. Preserve the Creator's Back/discard confirmation. Header
  adoption does not silently claim protection for every shell/browser navigation.
- Keep existing modules compatible during adoption; avoid duplicate headers.
  Shadowdark adopts on all registered dashboard tools and both sheet layouts.
  Mörk Borg is a read-only design reference until its adoption is separately scoped.
- Record the additive SDK/UI contract versions, module requirements and authoring
  examples in the owning repositories. Do not pre-bump application releases.

The local `CharacterToolHeader` extraction is provisional, not the final universal
contract or operator acceptance. Do not extend it into another independent
module header system. The feature stop remains: header work is correction of
shared UI, not authorization for unrelated features or the deferred D&D queue.
At proposal time Core was clean on main at `597ffbae`; the user subsequently approved and created `feat/shared-module-page-header`, as recorded below. Core should own a new ADR rather than amending
closed background/settings decisions. This module ADR retains its adoption and
operator acceptance criteria.

### Core header adoption — implementation checkpoint

Core branch `feat/shared-module-page-header` is now approved and created. Core
ADR-0073 implements the shared header through the existing injected component
contract (`useSDKComponents().PageHeader`), with typed props instead of a global
header registration. The host owns both rows; Shadowdark's `ModulePageHeader`
only supplies consistent theme/content defaults. It replaces the provisional
local layout and all tool navigation duplication. The sheet container adds only
navigation in both layouts; Actor-specific content stays within the sheet.

All four registered tools adopt it. Existing creator/importer Back callbacks
are retained, including Creator discard confirmation; Generator keeps its roll action. No broader dirty-state
guard or rule change is introduced. Core SDK3.7→3.8/UI3.5→3.6; Shadowdark's UI
minimum3.3→3.6, release0.9.6 and Core>=0.20.0 unchanged. CI/release toolchain
pins movev0.20.0→plannedv0.22.0. That supporting release is not yet published;
remote CI and module release depend on it. Current verification uses the working
Core with the new contracts, not the old floor archive. If the user selects a
different supporting release, update both pins and docs before publication.

This is UI correction under the feature stop, not permission to resume other
features. Operator acceptance and native creator gates remain open.

## Purpose and scope

Add **Character Creator** to the player Tools area, alongside Character Generator
and Import From Shadowdarklings.net. Its primary use is entering an existing paper
character at any integer level from **0 through 20**. Manual input is the default;
rolling is optional. It creates a new native Player Actor, never changes an
existing character, and does not require the user to replay every historical roll.

The creator must reuse the module's preparation, exact source resolution, choice
handling and public SDK surfaces. It must not become a second rules engine or a
wrapper that performs twenty live level-ups. The supporting
[workflow audit](../audits/2026-10-23-character-creator-workflow.md) records verified
code behavior, native provenance, gaps and evidence limits.

Existing Generator, Importer and level-up behavior remain supported. This plan
does not reopen completed ADR-0001/0002 or close ADR-0003/0004. No new Core contract,
compatibility bump, release version or publication is assumed.

## User workflow

A page-based wizard with Back/Next, named steps and a persistent summary is more
suitable than a large nested modal. Back preserves entries. Optional/inapplicable
sections are skipped, with their reason available in the summary. Users can edit
earlier choices; affected later entries are marked for review, never silently
deleted or rerolled. No Actor or owned Item is written before final confirmation.

| Step | Inputs and behavior |
| --- | --- |
| 1. Character | Name, target level 0–20, ancestry, background, alignment, deity and Class. Show Patron when selected native Class requires it. Use exact readable native references, clear None choices where permitted and source labels for duplicates. Level 0 uses native level-0 semantics and does not receive first-level Class grants. XP is optional explicit current XP, default 0; do not run advancement XP subtraction. |
| 2. Ability scores | Six editable scores, derived modifiers, Roll one and Roll all. Default label: Scores on your character sheet, including permanent bonuses. Offer an explicit base-score mode. Rolling supplies base scores and makes that basis visible. Replacing typed scores requires the shared confirmation UI; no rolls on mount or navigation. |
| 3. Talents and boons | Show fixed ancestry/Class grants automatically and expected awards grouped by acquisition level where native data establishes them. For each award select the actual table result or talent/boon; optionally roll it. Resolve stat allocations, mastery, spell advantage and other dependent choices inline. Allow explicitly recorded additional awards for an existing character without pretending they came from a class table. Do not require old dice totals. |
| 4. Languages and spells | Reuse native language pools and selection counts. Present ordinary spells, fixed granted spells and additional grant choices separately. Fixed grants become owned Spells automatically and cannot be added twice. Resolve every choice grant, including noncaster casting grants. Only show spell sections when applicable. |
| 5. Hit points | Enter current and maximum HP from the sheet by default. Optional Calculate from level gains accepts manual per-level die totals or explicit rolls; grants affecting each calculation must be resolved first. Show the native-source and effective totals when effects change HP. Do not require historical rolls for direct input. |
| 6. Equipment and money | Add exact catalog Items, quantity, equipped/carried/stashed state and gp/sp/cp, with native item details and capacity preview. Enter current possessions; no compulsory starting kit, gold roll, purchase budget or invented gear allowance at higher levels. Support existing custom-item capabilities only where their validated native shape is known. |
| 7. Review and create | Show the finished prepared character, entered-versus-prepared score/HP comparison, all grants and resolved choices, spell lists, languages, inventory and remaining warnings. Explain deviations in player language. Confirm once, show outcome/recovery as needed, then offer Open character in the current tab. |

Empty optional fields must not produce random selections. Selection controls use
available caller-readable native collections; installed but undeclared/unreadable
packs are not secretly searched. Missing essential source data is reported at the
affected step. Descriptive custom notes can preserve paper content without
claiming that unimplemented mechanics work.

## Rules and transcription decisions

### Final numbers versus source values

Paper totals often already include permanent talent/boon bonuses. Saving those
totals as base scores and then copying the native effects would apply them twice.
Every numeric input therefore carries its basis: `effective` (paper total) or
`base`. Never save displayed modifiers as Player scores or derive new effects from
the user's totals.

For supported deterministic additive effects, a shared reconciliation helper may
derive a base from the requested effective value. It must account for actual
enabled/transferred effects, order and supported formula inputs, then run the
normal preparation pipeline and assert an exact round trip. Apply this to ability
scores and HP fields independently; do not assume max-HP effects also change
current HP. Show the derivation in review, not as required technical work for the
player. Example: paper STR 16 plus an owned +2 STR talent stores base 14 and
prepares to 16; a base-score entry of 16 prepares to 18.

Do not generically invert overrides, multiplication, cyclic formulas or unknown
effect modes. When a unique supported base cannot be determined, ask for the
base value with an effective preview or record the unmodeled content as notes.
Never silently disable a native effect, apply compensating effects or accept a
claimed numeric match that preparation does not reproduce. Equipment and later
choice changes invalidate dependent reconciliation before final confirmation.

HP calculation reuses `logic/advancement.ts`: grants before prepared CON;
first-level die plus CON, minimum 1; subsequent gains add their die totals.
Level 0 uses the native generator rule when calculation is requested. A direct
paper maximum takes precedence over speculative historical rolls. If historical
bonuses needed for calculated HP are unknown, require direct HP rather than using
the final CON retrospectively for level 1. Native field bounds apply; exhausted
current HP of 0 is valid, and max/current discrepancies are explained rather than
silently healed or clamped. No rest or resource spending occurs during creation.

### Awards, chronology and dependent choices

Represent each award with a stable draft entry ID, origin (fixed, table result or
explicit record), source UUIDs, acquisition level when known, and its own choices.
For table outcomes retain table UUID/result identities and the complete result
group: an AND bundle is one award; an OR result requires its own choice. Names and
flattened Item counts cannot identify an award or its allowance. Identical
repeatable awards remain independent; nonrepeatable rules come from verified
native semantics, not a blanket UUID deduplication policy.

Build expected awards from native Class/Ancestry/Patron data plus existing
supported handlers. Honor `patron.startingBoons`; do not generalize the current
helper's hard-coded one-boon assumption. Fixed Class abilities and ancestry
grants are inserted exactly once per legitimate source; distinguish them from
rolled/selected rewards. Users enter what they actually received, not a randomly
chosen substitute. Native effect templates remain the mechanics authority.

Use virtual per-level planning when chronology affects rules. A complete history
is optional for transcription: a level-independent recorded award may have an
unknown acquisition level, provided its native serialization can preserve that
distinction. Never relabel it as gained at the final level merely to fill a field.
When level changes the result, require the relevant fact. For example Shune's
choice uses its acquisition level and the approved
[spell-grant policy](../rules/spell-grants.md), not target level. Unknown or
unsupported acquisition-sensitive mechanics remain unresolved; explain what
input is required rather than inventing a ruling.

Resolve all independent +1-to-two-stat/+2-to-one-stat allocations, weapon/armor
masteries, spellcasting advantage choices, boon spell choices and class ability
choices through existing shared validators. Do not collapse two selections into
one mutable singleton field. Fixed spells are added before ordinary spell
selection, and all chosen/owned/fixed spell identities are excluded canonically.
Extra granted spells do not consume ordinary quotas or grant a second Class's
progression. Selection order must not change the final result.

### Levels beyond available progression and paper exceptions

Native 4.0.6 stores levels above 10, but its Class spell table defines levels
1–10 only. The requested 0–20 selector is retained. At an unsupported level show
“No spell allowance is defined for this level; enter the spells on your sheet.”
Read available native data first; never extrapolate a progression, copy level 10
as level 20, clamp an unsupported grant tier, or create a hidden allowance effect.

For paper transcription, unknown/exceeded historical award counts, ordinary spell
allowances, language totals or inventory capacity are review warnings. A user may
explicitly acknowledge the exact deviations and retain their recorded content;
this is a creator-only transcription record, not a change to normal management
or advancement quotas. Preview what the normal sheet will recognize, including
any out-of-progression entries. Choices retain actual casting-list identity.
Acknowledgment cannot create casting permission or fabricate an unknown spell.

Security failures, invalid native shapes, unreadable references, unresolved
effect choices, missing grant-specific facts and unverified numeric matches are
blocking errors. An exception cannot waive them. A native boon whose tier falls
outside the available catalog still needs a separately supported ruling; it
cannot be “fixed” by selecting a lower tier under an ordinary quota exception.
Preserve an unsupported paper ability as a clearly non-mechanical note if desired,
with its missing automation visible in review. No free-form executable effects,
HTML/scripts or raw Actor JSON input is introduced.

## Architecture and reuse

Proposed module-owned entry points (names may be refined without changing scope):

- `module/ui.tsx`: register `creator` and Character Creator dashboard action.
- `src/ui/tools/CharacterCreator.tsx` plus small creator step components/reducer:
  draft editing, navigation, accessibility and server-plan presentation.
- `src/logic/character-creation.ts`: typed draft/award model and pure numeric
  reconciliation; keep request runtime, sockets and persistence out of it.
- `src/server/character-creation.ts`: caller-bound source resolution, requirement
  planning, final native Actor assembly and validation.
- `src/server/api/character-creator.ts`, registered in `src/server/index.ts`:
  `characters/creator/prepare`, `characters/creator/create` and a scoped operation
  status/review route. These are module routes, not new SDK contracts.
- `src/server/creation-operation.ts`: the small creator-specific final-dispatch
  journal and reconciliation, sharing proven utilities where appropriate.

| Reuse surface | Intended reuse / boundary |
| --- | --- |
| `server/access.ts`, adapter readable collections, `logic/identity.ts` | Caller/context checks, exact references and `ownedCopy`; re-read permissions after awaited work. |
| `level-up-engine.ts`, `talent-handlers.ts`, `stat-choices.ts`, `talent-choices.ts` | Extract shared requirement/assembly primitives and reuse resolved-choice validation. Do not call a live endpoint recursively or trust name-deduplicated choices. |
| `logic/spell-grants.ts`, `server/spell-grants.ts`, spell model and language helpers | Fixed/choice grants, casting identities, independent pools and canonical duplicate exclusions. |
| `logic/actor-preparation.ts`, `logic/advancement.ts`, `logic/creation-grants.ts` | Prepared preview, HP arithmetic, canonical grant review; do not use the grant-review subset as the fingerprint of the entire character/inventory. |
| `ui/components/levelup/sections/`, `CompendiumSelectModal`, `GearSelectionModal`, `CustomBoonModal` | Reuse stateless choice controls and existing validated custom content; extract coupling to live Actor mutation before reuse. Do not copy `useLevelUp` or the entire Generator. |
| Public SDK roll runtime, shared dialogs/rich text/tool host | Explicit 3d6 score rolls and native HP/table formulas, existing feedback and source-safe text; module page styling with Core's universal background/lifecycle. |

The prepare response contains a versioned plan, exact source fingerprints, context
revision, derived preview, dependent choices, errors/warnings and a review token.
The draft contains identifiers and bounded typed selections, not trusted document
bodies. Hash the entire normalized reviewed intent, including gear, numbers,
notes and acknowledged deviations. Server preparation reconstructs native Items
from fresh readable sources and applies only validated choices. The final writer
repeats this process; client validity or an old token alone never authorizes it.

Draft state is initially memory-only, scoped to the current user/world/module.
Changing level/Class/ancestry/patron retires outstanding requests and recomputes
dependencies; old replies cannot repopulate new choices. World/logout/module
retirement clears the draft and caller data. Shared discard protection handles
navigation. Persistent draft storage/export is deferred; the final-dispatch
receipt below is required recovery bookkeeping, not a draft cache.

## Final write and recovery

1. Re-resolve sources, validate permissions/context and compare the exact review.
   Changed content returns a fresh review without writing. Resolve all required
   choices and numeric comparisons before dispatch.
2. Persist a caller/world-bound operation ID and full intent fingerprint before
   dispatch. Serialize identical operation submissions. Record dispatched state
   before sending one `runtime.documents.create('Actor', payload)` containing
   all native owned Items/effects. Do not add Items in a post-create loop.
3. Persist the returned exact Actor ID and validate the authoritative created
   source/embedded grants against the reviewed payload, allowing only documented
   native normalization. Return that same outcome on a duplicate request.
4. If dispatch may have succeeded but acknowledgment/bookkeeping failed, retain
   the operation as uncertain and offer Check creation. Never issue another
   create because the Actor is absent from a cached list or a name search.

CC-01 must prove recovery through the public SDK. Preferred reconciliation uses a
server-generated operation marker in the Actor's module flags, bound to the
durable intent, plus a caller-visible authoritative source comparison. Validate
marker round-trip and visibility across supported native versions before relying
on it; no secrets in Actor flags. Do not assume a supplied `_id` is preserved:
the public create options do not promise `keepId` or exactly-once dispatch.
Unique exact evidence can settle bookkeeping without writing. Missing, ambiguous
or changed evidence remains unresolved with an actionable explanation. Permission
loss must not expose the other caller's Actor or authorize replacement creation.
Known pre-dispatch validation failures remain editable; they are not uncertain
writes. Do not transplant Actor-bound advancement receipts into this route.

If a required recovery primitive is unavailable, document the precise contract
gap before implementing an alternative. Core changes need a separately selected
scope; no private host imports, privileged reads or direct Foundry transport.

## Implementation sequence and acceptance

The checkpoint ledger below records progress. Complete tasks in dependency order. Each checkpoint
must record changed files, tests, unresolved limitations and whether evidence is
offline, packaged or operator/native; a checkbox is not proof of native parity.

| Task | Concrete delivery | Acceptance gate |
| --- | --- | --- |
| CC-01: contracts and fixtures | Typed draft/award/plan model; fixtures from pinned native Class, Ancestry, Talent, Boon and RollTable documents; prove final Actor payload and operation marker behavior using public contracts. | Cover 0, 1, 2, 3, 10 and 20; identify unsupported progression explicitly. Demonstrate recovery feasibility or document a precise external blocker before write implementation. |
| CC-02: shared planning | Extract source-aware award requirements and pure assembly from current creation/advancement helpers. Add numeric base/effective reconciliation and virtual-level context. | Independent native oracles for first-level/patron/Ambitious grants; same-name sources, bundled table results, repeated awards, exact stat allocations and no double bonuses. Existing generator/advancement suites remain green. |
| CC-03: prepare API | Resolve selections under caller access, assemble fixed and chosen grants, produce complete preview/review and classify warnings/errors. | Noncaster spell grants, Turn Undead fixed spell, all supported extra spell families, Shune acquisition level, independent language pools, higher-level manual entries and rejected forged selections. No document writes. |
| CC-04: wizard | Register player tool; build seven stages using extracted sections and shared shells. Implement manual defaults, explicit rolls, back/edit invalidation and context retirement. | Keyboard and narrow/desktop usability; never overwrite paper inputs silently; unrelated choices survive edits; delayed responses retire; no default randomization or live Actor mutation. |
| CC-05: final creation | Fresh server review, scoped durable intent, one Actor-create dispatch, exact outcome receipts and recovery/status UI. | Double submit and same-ID replay create one Actor; failure before dispatch writes nothing; timeout/acknowledgment loss never auto-recreates; marker ambiguity/source edits/access loss stay safe and understandable. |
| CC-06: regression/CI | Add creator planner, boundary and mounted workflow suites to maintained module CI. Check released-floor typing and packaged styles/assets. | Paper-to-source-to-prepared round trips; manually injured HP; equipped bonus changes; level 0 and 20; malformed/nonfinite inputs; source revocation/context changes; complete payload with scrolls/wands/quantities and resource states supported by existing controls. |
| CC-07: operator/native acceptance | With separate test-world authority, create representative transcripts in disposable native v13/v14 worlds and compare native sheets to reviewed values. | Level-0, martial with repeated stat grants, ordinary caster, patron caster, noncaster spell boon and higher-level manual case. Verify interruption/recovery without duplicates and compare native versus module-prepared fields. Record discrepancies, not just successful HTTP status. |
| CC-08: documentation and checkpoint | Update architecture, user rules/limitations, terse changelog, this ADR/audit and current handoff; include a reproducible implementation/test report. | No hidden unsupported automation or unresolved mandatory gate; operator review explicitly recorded. Record compatibility unchanged or exact old→new requirements with separately authorized supporting Core work. Commit/publication follow current scoped user authority. |

Tests must exercise real planners/writers and meaningful independent expected
values. Use existing `creation-validation.test.ts`, `advancement-recovery.test.ts`,
`native-parity.test.ts`, language, preparation and effect-conformance suites as
regression gates when shared code changes. Integrate new suites with
`.github/workflows/ci-shadowdark.yaml`, not an untracked one-off runner. Run explicit
module typing, `module:check` and an isolated distributable package using the
documented Core toolchain. Do not start production-connected Core for testing.

### Implementation checkpoint — October 23

HEAD remains `5ea2bc3` on `fix/restore-module-presentation`; implementation is
uncommitted under the selected branch authority. The original planning edits
remain present. Version0.9.6 and all compatibility/toolchain floors are unchanged.

| Gate | Current evidence and remaining work |
| --- | --- |
| CC-01 | Typed bounded draft/independent award model and pinned native fixtures implemented. `creator-contracts.test.ts` covers0/1/2/3/10/20, the exact native1–10 spell rows and additive round trips. Public SDK primary reads/create/DataStore support positive marker reconciliation; `character-creator.test.ts` exercises real writer/journal behavior under a controlled contract. Actual native13/14 marker normalization remains CC-07 acceptance, not proven by these fixtures. |
| CC-02 | Shared requirement helper now reads `patron.startingBoons`; baseline native-source regression failed1 versus3 and passes after correction. Independent Ambitious source and repeated stat grants covered. Constant additive inversion uses normal effect collection/preparation and proves final equality; formula/override inversion is blocked. |
| CC-03 | Caller-bound prepare service reconstructs exact sources, fixed/choice spells, native language pools, inventory and full review. No Actor/Item writes during prepare. Source/context revalidation and exact warning acknowledgements are implemented. Unsupported table instructions and acquisition-sensitive unknowns block, with descriptive notes available. |
| CC-04 | Seven-stage manual wizard implemented with existing selectors/stat allocation and shared confirmation/dialog shells. Five mounted workflow groups pass on source and compiled archive at390/1280, including keyboard selection, repeat grants, explicit rolls, Back, context retirement and delayed recovery across caller changes. Shell-initiated discard protection remains an external SDK gap below. |
| CC-05 | One-payload final writer and durable caller/world receipts implemented. Same-ID replay/double submit, unknown acknowledgements, receipt failures, source ambiguity, revocation and later edits after proven completion have offline regression evidence. Native marker/default normalization remains CC-07. |
| CC-06 | Twenty-one maintained source suites pass on Core0.20.0; final creator suite has28 groups plus native contract oracles. Explicit released-floor typing, module contract, isolated package, compiled creator API/adapter and retained correction probes pass. Archive UI/styles pass all five mounted groups; existing Monster Stats6/6 and corrective advancement/spell consumers18/18 pass. New source/browser/compiled creator checks are in CI; pins/floors unchanged. |
| CC-07 | Pending separate disposable-world/operator authority. No native writes/services authorized or performed. |
| CC-08 | Architecture, player rules/limitations, changelog, audit and single local handoff updated. Offline implementation is ready for review/checkpoint; acceptance remains qualified by CC-07 and the shell guard gap. No commit/push/merge/release performed or inferred. |

The public tool host currently provides no dirty-state/navigation-blocking hook
(`ToolPageRouter` mounts tools without props; SDK `onDirtyChange` belongs to
settings panels only). Creator-owned Dashboard navigation uses shared
ConfirmationModal. Protecting navigation initiated by the surrounding shell
requires a public host capability; no private hook or Core edit is introduced.
This qualification remains an open CC-04 acceptance gate.

Final isolated archive: `shadowdark-0.9.6.tgz`, SHA256
`09f696e3779b5ff98e6529f3dc59ba171e3b42383bb7abfbece6626b1616daf5`.
The [active audit](../audits/2026-10-23-character-creator-workflow.md#final-offline-verification)
separates source, compiled and mounted evidence and gives reproducible commands.

## Non-goals and consequences

No bulk import, existing-Actor replacement, NPC creation, invented levels 11–20
progression, new multiclass system, automatic shopping, arbitrary effect editor,
persistent draft service or global quota override. No reimplementation of shared
chat/dice/modal UI. Existing sources remain unchanged.

This design makes paper transcription possible without forcing random generation
or a fictional history. It adds a real planning boundary and recovery work rather
than merely extending the Generator's level selector. Exact source reuse and
prepared comparisons protect the spell/grant fixes already accepted by the user.
Unsupported paper rules remain visible limitations instead of silently producing
a different character.

### Confirmation integration correction

Operator Back testing exposed a missing `isOpen` on the Creator's shared
ConfirmationModal. Supply the required prop and use the actual Core modal in
existing mounted workflows. Earlier always-visible test substitutes did not
establish host confirmation behavior. See the workflow audit's operator
correction for before/after evidence; visual/native acceptance remains open.
