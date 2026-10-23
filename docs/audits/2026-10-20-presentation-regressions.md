# Shadowdark presentation regression review

Date: 2026-10-20. Active scope: [ADR-0003](../adr/0003-preserve-module-presentation.md).

## Current disposition — 2026-10-22

The user also confirmed languages and text/formula formatting. The newly reported
Destined effect-reference warnings are a separate finding, SD-UI19.

**Latest operator confirmation:** the user reports that spell lists/selection and
level-up grants now work. These reviewed flows are user verified following SD-UI16
and SD-UI18 corrections. This does not claim every class/talent combination was
manually tested or close the remaining sheet review. Earlier pending-retest notes
below describe the evidence available at those checkpoints.

**Open for user review; Shadowdark release held.** The user clarified that more
module surfaces/behavior still need review. Core0.20.0 publication and completed
Core ADR0067–0069 do not establish full Shadowdark acceptance. Implementations
through `fc593c4` are checkpointed, including compatibility alignment. Card layout,
artwork and informational reference behavior have specific user confirmations;
other implemented changes retain their recorded automated/isolated results without
being labelled blanket operator acceptance. See ADR0003's current review summary.

## Provenance and scope

- Reviewed release tree: `60b9c63`, module 0.9.6; native-parity merge `bd03ab4`,
  native-alignment merge `d9a23b3`.
- Visual reference: `09b2633`, module 0.9.4, before native alignment.
- Repair branch: `fix/restore-module-presentation`, authorized by the user.
- Isolated actual host: Core 0.19.5 at `f195246a`.
- Native fixture reference: static Shadowdark 4.0.6, `9677d16b`; the simulated
  upstream is a test boundary, not a running native Foundry world.
- Review inventory: every one of the 42 changed UI/style/manifest paths between
  the reference and release. Unchanged helpers were inspected where consumed.

## Findings and corrections

| ID | Finding | Correction / retained behavior |
| --- | --- | --- |
| SD-UI01 | Replaced spell/language/effect/boon dialogs lost the heavier established form styling; the spell picker became unnecessarily narrow. | Style the existing `ModuleDialog` and form contents; add a picker width, restore serif/uppercase hierarchy, borders, shadows, fields and action buttons. Preserve focus, suspension, layers and compact resource cards. |
| SD-UI02 | The unavailable-source saved spell-operation branch rendered plain buttons outside the styled picker. | Give the review section explicit status, field/action spacing and module button styling. Preserve exact original request/receipt semantics. |
| SD-UI03 | At tablet width the paper-sheet name occupied one third of the header and clipped a normal pregen name. | Give name/title equal tablet columns; retain original desktop ratio at larger widths. Input and update behavior unchanged. |
| SD-UI04 | Earlier installed checks captured only selected tabs at selected widths; the new dialog styles also needed manifest-asset verification. | Capture all seven tabs at every width/theme, add effect/boon/language/gear/source/gem editors and both creation tools, and keep actual-host overlay/keyboard tests. Add distinguishing accessible names to identity edit controls. |
| SD-UI05 | Generator stats forced two columns into a narrow card; die buttons obscured neighboring labels without increasing page width. | Use one stat column where the card is narrow and two where it fits; label score inputs. Measure label/control separation and containment. This predates the native-alignment changes and was found by visual inspection, not the page-overflow assertion. |

A rewritten component is not automatically a visual regression. Canonical effect
rows replace duplicate lists; responsive inventory controls and current spell
sources expose corrected behavior. Those remain. Cosmetic restoration must not
restore guessed formulas, destructive catalog-derived deletion or stale callbacks.

## Whole-UI disposition

| Path | Review disposition |
| --- | --- |
| `module/ui.tsx` (M) | Retain dashboard/tools/card integration; declare scoped presentation stylesheet through the existing public manifest contract. |
| `src/ui/AbilitiesTab.tsx` (M) | Retain paper cards, heavy headers and responsive layout. Native action rows and NPC distinctions remain; all widths rendered. |
| `src/ui/DetailsTab.tsx` (M) | Retain identity/boon design and exact sources; give identity edit controls distinct accessible names. Source/language/boon pickers rendered. |
| `src/ui/EffectsTab.tsx` (M) | Retain black header/white rows and canonical one-row-per-effect view. Do not restore duplicate passive/active lists. Editor gets restored common theme. |
| `src/ui/InventoryComponents.tsx` (M) | Retain responsive row layout, exact Items, controls and cards; no restore of guessed slots/dice or destructive operations. Render expanded row/cards. |
| `src/ui/InventoryTab.tsx` (M) | Retain responsive headings and prepared inventory; render gear, treasure, gem forms and cards. Mutation paths remain unchanged. |
| `src/ui/ShadowdarkPaperSheet.tsx` (M) | Retain compact native action/item sections and shared projector. Repair tablet name width; inspect full paper layout in all widths/themes. |
| `src/ui/ShadowdarkSheet.tsx` (M) | Retain header/tab design, saving state, recovery entry and scoped loading/error state. Capture all seven tabs. |
| `src/ui/SpellsTab.tsx` (M) | Retain exact native spell sources, owned Items, actions and recovery. Restore styling in the source-unavailable saved-operation branch; render picker/cards. |
| `src/ui/TalentsTab.tsx` (M) | Retain expanding rows, wrapping names and resource-card links; visible keyboard buttons replace inaccessible div clicks. |
| `src/ui/components/AddEffectsModal.tsx` (M) | Current complete effect shape/editor remains; restore heavy management-dialog styling through ModuleDialog. |
| `src/ui/components/CollectionStatus.tsx` (A) | New loading/error/retry/partial states already use explicit module colors/borders; retain and exercise existing failure/recovery cases. |
| `src/ui/components/CompendiumSelectModal.tsx` (M) | Appearance essentially retained; new data-state input is behavioral. Render Deity picker. Legacy focus/Escape limitation explicitly recorded. |
| `src/ui/components/CustomBoonModal.tsx` (M) | Keep complete effect-group editing; restore typography, fields and actions through ModuleDialog. |
| `src/ui/components/GearSelectionModal.tsx` (M) | Keep existing heavy picker theme, native dialog/focus behavior and current catalog states. Render and retain context-refresh tests. |
| `src/ui/components/GemBagModal.tsx` (M) | No presentation lines changed in alignment; callbacks now use exact inventory paths. Render bag/add form; legacy keyboard limitation recorded. |
| `src/ui/components/ItemModal.tsx` (D) | Deleted older detail view stays deleted. ResourceDetailModal is the current shared details/card consumer; retain compact card behavior. |
| `src/ui/components/ItemStateControls.tsx` (A) | New shared card/sheet controls retain module borders/colors, touch targets and current actions. Render inventory resource card. |
| `src/ui/components/LanguageChoices.tsx` (A) | Retain current fixed/independent native pools and accessible selections. Common dialog theme restores surrounding hierarchy. |
| `src/ui/components/LanguageSelectionModal.tsx` (M) | Retain safe current native selection/edit semantics; restore common management-dialog theme. Render keyboard flow. |
| `src/ui/components/LevelUpModal.tsx` (M) | No presentation lines changed in alignment; current class/source/recovery behavior stays. Source review includes unchanged sections and older shell limitation. |
| `src/ui/components/LuckControl.tsx` (A) | Retain settings-aware checkbox/count controls; shared presentation remains compact. Installed pulp-change and both sheet cases retained. |
| `src/ui/components/ModuleDialog.tsx` (A) | Shared accessible frame retained; add presentation classes and wide picker size. Preserve card size, host-dialog suspension, focus and layer order. |
| `src/ui/components/ResourceDetailModal.tsx` (A) | New shared item/spell/monster details retain compact design and current actions. Render cards and nested Core roll/focus return. |
| `src/ui/components/ShadowdarkImportForm.tsx` (M) | Retain original black/white tool layout and explicit unresolved-source review controls. Render importer; earlier full host import checks retained. |
| `src/ui/components/SpellSelectionModal.tsx` (M) | Restore management-picker width, title/fields/actions and selected-row states; preserve exact add/remove/source/recovery semantics. |
| `src/ui/components/levelup/AdvancementRecovery.tsx` (A) | New receipt review already has explicit wrapping and themed fields/buttons; retain source-resolution semantics and existing mounted coverage. |
| `src/ui/components/levelup/sections/ArmorSelectionSection.tsx` (M) | Choice/key data correction; retain original choice layout and current exact grants. |
| `src/ui/components/levelup/sections/LanguageSelectionSection.tsx` (M) | Shared independent native language pools replace duplicated UI rules; retain common LanguageChoices presentation and current validation. |
| `src/ui/components/levelup/sections/WeaponSelectionSection.tsx` (M) | Choice/key data correction; retain original choice layout and exact mastery grants. |
| `src/ui/components/levelup/useLevelUp.ts` (M) | No presentation changes; current advancement orchestration remains. Do not restore old completion/retry behavior. |
| `src/ui/context/ShadowdarkActorContext.tsx` (M) | Retain authorized card/roll/recovery composition; no separate appearance shell added here. |
| `src/ui/context/ShadowdarkUIContext.tsx` (M) | Non-rendering provider/cache integration retained; preserve lifecycle and caller isolation. |
| `src/ui/context/system-index-store.ts` (A) | Non-rendering scoped store retained; no UI or second cache introduced. |
| `src/ui/hooks/useChoiceCatalog.ts` (A) | Non-rendering request/choice lifecycle helper retained. |
| `src/ui/hooks/useLanguagePlan.ts` (A) | Non-rendering shared native-plan lookup retained. |
| `src/ui/hooks/useShadowdarkLevelUp.ts` (M) | Non-rendering recovery/advancement entry retained. |
| `src/ui/pages/ActorPage.tsx` (M) | Retain hidden stale projection, unavailable/error/retry view and current authorization. No private data resurrected for visual continuity. |
| `src/ui/pages/postActorRoll.ts` (M) | Non-rendering public roll orchestration retained. |
| `src/ui/sheet-utils.ts` (M) | Removed rule duplication stays removed; current projector and description helpers remain. |
| `src/ui/tools/Bestiary.tsx` (A) | New module-themed tool has no old version to restore; inspect list, filters and monster cards at all widths. |
| `src/ui/tools/Generator.tsx` (M) | Main preexisting tool layout retained. Native source/language/review changes stay; new language dialog receives common theme. Render tool and retain creation/context tests. |

