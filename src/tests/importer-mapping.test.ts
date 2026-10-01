import { strict as assert } from 'node:assert';
import shadowdarklingMapping from '../data/shadowdarkling/map-shadowdarkling.json';
import { ShadowdarkImporter } from '../server/importer';

export function run(): void {
    const importer = new ShadowdarkImporter();
    const mapping = (importer as unknown as { mapping: typeof shadowdarklingMapping }).mapping;

    assert.deepEqual(mapping, shadowdarklingMapping, 'importer must load its bundled mapping without a runtime file path');
    assert.equal(mapping.armor.Chainmail, 'Compendium.shadowdark.gear.DeqtKQQzI6HTYvV0');
    console.log('shadowdark importer mapping: PASS');
}

if (import.meta.url === `file://${process.argv[1]}`) run();
