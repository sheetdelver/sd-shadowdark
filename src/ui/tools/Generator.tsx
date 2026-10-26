'use client';

import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';

import { LevelUpModal } from '../components/LevelUpModal';
import { logger } from '@sheet-delver/sdk';
import { useSDK, useSDKComponents } from '@sheet-delver/sdk/react';
import { useShadowdarkUI, ShadowdarkUIProvider, useShadowdarkCollections } from '../context/ShadowdarkUIContext';
import { CollectionStatus } from '../components/CollectionStatus';
import { enrichItem, resolveSubItems, EnrichmentContext } from '../../logic/actor-enricher';
import { assertResolvedTalentChoices } from '../../logic/talent-choices';
import { creationGrants } from '../../logic/creation-grants';
import { ownedCopy } from '../../logic/identity';
import { presentDescription } from '../../logic/description';
import { prepareActorCore } from '../../logic/actor-preparation';
import { advancementHitPoints } from '../../logic/advancement';
import { useLanguagePlan } from '../hooks/useLanguagePlan';
import { LanguageChoices } from '../components/LanguageChoices';
import ModuleDialog from '../components/ModuleDialog';
import ModulePageHeader from '../components/ModulePageHeader';
import { validateLanguageSelections } from '../../logic/languages';

export default function Generator() {
    return (
        <ShadowdarkUIProvider>
            <GeneratorContent />
        </ShadowdarkUIProvider>
    );
}

