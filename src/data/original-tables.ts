import { MUNDANE_TABLES, MUNDANE_TABLE_VERSION } from './mundane-tables';
import { BOON_TABLES } from './boon-tables';

export const ORIGINAL_TABLE_VERSION = MUNDANE_TABLE_VERSION;
export const ORIGINAL_TABLES = {...MUNDANE_TABLES,...BOON_TABLES};
