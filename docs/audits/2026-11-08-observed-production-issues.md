# November 8 production observations

Decision: [ADR-0012](../adr/0012-observed-creation-and-card-corrections.md).
Baseline: Shadowdark 1.0.0, branch starting at `e792c32`; reported host Core 0.22.3,
Foundry 14.367, native Shadowdark 4.0.6. Static source tests use native commit
`9677d16b3903b3b640f00d4efd48249142ac8334`. No live documents were read or changed.

## Findings and review checklist

| ID | Finding / correction | Accepted operator checklist |
|---|---|---|
| 24 | Optional Backstab accumulator was missing. Prepared default is zero; separate talent bonuses still stack. | Create a level-1 Thief; review must not report an unavailable Backstab formula. |
| 25 | Creator stripped HTML before rendering Foundry enrichers. Shared picker now shows readable labels. | Open Priest spell picker; Cure Wounds/Holy Weapon must contain no `[[...]]` or `@UUID[...]` markup. |
| 26 | Prepared Stout +2 was persisted as base and applied again. Later gains now use source HP. | Fresh Dwarf with total 5 HP, level-up roll 4: expect 9/9. No automatic correction of previously inflated HP. |
| 27 | Preset lookup matched the shared damage key without its operation. | Longsword +1 should show Weapon Attack Damage Bonus: Add 1; true multiplication retains its own label. |
| 28 | Older owned Spells have no Class reference. New message gives an explicit GM recovery step. | Read the warning; GM sets Class from original spell in Foundry, then verify casting. Binx was not inspected or repaired. |
| 30 | Shared card Type and weapon Type repeated. Weapon-specific fact is now Attack. | Card has Type: Weapon and Attack: Melee, Close. |
| M1 | Matrix found both Elf/Kobold options granted by level-1 Generator; its loaded choice list also was not committed to UI state; level-zero enrichment treated the whole pool as fixed. | Generate either ancestry with each alternative; exactly the selected talent must be owned. |

Observations already marked resolved were not reopened. Informational observation
16 and explicitly experimental D&D observation 17 remain outside this correction.
Observation 29 is tracked in Mörk Borg ADR-0003. The user confirmed the corrections on 2026-11-08. That operator acceptance is
separate from the isolated automated evidence below.

## Creation matrix

`src/tests/creator-matrix.test.ts` discovers the complete pinned Class and Ancestry
catalog. It includes 15 adventuring Classes, seven Ancestries, levels 1–10,
level-zero paths, both Elf and Kobold choices and all six Warlock patrons.

- **Creator: 1,809 paths**, real planner and final creation route.
- **Generator: 189 paths**, level-zero writer and level-one preparation/final
  writer, including native languages and exact ancestry choice validation.
- Before the Generator correction, **80/189** Generator cases failed because both
  alternatives were owned; all Creator paths passed after the Thief correction.
- Saved payload assertions cover class/ancestry/level, exact fixed grants,
  independent awards, spell counts/list identities, language choices, HP and
  absence of unresolved target placeholders. Original catalog remains unchanged.
- Missing, empty, excess, duplicate and foreign ancestry choices must fail before
  a write. This complements existing grant/source/permission/recovery suites.

The matrix uses deterministic eligible awards/spells and numeric input. It does
not enumerate the Cartesian product of every random table result, equipment,
ability roll or homebrew compendium. Generator level-zero enrichment and
level-one handler checks are not claims of exhaustive mounted UI execution.

## Regression evidence

`observed-issues.test.ts` fails on the baseline for Backstab, Stout, effect labels
and missing-Class guidance; the corrected source passes all six grouped checks.
Real Creator and advancement-handler regressions cover the reported Thief and
Dwarf scenarios. `native-alignment.test.ts` now distinguishes stored max 11 from
prepared max 13 in the effect-bearing HP example rather than expecting a double
application. Its intentional departure from the literal native writer is recorded
in the ADR. A synthetic fixed-ancestry mastery fixture now declares its native
`talentChoiceCount: 1` explicitly. The native-parity fixed-ancestry fixture
was likewise corrected from zero to one; an explicit zero-allowance assertion
now verifies no automatic grant. Native `CharacterGeneratorSD._loadAncestry`
(line516) is the independent fixed-versus-choice oracle.