## Verification

Source/consumer checks use the module's [working agreement](../../AGENTS.md).
The maintained installed runner has a presentation-only mode for this scope:

```sh
node data/local/modules/shadowdark/src/tests/verify-types.mjs
node --import tsx data/local/modules/shadowdark/src/tests/installed-consumers.core.ts --run-isolated --archive=/tmp/shadowdark-0.9.6.tgz --out=/tmp/new-presentation-run --generation=14 --presentation-only
```

Set `SHADOWDARK_CORE` to the configured read-only host checkout,
`SHADOWDARK_PLAYWRIGHT_MODULE` to the isolated test dependency and
`SHADOWDARK_CHROME` to the test browser. The runner copies Core, creates isolated
data, installs the archive through public routes, supplies a controlled upstream,
logs in through Core and cleans up its own services. Root settings and operator
Foundry are never used. Omit `--presentation-only` for the broader behavioral
follow-ups; they are retained separately.

The first expanded real-host run passed 30 checks: the eight width/theme groups,
all seven tabs, cards, management dialogs, shared overlays and existing
refresh/permission/recovery/creation follow-ups. The final matrix adds the other
tools/editors and qualifies the final archive separately.

Final results and archive identity are recorded below.

## Limits and review

User visual review remains pending. Native images are not served by the
controlled upstream, so missing native artwork in screenshots is a fixture
limitation, not proof of a product asset regression. Module CSS and its assets
must still load successfully.

Gem Bag, CompendiumSelect and the older advancement shell predate the new
ModuleDialog and lack its full focus/Escape contract. Their source is included
in this review; do not claim that keyboard passes for ModuleDialog prove those
legacy shells accessible. They retain their existing appearance/behavior in
this restoration. Arbitrary advancement combinations and every recovery branch
are covered by maintained source/mounted behavior tests, not fresh native visual
acceptance in this pass.

No selected native parity work is reopened. CG qualifications, prior deferrals
and experimental external features retain their existing dispositions.

## Final isolated result

Archive SHA-256: `d50d709e09ce1942a6bb668295b17c7ac05dfa1b7e3cd76f27cf1a5d664be607`. Version remains 0.9.6.
All 17 source suites and explicit module/UI/hook typing pass. The final actual
Core presentation run passes all eight width/theme groups (11 checks including
setup/completion), with no uncaught page errors. The earlier full host run
passes 30 checks and retains its separate archive identity.
Module checking, isolated packaging, whitespace and documentation links pass.
Compiled logic/server output is byte-identical to the before archive; Shadowdark
migration definitions/hooks also match. No compatibility/version/workflow change.

The [portable validation record](evidence/2026-10-20-presentation.json) records
checks and qualifications without native content or temporary paths. Representative
screenshots were visually inspected in addition to geometry/keyboard assertions.
All task-owned services stopped. No operator Foundry connection occurred. Changes
remain uncommitted, with user visual review pending.

## User review correction pass — SD-UI06–08

The earlier isolated result above remains tied to its original archive. The user
then identified visible problems it did not catch; that result is not acceptance
of these later corrections.

| ID | Confirmed finding | Implemented correction |
| --- | --- | --- |
| SD-UI06 | Spell rows exposed owned Item IDs; action labels and status text were inconsistent. Initial provider refresh could claim choices changed before any choice. | Human labels/copy numbers, matched controls, owned thumbnails, concise status; exact UUID/Item identities remain in intent and receipts. Only actual retired intent shows the changed-choice notice. |
| SD-UI07 | The ordinary language editor intentionally allowed unlimited editing, contrary to the user's requested allotment-guided workflow. | Shared native-source plan/allocation, Common/Rare counters, protected fixed grants, retained existing extras, and owner/review/context-checked primary save. This is an explicit policy change from native's unrestricted ordinary editor, documented in ADR-0003. |
| SD-UI08 | Custom Boon and Add Effect inherited serif styling on small labels/selects; shell-only styling missed control typography. | Shared compact sans labels/selects, serif input values/headings/actions, square fields and offset shadows. Technical effect keys keep monospace; effect behavior is unchanged. |

Implementation references: `logic/languages.ts` (`allocateLanguageInventory`,
`validateLanguageInventory`, `languageInventorySections`),
`server/api/languages.ts` (`inventoryPlan`, `handleManageLanguages`),
`ui/hooks/useLanguagePlan.ts`, `ui/components/LanguageSelectionModal.tsx`,
`SpellSelectionModal.tsx`, `CustomBoonModal.tsx`, `AddEffectsModal.tsx`, and
`assets/presentation.css`. `DetailsTab` refreshes after the reviewed save.

Native source is still release 4.0.6 at 9677d16b. The new isolated host is Core
0.19.6 at 10dd775e; no Core edit or compatibility bump is required. Final validation
results are recorded below after the packaged expanded-form pass. Operator visual
review and native testing are not claimed by these fixtures.

### Correction verification result

- All 17 maintained source suites and explicit module/UI/hook typing pass. The
  language suite has 14 cases, including independent quotas, retained extras,
  owner403/concealed404, stale source/context, unchanged save and stable reviews.
- Mounted consumers 43/43; corrective advancement/spell consumers 16/16; final
  language consumer checks 4/4. The same catalog/plan input fails the old picker
  because it enables a Common choice with zero allowance; the correction passes.
- Isolated module checking and packaging pass. Broad installed presentation:
  360/768/1024/1440, both themes, 11 checks. Final archive expanded Boon/Effect
  forms and loaded language/spell pickers: 360/1440, both themes, 7 checks.
  Both runs have zero uncaught page errors. Keyboard entry/containment/dismissal,
  control bounds and actual select typography are asserted; representative phone
  and desktop screenshots were visually inspected.
- Final archive SHA256:
  `b8294884a064abe6cc42708f9afb2c40f70d0bd49ed474bb2632fd0724338360`.
  Earlier broad run hash:
  `02834e00f1ca357492b6c81ffaae070f2a73f47012e54370ebb29684c5f29d05`.
  The final UI closes a confirmed language save before refreshing the Actor.
