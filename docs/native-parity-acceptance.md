# ADR-0002 native acceptance run sheet

Independent review of `1e91840` leaves [SD02-R1a/R1b](audits/2026-10-18-spellcasting-and-native-parity.md#independent-corrective-review--october-19-2026)
open. Before choosing a new native candidate, verify a supported retirement path
after a proven zero-write refusal/context change and safe reconciliation when an
Item's acknowledged ID survives a receipt persistence failure. Include these in
the existing advancement recovery acceptance scope; retain the passing R2/R3 evidence.

All A02 rows remain **open for actual Foundry**. Controlled native methods,
isolated Core and browser tests are separate evidence. This run sheet is ready
for scoped operator authorization; it does not grant that authority.

The [SD02-R1–R3 implementation findings](audits/2026-10-18-spellcasting-and-native-parity.md#independent-implementation-review--october-18-2026)
now have failing-before/passing-after offline regressions. Select only the new
corrective archive identified in the validation record.
A02-03/05/07 must include advancement partial-write/replay and premature-success
checks; A02-03/05/10 must exercise the final creation endpoint's required spell
validation; A02-06/09 must refresh an open manager after same-Class progression
and alternate-list changes. New controlled cases cover these corrections; actual native repetition remains
required.

Before connecting, the operator must confirm the disposable world's exact ID,
title, URL, native generation/build and Shadowdark version, and authorize the
named fixture namespace, test accounts, permission/setting changes, backup and
cleanup. A running endpoint or earlier operator-world access proves none of
these. Use separate native-browser and Core accounts, and serialize permission,
setting and logout probes. Do not copy session secrets into reports.

Install the final archive identified in ADR-0002's validation record. Record its
SHA-256, module/Core/native versions and commits, then independently export source
before mutation. Fixtures must use prefix `SD02-` and exact selected native UUIDs;
never identify a rule document by display name or terminal ID. Complete every
selected row on the first confirmed native generation before requesting a switch.
For the second generation, record its actual serialized effects independently.

| Row | Fixture and procedure | Independent receipt/oracle and pass condition |
| --- | --- | --- |
| A02-01 | Disposable copies of sanitized L01 missing grant, L02 empty Spell Class refs, L04 altered Knight grant, plus complete source-less Priest. Apply only the reviewed exact-source edits in the remediation guide. | Export `_source`, inspect actual native prepared classes/ability and module diagnostics. Each minimal repair restores native eligibility while every unrelated/custom field is unchanged. Never repair the operator original. |
| A02-02 | Copy stock Wizard/Priest/Witch/Seer/Knight; add separately reviewed no-caster, item-only, multiple-grant and NPC fixtures. Toggle only owned fixture effect states/suppression. | Compare native prepared eligibility and the shared sheet/card/action facts, both serialization shapes. Additional grant progression remains unavailable unless an exact progression owner exists. No copied origin fills a denied Class read. |
| A02-03 | Knight exact Class `Compendium.shadowdark.classes.Item.0uVUOXKuX9xfJ600`, fixed Talent `Compendium.shadowdark.talents.Item.XRW3jhpTni15hwFc`; level2→3 with35XP and a recorded HP roll. Create/import a representative caster using exact native templates. | One Witch tier1 selection, Witch list UUID `Compendium.shadowdark.classes.Item.KGnBAFiTiLHZJUND`, Knight progression and native HP/XP result. Compare every created Spell's Class refs/effects/source. Empty/failed required catalog blocks writes. |
| A02-04 | Copy owned spells into separate embedded IDs: duplicate origin, same name/different exact source, renamed, source-less/custom, missing source, lost and granted. Open both layouts/cards; cancel and unchanged-save. | Count actual Actor+Item IDs and explicit intent, independently export before/after. Zero writes for unchanged/cancel; no catalog-derived deletion or hidden owned rows. |
| A02-05 | Native zero/positive/unknown table cases, existing excess, too few/many/duplicate/wrong-tier/wrong-list requests; unsupported extra-spell intent. | Inspect request result and source/receipt log: invalid submissions change no level, XP, HP, language or Item. A valid required choice completes once. |
| A02-06 | While picker/page is loaded and while reads are pending: filter/remove/deny sources, change caller/role, send ownership-only context update with empty keys, interrupt transport, restore access. | No stale privileged row/label returns. Retire unsafe intent and hide retired Actor data; preserve search/tab where still authorized. Failure is explicit; retry restores current data without reload/spinner. Record explicit session-kick recovery separately. |
| A02-07 | Disposable replacements with refused add, refused removal, response loss, duplicate request, concurrent edit and Core restart during uncertainty. | Compare independent source and per-operation receipts. Confirmed additions never repeat; unsuccessful/uncertain addition never removes old spells. Unknown create/result requires fresh review, never a name guess. No distributed-atomicity claim. |
| A02-08 | Exact readable world Class/Spell and Actor-embedded Class refs, declared known compendium UUIDs, absent/denied sources and duplicate names; distinct GM/OWNER/OBSERVER/LIMITED/NONE accounts. | Native source/permissions and caller view/action agree. OBSERVER read succeeds but write403; concealed LIMITED/NONE404. No labels/content leak from warmed privileged registry; no undeclared live-compendium fallback. |
| A02-09 | Actual installed picker/resource card/shared Core roller at360,768,1024,1440, both themes, both layouts. | Screenshot plus accessible roles/names, Tab/Shift-Tab containment, Escape, focus return, nested cleanup, scroll/reachable footer and no horizontal clipping. Compare native duration/range facts. |
| A02-10 | Final archive on first generation, then separately confirmed second: creation/import/management/casting/focus/Scroll/Wand and existing migration hooks. | Native `_source` vs module source and per-operation receipts. Required migrations verify independently, restart no-op, restored legacy data needs new approval. Record actual generation, not a modeled effect conversion. |
| A02-11 | Native checked/no-check limited-use ability copies (e.g. exact Berserk `Compendium.shadowdark.class-abilities.Item.so8ytbZuqmNvppI7`), zero/last use, cancellation, independently refused spend/result/loss and replay. | Ordered source/roll/chat trace: spend first; refused/uncertain spend has no result; failed result retains spend; outstanding known consequences alone retry. Two distinct last-use requests produce one result. |
| A02-12 | Exact identified/unidentified Potion copies with distinct active/alternate text, disabled effects and empty alternate name; refuse each prerequisite/delete independently. | Native identification swap and effect group precede chat/delete. Unknown fields survive; partial failure has the native surviving state. No repeated swap/chat on replay. Use removes the owned Item regardless of stack quantity. |
| A02-13 | Player owned Spell versus NPC focus submission; Scroll/Wand cases; native custom/zero/default critical thresholds and manual total. | Player-only focus exemption, NPC failure loss, item-specific consequences, zero disables thresholds, unknown natural die never implies critical. UI/server outcome agrees with actual native. |
| A02-14 | Custom/localized names with native rarity, explicit select0/populated pool, independent ancestry/class/common/rare counts, fixed grants, denied refs and existing custom extras. | Compare actual native Generator and ordinary editor separately. One UUID cannot fill two required pools; invalid create/advance makes zero writes. Ordinary editing has no creation quota; cancel/unchanged leaves exact inventory. |
| A02-15 | Repeat the maintained native69-slot/31-weapon/9-armor/4-inventory/9-outcome controls, recording actual native method/prepared results. | Preserve independent oracle and unsupported-scope labels. F01–F06 remain separately scoped; selected passes do not establish whole-system parity. |

Keep before/after source receipts and operation logs free of credentials/private
operator data. Cleanup only fixtures/accounts/settings explicitly authorized for
this run, restore permission/setting snapshots, and verify source restoration.
Stop task-owned services only; retain operator services. Mark each row per native
generation with executed/pass/fail/blocked, exact artifact and limitations. Leave
ADR-0002 open while any required native evidence is unproven.

R1 offline correction is verified with real-handler refusal/uncertainty/replay/
restart cases and mounted target-level-before-completion/reopen cases. For
A02-03/05/07, repeat with actual native embedded-ID allocation and inspect the
exact confirmed IDs, explicit source-review recovery and final Actor patch.
No new native case was executed during the corrective task.

R2 offline correction is verified through the final writer, including native
Wizard three-spell counts, Priest fixed-spell exclusion and extra-Talent choices.
For A02-03/05/10, submit altered final bodies and changed plans directly and
independently verify zero Actor creation; compare valid final arrays/effects and
unknown source fields. Controlled tests do not establish native creation parity.

R3 offline mounted cases now cover same-Class level/table/list replacement and
pending-operation source changes. A02-06/09 must repeat these against native
prepared progression and exact lists, checking fresh next-request identity,
stale-intent retirement, retained search and original operation receipts.

Corrective candidate (October19): module0.9.5,272852 bytes, SHA-256
`2c2625964aa26094fa84ed608f5c2aaad73151ae382804422288e9b97bc7f299`.
See the validation record for the local archive/manifest/checksum and new offline
results. Core archive preview verifies the artifact but requires a full-GM service
account before deployment; that guard remains intact. This task performs no
install into a live runtime and grants no native writes. Every A02-01–15 remains
open for native13 and14, including the corrective cases above.

R1a's new offline cases prove terminal-resolution flow, including the current
context header and durable retirement/restoration receipts. A02-03/05/07 must
repeat zero-write context-change retirement/fresh advancement, failure to save
terminal evidence, restart/duplicate retirement, uncertain-write exclusion and
independent exact-source restoration using the supported recovery controls.
These remain unexecuted on actual Foundry13/14.

R1a's final clarified policy is automatic retirement/restart for proven zero
writes, superseding the earlier explicit zero-retirement button. A02-03/05/07
must verify stale/refused unchanged attempts require a new plan, with durable
terminal evidence and no character writes/recovery review; partial/unknown
outcomes must remain blocked. R1b repeats SDK-confirmed exact-ID creation followed
by receipt-save and primary-read failures: preserve the acknowledgement, stop
later writes, reconcile the same owned source and never create that grant again.
Include reloaded receipts, unavailable persistence, wrong-parent/other-operation
IDs, late review responses and final Actor-patch outcomes. Completion requires all
confirmed changes. No rollback/all-or-nothing promise applies. The27 handler and12
mounted offline groups do not execute any native A02 row; every native row stays
open on13/14 pending separate scoped acceptance.
