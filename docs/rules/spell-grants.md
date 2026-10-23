# SheetDelver spell-grant handling

This document records the Shadowdark module's handling decisions, including
interpretations needed where source prose does not fully specify automation.
It is not official Shadowdark errata. Scope: ADR-0003, review finding SD-UI16d.

## Shune the Vile: half-level spell tier

The Shune boon in *Cursed Scroll 1: Diablerie* specifies a wizard spell whose tier
is half the character's level and explicitly grants casting with INT. The reviewed
entry does not specify rounding or a minimum tier. The same wording is present in
Foundry Shadowdark 4.0.6's `Learn a Wizard Spell` talent.

**SheetDelver ruling, approved October 22, 2026:** divide the level at acquisition
by two, round down, and use a minimum tier of 1:

```text
tier = max(1, floor(acquisitionLevel / 2))
```

| Level when gained | Spell tier |
| --- | --- |
| 1–3 | 1 |
| 4–5 | 2 |
| 6–7 | 3 |
| 8–9 | 4 |
| 10 | 5 |

This is an exact tier, not “any tier up to” that number. It applies each time the
boon is gained. The chosen Spell and acquisition level are recorded with the
grant; later leveling does not replace or increase the tier of that Spell.
A new acquisition beyond the available spell tiers requires a separate ruling;
SheetDelver does not silently clamp it to tier 5. A non-spellcaster may receive
this boon and cast the selected spell with INT. Another active casting class or
item-only casting ability does not override the recorded grant's casting class.

## Other native grants

The implementation recognizes exact native source identities, including copied
talents carrying those origins. Names alone never establish a grant.

| Source | SheetDelver handling |
| --- | --- |
| Turn Undead talent | Automatically add the exact Turn Undead Spell; use the Priest casting class (WIS). |
| Learn Wizard Spell | One additional Wizard Spell from a tier already known or available through the current Class progression; INT. |
| Learn Witch Spell | One additional Witch Spell from a tier already known or available through the current Class progression; CHA. |
| Learn Seer Spell | One additional Seer Spell from a tier already known or available through the current Class progression; WIS. |
| Learn Extra Spell | One additional Spell from an established known list/tier or current casting Class progression; retain the selected list's casting class. |

Ordinary spell choices in the same advancement establish the tiers being learned.
Each independent talent/boon grants one distinct choice, even when two rolls use
the same template. Mixed grants must each receive an eligible choice; the order
of selection does not matter. Already-owned Spells, fixed granted Spells and
ordinary choices in that advancement cannot be chosen again.

These choices become actual owned Spell Items in the creation/advancement plan.
The saved `flags.shadowdark.spellGrant` records the exact grant source, casting
Class and acquisition level. The shared prepared model uses that provenance to
exclude bonus Spells from ordinary quotas and supply casting permission, even
when the Actor's Class is not a spellcaster. It does not add another Class's
ordinary progression table or synthesize native Active Effects. These are
SheetDelver rules for automating the source prose, not a claim that the native
Foundry browser performs identical automation.

The audit covers all five native Learn Spell templates, their table references,
and the fixed Turn Undead grant. Native class Spellcasting talents retain their
existing effects. Magical Dabbler remains an item-only permission. Spellcasting
bonuses/advantage, Magic Missile Advantage, spell links in descriptions and
Learning Spells do not by themselves create an owned Spell or a new casting list.
The scroll-learning workflow remains separate.

## Existing Actors and unavailable data

Missing fixed grants can be fulfilled automatically through the owner-only grant
operation. That operation uses caller-readable sources, an Actor queue and durable
receipts; read-only views and observers never write. An unknown write outcome does
not authorize creating another copy.

Choice grants require a player choice. SheetDelver does not invent a selection for
an old talent whose chosen Spell is missing, nor guess which historical Spell
belongs to which grant. Existing custom/duplicate/unlinked Spell Items are
preserved. Historical choice recovery is not automated by this pass. Unavailable
Class/Spell sources cannot be replaced by same-name documents or privileged data.

## Provenance and implementation

- Published reference: *Cursed Scroll 1: Diablerie*, Shune the Vile boon table,
  page 18; [publisher product page](https://www.thearcanelibrary.com/products/cursed-scroll-zine-vol-1-diablerie-print).
  The wording was cross-checked against an [available transcription](https://studylib.net/doc/28296670/cursed-scroll-zine-%231-diablerie)
  and the native talent below. No official rounding clarification is claimed.
- Native source: `Muttley/foundryvtt-shadowdark`, release 4.0.6,
  commit `9677d16b3903b3b640f00d4efd48249142ac8334`;
  Shune talent `Compendium.shadowdark.talents.Item.mgRrWET5MEaGLVNo`.
- Shared rule authority: `src/logic/spell-grants.ts`. Both the picker and final
  writer use this policy; server validation resolves the selected sources again.
- Verification: `src/tests/native-parity.test.ts`,
  `src/tests/creation-validation.test.ts` and mounted consumer coverage in
  `src/tests/collection-consumers.browser.mjs`. Offline checks establish module
  behavior, not native browser or operator acceptance.