- `info.json`, migration catalog and definitions are byte-identical to the before
  archive. All six compiled hooks have identical code; generated build-root
  comments differ. No version, compatibility, release workflow or Core edit.
- 31 local documentation links and whitespace checks pass. The
  [portable correction record](evidence/2026-10-20-dialog-review.json) preserves
  counts, identities and limitations independently of ignored temporary outputs.

Reproduce with the working agreement's 17 source commands and explicit typing;
`collection-consumers.browser.mjs`, `parity-corrections.browser.mjs`, and
`installed-consumers.core.ts --run-isolated --archive=<archive> --out=<new-dir>
--generation=14 --presentation-only`. Add `--widths=360,1440` for the bounded
expanded-form rerun. `--language-baseline=HEAD` is an expected-failing comparison
while HEAD remains 60b9c63, not a passing acceptance mode. Packaging uses a real
source copy in isolated data with the host dependencies available to Tailwind;
symlinked source roots are rejected by the pure-migration path guard.

The first expanded-form run used a case-sensitive label locator which did not
match the rendered uppercase accessible name. The corrected role-based locator
passes. No product defect is inferred from that harness failure.

All task services stopped. No native/operator world was contacted. The user must
still review the presentation; this pass does not close ADR-0003 or authorize a
commit/release.


## Follow-up review — SD-UI09–11 (2026-10-21)

The user reported fixed-only characters hiding the language catalog, instant
spells exposing focus, and requested illustrated resource cards. Their subsequent
card clarification places the title in its own inset black panel below the Close
bar, with full-width background art fading behind title/properties. The user
confirmed that layout direction; this is not blanket native/functional acceptance.

| ID | Confirmed cause | Correction and acceptance |
| --- | --- | --- |
| SD-UI09 | `server/languages.ts::callerLanguagePlan` skipped catalog browsing when neither source granted an unrestricted choice. Exact fixed references were the only returned rows. | Inventory mode always browses authorized sources. `logic/languages.ts::languageEditingPlan` allows replacing classified defaults within Common/Rare totals, while creation pools remain exact. All rows remain visible at capacity. Server checks deny excess, unknown additions, changed source/context and non-owners. |
| SD-UI10 | `logic/actions.ts::prepareSpellAction` allowed focus for every Player-owned Spell, omitting the native duration condition. | Require `system.duration.type === "focus"` in the shared action. UI hides inapplicable focus; stale checked state and crafted focus requests cannot exempt an instant/timed/permanent/unspecified spell from loss. |
| SD-UI11 | Cards used a small foreground thumbnail and title/type in the Close bar. | `ResourceDetailModal::CardBody`, `ModuleDialog`, `CardNotes`, Bestiary and declared presentation CSS implement full-width background art, top/bottom fades, inset title, Type property and notes before footer actions. Missing images collapse decorative space. |

Native reference remains release-4.0.6, commit `9677d16b3903b3b640f00d4efd48249142ac8334`.
The focus predicate is directly visible in
`system/templates/actors/player/spells.hbs`; ordinary inventory customization is
an explicit user-selected policy, not a claim about native creation behavior.
The module baseline is `e7cd3b51e701fab0f269f95a06d52c9e92771f5f`; all earlier
pending presentation edits were retained. Core is read-only 0.19.8 at
`9ae8442d18445a0472a1be4236c8f6b973e7008b`.

### Verification

- Both new regressions reproduced before correction: fixed-only plans returned
  only two of five readable fixture languages; an instant spell wrongly enabled
  focus. Both pass after correction. The focus route also checks actual failure
  writes for instant, timed, permanent, missing and focus durations.
- All 17 maintained source suites pass. Final language suite: 16 cases;
  action boundary suite: 54 cases. Explicit module/UI/hook typing, module checking
  and isolated packaging pass. Affected weapon/card and presentation suites were
  rerun after the final title refinement and pass.
- Mounted consumers: 52/52, including eight card cases across
  360/768/1024/1440. The card cases verify native focus visibility, submitted focus,
  changed duration, full body width, top/bottom fade, inset title, Type property,
  notes before buttons, missing-image fallback and no horizontal overflow.
- First archive `f4b24aea3c1b80cb2cdf678fa47346bc49cd04f246ec1597bb5a46b659d68c3d`
  passed the real isolated Core matrix at all four widths in both themes (11
  checks, no uncaught page errors). That archive predates the final title/background
  refinement. Final archive identity and its bounded installed rerun are recorded
  in the portable validation record below.

Reproduction: source commands in `AGENTS.md`; `collection-consumers.browser.mjs`
with `SHADOWDARK_CARD_TAILWIND` pointing to `assets/shadowdark.tailwind.css` extracted
from the archive; and `installed-consumers.core.ts --run-isolated --archive=<tgz>
--out=<new-directory> --generation=14 --presentation-only --widths=360,1440`.
Set the isolated browser/toolchain paths as described in the existing verification
section. The mounted test supports `--cards-only` for these eight card cases.

The installed runner serves static native system artwork from the local reference
inside its isolated browser only. Core icons unavailable in the fixture upstream
exercise the readable no-image fallback; no replacement artwork ships in the
module. No operator Foundry connection, native write, migration, Core edit,
version bump or Git write occurred. Final user gameplay review remains separate.

Final result: all 16 corrective spell/advancement mounted cases pass.
Final archive SHA256 `b4d24e7917b6eeae7c161adb43442cbe65de9fcd38aa6a0e396bf2818ebe4d3a` passes
seven installed checks at 360/1440 in both themes, with zero uncaught page errors.
Representative phone and desktop card screenshots were visually inspected.
Archive `info.json` and `migration.json` are byte-identical to the prior review
archive; version, compatibility and migration sources are unchanged.
The [portable follow-up record](evidence/2026-10-21-language-focus-cards.json)
contains counts, provenance and limitations. All task services stopped; operator
Core/Foundry listeners remained untouched. Changes remain uncommitted.

## SD-UI12 — Optional installed monster artwork (October21)

Status: implemented; isolated verification, operator review pending.
Previous presentation work was checkpointed as `f1da5eb53930fe2772c9117aeb6de1ee41ecd388`.
This follow-up remains uncommitted on `fix/restore-module-presentation` and uses
Core's authorized `feat/sdk-foundry-package-context` branch (ADR-0067).

Native reference: Shadowdark4.0.6 at
`9677d16b3903b3b640f00d4efd48249142ac8334`, `system/src/config.mjs` and
`data/packs/monsters.db`. Community tokens1.3 local manifest SHA256
`d3cff72bf52b1612fc996747c48b55d879ffdb7d855b552fd5e02f839591b3ec`, mapping SHA256
`319492804585c00992a2f79bfeb37427707e9fc645eb6386ac574d5aa10fef4f`.
The default-only eligibility policy initially recognized the red NPC default but
missed the older bundled placeholder. The installed archive reproduced this;
the added exact-path regression failed before correction and passes afterward.

Changes: `logic/community-artwork.ts::monsterPortraitRef`,
`server/community-artwork.ts::resolveMonsterArtwork`, bestiary list/card request
handlers, `ArtworkImage`, `ResourceDetailModal` and the mounted Bestiary lifecycle.
No data migration, artwork distribution, guessed-name lookup or native document
write. Absent older-host capability, custom image, inaccessible pack, malformed
mapping, revoked access and optional image failure retain the original source.

Verification commands are in AGENTS.md. New `community-artwork.test.ts` has six
groups covering eligibility, exact identity, old-host/failure fallback, request
routes, changed source/visibility and world/pack retirement. All18 maintained
module suites pass. Explicit module/UI/hook typing and isolated check/package
pass. The final archive SHA256 is
`1a185c0cab0b7cb8fb3e0e83a96862d09521c172ecfdfcb67ad3023b2a82d3f1`.

`installed-consumers.core.ts --run-isolated --artwork-only
--community-art-root=<read-only-installed-package> --archive=<archive>
--out=<new-directory> --generation=14` uses copied real Core, public managed
installation, real SDK/routes and a synthetic native upstream. The package's
actual local assets are served inside that fixture, never copied into the archive.
Seven development-host checks pass: no-op managed install, player login, protected
package/art routes, desktop/mobile bestiary images, live preferences, broken-image
fallback, and zero upstream writes (some assertions share a check group).
Screenshots at360/1440 were inspected; card fades, title bar and clipping remain.
The source hash recorded in newer runs identifies uncommitted copied Core code,
not merely its HEAD. These checks are not actual Foundry-world acceptance.

