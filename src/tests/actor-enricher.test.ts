import assert from 'node:assert/strict';
import { enrichItem, type EnrichmentContext } from '../logic/actor-enricher';

const lightSourceIds = ['PkQXG3AaHNMVwGTc', 'BBDG7QpHOFXG6sKe', 'rjNBToTJCYLLdVcT'];
const lightDescription = lightSourceIds.map(id =>
    `@UUID[Compendium.shadowdark.gear.Item.${id}]{Light Spell}`).join(' ');

function context(resolveDoc: (uuid: string) => Promise<unknown>): EnrichmentContext {
    return { addedSourceIds: new Set(), addedNames: new Set(), targetLevel: 1,
        actor: null, discoveredItems: [], resolveDoc };
}

export async function run(): Promise<void> {
    let resolutions = 0;
    const spellContext = context(async () => { resolutions++; return null; });
    const light = await enrichItem({ _id: 'light', type: 'Spell', name: 'Light',
        system: { description: lightDescription } }, spellContext);
    assert.equal(light?.name, 'Light');
    assert.equal(resolutions, 0, 'Spell reference links are not automatic inventory grants');
    assert.deepEqual(spellContext.discoveredItems, []);

    const talentContext = context(async () => {
        resolutions++;
        return { _id: 'granted', type: 'Class Ability', name: 'Granted Ability', system: {} };
    });
    await enrichItem({ _id: 'talent', type: 'Talent', name: 'Granting Talent',
        system: { description: '@UUID[Compendium.shadowdark.class-abilities.Item.granted]{Granted Ability}' } },
    talentContext);
    assert.equal(resolutions, 1);
    assert.equal(talentContext.discoveredItems?.[0]?.name, 'Granted Ability');
    console.log('shadowdark spell-link provenance: PASS');
}

if (import.meta.url === `file://${process.argv[1]}`) void run();
