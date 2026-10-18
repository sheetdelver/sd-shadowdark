/** Shadowdark 4.0.6 WeaponSD / NpcAttackSD source fields. No live dependencies. */
export const propertyNames = {
    'Compendium.shadowdark.properties.Item.two': 'Two-Handed',
    'Compendium.shadowdark.properties.Item.versatile': 'Versatile',
    'Compendium.shadowdark.properties.Item.finesse': 'Finesse',
};
export const damageCases = [
    { name: 'Missing', system: { damage: {} }, base: null, adjusted: null, hands: '1h', toHit: 1 },
    { name: 'Legacy field is not Player damage', system: { damage: { value: 'd6' } }, base: null, adjusted: null, hands: '1h', toHit: 1 },
    // WeaponSD.prepareBaseData: blank handedness is 2h only when oneHanded === "".
    { name: 'Only two-handed', system: { damage: { oneHanded: '', twoHanded: 'd10' }, handedness: '' }, base: 'd10', adjusted: 'd10', hands: '2h', toHit: 1 },
    { name: 'Absent one-handed field', system: { damage: { twoHanded: 'd10' }, handedness: '' }, base: null, adjusted: null, hands: '1h', toHit: 1 },
    { name: 'Explicit one-handed', system: { damage: { oneHanded: 'd8', twoHanded: 'd10' }, handedness: '1h' }, base: 'd8', adjusted: 'd8', hands: '1h', toHit: 1 },
    { name: 'Explicit two-handed', system: { damage: { oneHanded: 'd8', twoHanded: 'd10' }, handedness: '2h' }, base: 'd10', adjusted: 'd10', hands: '2h', toHit: 1 },
    { name: 'Versatile', system: { damage: { oneHanded: 'd8', twoHanded: 'd10' }, properties: ['Compendium.shadowdark.properties.Item.versatile'] }, base: 'd8', adjusted: 'd8', hands: '1h', toHit: 1 },
    { name: 'Exact property', system: { damage: { oneHanded: 'd8', twoHanded: 'd10' }, properties: ['Compendium.shadowdark.properties.Item.two'] }, base: 'd10', adjusted: 'd10', hands: '2h', toHit: 1 },
    { name: 'Unresolved property', system: { damage: { oneHanded: 'd8', twoHanded: 'd10' }, properties: ['Compendium.two-handed.Item.unknown'] }, base: 'd8', adjusted: 'd8', hands: '1h', toHit: 1 },
    { name: 'Missing selected hand', system: { damage: { oneHanded: 'd8' }, handedness: '2h' }, base: null, adjusted: null, hands: '2h', toHit: 1 },
    { name: 'Finesse', system: { damage: { oneHanded: 'd8' }, properties: ['Compendium.shadowdark.properties.Item.finesse'] }, base: 'd8', adjusted: 'd8', hands: '1h', toHit: 3 },
    // 4.0.6 WeaponSD has no `bonuses` field; magic bonuses are `.this` effects.
    { name: 'Supported effects', system: { damage: { oneHanded: 'd8' } }, effects: [
        { key: 'system.roll.melee.damage', mode: 1, value: 2 }, { key: 'system.roll.melee.damage', mode: 2, value: 3 },
    ], itemEffects: [{ name: 'Magic bonus', transfer: true, changes: [{ key: 'system.roll.attack.damage.this', mode: 2, value: 1 }] }],
    base: 'd8', adjusted: '(d8+4)*2', hands: '1h', toHit: 1 },
    { name: 'Transferred Item effect once', system: { damage: { oneHanded: 'd8' } }, itemEffects: [{
        transfer: true, changes: [{ key: 'system.roll.melee.damage.this', mode: 2, value: 3 }],
    }], base: 'd8', adjusted: 'd8+3', hands: '1h', toHit: 1 },
    { name: 'Native NPC attack', type: 'NPC Attack', system: { ranges: ['far'], damage: { value: 'd12', numDice: 3 },
        bonuses: { attackBonus: 5, damageBonus: 2 } }, effects: [{ key: 'system.roll.attack.damage', mode: 2, value: 20 }],
        base: 'd12', adjusted: 'd12+2', hands: '1h', toHit: 5 },
    { name: 'Missing NPC damage', type: 'NPC Attack', system: { ranges: ['close'], damage: {}, bonuses: { attackBonus: 2 } },
        base: null, adjusted: null, hands: '1h', toHit: 2 },
] as const;

export function damageFixture(test: typeof damageCases[number]): any {
    const item = { _id: 'weapon-fixture', id: 'weapon-fixture', name: test.name, type: 'type' in test ? test.type : 'Weapon',
        img: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"/%3E',
        effects: 'itemEffects' in test ? structuredClone(test.itemEffects as any) : [],
        system: { equipped: true, type: 'melee', properties: [], ...structuredClone(test.system) } };
    return { _id: 'actor-fixture', id: 'actor-fixture', name: 'Weapon fixture', type: item.type === 'NPC Attack' ? 'NPC' : 'Player', img: '',
        system: { abilities: { str: { value: 12 }, dex: { value: 16 } }, level: { value: 4 },
            attributes: { hp: { value: 4, max: 4 } }, coins: {}, languages: [] },
        items: [item], effects: 'effects' in test ? [{ changes: structuredClone(test.effects) }] : [] };
}
