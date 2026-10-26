# ADR-0006: Shared character rest and resource recovery

Status: Proposed — audit complete; awaiting user review before implementation
Date: 2026-10-26

## Problem and scope

Both Shadowdark sheets need the same Rest action: optionally consume a personal
ration and apply the recovery from an already completed successful rest to that character's
owned spells, abilities and items. Today those controls are scattered manual
edits, and the native data does not provide one universal reset method.

The [resting audit](../audits/2026-10-26-resting-workflow.md) records the rules,
source identities, current utilities and limitations. It is the evidence for
this proposal. Implementation remains module-owned on the existing authorized
branch after review; no Core SDK change, new dependency or version bump is needed.

## Selected scope clarification — October 26

The user clarified that this is a player convenience utility for completing a
successful rest and consolidating resets that would otherwise be made separately.
Clicking Complete rest means the player has already resolved rest eligibility at
the table. Interrupted rests, CON rolls and failed-rest ration spending are handled
independently. This supersedes the original proposed successful/failed outcome
selector and optional CON roll integration. Do not add interruption prompts,
rest-eligibility checklists or a rest simulation to this workflow.

The user also selected a **Consume ration?** checkbox, checked by default for each
new rest. Uncheck it when another player, NPC or circumstance provides the food.
This supersedes the unconditional personal-ration gate. No provider selection,
proof or extra confirmation is required; the utility never edits another Actor's
inventory. Recovery exclusions remain visible with their individual reasons.

## Proposed user flow

1. Put a **Rest** button with the existing Lucide `FlameKindling` icon beside the
   tabbed sheet's view controls and beside Manage Character Sheet on the paper
   layout. Match existing square controls; hide it in print. Both invoke the same
   provider-owned dialog. No additional page/header or dashboard action.
2. Open `RestModal` inside the existing `ModuleDialog`. Show current HP → recovered
   HP, available carried rations, selected stack (when there is more than one),
   and two distinct lists: **Will reset** and **Will not reset**. The first names
   the spells, abilities, items and other resources that will recover, with
   before/after values where useful. The second names excluded resources with
   their individual reasons. These rows come from a server preview. This is a reviewable operation, not an
   eight-hour real-time countdown.
3. Show **Consume ration?**, checked by default. When checked, select an available
   personal carried stack and consume **one ration unit**, not the three-unit
   bundle. No available ration disables completion only while checked, with the
   reason beside this field. Helper text: "Uncheck if food is provided elsewhere."
   When unchecked, omit the stack selector and ration write; no personal ration
   is required and all eligible recovery still applies. Prefer an exact native
   ration origin; allow only a verified legacy signature for old source-less
   copies. Names alone do not identify food. Stashed supplies must be moved to
   carried inventory first if used. Do not edit another Actor's food, unpack
   existing kits, buy food or delete an emptied stack.
4. The primary button says **Complete rest — use 1 ration** when checked and
   **Complete rest** when unchecked. One brief description explains that it
   applies recovery after a successful rest. There is no outcome selector,
   interruption handling, CON roller or extra confirmation popup. The player
   invokes this utility only when their rest has succeeded.
5. Known supported recoveries are selected automatically and shown in **Will
   reset**. A separate **Will not reset**
   section lists each relevant owned spell, Item or effect by name with its reason
   (for example, "Penance required", "Wand is broken" or "Scroll is spent").
   Keep these visible whether or not a personal ration is consumed. Include
   unknown/unmodeled recovery in Will not reset as manual follow-up rather than
   silently omitting it. Show a short empty state when either list has no entries;
   do not mix exclusions into the recovery list. Changing an eligibility choice
   updates both lists to match the exact planned writes.
   Historical/unknown lost spells are not silently assumed safe: a concise
   per-spell eligibility checkbox lets the owner confirm an ordinary rest loss or
   completed required penance. Known permanent restrictions remain excluded.
   Do not require a generic "Reviewed" acknowledgement that has no effect.
6. Apply once, refresh the existing Actor projection and close on verified
   completion with a concise result notification. Keep only partial/uncertain
   outcomes open with the existing review/recheck pattern. Reopening must recover
   the same pending operation instead of offering another ration spend.

Zero HP alone does not block rest: a stabilized character may be fed a ration.
The button is not resurrection, stabilization or death-timer management. Narrative eligibility
is resolved by the player and GM before invoking this utility; it does not change
a death state. The campfire icon does not consume torches or create lights.

## Recovery policy

| State | Completed rest |
| --- | --- |
| Personal ration | If Consume ration? is checked, decrement the selected stack by1 and retain the empty Item; otherwise no ration write |
| Current HP | Restore to current prepared maximum through a verified source patch |
| Ordinary rest-lost spells | Clear `system.lost` for eligible exact owned IDs |
| Priest/Seer penance loss | Only after the required penance is explicitly established; preserve permanent restrictions |
| Nonbroken modern/legacy wand loss | Apply existing `wandRestUpdates` |
| Broken wand or spent scroll | Never repaired/recharged |
| Proven rest-lost Class Abilities | Clear loss using exact native recovery classification |
| Supported daily counters | Restore available uses to the current effective maximum, preserving source bonuses |
| Proven temporary stat damage/effects | Restore only with explicit rest-recovery provenance and original value/effect identity |
| Unknown/custom/prose-only resources, permanent damage, arbitrary effects | Show manual follow-up; no guessed patch |

**Recommended policy for review:** a completed eight-hour rest renews the
classified daily resources once for that rest. This does not mean every
`limitedUses` Item recharges, and is not a calendar-day/sunrise tracker. No
automatic luck token, ammunition, potion, scroll, coin or torch replenishment.
Time-specific effects and daily choices such as Old Gods remain explicit
follow-ups unless separately implemented with their exact source rules.