Core's maintained source comparison runs12 cases against each native v13/v14
artwork class. It records the generation distinction for partial preference
objects; Item artwork is v14-only. The default/priority result is qualified;
external maps, browser scripts and failed-provider fallback are not full native
parity claims. Installed local package presence is verified, native enabled state
remains unknown. User review and any release are separate.

Final installed production result: build/start plus the same seven checks pass,
with zero uncaught page errors and zero upstream writes. Final archive282785bytes;
SHA256 unchanged from above. Production Core source-tree SHA256
`20d07087cd113b97a90913ff1bcf363c8b03c05bb047b4e6a493b7cf13ddb93f` identifies the
copied implementation. Maintained mounted consumers also pass52/52 with the final
archive's stylesheet. All task services stopped; new artwork work is uncommitted.

## Combat artwork verification — 2026-10-21

The optional display hook adds generic policy without Core system-specific logic.
Core contract suite passes 9 groups: omitted/declined hooks, alternate module-owned
assets, bad URLs/errors, stale scope, deadline/abort, manager/HUD precedence, empty
Actor portrait fallback, caller/Actor access, and hidden/unstarted rows. The mounted
actual consumer passes six controlled request transitions covering both `_id` and
`id` session shapes, original-first display, broken replacement/original, settings,
source mismatch, caller/world change, reconnect and unmount. Shadowdark's artwork
suite passes 7 groups; all 18 module source suites pass.

An initial installed production check found the new consumer only accepted `id`;
the actual native User shape uses `_id`. Corrected to the shared `_id || id`
precedence and expanded the mounted fixture. The final copied Core production
build/start and managed archive run passes **9/9**: protected discovery, installed
bestiary/card at 360/1440 widths, preference refresh, broken-image fallback, manager
portrait, HUD token, custom Actor/Token preservation, zero native writes. No page
or console errors. The manager screenshot was inspected. The earlier failed run
is retained as a diagnostic, not passing acceptance.

Final archive: `shadowdark-0.9.6.tgz`, 283460 bytes; SHA-256
`948eda06fcf4b82a69c18a045f66bd80cee22d74106821530d67ed6b61d32ab3`.
Core 0.19.8 base commit `9ae8442d18445a0472a1be4236c8f6b973e7008b`, tested working
`src` tree SHA-256 `5f16940f7b7369bd867cff237ac4b7c7742d6d728e6cb43b2152521596a5fc35`.
This supersedes earlier artifact identities for the combat-hook extension. The
archive was created before subsequent documentation/harness-only edits; runtime
module code is identical. Core unit/client/integration, explicit Core/module types,
lint and whitespace checks pass. The authoring guide's actual TypeScript example
was separately compiled against SDK exports.

Reproduction uses the maintained installed harness with `--run-isolated
--archive=<tgz> --out=<new-directory> --generation=14 --production --artwork-only
--community-art-root=<read-only-installed-package>`, configured temporary browser
tooling as documented in module AGENTS. Core checks use `npm run test:unit`,
`npm run test:client`, `npm run test:integration`, `npx tsc --noEmit`, `npm run lint`,
and `node src/tests/acceptance/display-artwork.browser.mjs`. Module typing uses
`node data/local/modules/shadowdark/src/tests/verify-types.mjs` from Core.

This is isolated real-host acceptance with synthetic native data and actual
read-only installed artwork; it is not fresh live native acceptance. Prior static
v13/v14 mapping comparisons remain applicable. Actual operator world activation
of the installed provider has not been independently observed. Dashboard cards
have not adopted this hook. No native data, app versions or module minima changed.
All test-owned services stop in cleanup. Operator Core 8000/8001 and Foundry 30000
remain running and untouched. No commit, push or release was performed.

## Compendium-copy correction verification — 2026-10-21

User's live screenshot showed default images for encounter-owned pack copies.
The initial installed artwork fixture supplied a native origin on a world Actor
and missed the real copy writer, which strips `_stats` while retaining its own
exact source marker. Added `DisplayArtworkContext.compendiumSourceUuid`, derived
by Core only after copy registration, encounter/folder agreement and typed Actor
UUID checks. Shadowdark consumes that public context before native origins.
No private Core flag parsing is added to the module. Existing sources remain
unchanged; custom images and caller pack permissions still apply.

Core and module regressions both failed before correction (missing origin and
missing replacement respectively), then passed. Core artwork suite: 10 groups;
Shadowdark artwork suite: 8 groups. Full Core unit suite, explicit Core/module
typing, lint, module check/package and the revised authoring example pass. The
previous full client/integration results remain retained; those unchanged suites
were not rerun for this server provenance correction.

Final isolated production build/managed acceptance passes **11/11**, including
the actual public `combat-manager/:id/pack-actors` operation, rendered copy before
initiative, and existing-copy resolution after Core restart. The controlled
fixture recorded three copy-creation writes and zero artwork/repair writes.
No page errors. The copied-participant screenshot was inspected. An intermediate
harness run omitted the normal mutation runtime header and correctly received
409; the final run sends the current public status token like the real UI.

Archive SHA-256:
`7b9cdbe334d2a4c244a4394b410246c707cbcdb26905cd0a5d1da5924898f585`.
Core working `src` tree SHA-256:
`837dc0c4cf7de7cd751d30088da2e81d7da2f5c7827a1e5fc754982547e80ee1`.
Core base/version remain `9ae8442d`/0.19.8; module remains0.9.6. Maintained harness
command is the previous production artwork command with a fresh corrected archive
and output directory. Local outputs: `/tmp/art-copy-production-final` and
`/tmp/art-copy-final/data/dist/modules/shadowdark-0.9.6.tgz`. Runtime code matches
the archive; later edits are documentation/harness-only.

Read-only inspection of installed package1.3 mappings confirms exact native4.0.6
IDs for Elephant, Demon/Dretch, Naga/Bone, Manta Ray/Giant and Assassin all have
portrait/token mappings. This does not independently establish live world enable
state. Test services stopped; operator ports8000/8001/30000 untouched. All
corrections remain uncommitted; no live native data changes or release operations.

### Operator confirmation and artwork checkpoint

On 2026-10-21 the user confirmed that combat artwork looks and works as expected
and authorized local Core/module checkpoints. Earlier isolated results remain
qualified as recorded. This confirmation covers the current artwork correction;
it does not implement the separately discussed generic Core NPC viewer. No push
or release is authorized by this checkpoint.

Local feature checkpoints: Core `e41c4b48` and Shadowdark `defb07b`. Application
versions remain unchanged; Core SDK3.5/module-api1.7/UI3.3 declarations are in the
Core checkpoint. Shadowdark retains its optional older-host fallback.


### Optional original-source reference cards — Core ADR-0068 (2026-10-21)

Authorized follow-up to the artwork checkpoint; uncommitted on the existing repair
branch. No version/floor changes. Core's optional `prepareReferenceView`/
`referenceViews` contract is adopted structurally in `server/reference-view.ts`,
`ShadowdarkAdapter` and `module/ui.tsx`. NPC Actor and Item sources share existing
card models; Core's combat manager consumes Actor references only. Player Actors,
unknown origins and denied/unavailable compendium entries have no reference link.

`ResourceCardBody.tsx` extracts the established content/notes presentation from
ResourceDetailModal. Existing interactive cards retain their controller and
behavior. The informational component uses sanitized inert descriptions and empty
actions, with one Core-owned dialog and its Close control. It never mounts an
Actor action context or shows live encounter fields. Art/fades/inset title/paper
styles and optional community-artwork resolution are retained.

Verification: all19 maintained module suites, explicit module source typing,
Core unit/client/integration suites,9 new Core contract groups,14 mounted browser
requests, isolated check/package and12-check development/production installed
runs passed. The actual public copy writer establishes provenance without native
_stats; copied HP/max is then changed to1 while reference facts still match the
original Aboleth fixture. Both typed Actor and Item endpoints, wrong-type/missing
references, mobile360/desktop1440, Escape/focus restoration, ownership-setting
revoke/restore and existing-copy Core restart are exercised. Viewer-triggered
native writes:0; the3 writes from creating the synthetic encounter fixture are
separately counted. Existing source and instance fixtures are preserved/restored.
This is controlled upstream/real Core evidence, not a new native Foundry run.

