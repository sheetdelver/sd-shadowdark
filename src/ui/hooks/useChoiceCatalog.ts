import { useMemo } from 'react';
import { useShadowdarkCollections } from '../context/ShadowdarkUIContext';
import { choiceCatalog, type ChoiceCatalog } from '../../logic/talent-choices';

/**
 * Native choice options (CompendiumsSD.baseWeapons / baseArmor) from the declared
 * gear and magic-item packs. Returns null while loading; an empty list means the
 * declared data offers no options, which blocks the choice instead of guessing.
 */
export function useChoiceCatalog(enabled = true) {
    const data = useShadowdarkCollections(['gear', 'magic-items'], enabled);
    const { collections, ready } = data;
    const catalog: ChoiceCatalog | null = useMemo(() => ready
        ? choiceCatalog([...collections.gear, ...collections['magic-items']]) : null, [collections, ready]);
    return { ...data, catalog };
}
