# Character Creator

Use **Tools → Character Creator** to enter an existing character in seven stages.
Back preserves entries while this page remains open. Existing Actors are never
replaced. The final review follows the same stages and links incomplete choices
back to their step; there is no separate Reviewed banner. Next and forward stage
navigation require all earlier required entries to be complete. Errors appear
beneath their field or choice group; numeric inputs reject invalid ranges. Back remains
available for corrections. Background and alignment are required at level zero
as well as higher levels (core rules p14); deity is optional at level zero.
The adventuring Class picker excludes Level 0.

Choose an ancestry to enable the name die. Enter scores from your sheet or roll
all/individual scores. Typed final totals are reconciled with additive talent
bonuses internally; rolled scores receive those bonuses. The ordinary form does
not expose Foundry storage values. Clicking a score die or Roll all scores replaces those values immediately.
A replacing or conditional effect whose original score cannot be recovered is
reported rather than guessed.

Talents and boons follow the selected Class, ancestry, Patron and level. Fixed
grants are automatic. Each earned award fills one level entitlement; repeatable
awards remain independent, while native duplicate-reroll rules are retained.
Resolve each award's stat allocations, target and Spell choice. Missing/extra or
wrong-level/table awards cannot be waived at review.

Languages must fill the source-defined pools. Ordinary Spells follow the Class
list and tier allowances; fixed and talent/boon-granted Spells are separate and
cannot be selected again. The same restrictions are checked before creation.
The level selector supports 0–20, but the supplied native caster progression
only defines levels 1–10. A caster above its available source data cannot be
completed until supported progression data exists; limits are never extrapolated.

Each level has its own HP card, stacked in one column. Enter the hit-die result or use the die button
beside the input, or use **Roll all HP** above the cards. The total below updates automatically, including native HP-roll
advantage, first-level Constitution and applicable talents. Constant HP bonuses
are applied once. Increasing the selected level adds required blocks and keeps
earlier rolls; changing Class clears the old Class dice. Level zero calculates
HP from Constitution without Class dice. Your character starts at full HP.
Conditional/replacing HP effects or possession-dependent history remain unsupported
by this per-level calculation rather than guessed.

Equipment supports current quantities, locations, spent scrolls and wand states.
Enter coins, treasure and gems using the existing inventory controls. These edit
the draft only; no Actor or Item is written before final confirmation. There is
no required starting kit or shopping budget. Notes use the shared rich-text
editor and retain sanitized formatting.

The procedural review shows identity, final scores/modifiers, grants, languages,
Spells, HP, inventory, money, notes and remaining requirements. Capacity notices
remain informational acknowledgements; progression violations are blocking
errors. Final creation refreshes source/access/context checks and sends one Actor
payload containing all Items. If interrupted, use **Check creation**; an empty
lookup never proves failure and must not cause automatic replacement. If a
created character has differing saved details, use **Review created character**
to open it. **Verification details** lists the differing fields; checking again
does not create another character. Empty legacy effect durations are compared
using Foundry v14’s permanent-effect shape; this does not ignore real duration
changes. After completion, returning to the Creator starts a fresh form rather
than reopening the previous completed request.

Native v13/v14 acceptance remains ADR-0005 CC-07. Creator's own Back uses the
shared discard confirmation; shell-wide navigation protection remains a separate
public SDK gap. Keep the page open while editing.

## Ability-score guidance

The Player Quickstart's Stats section uses 3d6 in order, optionally rerolling the
whole set when none reaches14. No official standard array is supplied; an array
mode would require a separately chosen house rule. Manual paper scores remain
supported. Key-ability hints use the exact core Fighter/Thief identities plus
the selected native Class casting ability and its fixed Class Ability check
fields. General CON/attack guidance is informational and imposes no stat minimum.
