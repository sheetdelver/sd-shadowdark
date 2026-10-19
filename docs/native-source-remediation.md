# Exact-source remediation for incomplete historical characters

ADR-0002 selects diagnosis and current-writer corrections. It does not authorize
operator-world writes. A GM must choose the exact source, preview changes, and
approve them in a disposable copy before any separately authorized live edit.
Never identify a document by name, terminal ID, or a copied origin alone.

| Shape | Required review and minimal edit | Verification |
| --- | --- | --- |
| L01: missing casting grant | Select the exact native Class and its exact fixed spellcasting Talent UUID. Inspect owned/effect disabled, transfer and suppression states. If omission is confirmed, copy that selected native Talent with its complete effects; do not synthesize an effect from the Class name. | Compare native prepared eligibility and every owned Spell action. Verify all existing Items/effects/custom fields unchanged. |
| L02: Spell has no Class refs | Select the exact source Spell or explicitly choose its exact Class references. Preview only that Actor + embedded Item ID's `system.class` change. Preserve the existing description, custom data, effects, lost state and absent provenance. | Re-read source independently and compare cast ability/eligibility with native. Distinct same-name copies need separate review. |
| L04: Knight grant differs | Select release4.0.6 Class `Compendium.shadowdark.classes.Item.0uVUOXKuX9xfJ600` and its exact fixed Talent `Compendium.shadowdark.talents.Item.XRW3jhpTni15hwFc`. Compare the owned effect's changes against that source; confirm the customization is unintended before patching only the reviewed casting entry’s value. Preserve its shape/unknown fields, other changes and effect flags; a whole-array replacement needs separate explicit review of every difference. Native list/grant is Witch; progression remains Knight. | Verify exact Witch list `Compendium.shadowdark.classes.Item.KGnBAFiTiLHZJUND`, Knight limits, and unrelated source unchanged. |

Source-less but complete owned spells need no provenance repair. These ambiguous
shapes are not eligible for automatic bulk migration. Existing effect-key hooks
cannot reconstruct deleted content. There is no caller/render/bootstrap repair
and no invented migration parameter UI. Native GM editing/exact source copying is
the remediation path; retain a before/after source receipt and remove only approved
disposable fixtures. These minimal procedures passed A02-01/03 on disposable native13.351 and14.367
copies with Shadowdark4.0.6; see the [acceptance ledger](audits/2026-10-19-adr-0002-native-acceptance.md#v13-completion-and-final-closeout--october-19-2026).
This evidence does not authorize edits to another character/world.
