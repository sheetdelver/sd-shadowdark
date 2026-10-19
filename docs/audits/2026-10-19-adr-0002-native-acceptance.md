# ADR-0002 native acceptance — October 19, 2026

**Current disposition:** The selected A02-01–15 matrix passes on native 13.351
and 14.367 with Shadowdark 4.0.6 and isolated Core 0.19.3. D6/final D7 and
ADR-0002 are complete within their selected scope. See [final v13 closeout](#v13-completion-and-final-closeout--october-19-2026)
for evidence, the small recovery-layout correction, archive qualification and
cleanup. Release preparation/publication remains separate. Earlier partial
results below are historical. This report supports the
[completed audit](2026-10-18-spellcasting-and-native-parity.md).

## Identity and authority

The user authorized local v14 testing and will switch to v13 when ready. The
existing disposable-fixture/account/setting/cleanup scope was used. Read-only
status and a native login independently established Foundry **14.367**, world
`shadowdark-test`, Shadowdark **4.0.6**, and a passwordless full-GM account.
Seven disposable accounts separated the service GM, native-browser GM, player,
observer, limited, inaccessible and assistant roles. Only `SD02-pOeaCc` fixtures
and recorded temporary settings were written.

| Artifact | Observed identity |
| --- | --- |
| Module source | `fix/adr-0002-native-parity`, `032e824f491cf67fef601d3fd4b4f74173aac585` |
| Installed archive | Module 0.9.5, 274985 bytes; SHA256 `3aeccbb0c3924e32043be2f065d6248fac29e2081521a01a55608625a8bdd56f` |
| Core | Actual isolated Core 0.19.3, source `90c13e5e57d88913cd3bae6bf6b9e6f0b995bad1` |
| Native static reference | Released 4.0.6, `9677d16b3903b3b640f00d4efd48249142ac8334` |
| Native running system | Browser `game.version`, `game.system.version`, world identity and real source reads matched 14.367/4.0.6/`shadowdark-test` |

Normal checks used the unchanged installed archive and original Core runtime.
Recovery fault checks temporarily wrapped the **copied test Core's** public
request runtime. Actual native reads/writes still allocated real IDs and passed
through Core; controlled faults represented pre-dispatch refusal, lost create or
Actor acknowledgements, failed primary reads, receipt persistence denial,
result loss, and individual effect/delete refusal. The module archive was never
modified. The original Core copy was restored before supervisor-restart recovery
and restored-world tests. These are native-backed fault-injection tests, not a
claim that the network or disk failed spontaneously. Neither product repository
nor the native reference received source edits.

## Executed evidence

| A02 coverage | Observed v14 result |
| --- | --- |
| 01–02: casting/data | Fourteen actual native-browser vs installed-view comparisons pass: Wizard, Priest, Witch, Seer, Knight, missing/disabled/mismatched grants, empty Class refs, source-less Priest, duplicate/source-less owned spells, item-only/multiple grants, and exact world Class. One minimal exact-source missing-grant repair on a copy preserves pre-existing system/items. No class-name inference was introduced. |
| 03: progression/import | Native `LevelUpSD` and module Knight 2→3 both preserve XP 35→15 and HP 8→11, with one Witch-list tier 1 Spell. Missing/duplicate choices write nothing; exact request replay creates nothing further. Native-created Item IDs were compared. An imported Knight has the native fixed Witch casting grant and correct list. |
| 04–05: ownership/validation | Owned IDs remain distinct in native/installed views. Public management no-op, exact addition/removal, duplicate-input rejection, replay, invalid list/tier and stale baseline checks pass. Final Wizard creation rejects omitted/duplicated/altered spell arrays and stale plans before Actor creation; a valid exact plan produces three native owned Spells and the reviewed languages. |
| 06: mounted invalidation | Actual open picker retains search and clears intent after same-Class level change. Source filtering preserves owned spells. Ownership-only revoke/restore removes/refetches private choices. A held successful pre-revocation response cannot repopulate them. Browser transport loss/reconnect recovers. |
| 07: advancement recovery | Independent GM XP/notes edit between plan persistence and first dispatch retires the zero-write request; fresh advancement yields level 3 / XP 16 / HP 11 and preserves the edit. Known refusal retires without writes. Receipt/read failures retain acknowledged IDs. Lost-create and final-patch acknowledgements reconcile exact native source without duplicate creation. Wrong owned IDs and replacement attempts are rejected. Restart retains receipts, and explicit reviewed continuation completes with the same Item. **Reload after final Actor patch exposes SD02-N14-01.** |
| 07: other operations | A native Spell create followed by lost acknowledgement leaves removal pending; same-request replay and supervisor restart do not create/delete again. Ability result loss preserves its spent use and one native message; restart returns review-required without another result. |
| 08: authorization | Exact world Class projection works. OWNER operations pass; OBSERVER read succeeds/write 403; LIMITED/NONE caller-view and action requests return 404 without source changes. |
| 09: installed UI | 360/768/1024/1440, light/dark: all eight combinations pass paper/card/shared roller, tabbed spells, management picker, nested catalog card, keyboard containment/Escape/focus return, footer reachability and horizontal bounds. Cancelled interactions leave source unchanged. Recovery entry after final-patch/reload fails on both sheets. |
| 10: archive/migrations | Both required steps remain. Initial review contains exactly eight fixture effects across Actor/Item/delta/world packs. Full-source oracle matches after approval; regular supervisor restart is a no-op. Native default-unlocked world packs work without fabricated overrides. Explicit pack lock gates required scope with no writes. Restoring one legacy fixture effect requires a new approval; old approval 409, exactly one fresh correction, full-source oracle matches. |
| 11: abilities | Actual native no-check ability spends before chat; installed behavior agrees. Last/zero use, replay and two distinct concurrent last-use requests produce one result. Controlled native result loss retains spend and never rerolls. |
| 12: Potions | Actual native and installed execution both identify/swap fields, enable effects, post, then delete the owned Item despite quantity 5. Native hook observations and source before deletion agree. One refused effect prevents result/delete while other effects retain their outcomes; retry completes. Refused deletion retains identified fields/unknown flags and retries without another swap or post. |
| 13: outcomes | Player focus avoids loss; ordinary failure loses the Spell; a lost Spell is blocked. Actual native NPC focus still loses a failed Spell. Native Scroll consumption and installed Scroll/Wand consequences pass; manual numeric failure does not invent a natural critical. Actual native RollSD reconstruction compares nine natural/total cases plus three zero/custom threshold cases. |
| 14: languages | Actual `CharacterGeneratorSD` agrees on explicit-zero and separate class/rare pool counts and fixed grants, including custom-named common/rare world Languages. Valid creation retains exact selected languages. |
| 15: full model controls | Actual native documents/models vs installed caller view: 69 physical slot values, 31 default weapon grips/dice, 9 armor combinations, 4 mixed coin/free-carry/stash inventories. No controlled replacement of these native preparation methods. |

The table records the executed subcases, not blanket closure of every variant
in the longer [run sheet](../native-parity-acceptance.md). Remaining v14 variants
include same-Class **table/list** replacement while an operation is pending,
caller/role switches, exact embedded/denied Class dependencies, several final
creation extra/granted-spell and language-pool tamper variants, and complete
checked/cancelled action variants. Retain their existing offline evidence and
finish the selected native variants after the blocker correction, before the
v13 switch. All native v13 rows remain open. D6/final D7 and ADR-0002 remain open.

## Confirmed blocker and secondary observation

SD02-N14-01 is a module presentation/lifecycle omission. A real final Actor patch
committed level 3 / XP 15 / HP 11 and one confirmed Spell. The controlled lost patch
acknowledgement retained an uncertain final receipt. After real Core restart,
`level-up/data` still returned the partial saved operation, but the paper and
tabbed sheets exposed no advancement/recovery button because XP 15 is below 30.
The source and exact-ID recovery backend remained correct. See the active audit
and ADR addendum for the actionable correction; no new Core permission or SDK
contract is established.

A malformed test request containing bare UUID strings in `selectedSpells`
(the supported client sends `{ uuid }` entries) returned 500 for “no source
reference.” Valid-shaped invalid choices returned 400 before writes. This is
SD02-N14-02, a secondary input-validation classification defect, not a failed
valid advancement or evidence of a native write failure.

## Evidence qualifications and cleanup

Local harnesses: `temp/native-a02-v14/`. Private run artifacts:
`/tmp/sd-a02-native14-pOeaCc/`, including `acceptance.json`, `operations.json`,
`native-matrix.json`, `action-parity.json`, `languages-import.json`,
`recovery-native.json`, `recovery-final-patch.json`, `operation-faults.json`,
`restart-recovery.json`, `restart-verification.json`, `restored-world.json`,
`migration-results.json`, `ui/`, `refresh-ui/`, and the fixture ledger.
This tracked report contains the decisions and reproduction without those files.

Harness mistakes were corrected rather than reported as product failures:
initial request shapes/review token, unchanged-setting interception, NPC bonus
schema/explicit test DC, Potion chat attribution, and screenshot loader readiness.
A replacement after the final Actor patch correctly rejected with 400 rather than
409; its corrected final-patch test passes. The restart script explicitly POSTed
continuation after UI reconciliation, then incorrectly expected the Actor to
remain level 2; independent native verification confirms the correct final
level 3 / XP 15 / HP 11 with the original one added Item. `restart-verification.json` records
that qualification. Neither issue supersedes the independently reproduced
missing recovery entry. Raw failed attempts remain available.

All ledgered fixture documents, seven users and two world packs were removed;
temporary settings were restored. A native welcome message was independently
identified by its disposable native-GM author, added to the ledger, then removed.
Final comparison: original 9 Actors, 0 world Items, 2 Scenes, 4 Users, original pack
membership, selected settings and all 45 original ChatMessage IDs; **zero source
differences** (transport `_stats` excluded). Task-owned Core/Next/browser processes
stopped; the operator's original Foundry PID 3644622 remains on 30000. No commit,
branch/remote operation, version change or release occurred in this pass.

## Automatic completion correction and native recheck

The user chose automatic authoritative resolution of fully applied advancement.
The final candidate settles that receipt on sheet refresh, operation reload or
retry, including after restart. It uses the saved final source token and exact
confirmed owned IDs; it never repeats native writes or infers unknown Item IDs.
Partial or mismatching source remains blocked. The common projection exposes
only the original authorized caller's pending indicator, and both sheets can
open unresolved review independently of XP. Saved review bypasses new-level
Class/Patron preparation and uses the saved target. Malformed grant selections
now return validation 400 before writes. This is module-only work.

| Final corrected artifact | Identity |
| --- | --- |
| Module | 0.9.5, working changes on `fix/adr-0002-native-parity` above checkpoint `032e824f` |
| Archive | 276056 bytes, SHA-256 `7f193292d1e7e0213b922199f7795ec57afb51e235a4bee70136582d72a85469` |
| Local archive | `temp/n14-auto-completion/package-data/dist/modules/shadowdark-0.9.5.tgz` |
| Native endpoint | Foundry 14.367, world `shadowdark-test`, Shadowdark 4.0.6 |
| Host | Isolated actual Core 0.19.3; product Core and native reference clean |
| Final run | Namespace `SD02-NwFSwJ`; artifacts `/tmp/sd-a02-native14-NwFSwJ/` |

All six targeted native groups pass:

1. Native level 2 / XP 35 / HP 8 advances to level 3 / XP 15 / HP 11 with one
   exact allocated Spell. Controlled lost final acknowledgement returns partial;
   fresh owner projection verifies complete source and closes the receipt.
   Same-request replay returns complete with the exact same source/Item ID.
2. A real native create with its acknowledgement discarded remains uncertain;
   projection/retry preserves the block without another create or final patch.
3. A separate final-patch fixture receives an independent notes edit. The complete
   source no longer matches; automatic completion refuses and preserves the edit.
4. Bare-string selected Spell input returns HTTP 400 and leaves native source
   unchanged.
5. Another final-patch receipt survives actual supervisor stop/restart. The
   uninstrumented restarted Core and fresh installed sheet settle it without
   player recovery; replay and independent native source compare confirm no
   extra changes. Both sheets show ordinary completed level/XP/HP data.
6. Both installed layouts open **Review advancement** for the unresolved native
   create. The exact-ID input accepts text and review checkbox is interactive;
   the original request/target remains, with no source changes from viewing.

The final installed UI checks used 1440×900 with the active dark host theme.
This is targeted correction evidence; the broader eight-width/theme-combination
record above belongs to the previous archive. No claim of a repeated full visual
matrix or completed A02-01–15 follows from these six groups.

Offline evidence: all 17 source suites, 35 advancement handler groups, 16 mounted
corrective cases, five existing Actor lifecycle cases, explicit typing on
Core 0.19.2/0.19.3, module checking/packaging and nine compiled public-route cases
per Core version pass. Five new handler groups and two mounted cases failed
against the original implementation. The new mounted real-modal test keeps
Class lookup unresolved and verifies that saved review remains interactive;
a separate case closes an already-settled review without submitting a new plan.
Evidence is retained under `temp/n14-auto-completion/`.

Harness qualifications: an initial isolated source symlink was correctly refused
by migration packaging confinement; packaging was rerun from a physical source
copy. A test-only import outside the copied Core's ESM package prevented its
first startup; relocating it inside the copied workspace corrected the harness.
No product Core change was made. First native screenshots caught an unrelated
Class-loading overlay; the final modal correction and mounted held-Class case
now verify actual interactive controls. The final native run used the final
archive above and the corrected harness. Faults remained explicit test-only
wrappers over real native writes; the wrapper was removed before restart.

Both correction runs were cleaned independently. The final run removed its five
fixture Actors and two users. Original 9 Actors, 0 world Items, 2 Scenes, 4 Users,
pack membership, selected settings and all 45 ChatMessage IDs matched; zero
source differences excluding transport `_stats`. `cleanup.json` records success.
All task-owned services stopped; operator Foundry remains running on 30000.
No commit, remote write, release, version or compatibility change occurred.
Remaining broader v14 cases listed above and all v13 acceptance remain open.

## V14 completion checkpoint — October 19, 2026

The user authorized the correction checkpoint and continuation. Commit
`b962bf0` preserves the automatic-completion implementation, regressions and
preceding native review. This continuation changed no product source, versions,
compatibility requirements, applied migration history or Core files.

The final **0.9.5** archive is unchanged: **276056 bytes**, SHA-256
`7f193292d1e7e0213b922199f7795ec57afb51e235a4bee70136582d72a85469`.
It ran as a managed install in isolated actual **Core 0.19.3**
(`90c13e5e57d88913cd3bae6bf6b9e6f0b995bad1`) against **Foundry 14.367**,
world **shadowdark-test**, native **Shadowdark 4.0.6**. The read-only native
reference remains `9677d16b3903b3b640f00d4efd48249142ac8334`.
The existing full-GM/disposable fixture/account/setting/cleanup authority applied.
Native browser, service and player accounts were separate.

| Row | Final v14 evidence | v13 |
| --- | --- | --- |
| A02-01 | Pass. Missing casting Talent, empty Spell Class references and altered Knight casting effect repaired only on copies using exact native sources. Independent source comparisons preserve unrelated fields. Source-less Priest remains usable. | Pending |
| A02-02 | Pass. Fourteen native-browser/installed-view casting controls repeated, covering stock casters, absent/disabled/wrong grants, item-only and multiple grants. NPC controls pass. Actual v14 serialized effects were read directly; legacy-shape offline evidence is not v13 acceptance. | Pending |
| A02-03 | Pass. Actual native Knight 2→3 and installed module agree on XP35→15, HP8→11 and one exact Witch-list tier1 Spell. Valid creation/import and exact request replay pass. The six-group automatic-completion native record above remains applicable to this identical archive. | Pending |
| A02-04 | Pass. Eight owned variants retain distinct Actor+Item IDs in both installed layouts: duplicate origin, same name/different exact source, renamed, source-less/custom, missing source, lost and an additional exact Spell. A separate Priest fixture verifies granted classification and protected removal. Cancel/unchanged save preserve source, including excess inventory. | Pending |
| A02-05 | Pass. Invalid counts, duplicates, tier/list, stale plans and unsupported extra selections make no native writes. Valid exact-list selections independently prove numeric0 and native null both mean zero; an additional grant with no progression owner is unavailable. No invented unlimited quota. | Pending |
| A02-06 | Pass. Open picker refresh after level/table/list changes, including an intercepted pending save, clears unsafe new intent but preserves search and the original submitted request/list/receipt. Ownership-only revoke/restore, held pre-revocation response, source filters, transport reconnect, role4→1 demotion and OWNER→NONE caller switch retire private data. | Pending |
| A02-07 | Pass. Existing native advancement zero-write/acknowledgement/restart evidence remains, including the corrected archive's complete/partial distinction. Additional native Spell replacement tests independently refuse addition and removal: old owned Item survives until confirmed, exact retry completes once, terminal replay is unchanged. Lost-create/result receipts survive actual Core restart without repeating writes/results. | Pending |
| A02-08 | Pass. Exact world and Actor-embedded Class references, declared compendium identities and same-name decoys tested. Revoking the embedded parent removes casting eligibility; restoration returns it. OWNER succeeds, OBSERVER reads/write403, LIMITED/NONE404, denied dependencies do not fall back to copied origins or same-name documents. | Pending |
| A02-09 | Pass. Final archive at360/768/1024/1440, both themes and both layouts. Screenshots inspected for sheet/card/picker/shared roller, keyboard containment/Escape/focus return, nested cleanup, footer reachability and horizontal bounds. Both layouts also show all eight owned variants. | Pending |
| A02-10 | Pass. Final archive performs eight native migration writes with an independent whole-source oracle; restart is a no-op. Explicit world-pack lock blocks required scope. Restored legacy data requires a new approval; stale approval409, exact one-write repair and source comparison pass. Creation/import/actions use the same archive. | Pending |
| A02-11 | Pass. Checked/no-check native ability comparison, last/zero use, concurrent last-use and replay. Native and installed cancellation make no source/message changes. Controlled prerequisite refusal/uncertainty produces no result; result failure retains spending; refused loss consequence retries without another result. | Pending |
| A02-12 | Pass. Native Potion identification/effect/chat/delete behavior repeated, including distinct active/alternate text, stack quantity5, preserved unknown fields and complete effect group. Identification refusal with empty alternate name, effect refusal and deletion refusal exercise surviving source and exact retry. Native/installed cancellation changes nothing. | Pending |
| A02-13 | Pass. Player focus, ordinary failure/loss, NPC focus, Scroll consumption, Wand failure and manual-total behavior repeated. Actual native RollSD comparisons include zero/custom thresholds; manual totals do not invent natural criticals. | Pending |
| A02-14 | Pass. Native Generator explicit-zero/custom-rarity/separate pools and fixed grants repeated. Duplicate cross-pool, wrong-rarity/denied refs and invalid final choices reject before creation. Ordinary mounted editor permits additions without creation quotas, retains custom/unavailable entries and makes no writes for cancel/unchanged save. | Pending |
| A02-15 | Pass. Actual native69-slot/31-weapon/9-armor/4-inventory/9-outcome comparisons repeated; three zero/custom threshold controls also pass. Existing unsupported-scope labels and F01–F06 deferrals remain. | Pending |

This is acceptance of the selected ADR scenarios, not a guarantee that every
custom world or future native version is supported. No new module/Core defect
was confirmed by the completion pass. Core0.19.2 compatibility retains its
recorded offline/compiled checks; this native execution uses Core0.19.3.

### Evidence and qualifications

Broad final run: `/tmp/sd-a02-native14-jpRgh0/`. Its `completion-summary.json`
indexes `acceptance`, `operations`, `languages-import`, `action-parity`,
`native-matrix`, `completion-data`, `completion-embedded`, `completion-quotas`,
`completion-actions`, `completion-cancellation`, `completion-faults`,
`operation-faults`, `completion-restart`, `completion-owned-ui`,
`migration-results`, `restored-world`, `ui/`, `refresh-ui/` and `completion-ui/`.
Additional native replacement-refusal run: `/tmp/sd-a02-native14-UVtCJB/`,
`replacement-refusals.json` and `cleanup.json`. The earlier identical-archive
six-group automatic-completion run remains `/tmp/sd-a02-native14-NwFSwJ/`.
Local harnesses are in `temp/native-a02-v14/` and
`temp/n14-auto-completion/refused-removal-native.ts`. This tracked report supplies
the scenarios, expected outcomes and identities without depending on those files.

Fault tests wrap only explicit fixture requests in a copied test Core, delegating
actual native writes and ID allocation. Original copied Core was restored before
restart/recovery and restored-world tests. No product Core/runtime or module
archive was patched. The checked ability comparison records the native result and surviving source.
Requesting a1d1 base is not proof that native preparation retained that override;
the native roll generator can replace it. This evidence establishes spend/loss
ordering and surviving state, not identical roll totals. Separate native RollSD
controls establish outcome parity. Faults do not establish production failure
frequency.

Harness errors remain distinguished from product results. An initial launch used
the previous archive; that run (`71RikU`) was stopped and cleaned before the final
archive's fresh run. Later retries corrected native event timing, explicitly
cleared ownership entries (Foundry merges permission updates), used the actual
`advanced` view mode and actual Close/Cancel/Drink controls. Failed raw entries
are superseded only by their named passing reruns, not erased or counted as passes.
The inspected native Priest template has no `startingSpells` declaration; its two
ordinary choices and fixed Talents were preserved without inventing a third
owned Spell. Exact granted-Spell classification and exclusion from ordinary
quotas were tested separately.

### Cleanup and next gate

All broad-run fixtures, seven accounts and two world packs were removed; all
recorded temporary settings/permissions were restored. A native welcome message
was independently attributed to the disposable native-GM account, recorded, then
removed. The final replacement-refusal run's seven Actors and two accounts were
also removed. Each completed run independently matches the original **9 Actors,
0 world Items, 2 Scenes, 4 Users**, original pack membership, selected settings and
**45 ChatMessage IDs**, with **zero source differences** excluding transport
`_stats`. All task Core/Next/browser services stopped. Operator Foundry remains
running on30000; Core and native reference worktrees remain clean.

The v14 side of N14-C6/D6/final D7 is now satisfied. **v13 A02-01–15 remains
pending**, so ADR-0002 and release remain open. The next step is the user's switch
to the disposable v13 instance, then the corresponding native matrix and final
closeout. Do not reopen completed v14 variants solely because older paragraphs
above or in the run sheet still describe them as pending.

## V13 completion and final closeout — October 19, 2026

The user switched the previously authorized disposable instance to Foundry
**13.351**, world **`sd-adr61-v13`**, Shadowdark **4.0.6**. Read-only status,
full-GM login and actual browser identity confirmed those values. The starting
world had0 Actors,0 world Items,0 Scenes,1 User and no world packs. The seven
fixture accounts again separated native GM, Core service GM and caller roles.
Native pre-generated characters and exact release4.0.6 pack documents supplied
the fixtures; no operator characters or v14 serialized Actors were reused.
The native Talent source directly exposed **`effect.changes` with numeric mode**,
including the Wizard grant's mode2 entry. V13 fixtures and independent source
oracles use that format; the retained v14 run uses its observed
`effect.system.changes`/string-type format.

Core remained0.19.3 at `90c13e5e57d88913cd3bae6bf6b9e6f0b995bad1`;
native static source remained4.0.6 at `9677d16b3903b3b640f00d4efd48249142ac8334`.
The broad matrix used the276056-byte candidate from checkpoint `b962bf0`,
SHA256 `7f193292d1e7e0213b922199f7795ec57afb51e235a4bee70136582d72a85469`,
already accepted on v14. Product source started at documentation checkpoint
`3637c8b`. The only later product edit is the presentation correction below.

| Row | V13 result and independent evidence | V14 disposition |
| --- | --- | --- |
| A02-01 | Pass. Native/installed missing, empty and altered-grant diagnosis; three exact minimal repairs preserve all unrelated fixture source; complete source-less Priest works. | Prior pass retained. |
| A02-02 | Pass. Fourteen native prepared casting comparisons cover stock classes, Knight's alternate list, missing/disabled/wrong grants, item-only/multiple grants, owned duplicates and exact world Class. NPC controls are separate. | Prior pass retained. |
| A02-03 | Pass. Native `LevelUpSD` and installed Knight2→3 agree on Witch tier1 choice, XP35→15 and HP8→11. Exact creation/import, required grants and invalid-choice zero writes pass. | Prior pass retained. |
| A02-04 | Pass. Eight owned variants retain distinct embedded IDs in both layouts/cards. Same-name/different-source, duplicate origin, renamed/custom/missing/lost/granted handling, cancellation and unchanged save preserve source. | Prior pass retained. |
| A02-05 | Pass. Positive/zero/unavailable limits, wrong list/tier, duplicate/final-body tampering, extra/fixed Spell separation, stale baseline and required language choices reject before invalid writes. | Prior pass retained. |
| A02-06 | Pass. Mounted level/table/list replacement, pending original-receipt preservation, source filters, ownership-only denial/restoration, held old response, caller/role change and transport reconnect retire unsafe data/intent while preserving authorized search. | Prior pass retained. |
| A02-07 | Pass. Refused additions/removals, lost acknowledgements, duplicate/concurrent requests and independent GM edits retain exact surviving native source. Zero-write attempts retire; acknowledged Item IDs survive receipt/read failure. Real restart retains uncertainty without duplicate creation; exact-ID reconciliation alone writes nothing, followed by one reviewed completion. Exact final source auto-completes without a player recovery step; unknown IDs or changed source stay fenced. | Prior pass retained. |
| A02-08 | Pass. Exact world/embedded Class and Spell refs, denied parent, same-name decoy and known-pack reads. OWNER succeeds, OBSERVER reads/write403, LIMITED/NONE404 concealment; warmed private catalog content retires. | Prior pass retained. |
| A02-09 | Pass. Installed sheets, picker, cards and shared roller at360/768/1024/1440 in both themes; Tab/Shift-Tab, Escape/focus return, nested cleanup, reachable footer and no horizontal overflow. Recovery styling additionally passes16 width/theme/layout cases after correction. | Prior matrix retained; final recovery styling checked on v13 as described below. |
| A02-10 | Pass. Same archive supports creation/import/management/actions. Eight native migration effects match a literal-key whole-source oracle; real restart is a no-op. Explicit pack lock gates required scope with no writes. Restored legacy data needs fresh approval, rejects old approval409 and completes exactly one verified correction. | Prior pass retained. |
| A02-11 | Pass. Actual checked/no-check native ability ordering, last/zero/concurrent use, cancellation, refused/uncertain spending, result loss and refused loss consequence. Confirmed spend survives failure; result/receipt replay and restart do not roll/post twice. | Prior pass retained. |
| A02-12 | Pass. Native Potion swap/effect/chat/delete sequence, distinct alternate text, stack5 and unknown fields. Identification with empty alternate name, grouped effect and deletion refusals preserve surviving source and retry without repeated swap/chat; cancellation writes nothing. | Prior pass retained. |
| A02-13 | Pass. Player/NPC focus distinction, Spell failure, Scroll consumption and Wand failure; manual totals do not invent natural criticals. Actual native RollSD verifies ordinary and zero/custom thresholds. | Prior pass retained. |
| A02-14 | Pass. Native Generator custom-rarity, explicit-zero and separate pools; duplicate/denied/wrong-pool creation refusal. Ordinary mounted editing preserves extras, has no creation quota, and cancel/no-op changes nothing. | Prior pass retained. |
| A02-15 | Pass. Actual native69 slot records,31 weapon grips/dice,9 armor combinations,4 inventories and9 ordinary outcomes, plus3 zero/custom threshold controls. | Prior pass retained. |

### SD02-N13-01: recovery controls lacked visible separation — corrected

Final screenshot review found that recovery inputs and buttons had no explicit
control styles, so labels, values and actions ran together. Functional receipts
were correct, but the presentation was unclear. Only
`src/ui/components/levelup/AdvancementRecovery.tsx` changed: bounded full-width
fields, spaced action groups/checkbox labels, visible button borders and disabled/
focus states, and long-text wrapping. No request, state transition, permission or
native-write logic changed. The previous archive fails the visible-field check;
the corrected installed archive passes all16 combinations of two layouts, four
widths and two themes, including expanded restoration controls, reachable actions,
review gating and unchanged native source. Representative normal/expanded captures
were visually inspected. Existing16 corrective mounted cases and explicit module/
UI/hook typing pass; module checks and isolated packaging pass.

Verified UI candidate: **276276 bytes**, SHA256
`71ffccb44cdb294f6ac515e31d887c13bfde120fe70dd3a38e58d0433ef28dda`, at
`temp/n13-recovery-layout/package-data/dist/modules/shadowdark-0.9.5.tgz`.
A member-by-member comparison against the broad native candidate shows exactly
two changes: `dist/ui.js` and `assets/shadowdark.tailwind.css`. Logic/server bundles,
all compiled migration hooks/catalog, compatibility and other files are byte-
identical. Original build paths were retained to avoid comment-only compiler path
differences. The prior archive is preserved unchanged at its original path.
This closes the selected acceptance gate using both-generation native runtime
evidence plus v13 verification of the presentation delta; **no fresh full v14 run
of the UI-only candidate is claimed**. Release tooling will produce the separately
versioned distribution; this candidate retains the existing0.9.5 metadata.

### Evidence qualifications and cleanup

Run root: `/tmp/sd-a02-native13-BIAsN5/`; `completion-summary.json` indexes every
result, provenance, artifact comparison and cleanup. Module-owned harnesses are
in `temp/native-a02-v13/`. Reports include `acceptance`, `operations`,
`languages-import`, `action-parity`, `native-matrix`, `completion-data`,
`completion-quotas`, `completion-owned-ui`, `completion-actions`,
`completion-cancellation`, `completion-faults`, `operation-faults`,
`recovery-native`, `replacement-refusals`, `auto-completion`, `completion-restart`,
`advancement-restart`, `auto-restart`, `migration-results`, `restored-world`,
`ui/`, `refresh-ui/`, `completion-ui/` and `recovery-layout-after/`.
This tracked report retains the scenario/oracle details independently of temp files.

V13 native login requires `userid`; the initial v14-style harness login was
corrected before executing comparisons. Native Light Tracker obscured its own
cancellation dialog; closing that native window at a supported viewport resolved
the harness timeout, and fresh cancellation proves unchanged source/messages.
An initial layout probe used the wrong case for the footer's accessible Cancel
name; that locator was corrected before the16-case pass. Failed reports remain
with named passing reruns, not counted as product successes. The native checked
ability traces observed actual1d20+1 results; requested roll configuration is not
proof of the effective dice. Spend/loss source checks and the separate RollSD
outcome oracle have distinct claims.

Controlled faults were limited to explicit fixture requests in copied Core.
They delegated real native writes and ID allocation; the original Core runtime
was restored before restart and restored-data checks. No Core product source,
operator settings or native reference changed. All fixtures, seven accounts,
two world packs and25 fixture-authored messages were removed. Temporary settings
were restored. Independent cleanup matches the original **0 Actors,0 world
Items,0 Scenes,1 User**, original pack membership, selected settings and0 baseline
ChatMessage IDs, with **zero recorded source differences** excluding `_stats`.
User comparisons retain credential-free identity/role/character fields. All task
services stopped; operator Foundry PID1124879 remains on30000.

**Final disposition:** D6, final D7 and ADR-0002 are complete within the selected
scope. No confirmed blocker or new Core dependency remains. F01–F06, ambiguous
historical data requiring exact-source GM review, unknown-write fencing and
separate-write non-atomicity remain explicit limitations. Core0.19.2 retains its
existing offline/compiled compatibility evidence; native execution used0.19.3.
Version/compatibility/migration history are unchanged. Local checkpoint/release
operations follow current scoped authorization; no publication occurred here.