Maintained tests: `src/tests/reference-view.test.ts`,
`src/tests/installed-consumers.core.ts --artwork-only --reference-views` and the
unchanged existing card/presentation suites. Core's ADR-0068 and authoring/API/
manifest docs contain public signatures and reproduction instructions.
Archive SHA-256:
`43ede0a724e5c15fcefa524e1b6fc447d9f7156c2e25876d7314e848ad7891b1`.
Local `/tmp/reference-view-package/data/dist/modules/shadowdark-0.9.6.tgz`;
acceptance outputs `/tmp/reference-view-development` and
`/tmp/reference-view-production-final`. No Core-private import, source repair,
competing modal or Item link in other Core UI is introduced. Operator review and
commits/releases remain separate.


### Reference-view checkpoint approval

The user confirmed the reference presentation and Core's revised combat rows,
then authorized local Core/Shadowdark checkpoint commits. This is operator-reported
acceptance additional to the isolated results. The Core roster-only follow-up has
an installed `--roster-layout` scenario at360/820/1440px, with health controls enabled
and a hidden/unrolled participant added after start. All six controls retain two
rows, intact stat pills and Damage icon; isolated run12/12 passed. No module runtime
change was needed for that row adjustment. Further combat-manager UI cleanup is
next; no remote/release operation or version change is included in this checkpoint.


## Core closeout and release floor — 2026-10-22

The user closed Core ADR0067–0069 and explicitly selected Shadowdark requirement
alignment. Module ADR0003's release-compatibility amendment records the new
Core0.20.0/module-api1.7.0/UI3.3.0 floor and coordinated CI pins. Earlier tests
against older supported hosts are historical evidence for their original
manifests, not admission evidence for the new floor. This does not close unrelated
module functional review or change native rules, migrations, artwork fallback or
reference authorization.

The real Core compatibility resolver accepts the proposed0.20.0/current API set
and rejects0.19.8/older APIs; parsed validation/release pins match. Updated
presentation assertions pass; migration suite19/19 passes. Core publication must
precede the updated module CI/package/release; no unavailable tag was fetched,
no real release helper or native service was run. Module version remains0.9.6.

Compatibility closeout verification: presentation assertions pass, migration hooks19/19,
release-tool regressions49/49, parsed workflow pin agreement and real Core
compatibility acceptance/rejection checks pass. No hosted CI or new-floor install
was claimed before Core publication.


### Released-Core compatibility check — 2026-10-22

Core v0.20.0 is published at560f26e0222760bd9a69531ce6cd22d6b81cbec4. An
isolated copy of that exact Core tree with committed Shadowdark fc593c4 passes
module:check: compatibility, TypeScript, scoped Tailwind and logic/UI/server dry
bundles. This removes the planned-release compatibility blocker, not the user's
remaining review. The initial root-workspace attempt encountered an unrelated
D&D source type error and missing external-copy dependency resolution; the
corrected run excludes sibling checkouts and supplies shared installed toolchain
dependencies. No module runtime fix was required. No native/installed UI or
hosted CI acceptance is claimed. Module release remains held for user review.


## SD-UI13 — Tool canvases obscure the world/theme background (2026-10-22)

User report: character-sheet surroundings correctly show the blue Core theme,
but generator/importer/bestiary show a white/light page canvas. Confirmed roots in
`src/ui/tools/Generator.tsx`, `src/ui/components/ShadowdarkImportForm.tsx` and
`src/ui/tools/Bestiary.tsx` used `bg-neutral-100`. Core0.20.0's tool host also lacked
world artwork. The module roots are now transparent; inner paper styling remains.
Bestiary outside text inherits the host foreground; its white controls/cards keep
black text. Generator errors have a bounded white panel rather than a white page.

Core's approved repair branch `fix/module-tool-backgrounds` supplies world artwork
→ optional module CSS color → current Core theme color (Core ADR0070). Shadowdark
leaves the optional color unset. This requires both repairs for artwork; the
module-only patch still exposes Core0.20.0's theme canvas. No API minimum bumped.

Checks from the Core toolchain:

- `npx tsx data/local/modules/shadowdark/src/tests/presentation.test.ts`: fails on
  the old importer canvas, passes after correction.
- `collection-consumers.browser.mjs /tmp/output --backgrounds-only`: seven pass,
  covering all three real tools at390/1280px, readable bestiary cards and generator
  collection failure. Set `SHADOWDARK_PLAYWRIGHT_MODULE`, `SHADOWDARK_CHROME`,
  `SHADOWDARK_CARD_TAILWIND` (compiled via Core `compileModuleTailwind`) and
  `SHADOWDARK_HOST_CSS` (Core globals compiled with its PostCSS/Tailwind toolchain).
  The first fixture omitted Core preflight and falsely reported mobile overflow;
  the corrected installed-style fixture passes. Screenshots use settled transitions.
- `module:check -- shadowdark --data-dir <isolated-data>` passes compatibility,
  typing, scoped CSS and logic/UI/server dry bundles with the updated Core copy.

Browser requests are blocked, data is synthetic and Foundry icons are not loaded.
This verifies backgrounds/layout, not live content or creation/import writes.
No task service remains; operator review, commit and release remain pending.

SD-UI13 follow-up: the user confirmed the inherited backgrounds but found long
pages enlarged the world image excessively. Core ADR0070 now anchors tool cover
sizing to the viewport instead of page height. The actual host browser check
fails before and passes after for short,5000px and scrolled content at390/1280px.
This follow-up changes Core hosting only; the module's transparent roots remain.

Final hosting adjustment: the user requested universal behavior and module
configuration. Core now uses one player-layout image loader and shared CSS, not a
tool-specific wrapper. SDK actorPage/tools hosts inherit it and accept the scoped
module fallback-color variable. Core browser checks cover dashboard, combat
access view, module sheet and a new page with no background code; route changes
do not create additional loaders. Shadowdark still leaves custom color unset.

SD-UI13 acceptance — 2026-10-22: the user verified the final shared background
behavior, including the universal Core/SDK host correction, and authorized this
local checkpoint. SD-UI13 is accepted. Remaining ADR0003 review is not implicitly
closed; publication, pushes and merges remain user-owned.


## SD-UI14–17 — Language totals, spell choices and rich-text metadata (2026-10-22)

User reports: Common/Rare headers lost numeric allowances for a mixed class pool;
first-level Priest creation rejected its spell choices and showed a fictitious
partial-advancement panel; spell management offered already-known spells again;
Cure Wounds exposed its inline-roll formula and `{Label}` as broken-looking text.
The user separately accepted Custom Boon and Add/Edit Effect styling (SD-UI08).
The changes below await operator retest; ADR0003 remains open.

| Finding | Confirmed cause | Correction |
| --- | --- | --- |
| SD-UI14 | `logic/languages.ts::languageInventorySections` returned a null limit whenever a class/ancestry choice crossed rarities. | Reuse `allocateLanguageInventory`, reserving the other category's selections before computing each capacity. Headers stay numeric; help explains the shared slot. Common2/2 and Rare1/1 become Common2/3 and Rare0/1 when the shared rare selection is removed. The same slot cannot be spent twice. |
| SD-UI15 | `ShadowdarkAdapter.getLevelUpData` considered only already-owned talent grants. `useLevelUp.handleConfirm` treated even the pure `new` preparation endpoint's rejection as a partial write. | Include exact planned first-level talent references when marking Turn Undead. Reject ordinary/granted overlap at final validation. Pure preparation errors remain editable. For existing Actors, a proven preflight rejection returns module-local `advancementWrites: "none"`; the client discards only that submission. Unknown/partial requests retain their identity and receipt recovery. |
| SD-UI16 | `SpellSelectionModal` checked capacity but not owned origins; `handleManageSpells` likewise omitted the duplicate-owned check. Advancement extra-spell choices also lacked an owned-origin exclusion. | `knownSpellSources` is shared by catalog preparation and final handlers. Known/granted rows stay visible but disabled, even with spare capacity. Ordinary and talent/boon extra choices cannot add the same owned origin. Save/finalize rechecks before writes. Existing duplicate copies, custom sources and distinct same-name origins are preserved. |
| SD-UI17 | `logic/description.ts` matched only the double-bracket roll and left its following label literal. `resolveFormula` could not parse the native deterministic parenthetical die count. | Shared labels/context-aware rendering across cards, inventory, talents and pickers. `derived.rollData` and card context use the same effective model as actions. The existing parser resolves deterministic parenthetical counts; missing context yields a readable label without an action and “Varies by character” for catalog facts. Original source HTML is untouched. |

