# Resting workflow audit

Date: 2026-10-26
Status: Audit complete; proposed implementation awaiting review
Decision: [ADR-0006](../adr/0006-shared-character-rest.md)
Baseline: module `5fade4e`, version0.9.6; Core0.22.0, SDK3.8/UI3.6.

## Scope and evidence

The user requested a campfire Rest button in both character sheets, one shared
modal, ration consumption and applicable recovery. This audit is read-only;
there is no new rest runtime, live Foundry access or Actor mutation. Crawling Kit
expansion and the preceding HP/status fixes were committed first as `5fade4e`.
The module worktree was clean at that checkpoint. No push/release occurred.

**User scope clarification (October 26):** this utility is invoked only after a
successful rest. Optionally consume one personal ration, recover HP and consolidate eligible daily/
rest resets. Interruptions, CON checks and failed-rest consumption are handled
independently at the table. The earlier failed-rest selector and roll integration
are superseded; they are not implementation or test obligations. Rules evidence
below remains reference context, not a requirement to simulate rest eligibility.

**Personal ration clarification:** Consume ration? is checked by default. With it
checked, require and consume one personal carried ration; unchecked, allow recovery
without any personal ration or food write. Food may be provided elsewhere; no
other Actor is mutated or additional explanation required. In both modes show two
separate lists: Will reset names the resources being restored (with before/after
values where useful); Will not reset names exclusions and their reasons (penance,
broken wand, spent scroll, etc.). Empty lists get a short empty state. This supersedes the original unconditional personal-ration gate.

