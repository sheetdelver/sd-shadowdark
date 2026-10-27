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
wrong-level/table awards cannot be waived at review. A table roll shows its
actual total and selects the matching native result range; any required choices
within that result still need completing.

Languages must fill the source-defined pools. The spell progression table shows
all levels through your selected level, with a column for each spell tier. Each
cell shows the new choices required at that level, their selected spells and the
cumulative ordinary total. Fill new choices from top to bottom; later choices
remain disabled until earlier levels are complete. Completed choices remain
visible and removable. Removing a spell reopens the earliest unmet allowance of
its tier. On narrow screens, scroll sideways; the level column stays visible.

“No new spells” means that tier's allowance did not increase at this level;
“Not unlocked” means its cumulative allowance is still zero. For example, Wizard
level 6 adds one tier-2 and one tier-3 spell. This follows the core class tables
(pp. 20–25), not a pool that can be spent on any unlocked tier. Fixed and
talent/boon-granted spells are additional and use their own choice controls.
Known spells are disabled in both pickers. Acquisition-level eligibility still
applies to grants. Selections outside a changed Class/level stay visible for removal.

The selected Class owns progression even when it uses another Class's spell
list. Knight of St. Ydris uses Witch spells but its own slower table, reaching
only tier 3. The heading names both Class and list when they differ. A missing or
mismatched casting grant is reported at Class selection with the affected list;
refresh sources and compare the Class/talent with Foundry before changing source
data. Core 0.22.2 fixes stale pack contents that previously caused a false mismatch.
The Creator does not alter source effects or invent a casting grant.
Character creation and advancement stop at level 10 (core rules p. 39).

Each level has its own HP card, stacked in one column. Enter the hit-die result or use the die button
beside the input. **Max** enters that level’s maximum die result; the selected
Class hit die is shown above the cards. Use **Roll all HP** to roll every level. The total below updates automatically, including native HP-roll
advantage, first-level Constitution and applicable talents. Constant HP bonuses
are applied once. Increasing the selected level adds required blocks and keeps
earlier rolls; changing Class clears the old Class dice. Level zero calculates
HP from Constitution without Class dice. Your character starts at full HP.
Conditional/replacing HP effects or possession-dependent history remain unsupported
by this per-level calculation rather than guessed.

Equipment supports current quantities, locations, spent scrolls and wand states.
Enter coins, treasure and gems using the existing inventory controls. These edit
the draft only; no Actor or Item is written before final confirmation. There is
no required starting kit or shopping budget. Optional **Add starting gold**
reuses the level-up Gold controls: roll 2d6 × 5, use Max (60 GP), or enter an amount.
Add applies it to current GP; closing the dialog leaves your money unchanged. Notes use the shared rich-text
editor and retain sanitized formatting.

The procedural review shows identity, final scores/modifiers, grants, languages,
Spells, HP, inventory, money, notes and remaining requirements. Capacity notices
remain informational acknowledgements; progression violations are blocking
errors. Final creation refreshes source/access/context checks and sends one Actor
payload containing all Items. Confirmed creation opens the new character sheet
immediately, as does a successful recovery check. If interrupted, use **Check creation**; an empty
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