function GeneratorContent() {
    const { systemData, collections, resolveName, loadingSystem } = useShadowdarkUI();
    const { foundryUrl, isConnected, navigate, fetchWithAuth } = useSDK();
    const { LoadingModal } = useSDKComponents();
    const [loading, setLoading] = useState(false);

    // Randomize All
    const skipLanguageReset = useRef(false);
    const skipTalentReset = useRef(false);

    // Stat Choice State
    const [currentStatPrompt, setCurrentStatPrompt] = useState<{
        resolve: (value: string) => void;
        amount: number;
    } | null>(null);

    const [showPatronModal, setShowPatronModal] = useState(false);

    // Ancestry Choice State
    const [showAncestryTalentsModal, setShowAncestryTalentsModal] = useState(false);
    const [selectedAncestryTalents, setSelectedAncestryTalents] = useState<string[]>([]);


    const [formData, setFormData] = useState({
        level0: true,
        ancestry: '',
        class: '',
        background: '',
         alignment: 'neutral',
        deity: '',
        patron: '',
        title: '',
        name: '',
        description: '',
        stats: {
            STR: { value: 10, mod: 0 },
            DEX: { value: 10, mod: 0 },
            CON: { value: 10, mod: 0 },
            INT: { value: 10, mod: 0 },
            WIS: { value: 10, mod: 0 },
            CHA: { value: 10, mod: 0 }
        },
        hp: 0,
        gold: 0
    });

    // Level 0 has no patron selection. Level 1 must also load that collection;
    // every identity/language collection used by the selected mode must be ready.
    const data = useShadowdarkCollections(['ancestries', 'classes', 'backgrounds', 'deities', 'languages',
        ...(!formData.level0 ? ['patrons'] : [])]);
    // Identity shards contain full native documents. Always derive these from
    // the current caller's collection instead of retaining a prior context's doc.
    const fromCollection = (id: string, uuid: string) => data.ready
        ? collections[id]?.find(doc => doc.uuid === uuid) ?? null : null;
    const ancestryDetails = fromCollection('ancestries', formData.ancestry);
    const classDetails = fromCollection('classes', formData.class);
    const patronDetails = fromCollection('patrons', formData.patron);
    const documentScope = useRef<{ generation: number; controller: AbortController } | null>(null);
    useLayoutEffect(() => {
        const scope = { generation: data.generation, controller: new AbortController() };
        documentScope.current = scope;
        return () => { scope.controller.abort(); if (documentScope.current === scope) documentScope.current = null; };
    }, [data.generation]);



    // Helper: Calculate Modifier
    const getMod = (score: number) => Math.floor((score - 10) / 2);

    // Helper: Fetch Foundry Document

    const handleStatSelect = (stat: string) => {
        if (currentStatPrompt) {
            currentStatPrompt.resolve(stat);
            setCurrentStatPrompt(null);
        }
    };

    const handleStatChange = (stat: string, valueStr: string) => {
        const val = parseInt(valueStr) || 10;
        // Clamp 1-18 (3d6 max) as requested
        const clamped = Math.max(1, Math.min(18, val));

        setFormData(prev => ({
            ...prev,
            stats: {
                ...prev.stats,
                // @ts-ignore
                [stat]: {
                    // @ts-ignore
                    ...prev.stats[stat],
                    value: clamped,
                    mod: getMod(clamped)
                }
            }
        }));
    };

    const fetchDocument = useCallback(async (uuid: string) => {
        const scope = documentScope.current;
        if (!scope || scope.generation !== data.generation || scope.controller.signal.aborted) return null;
        // 1. Check loaded shards
        for (const shard of Object.values(collections)) {
            const found = shard.find((i: any) => i.uuid === uuid || i.id === uuid || i._id === uuid);
            // ONLY return from shard if it is a FULL document (has system data)
            // fetchPack uses summaries which are lean stubs.
            if (found && found.system) return found; 
        }

        // 2. Check systemData collections (Lean Index)
        if (systemData) {
            for (const category of Object.values(systemData)) {
                if (Array.isArray(category)) {
                    const found = category.find((i: any) => i.uuid === uuid || i.id === uuid || i._id === uuid);
                    if (found && found.system) return found;
                }
            }
        }

        // 3. Fallback to network
        try {
            const res = await fetchWithAuth(`/api/modules/shadowdark/document/${uuid}`, { signal: scope.controller.signal });
            if (res.ok) {
                const doc = await res.json();
                return documentScope.current === scope && !scope.controller.signal.aborted ? doc : null;
            }
        } catch (e) {
            if (scope.controller.signal.aborted) return null;
            logger.warn(`Failed to fetch document ${uuid} via network, checking local index:`, e);
        }

        return null;
    }, [fetchWithAuth, collections, systemData, data.generation]);

    const isAppLoading = loading || data.loading;









    // Effect 2: Gear & Gold (Level/Class changes)
    useEffect(() => {
        // If Level 0 toggled
        if (formData.level0) {
            setFormData(prev => ({ ...prev, gold: 0 }));
        } else {
            setGearSelected([]);
            // If switching to Level 1, maybe roll gold?
            // Only if gold is 0?
            // calculateGold(); // Randomizes.
            // User might want to keep rolled gold.
        }
    }, [classDetails, formData.level0]);



    // Randomize All
    const [isRandomizing, setIsRandomizing] = useState(false);

    // API Wrappers
    const rollStats = async () => {
        try {
            const res = await fetchWithAuth('/api/modules/shadowdark/actors/randomize/stats', { method: 'POST' });
            const data = await res.json();
            if (data.stats) setFormData(prev => ({ ...prev, stats: data.stats }));
        } catch (e: any) { logger.error(e.message || String(e)); }
    };

    const rollSingleStat = async (stat: string) => {
        try {
            const res = await fetchWithAuth('/api/modules/shadowdark/actors/randomize/stats', { method: 'POST' });
            const data = await res.json();
            if (data.stats && data.stats[stat]) {
                setFormData(prev => ({
                    ...prev,
                    stats: {
                        ...prev.stats,
                        [stat]: data.stats[stat]
                    }
                }));
            }
        } catch (e: any) { logger.error(e.message || String(e)); }
    };

    const rollName = async () => {
        if (!formData.ancestry) return;

        try {
            const res = await fetchWithAuth('/api/modules/shadowdark/actors/randomize/name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ancestryUuid: formData.ancestry })
            });

            if (!res.ok) throw new Error('Name randomization failed');
            const data = await res.json();
            if (data.name) {
                setFormData(prev => ({ ...prev, name: data.name }));
            }
        } catch (e) {
            logger.error("Name randomization error", e);
        }
    };

    const randomizeAll = async () => {
        if (isRandomizing) return;
        setIsRandomizing(true);
        skipLanguageReset.current = true;
        skipTalentReset.current = true;

        try {
            const res = await fetchWithAuth('/api/modules/shadowdark/actors/randomize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level0: formData.level0 })
            });

            if (!res.ok) throw new Error('Randomization failed');
            const data = await res.json();

            // Identity documents come from current caller collections.
            setFormData(prev => ({
                ...prev,
                stats: data.stats,
                hp: data.hp || 0,
                gold: data.gold || 0,
                ancestry: data.ancestry?.uuid || '',
                class: data.class?.uuid || '',
                background: data.background?.uuid || '',
                deity: data.deity?.uuid || '',
                alignment: data.alignment?.toLowerCase() || 'neutral',
                patron: data.patron?.uuid || '',
                title: data.title || prev.title,
                name: data.name || prev.name, // Use generated name or keep existing
                // Keep level0 flag as requested
                level0: formData.level0,
            }));

            // 3. Talents
            setSelectedAncestryTalents(data.talents?.ancestry || []);


            // 4. Languages
            if (data.languages) {
                setKnownLanguages({
                    fixed: data.languages.fixed || [],
                    selected: {
                        common: data.languages.selected?.common || [],
                        rare: data.languages.selected?.rare || [],
                        ancestry: data.languages.selected?.ancestry || [],
                        class: data.languages.selected?.class || []
                    }
                });
            }

            // 5. Gear
            setGearSelected(data.gear || []);

        } catch (e) {
            logger.error("Randomization error", e);
        } finally {
            setTimeout(() => {
                setIsRandomizing(false);
                skipLanguageReset.current = false;
                skipTalentReset.current = false;
            }, 1500);
        }
    };

    // Effect: Sync Level 0 HP
    useEffect(() => {
        if (formData.level0) {
            const conMod = formData.stats.CON?.mod || 0;
            const newHp = Math.max(1, 1 + conMod);
            if (formData.hp !== newHp) {
                setFormData(prev => ({ ...prev, hp: newHp }));
            }
        }
    }, [formData.level0, formData.stats.CON?.mod, formData.hp]);

    // Effect: React to Level Toggle
    const lastLevel0 = useRef(formData.level0);
    useEffect(() => {
        if (!collections.classes) return;
        
        const isSwitchingToLevel1 = lastLevel0.current && !formData.level0;
        const isSwitchingToLevel0 = !lastLevel0.current && formData.level0;
        lastLevel0.current = formData.level0;

        if (isSwitchingToLevel0) {
            setFormData(prev => ({ ...prev, class: '' }));
        } else if (isSwitchingToLevel1 && !formData.class) {
            // Pick a random class if level 1 but none selected
            const options = (collections.classes || []).filter((c: any) => c.name !== "Level 0");
            if (options.length > 0) {
                const random = options[Math.floor(Math.random() * options.length)];
                setFormData(prev => ({ ...prev, class: random.uuid }));
            }
        }
    }, [formData.level0, collections.classes, formData.class]);

    // Effect: Load Ancestry Details & Talents & Languages
    useEffect(() => {
        if (!formData.ancestry) {
            setAncestryTalents({ fixed: [], choice: [], choiceCount: 0 });
            return;
        }

        const loadAncestry = async () => {
            try {
                const details = ancestryDetails;

                if (!details?.system) return;

                // 2. TALENTS & TRAITS
                const fixedTalents: any[] = [];
                const choiceTalents: any[] = [];
                const choiceCount = details.system.talentChoiceCount || 0;

                // Use the new centralized resolveSubItems logic
                const enrichmentContext: EnrichmentContext = {
                    addedSourceIds: new Set<string>(),
                    addedNames: new Set<string>(),
                    targetLevel: formData.level0 ? 0 : 1,
                    actor: null
                };

                const subItems = await resolveSubItems(details, fetchDocument, enrichmentContext);
                
                // For the UI, we still want to distinguish between what was added automatically 
                // and what might be a choice.
                // However, resolveSubItems ALREADY filters by choiceCount for ancestries.
                fixedTalents.push(...subItems.map(i => ({
                    uuid: i.flags?.core?.sourceId || i.uuid || i._id,
                    name: i.name,
                    description: (i.system?.description?.value || i.system?.description || "").replace(/<[^>]+>/g, ' ')
                })));

                // In Shadowdark, an ancestry choice only exists if total items > choice count.
                // If total <= choiceCount, all items are fixed base traits.
                const totalTalents = details.system.talents?.length || 0;
                const effectiveChoiceCount = totalTalents > choiceCount ? choiceCount : 0;
                
                if (totalTalents > choiceCount && choiceCount > 0) {
                     try {
                         const choices = await Promise.all(details.system.talents.map((u: string) => fetchDocument(u)));
                         choiceTalents.push(...choices.map((d, i) => d ? {
                             uuid: details.system.talents[i],
                             name: d.name,
                             description: (d.system?.description?.value || d.system?.description || "").replace(/<[^>]+>/g, ' ')
                         } : null).filter(d => d));
                     } catch (e) {
                         logger.error("Ancestry choice load error", e);
                     }
                }

            } catch (e) {
                logger.error("Ancestry load error", e);
            }
        };
        loadAncestry();
    }, [formData.ancestry, collections, fetchDocument, ancestryDetails, formData.level0]);




    const [classTalents, setClassTalents] = useState<{ fixed: any[], choice: any[], choiceCount: number, table?: boolean }>({ fixed: [], choice: [], choiceCount: 0 });
    const [ancestryTalents, setAncestryTalents] = useState<{ fixed: any[], choice: any[], choiceCount: number }>({ fixed: [], choice: [], choiceCount: 0 });

    // Gear State
    const [gearSelected, setGearSelected] = useState<any[]>([]);

    // Language State
    // Language State
    const [knownLanguages, setKnownLanguages] = useState<{
        fixed: any[],
        selected: {
            common: string[],
            rare: string[],
            ancestry: string[],
            class: string[]
        }
    }>({
        fixed: [],
        selected: { common: [], rare: [], ancestry: [], class: [] }
    });

    // Config now tracks pools
    const [languageConfig, setLanguageConfig] = useState<{
        common: number,
        rare: number,
        ancestry: { count: number, options: string[] },
        class: { count: number, options: string[] },
        fixed: string[]
    }>({
        common: 0,
        rare: 0,
        ancestry: { count: 0, options: [] },
        class: { count: 0, options: [] },
        fixed: []
    });
    const [showLanguageModal, setShowLanguageModal] = useState(false);
    const [weaponNames, setWeaponNames] = useState<string[]>([]);
    const [armorNames, setArmorNames] = useState<string[]>([]);

    // Level Up State
    const [showLevelUp, setShowLevelUp] = useState(false);

    useEffect(() => {
        if (!classDetails?.system || formData.level0) {
            setClassTalents({ fixed: [], choice: [], choiceCount: 0 });
            setWeaponNames([]);
            setArmorNames([]);
            return;
        }
        let active = true;
        const loadDetails = async () => {
            // 1. TALENTS & ABILITIES
            const enrichmentContext: EnrichmentContext = {
                addedSourceIds: new Set<string>(),
                addedNames: new Set<string>(),
                targetLevel: formData.level0 ? 0 : 1,
                actor: null
            };

            const subItems = await resolveSubItems(classDetails, fetchDocument, enrichmentContext);
            if (!active) return;
            
            const fixed = subItems.map(i => ({
                uuid: i.flags?.core?.sourceId || i.uuid || i._id,
                name: i.name,
                description: (i.system?.description?.value || i.system?.description || "").replace(/<[^>]+>/g, ' ')
            }));

            // Choice Talents (Manual selection table)
            const choice: any[] = [];
            if (classDetails.system.talentChoices?.length > 0) {
                try {
                    const docs = await Promise.all(classDetails.system.talentChoices.map((u: string) => fetchDocument(u)));
                    if (!active) return;
                    choice.push(...docs.map((d, i) => d ? {
                        uuid: classDetails.system.talentChoices[i],
                        name: d.name,
                        description: (d.system?.description?.value || d.system?.description || "").replace(/<[^>]+>/g, ' ')
                    } : null).filter(d => d));
                } catch (e) {
                    logger.error("Talent choice load error", e);
                }
            }
            if (!active) return;
            setClassTalents({ 
                fixed, 
                choice, 
                choiceCount: classDetails.system.talentChoiceCount || 0, 
                table: classDetails.system.classTalentTable || false 
            });

            // 2. Weapons
            if (Array.isArray(classDetails.system.weapons) && classDetails.system.weapons.length > 0) {
                try {
                    const docs = await Promise.all(classDetails.system.weapons.map((u: string) => fetchDocument(u)));
                    if (!active) return;
                    setWeaponNames(docs.filter(d => d && d.name).map(d => d.name));
                } catch (e) {
                    if (!active) return;
                    logger.error("Weapon load error", e);
                    setWeaponNames([]);
                }
            } else {
                setWeaponNames([]);
            }

            // 3. Armor
            if (Array.isArray(classDetails.system.armor) && classDetails.system.armor.length > 0) {
                try {
                    const docs = await Promise.all(classDetails.system.armor.map((u: string) => fetchDocument(u)));
                    if (!active) return;
                    setArmorNames(docs.filter(d => d && d.name).map(d => d.name));
                } catch (e) {
                    if (!active) return;
                    logger.error("Armor load error", e);
                    setArmorNames([]);
                }
            } else {
                setArmorNames([]);
            }
        };

        void loadDetails();
        return () => { active = false; };
    }, [classDetails, formData.level0, fetchDocument]);

    const languageData = useLanguagePlan({ ancestryUuid: formData.ancestry || undefined,
        classUuid: !formData.level0 ? formData.class || undefined : undefined,
        enabled: data.ready && !!ancestryDetails && (formData.level0 || !!classDetails) });
    useEffect(() => {
        if (!languageData.ready || !languageData.plan) return;
        const plan = languageData.plan;
        const group = (id: string) => plan.groups.find(row => row.id === id)!;
        setLanguageConfig({ fixed: plan.fixed, common: group('common').count, rare: group('rare').count,
            ancestry: { count: group('ancestry').count, options: group('ancestry').options }, class: { count: group('class').count, options: group('class').options } });
        setKnownLanguages(previous => {
            const selected = { ...previous.selected };
            const used = new Set(plan.fixed);
            for (const row of plan.groups) { selected[row.id] = selected[row.id].filter(uuid => row.options.includes(uuid) && !used.has(uuid)).slice(0,row.count);selected[row.id].forEach(uuid => used.add(uuid)); }
            return { fixed: [...plan.fixed], selected };
        });
    }, [languageData.plan, languageData.ready]);
    const languageName = (value: any) => languageData.ready ? languageData.rows.find(row => row.uuid === (typeof value === 'string' ? value : value?.uuid))?.name ?? 'Unavailable language' : 'Language data unavailable';

    const [formErrors, setFormErrors] = useState<Record<string, boolean>>({});
    const [creationError, setCreationError] = useState<string | null>(null);

    // Create Character
    const createCharacter = async (extraItems: any[] = [], extraData: any = {}, levelUpComplete = false) => {
        if (!data.ready) return;
        setCreationError(null);
        setFormErrors({});

        // Validation
        const errors: Record<string, boolean> = {};
        if (!formData.name) errors.name = true;
        if (!ancestryDetails) errors.ancestry = true;
        if (!collections.backgrounds.some(doc => doc.uuid === formData.background)) errors.background = true;
        if (!formData.level0 && !classDetails) errors.class = true;

        // Details Validation
        if (ancestryTalents.choiceCount > 0 && selectedAncestryTalents.length < ancestryTalents.choiceCount) {
            errors.ancestryTalents = true;
        }

        // Validate each separate native pool, not an aggregate count.
        if (!languageData.ready || !languageData.plan || !validateLanguageSelections(languageData.plan, knownLanguages.selected).valid) errors.languages = true;

        // Patron Validation
        if (classDetails?.system?.patron?.required && !formData.patron) {
            errors.patron = true;
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            setCreationError(`Please check the following fields: ${Object.keys(errors).join(", ")}`);
            // Scroll to top or first error
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        // Level 1 Intercept
        if (!formData.level0 && !levelUpComplete) {
            setShowLevelUp(true);
            return;
        }

        setLoading(true);

        try {
            // 1. Prepare Items & System Data Strings
            const items: any[] = [];
            const effectivePatronUuid = extraData.patronUuid || formData.patron;
            const patronDoc = effectivePatronUuid ? await fetchDocument(effectivePatronUuid) : null;

            const enrichmentContext: EnrichmentContext = {
                addedSourceIds: new Set<string>(),
                addedNames: new Set<string>(),
                targetLevel: formData.level0 ? 0 : 1,
                actor: null,
                patronName: patronDoc?.name || undefined,
                discoveredItems: [],
                resolveDoc: fetchDocument
            };

            const addItem = async (uuid: string, talentClass?: 'ancestry' | 'class' | 'level') => {
                const doc = await fetchDocument(uuid);
                if (!doc) throw new Error(`Required creation source ${uuid} is unavailable; no character was created.`);
                const enriched = await enrichItem(doc, { 
                    ...enrichmentContext,
                    defaultTalentClass: talentClass
                });
                if (enriched) items.push(enriched);
                return enriched;
            };

            // 2. Ancestry & Basic Traits (Level 0 Only - Level 1+ resolved via Server)
            if (formData.level0) {
                const ancestryDoc = await fetchDocument(formData.ancestry);
                if (ancestryDoc) {
                    const enriched = await enrichItem(ancestryDoc, enrichmentContext);
                    if (enriched) {
                        items.push(enriched);
                        const subItems = await resolveSubItems(ancestryDoc, fetchDocument, enrichmentContext);
                        items.push(...subItems);
                    }
                }

                for (const uuid of selectedAncestryTalents) {
                    await addItem(uuid, 'ancestry');
                }

                // Gear (Level 0)
                if (gearSelected.length > 0) {
                    for (const item of gearSelected) {
                        const enriched = await enrichItem(item, enrichmentContext);
                        if (enriched) items.push(enriched);
                    }
                }

                await addItem(formData.background);

                if (effectivePatronUuid) {
                    await addItem(effectivePatronUuid);
                }
            }

            // Class resolution is handled by Server for Level 1+
            // Level 0 characters have no class.

            // Add Level Up Items (Talents, Boons, Spells)


            if (!formData.level0) {
                // Already prepared through the authoritative native choice path.
                // Keep exact fields/effects; do not enrich or discover more grants.
                items.push(...structuredClone(creationGrants(extraItems)));
            } else for (const item of extraItems) {
                const enriched = await enrichItem(item, enrichmentContext);
                if (enriched) items.push(enriched);
            }

            // Add any items discovered via description @UUID links
            if (enrichmentContext.discoveredItems && enrichmentContext.discoveredItems.length > 0) {
                items.push(...enrichmentContext.discoveredItems);
            }

            // Collect Language UUIDs for system.languages array.
            assertResolvedTalentChoices(items);
            // Use extraData.languages if it is a non-empty array (provided by the LevelUp modal or Generator injection).
            // Fall back to knownLanguages state if the array is absent OR empty (e.g. modal was skipped).
            const languageUuids: string[] = (extraData.languages && extraData.languages.length > 0)
                ? [...extraData.languages]
                : [];

            if (!extraData.languages || extraData.languages.length === 0) {
                // Fixed languages - handle both string UUIDs and objects with uuid property
                for (const l of knownLanguages.fixed) {
                    if (typeof l === 'string') {
                        languageUuids.push(l);
                    } else if (l && l.uuid) {
                        languageUuids.push(l.uuid);
                    }
                }

                // Add flattened selections (these are already UUID strings)
                languageUuids.push(
                    ...knownLanguages.selected.common,
                    ...knownLanguages.selected.rare,
                    ...knownLanguages.selected.ancestry,
                    ...knownLanguages.selected.class
                );

                // Add any additional fixed languages from config
                if (languageConfig.fixed?.length > 0) {
                    for (const uuid of languageConfig.fixed) {
                        if (typeof uuid === 'string' && !languageUuids.includes(uuid)) {
                            languageUuids.push(uuid);
                        }
                    }
                }
            }


            // 2. Prepare Actor Data
            const actorData = {
                name: formData.name,
                type: 'Player',
                img: 'icons/svg/mystery-man.svg',
                system: {
                    ancestry: formData.ancestry || "",      // Link to Compendium UUID
                    background: formData.background || "",  // Link to Compendium UUID
                    class: formData.class || "",      // Link to Compendium UUID (Correct for Shadowdark)
                    patron: effectivePatronUuid || "",    // Link to Compendium UUID (Correct for Shadowdark)
                    alignment: formData.alignment,
                    deity: formData.deity,
                    languages: languageUuids, // Populate with selected language UUIDs
                    level: {
                        value: formData.level0 ? 0 : 1,
                        xp: 0
                    },
                    // PlayerSD attributeModel stores only `value`; title is derived from the class.
                    abilities: {
                        str: { value: formData.stats.STR.value },
                        dex: { value: formData.stats.DEX.value },
                        con: { value: formData.stats.CON.value },
                        int: { value: formData.stats.INT.value },
                        wis: { value: formData.stats.WIS.value },
                        cha: { value: formData.stats.CHA.value }
                    },
                    attributes: {
                        hp: { value: extraData.hpRoll ?? formData.hp, max: extraData.hpRoll ?? formData.hp }
                    },
                    coins: {
                        gp: (extraData.gold !== undefined) ? extraData.gold : formData.gold,
                        sp: 0,
                        cp: 0
                    },
                    notes: formData.description
                },
                // Owned copies record their exact compendium source.
                items: items.map(item => ownedCopy(item))
            };

            if (!formData.level0) {
                // Share advancement's native first-level rule, including CON
                // effects in the assembled ancestry/talents and the minimum HP.
                actorData.system.attributes.hp = advancementHitPoints(
                    prepareActorCore(actorData), 1, extraData.hpRoll ?? formData.hp);
            }

            // 3. Send to API


            // Server validates the current caller’s native choices before the SDK write.
            logger.info("[Generator] Transmitting unaltered character data to Core...");
            const res = await fetchWithAuth('/api/modules/shadowdark/characters/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(typeof languageData.plan?.contextRevision === 'number' ? { 'X-SheetDelver-Context-Revision': String(languageData.plan.contextRevision) } : {})
                },
                body: JSON.stringify({ actor: actorData, languageChoices: knownLanguages.selected, creationPlan: extraData.creationPlan })
            });

            const result = await res.json();
            if (result.success) {
                // Redirect to sheet - Wait 500ms for backend stabilization
                setTimeout(() => {
                    navigate(`/actors/${result.id}`);
                }, 500);
            } else {
                setCreationError('Creation Failed: ' + (result.error?.message ?? result.error));
                setLoading(false);
            }
        } catch (e: any) {
            logger.error('Character creation error:', e);
            setCreationError('Error: ' + e.message);
            setLoading(false);
        }
    };

    // 3. Main Render
    if (data.error) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="bg-white p-6 border-2 border-black text-black"><CollectionStatus state={data} label="Loading character creation data…" /></div>
            </div>
        );
    }
    if (isAppLoading) {
        // Use the standard application loading aesthetic requested by the user
        const bootstrapMessage = loadingSystem ? "Loading Manifest..." :
                                 "Hydrating Rules...";
        
        const bootstrapSubmessage = loadingSystem ? "Reading the ancient scrolls..." :
                                    "Consulting the oracles...";

        return (
            <LoadingModal
                message={bootstrapMessage}
                submessage={bootstrapSubmessage}
                visible={true}
                theme={{
                    spinner: "w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto",
                }}
            />
        );
    }

    return (
        <div className={`flex flex-col min-h-screen font-crimson font-inter font-sans text-black pb-24`}>

            <ModulePageHeader title="Create Character" context="Generating New Character" onBack={()=>navigate('/')} actions={
                <button
                        onClick={randomizeAll}
                        className="group relative flex items-center justify-center -mb-2"
                        title="Randomize All"
                    >
                        <div className="w-14 h-14 flex items-center justify-center transition-transform group-hover:scale-110 bg-neutral-800 rounded-full border-2 border-neutral-700 group-hover:border-amber-500 shadow-lg">
                            <img src="/icons/dice-d20.svg" alt="Randomize" className="w-12 h-12 brightness-0 invert transition-all group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
                        </div>
                    </button>
            } />

            {/* One connected paper surface, matching the Character Creator. */}
            <div className="flex-1 px-4 max-w-5xl mx-auto w-full pt-6 mb-20 space-y-8">

                <section className="sd-tool-sheet sd-generator-sheet space-y-8" aria-label="Character generation">
                {/* Main Grid Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">

                    {/* Column 1: Type, Stats, HP, Gold */}
                    <div className="space-y-6">
                        {/* Name (Moved to top) */}
                        <div className={`bg-white p-6 border-2 shadow-sm ${formErrors.name ? 'border-red-600' : 'border-black'}`}>
                            <div className="flex justify-between items-center mb-4 border-b-2 border-black pb-1">
                                <h2 className={`text-black font-black font-serif text-xl ${formErrors.name ? 'text-red-600' : ''}`}>
                                    <span>Name {formErrors.name && <span className="text-xs uppercase font-sans font-bold float-right mt-1 ml-2">Required</span>}</span>
                                </h2>
                                {formData.ancestry && (
                                    <button
                                        onClick={rollName}
                                        className="group relative flex items-center justify-center"
                                        title="Randomize Name"
                                    >
                                        <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-110 bg-indigo-600 group-hover:bg-indigo-500 rounded-lg shadow-md">
                                            <img src="/icons/dice-d6.svg" alt="Roll dice" className="w-8 h-8 brightness-0 invert transition-all group-hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
                                        </div>
                                    </button>
                                )}
                            </div>
                            <div>
                                <input
                                    type="text"
                                    className={`w-full bg-transparent border-b-2 focus:border-black outline-none py-1 font-serif text-lg font-bold placeholder:text-neutral-300 ${formErrors.name ? 'border-red-600' : 'border-neutral-300'}`}
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Character Name"
                                />
                            </div>
                        </div>

                        {/* Level 0 Toggle */}
                        <div className="bg-white p-6 border-2 border-black shadow-sm">
                            <h2 className="text-black font-black font-serif text-xl border-b-2 border-black mb-4 pb-1">Type</h2>
                            <div className="flex gap-4">
                                <label className={`flex-1 cursor-pointer p-3 border-2 ${formData.level0 ? 'bg-black text-white border-black' : 'bg-white text-neutral-400 border-neutral-200 hover:border-black'} transition-all text-center font-bold uppercase tracking-widest text-sm flex flex-col items-center justify-center gap-1`}>
                                    <input
                                        type="radio"
                                        name="level0"
                                        className="hidden"
                                        checked={formData.level0}
                                        onChange={() => setFormData(prev => ({ ...prev, level0: true }))}
                                    />
                                    <span>Level 0</span>
                                    <span className="text-[8px] opacity-70">Gauntlet</span>
                                </label>
                                <label className={`flex-1 cursor-pointer p-3 border-2 ${!formData.level0 ? 'bg-black text-white border-black' : 'bg-white text-neutral-400 border-neutral-200 hover:border-black'} transition-all text-center font-bold uppercase tracking-widest text-sm flex flex-col items-center justify-center gap-1`}>
                                    <input
                                        type="radio"
                                        name="level0"
                                        className="hidden"
                                        checked={!formData.level0}
                                        onChange={() => setFormData(prev => ({ ...prev, level0: false }))}
                                    />
                                    <span>Level 1</span>
                                    <span className="text-[8px] opacity-70">Hero</span>
                                </label>
                            </div>
                        </div>

                        {/* Stats Block */}
                        <div className="bg-white p-6 border-2 border-black shadow-sm relative">
                            <div className="flex justify-between items-center mb-4 border-b-2 border-black pb-1">
                                <h2 className="text-black font-black font-serif text-xl">Stats</h2>
                                <button
                                    onClick={rollStats}
                                    className="group relative flex items-center justify-center"
                                    title="Roll All Stats (3d6)"
                                >
                                    <div className="w-10 h-10 flex items-center justify-center transition-transform group-hover:scale-110 bg-indigo-600 group-hover:bg-indigo-500 rounded-lg shadow-md">
                                        <img src="/icons/dice-d6.svg" alt="Roll dice" className="w-8 h-8 brightness-0 invert transition-all group-hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
                                    </div>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-y-4 gap-x-6">
                                {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => {
                                    // @ts-ignore
                                    const st = formData.stats[stat];
                                    return (
                                        <div key={stat} data-stat={stat} className="flex min-w-0 items-center justify-between gap-2">
                                            <span className="font-bold text-neutral-500 text-sm tracking-widest">{stat}</span>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    aria-label={`${stat} score`}
                                                    value={st.value}
                                                    onChange={(e) => handleStatChange(stat, e.target.value)}
                                                    className={`w-12 text-center bg-transparent border-b border-neutral-300 focus:border-black outline-none font-serif text-2xl font-bold ${st.value >= 15 ? 'text-amber-600' : 'text-black'} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                                                />
                                                <span className="text-xs font-bold bg-neutral-200 px-2 py-0.5 rounded-full text-neutral-600 min-w-[2rem] text-center">
                                                    {st.mod >= 0 ? '+' : ''}{st.mod}
                                                </span>
                                                <button
                                                    onClick={() => rollSingleStat(stat)}
                                                    className="group relative flex items-center justify-center ml-1"
                                                    title={`Re-roll ${stat}`}
                                                >
                                                    <div className="w-7 h-7 flex items-center justify-center transition-all group-hover:scale-110 bg-indigo-600 group-hover:bg-indigo-500 rounded shadow-sm">
                                                        <img src="/icons/dice-d6.svg" alt="Roll dice" className="w-6 h-6 brightness-0 invert transition-all group-hover:drop-shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* HP & Gold */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Hit Points */}
                            <div className="bg-white p-4 border-2 border-black shadow-sm h-full flex flex-col justify-between">
                                <h2 className="text-black font-black font-serif text-lg border-b-2 border-black mb-2 flex justify-between items-center">
                                    <span>HP</span>
                                </h2>
                                <div className="text-center flex-1 flex flex-col justify-center">
                                    {formData.level0 ? (
                                        <>
                                            <span className="text-3xl font-black font-serif">{formData.hp}</span>
                                            <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-1">1 + CON</p>
                                        </>
                                    ) : (
                                        <span className="text-sm font-bold text-neutral-400 italic">To be determined upon creation</span>
                                    )}
                                </div>
                            </div>

                            {/* Gold */}
                            <div className="bg-white p-4 border-2 border-black shadow-sm h-full flex flex-col justify-between">
                                <h2 className="text-black font-black font-serif text-lg border-b-2 border-black mb-2 flex justify-between items-center">
                                    <span>Gold</span>
                                </h2>
                                <div className="text-center flex-1 flex flex-col justify-center">
                                    {
                                        formData.level0 ? (
                                            <>
                                                <span className="text-xl font-black font-serif">See Details</span>
                                                <p className="text-[10px] text-neutral-400 uppercase tracking-widest mt-1">Starting Gear</p>
                                            </>
                                        ) : (
                                            <span className="text-sm font-bold text-neutral-400 italic">To be determined upon creation</span>
                                        )
                                    }

                                </div>
                            </div>
                        </div>


                    </div>

                    {/* Column 2: Identity & Choices */}
                    <div className="space-y-6">
                        {/* Class */}
                        <div className={`bg-white p-6 border-2 shadow-sm transition-opacity ${formData.level0 ? 'opacity-50 pointer-events-none grayscale border-black' : (formErrors.class ? 'border-red-600' : 'border-black')}`}>
                            <h2 className={`text-black font-black font-serif text-xl border-b-2 mb-4 pb-1 flex justify-between items-center ${formErrors.class ? 'border-red-600 text-red-600' : 'border-black'}`}>
                                <span>Class {formErrors.class && <span className="text-xs uppercase font-sans font-bold float-right mt-1">Required</span>}</span>
                            </h2>
                            <select aria-label="Class"
                                value={formData.class}
                                onChange={(e) => setFormData(prev => ({ ...prev, class: e.target.value }))}
                                className="w-full bg-transparent border-b-2 border-neutral-300 focus:border-black outline-none py-2 text-lg font-bold font-serif"
                                disabled={formData.level0}
                            >
                                <option value="">Select class...</option>
                                {(collections.classes || []).filter((c: any) => c.name !== "Level 0").sort((a: any, b: any) => a.name.localeCompare(b.name)).map((a: any) => (
                                    <option key={a.uuid} value={a.uuid}>{a.name}</option>
                                ))}
                            </select>
                            {formData.level0 && <p className="text-xs text-neutral-400 mt-2 text-center italic">Class is not available for Level 0 characters.</p>}
                        </div>

                        {/* Ancestry */}
                        <div className={`bg-white p-6 border-2 shadow-sm ${formErrors.ancestry ? 'border-red-600' : 'border-black'}`}>
                            <h2 className={`text-black font-black font-serif text-xl border-b-2 mb-4 pb-1 flex justify-between items-center ${formErrors.ancestry ? 'border-red-600 text-red-600' : 'border-black'}`}>
                                <span>Ancestry {formErrors.ancestry && <span className="text-xs uppercase font-sans font-bold float-right mt-1">Required</span>}</span>
                            </h2>
                            <select aria-label="Ancestry"
                                className="w-full bg-transparent border-b-2 border-neutral-300 focus:border-black outline-none py-2 text-lg font-bold font-serif"
                                value={formData.ancestry}
                                onChange={(e) => {
                                    setFormData(prev => ({ ...prev, ancestry: e.target.value }));
                                    setSelectedAncestryTalents([]); // Reset talents on manual change
                                    // Reset languages related to ancestry
                                    setKnownLanguages(prev => ({
                                        ...prev,
                                        selected: { ...prev.selected, ancestry: [] }
                                    }));
                                }}
                            >
                                <option value="">Select Ancestry...</option>
                                {(collections.ancestries || []).sort((a: any, b: any) => a.name.localeCompare(b.name)).map((a: any) => (
                                    <option key={a.uuid} value={a.uuid}>{a.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Background */}
                        <div className={`bg-white p-6 border-2 shadow-sm ${formErrors.background ? 'border-red-600' : 'border-black'}`}>
                            <h2 className={`text-black font-black font-serif text-xl border-b-2 mb-4 pb-1 flex justify-between items-center ${formErrors.background ? 'border-red-600 text-red-600' : 'border-black'}`}>
                                <span>Background {formErrors.background && <span className="text-xs uppercase font-sans font-bold float-right mt-1">Required</span>}</span>
                            </h2>
                            <select
                                value={formData.background}
                                onChange={(e) => setFormData(prev => ({ ...prev, background: e.target.value }))}
                                className="w-full bg-transparent border-b-2 border-neutral-300 focus:border-black outline-none py-2 text-lg font-bold font-serif"
                            >
                                <option value="">Select background...</option>
                                {(collections.backgrounds || []).sort((a: any, b: any) => a.name.localeCompare(b.name)).map((a: any) => (
                                    <option key={a.uuid} value={a.uuid}>{a.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Alignment */}
                        <div className="bg-white p-6 border-2 border-black shadow-sm">
                            <h2 className="text-black font-black font-serif text-xl border-b-2 border-black mb-4 pb-1">Alignment</h2>
                            <select
                                className="w-full bg-transparent border-b-2 border-neutral-300 focus:border-black outline-none py-1 font-serif text-lg"
                                value={formData.alignment}
                                onChange={(e) => setFormData(prev => ({ ...prev, alignment: e.target.value }))}
                            >
                                <option value="lawful">Lawful</option>
                                <option value="neutral">Neutral</option>
                                <option value="chaotic">Chaotic</option>
                            </select>
                        </div>

                        {/* Deity */}
                        <div className="bg-white p-6 border-2 border-black shadow-sm">
                            <h2 className="text-black font-black font-serif text-xl border-b-2 border-black mb-4 pb-1">Deity</h2>
                            <select
                                value={formData.deity}
                                onChange={(e) => setFormData(prev => ({ ...prev, deity: e.target.value }))}
                                className="w-full bg-transparent border-b-2 border-neutral-300 focus:border-black outline-none py-1 font-serif text-lg"
                            >
                                <option value="">Select deity...</option>
                                {(collections.deities || []).sort((a: any, b: any) => a.name.localeCompare(b.name)).map((a: any) => (
                                    <option key={a.uuid} value={a.uuid}>{a.name}</option>
                                ))}
                            </select>
                        </div>


                    </div>
                </div>

                {/* Details Section (Full Width) */}
                <div className="bg-white p-4 border-2 border-black shadow-sm mt-4">
                    <h2 className="text-black font-black font-serif text-lg border-b-2 border-black mb-2">Details</h2>

                    <div className="p-4 space-y-1">

                        {/*          
                        // Need to see temp/shadowdark/templates/apps/character-generator/details.hbs
                        // Follow all leads implement each section as such
	<div class="content details">
		{{> apps/character-generator/details/class-description}}
		{{> apps/character-generator/details/ancestry-talents}}
		{{> apps/character-generator/details/weapons}}
		{{> apps/character-generator/details/armor}}
		{{> apps/character-generator/details/languages}}
		{{> apps/character-generator/details/patron}}
		{{> apps/character-generator/details/class-talents}}
		{{> apps/character-generator/details/gear}}
	</div>
        */}
                        {/* 1. Class Flavor Text (Description) */}
                        {classDetails?.system?.description && !formData.level0 && (
                            <div
                                className="mb-2 italic leading-tight"
                                dangerouslySetInnerHTML={{ __html: presentDescription(classDetails.system.description) }}
                            />
                        )}

                        {/* 2. Ancestry Talent/Feature */}
                        {ancestryDetails && (
                            <div className="mb-1">
                                <div className="leading-tight mb-2">
                                    {(() => {
                                        const rawDesc = ancestryDetails.system?.description?.value || ancestryDetails.system?.description || "";
                                        return <span>{String(rawDesc).replace(/<[^>]+>/g, ' ')}</span>;
                                    })()}
                                </div>

                                {/* 2. Ancestry Talents (Unified List) */}
                                {(ancestryTalents.fixed.length > 0 || ancestryTalents.choiceCount > 0) && (
                                    <div className="mt-1 leading-tight">
                                        <span className={`font-bold ${formErrors.ancestryTalents ? 'text-red-600' : 'text-black'}`}>
                                            Ancestry Talents:
                                        </span>
                                        <span className="ml-1">
                                            {[
                                                ...ancestryTalents.fixed.map(t => t.name),
                                                ...(ancestryTalents.choice.length > 0
                                                    ? ancestryTalents.choice
                                                        .filter(t => selectedAncestryTalents.includes(t.uuid))
                                                        .map(t => t.name)
                                                    : [])
                                            ].join(", ") || (ancestryTalents.choiceCount > 0 ? "None selected" : "")}
                                        </span>

                                        {ancestryTalents.choiceCount > 0 && (
                                            <>
                                                <button
                                                    onClick={() => setShowAncestryTalentsModal(true)}
                                                    className={`ml-2 text-[10px] px-2 py-1 rounded border transition-colors uppercase font-bold tracking-widest ${selectedAncestryTalents.length === ancestryTalents.choiceCount
                                                        ? 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200 hover:border-black'
                                                        : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-indigo-300 hover:border-indigo-400'
                                                        }`}
                                                >
                                                    {selectedAncestryTalents.length === ancestryTalents.choiceCount ? 'Edit Choices' : `Select (${selectedAncestryTalents.length}/${ancestryTalents.choiceCount})`}
                                                </button>
                                                {formErrors.ancestryTalents && <span className="ml-2 text-xs uppercase font-bold text-red-600">Required</span>}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Ancestry Talent Modal */}
                                {showAncestryTalentsModal && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                                        <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm" onClick={() => setShowAncestryTalentsModal(false)}></div>
                                        <div className="relative w-full max-w-lg bg-neutral-50 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                                            <div className="bg-black p-4 flex justify-between items-center">
                                                <h3 className="text-xl font-black text-white uppercase tracking-wider font-serif">
                                                    Choose {ancestryTalents.choiceCount} Talent{ancestryTalents.choiceCount > 1 ? 's' : ''}
                                                </h3>
                                                <button
                                                    onClick={() => setShowAncestryTalentsModal(false)}
                                                    className="text-neutral-400 hover:text-white transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="p-6 overflow-y-auto">
                                                <div className="space-y-3">
                                                    {ancestryTalents.choice.map((t: any) => {
                                                        const isSelected = selectedAncestryTalents.includes(t.uuid);
                                                        const canSelect = isSelected || selectedAncestryTalents.length < ancestryTalents.choiceCount;

                                                        return (
                                                            <div
                                                                key={t.uuid || t.name}
                                                                onClick={() => {
                                                                    if (isSelected) {
                                                                        setSelectedAncestryTalents(prev => prev.filter(id => id !== t.uuid));
                                                                    } else if (canSelect) {
                                                                        setSelectedAncestryTalents(prev => [...prev, t.uuid]);
                                                                    }
                                                                }}
                                                                className={`p-4 border-2 transition-all cursor-pointer ${isSelected
                                                                    ? 'border-black bg-indigo-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                                                    : canSelect
                                                                        ? 'border-neutral-200 hover:border-black hover:bg-neutral-100'
                                                                        : 'border-neutral-100 opacity-50 cursor-not-allowed bg-neutral-50'
                                                                    }`}
                                                            >
                                                                <div className="flex justify-between items-start">
                                                                    <div className={`font-serif font-black text-sm uppercase tracking-widest ${isSelected ? 'text-black' : 'text-neutral-600'}`}>{t.name}</div>
                                                                    {isSelected && <span className="text-indigo-600 font-bold">✓</span>}
                                                                </div>
                                                                <div className="text-xs text-neutral-500 mt-2 font-medium" dangerouslySetInnerHTML={{ __html: presentDescription(t.description) }}></div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="p-4 border-t-4 border-black bg-neutral-100 flex justify-between items-center">
                                                <span className="text-xs font-black uppercase tracking-widest text-neutral-500">
                                                    {selectedAncestryTalents.length} / {ancestryTalents.choiceCount} selected
                                                </span>
                                                <button
                                                    onClick={() => setShowAncestryTalentsModal(false)}
                                                    className="px-6 py-2 bg-black text-white font-black uppercase tracking-widest text-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    disabled={selectedAncestryTalents.length !== ancestryTalents.choiceCount}
                                                >
                                                    Confirm
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                                {/* 7. Class Talents (Fixed) */}
                                {!formData.level0 && classDetails && classTalents.fixed.length > 0 && (
                                    <div className="mt-1 leading-tight">
                                        <span className="font-bold text-black">Class Talents: </span>
                                        <span>
                                            {classTalents.fixed.map(t => t.name).join(", ")}
                                        </span>
                                        {classTalents.table && (
                                            <span className="italic text-neutral-500 ml-1">
                                                (+ Random Class Talent)
                                            </span>
                                        )}
                                    </div>
                                )}

                        {/* 3. Weapons */}
                        <div>
                            <span className="font-bold">Weapons: </span>
                            {formData.level0 ? (
                                <span>All weapons</span>
                            ) : (
                                <span>
                                    {(() => {
                                        if (!classDetails?.system) return "...";
                                        const s = classDetails.system;
                                        const parts = [];
                                        if (s.allWeapons) return "All weapons";
                                        if (s.allMeleeWeapons) parts.push("All melee weapons");
                                        if (s.allRangedWeapons) parts.push("All ranged weapons");
                                        if (s.weapons && Array.isArray(s.weapons)) {
                                            if (weaponNames.length > 0) {
                                                parts.push(weaponNames.join(", "));
                                            } else if (s.weapons.length > 0) {
                                                // Fallback to loading text if UUIDs present but not resolved yet
                                                parts.push("Loading...");
                                            }
                                        }
                                        return parts.length > 0 ? parts.join(", ") : "None";
                                    })()}
                                </span>
                            )}
                        </div>

                        {/* 4. Armor */}
                        <div>
                            <span className="font-bold">Armor: </span>
                            {formData.level0 ? (
                                <span>All armor, shields</span>
                            ) : (
                                <span>
                                    {(() => {
                                        if (!classDetails?.system) return "...";
                                        const s = classDetails.system;
                                        const parts = [];
                                        if (s.allArmor) return "All armor";
                                        if (s.armor && Array.isArray(s.armor)) {
                                            if (armorNames.length > 0) {
                                                parts.push(armorNames.join(", "));
                                            } else if (s.armor.length > 0) {
                                                parts.push("Loading...");
                                            }
                                        }
                                        return parts.length > 0 ? parts.join(", ") : "None";
                                    })()}
                                </span>
                            )}
                        </div>

                        {/* 5. Languages */}
                        {/* 5. Languages */}
                        <div>
                            <span className={`font-bold ${formErrors.languages ? 'text-red-600' : ''}`}>
                                Languages:
                                {formErrors.languages && <span className="ml-2 text-xs uppercase font-bold text-red-600">Required</span>}
                            </span>
                            <span>{[...knownLanguages.fixed, ...Object.values(knownLanguages.selected).flat()].map(languageName).join(', ') || 'None selected'}
                            </span>

                            {(languageConfig.common > 0 || languageConfig.rare > 0 || languageConfig.ancestry.count > 0 || languageConfig.class.count > 0) && (() => {
                                const totalSelected = knownLanguages.selected.common.length + knownLanguages.selected.rare.length + knownLanguages.selected.ancestry.length + knownLanguages.selected.class.length;
                                const totalAllowed = languageConfig.common + languageConfig.rare + languageConfig.ancestry.count + languageConfig.class.count;

                                return (
                                    <button
                                        onClick={() => setShowLanguageModal(true)}
                                        className={`ml-2 text-[10px] px-2 py-1 rounded border transition-colors uppercase font-bold tracking-widest ${totalSelected >= totalAllowed
                                            ? 'bg-neutral-100 text-neutral-600 border-neutral-300 hover:bg-neutral-200'
                                            : 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-indigo-300'
                                            }`}
                                    >
                                        {totalSelected >= totalAllowed ? 'Edit Languages' : `Select (${totalSelected}/${totalAllowed})`}
                                    </button>
                                );
                            })()}
                        </div>

                        <CollectionStatus state={languageData} label="Loading native language choices…" />
                        <ModuleDialog open={showLanguageModal} title="Select Languages" onClose={() => setShowLanguageModal(false)} size="lg"
                            footer={<button type="button" className="min-h-11 border-2 border-black bg-black text-white px-4" onClick={() => setShowLanguageModal(false)}>Done</button>}>
                            <CollectionStatus state={languageData} label="Loading native language choices…" />
                            {languageData.ready && languageData.plan && <LanguageChoices plan={languageData.plan} rows={languageData.rows} selected={knownLanguages.selected}
                                onChange={selected => setKnownLanguages(previous => ({ ...previous, selected }))} />}
                        </ModuleDialog>

                        {/* 6. Patron */}
                        {classDetails?.system?.patron?.required && (
                            <div className="mt-1">
                                <span className="font-bold">Patron: </span>
                                {formData.patron && patronDetails ? (
                                    <span>
                                        <span className="font-bold italic">{patronDetails.name}</span>
                                        <button
                                            onClick={() => setShowPatronModal(true)}
                                            className="ml-2 text-[10px] px-2 py-1 rounded border bg-neutral-100 hover:bg-neutral-200 text-neutral-600 border-neutral-300 uppercase font-bold tracking-widest transition-colors hover:border-black"
                                        >
                                            Edit/Change
                                        </button>
                                        <div className="italic text-neutral-600 text-[11px] mt-1 leading-tight ml-4 border-l-2 border-neutral-200 pl-2">
                                            <span>{String(patronDetails.system?.description?.value || patronDetails.system?.description || '').replace(/<[^>]+>/g, ' ')}</span>
                                        </div>
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => setShowPatronModal(true)}
                                        className="ml-2 text-[10px] px-2 py-1 rounded border bg-red-50 hover:bg-red-100 text-red-800 border-red-200 uppercase font-bold tracking-widest transition-colors hover:border-red-400"
                                    >
                                        Select Patron
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Patron Selection Modal */}
                        {showPatronModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                                <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm" onClick={() => setShowPatronModal(false)}></div>
                                <div className="relative w-full max-w-lg bg-neutral-50 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                                    <div className="bg-black p-4 flex justify-between items-center">
                                        <h3 className="text-xl font-black text-white uppercase tracking-wider font-serif">Choose Patron</h3>
                                        <button onClick={() => setShowPatronModal(false)} className="text-neutral-400 hover:text-white transition-colors">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                                        <div className="generator-patron-selection">
                                            {!(collections.patrons || []).length ? (
                                                <div className="text-center py-8 text-neutral-400 italic font-medium">
                                                    No patrons discovered...
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {(collections.patrons || []).sort((a: any, b: any) => a.name.localeCompare(b.name)).map((p: any) => (
                                                        <div 
                                                            key={p.uuid}
                                                            className={`p-4 border-2 transition-all cursor-pointer flex flex-col items-center text-center gap-1 group ${
                                                                formData.patron === p.uuid 
                                                                    ? 'border-black bg-indigo-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]' 
                                                                    : 'border-neutral-200 hover:border-black hover:bg-neutral-100'
                                                            }`}
                                                            onClick={() => setFormData(prev => ({ ...prev, patron: p.uuid }))}
                                                        >
                                                            <div className="flex justify-between items-center w-full">
                                                                <div className={`font-serif font-black text-sm uppercase tracking-widest ${formData.patron === p.uuid ? 'text-black' : 'text-neutral-600'}`}>
                                                                    {p.name}
                                                                </div>
                                                                {formData.patron === p.uuid && <span className="text-indigo-600 font-bold text-lg">✓</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-4 border-t-4 border-black bg-neutral-100 flex justify-end">
                                        <button
                                            onClick={() => setShowPatronModal(false)}
                                            className="px-8 py-2 bg-black text-white font-black uppercase tracking-widest text-sm hover:bg-neutral-800 transition-colors shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] active:translate-y-1 active:shadow-none"
                                        >
                                            Done
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}




                        {/* 8. Gear */}
                        {/* 8. Gear */}
                        {formData.level0 && (
                            <div className="mt-2 text-sm">
                                <span className="font-bold">Starting Gear: </span>
                                {gearSelected.length > 0 ? (
                                    <ul className="list-disc list-inside text-sm ml-2 mt-1">
                                        {gearSelected.map((item, i) => (
                                            <li key={i}>
                                                {item.name}
                                                {item.system?.quantity > 1 ? ` (${item.system.quantity})` : ''}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <span className="italic text-neutral-500">None</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>




                {/* Create Character CTA Button (Full Width Bottom) */}
                <div className="sd-tool-sheet-footer bg-neutral-900 text-white p-8 border-t-2 border-black flex flex-col items-center justify-center gap-4">
                    <p className="text-neutral-400 font-serif italic text-lg opacity-80">&quot;Protect the light!&quot;</p>
                    {creationError && (
                        <div className="w-full max-w-md bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded text-center text-sm font-bold animate-pulse">
                            {creationError}
                        </div>
                    )}
                    <button
                        onClick={() => createCharacter([])}
                        disabled={loading}
                        className="w-full max-w-md bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded shadow-lg uppercase tracking-widest text-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                    >
                        {loading ? 'Creating...' : 'Create Character'}
                    </button>
                    <p className="text-xs text-neutral-500">{(systemData?.titles?.main || 'Shadowdark')} {systemData?.titles?.version || ''}</p>
                </div>

                </section>

                {/* Stat Selection Modal */}
                {currentStatPrompt && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm"></div>
                        <div className="relative w-full max-w-md bg-neutral-50 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="bg-black p-4">
                                <h3 className="text-xl font-black text-white uppercase tracking-wider font-serif">Increase Stat</h3>
                            </div>
                            <div className="p-6">
                                <p className="text-neutral-600 mb-6 font-medium">
                                    This talent grants <strong className="text-black">+{currentStatPrompt.amount}</strong> to one stat of your choice.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].map(stat => (
                                        <button
                                            key={stat}
                                            onClick={() => handleStatSelect(stat)}
                                            className="p-4 border-2 border-neutral-200 hover:border-black hover:bg-neutral-100 transition-all flex flex-col items-center group"
                                        >
                                            <span className="font-black font-serif text-2xl uppercase tracking-widest group-hover:scale-110 transition-transform">{stat}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* Level Up Modal */}
                {showLevelUp && !formData.level0 && classDetails && (
                    <LevelUpModal
                        actorId=""
                        currentLevel={0}
                        targetLevel={1}
                        ancestry={ancestryDetails}
                        classObj={classDetails}
                        classUuid={formData.class}
                        patron={formData.patron ? { uuid: formData.patron, system: collections.patrons?.find((p: any) => p.uuid === formData.patron) } : null}
                        abilities={formData.stats}
                        availableClasses={collections.classes || []}
                        availableLanguages={languageData.rows}
                        languageChoices={knownLanguages.selected}
                        contextRevision={languageData.plan?.contextRevision}
                        knownLanguages={[
                            ...knownLanguages.fixed.map((l: any) => typeof l === 'string' ? { uuid: l, name: languageName(l) } : l),
                            ...[...knownLanguages.selected.common, ...knownLanguages.selected.rare, ...knownLanguages.selected.ancestry, ...knownLanguages.selected.class].map(uuid => {
                                return { uuid, name: languageName(uuid) };
                            })
                        ]}
                        skipLanguageSelection={true}
                        foundryUrl={foundryUrl}
                        spells={[]}
                        onComplete={(data) => {
                            setShowLevelUp(false);
                            // Since skipLanguageSelection=true the modal's selectedLanguages is always [].
                            // Inject the Generator's already-resolved language UUIDs so createCharacter has them.
                            const genLanguageUuids: string[] = [
                                ...knownLanguages.fixed.map((l: any) => typeof l === 'string' ? l : l?.uuid).filter(Boolean),
                                ...knownLanguages.selected.common,
                                ...knownLanguages.selected.rare,
                                ...knownLanguages.selected.ancestry,
                                ...knownLanguages.selected.class,
                                // Also include any extra fixed uuids from languageConfig that may not be resolved yet
                                ...(languageConfig.fixed || []).filter((u: string) => u)
                            ];
                            // Deduplicate
                            const uniqueLanguageUuids = [...new Set(genLanguageUuids)];
                            createCharacter(data.items, { ...data, languages: uniqueLanguageUuids }, true);
                        }}
                        onCancel={() => {
                            setShowLevelUp(false);
                            setLoading(false);
                        }}
                    />
                )}

                {/* Randomization Overlay */}
                {isRandomizing && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                        <div className="absolute inset-0 bg-neutral-900/80 backdrop-blur-sm"></div>
                        <div className="relative bg-neutral-50 border-4 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] p-8 flex flex-col items-center gap-6 max-w-sm text-center animate-in zoom-in-95 duration-300">
                            <div className="w-16 h-16 border-4 border-neutral-200 border-t-black rounded-full animate-spin"></div>
                            <div>
                                <h3 className="text-2xl font-black text-black uppercase tracking-wider font-serif">Divining Fate...</h3>
                                <p className="text-neutral-500 mt-2 font-medium italic">Consulting the oracles for your destiny.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

};
