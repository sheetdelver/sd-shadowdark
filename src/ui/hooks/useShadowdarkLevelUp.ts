import { useState, useEffect, useCallback } from 'react';
import { useShadowdarkUI } from '../context/ShadowdarkUIContext';
import { formatUuid } from '../../logic/identity';

/**
 * Shared hook to manage the Shadowdark Level-Up process.
 * Encapsulates modal state, data assembly, and auto-closing logic.
 */
export function useShadowdarkLevelUp(
    actor: any, 
    addNotification: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void
) {
    const { fetchPack: onFetchPack } = useShadowdarkUI();
    const [showLevelUpModal, setShowLevelUpModal] = useState(false);
    const [levelUpData, setLevelUpData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(false);

    // Auto-close Level Up Modal when level effectively changes in the background
    useEffect(() => {
        if (showLevelUpModal && levelUpData && actor.system?.level?.value === levelUpData.targetLevel) {
            setShowLevelUpModal(false);
            setLevelUpData(null);
            addNotification('Level Up Complete!', 'success');
        }
    }, [actor.system?.level?.value, showLevelUpModal, levelUpData, addNotification]);

    /**
     * Prepares level-up data and opens the modal.
     */
    const triggerLevelUp = useCallback(async () => {
        const currentLevel = actor.system?.level?.value || 0;
        const targetLevel = currentLevel + 1;
        
        let fetchedClasses = [];
        let fetchedPatrons = [];
        let fetchedLanguages = [];

        // Ensure hydration for base essentials needed for level-up resolution
        if (onFetchPack) {
            setIsFetching(true);
            try {
                // Fetch packs explicitly and use the returned data
                const [classes, patrons, languages] = await Promise.all([
                    onFetchPack('classes'),
                    onFetchPack('patrons'),
                    // Also fetch languages if currentLevel is 0 (initial gear/lang selection)
                    currentLevel === 0 ? onFetchPack('languages') : Promise.resolve([])
                ]);
                fetchedClasses = (Array.isArray(classes) ? classes : []).filter(
                    (c: any) => (c.name || "").toLowerCase() !== "level 0"
                );
                fetchedPatrons = Array.isArray(patrons) ? patrons : [];
                fetchedLanguages = Array.isArray(languages) ? languages : [];
            } finally {
                setIsFetching(false);
            }
        }

        const data = {
            currentLevel,
            targetLevel,
            classObj: actor.items?.find((item: any) => item.type === 'Class') ?? null,
            ancestry: actor.items?.find((item: any) => item.type === 'Ancestry') ?? null,
            patron: actor.items?.find((item: any) => item.type === 'Patron') ?? null,
            abilities: actor.derived?.abilities,
            spells: actor.items?.filter((i: any) => i.type === 'Spell') || [],
            // Exact references come from the prepared view; the host projection
            // turns raw compendium UUIDs into names (SD01-05), which are never
            // mapped back by name. Level 0 prompts for a class.
            classUuid: currentLevel === 0 || !actor.derived?.identity?.class?.ref ? '' : formatUuid(actor.derived.identity.class.ref),
            patronUuid: actor.derived?.identity?.patron?.ref ? formatUuid(actor.derived.identity.patron.ref) : '',
            // Pass the collections explicitly to ensure modal is ready
            availableClasses: fetchedClasses,
            availablePatrons: fetchedPatrons,
            availableLanguages: fetchedLanguages
        };
        
        setLevelUpData(data);
        setShowLevelUpModal(true);
    }, [actor, onFetchPack]);

    const closeLevelUp = useCallback(() => {
        setShowLevelUpModal(false);
        setLevelUpData(null);
    }, []);

    return {
        showLevelUpModal,
        levelUpData,
        triggerLevelUp,
        closeLevelUp
    };
}
