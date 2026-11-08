import { isSdkError } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from './ShadowdarkAdapter';
import { canReadPack, type Caller } from './access';
import { canonicalUuid, parseUuid } from '../logic/identity';
import { languagePlan, languageRarity } from '../logic/languages';
import { readSourceFilters, sourceAllowed } from '../logic/world-settings';

/** Caller-local language inputs. Restricted/fixed exact refs are not discovery. */
export async function callerLanguagePlan(caller: Caller, ancestry: any, classDoc: any, existing: readonly string[] = [], mode?: 'inventory') {
    const configs = [ancestry, classDoc].map(doc => doc?.system?.languages ?? {});
    const needsCatalog = mode === 'inventory' || configs.some(data => (typeof data.common === 'number' && data.common > 0) || (typeof data.rare === 'number' && data.rare > 0));
    let catalog: any[] = [], readError: string | null = null;
    if (needsCatalog) {
        const filters = readSourceFilters(caller.runtime.world?.snapshot());
        if (filters.value === null) readError = filters.reason;
        else try { catalog = (await shadowdarkAdapter.getCollection('languages', { caller })).filter(doc => sourceAllowed(doc, filters.value!)); }
        catch (e) { if (isSdkError(e) && e.code === 'permission_denied') readError = 'The native language catalog is not readable by this caller.'; else throw e; }
    }
    const values = configs.flatMap(data => [...(Array.isArray(data.fixed) ? data.fixed : []), ...(typeof data.select === 'number' && data.select > 0 && Array.isArray(data.selectOptions) ? data.selectOptions : [])]);
    const refs = [...new Set(values.map(canonicalUuid).filter((uuid): uuid is string => !!uuid))];
    const exact: any[] = [];
    await Promise.all(refs.map(async uuid => {
        try { const doc = await shadowdarkAdapter.resolveDocumentFor(uuid, caller); if (doc?.type === 'Language') exact.push({ ...doc, uuid }); }
        catch (e) { if (!isSdkError(e) || !['permission_denied','not_found'].includes(e.code)) throw e; }
    }));
    const stillReadable = (doc: any) => { const ref = parseUuid(doc.uuid); return ref && (ref.kind !== 'compendium' || canReadPack(caller, ref.pack)); };
    catalog = catalog.filter(stillReadable);
    const currentExact = exact.filter(stillReadable);
    const plan = languagePlan(ancestry, classDoc, catalog, existing, currentExact);
    if (readError) plan.errors.unshift(readError);
    const rows = new Map([...catalog, ...currentExact].filter(doc => canonicalUuid(doc.uuid)).map(doc => [canonicalUuid(doc.uuid), doc]));
    return { ...plan, rows: [...rows.values()].map(doc => ({ uuid: canonicalUuid(doc.uuid), name: doc.name, type: 'Language',
        system: { rarity: languageRarity(doc), description: doc.system?.description ?? '' } })) };
}
