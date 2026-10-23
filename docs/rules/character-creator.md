# Character Creator

Use **Tools → Character Creator** to transcribe a paper character into a new
Player Actor at level0–20. Seven pages cover identity, scores, awards, languages/
Spells, HP, possessions and prepared review. Back preserves entries. Editable
entries stay in memory; leaving discards them. Existing Actors are never replaced.

Enter scores/current/maximum HP as **Paper total** when permanent bonuses are
already included. Supported constant additive effects are subtracted to find the
native base, then the complete character is prepared to prove equality. STR16
with two independent +2 awards stores12 and prepares16. **Native base** means
bonuses still need application. Overrides/formulas require explicit base entry;
effects are never disabled to force a match. Equipment changes invalidate review.
Current HP0 is valid; creation never heals or silently clamps HP.

Rolls are optional and explicit. Replacing typed scores requires confirmation;
rolled scores are bases. Optional HP calculation uses known award chronology,
native first-level CON and subsequent die totals. Unknown chronology, HP-changing
effects or equipment CON/HP bonuses require direct paper HP. Calculating maximum
HP preserves entered current HP.

Fixed grants appear automatically. Record each actual Talent/Boon independently,
including repeatable awards, with acquisition level when known. Native sources
that explicitly require duplicate rerolls cannot be repeated. Unknown levels remain
explicit in creator metadata; native Talent level stays0 rather than the final
level. Resolve stat allocations and mastery/advantage targets separately for
every grant. Table selections retain table/result identities and complete bundles.
Unsupported instructions explain the missing follow-up. Record the actual readable
award separately when its table history cannot be represented, or preserve prose
in notes. Arbitrary custom effects/raw Actor JSON are not creator inputs.

Fixed Spells become actual owned Items. Additional choices retain exact source,
casting Class and acquisition level without consuming ordinary quotas or creating
another Class’s progression. Shune follows the approved [half-level rule](spell-grants.md).
Unknown acquisition-sensitive choices and unavailable tiers block creation.
Ordinary Spell inventory grants no casting permission. Native4.0.6 defines
progression only for levels1–10; levels11–20 permit manual transcription with an
explicit warning. No allowances are extrapolated or copied from level10.

Languages show fixed grants and independent native pools. Equipment is actual
current inventory with quantity/location and supported spent-scroll or wand
loss/breakage state. There is no required starting kit, budget or gold roll.
Native effects, links and source identities remain intact.

Review compares entered, stored and prepared numbers and lists all owned Items.
Exact award-count, ordinary Spell, language or capacity deviations need explicit
acknowledgement. These records cannot change management rules, grant casting
permission, waive source access or resolve missing mechanical choices. Notes are
descriptive text, escaped before native HTML storage.

Final creation repeats source/access/context review and sends one Actor payload
containing its Items. Duplicate submissions share a saved operation. If interrupted,
use **Check creation**. Only a positive exact marked Actor source can settle an
uncertain outcome; an empty list never proves failure. Changed/ambiguous/inaccessible
evidence requires GM review and never causes automatic replacement. Confirmed
creation offers **Open character** and **Start another character**. Receipts persist;
editable drafts do not. The queue makes no cross-process transaction claim.

Current evidence is offline source, mounted-browser and packaged-contract testing.
Actual native13/14 marker/default normalization and operator usability remain
[ADR-0005 CC-07](../adr/0005-character-creator.md) gates. Creator-owned Dashboard
navigation uses shared confirmation. The public tool SDK has no discard guard for
navigation initiated by the surrounding shell; keep this page open while editing.
