# ADR-0002 native acceptance — October 19, 2026

**Current disposition:** SD02-N14-01/02 are corrected with offline and targeted
native v14 verification in the [later correction record](#automatic-completion-correction-and-native-recheck).
The original broader pass below found the defect; its exact subcase evidence and
remaining variants are preserved. Remaining v14 variants and all v13 acceptance
keep the ADR/release open. This report supports the
[active audit](2026-10-18-spellcasting-and-native-parity.md); it is not another
implementation queue.

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
