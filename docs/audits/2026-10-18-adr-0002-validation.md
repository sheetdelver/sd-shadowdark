# ADR-0002 implementation validation

SD02-01–13 have implementation checkpoint evidence and passing controlled checks.
Independent review found SD02-R1–R3 in advancement recovery, final
creation validation and management-source refresh; their original regressions
pass with new offline evidence below. Independent review of `1e91840` found two
additional R1 recovery defects, [SD02-R1a/R1b](2026-10-18-spellcasting-and-native-parity.md#independent-corrective-review--october-19-2026).
Independent review of `00b154b` found SD02-R1a-R1 and SD02-V1. The final
restart/CI checkpoint below corrects both with failing-before/passing-after
handler and compiled-archive evidence, updated mounted coverage and all 17 CI
source suites. R1b retains its acknowledged-write recovery checks. R2/R3 retain passing implementation
and rerun regressions. Historical
review requirements remain recorded; see the
[review addendum](2026-10-18-spellcasting-and-native-parity.md#independent-implementation-review--october-18-2026).
**ADR-0002 stays open: actual native D6, final D7 and A02-01–15 are outstanding.** This report
supplements the [active audit](2026-10-18-spellcasting-and-native-parity.md),
[ADR](../adr/0002-native-data-and-behavior-parity.md) and
[native run sheet](../native-parity-acceptance.md).

## Identity and scope

- Branch: `fix/adr-0002-native-parity`; documentation checkpoint
  `f5838a86992646cb1742162b918e330f5294bcb8` remains an ancestor. Initially clean;
  subsequent work/history preserved. Local checkpoint commits only; no remote,
  release, tag, reset, branch switch or version bump.
- Native authority: clean release-4.0.6,
  `9677d16b3903b3b640f00d4efd48249142ac8334`.
- Released floor: Core0.19.2,
  `13aef6b6676a6bfb2edc295cc71e296a75036dbd`; current Core0.19.3,
  `90c13e5e57d88913cd3bae6bf6b9e6f0b995bad1`. Both read-only. The floor toolchain
  is an isolated `git archive` with observed provenance; production uses a copied
  current workspace. No operator settings or credentials were copied.
- ADR pre-edit snapshot SHA-256:
  `7617ae3d29dae71e4082440f05aa31b624e93f3ab2f0951eaf95b6c8f88bb348`.
- Module0.9.5, Core>=0.19.2, module-api>=1.6.0<2, existing UI/roll ranges and
  workflow pins unchanged. Native data-read range>=4.0.0<=4.0.6. SDK3.4.0 remains
  informational; no `sdkVersion` field. F01–F06 excluded.

## Local checkpoints

| Commit | Validated checkpoint contents |
| --- | --- |
| `1912ed7` | D0 maintained native-parity and native-method failure baselines. |
| `b4f3bc0` | D2 exact dependencies, casting model, alternate list and advancement preflight. |
| `f9c7cd6` | D3/D4 explicit owned-spell intent/receipts, caller catalog, source filters and picker. |
| `7c519f8` | D5a prerequisite/result/consequence phases, Potion, NPC focus and zero critical thresholds. |
| `c762f20` | D5b native language rarity, separate validated pools and mounted consumers. |
| `cdc754a` | D5 fixed-source omission writers, exact Class authority and historical disposition. |
| `bcfac0a` | D6a compact caller view and mounted source revalidation. |
| `fd358ab` | D6b exact identity labels, concealment regressions and native run sheet. |
| `b045ad1` | D6c shared owner guard, stale action callback retirement and expanded native eligibility oracle. |
| `50759ae` | D6d exact Class hit dice and public world-Item catalog invalidation. Final runtime checkpoint. |

Every checkpoint included focused verification and relevant documentation. Final
source-preservation test/guidance refinements and this validation record follow
without changing the runtime archive.

## Finding evidence

| Finding | Failing before → passing after; maintained evidence |
| --- | --- |
| SD02-01 | Missing grants, absent Spell Class refs and wrong Knight grant have distinct diagnostics matching actual native eligibility methods on sanitized prepared inputs. Required unreadable grants no longer disappear; fixed ancestry talents survive. L01/L02/L04 exact-source remediation on disposable copies preserves unrelated/custom fields. No ambiguous bulk migration. |
| SD02-02 | World/embedded Class dependencies unavailable in the old preparer now resolve through caller SDK reads. Copied Class origins/titles cannot satisfy another denied reference. Installed GM/OWNER/OBSERVER/LIMITED/NONE and warmed-source privacy checks pass. |
| SD02-03 | Knight offered0 spells →46 native Witch choices, with Knight counts. The HP helper used a mutable copied Class'sd12 →the exact referenced Wizard'sd4; missing source now makes zero rolls. |
| SD02-04 | Source-less/duplicate owned rows omitted by provenance filtering →distinct Actor+Item-ID rows independent of catalog. Unchanged/cancelled selection has empty intent and no writes. |
| SD02-05 | Catalog-derived removal/add-failure risk →explicit IDs, add-before-remove, bounded source preflight and durable receipts. Refused/uncertain additions retain old spells; confirmed operations never repeat. Real process restart proves completed replay no-op and uncertain result review. |
| SD02-06 | Inconsistent/failed catalogs and stale world rows →complete-or-explicitly-partial caller catalog, zero-based SDK world pagination, Array source filters and public Item-event invalidation. Two loaded/pending Item-event tests fail before, pass after. Installed denial/restoration retains search. |
| SD02-07 | Missing mandatory choice wrote Actor HP/XP once →zero writes. Crafted too many/duplicate/wrong-list/wrong-tier/unauthorized-extra cases refuse before writes. Zero/null/unavailable limits remain distinct. |
| SD02-08 | Five mounted picker regressions fail againstf5838a8 →5/5 pass. Shared dialog and range/duration facts, explicit controls, focus/keyboard/phone behavior pass in the installed archive. |
| SD02-09 | roll→spend→loss →native spend→roll→loss. Refused/uncertain spend has no result, failed result retains spend, concurrent last use yields one result, and replay never repeats it. Two stale callback cases fail againstfd358ab →pass. |
| SD02-10 | Identified flag alone/old surviving fields →native active/alternate text swap and exact effect activation before use/delete. Native ordered/failure-state comparisons match, including empty-name fallback and failed deletion. |
| SD02-11 | NPC focus improperly avoided loss →NPC loss follows native and the NPC card hides Player focus. Scroll/Wand cases remain separate. |
| SD02-12 | English-name rarity/nonempty-pool fallback →stored rarity and four explicit pools. Four actual picker/Generator cases fail before →pass. Actual native Generator methods disprove the original probe's assumed implicit Common/INT allowance; the baseline and correction are retained. |
| SD02-13 | Zero critical threshold always succeeded →zero disables criticals as native; custom/default/unknown-natural cases match. |

## Final archive and results

Archive: `temp/adr0002-implementation/package-data/dist/modules/shadowdark-0.9.5.tgz`
(265718 bytes), SHA-256:
`76d127ee33cb463ad93f0ab5f01f0678e3e8c67d1158e106a8d8546e73ac14a3`.
Manifest/checksum siblings and `final-package-identity.json` record entry hashes.
These local paths are ignored; maintained tests, source identities, expectations
and results below remain understandable without them.

All artifact paths below are relative to `temp/adr0002-implementation/`.

| Verification | Result | Artifact / maintained entry point |
| --- | --- | --- |
| Fourteen maintained suites plus native-parity and explicit module/UI/hook typing | All pass on0.19.2 and0.19.3; parity17/17, conformance89/89 with native source present, alignment61/61, boundaries53/53. | `final-source-floor/`, `final-source-current/`; `verify-types.mjs`. Latest custom-field remediation refinement: `final-source-remediation.json`. |
| Actual native-method comparisons |20/20;69 slots,31 weapon defaults,9 armor,4 inventories and9 ordinary roll controls retained. Not full Foundry preparation. | `final-source-native-methods.json`; `native-parity.oracles.mjs`. |
| Actual mounted consumers, controlled SDK boundary | Collections41/41, action/card6/6, Actor lifecycle5/5. Network blocked. | `final-source-consumers/`, `final-source-actions/`, `final-source-actor/`; corresponding browser scripts. |
| Module checking and isolated packaging | Pass on released floor; current isolated module check also passes. | `final-source-package.log`, `final-source-current-module-check.log`. |
| Final archive, released0.19.2 development |30 checks pass; eight360/768/1024/1440 ×light/dark cases, both layouts, real shared roller/cards/picker keyboard/focus and no overflow/page errors. Includes live source/ownership/context/reconnect and public creation/import/management/restart. | `final-source-0192-browser/ui-evidence-g13.json`, `shots/`; `installed-consumers.core.ts`. |
| Final archive, current0.19.3 production build/start |22 checks pass; public workflows and mounted recovery pass. Width/theme matrix explicitly omitted by`--focus-only`, covered on released floor above. | `final-source-0193-production/ui-evidence-g14.json`; production build log. |
| Larger inventory through final caller view |1000 additional native Item rows preserve exact source, constant71-character review and source restoration;284ms floor/294ms production in this controlled run. | Same installed evidence. Existing larger migration-inventory evidence preserved. |
| Final archive migration shapes/locations | Five positive workflow checks per shape:22 exact bounded writes, independent source/receipt comparison, restart no-op, restored data and stale/fresh approval. Both required step identities/history unchanged. | `final-source-migrations-g13/results.json`, `final-source-migrations-g14/results.json`; `pack-maintenance.core.ts --locations --inventory-only`. |
| Lock/provenance/permission policy | Earlier full14-check run per shape passes default/null/false eligibility and explicit-lock/unreadable/unresolved/malformed/provenance/role failures. Final positive-only runs explicitly skip those negatives. All8 migration catalog/definition/hook entries are byte-identical across policy-tested and final archives. | `migrations-g13/`, `migrations-g14/`, `migration-entry-identity.json`; same maintained harness. |

Generation markers13/14 in controlled-upstream artifacts are **not actual native
Foundry runs**. The controlled upstream does not run native embedded-ID allocation
or serve all native artwork. Explicit fixture IDs and known missing image assets
are recorded test boundaries. Earlier failed runs remain labelled failures; only
the final runs above establish the stated results.

## Remaining boundaries and gates

No missing public Core capability blocks the implemented module path. Two
separate observed Core/path qualifications remain:

1. Generic`POST /api/actors` strips Item string arrays on0.19.2/0.19.3. The
   maintained public comparison reproduces it against the module SDK creation
   route, which preserves the same Spell Class source. Other callers still need
   a host correction; this module does not use that writer or repair afterwards.
2. Explicit upstream`socket.disconnect(true)` leaves the old caller's mutation
   socket disconnected although reads recover. The module returns uncertain
   receipts and preserves old inventory. Minimal public diagnostic mode:
   `installed-consumers.core.ts --probe-reconnect-write --server-disconnect`.
   Ordinary transient transport interruption and recovery pass separately.
   No automatic relogin, privilege fallback or Core edit was added. This is not
   the separately qualified CG-6 context-error typing issue.

Process-local queues and public SDK receipts provide no distributed CAS or
atomic multi-document transaction. Unknown create/result acknowledgements need
review; no source/name guess establishes success. Historical omissions retain
[explicit exact-source GM remediation](../native-source-remediation.md).

D0–D5/D5a/D5b and controlled D1/D6 evidence below describe the implementation
checkpoint. The independent review qualifies D3/D4 and the creation-writer
portion of D5 with SD02-R1–R3; they require correction and verification.
D6 actual native and D7 final acceptance closure remain open. **A02-01–15: not executed on native13;
not executed on native14.** Confirm a disposable world's exact identity and
scoped writes/backups/cleanup before connecting. Complete all selected rows on
one generation before requesting a switch. F01–F06 and ADR-0001's accepted scope
remain unchanged.

All task-owned services were stopped; no retained workspace process was found.
Operator Foundry PID3644622 remained running and was never contacted. Core and
native reference checkout status stayed clean. Local outputs and ADR snapshot
are retained; no operator fixtures/settings required cleanup because no native
world was touched. Changes remain on the approved branch in local commits.

## Corrective checkpoint: R1

SD02-R1 is corrected with ten real-handler source/receipt regressions and two
mounted-hook regressions (all fail on08997a4, all pass after). Both Core toolchains
pass explicit typing; native-alignment61/61 passes. See the active audit's R1
corrective evidence for scope/artifacts and recovery limitations. R2/R3 and all
native A02 rows remain open. Earlier archive/installed evidence above is retained;
it does not identify the corrective source or its future package.

## Corrective checkpoint: R2

SD02-R2 is corrected at the final write boundary. Ten maintained real-handler
case groups pass (eight negative groups fail before; two positive controls pass
before/after). The new shared preparation/multiset comparison preserves complete
native grant data and separates ordinary/fixed/extra spells. Language9/9,
collection/Generator41/41 and both toolchains' explicit typing pass. R3/native
acceptance remain open. New local artifacts use `temp/adr0002-corrections/r2-*`;
no previous archive/installed evidence was replaced or rerun.

## Corrective checkpoint: R3

SD02-R3 is corrected with four mounted SpellsTab/modal cases failing before and
passing after. Current source facts update both display and submitted intent;
manual search and original operation receipts survive. Collection41/41 and
current explicit typing pass. All three findings now have corrective execution
coverage; integrated validation and a new archive are recorded separately below.
No native acceptance was performed.

## Integrated corrective validation — October 19, 2026

This section supersedes the earlier candidate for R1–R3. All new tests are offline:
no live Core/Foundry connection, installed service/browser session or native
acceptance was performed. Older controlled-host/native-method evidence retains
its original scope and artifact; it was neither overwritten nor promoted.

| Checkpoint | Commit / contents |
| --- | --- |
| Review preservation | `08997a4`: eight existing review documentation files checkpointed before implementation. |
| R1 | `30dc3cc`: durable exact advancement receipts, native order, refused/uncertain recovery and authoritative mounted completion. |
| R2 | `215be57`: shared preparation at the final creation write, native grant multiset validation and lossless Generator plan forwarding. |
| R3 | `75cd303`: current source facts in open management, immediate stale-intent masking, preserved original receipts and CI consumer coverage. |
| Integrated verification | Final checkpoint adds compiled-archive contract checks, keeps saved grant payloads out of advancement responses and records this candidate. |

Before editing the reviewed ADR, the complete current file was saved as
`temp/adr0002-corrections/ADR-0002.before-corrections.md`, SHA-256
`b29b30b39847de1871034f832db4867098db2afe714b18c441f2fe140b63c1e7`.
Both `dbbe93f2` and the documentation checkpoint remain ancestors. All original
implementation commits and review evidence remain available.

| Finding | Failing before (08997a4) | Passing after / maintained entry |
| --- | --- | --- |
| R1 | Ten handler cases fail; the reviewed Knight grant refusal publishes3/15XP/11HP without its required Spell. Two mounted cases fail, including premature success on an Actor event. | `advancement-recovery.test.ts`10/10, corrective browser2/2. Refusal leaves2/35XP/8HP; completion confirms every exact Item ID then publishes advancement once. Lost acknowledgements stop; explicit exact-source review can reconcile IDs/final patch; restart requires review. |
| R2 | Eight negative groups fail with Actor writes; both valid caster/level-zero controls pass. | `creation-validation.test.ts`10/10: missing/excess/duplicate/wrong-tier/list, stale source/progression/context, fixed/extra/ordinary distinction and complete native data comparison before create. |
| R3 | Four mounted cases fail: stale limits/list/intent and incomplete original receipt display. | `parity-corrections.browser.mjs`4/4: same-Class level/table/list changes update current facts/request identity, preserve search and retain exact original operation receipts after retry failure. |

Final source validation uses released Core0.19.2
`13aef6b6676a6bfb2edc295cc71e296a75036dbd` and current Core0.19.3
`90c13e5e57d88913cd3bae6bf6b9e6f0b995bad1`, both read-only. Native sources remain
release4.0.6 `9677d16b3903b3b640f00d4efd48249142ac8334`, clean and read-only.
Module0.9.5, all compatibility ranges/workflow pins, migration IDs/revisions and
applied-history policy are unchanged; no `sdkVersion` was added.

| Verification | Newly observed result | Local artifacts under temp/adr0002-corrections/ |
| --- | --- | --- |
| All maintained source suites |17/17 on each Core toolchain; includes new R1/R2 suites, parity17, conformance89, alignment61 and boundaries53. | `final-suites.json`, `final-floor/`, `final-current/`. |
| Explicit module/UI/hook typing |Pass on both toolchains; root exclusion does not substitute for these checks. | Same directories, `types.log`. |
| Native-method comparisons |20/20 on each toolchain;69 slots/31 weapons/9 armor/4 inventories/9 ordinary outcomes retained. Controlled collaborators, not full Foundry preparation. | Same directories, `native-methods.log`. |
| Mounted offline consumers |Corrective6/6, collection/Generator41/41, action/card6/6, Actor lifecycle5/5; no page errors; outgoing browser traffic blocked. | `final-{corrective,collection,action,actor}-browser/`. |
| Module checking |Pass without warnings on0.19.2/0.19.3, including boundaries and dry bundles. | `final-{floor,current}-check.log`. |
| Isolated package |Pass on released0.19.2. | `final-package.log`, `final-package-identity.json`. |
| Final compiled routes through public SDK |5/5 on each version: actual exported `apiRoutes`, public `@sheet-delver/sdk/testing`, refusal/retry/order/exact ID/completed replay, zero-spell rejection, valid lossless creation and tampered final body rejection. | `packaged-{floor,current}/results.log`; maintained `packaged-corrections.mjs`. |
| Core public archive CLI |Artifact/manifest/dependencies/trust-override validation allow on both. Final preview correctly returns `wouldProceed:false`, `Full-GM service account required`. No install or service-account workaround. | `{floor,current}-archive-dry-run-install.log`, `archive-cli-results.json`. |

Final archive:
`temp/adr0002-corrections/package-data/dist/modules/shadowdark-0.9.5.tgz`,
**272852 bytes**, SHA-256
`2c2625964aa26094fa84ed608f5c2aaad73151ae382804422288e9b97bc7f299`.
Its manifest/checksum siblings and identity JSON record all entry hashes. Packaged
`info.json` is byte-identical to the prior candidate's packaged metadata.
Migration catalog/definition bytes are identical; all six compiled hook programs
are identical after removing comments. Their bytes differ only in generated
build-path comments from the separate isolated output. The initial attempt to
reuse precompiled inputs still recompiled them in the source packager; final
packaging uses ordinary source hooks. The guide's copy guarantee concerns managed
same-version repair. No hook logic, IDs/revisions, source catalog or history was
changed. Existing larger-inventory/maintenance evidence is retained and was not
rerun under this task's no-live-runtime constraint.

No new Core dependency is established. Public writes remain non-atomic/process
queues are not distributed CAS. An unknown absent write cannot be retried by
guess; uncertain operations require exact source review, and unresolved absent
outcomes/unrelated changes/stale rules require explicit operator remediation.
The CLI deployment guard is an offline environment/authorization boundary, not a
missing module contract. This task requests no operator action.

**Exact remaining acceptance:** native D6, final D7 and every A02-01–15 on actual
Foundry13 and14 remain open/unexecuted for this ADR. A02-03/05/07 additionally
require the advancement recovery cases; A02-03/05/10 the final-writer cases;
A02-06/09 the mounted manager cases. Complete the scoped matrix on one confirmed
disposable generation before a switch. ADR-0001 accepted scope/F01–F06 deferrals
remain intact. No task services remain; operator services were preserved and
never contacted. A test file briefly written under Core was moved into this
module immediately; the Core worktree is clean. Changes are local checkpoints
on the approved branch, with no remote operation or version bump.


## Independent corrective review qualification — October 19, 2026

At `1e91840`, independent offline reruns pass17 suites and20 native-method cases
on current0.19.3, explicit typing on0.19.2/0.19.3, current module checking and
compiled archive5/5 per toolchain. The archive hash matches the candidate above.
The existing58 mounted checks were not rerun; their evidence remains retained.

Two new real-handler probes reproduce SD02-R1a/R1b: a proven zero-write plan
cannot be retired after context change, and a confirmed Item whose receipt-save
failed cannot reconcile its own retained ID. See the
[active review](2026-10-18-spellcasting-and-native-parity.md#independent-corrective-review--october-19-2026)
for exact inputs, results and required checks. D3/R1 is therefore still open;
R2/R3 verification is retained. No live/runtime/native testing, application source
edits or Git mutations occurred. Local logs/probes are under
`temp/adr0002-corrective-review/` and do not replace the durable findings.

## R1a terminal-resolution checkpoint — October 19, 2026

Review docs checkpoint3e8f892 precedes code. R1a's seven new handler groups pass
(five fail before; two retain defensive passes); all17 advancement groups pass.
Three mounted recovery-control cases fail before/pass after. Both toolchains
pass explicit typing. These new results use `temp/adr0002-recovery-resolution/`,
leaving older artifacts intact. Supported zero-write retirement and independently
restored partial closure preserve journals and record durable terminal evidence.
R1b and native D6/D7/A02 remain open at this checkpoint.

## Simplified R1a / R1b focused validation — October 19, 2026

The original review docs were checkpointed in3e8f892; a21375a preserves the first
terminal-resolution implementation and its dated tests. The clarified policy
supersedes explicit zero-write recovery: prove no writes, durably retire, require
fresh preparation. Partial/unknown outcomes remain fenced. Acknowledged native
writes retain IDs/outcomes across bookkeeping failure and require exact primary
source reconciliation before any further write. See the ADR and supported
[recovery controls](../advancement-recovery.md).

New verification under `temp/adr0002-recovery-resolution/`:

- `simplified-tests.log`:27/27 handler groups; source, ordering and receipts.
- `simplified-before.log`: identical specifications on freshly archived3e8f892,
  16 fail/11 controls pass. Earlier baseline files/logs are preserved.
- `simplified-browser/results.json`:12/12 mounted corrective cases, network blocked.
- `simplified-browser-before/results.json`:6 fail/6 retained controls pass.
- `simplified-{floor-,}types.log`: explicit module/UI/hook typing on0.19.2/0.19.3.

No live runtime, native acceptance, migration or compatibility/pin/version change.
R2/R3 consumers and creation implementation remain intact. Full integrated checks
and final archive identity follow; native D6/final D7/A02-01–15 remain open.

## R1a/R1b integrated corrective validation — October 19, 2026

Newly executed evidence uses `temp/adr0002-recovery-resolution/`. Earlier
`adr0002-implementation/`, `adr0002-corrections/`, independent-review probes and
intermediate `r1a-*`/`r1b-*` results remain intact and historical.

| Finding | Same specification against3e8f892 | Final corrected outcome |
| --- | --- | --- |
| R1a | Zero-write requests remain partial/blocked after context change; no terminal restart. The new source and mounted restart/terminal cases fail. | Definite first refusal/stale saved zero-write attempt automatically retires, source remains2/35XP/8HP with original Items, fresh current plan completes once. Restart/duplicates preserve terminal evidence; failed persistence cannot release it; partial/unknown/in-flight outcomes cannot discard. No recovery workflow for zero writes. |
| R1b | Completed receipt save failure downgrades the acknowledged grant to uncertain; own retained ID is rejected. New persistence/read/receipt consumer cases fail. | Exact acknowledged ID survives storage/read failures, reload/reconciliation; later writes stop until safe durable recovery. No second creation of that grant. Other-operation/grant, wrong-parent/source and rebound IDs are rejected. Final Actor outcome/read/receipt failures retain the completion guard. |
| Preserved controls |11 handler/6 mounted controls already pass. |27/27 handler and12/12 mounted cases pass;16 source/6 mounted failures before are now passes. R2/R3 behavior remains intact. |

| Verification | Newly observed result | Artifacts |
| --- | --- | --- |
| All maintained suites |17/17 per toolchain, including advancement27, creation10, parity17, conformance89, alignment61 and boundaries53. | `final-suites.json`, `final-{floor,current}/*.log`. |
| Explicit module/UI/hook typing |Pass per toolchain, independent of root exclusion. | `final-{floor,current}/types.log`. |
| Native-method comparisons |20/20 per toolchain;69 slots/31 weapons/9 armor/4 inventories/9 ordinary outcomes retained. Controlled collaborators, not actual native preparation. | `final-{floor,current}/native-methods.log`. |
| Mounted consumers |12/12 corrective,41/41 collection/Generator,6/6 action/card,5/5 Actor lifecycle. Browser traffic blocked; no page errors. | `simplified-browser/`, `final-{collection,action,actor}-browser/`. |
| Failing-before |Same27 source/12 mounted specifications on preserved3e8f892:16 source/6 mounted fail,11/6 controls pass. | `simplified-before.log`, `simplified-browser-before/`; fresh baseline copy leaves old fixtures/evidence intact. |
| Module checks |Pass on0.19.2/0.19.3, no warnings. | `final-{floor,current}-check.log`. |
| Isolated package |Pass on released0.19.2. | `final-package.log`, `final-package-checks.json`. |
| Final compiled public routes |6/6 per version via actual exported apiRoutes + public SDK/testing: zero-write retirement/new request; acknowledged receipt failure/reload; exact reconciliation/complete replay/no duplicate; zero-spell creation rejection; valid full-source creation; final-body tamper rejection. | `packaged-{floor,current}/results.log`; maintained `packaged-corrections.mjs`. |
| Toolchain provenance |All939 floor and942 copied current tracked files match their Git objects. | `toolchain-provenance.json`. |
| Cleanup |No task services or retained test/browser processes. Core/native worktrees clean. No live connection. | `cleanup-processes.json`. |

Released floor v0.19.2's annotated tag object is
`13aef6b6676a6bfb2edc295cc71e296a75036dbd`; its **commit** is
`b010f590e56d87e3fcd6fce42c7894028e5f0c3a`. Earlier records labelled the tag object
as a commit; this clarifies provenance without changing the toolchain. Current
0.19.3 commit is`90c13e5e57d88913cd3bae6bf6b9e6f0b995bad1`; native4.0.6 remains
`9677d16b3903b3b640f00d4efd48249142ac8334`, read-only.

Final archive: `temp/adr0002-recovery-resolution/package-data/dist/modules/shadowdark-0.9.5.tgz`,
**275818 bytes**, SHA-256
`7ad1fc5979bb310ca87a452966a5f78f3bb74116b8d80efda5e932e4bf980431`.
Manifest/checksum siblings and `final-package-identity.json` record entry hashes.
Packaged info/catalog/definition bytes match the prior candidate. All six compiled
migration programs match after ignoring generated path comments; source steps,
IDs/history and compatibility/version/workflow pins are unchanged.

No new Core dependency is established. Public primary reads and SDK write results
are sufficient for these corrections; module bookkeeping failures do not redefine
native outcomes. A total ledger outage retains the durable started fence and
response ID; restart cannot infer acknowledgement from that fence alone. An
unknown absent/in-flight outcome remains blocked until independently resolved.
Separate writes are not atomic and no rollback/all-or-nothing promise applies.
The supported partial restoration path performs receipt resolution, not document
rollback. Previous Core public CLI guard (`Full-GM service account required`) and
larger-inventory/installed-host evidence are retained, **not newly rerun**. This
archive was tested through compiled public SDK in-memory contracts, not installed
into or connected to a live Core/Foundry runtime.

**Remaining acceptance:** native D6, final D7 and each A02-01–15 on actual Foundry13
and14 remain open/unexecuted. A02-03/05/07 must repeat the clarified restart and
acknowledgement/bookkeeping/recovery cases. Existing R2 A02-03/05/10 and R3 A02-06/09
repetitions remain required. ADR-0002 stays open. Separate scoped disposable-world
authorization and cleanup remain prerequisites for native testing; this task asks
for none. No remote writes, branch switch/reset or release/version change.


## Independent checkpoint verification — October 19, 2026

Reviewed source `00b154b` with a clean initial module worktree. All prior local
checkpoints remain ancestors. Current Core is read-only 0.19.3 at
`90c13e5e57d88913cd3bae6bf6b9e6f0b995bad1`; the existing floor toolchain is
0.19.2. The read-only native reference remains 4.0.6 at
`9677d16b3903b3b640f00d4efd48249142ac8334`.

| Newly executed verification | Result |
| --- | --- |
| Maintained source suites | 17/17 on each Core version, including 27 recovery groups and final-creation controls. |
| Controlled native-method comparisons | 20/20 on each version; not actual Foundry acceptance. |
| Explicit module/UI/hook typing and module checking | Pass on each version; module checks report no warnings. |
| Compiled reported archive, public SDK/testing | 6/6 on each version. No host deployment or native connection. |
| Mounted consumers | 12 corrective + 41 collection/Generator + 6 action/card + 5 Actor lifecycle = 64 passes; browser network blocked. |
| Reported archive identity | 275818 bytes, SHA-256 `7ad1fc5979bb310ca87a452966a5f78f3bb74116b8d80efda5e932e4bf980431`. |
| Additional independent Actor-edit probe | Reproduces SD02-R1a-R1 on both versions: zero write calls, all receipts pending, fresh request blocked with 409. Diagnostic exit 0 asserts reproduction, not acceptance. |
| CI source-suite inventory | 14/17 invoked; SD02-V1 records the three missing handler suites. |

Logs and the independent probe are under `temp/sd02-final-review-uegtewbp/`;
`{current,floor}/results.json` retain all 21 command results per toolchain and
`browser/` contains the four mounted reports. The tracked active audit records
the exact reproduction and correction without requiring these ignored files.
The original pre-review handoff and ADR are preserved there.

R1b, R2/R3 and the existing maintained checks pass. R1a's independent-edit case
still contradicts the agreed zero-write restart policy, so this review does not
satisfy the user's conditional commit or release-preparation gate. No source or
workflow edits, Git mutations, version changes, live checks or new package build
were performed. Documentation/handoff annotations remain uncommitted. All test
commands and their browser processes exited; no test services were started.
Native D6/final D7 and A02-01–15 remain open on both native generations.


## Zero-write restart and CI checkpoint — October 19, 2026

User authorized the two narrow corrections and a local commit after verification.
The starting review annotations and all checkpoints through `00b154b` are retained.
The runtime change is confined to zero-write retirement; no Core/API/compatibility,
version, native reference or migration changes were made.

| Verification | Observed result |
| --- | --- |
| Updated actual-handler regressions before runtime changes | 3 failures/26 passing controls. The old code requires old Actor equality despite zero-write receipts. |
| Corrected actual-handler regressions | 29/29; independent XP/notes edits survive, fresh advancement completes once, retired replay never writes, partial/unknown/owner/persistence guards remain. |
| All source suites and native-method comparisons | 17/17 suites and20/20 controlled methods on Core0.19.2/0.19.3. |
| Explicit module/UI/hook typing and module checks | Pass on both. An initial test-assertion narrowing error was fixed; final type logs supersede the preserved initial failure. |
| Mounted consumers | 13 corrective +41 collection/Generator +6 action/card +5 Actor lifecycle =65 passes, network blocked. |
| Clean CI layout on Node22.23.3/Core0.19.2 | Exact workflow managed generation, module check, all17 tests, explicit typing and packaging pass. Local tracked-source archives/static native reference; installed dependencies reused. No remote workflow or fresh npm-ci claim. |
| Compiled-archive failing-before check | New Actor-edit regression fails against old SHA256 `7ad1fc5979bb310ca87a452966a5f78f3bb74116b8d80efda5e932e4bf980431`: returns partial instead of retired. |
| Corrected compiled archive | 7/7 public-SDK cases on each Core version; floor probe runs Node22.23.3. |

Corrected candidate (module0.9.5, no version bump): **274985 bytes**,
SHA-256 `3aeccbb0c3924e32043be2f065d6248fac29e2081521a01a55608625a8bdd56f`.
Local archive: `temp/sd02-r1a-r1-fix-awky1o07/ci-core/.module-ci-data/dist/modules/shadowdark-0.9.5.tgz`.
The archive is an offline validation candidate, not a published release.

Evidence is under `temp/sd02-r1a-r1-fix-awky1o07/`: `handler-before.log`,
`{current,floor}/` source/method/type/module-check logs, `browser/`,
`ci-final-results.json`, `ci-final-*.log`, `archive-before.log`,
`archive-{current,floor}.log` and `archive-identity.json`. Initial CI/type
failures are retained with distinct filenames. The ADR snapshot SHA-256 is
`3f12ca159ece6940a047513ffffaeed2dbab8948b6ce5d5103b554d587f38610`.
Tracked tests and the audit describe the correction without requiring these logs.

This passes the narrow module correction/checkpoint gate. Source and archive
checks remain distinct from installed-host/native acceptance. No live Core or
Foundry session was contacted, no services were started, and all test processes
exited. Native D6/final D7 and every A02-01–15 on both generations remain open;
ADR-0002 is not closed or release-approved by these offline results.