### Text ownership and native source investigation

This screenshot contains Foundry inline enrichment syntax, not a Handlebars
component. Foundry14 `TextEditor._enrichInlineRolls` consumes the optional `{label}`
and `_createInlineRoll` uses it for display while keeping the roll formula separate.
The public [TextEditor API](https://foundryvtt.com/api/v14/classes/foundry.applications.ux.TextEditor.html)
describes HTML enrichment and its configuration; the [dice guide](https://foundryvtt.com/article/dice/)
describes inline rolls. Static local `temp/foundry-v14.mjs` SHA256:
`d34e6bc53a26f794b41b89b51e27c7a5c899318cf2632d2c8a6c39f8434afdfb`.

Native Shadowdark release4.0.6 at
`9677d16b3903b3b640f00d4efd48249142ac8334`:

- `data/packs/spells.db/cure_wounds__N9NvonT0RL6PyiiV.json` declares
  `(1 + (floor(@level.value/2)))d6` and the optional prose label.
- `system/src/documents/ActorSD.mjs::getRollData` starts with system data;
  `system/src/models/_ActorBaseSD.mjs::_modifyRollData` adds initiative context.
- `system/src/models/items/_BaseItemSD.mjs::render` invokes native TextEditor
  enrichment. SheetDelver does not invoke native browser code at runtime.

Core `src/shared/sdk/utils.ts::processHtmlContent` is a sanitizer/URL resolver,
not a generic template executor. Shadowdark's existing `logic/description.ts`
is the module-wide enrichment point; `ui/sheet-utils.ts::formatDescription` now
aliases it too. Source editors keep literal source for editing. Arbitrary
Handlebars/JavaScript, eager rolls and every other system's enrichers are outside
this implementation. A future SDK extraction could share syntax while accepting
explicit caller context and system enrichers; no new Core hook or dependency was
needed or added for this correction. No Core code changed.

### Verification and practical limits

Before/after regressions confirm: mixed headers returned null; the Priest's
Turn Undead was not marked granted; an already-owned source was accepted with
HTTP200 instead of rejected before writes; pure creation rejection exposed a
partial record with no request ID; native Cure Wounds' formula was unsupported.
All now pass with the same inputs. Additional cases cover legacy/current origin
stamps, spare-capacity disabled ordinary/granted rows, existing duplicate
preservation, shared-pool category switching, explicit no-write correction with a
fresh request ID, and preservation of real partial/uncertain recovery.

Toolchain: Core0.20.1 `bec6bcc5d2ad93693afe92726ab45aa93508357f`, local Node24.21.0.
Module base4525c9e; version0.9.6 and Core minimum0.20.0 remain unchanged.

Commands run from Core unless stated otherwise:

- All19 source suites listed in module `.github/workflows/ci-shadowdark.yaml`,
  invoked with `node --import tsx data/local/modules/shadowdark/src/tests/<suite>`:
  passed. This includes `boundaries`, `languages`, `native-parity`,
  `advancement-recovery`, `creation-validation`, and existing effect/action tests.
- `node data/local/modules/shadowdark/src/tests/verify-types.mjs`: passed explicit
  module/UI/migration typing; Core root typing alone is not this check.
- `collection-consumers.browser.mjs <output>`:56/56 passed. The existing focus
  transition assertion now waits for the React update to detach its checkbox;
  immediate locator counts were racing the scheduled render. Product focus code
  was unchanged. Background-only checks require their separate Core CSS fixture
  and were not repeated in this pass.
- `parity-corrections.browser.mjs <output>`:18/18 passed, including two new editable
  rejection cases alongside exact-ID and uncertain-write regressions.
- Browser tools used `SHADOWDARK_PLAYWRIGHT_MODULE` pointing to the existing isolated
  Playwright tool and `SHADOWDARK_CHROME=/usr/bin/google-chrome`; all page network
  requests were blocked. An extra SD-UI17 render using packaged Tailwind CSS was
  visually inspected: the native label appears once and Healing reads2d6 for the
  level3 fixture. This synthetic card is not native/operator acceptance.
- `npm run module:check -- shadowdark --data-dir <isolated-data>` and
  `npm run module:package -- shadowdark --data-dir <isolated-data>`: passed using
  a real disposable source copy and the existing Core toolchain. An initial
  symlink fixture failed migration-path confinement; using a real copy fixed the
  fixture without changing the guard or repository code.
- `node data/local/modules/shadowdark/src/tests/packaged-corrections.mjs
  --archive=<tgz> --out=<isolated-output> --core=<Core>`: all9 compiled-route checks
  passed against public SDK/testing, with no transports or services.

Tested archive SHA256:
`ff86ee53aea4c314980a3656d768d9aae610686a1421f1b3d2bcf26aab5db619`.
The archive contains final runtime changes; subsequent changes are documentation
and test screenshot capture only. No live Foundry connection/data write, retained
task service, version/dependency change, commit, push or release occurred.


## SD-UI16b — Missing fixed spell falsely labelled Known (2026-10-22)

**Superseded:** the manual Add/Save policy below was rejected by the user. SD-UI16c
implements automatic grant fulfillment; this section records the intermediate finding.

User review after SD-UI16 showed Cure Wounds as the only owned spell while the
catalog also disabled Turn Undead as Known. Cause confirmed in both
`ui/components/SpellSelectionModal.tsx` and `server/api/manage-spells.ts`: the
new duplicate guard unioned `grantedSpellSources` with `knownSpellSources`.
The former proves entitlement from an exact native talent, not an owned Spell.

Both layers now separate those facts. Known ordinary/granted Spell Items remain
disabled across all lists. An unowned fixed grant is labelled “Granted · missing
from character” and can be explicitly added and saved, including when ordinary
slots are full. Its addition does not consume an ordinary slot. Owner/source/
list/tier/filter/context checks and operation receipts remain in force. The saved
Item appears in the prepared owned list and casting actions; a repeat submission
reuses its receipt, while a fresh duplicate attempt is rejected before creation.
Creation/advancement planned grants say “Granted separately” instead of Known.
No Actor data was repaired or automatically changed during investigation.

The native-source regression reproduces the defect before correction: a Priest
with two ordinary tier1 spells plus the exact native Turn Undead talent receives
400 on adding its missing spell. After correction it receives one created Spell,
retains two ordinary spells, exposes an owned casting row and does not create again
on retry. Native4.0.6 provenance remains as recorded above. The shared picker
checks actual origins, with mounted Priest/Wizard/Witch list fixtures confirming
that ownership exclusion is not tied to the Priest name or list.

Verification for this follow-up: `native-parity.test.ts`,
`advancement-recovery.test.ts`, `creation-validation.test.ts`, explicit
`verify-types.mjs`, six mounted SD-UI16/16b cases and isolated `module:check`.
Mounted coverage includes missing-at-full-quota, explicit save payload,
missing-to-owned transition, and spare-capacity duplicate disabling.
This supplements rather than repeats the preceding full suite/archive record;
that archive predates SD-UI16b. Operator retest remains pending. No live Foundry
connections, version changes, Git mutations or release operations occurred.


## SD-UI16c — Granted spells belong in inventory automatically (2026-10-22)

The user rejected SD-UI16b's manual correction. Fixed grants now produce real
Spell Items automatically. Shared server resolution uses exact owned grant
origins and native Spell sources; creation/advancement include missing grants in
their original plans. Existing owner sheets use the dedicated automatic grant POST
then refresh real owned/action rows. Observers and GET views never write. Available
lists disable the fixed grant throughout, with no manual Add/Save instruction.
This is shared list behavior, not a Priest-name UI condition. Native4.0.6's verified
fixed mapping is the Turn Undead talent → Spell; other talent/boon spell choices
remain explicit choices and are protected from duplicate selection after ownership.

Grant receipts are keyed by world/Actor/source across callers. The existing Actor
queue serializes requests; unfinished advancement from any caller fences them.
Caller source access, source-review and world-context checks precede writes.
Unknown create outcomes or lost receipts never create a second copy. Complete
ownership does not poll/rewrite; failures have a visible bounded retry. Ordinary
spell slots and browsing source filters do not suppress fixed grants. There is no
world/bootstrap migration, bulk cleanup or source-name substitution.

Verification (offline fixtures and actual mounted hook/picker, not native acceptance):
- Native parity suite:26 checks, including full ordinary quota + automatic granted
  casting row, cross-owner concurrency, grants added after initial load, read-only
  view, observer/source denial, lost create response, receipt persistence failure,
  refusal/retry and another caller's unfinished advancement.
- Creation validation:10 checks; native Priest creation has two chosen ordinary
  spells plus exactly one automatic Turn Undead. Fixed grants cannot fill ordinary
  starting choices. Advancement/recovery:36 checks.
- Explicit module types and nine mounted SD-UI16/16b/16c checks pass. Mounted tests
  cover strict-effect deduplication, automatic refresh, failure/retry, observer
  behavior, missing→owned transition and duplicate protection on Priest/Wizard/Witch.
- Isolated module compilation checks manifest, CSS and logic/UI/server bundles.
  Its first disposable copy lacked toolchain dependencies; linking the existing
  toolchain into that disposable data root resolved fixture resolution errors.

No live Foundry writes, running task services, version changes, Git mutations or
release actions. Previous archive evidence predates this correction. User retest
should open the affected character: the granted spell should appear automatically
in Known spells and casting, with its available-list Add disabled.


### SD-UI16d — talent/boon choices, casting and Shune rounding

**User report:** fixed Turn Undead alone was too narrow. All native spell-granting
talents/boons need real Spell ownership and usable casting, including noncasters.
The user approved rounding Shune's half-level tier down with a minimum of 1 and
requested a SheetDelver-specific handling document.

**Finding and correction:** the old choice handler recognized names, retained only
one named list/one choice, imposed no source-specific tier rule and did not supply
casting permission. Repeated talent sources were collapsed, and chosen bonus
Spells lacked provenance for ordinary quota exclusion. Shared exact-source rules
now drive the picker and writer; an independent-choice matcher handles repeated
and mixed grants. Saved grant source/Class/acquisition-level metadata supplies
quota exemption and casting through the shared prepared model. Source effects
remain untouched. Additional casting permission never borrows an ordinary Class
progression table. Shune's explicit INT overrides another active casting list for
its saved grant; a generic grant retains the list whose tier made it eligible.

| Native source coverage | Handling |
| --- | --- |
| Turn Undead | Fixed automatic Spell, actual ownership, Priest casting permission |
| Learn a Wizard Spell (Shune) | Exact Wizard tier `max(1, floor(acquisitionLevel / 2))`, INT |
| Learn Wizard Spell | Wizard known/current progression tier, INT |
| Learn Witch Spell | Witch known/current progression tier, CHA |
| Learn Seer Spell | Seer known/current progression tier, WIS |
| Learn Extra Spell | Established list/tier; retain eligible casting Class |
| Magical Dabbler | Item-only permission remains; no normal Spell grant |
| Casting bonuses/advantage, Magic Missile Advantage, Learning Spells | No inferred Spell creation or casting grant; scroll learning remains separate |

All five Learn Spell templates in native4.0.6 are enumerated; the four named
choices are checked against actual native table references. The generic template
is also covered even though shipped tables do not directly select it. Exact IDs,
published-rule boundary and the approved interpretation are recorded in
[SheetDelver spell-grant handling](../rules/spell-grants.md).

**Verified offline:** native-parity32 checks, creation-validation12 checks,
advancement-recovery36 checks, action-phases13 checks, prepared-actor suite,
explicit module TypeScript, and11 mounted SD-UI16 consumer cases pass. The mounted
cases include actual `useLevelUp` plus bonus picker at levels3/5 with two separate
grants. Native fixtures are pinned4.0.6 at9677d16; the overlapping-list ability
and generic-tier cases use explicitly controlled custom fixtures. Isolated module
check passes manifest/compatibility, scoped Tailwind and logic/UI/server bundles.
These are module/source and controlled-browser checks, not new native acceptance.
Earlier full-suite/archive evidence predates this correction.

**Limits:** no existing custom/duplicate copies are deleted; no historical choice
is guessed or automatically created from a talent with an unknown selection.
Fixed automatic grants retain SD-UI16c's queue/ownership/context/receipt rules.
No live Foundry changes, Core edits, version changes, commit or release occurred.
Operator retest and the broader ADR review remain open.

### SD-UI18 — required talent choices and independent stat grants

**User report:** Wizard creation with Spellcasting Advantage returned HTTP500
because its target was never selected. The user requested review of other grants,
including +1 to two stats and +2 to a stat, across creation and advancement.

**Findings and corrections:** the effect resolver supported spell targets but
the workflow collected only weapon/armor selections. Warlock's distinct-stat
table flag became an unrestricted pool; multiple distribution grants reused one
aggregate allocation. Repeated fixed-stat source templates could be collapsed.
A native distribution RollTable could also fail subtype validation because source
RollTables do not have an Item `type`.

The picker and writer now collect and validate each target/allocation separately.
Pending spell advantage targets must be owned/planned Spells; the resolved Magic
Missile effect stays unchanged. Native stat effects retain their amounts; repeated
rolls remain separate grants. Warlock's two-stat restriction survives table
processing, while unrestricted distributions allow a two-point single-stat gain.
Distribution tables are recognized by document identity and become Talent effects.
Invalid choices return validation errors before writes. Existing receipts and
same-request recovery are retained. Rules are recorded in
[talent choice handling](../rules/talent-choices.md).

**Verified offline against native4.0.6 at9677d16:**

- Creation validation:18 cases, including all four native placeholder templates
  with both legacy and simulated modern effect representations, all twelve native
  fixed +1/+2 stat talents repeated twice, mixed distributions, nested distribution
  table selection, malformed allocations and final creation revalidation.
- Advancement/recovery:39 cases, including the four target talents, correctable
  zero-write failure, mixed stat grants, repeated +2 gains and idempotent replay.
- Native parity:32; native alignment:61; effect conformance:89; weapon rules pass.
- Full mounted consumer suite:67 cases pass. The two new cases exercise the real
  advancement hook, required spell target and changed spell availability, separate
  restricted/unrestricted stat pickers, completion gating and request payloads.
- Explicit module typing and isolated module check cover manifest/compatibility,
  scoped CSS and logic/UI/server bundles. Core remains unchanged.

The baseline reproduced the reported HTTP500. The expanded final test then caught
the RollTable subtype failure; both are corrected. These are controlled module
and browser checks, not native-client acceptance. Operator creation/advancement
retest and ADR review remain open. No live data, version or Git changes were made
by validation, and no historical choices were inferred or repaired.

### SD-UI19 — premature Destined reference warnings

**User report:** languages and text/formula formatting now look correct, but the
Effects tab reports missing `@bonus.destineddie` for Destined and Destined (Dmg)
while the active Destined Die effect supplies 6.

**Cause:** native4.0.6's Destined Item lists the two situational effects before
Destined Die, all with the same default priority. Initial phased application
records a missing reference; the later supplier makes it available to the roll
consumer, but the earlier warning persisted. The previous conformance fixture put
the supplier first and checked action damage, so it missed this false diagnostic.

**Correction:** supported roll-selector reference diagnostics use completed Actor
roll data after initial/final preparation. This preserves application order and
the canonical source formulas, and does not invent a die size. Genuine missing
values still attach diagnostics to the effect. The rule applies across supported
roll selectors, not just Destined. Actor-data field validation remains immediate.

**Evidence:** the native Destined Item and effects from pinned4.0.6 at9677d16 are
loaded in their stored order, tested as legacy and simulated v14 effect shapes.
Both cases reproduced the warning before the fix. Afterward all91 effect
conformance checks pass: selected stat/attack/spell bonuses and weapon/spell
damage use d6; an additional die upgrade yields d8; unselected situational bonuses
stay excluded; disabling the die supplier still reports the missing reference.
No source or live Foundry data is changed. Operator retest of SD-UI19 remains open.

Prepared-Actor parity, native alignment61/61, explicit module typing and isolated
module check (manifest, scoped CSS, logic/UI/server bundles) also pass. No Core
changes or version/Git operations were required.

### SD-UI20 — legacy scroll visibility and single-use retention

**User report/decision:** two scrolls appear under carried gear but not Spells
from items. Casting must mark a scroll spent without deleting it, leaving manual
discard and preventing reuse.

**Finding:** native4.0.6 Burning Hands and Hold Portal scrolls are `Basic` Items,
with one exact Spell link in their descriptions. The prior action/list paths
recognized only `Scroll` type and would delete a modern Scroll after casting.

**Correction:** shared exact-origin scroll handling feeds caller-bound dependency
reads, action preparation, spell rows, cards and inventory. Names alone never
establish scroll capability. Sources retain their types, descriptions and other
fields. The existing action prerequisite saves the spent flag before the result,
protecting against repeated requests, concurrency and uncertain responses. All
cast outcomes retain the Item. Manual discard remains; Potion/Wand behavior stays
unchanged. The flag is enforced by SheetDelver, not native Foundry's own UI.

**Verification:** three new real-handler cases reproduce missing actions on the
pre-fix disposable source copy. Corrected action-phases16/16 and boundaries55/55
pass. Coverage includes both actual native Basic sources plus a modern Scroll,
linked spell identity, source preservation, denied dependency reads, same-name
non-scroll exclusion, success/failure retention, completed replay, new-request
rejection, concurrent requests, refused/uncertain spending and uncertain results.
The mounted spell-list/inventory case confirms visibility, exact-ID card opening,
cast invocation, Spent labels and disabled casting after refresh. Explicit module
typing passes. This is controlled verification; user retest remains open.

The isolated module check also passes manifest/compatibility, scoped CSS and
logic/UI/server bundles. No live Foundry data, Core files or release versions changed.

#### SD-UI20 follow-up — inventory Add lost source identity

The user reported both scrolls still absent after the first correction. Inspection
found GearSelectionModal's Add callback copied only name/type/image/system,
discarding source metadata, effects and flags. The first fixtures used proper
owned copies and therefore did not reproduce that path. A revised test using the
historical Add payload fails before this follow-up.

Gear Add now uses `ownedCopy`. Existing source-less copies are recognized only
when Basic/magic classification and the complete native name/artwork/description
signature match one of the two known scrolls. Different names, artwork, missing
spell links or conflicting recorded origins are excluded. No provenance is
fabricated and no inventory repair is written. Modified/unrecognized Basic Items
remain ordinary gear.

Verification: action-phases16/16 passes with both historical source-less payloads,
their actual casting/spent persistence, and partial-match exclusions. Three mounted
checks cover the real Add callback's full data/source preservation and spell-list
visibility/spent state with and without origins. Explicit module typing passes.
The first user retest was unsuccessful; this follow-up still needs user confirmation.

Isolated module validation also passes manifest, scoped CSS and all three bundles.

### SD-UI21 — spellcasting mishaps and wand failure recovery

**User report / rule decision:** after verifying core rules p49, the user kept
spellcaster/list eligibility and identified missing critical-failure mishap rolls.
They clarified that wand failure disables casting until a full rest and critical
failure also breaks the wand. Scrolls remain spent after any attempt and retained
for manual discard (SD-UI20).

**Finding:** the shared action route applied spell loss/wand breakage but scheduled
no mishap. Native4.0.6 contains exact Wizard tables for tiers1–2,3–4,5; Witch and
Knight of St. Ydris talent descriptions call for separate Diabolical tables that
are not in those packs. Magical Dabbler explicitly calls for Wizard mishaps.
The primary rules text is also indexed in the [Player Quickstart, p55](https://studylib.net/doc/28229005/shadowdark-player-quickstart---digital).

**Correction:** preparation retains the selected casting Class identity and
attaches its supported mishap rule. After a confirmed critical failure and its
inventory consequences, the caller route reads the exact table and rolls its
formula through Core dice, then posts sanitized result text with the casting
speaker/visibility. The durable action receipt records the attempt/result;
completed and uncertain mishaps never repeat on retry. Missing/inaccessible
tables warn explicitly. A critical-failure wand is broken even when bonuses make
its numeric total pass; clearing lost entries does not clear broken. The module
does not add a separate rest command or automatically apply mishap prose effects.

**Verification:** a disposable copy with the previous no-mishap scheduling behavior
fails five new handler cases. Corrected action-phases22/22 and boundaries55/55
pass; the isolated module check passes manifest/CSS and logic/UI/server bundles.
Cases cover native tier tables, saved roll result, hidden roll mode/speaker,
spent scroll retention, wand failure/breakage, externally cleared rest state,
failed consequence retry, missing/uncertain results, failed result chat and
manual totals not establishing criticals. Policy tests exclude Wizard fallback
for Witch, Priest, Seer and custom classes and cover exact Magical Dabbler origin.
No live Foundry operations, Core modifications or version changes were made.

**Limits / remaining review:** user acceptance pending. Witch Diabolical tables
need an authoritative available source before automation; penance and custom
class rules are not guessed. Further rolls or effects instructed by table text
(such as Devastation) are presented for manual resolution, not automatically
executed. This is source/controlled-handler verification, not live play acceptance.

### SD-UI22 — legacy native wand presentation and casting

**User report:** Wand of Blind/Deafen displayed Weapon/Melee and missing-damage
errors with no casting action. SD-UI21 fixtures covered modern Wand Items only.

**Finding:** pinned native4.0.6 stores Blind/Deafen as Weapon and Unlife/Warding as
Basic. Their spell links are in descriptions. Historical Gear Add also discarded
origins. The modern Wand-only lookup/preparation path missed all three templates.

**Correction:** shared exact-origin or complete-signature recognition exposes the
actual caller-readable spells throughout cards, spell lists and actions; legacy
wands no longer offer melee attacks, damage errors or Equip. Stored Item types
are preserved. Modern state uses native fields; legacy loss/breakage uses module
flags supported by their schemas. Restore after rest clears loss on unbroken
wands only. Spell-list eligibility remains authoritative: Blind/Deafen is Priest,
not Wizard/Witch. Unlife/Warding curse descriptions remain for manual adjudication.

**Verification:** baseline fails the legacy card classification. Corrected action
suite25/25 covers all three templates with/without origins, actual success/failure/
critical handler writes, rest without repair, disabled noncaster actions,
inaccessible links, conflicting/partial identities and rejection of crafted
weapon attacks. Four mounted card checks cover origins and caster permissions,
actual Cast callback, failed-state restoration and broken-state lockout. Initial
browser assertions raced React updates; waiting for the existing settled helper
passes all four. These are functional mounted checks, not packaged-style visual
acceptance. Weapon rules, boundaries55/55, explicit typing and isolated module
check (manifest/CSS/all three bundles) pass. No live Foundry data, Core files or
release versions changed. User verification remains pending.

### Operator checkpoint — 2026-10-22

After SD-UI22 the user confirmed “verified working” and authorized committing the
current repair pass. The legacy wand flow is now user verified. Prior explicit
acceptance of languages, text/formulas and spell selection/level-up grants remains
recorded above. This does not assert exhaustive manual coverage of every mishap,
curse, class or historical data variant. The user has another item to address;
ADR0003 remains open. Version and compatibility metadata are unchanged.

### SD-UI23 — Bestiary under GM Tools

User requested GM Tools placement. The module declares `section: 'gm'` using
Core UI3.4.0 (ADR0071). Supporting hosts show it beside Combat Manager for GMs and
Assistants; general player Tools omits it. This is optional presentation metadata:
older supported Core ignores the field and keeps Bestiary in Tools. Structural
typing preserves compilation against the released SDK. Existing read permissions,
reference viewers, version/floors and workflow pins remain unchanged. Presentation
suite and explicit module typing pass; the Core fixture verifies GM/Assistant/
player placement and role changes. Operator verification remains pending.