Mounted Creator picker checks run at 390/1000px; Generator ancestry controls at
390/1000px. They reuse host styles and the module stylesheet. The source matrix
and focused regression suite are registered in module CI. Screenshots and machine
reports are local test artifacts, not dependencies of this record.

## Limits

No service startup, account changes, production cache mutation or character
migration. Historical lost spell provenance and already inflated HP need explicit
GM review. Required host/API versions remain unchanged; the accepted fixes are scheduled
for patch release 1.0.1.

## Final isolated results

The initial 25 source suites pass (including the creation matrix), plus module typing,
packaging and compiled Creator contracts. Packaged picker/Generator layout checks
pass6/6. Two additional mounted Generator checks complete real level-zero writes
and assert only the chosen Kobold talent is saved. Effect-label regression covers
both legacy numeric and Foundry14 string operations. Baseline picker tests fail
at both widths on raw inline-roll markup; the corrected picker passes.

| Class | Creator paths | Generator paths |
|---|---:|---:|
| Bard (Legacy) | 90 | 9 |
| Basilisk Warrior | 90 | 9 |
| Desert Rider | 90 | 9 |
| Fighter | 90 | 9 |
| Knight of St. Ydris | 90 | 9 |
| Level 0 | 9 | 9 |
| Pit Fighter | 90 | 9 |
| Priest | 90 | 9 |
| Ranger | 90 | 9 |
| Ras-Godai | 90 | 9 |
| Sea Wolf | 90 | 9 |
| Seer | 90 | 9 |
| Thief | 90 | 9 |
| Warlock | 540 | 54 |
| Witch | 90 | 9 |
| Wizard | 90 | 9 |

The 1,998 Actor writes in the matrix target in-memory fixtures only. No live
character was created by these tests. Operator acceptance was reported by the
user on 2026-11-08.

## Sequential progression extension

Requested after the creation matrix: advance the same character rather than
creating fresh characters directly at each level. `progression-matrix.test.ts`
starts from a level-zero Creator result, then calls the actual level-up review,
HP-roll and finalization routes against isolated SDK document/receipt storage.
It is the 26th registered source suite; no additional runtime fix was needed.

**234 journeys / 2,340 successful level-ups / 2,340 zero-write replays.**
All 15 adventuring Classes and 7 Ancestries are covered, including both Elf/Kobold
choices and all 6 Warlock patrons. Warlock adds two alternating talent/boon paths
(talent-first and boon-first); this is branch coverage, not every possible award
or mixture. Each journey reaches level 10 without replacing the Actor.

Independent expectations come from the pinned native source's per-level spell
counts, Class hit die, ancestry effects and selected awards. Every transition
checks:

- Exact spell allowance increments, cumulative ownership and known-spell flags.
- Independent talent/boon source identity and level acquired; fixed grants remain.
- Exclusive ancestry selection retained from level 0 without resubmitting it.
- Class HP dice, Dwarf advantage, first-level CON, later base gains and one-time
  permanent HP bonuses; wounds remain after later gains.
- XP threshold subtraction/carryover, class/ancestry identity and language pools.
- Existing owned Item IDs/data, lost spells, spent class-ability uses, coins,
  notes and custom flags preserved.
- Completed request replay makes no Item or Actor write and changes no source.

Negative coverage: **234 skipped-level rejections**, **387 known-spell
rejections**, and **702 cap rejections** (finalize, review and HP-roll at level 10).
Rejected requests preserve Actor state and make no writes; capped rolls do not
invoke the dice service. The level-up sheet indicator is disabled at 10. The
compendium fixture remains unchanged throughout. Explicit module/UI/test typing
also passes using `verify-types.mjs` (Core's root typing alone excludes modules).

Optional `SHADOWDARK_PROGRESSION_REPORT` writes the per-journey JSON report.
No live Foundry services, browser acceptance or production mutations are implied.

## Closeout

- [x] Selected observations 24–28 and 30 accepted by the user.
- [x] Ancestry choice and sequential progression coverage completed.
- [x] User verification reported; patch release authorized on 2026-11-08.

Observation 28 supplies recovery guidance, not automatic legacy spell repair.
Previously inflated HP likewise remains a GM correction.
