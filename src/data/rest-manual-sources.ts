/** Native 4.0.6 prose-only daily benefits with no Class Ability use counter.
 * Reviewed source identities, not runtime prose parsing. Never auto-create a
 * resource field or expose the alternate identity of an unidentified Item.
 * Class Ability-linked talents and extra-use grants are handled by their counters.
 */
export const MANUAL_DAILY_SOURCES = new Set([
    "Compendium.shadowdark.magic-items.Item.T7VGBPF272LjO0jB", // Alabaster Destrier
    "Compendium.shadowdark.magic-items.Item.DyzDQtoj6Y7Qv1AE", // Bag of Badgers
    "Compendium.shadowdark.magic-items.Item.SuPwL1LQKe8DdaRq", // Blade of Vengeance
    "Compendium.shadowdark.magic-items.Item.z4eAFex0bk8qiQWl", // Cloak of Elvenkind
    "Compendium.shadowdark.magic-items.Item.RbAtv4hRODYmOoit", // Greataxe of the Horde
    "Compendium.shadowdark.magic-items.Item.T66dAbuDLi41JgOZ", // Hat of the Hound
    "Compendium.shadowdark.magic-items.Item.HxnAZ36Mm2jSDF6p", // Helm of Mind Reading
    "Compendium.shadowdark.magic-items.Item.bN40eJ3tMTx1R4zT", // Hourglass of the Black Sands
    "Compendium.shadowdark.magic-items.Item.Nz0Wzbzgwa74gEgQ", // Memnon's Blazing Javelin
    "Compendium.shadowdark.magic-items.Item.5gdNWsFJjgmtZroK", // Memnon's Blazing Javelin (Completed Set)
    "Compendium.shadowdark.magic-items.Item.5vaHRsgVMO4v6ePR", // Memnon's Discordant Blade
    "Compendium.shadowdark.magic-items.Item.4BkbHe0cL8Zvsd7a", // Memnon's Discordant Blade (Completed Set)
    "Compendium.shadowdark.magic-items.Item.SaFi5epjplNcIBhL", // Memnon's Entropic Armor (Completed Set)
    "Compendium.shadowdark.magic-items.Item.u9WwthDIOfRjI0Px", // Memnon's Entropic Armor
    "Compendium.shadowdark.magic-items.Item.v2khQSVLOXjdYA4j", // Moonwrought Chainmail
    "Compendium.shadowdark.magic-items.Item.VBGCekyAG0Z5wsqq", // Nightcloak Armor
    "Compendium.shadowdark.magic-items.Item.WUX1XxV0f7mknPSq", // Onyx Destrier
    "Compendium.shadowdark.magic-items.Item.t4RYKztP70zmAbGD", // Pearl of Power
    "Compendium.shadowdark.magic-items.Item.0NAHhZTnQxABY5KR", // Pipe of the Rolling Hills
    "Compendium.shadowdark.magic-items.Item.H7bYrQvVPrcT2WNA", // Pipes of the Sewers
    "Compendium.shadowdark.magic-items.Item.dGfhC5esJRavsNGW", // Ring of Feather Falling
    "Compendium.shadowdark.magic-items.Item.9esQ9xXLB2gHf0Sf", // Ring of Invisibility
    "Compendium.shadowdark.magic-items.Item.slnpt7AznlHzLJva", // Ring of Ramlaat
    "Compendium.shadowdark.magic-items.Item.dupIuIdb8hVNC5gh", // Robe of the Druid
    "Compendium.shadowdark.magic-items.Item.8RyBRclanxBD4pMx", // Shield of the Crusader
    "Compendium.shadowdark.magic-items.Item.fntDmrpNulld7y2r", // Shield of the Lion
    "Compendium.shadowdark.magic-items.Item.98cxnRdtTLv0Onka", // Shortsword of the Thief
    "Compendium.shadowdark.magic-items.Item.jEeDexWHYy7wKsfa", // Staff of Healing
    "Compendium.shadowdark.magic-items.Item.EiyxS6MOvGlZgG65", // Staff of The Cobra
    "Compendium.shadowdark.magic-items.Item.8KfATAoAfi2MRGgT", // Tome of Gehemna
    "Compendium.shadowdark.magic-items.Item.REKbDm3ShTNQouM2", // Trident of the Seas
    "Compendium.shadowdark.magic-items.Item.C1rI56xY6qTRDHyj", // War Horn of the Angels
    "Compendium.shadowdark.magic-items.Item.Wpswh8YGofiuBCME", // Well of Many Worlds
    "Compendium.shadowdark.magic-items.Item.nn46QlpIOUb9w7x6", // Wraith Chain
    "Compendium.shadowdark.talents.Item.FIHNdRhD6DHFxSkC", // Add Wisdom to Roll
    "Compendium.shadowdark.talents.Item.6iJ6ETUAKC7DR0aT", // Advantage on Melee Attacks
    "Compendium.shadowdark.talents.Item.tfM77lqANyzu0kMy", // Duality
    "Compendium.shadowdark.talents.Item.vWtHRiL8lNiisrXy", // Force GM Reroll
    "Compendium.shadowdark.talents.Item.H6gRb0879zMVYdiO", // Force Morale Check
    "Compendium.shadowdark.talents.Item.rtCyEISzbgf6ZuJb", // Hypnotize
    "Compendium.shadowdark.talents.Item.A8Siwy6S27LwEkx5", // Old Gods
    "Compendium.shadowdark.talents.Item.IbWH7TwcOPMJt842", // Read Mind of Creature
    "Compendium.shadowdark.talents.Item.A9nJ9MYVegFPDwva", // Slime Form
    "Compendium.shadowdark.talents.Item.zkOiprnKS5uttiO6", // Stealthy
    "Compendium.shadowdark.talents.Item.EUE1pFpmreF9ZMKx", // Teleport
]);