Native reference: Shadowdark4.0.6, commit
`9677d16b3903b3b640f00d4efd48249142ac8334`, read from the static checkout.
References below are paths in [that source tree](https://github.com/Muttley/foundryvtt-shadowdark/tree/9677d16b3903b3b640f00d4efd48249142ac8334).
This is source evidence, not native v13/v14 acceptance.

| Evidence | Finding |
| --- | --- |
| `data/packs/quickstart-guides.db/resting__eESogCwLJ4JAwr7q.json` | Rest needs a ration and eight hours' sleep; routine watch is allowed. Each stressful interruption requires DC12 CON. Failure still spends the ration but grants no recovery. Success restores all lost HP and nonpermanent stat damage; some resources recover. |
| `data/packs/quickstart-guides.db/casting_spells__1NetKQ878MMjyF89.json` | Ordinary failed spells recover after rest. Wizard critical failure also needs its mishap resolution; priest critical failure needs penance **and** successful rest. |
| `data/packs/talents.db/spellcasting__seer___Qu0KqU3KzzRS1oer.json` | Seer ordinary failure recovers after rest, critical failure requires Seer Penance; its temporary sacrifices can last weeks. Temporary does not necessarily mean rest-removable. |
| `system/src/models/items/ClassAbilitySD.mjs` | Native `limitedUses`, `uses.available/max`, `lost` and `loseOnFailure` exist; there is no universal recovery-period field. |
| `system/src/models/items/SpellSD.mjs`, `_fields/itemFields.mjs` | Native spell loss is a boolean; it does not retain the loss reason or completed penance. |
| `system/src/models/PlayerSD.mjs`, `attributeModel` | Ability scores have a value, not a separate recoverable-damage ledger. A low score alone cannot establish temporary damage. |
| `data/packs/gear.db/rations__GX6OmWQiE7MzTmjX.json` | Rations template quantity3, three per slot. One rest consumes one unit, not the entire template bundle. |
| `data/packs/gear.db/crawling_kit__fJHwwn6TEfbdr8CM.json` | Kit links to the ration bundle. Checkpoint expansion now supplies actual usable ration Items. |

The author's [official rules FAQ](https://www.thearcanelibrary.com/blogs/shadowdark-blog/shadowdark-rules-faq)
clarifies that a stabilized unconscious character can be fed a ration and recover
through rest. Zero HP is therefore not an automatic refusal. This does not make
rest a resurrection or resolve an active death timer.

A campfire is optional lighting: the resting text describes combining three
torches into one eight-hour fire. The requested campfire **icon** does not authorize
spending torches, adding a light, advancing world time or running encounters.

## Existing implementation and reuse

| Area | Current behavior | Reuse / gap |
| --- | --- | --- |
| Sheet host | Both layouts share `ShadowdarkActorProvider` | One modal/controller there; each layout gets a trigger only. |
| Modal | Existing `ModuleDialog` | Retain module appearance, focus and stacked-modal handling. No new modal design, CON roller or raw browser confirmation. |
| Source and preparation | Caller-bound actor view, `prepareActorCore`, shared item views | Preview actual owned items, current/max HP and existing use totals. Do not implement a second formula engine. |
| HP update | Existing source patch and refreshed projection | Rest must plan the source value that yields the prepared maximum; detect noninvertible effects rather than copying a modified total blindly. |
| Spells | `SpellsTab` toggles `system.lost`; `planConsequences` also writes only that boolean | No durable reason on an Item. Historical ordinary and penance loss are indistinguishable. |
| Wands | `isWand`, `wandBroken`, `wandSpells`, `wandRestUpdates` | Already supports modern/legacy shapes and refuses broken-wand restoration. Reuse exactly. |
| Abilities | `AbilitiesTab` has manual restore/uses controls; actions spend uses | Rest orchestration is absent. Recovery cadence must come from exact sources, not `limitedUses` alone. |
| Operations | Caller runtime, `withActorLock`, source-review tokens and durable request receipts | Reuse these patterns for a small rest operation; no new Core transport/cache or generic workflow engine. |
| Effects | Independent source/effect IDs and existing effect operations | No generic "rest removes this" contract or safe baseline reconstruction for arbitrary manual stat edits. |

No general native rest executor or auto-recharge method was found in the examined
4.0.6 model/sheet/app source. Existing native UI provides individual loss toggles.
A rest button must therefore implement the documented rules through the public
SDK; invoking an imagined Foundry rest method is not a solution.

## Recovery coverage and exceptions

The native class-abilities pack has **22 Class Ability documents**: **15** use
limited counters and **7** are lost on failure. Folder documents were excluded.
Herbalism's five remedies and Presence's two abilities have explicit rest text
in their owning talents (`ZjCvQZ7k4hBa9y2I`, `J4KYu5M32T81yE1f`). Those links are
stronger evidence than names or `loseOnFailure` alone.

Daily examples include Omen (`pRO1kFMnFkkcYOgC`), Charge (`Ecajh7eY7lBEHuMv`),
Flourish (`6snDwCm38HjvO1uv`), Relentless (`z5uKTDf4wtkipQ4s`), Smoke Step
(`yDByoMchtApfpKcS`) and Demonic Possession (`dsFmHTTuERiQePky`). Their owning
talents state daily uses. A registry may classify cadence by exact source, but
must take counts from the current owned/prepared data, including extra-use grants.
The remaining limited abilities need the same source check before auto-selection.

A lexical source survey found rest/day-related prose in 20 Talent documents,
37 magic-item documents and two Spell documents. These counts are discovery
candidates, **not 59 automatic resets**. Examples explain why:

- Old Gods (`A8Siwy6S27LwEkx5`) asks for a new choice after resting; it is not a counter reset.
- Ring of Invisibility (`9esQ9xXLB2gHf0Sf`) can ruin rest through its curse.
- Necrotic Mace of Withering (`r4V3eAGkZ1klmFe7`) can require a WIS check before any benefit.
- Pearl of Power (`t4RYKztP70zmAbGD`) has a daily recovery benefit in prose but no universal native use field.
- Some penances expire after a week or longer; permanent sacrifices must never be restored.

The planner must list supported automatic changes and unresolved/manual entries
separately. Never invent a use counter, clear all effects, infer recovery from an
item's English name, or interpret every negative effect as temporary damage.
Unidentified item curses must not be leaked through player-visible warnings.

## Findings and recommended disposition

| ID | Finding | Proposed action |
| --- | --- | --- |
| REST-01 | No shared rest workflow | Shared provider-owned modal and two campfire triggers; ordinary sheet styling. |
| REST-02 | Rations are quantities within bundles | Consume ration? defaults checked: select a personal carried stack, spend exactly1 and retain empty Item. Unchecked permits recovery with no ration/food write. Validate the stack only when consuming. |
| REST-03 | Spell loss lacks recovery reason | Add minimal reason metadata for future module-origin spell failures; historical/unknown losses need explicit eligibility confirmation. Never clear known penance/permanent restrictions automatically. |
| REST-04 | Limited uses does not establish cadence | Classify exact native sources with evidence; use current effective caps, not pack defaults. Unknown/custom/prose-only resources remain visible manual follow-ups. |
| REST-05 | Raw stats/effects lack loss history | Only proven rest-recoverable state can be removed/reset automatically. Report other damage and GM adjudication; do not guess original scores. |
| REST-06 | Recovery spans multiple documents | One request identity bound to the consumption choice, ration first only when selected, absolute planned values, per-write readback, no replay of uncertain spending. Existing SDK has no atomic Actor+Item transaction. |
| REST-07 | Rest outcome has prerequisites outside this utility | User-selected successful-rest completion only. Player/GM resolve interruptions, checks and eligibility independently; no outcome selector, eligibility checklist or failed-rest spending path. Original outcome proposal superseded. |

## Validation plan and carried work

Implementation should add a compact set of behavioral cases to existing suites,
not a separate test suite per resource: successful completion, checked/no-ration rejection, unchecked/no-ration recovery,
penance/unknown loss, supported daily ability plus broken wand/spent scroll,
and partial readback/retry. Mount both sheet triggers and the shared modal at
phone/desktop sizes; check focus, consumption choice, ration selection, visible
exclusion reasons, recovery and refreshed
HP/counters. Native operator acceptance must exercise a disposable v13/v14 Actor
with ration quantities and mixed recoverable/excluded items.

The prior [Creator audit](2026-10-23-character-creator-workflow.md) retains its
verified evidence. Its unresolved CC-R03 public shell-discard hook and CC-R04/CC-07
native Creator/recovery acceptance remain open; this rest proposal neither closes
nor reopens prior accepted sheet/advancement gates. Core dashboard status styling
remains deferred (local DW-22). No version bump or release is selected.
