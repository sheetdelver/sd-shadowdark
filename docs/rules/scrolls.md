# Scrolls in SheetDelver

Scrolls appear in **Spells from items**, separate from known spells and their
progression limits. Their linked spell determines casting requirements; being
listed does not bypass casting-class or source-access rules.

The user verified the core rulebook's **Scrolls and Wands**, p49: the spell must
be on the caster's list but need not be known. Casting requires the normal
spellcasting check, DC10 + spell tier. Noncasters need an explicit exception,
such as Magical Dabbler. The earlier proposal to let every character cast from
scrolls was withdrawn after checking the book; no universal ability fallback or
class bypass is implemented. Owning an unusable scroll still makes it visible.

## Critical failures and wands

Casters with mishap tables roll on the appropriate table after a critical
failure, including casting from a scroll. Ordinary wand failure marks its spell
lost until a full rest; a critical failure also breaks the wand and triggers the
caster's applicable mishap. Clearing lost spells at rest does not repair a broken
wand. Native multi-spell wands retain independent lost entries; broken blocks all.

Shared action preparation selects the mishap tradition from the exact Class used
for casting, including saved talent/boon spell grants. Magical Dabbler uses Wizard
mishaps as its source explicitly directs. The bundled Wizard tables cover tiers
1–2, 3–4 and5. Witch casting requires Diabolical mishaps; these tables are absent
from the pinned native packs. SheetDelver reports that required manual resolution
instead of substituting a Wizard table. Priest/Seer penance is not a Wizard mishap.
Custom casting traditions without an exact supported mapping are not guessed.

The route rolls the available table through Core's dice/chat runtime after the
casting result and inventory writes, preserving speaker and roll visibility.
The result text is posted to chat. Damage and instructions inside a result
(including additional rolls) remain for the player/GM to resolve; table prose
does not authorize automatic Actor mutations. The saved action receipt prevents
duplicate mishaps on retry. Unreadable tables or uncertain roll responses produce
a warning without repeating the cast or restoring the consumed scroll/broken wand.
Manual totals establish no natural die and therefore do not trigger a critical.

Native Shadowdark 4.0.6 includes two old compendium scrolls as `Basic` Items:

| Source in `shadowdark.magic-items` | Item |
| --- | --- |
| `N27A6nb0epkHZ3lR` | Scroll of Burning Hands |
| `mXkpNk8z0eZU8kKj` | Scroll of Hold Portal |

`logic/scrolls.ts` recognizes their exact recorded origins and reads the single
explicit UUID link in the actual description. Modern `Scroll` Items use
`system.spellUuid`. Their linked documents are resolved through caller-bound
reads. An absent, ambiguous or inaccessible link is unavailable; an Item name
alone never establishes a spell or scroll identity. The old inventory Add dialog
discarded source identity. For those historical copies only, a Basic magic Item
with no recorded origin is recognized when its name, artwork path and complete
linked description exactly match one of these two native templates. A conflicting
recorded origin or partial content match does not qualify. This establishes the
legacy casting capability without inventing provenance or writing a repair.
Modified source-less items still need explicit source/type correction.
The original Item type and description are preserved. Future Gear Add operations
use the shared owned-copy helper, retaining source metadata, effects and flags.

## Spent instead of deleted

The user selected this SheetDelver policy: a scroll is single-use, but the player
discards the spent Item manually. This deliberately replaces native automatic
Item deletion for SheetDelver scroll actions. It does not change Potion or Wand
behavior, known spell ownership, or native Foundry UI behavior.

Casting records `flags.shadowdark.sheetDelver.scrollSpent: true` on the exact owned
Item before attempting the result. The existing action receipt and Actor queue
govern that prerequisite. A refused write prevents rolling; an uncertain write or
result retains the receipt for review and does not authorize another result.
Successful and failed casts both leave the Item spent. New requests and stale
cards are rejected by the same server action preparer. Completed request retries
return the saved result instead of casting again.

The inventory, item card and spell list show **Spent**. Cast remains disabled;
the normal discard control remains available. No automatic deletion, quantity
rewrite, source conversion or rest-based recharge is added. The flag marks the
owned Item as spent, matching the native consumption unit rather than inventing
stack splitting. The custom flag is enforced by SheetDelver; this is not a hook
installed into Foundry's own casting UI.

Evidence uses the static native 4.0.6 sources at
`9677d16b3903b3b640f00d4efd48249142ac8334`, controlled action routes and mounted UI
checks. See ADR0003/audit SD-UI20 for verification and operator review status.

## Legacy wand cards and state

The pinned native magic-items pack also stores Wand of Blind/Deafen as a
`Weapon`, and Wand of Unlife and Wand of Warding as `Basic` Items. SheetDelver
recognizes these three exact origins through `logic/wands.ts`. Historical copies
without origins require the complete native type/name/artwork/description
signature and magic-item classification. Conflicting origins or partial matches
do not qualify. This is capability recognition, not a stored-type migration.

The actual description's Spell UUIDs supply caller-readable spells. Cards and
Spells from items expose the same actions as modern Wands, without fabricated
weapon damage or melee attacks. Blind/Deafen is a Priest spell in the pinned
source; possession alone does not permit another class to cast it. The Unlife and
Warding curse descriptions remain visible for manual adjudication.

Modern Wands keep native `system.spells[].lost` and `system.broken`. Legacy types
lack those schema fields, so their failure state uses
`flags.shadowdark.sheetDelver.wand` with exact `lostSpells` UUIDs and `broken`.
These flags govern SheetDelver actions, not native Foundry casting. Failed spells
remain unavailable and critical failure blocks the entire wand. Items are retained.
An unbroken wand with lost spells offers **Restore after rest** on its card; this
is the player's explicit acknowledgement of a full rest, not automatic rest
tracking. It clears spell loss only and never repairs a broken wand. Modified
source-less items need explicit source/type correction rather than guessed links.
