import { useEffect, useMemo } from 'react';
import { useShadowdarkUI } from '../context/ShadowdarkUIContext';
import { choiceCatalog, type ChoiceCatalog } from '../../logic/talent-choices';

/**
 * Native choice options (CompendiumsSD.baseWeapons / baseArmor) from the declared
 * gear and magic-item packs. Returns null while loading; an empty list means the
 * declared data offers no options, which blocks the choice instead of guessing.
 */
export function useChoiceCatalog(): ChoiceCatalog | null {
    const { collections, fetchPack } = useShadowdarkUI();
    useEffect(() => {
        if (!collections?.gear) fetchPack('gear');
        if (!collections?.['magic-items']) fetchPack('magic-items');
    }, [collections?.gear, collections, fetchPack]);
    return useMemo(() => collections?.gear && collections?.['magic-items']
        ? choiceCatalog([...collections.gear, ...collections['magic-items']]) : null, [collections]);
}
