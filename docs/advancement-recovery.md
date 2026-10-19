# Advancement receipt recovery

**Automatic resolution (October 19, SD02-N14-01):** A lost acknowledgement does
not require manual recovery when the entire advancement is already confirmed
by authoritative source. Sheet refresh, operation reload or retry checks the
saved final Actor token and every confirmed grant ID under the owner's current
caller scope and Actor queue. Exact completion closes the local receipt without
another Foundry write, including after Core restart. A read or bookkeeping
failure keeps completion unconfirmed until a successful retry.

Only genuinely partial, unknown or mismatching outcomes require the controls
below. Both sheets offer **Review advancement** for the original caller even
below the next XP threshold. This opens the saved request directly, without
waiting on a new level's Class or Patron data, and displays the saved target.
Do not change XP or delete receipts to bypass an unresolved outcome. The
[corrective evidence](audits/2026-10-19-adr-0002-native-acceptance.md#automatic-completion-correction-and-native-recheck)
records actual native completion and partial-state checks.

The owner opens advancement to review its saved request, exact grant IDs and
final Actor update. Refresh operation review obtains the current source baseline
and context revision. These controls use the public module advancement request;
they do not edit DataStore records or automatically roll back documents.

A stale or rejected attempt with proven zero document writes retires
**automatically**. The server checks the current caller's owner authority, the
current context and receipts proving no acknowledged, uncertain or in-flight
write. Independent Actor edits do not prevent retirement: the module preserves
those changes and requires a fresh plan against current data. It records a
durable `zero-write` disposition, preserves the
original journal and releases that operation's block. The dialog says
**Advancement was not applied** and offers **Start advancement again**. No
character changes are saved, and no recovery review is required for this case.
The next attempt prepares current choices/rules under a new request ID. A retired
request can never resume, including after restart or duplicate delivery. If
terminal bookkeeping cannot be saved, no replacement may write yet.

An SDK write result and module bookkeeping have different outcomes. A returned
embedded Item ID is authoritative; Core mirrors acknowledged native mutations
into its primary store before returning. The module verifies that exact owned
Item through the public primary Actor read. A receipt-save failure retains
`complete`, `acknowledged`, the exact ID and a separate `receiptPending` reason;
a failed primary read retains the acknowledgement with `verificationPending`.
Both stop later writes and show the actual partial state. Neither becomes an
uncertain native create or authorizes another creation.

Refresh and independently review the source, then use **Reconcile receipts
without replay** (or **Continue reviewed operation** when its rules still match).
Acknowledged IDs are prefilled and reconciled against the same Actor and complete
planned source. IDs assigned to another grant/operation, another parent or
mismatching source are refused. Reconciliation must persist before later writes.
If every post-write bookkeeping save fails, the durable pre-write `started`
fence remains; keep the response's exact ID for review. After restart that fence
alone cannot establish the native outcome. A lost acknowledgement or failed read
never proves zero writes; no absent-ID guess can release it.

For a partial operation, first reconcile uncertain outcomes using exact owned
Item IDs or the exact completed final Actor source. **Reconcile receipts without
replay** can record that evidence after a context change without executing the
old plan. To continue the original plan, its original rules/dependencies and
reviewed source must still match.

To close a settled partial operation after independent restoration:

1. Record/reconcile all authoritative outcomes first. Do not remove an uncertain
   grant before binding its exact owned ID; an absent unknown result cannot be
   declared refused from an inventory guess.
2. Using ordinary authorized document controls, remove only this operation's
   confirmed grant IDs and restore its original Actor values/source from the
   independent pre-operation export. The recovery panel lists prior Actor patch
   values for new journals. Older journals require the original export; the
   module does not invent unavailable prior values.
3. Refresh operation review. Enter the independent restoration evidence and
   explicitly select **Verify restoration and close operation**. The server
   requires the original reviewed system/inventory/effect source, absence of
   every confirmed grant ID, settled outcomes and current owner authority.
4. The terminal `restored` disposition retains all original receipts and the
   restoration note. Close the review and prepare a fresh advancement.

An unresolved unknown/in-flight write cannot be retired through either escape.
Leave its operation active until its outcome is independently established. No
rollback, second creation, arbitrary completion, private journal editing or
privilege escalation is part of this workflow. Completed advancement remains a
completed operation; it is not a rollback control. Process queues and public
receipts provide no distributed transaction/CAS guarantee.

The same controls are available to integrations through
`POST /api/modules/shadowdark/actors/:id/level-up/finalize`. Send the saved
`requestId` and `recovery: { reviewed: true, baseline, action }`, where action is
`reconcile` or `resolve-restored`. Reconciliation supplies
`items: { <operation index>: <exact owned Item ID> }`; restoration supplies a
nonempty `note` (maximum1000 characters). Use the refreshed review's current
`contextRevision` header, not the saved plan's old revision. The caller must still
own the Actor and be the caller bound to that saved request. Terminal replay
returns `state: retired` and its durable disposition, never advancement success.

Success requires confirmed receipts and primary-source verification for every
required grant and the frozen final Actor patch. A target-level event or a
successful individual write is not completion. Separate Item creations and Actor
updates are not atomic; no rollback or all-or-nothing behavior is promised.
