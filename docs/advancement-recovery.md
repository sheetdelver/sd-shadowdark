# Advancement receipt recovery

The owner opens advancement to review its saved request, exact grant IDs and
final Actor update. Refresh operation review obtains the current source baseline
and context revision. These controls use the public module advancement request;
they do not edit DataStore records or automatically roll back documents.

For a definitely refused operation with no acknowledged, uncertain or in-flight
writes, independently review the unchanged original system/inventory/effect
source and select **Retire verified zero-write plan**. The server verifies those
preconditions, records the terminal `zero-write` disposition durably and keeps
the original journal. Close the terminal review and prepare a fresh plan. The
retired request can never resume; old rules are never replayed under a new context.

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
`retire-zero-write`, `reconcile` or `resolve-restored`. Reconciliation supplies
`items: { <operation index>: <exact owned Item ID> }`; restoration supplies a
nonempty `note` (maximum1000 characters). Use the refreshed review's current
`contextRevision` header, not the saved plan's old revision. The caller must still
own the Actor and be the caller bound to that saved request. Terminal replay
returns `state: retired` and its durable disposition, never advancement success.
