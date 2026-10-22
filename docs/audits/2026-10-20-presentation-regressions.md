# Shadowdark presentation regression review

Date: 2026-10-20. Active scope: [ADR-0003](../adr/0003-preserve-module-presentation.md).

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
