import { ORIGINAL_TABLES, ORIGINAL_TABLE_VERSION } from '../data/original-tables';

export interface OriginalSource { table: string; result: string; version: number; total?: number }
export interface OriginalPart { text: string; source?: OriginalSource }
export function originalSelection(table: string, result: string, total?: number): OriginalPart {
    const rows = Object.hasOwn(ORIGINAL_TABLES,table) ? ORIGINAL_TABLES[table].rows : [];
    const index = rows.findIndex(row=>row.id===result);
    if (index < 0 || (total !== undefined && total !== index+1)) throw new Error('Choose an available original result.');
    return {text:rows[index].text,source:{table,result,version:ORIGINAL_TABLE_VERSION,...(total===undefined?{}:{total})}};
}
export function originalRow(source?: OriginalSource) {
    if (!source || source.version !== ORIGINAL_TABLE_VERSION || !Object.hasOwn(ORIGINAL_TABLES,source.table)) return undefined;
    return ORIGINAL_TABLES[source.table].rows.find((row,index)=>row.id===source.result && (source.total===undefined || source.total===index+1));
}
