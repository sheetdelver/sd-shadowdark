# ADR-0002 implementation validation

SD02-01–13 have implementation checkpoint evidence and passing controlled checks.
Independent review found **open SD02-R1–R3** in advancement recovery, final
creation validation and management-source refresh; see the
[review addendum](2026-10-18-spellcasting-and-native-parity.md#independent-implementation-review--october-18-2026).
**ADR-0002 stays open: corrective verification and actual native A02-01–15 are
outstanding.** This report
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
