// Exact native 4.0.6 content signatures (9677d16), for historical Gear Add copies.
export const LEGACY_WANDS = [
    {
        "uuid": "Compendium.shadowdark.magic-items.Item.yyUwr6H9imWcJ9YS",
        "type": "Weapon",
        "name": "Wand of Blind/Deafen",
        "img": "icons/weapons/wands/wand-gem-purple.webp",
        "description": "<p>@UUID[Compendium.shadowdark.spells.ItoZZ0nli29N5d7G]{Blind/Deafen}</p><p>DC 12</p>"
    },
    {
        "uuid": "Compendium.shadowdark.magic-items.Item.gqSggLFDj78yoPW2",
        "type": "Basic",
        "name": "Wand of Unlife",
        "img": "icons/weapons/wands/wand-skull-horned.webp",
        "description": "<p><em>The knobby finger-bone of a swamp troll steeped in acrid embalming fluid.</em></p><p><strong>Benefit.</strong> This wand contains the spells @UUID[Compendium.shadowdark.spells.Item.M702ErO4KOtMJzsK]{animate dead} (pg. 54) and @UUID[Compendium.shadowdark.spells.Item.uNxbpd7fENzDUxfd]{create undead} (pg. 58).</p><p><strong>Curse.</strong> Each time you use the wand to cast a spell, you take [[/r 1d4]] points of Constitution damage. If you reach 0 Constitution from this effect, you die and turn into a zombie.</p>"
    },
    {
        "uuid": "Compendium.shadowdark.magic-items.Item.P921JRq5leqOWpwv",
        "type": "Basic",
        "name": "Wand of Warding",
        "img": "icons/weapons/wands/wand-carved-stone-shard.webp",
        "description": "<p><em>A thin, weighty rod of dark iron inscribed with spiraling runes.</em></p><p><strong>Benefit.</strong> This wand contains the spells @UUID[Compendium.shadowdark.spells.Item.6N33hyLWYZCRgkeX]{dispel magic} (pg. 59) and @UUID[Compendium.shadowdark.spells.Item.P9LFIH0PW4Zlx3RG]{protection from energy }(pg. 68).</p><p><strong>Curse.</strong> Each time you fail a spellcasting check with this wand, you also lose the ability to cast a random spell you know until you complete a rest.</p>"
    }
] as const;
