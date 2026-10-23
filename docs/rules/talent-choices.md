# SheetDelver talent choices

This describes Shadowdark module handling for creation and advancement, including
talents and boons. It complements [spell grants](spell-grants.md). Native evidence
is Foundry Shadowdark 4.0.6, commit
`9677d16b3903b3b640f00d4efd48249142ac8334`: the talents and rollable-tables packs,
`system/src/documents/ActiveEffectsSD.mjs`, and predefined effects. Controlled
fixtures establish module behavior; they are not native-client acceptance.

## Required effect targets

The native talent pack contains four templates with unresolved effect targets:

| Talent | Required selection |
| --- | --- |
| Weapon Mastery | Weapon from the authorized choice catalog |
| Armor Mastery | Armor from the authorized choice catalog |
| D12 Weapon Damage Die | Weapon from the authorized choice catalog |
| Spellcasting Advantage | One known spell, including spells selected in this advancement |

Each independent grant needs its own choice. The shared resolver substitutes the
target in native effects and retains their values and other fields. It supports
both legacy `changes` and modern `system.changes` effect representations.
Incomplete or invalid selections fail validation before document writes.

Spellcasting Advantage's native description says to choose a spell you know.
The native effect picker lists the compendium more broadly; SheetDelver restricts
this choice to actual owned or planned Spell Items, including fixed automatic
grants. Advantage itself neither creates a Spell nor grants spellcasting ability.
Changing planned spells invalidates a choice that is no longer eligible.
Magic Missile Advantage already names its target and requires no extra choice.

## Stat increases

- The twelve native fixed +1/+2 talents across Strength, Dexterity, Constitution,
  Intelligence, Wisdom and Charisma retain their authored effects. Two rolls of
  the same template are two grants, not duplicate references to discard.
- “+1 to two stats” requires two different stats. The Warlock table's
  `DistributeTwoStatsOnlyOnce` flag preserves this restriction through the picker
  and final writer.
- An unrestricted two-point distribution allows +2 to one stat or +1 to each of
  two stats. Bard distribution and the native “Distribute to Stats” table choice
  use this rule. A RollTable instruction becomes a Talent containing the selected
  native ability-improvement effects; it is not copied as an owned RollTable.
- Native named options remain distinct. For example, Wizard's +2 Intelligence
  versus +1 Spellcasting choice does not become a generic stat distribution.

Every distribution is validated separately using `logic/stat-choices.ts`. Totals
must match, per-stat limits apply, and negative, fractional or unknown-stat
allocations are rejected. One grant's allocation is never applied to another.
The advancement request carries ordered `statChoices`, one allocation per grant.
An older aggregate selection remains supported for a single grant only; multiple
grants require separate selections rather than an inferred split.

Source resolution, caller access, final creation revalidation and durable
advancement receipts still apply. This correction does not retroactively alter
existing talents or invent historical choices. See ADR0003 and audit SD-UI18 for
the maintained test matrix and pending operator review.
