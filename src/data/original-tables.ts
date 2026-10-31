import { REMAINING_TREASURE_TABLES } from './remaining-treasure-tables';
import { MUNDANE_TABLES, MUNDANE_TABLE_VERSION } from './mundane-tables';
import { BOON_TABLES } from './boon-tables';
import { POTION_TABLES } from './potion-tables';
import { ARMOR_TABLES } from './armor-tables';
import { MAGIC_TABLES } from './magic-tables';

export const ORIGINAL_TABLE_VERSION = MUNDANE_TABLE_VERSION;
export const ORIGINAL_TABLES = {...MUNDANE_TABLES,...BOON_TABLES,...MAGIC_TABLES,...ARMOR_TABLES,...POTION_TABLES,...REMAINING_TREASURE_TABLES};
