import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativePacks } from '../core0191/world';
export const CREATOR_NATIVE = '9677d16b3903b3b640f00d4efd48249142ac8334';
const root = process.env.SHADOWDARK_NATIVE_REFERENCE ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../../temp/shadowdark');
export const creatorPacks = nativePacks(root, ['shadowdark.classes','shadowdark.ancestries','shadowdark.backgrounds','shadowdark.patrons-and-deities','shadowdark.talents','shadowdark.class-abilities','shadowdark.spells','shadowdark.languages','shadowdark.gear','shadowdark.magic-items','shadowdark.rollable-tables','shadowdark.properties']);
export const creatorRows: any[] = Object.entries(creatorPacks).flatMap(([pack,docs]) => docs.map(doc => ({ ...doc, pack, uuid: `Compendium.${pack}.${doc.results ? 'RollTable' : 'Item'}.${doc._id}` })));
export const creatorSources = new Map(creatorRows.map(doc => [doc.uuid,doc]));