Rest eligibility, including any curse-related checks, is resolved independently
before clicking Complete rest. The utility does not adjudicate those prerequisites,
remove curses or expose unidentified Item secrets. Resource-specific exceptions
such as permanent loss and required penance still constrain what can be reset.

## Implementation plan

### R1 — Pure plan and supported-source coverage

- Add `logic/rest.ts` returning ration candidates, exact intended patches,
  recovery groups, exclusions and manual follow-ups from current source and
  shared preparation. Accept explicit `consumeRation` intent and a selected stack
  only when consuming. Keep it environment-neutral.
- Record recovery classification by exact source UUID with native evidence; read
  quantities/use caps from owned/prepared documents. Inspect all22 native Class
  Abilities and their owning Talent links before classifying their cadence.
  Do not parse English descriptions at runtime as a rules engine.
- Reuse `sourceRef`/`grantSource`, `prepareActorCore`, shared HP reconciliation and
  `wandRestUpdates`. Preserve independent repeated awards and exact Item IDs.
- Explicitly reject noninvertible source/effect writes rather than baking a
  prepared bonus into a base field twice. Unknown-resource reporting must not
  block otherwise valid HP/ration recovery.

### R2 — Recovery provenance without historical guesses

- Extend the existing spell consequence path to persist minimal module-owned
  recovery reason alongside `system.lost` for future module-origin failures:
  rest, penance-required, or unresolved restriction. Include exact casting-source
  identity where necessary; existing casting/grant rules remain authoritative.
- Native/external boolean-only changes and old Items stay unknown. No migration,
  reverse reconstruction from chat, or permanent change to a Spell template.
  Explicit manual Restore controls must retire obsolete recovery metadata too.
- Wizard/Diabolical mishap consequences remain separate. A rest must not undo a
  lasting mishap, permanent loss, sacrifice or timed penance automatically.

### R3 — Caller-bound preview and completion

- Add module `actors/[id]/rest/plan`, `rest/complete` and `rest/status` routes
  through `server/index.ts`; use `requireOwnedActor`, request context checks,
  `source-review` and the existing Actor lock.
- Preview is read-only. Completion re-reads ownership, source revision and
  eligible resource resets. Validate ration identity/quantity only when
  `consumeRation` is true; false must not require a ration or produce a food write.
  Bind that boolean and any selected stack to the preview and operation receipt.
  Reject stale intent before writes; retries preserve the original choice.
- Use a small durable rest receipt under the existing runtime data store, scoped
  to world/Actor/caller/request. Reuse operation patterns; do not build a new
  generic transaction framework. When selected, ration spending precedes benefits. Freeze the
  exact source values and intended absolute updates, then verify each write.
- The SDK does not promise atomic Actor+Item writes or distributed CAS. A partial
  result is partial, not success. On a lost acknowledgement compare exact owned
  source values under the same receipt; never decrement again or replace the
  request blindly. Do not roll back by overwriting independent later edits.

### R4 — One controller/modal, two triggers

- Add `ui/components/RestModal.tsx` and provider state/action in
  `ui/context/ShadowdarkActorContext.tsx`; bind both sheet buttons to that action.
- Reuse `ModuleDialog`, SDK components, notifications and `refreshActor`. Retire
  callbacks on world/user/Actor/context changes. Block duplicate submission and
  conflicting sheet writes during dispatch; refresh after a partial result too.
- Field-local messages, keyboard focus return, narrow-screen layout and pending
  recovery presentation must follow current module conventions (ADR-0003).
  No UUIDs, receipt IDs or internal paths as routine player text.

### R5 — Bounded verification and acceptance

- Extend existing source tests for: successful rest; checked with no ration/zero
  quantity blocked; unchecked with no ration succeeds without inventory writes;
  supported loss/counters; penance/unknown exceptions; broken wand,
  spent scroll, permanent effect preservation; stale source and partial retry.
- Use one mounted workflow covering both openers, ration choice and changed
  HP/spells/uses after completion, both checkbox states and separate recovery/exclusion lists
  with reasons, plus one write-failure/recovery flow. Check390/1280px and
  packaged CSS/UI. Do not multiply suites per class or minor field variation.
- Record disposable native v13/v14 operator results for quantity and mixed
  recoveries. Offline mocks are not native acceptance.
- Update rules, architecture, terse changelog and handoff only after behavior is
  implemented; keep this ADR Proposed until reviewed, then track R1–R5 here.

## Acceptance checklist

- [ ] R1 supported-source plan, optional personal ration consumption and exact quantities.
- [ ] R2 reason-aware loss recovery and historical/manual policy.
- [ ] R3 bounded operation, readback and no duplicate spending.
- [ ] R4 matching buttons, shared modal, Consume ration? checkbox and separate recovery/exclusion lists in both layouts.
- [ ] R5 focused source/mounted/package and native acceptance evidence.

## Review points and explicit exclusions

The modal placement and main ration/HP/reset flow implement the user's request.
Review is specifically needed for the proposed daily-renewal policy, conservative
handling of historical/unknown spell losses. The successful-rest-only scope is
already selected by the user, as are optional personal ration consumption and
separate recovery and exclusion lists. These are product/rules choices, not additional approval requirements
for ordinary implementation details.

No rest code is included yet. Interrupted/failed rests, CON checks, eligibility
adjudication, party-wide rest, managing another Actor's supplies, automated
campfires/encounters/time, food procurement, new magic-item counters, universal
effect expiration and dashboard status design are outside this proposal.
Existing Creator native acceptance and public shell-discard gates remain separate.
