import { statChoiceRule, validStatAllocation, type StatAllocation } from '../../../logic/stat-choices';
import { knownSpellSources, grantedSpellSources } from '../../../logic/spell-model';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { isClassSpellcaster } from '../../../logic/rules';
import { logger } from '@sheet-delver/sdk';
import { useSDK } from '@sheet-delver/sdk/react';
import { TALENT_HANDLERS } from '../../../logic/talent-handlers';
import { useShadowdarkUI, useShadowdarkCollections } from '../../context/ShadowdarkUIContext';
import { canonicalUuid } from '../../../logic/identity';
import { useChoiceCatalog } from '../../hooks/useChoiceCatalog';
import { fixedTalentReferences, talentChoiceKind, choiceCatalog } from '../../../logic/talent-choices';
import { spellChoiceGrant, spellFitsGrant, matchSpellGrants } from '../../../logic/spell-grants';
import { useLanguagePlan } from '../../hooks/useLanguagePlan';
import { emptyLanguageSelections, validateLanguageSelections, type LanguageSelections } from '../../../logic/languages';

export interface LevelUpProps {
    actorId: string;
    currentLevel: number;
    targetLevel: number;
    ancestry: any;
    classObj: any;
    classUuid: string;
    patron?: any;
    abilities: any;
    spells: any[];
    availableClasses?: any[];
    availablePatrons?: any[];
    availableLanguages?: any[];
    languageChoices?: LanguageSelections;
    contextRevision?: number;
    baseline?: string;
    reviewOnly?: boolean;
    knownLanguages?: any[]; // Passed for new characters (pre-gen selections)
    skipLanguageSelection?: boolean; // For when languages are handled externally (Generator)
    onComplete: (data: { items: any[], hpRoll: number, gold?: number, languages?: string[], patronUuid?: string, creationPlan?: any }) => void;
    onCancel: () => void;
    foundryUrl?: string;
    actorName?: string;
    patronUuid?: string;
}

export type SectionStatus = 'IDLE' | 'LOADING' | 'READY' | 'ERROR' | 'COMPLETE' | 'DISABLED';
const EMPTY_ARRAY: any[] = [];
const getErrorMessage = (error: unknown, fallback = 'An unexpected error occurred'): string => {
    if (error instanceof Error) return error.message;
    return typeof error === 'string' ? error : fallback;
};
const getRollTotal = (payload: any, label: string): number => {
    const total = Number(payload?.roll?.total ?? payload?.total);
    if (!Number.isFinite(total) || total <= 0) throw new Error(`${label} returned an invalid total`);
    return total;
};
const withDecisionMetadata = (item: any, payload: any) => {
    if (!item) return item;

    const action = payload?.action ?? item.action;
    const config = payload?.config ?? item.config;
    return {
        ...item,
        ...(action !== undefined ? { action } : {}),
        ...(config !== undefined ? { config } : {})
    };
};
const getTalentDecision = (item: any) => {
    const handler = TALENT_HANDLERS.find(candidate => candidate.matches(item));
    return {
        action: item?.action ?? handler?.action,
        config: item?.config ?? handler?.config
    };
};

export const useLevelUp = (props: LevelUpProps) => {
    const {
        actorId,
        currentLevel,
        targetLevel,
        ancestry,
        classObj,
        classUuid,
        patron,
        patronUuid,
        abilities: _abilities,
        availableClasses: propsAvailableClasses,
        availablePatrons: propsAvailablePatrons,
        availableLanguages: propsAvailableLanguages,
        knownLanguages: initialKnownLanguages = EMPTY_ARRAY,
        skipLanguageSelection = false,
        onComplete,
    } = props;

    const { systemData, collections, generation } = useShadowdarkUI();
    const { fetchWithAuth } = useSDK();

    const availableClasses = useMemo(() => {
        if (propsAvailableClasses && propsAvailableClasses.length > 0) return propsAvailableClasses;
        return collections.classes || EMPTY_ARRAY;
    }, [propsAvailableClasses, collections.classes]);

    const availableLanguages = useMemo(() => {
        if (propsAvailableLanguages && propsAvailableLanguages.length > 0) return propsAvailableLanguages;
        return collections.languages || EMPTY_ARRAY;
    }, [propsAvailableLanguages, collections.languages]);

    const [statuses, setStatuses] = useState<Record<string, SectionStatus>>({
        class: 'LOADING',
        extraSpells: 'IDLE',
        patron: 'DISABLED',
        hp: 'IDLE',
        gold: 'IDLE',
        talents: 'IDLE',
        boons: 'DISABLED',
        spells: 'DISABLED',
        languages: 'DISABLED'
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [operation, setOperation] = useState<any>(null);
    const closeReview = useRef(props.onCancel);
    closeReview.current = props.onCancel;
    const submission = useRef<any>(null);
    const submitting = useRef(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    const [error, setError] = useState<string | null>(null);
    const [confirmReroll, setConfirmReroll] = useState(false);

    const [targetClassUuid, setTargetClassUuid] = useState(classUuid || "");
    const authorityKey = JSON.stringify([actorId, targetClassUuid, classUuid, currentLevel, targetLevel, generation]);
    const authorityRef = useRef(authorityKey); authorityRef.current = authorityKey;
    const dataSequence = useRef(0);
    const [levelData, setLevelData] = useState<{ key: string; ready: boolean }>({ key: '', ready: false });
    useEffect(() => () => { dataSequence.current++; }, []);
    const [activeClassObj, setActiveClassObj] = useState<any>(classObj);

    // Sync props to state if not yet set
    useEffect(() => {
        if (!targetClassUuid && classUuid) setTargetClassUuid(classUuid);
    }, [classUuid, targetClassUuid]);

    useEffect(() => {
        if (!classObj) return;
        const currentStr = JSON.stringify(activeClassObj || {});
        const newStr = JSON.stringify(classObj || {});
        if (currentStr !== newStr) {
            setActiveClassObj(classObj);
        }
    }, [classObj, activeClassObj]);

    // Initialize selectedPatronUuid from props if available
    const [selectedPatronUuid, setSelectedPatronUuid] = useState<string>(patronUuid || patron?.uuid || "");
    useEffect(() => {
        if (!selectedPatronUuid && (patronUuid || patron?.uuid)) {
            setSelectedPatronUuid(patronUuid || patron?.uuid || "");
        }
    }, [patronUuid, patron, selectedPatronUuid]);

    const [fetchedPatron, setFetchedPatron] = useState<any>(null);
    const availablePatrons = useMemo(() => {
        if (propsAvailablePatrons && propsAvailablePatrons.length > 0) return propsAvailablePatrons;
        return collections.patrons || EMPTY_ARRAY;
    }, [propsAvailablePatrons, collections.patrons]);


    const [selectedLanguageGroups, setSelectedLanguageGroups] = useState<LanguageSelections>(emptyLanguageSelections);
    const [fixedLanguages, setFixedLanguages] = useState<string[]>([]);
    const [knownLanguages, setKnownLanguages] = useState<any[]>(initialKnownLanguages);
    const languageData = useLanguagePlan({
        ancestryUuid: !actorId || actorId === 'new' ? ancestry?.uuid : undefined,
        classUuid: activeClassObj?.uuid ?? targetClassUuid,
        actorId: actorId && actorId !== 'new' ? actorId : undefined,
        enabled: !skipLanguageSelection && targetLevel === 1 && !!activeClassObj,
    });
    const languageGroups = languageData.plan?.groups ?? [];
    const selectedLanguages = [...new Set([...fixedLanguages, ...Object.values(selectedLanguageGroups).flat()])];

    const [talentTable, setTalentTable] = useState<any>(null);
    const [boonTable, setBoonTable] = useState<any>(null);
    const [availableSpells, setAvailableSpells] = useState<any[]>([]);

    const [hpRoll, setHpRoll] = useState<number | null>(null);
    const [hpFormula, setHpFormula] = useState<string>("");
    const [hpMax, setHpMax] = useState<number>(0);
    const [goldRoll, setGoldRoll] = useState<number | null>(null);
    const [rolledTalents, setRolledTalents] = useState<any[]>([]);
    const [rolledBoons, setRolledBoons] = useState<any[]>([]);
    const [selectedSpells, setSelectedSpells] = useState<any[]>([]);
    const [pendingChoices, setPendingChoices] = useState<any>(null);

    const [spellsToChoose, setSpellsToChoose] = useState<Record<number, number>>({});
    const [spellsToChooseTotal, setSpellsToChooseTotal] = useState(0);
    const [existingItems, setExistingItems] = useState<any[]>([]);
    const [statSelection, setStatSelection] = useState<{ required: number; selected: string[] }>({ required: 0, selected: [] });
    const [statPool, setStatPool] = useState<{ total: number; allocated: Record<string, number>; talentIndex: number | null; maxPerStat?: number }>({ total: 0, allocated: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, talentIndex: null });
    const [weaponMasterySelection, setWeaponMasterySelection] = useState<{ required: number; selected: string[] }>({ required: 0, selected: [] });
    const [armorMasterySelection, setArmorMasterySelection] = useState<{ required: number; selected: string[] }>({ required: 0, selected: [] });
    const [spellAdvantageSelection, setSpellAdvantageSelection] = useState<{ required: number; selected: string[] }>({ required: 0, selected: [] });
    const spellEffectData = useShadowdarkCollections(['spells'], spellAdvantageSelection.required > 0);
    const needsMastery = weaponMasterySelection.required > 0 || armorMasterySelection.required > 0;
    const masteryData = useChoiceCatalog(needsMastery);
    const [extraSpellSelection, setExtraSpellSelection] = useState<{ active: boolean; maxTier: number; source: string; selected: any[] }>({ active: false, maxTier: 0, source: '', selected: [] });
    const extraSpellData = useShadowdarkCollections(['classes', 'spells'], extraSpellSelection.active);

    const [isSpellcaster, setIsSpellcaster] = useState(false);
    useEffect(() => {
        if (activeClassObj) {
            setIsSpellcaster(isClassSpellcaster(activeClassObj));
        }
    }, [activeClassObj]);

    const [requiredTalents, setRequiredTalents] = useState(0);
    const [needsBoon, setNeedsBoon] = useState(Boolean(classObj?.system?.patron?.required));
    const [startingBoons, setStartingBoons] = useState(0);
    const [choiceRolls, setChoiceRolls] = useState(0);

    // Calculate Granted Boons from Talents (e.g. Patron Boon (x2))
    const grantedBoons = useMemo(() => {
        let count = 0;
        rolledTalents.forEach(t => {
            if (t.type === 'PatronBoonTwice' || t.name === 'Patron Boon (x2)') count += 2;
            else if (t.type === 'PatronBoon' || t.name === 'Patron Boon') count += 1;
        });
        return count;
    }, [rolledTalents]);

    const totalRequiredBoons = startingBoons + grantedBoons;

    const fetchByUuid = useCallback(async (uuid: string) => {
        try {
            const headers: any = {};

            const res = await fetchWithAuth(`/api/modules/shadowdark/document/${encodeURIComponent(uuid)}`, { headers });
            if (!res.ok) return null;
            // The caller-safe document route returns the document itself.
            return await res.json();
        } catch (e) {
            logger.error(`[LevelUp] Failed to fetch document: ${uuid}`, e);
            return null;
        }
    }, [fetchWithAuth]);

    const fetchDocument = fetchByUuid;
    const fixedChoiceKey = JSON.stringify([targetLevel, activeClassObj?.uuid, activeClassObj?.system?.talents,
        activeClassObj?.system?.features, activeClassObj?.system?.abilities, activeClassObj?.system?.classAbilities, ancestry]);
    const [fixedChoices, setFixedChoices] = useState<{ key: string; items: any[]; error?: string } | null>(null);
    useEffect(() => {
        let current = true;
        const load = async () => {
            try {
                if (targetLevel !== 1) { if (current) setFixedChoices({ key: fixedChoiceKey, items: [] }); return; }
                const ancestryDoc = typeof ancestry === 'string' ? await fetchDocument(ancestry) : ancestry;
                // Aliases in one fixed source are duplicates; class/ancestry and
                // rolled grants remain independent even with the same UUID.
                const refs = [activeClassObj, ancestryDoc].flatMap(doc => [...new Set(fixedTalentReferences(doc))]);
                const docs = await Promise.all(refs.map(ref => fetchDocument(ref)));
                if (docs.some(doc => !doc)) throw new Error('Required class or ancestry talents are unavailable. Retry after their data loads.');
                if (current) setFixedChoices({ key: fixedChoiceKey, items: docs.filter(doc => talentChoiceKind(doc) || spellChoiceGrant(doc) || statChoiceRule(doc)) });
            } catch (error) {
                if (current) {
                    const message = getErrorMessage(error);
                    setFixedChoices({ key: fixedChoiceKey, items: [], error: message });
                    setError(message);
                }
            }
        };
        void load();
        return () => { current = false; };
    }, [fixedChoiceKey, targetLevel, activeClassObj, ancestry, fetchDocument]);

    const statGrants = useMemo(() => [...rolledTalents, ...rolledBoons,
        ...(fixedChoices?.key === fixedChoiceKey ? fixedChoices.items : [])].filter(item => statChoiceRule(item)),
        [rolledTalents, rolledBoons, fixedChoices, fixedChoiceKey]);
    const statChoicesKey = JSON.stringify(statGrants.map(item => [item.uuid ?? item.name, statChoiceRule(item)]));
    const [statChoiceState, setStatChoiceState] = useState<{ key: string; values: StatAllocation[] }>({ key: '', values: [] });
    const statChoices: StatAllocation[] = statChoiceState.key === statChoicesKey ? statChoiceState.values : statGrants.map(() => ({}));
    const changeStatChoice = (index: number, stat: string, delta: number) => {
        const rule = statChoiceRule(statGrants[index]); if (!rule) return;
        const values = statChoices.map(value => ({ ...value }));
        const allocation = values[index] ?? {};
        const value = (allocation[stat] ?? 0) + delta;
        if (value < 0 || value > rule.maxPerStat) return;
        allocation[stat] = value;
        if (Object.values(allocation).reduce((sum, points) => sum + points, 0) > rule.total) return;
        values[index] = allocation; setStatChoiceState({ key: statChoicesKey, values });
    };

    const extraSpellGrants = useMemo(() => [...rolledTalents, ...rolledBoons,
        ...(fixedChoices?.key === fixedChoiceKey ? fixedChoices.items : [])].filter(item => spellChoiceGrant(item)),
        [rolledTalents, rolledBoons, fixedChoices, fixedChoiceKey]);
    const extraSpellContext = useMemo(() => ({ level: targetLevel, known: [...existingItems, ...selectedSpells], classDoc: activeClassObj }),
        [targetLevel, existingItems, selectedSpells, activeClassObj]);
    const extraSpellsList = useMemo(() => {
        if (!extraSpellData.ready) return [];
        const known = knownSpellSources(existingItems);
        const granted = grantedSpellSources(existingItems, [...(targetLevel === 1 ? activeClassObj?.system?.talents ?? [] : []), ...rolledTalents.map(talent => talent.uuid), ...rolledBoons.map(boon => boon.uuid)]);
        return collections.spells.filter(spell => extraSpellGrants.some(grant => spellFitsGrant(grant, spell, extraSpellContext)))
            .map(spell => ({ ...spell, isKnown: known.has(canonicalUuid(spell.uuid) ?? ''), isInnate: granted.has(canonicalUuid(spell.uuid) ?? ''),
                isGrantBlocked: !extraSpellSelection.selected.some(selected => selected.uuid === spell.uuid)
                    && !matchSpellGrants(extraSpellGrants, [...extraSpellSelection.selected, spell], extraSpellContext) }));
    }, [extraSpellData.ready, collections.spells, existingItems, targetLevel, activeClassObj, rolledTalents, rolledBoons, extraSpellGrants, extraSpellContext, extraSpellSelection.selected]);

    const spellEffectOptions = useMemo(() => {
        const granted = grantedSpellSources(existingItems, [...(targetLevel === 1 ? activeClassObj?.system?.talents ?? [] : []),
            ...rolledTalents.map(item => item.uuid), ...rolledBoons.map(item => item.uuid)]);
        return choiceCatalog([...existingItems, ...selectedSpells, ...extraSpellSelection.selected,
            ...(collections.spells ?? []).filter(spell => granted.has(canonicalUuid(spell.uuid) ?? ''))]).spell ?? [];
    }, [existingItems, targetLevel, activeClassObj, rolledTalents, rolledBoons, selectedSpells, extraSpellSelection.selected, collections.spells]);

    const fetchLevelUpData = useCallback(async (classUuidOverride?: string) => {
        if (!actorId && !classUuidOverride) return;
        const key = authorityKey, sequence = ++dataSequence.current;
        const stale = () => key !== authorityRef.current || sequence !== dataSequence.current;
        setLevelData({ key, ready: false });
        try {
            let url = `/api/modules/shadowdark/actors/${actorId || 'new'}/level-up/data`;
            const params = new URLSearchParams();
            if (classUuidOverride) params.set('classId', classUuidOverride);
            if (selectedPatronUuid) params.set('patronId', selectedPatronUuid);

            const queryString = params.toString();
            if (queryString) url += `?${queryString}`;

            const headers: any = { 'Content-Type': 'application/json' };

            const res = await fetchWithAuth(url, { headers, cache: 'no-store' });
            const json = await res.json();
            if (stale()) return;
            if (!res.ok || !json.success || !json.data) throw new Error(json.error?.message ?? json.error ?? `Advancement data HTTP ${res.status}`);

            if (json.success && json.data) {
                const apiData = json.data;
                if (props.reviewOnly && !apiData.advancementOperation) {
                    // A concurrent authoritative refresh may already have settled it.
                    closeReview.current();
                    return;
                }
                if (apiData.advancementOperation && !submitting.current) {
                    setOperation((previous: any) => previous?.state === 'retired' ? previous : apiData.advancementOperation);
                    submission.current ??= { requestId: apiData.advancementOperation.requestId };
                }
                setLevelData({ key, ready: apiData.progressionReady !== false });
                if (apiData.diagnostics?.length) setError(apiData.diagnostics.join(' '));
                const isCaster = apiData.isSpellcaster;
                if (isCaster !== undefined) setIsSpellcaster(isCaster);

                let total = 0;
                if (apiData.spellsToChoose) {
                    setSpellsToChoose(apiData.spellsToChoose);
                    total = Object.values(apiData.spellsToChoose as Record<number, number>).reduce((a, b) => a + b, 0);
                    setSpellsToChooseTotal(total);
                }

                if (apiData.availableSpells) {
                    const unique = new Map();
                    if (Array.isArray(apiData.availableSpells)) {
                        apiData.availableSpells.forEach((s: any) => {
                            if (!unique.has(s.uuid)) unique.set(s.uuid, s);
                        });
                        setAvailableSpells(Array.from(unique.values()));
                        setSelectedSpells(previous => previous.filter(spell => {
                            const current = unique.get(spell.uuid);
                            return current && !current.isInnate && !current.isKnown;
                        }));
                    }
                }
                if (apiData.knownLanguages) setKnownLanguages(apiData.knownLanguages);
                if (apiData.talentTable) setTalentTable(apiData.talentTable);
                if (apiData.patronBoonTable) setBoonTable(apiData.patronBoonTable);

                setStatuses(prev => ({
                    ...prev,
                    spells: (isCaster || total > 0) ? 'IDLE' : 'DISABLED',
                    boons: apiData.patronBoonTable ? 'IDLE' : 'DISABLED'
                }));
            }
        } catch (e) {
            if (stale()) return;
            logger.error("Failed to fetch level up data", e);
            setError(`Advancement data is unavailable: ${getErrorMessage(e)}. Reopen after refreshing to retry.`);
            setLevelData({ key, ready: false });
            setStatuses(prev => ({ ...prev, class: 'ERROR' }));
        }
    }, [actorId, fetchWithAuth, selectedPatronUuid, authorityKey, props.reviewOnly]);

    useEffect(() => {
        if (props.reviewOnly) void fetchLevelUpData();
    }, [props.reviewOnly, fetchLevelUpData]);

    const handlePatronChange = useCallback((uuid: string) => {
        setSelectedPatronUuid(uuid);
        setRolledBoons([]);
        setBoonTable(null);
        setFetchedPatron(null);
    }, []);

    const handleRollHP = async (isReroll = false) => {
        setStatuses(prev => ({ ...prev, hp: 'LOADING' }));
        setError(null);
        try {
            // Prefer the UUID of the loaded class object, or the target selection, or the prop
            const cId = activeClassObj?.uuid || targetClassUuid || classUuid;

            const headers: any = { 'Content-Type': 'application/json' };

            const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actorId || 'new'}/level-up/roll-hp`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ isReroll, classId: cId })
            });
            const json = await res.json();
            if (json.success) {
                setHpRoll(getRollTotal(json, 'Hit point roll'));
                if (json.formula) setHpFormula(json.formula);
                setConfirmReroll(false);
                setStatuses(prev => ({ ...prev, hp: 'COMPLETE' }));
            } else {
                setError(json.error || "Failed to roll HP");
                setStatuses(prev => ({ ...prev, hp: 'ERROR' }));
            }
        } catch (error: unknown) {
            setError(getErrorMessage(error));
            setStatuses(prev => ({ ...prev, hp: 'ERROR' }));
        }
    };

    const handleRollGold = async (isReroll = false) => {
        setStatuses(prev => ({ ...prev, gold: 'LOADING' }));
        setError(null);
        try {
            const cId = activeClassObj?.uuid || targetClassUuid || classUuid;

            const headers: any = { 'Content-Type': 'application/json' };

            const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actorId || 'new'}/level-up/roll-gold`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ isReroll, classId: cId })
            });
            const json = await res.json();
            if (json.success) {
                setGoldRoll(getRollTotal(json, 'Starting gold roll'));
                setStatuses(prev => ({ ...prev, gold: 'COMPLETE' }));
            } else {
                setError(json.error || "Failed to roll Gold");
                setStatuses(prev => ({ ...prev, gold: 'ERROR' }));
            }
        } catch (error: unknown) {
            setError(getErrorMessage(error));
            setStatuses(prev => ({ ...prev, gold: 'ERROR' }));
        }
    };


    const handleRollTalent = async () => {
        if (!talentTable) {
            setError("No Talent Table found for this class.");
            return;
        }
        setStatuses(prev => ({ ...prev, talents: 'LOADING' }));
        setError(null);
        try {
            const headers: any = { 'Content-Type': 'application/json' };

            const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actorId || 'new'}/level-up/roll-talent`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    tableUuidOrName: talentTable,
                    targetLevel
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to roll talent');
            }

            const data = await res.json();
            const { item: responseItem, needsChoice, choiceOptions, choiceCount } = data;
            const item = withDecisionMetadata(responseItem, data);

            if (needsChoice) {
                setPendingChoices({
                    header: item?.name || "Select an Option",
                    options: choiceOptions,
                    context: 'talent',
                    maxSelections: choiceCount || 1
                });
            } else if (item) {
                setRolledTalents(prev => [...prev, item]);
            } else {
                // Item was filtered out or invalid
                setError("Rolled an invalid result (likely 'OR' or empty). Please roll again.");
                setStatuses(prev => ({ ...prev, talents: 'READY' }));
            }
        } catch (error: unknown) {
            setError(getErrorMessage(error));
            setStatuses(prev => ({ ...prev, talents: 'ERROR' }));
        }
    };

    const handleRollBoon = async () => {
        if (!boonTable) {
            setError("No Boon Table found. Please select a Patron first.");
            return;
        }
        setStatuses(prev => ({ ...prev, boons: 'LOADING' }));
        setError(null);
        try {
            const headers: any = { 'Content-Type': 'application/json' };

            const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actorId || 'new'}/level-up/roll-boon`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    tableUuidOrName: boonTable,
                    targetLevel
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to roll boon');
            }

            const data = await res.json();
            const { item: responseItem, needsChoice, choiceOptions, choiceCount } = data;
            const item = withDecisionMetadata(responseItem, data);

            if (needsChoice) {
                setPendingChoices({
                    header: item?.name || "Select an Option",
                    options: choiceOptions,
                    context: 'boon',
                    maxSelections: choiceCount || 1
                });
            } else if (item) {
                setRolledBoons(prev => [...prev, item]);
            } else {
                // Item was filtered out or invalid
                setError("Rolled an invalid boon result. Please roll again.");
                setStatuses(prev => ({ ...prev, boons: 'READY' }));
            }
        } catch (error: unknown) {
            setError(getErrorMessage(error));
            setStatuses(prev => ({ ...prev, boons: 'ERROR' }));
        }
    };
    const handleChoiceSelection = async (choiceOrResult: any | any[]) => {
        // Handle closing/cancellation
        if (!choiceOrResult) {
            setPendingChoices(null);
            setStatuses(prev => ({
                ...prev,
                talents: prev.talents === 'LOADING' ? 'READY' : prev.talents,
                boons: prev.boons === 'LOADING' ? 'READY' : prev.boons
            }));
            return;
        }

        const context = pendingChoices?.context || 'talent';
        const replaceIndex = pendingChoices?.replaceIndex;
        setPendingChoices(null);

        // Normalize to array
        const selections = Array.isArray(choiceOrResult) ? choiceOrResult : [choiceOrResult];

        setStatuses(prev => ({
            ...prev,
            [context === 'boon' ? 'boons' : 'talents']: 'LOADING'
        }));

        try {
            for (const selection of selections) {
                const raw = selection.original || selection;

                // Special handling for Distribute to Stats (Table Result)
                const isDistribute = getTalentDecision(raw).action === 'stat-pool';
                const isPatronBoon = raw.type === 'PatronBoon' || raw.type === 'PatronBoonTwice';

                if (isPatronBoon) {
                    if (!boonTable) {
                        setError("No Patron Boon table available.");
                        continue;
                    }

                    const iterations = raw.type === 'PatronBoonTwice' ? 2 : 1;
                    const headers: any = { 'Content-Type': 'application/json' };

                    for (let i = 0; i < iterations; i++) {
                        const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actorId || 'new'}/level-up/roll-boon`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({
                                tableUuidOrName: boonTable,
                                targetLevel
                            })
                        });

                        if (res.ok) {
                            const data = await res.json();
                            const { item: responseItem, needsChoice, choiceOptions, choiceCount } = data;
                            const resultItem = withDecisionMetadata(responseItem, data);

                            if (needsChoice) {
                                setPendingChoices({
                                    header: resultItem?.name || "Select an Option",
                                    options: choiceOptions,
                                    context, // Keep context (likely 'talent' if rolled from talent table) to fill slot
                                    replaceIndex, // If we are replacing, this might be tricky with x2. 
                                    // If x2, first one replaces, second one appends?
                                    maxSelections: choiceCount || 1
                                });
                            } else if (resultItem) {
                                if (context === 'boon') {
                                    setRolledBoons(prev => {
                                        const next = [...prev];
                                        // A single result replaces its placeholder; multi-boon
                                        // results expand the choice by appending each result.
                                        if (iterations === 1 && replaceIndex !== undefined && replaceIndex !== null && replaceIndex < next.length) {
                                            next[replaceIndex] = resultItem;
                                            return next;
                                        }
                                        return [...prev, resultItem];
                                    });
                                } else {
                                    setRolledTalents(prev => {
                                        const next = [...prev];
                                        if (iterations === 1 && replaceIndex !== undefined && replaceIndex !== null && replaceIndex < next.length) {
                                            next[replaceIndex] = resultItem;
                                            return next;
                                        }
                                        return [...prev, resultItem];
                                    });
                                }
                            }
                        }
                    }
                    continue;
                }

                // If it's a RollTable AND NOT Distribute to Stats, roll on it
                if (!isDistribute && (raw.type === 'RollTable' || raw.documentCollection === 'RollTable' || raw.documentType === 'RollTable')) {
                    const uuid = raw.documentUuid || raw.uuid || `Compendium.${raw.collection}.${raw.documentId}`;
                    const headers: any = { 'Content-Type': 'application/json' };

                    const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actorId || 'new'}/level-up/roll-talent`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            tableUuidOrName: uuid,
                            targetLevel
                        })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const { item: responseItem, needsChoice, choiceOptions, choiceCount } = data;
                        const item = withDecisionMetadata(responseItem, data);

                        if (needsChoice) {
                            // The state currently represents one pending selection overlay.
                            setPendingChoices({
                                header: item?.name || "Select an Option",
                                options: choiceOptions,
                                context,
                                replaceIndex, // Only applies to first if replacing?
                                maxSelections: choiceCount || 1
                            });
                        } else if (item) {
                            if (replaceIndex !== undefined && replaceIndex !== null) {
                                if (context === 'boon') {
                                    setRolledBoons(prev => {
                                        const next = [...prev];
                                        // One resolved selection replaces its placeholder;
                                        // multi-select results are appended.
                                        if (selections.length === 1 && replaceIndex < next.length) {
                                            next[replaceIndex] = item;
                                            return next;
                                        }
                                        return [...prev, item];
                                    });
                                } else {
                                    setRolledTalents(prev => {
                                        const next = [...prev];
                                        if (selections.length === 1 && replaceIndex !== undefined && replaceIndex < next.length) {
                                            next[replaceIndex] = item;
                                            return next;
                                        }
                                        return [...prev, item];
                                    });
                                }
                            } else {
                                if (context === 'boon') setRolledBoons(prev => [...prev, item]);
                                else setRolledTalents(prev => [...prev, item]);
                            }
                        }
                    }
                } else {
                    // Direct item selection (including Distribute to Stats)
                    if (replaceIndex !== undefined && replaceIndex !== null) {
                        if (context === 'boon') {
                            setRolledBoons(prev => {
                                const next = [...prev];
                                if (selections.length === 1 && replaceIndex < next.length) {
                                    next[replaceIndex] = raw;
                                    return next;
                                }
                                return [...prev, raw];
                            });
                        } else {
                            setRolledTalents(prev => {
                                const next = [...prev];
                                if (selections.length === 1 && replaceIndex < next.length) {
                                    next[replaceIndex] = raw;
                                    return next;
                                }
                                return [...prev, raw];
                            });
                        }
                    } else {
                        if (context === 'boon') setRolledBoons(prev => [...prev, raw]);
                        else setRolledTalents(prev => [...prev, raw]);
                    }
                }
            }

        } catch (error: unknown) {
            setError(getErrorMessage(error, 'Failed to resolve choice'));
        } finally {
            setStatuses(prev => ({
                ...prev,
                [context === 'boon' ? 'boons' : 'talents']: 'READY'
            }));
        }
    };



    const handleResetTalents = () => {
        setRolledTalents([]);
        setError(null);
    };

    const handleResetBoons = () => {
        setRolledBoons([]);
        setError(null);
    };

    const handleResolveNested = async (index: number, item: any, context: 'talent' | 'boon') => {
        setStatuses(prev => ({
            ...prev,
            [context === 'boon' ? 'boons' : 'talents']: 'LOADING'
        }));

        try {
            const decision = getTalentDecision(item);
            if (decision.action === 'stat-pool') {
                const total = Number(decision.config?.total);
                if (!Number.isFinite(total) || total <= 0) {
                    throw new Error('Stat allocation is missing a valid point total');
                }

                const maxPerStat = Number(decision.config?.maxPerStat);
                setStatPool(prev => ({
                    total,
                    allocated: prev.total === total
                        ? prev.allocated
                        : { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
                    talentIndex: context === 'talent' ? index : null,
                    ...(Number.isFinite(maxPerStat) && maxPerStat > 0 ? { maxPerStat } : {})
                }));
                return;
            }

            const uuid = item.documentUuid || item.uuid || item._id;
            const headers: any = { 'Content-Type': 'application/json' };

            const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actorId || 'new'}/level-up/roll-talent`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    tableUuidOrName: uuid,
                    targetLevel
                })
            });

            if (res.ok) {
                const data = await res.json();
                const { item: responseItem, needsChoice, choiceOptions, choiceCount } = data;
                const resultItem = withDecisionMetadata(responseItem, data);

                if (needsChoice) {
                    setPendingChoices({
                        header: resultItem?.name || "Select an Option",
                        options: choiceOptions,
                        context,
                        replaceIndex: index,
                        maxSelections: choiceCount || 1
                    });
                } else if (resultItem) {
                    if (context === 'boon') {
                        setRolledBoons(prev => {
                            const next = [...prev];
                            next[index] = resultItem;
                            return next;
                        });
                    } else {
                        setRolledTalents(prev => {
                            const next = [...prev];
                            next[index] = resultItem;
                            return next;
                        });
                    }
                }
            }
        } catch (error: unknown) {
            setError(getErrorMessage(error, 'Failed to resolve nested table'));
        } finally {
            setStatuses(prev => ({
                ...prev,
                [context === 'boon' ? 'boons' : 'talents']: 'READY'
            }));
        }
    };

    const handleStatToggle = (stat: string) => {
        setStatSelection(prev => {
            const isSelected = prev.selected.includes(stat);
            if (isSelected) {
                return { ...prev, selected: prev.selected.filter(s => s !== stat) };
            } else {
                if (prev.selected.length >= prev.required) return prev;
                return { ...prev, selected: [...prev.selected, stat] };
            }
        });
    };

    const handleStatPoolChange = (stat: string, delta: number) => {
        setStatPool(prev => {
            const currentVal = prev.allocated[stat] || 0;
            const newVal = Math.max(0, currentVal + delta);

            // Enforce maxPerStat
            if (prev.maxPerStat && newVal > prev.maxPerStat) return prev;

            const totalUsed = Object.values(prev.allocated).reduce((a: number, b: any) => a + (Number(b) || 0), 0) - currentVal + newVal;

            if (totalUsed > prev.total) return prev;

            return {
                ...prev,
                allocated: { ...prev.allocated, [stat]: newVal }
            };
        });
    };

    const handleRemoveTalent = (index: number) => {
        setRolledTalents(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveBoon = (index: number) => {
        setRolledBoons(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirm = async (recovery?: any) => {
        if (submitting.current) return;
        const authority = authorityKey;
        if (!submission.current && needsMastery && !masteryData.ready) return;
        if (!submission.current && extraSpellSelection.active && !extraSpellData.ready) return;
        // A review fetched before this attempt cannot replace newer write
        // receipts after its response arrives late.
        dataSequence.current++;
        submitting.current = true;
        setIsSubmitting(true);
        setStatuses(prev => ({ ...prev, class: 'LOADING' }));
        let noWrites = !actorId || actorId === 'new';
        try {
            const headers: any = { 'Content-Type': 'application/json' };
            const revision = operation?.contextRevision ?? props.contextRevision ?? languageData.plan?.contextRevision;
            if (typeof revision === 'number') headers['X-SheetDelver-Context-Revision'] = String(revision);

            submission.current ??= {
                    ...(actorId && actorId !== 'new' ? { requestId: globalThis.crypto.randomUUID(), baseline: props.baseline } : {}),
                    targetLevel,
                    classUuid: targetClassUuid,
                    ancestryUuid: ancestry?.uuid,
                    patronUuid: selectedPatronUuid,
                    rolledTalents,
                    rolledBoons,
                    selectedSpells,
                    hpRoll,
                    gold: goldRoll,
                    languages: selectedLanguages,
                    languageChoices: props.languageChoices ?? selectedLanguageGroups,
                    statChoices,
                    statSelection,
                    statPool,
                    weaponMasterySelection,
                    armorMasterySelection,
                    spellAdvantageSelection,
                    extraSpellSelection
            };
            const res = await fetchWithAuth(`/api/modules/shadowdark/actors/${actorId || 'new'}/level-up/finalize`, {
                method: 'POST', headers, body: JSON.stringify({ ...submission.current, ...(recovery ? { recovery } : {}) })
            });
            const json = await res.json();
            noWrites ||= !res.ok && json.advancementWrites === 'none';
            if (!mounted.current || authority !== authorityRef.current) return;
            if (!res.ok || !json.success) throw new Error(json.error?.message ?? json.error ?? 'Failed to finalize level-up');
            if (actorId && actorId !== 'new' && json.state !== 'complete') {
                dataSequence.current++;
                setOperation(json); setError(json.state === 'retired' ? null : 'Advancement is incomplete. Review the exact receipts below before continuing.');
                setStatuses(prev => ({ ...prev, class: 'READY' }));
                return;
            }
            setOperation(null);

            onComplete({
                items: json.items || [],
                creationPlan: json.creationPlan,
                hpRoll: json.hpRoll ?? hpRoll ?? 0,
                gold: json.goldRoll ?? goldRoll ?? 0,
                languages: json.languages ?? selectedLanguages,
                patronUuid: selectedPatronUuid
            });

        } catch (error: unknown) {
            if (mounted.current && authority === authorityRef.current) {
                if (noWrites) {
                    // Creation preparation performs no Actor/Item writes. An
                    // invalid choice is editable, never a partial advancement.
                    submission.current = null;
                    setOperation(null);
                    setError(getErrorMessage(error));
                } else {
                    setError(`${getErrorMessage(error)}. Reconcile this same request; do not submit replacement grants.`);
                    setOperation((previous: any) => previous ?? { requestId: submission.current?.requestId, state: 'partial', operations: [], recovery: 'No authoritative completion response. Retry the same request to obtain saved receipts.' });
                }
                setStatuses(prev => ({ ...prev, class: 'READY' }));
            }
        } finally {
            submitting.current = false;
            setIsSubmitting(false);
        }
    };


    // Initialization and Sync logic
    useEffect(() => {
        if (props.reviewOnly) return;
        const init = async () => {
            let currentClass = activeClassObj;
            let effectiveClassUuid: string | undefined = targetClassUuid || classUuid;
            let classLoaded = Boolean(currentClass);
            /*
            logger.debug("[LevelUp] Init loop starting", {
                hasActiveClass: !!activeClassObj,
                hasPropClass: !!classObj,
                targetClassUuid,
                classUuid,
            });
            */

            try {
                // Initial state check - if we have nothing, we are in READY state for selection
                if (!targetClassUuid && currentLevel === 0 && !classObj && !classUuid) {
                    logger.debug("[LevelUp] Empty state, waiting for selection");
                    if (activeClassObj !== null) setActiveClassObj(null);
                    setStatuses(prev => {
                        if (prev.class === 'READY') return prev;
                        return { ...prev, class: 'READY' };
                    });
                    return;
                }

                // If we have a local class object from props but state is empty, use it immediately
                if (!currentClass && classObj) {
                    currentClass = { ...classObj };
                    setActiveClassObj(currentClass);
                    classLoaded = true;
                } else if (currentClass) {
                    classLoaded = true;
                }

                const needsFetch = !classLoaded && (targetClassUuid || classUuid);
                
                if (targetClassUuid || classUuid) {
                    const findInList = (uuid: string) => {
                        return availableClasses.find((c: any) => 
                            c.uuid === uuid
                        );
                    };

                    const searchId = targetClassUuid || classUuid;
                    const classInList = findInList(searchId!);

                    if (classInList && classInList.system?.hitPoints && classInList.system?.patron) {
                        // We have the full document in the local list, use it!
                        if (!currentClass) {
                            currentClass = classInList;
                            setActiveClassObj(classInList);
                            if (classInList.uuid) effectiveClassUuid = classInList.uuid;
                            classLoaded = true;
                        }
                    }
                }

                if (needsFetch && !classLoaded) {
                    if (statuses.class !== 'LOADING') setStatuses(prev => ({ ...prev, class: 'LOADING' }));
                    const fetchUuid = targetClassUuid || classUuid;

                    const searchUuid = fetchUuid;
                    const cls = await fetchDocument(searchUuid!);

                    if (cls) {
                        logger.debug("[LevelUp] Successfully fetched class:", cls.name);
                        currentClass = cls;
                        setActiveClassObj(cls);
                        if (cls.uuid) effectiveClassUuid = cls.uuid;
                        classLoaded = true;
                    } else {
                        // If fetch failed, we can't proceed with LOADING state
                        logger.error("[LevelUp] Failed to fetch class document:", searchUuid);
                        // Only error if we literally have no class data at all
                        if (!currentClass) {
                            setError("Failed to load class data. Please check your connection.");
                            setStatuses(prev => ({ ...prev, class: 'ERROR' }));
                            return;
                        }
                    }
                }

                // Authenticated data fetches use the host-managed session cookie.
                if (classLoaded && currentClass) {
                    // logger.debug("[LevelUp] Triggering authenticated data fetches...");
                    if (actorId || effectiveClassUuid) {
                        await fetchLevelUpData(effectiveClassUuid);
                    }

                    if (currentClass?.system?.classTalentTable) {
                        // Sanitize UUID - Foundry sometimes includes .RollTable incorrectly
                        let tableUuid = currentClass.system.classTalentTable;
                        if (tableUuid.includes('Compendium.') && tableUuid.includes('.RollTable.')) {
                            tableUuid = tableUuid.replace('.RollTable.', '.');
                        }
                        setTalentTable(tableUuid);
                    }

                    const requiresPatron = Boolean(currentClass.system?.patron?.required || currentClass.system?.patron?.requiredBoon);

                    // --- Pre-fetch Patrons if needed ---
                    if (requiresPatron) {
                        if (availablePatrons.length > 0) {
                            setStatuses(prev => {
                                if (prev.patron === 'READY') return prev;
                                return { ...prev, patron: 'READY' };
                            });
                        } else {
                            // If we require patron but it's not in collections yet, 
                            // we wait for ShadowdarkUIContext to hydrate it.
                            setStatuses(prev => {
                                if (prev.patron === 'LOADING') return prev;
                                return { ...prev, patron: 'LOADING' };
                            });
                        }
                    } else if (!requiresPatron) {
                        // Ensure patron status doesn't block UI if not required
                        setStatuses(prev => {
                            if (prev.patron === 'DISABLED') return prev;
                            return { ...prev, patron: 'DISABLED' };
                        });
                    }

                    // Advancement Logic
                    const isOddLevel = targetLevel % 2 !== 0;
                    let reqBoons = 0;
                    let choices = 0;
                    let talentTotal = isOddLevel ? 1 : 0;

                    if (requiresPatron) {
                        setNeedsBoon(true);
                        if (targetLevel === 1) {
                            // Level 1 Warlocks get BOTH a Talent and a Boon
                            reqBoons = 1; 
                            talentTotal = 1;
                        } else if (isOddLevel) {
                            // Odd levels (3+) let you choose between Talent OR Boon
                            choices = 1; 
                            talentTotal = 0;
                        } else {
                            talentTotal = 0;
                        }

                        const patronUuidToFetch = selectedPatronUuid || patronUuid || currentClass.system?.patron?.uuid;
                        if (patronUuidToFetch) {
                            // Use availablePatrons first!
                            const patronInList = availablePatrons.find((p: any) => 
                                p.uuid === patronUuidToFetch || p._id === patronUuidToFetch || p.id === patronUuidToFetch
                            );

                            if (patronInList && patronInList.system?.boonTable) {
                                setFetchedPatron(patronInList);
                                let tableUuid = patronInList.system.boonTable;
                                if (tableUuid.includes('.RollTable.')) {
                                    tableUuid = tableUuid.replace('.RollTable.', '.');
                                }
                                setBoonTable(tableUuid);
                            } else {
                                // Fallback to fetch if not in list or not hydrated
                                const fullPatron = await fetchDocument(patronUuidToFetch);
                                if (fullPatron) {
                                    setFetchedPatron(fullPatron);
                                    if (fullPatron.system?.boonTable) {
                                        // Sanitize UUID - Foundry sometimes includes .RollTable incorrectly
                                        let tableUuid = fullPatron.system.boonTable;
                                        if (tableUuid.includes('.RollTable.')) {
                                            tableUuid = tableUuid.replace('.RollTable.', '.');
                                        }
                                        setBoonTable(tableUuid);
                                    }
                                }
                            }
                        }
                    } else {
                        setNeedsBoon(false);
                    }

                    setStartingBoons(reqBoons);
                    setChoiceRolls(choices);

                    if (actorId) {
                        const actorDoc = await fetchDocument(`Actor.${actorId}`);
                        if (actorDoc?.items) {
                            setExistingItems(actorDoc.items);
                            for (const handler of TALENT_HANDLERS) {
                                if (handler.onInit) {
                                    const res = handler.onInit({ actor: actorDoc, targetLevel });
                                    if (res.requiredTalents) talentTotal += res.requiredTalents;
                                }
                            }
                        }
                    }
                    setRequiredTalents(talentTotal);
                }

                // Reset selections on init after the class data settles.
                // Only if everything is settled
                if (classLoaded) {
                    setStatSelection(prev => (prev.required === 0 && prev.selected.length === 0) ? prev : { required: 0, selected: [] });
                }

            } catch (error: any) {
                logger.error("Error in LevelUpModal init:", error);
                setError(error.message || "An unexpected error occurred during initialization.");
                setStatuses(prev => ({ ...prev, class: 'ERROR' }));
            } finally {
                // Final status determination - Only set to COMPLETE if we didn't error
                if (classLoaded) {
                    setStatuses(prev => {
                        // Avoid redundant updates to prevent effect loops
                        if (prev.class === 'ERROR') return prev; // Preserve error
                        if (prev.class === 'COMPLETE' && prev.hp === 'IDLE' && prev.extraSpells === 'DISABLED') return prev;

                        return {
                            ...prev,
                            class: 'COMPLETE',
                            hp: prev.hp === 'LOADING' || prev.hp === 'COMPLETE' ? prev.hp : 'IDLE',
                            gold: currentLevel === 0 ? (prev.gold === 'COMPLETE' ? 'COMPLETE' : 'IDLE') : 'DISABLED',
                            languages: targetLevel === 1 ? (prev.languages === 'COMPLETE' ? 'COMPLETE' : 'IDLE') : 'DISABLED',
                            extraSpells: 'DISABLED'
                        };
                    });
                }
            }
        };
        init();
    }, [props.reviewOnly, classObj, actorId, targetLevel, targetClassUuid, selectedPatronUuid, patronUuid, availableClasses, availablePatrons, collections, classUuid, currentLevel, fetchDocument, fetchLevelUpData, activeClassObj, statuses.class]);

    useEffect(() => {
        if (!languageData.ready || !languageData.plan) return;
        const plan = languageData.plan;
        setFixedLanguages(plan.fixed);
        setSelectedLanguageGroups(previous => {
            const next = { ...previous }, used = new Set(plan.fixed);
            for (const group of plan.groups) { next[group.id] = previous[group.id].filter(uuid => group.options.includes(uuid) && !used.has(uuid)).slice(0,group.count);next[group.id].forEach(uuid => used.add(uuid)); }
            return next;
        });
    }, [languageData.plan, languageData.ready]);

    // Clear LOADING status when selections update
    useEffect(() => {
        setStatuses(prev => {
            const next = { ...prev };
            let changed = false;

            if (prev.talents === 'LOADING') {
                next.talents = 'READY';
                changed = true;
            }
            if (prev.boons === 'LOADING') {
                next.boons = 'READY';
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [rolledTalents, rolledBoons]);

    // Sync Stat Pool and Selection based on rolled talents
    // Sync UI state based on rolled talents/boons
    useEffect(() => {
        let poolTotal = 0;
        let selectionReq = 0;
        let talentIndex: number | null = null;
        let hasDist = false;
        let maxPerStat = 0;

        let wmReq = 0;
        let amReq = 0;
        let saReq = 0;

        let esActive = false;
        const esSources: string[] = [];

        const processItem = (item: any, index: number | null) => {
            const decision = getTalentDecision(item);
            if (decision.action) {
                switch (decision.action) {
                    case 'stat-pool':
                        poolTotal += decision.config?.total || 0;
                        if (decision.config?.maxPerStat) maxPerStat = decision.config.maxPerStat;
                        if (index !== null) {
                            talentIndex = index;
                            hasDist = true;
                        }
                        break;
                    case 'stat-selection':
                        selectionReq += decision.config?.required || 0;
                        break;
                    case 'weapon-mastery':
                        wmReq += decision.config?.required || 0;
                        break;
                    case 'armor-mastery':
                        amReq += decision.config?.required || 0;
                        break;
                    case 'spell-advantage':
                        saReq += decision.config?.required || 0;
                        break;
                    case 'extra-spell':
                        esActive = true;

                        esSources.push(spellChoiceGrant(item)!.label);
                        break;
                }
            }
        };

        rolledTalents.forEach((item, index) => processItem(item, index));
        rolledBoons.forEach((item) => processItem(item, null));
        if (fixedChoices?.key === fixedChoiceKey) fixedChoices.items.forEach(item => processItem(item, null));

        setStatPool(prev => {
            if (prev.total !== poolTotal) {
                return {
                    total: poolTotal,
                    allocated: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
                    talentIndex,
                    maxPerStat
                };
            }
            if (prev.talentIndex !== talentIndex && hasDist) {
                return { ...prev, talentIndex };
            }
            return prev;
        });

        setStatSelection(prev => {
            if (prev.required !== selectionReq) {
                return { required: selectionReq, selected: [] };
            }
            return prev;
        });

        setWeaponMasterySelection(prev => {
            if (prev.required !== wmReq) {
                return { required: wmReq, selected: [] };
            }
            return prev;
        });

        setArmorMasterySelection(prev => {
            if (prev.required !== amReq) {
                return { required: amReq, selected: [] };
            }
            return prev;
        });

        setSpellAdvantageSelection(prev => prev.required === saReq ? prev : { required: saReq, selected: [] });

        const esSource = esSources.join(', ');
        setExtraSpellSelection(prev => {
            if (prev.active !== esActive || (esActive && prev.source !== esSource)) {
                if (!esActive) return { active: false, maxTier: 0, source: '', selected: [] };

                // Per-grant tier/list eligibility is shared with final validation.
                const maxTier = 5;
                return {
                    active: true,
                    maxTier,
                    source: esSource,
                    selected: []
                };
            }
            return prev;
        });

    }, [rolledTalents, rolledBoons, targetLevel, fixedChoices, fixedChoiceKey]);

    useEffect(() => {
        if (targetClassUuid && targetClassUuid !== classUuid) {
            setHpRoll(0); setGoldRoll(0); setRolledTalents([]); setRolledBoons([]); setSelectedSpells([]); setPendingChoices(null); setSelectedPatronUuid("");
        }
    }, [targetClassUuid, classUuid]);

    // Validation
    const isComplete = useCallback(() => {
        if (levelData.key !== authorityKey || !levelData.ready) return false;
        if (!fixedChoices || fixedChoices.key !== fixedChoiceKey || fixedChoices.error) return false;
        // 1. Talents
        for (const handler of TALENT_HANDLERS) {
            if (handler.isBlocked && handler.isBlocked({
                talents: rolledTalents,
                requiredTalents,
                targetLevel,
                actor: null,
                existingItems,
                statSelection,
                statPool,
                weaponMasterySelection,
                armorMasterySelection,
                spellAdvantageSelection,
                activeClassObj
            })) return false;
        }

        if (rolledTalents.length < requiredTalents) return false;

        // 2. Boons & Choices
        // Core requirement (Level 1 Warlock = 1) + Granted via Talent (e.g. Boon x2 = +2)
        // If we have choices available, we can use them for talents OR boons.
        // But granted boons MUST be used for boons.

        // Total Boons we SHOULD have = startingBoons + grantedBoons
        // Plus any we decided to spend "choices" on (if mechanics allowed, but usually choice is for Talent OR Boon)

        // Minimal check: Do we have enough boons to satisfy the fixed requirements?
        if (rolledBoons.length < totalRequiredBoons) return false;

        const extraTalents = Math.max(0, rolledTalents.length - requiredTalents);
        // We only count "extra" boons if they exceed what was strictly required + granted
        const extraBoons = Math.max(0, rolledBoons.length - totalRequiredBoons);

        if ((extraTalents + extraBoons) < choiceRolls) return false;

        // 3. Stats
        if (statGrants.some((grant, index) => !validStatAllocation(statChoiceRule(grant)!, statChoices[index]))) return false;

        // 4. Weapon Mastery
        if (needsMastery && !masteryData.ready) return false;
        if (weaponMasterySelection.required > 0 && (weaponMasterySelection.selected.length < weaponMasterySelection.required
            || weaponMasterySelection.selected.some(name => !masteryData.catalog?.weapon?.some(option => option.name === name)))) return false;

        // 5. Armor Mastery
        if (armorMasterySelection.required > 0 && (armorMasterySelection.selected.length < armorMasterySelection.required
            || armorMasterySelection.selected.some(name => !masteryData.catalog?.armor?.some(option => option.name === name)))) return false;

        if (spellAdvantageSelection.required > 0 && (!spellEffectData.ready
            || spellAdvantageSelection.selected.length !== spellAdvantageSelection.required
            || spellAdvantageSelection.selected.some(name => !spellEffectOptions.some(option => option.name === name)))) return false;

        // 6. Extra Spells
        if (extraSpellSelection.active) {
            if (!extraSpellData.ready || extraSpellSelection.selected.some(selected => !extraSpellsList.some(spell => spell.uuid === selected.uuid && !spell.isInnate && !spell.isKnown))) return false;
            if (extraSpellSelection.selected.length !== extraSpellGrants.length
                || !matchSpellGrants(extraSpellGrants, extraSpellSelection.selected, extraSpellContext)) return false;
        }

        // 7. Languages
        if (!skipLanguageSelection && targetLevel === 1 && (!languageData.ready || !languageData.plan || !validateLanguageSelections(languageData.plan, selectedLanguageGroups).valid)) return false;

        // 8. Spells
        if (isSpellcaster && spellsToChooseTotal > 0) {
            if (selectedSpells.length !== spellsToChooseTotal || !availableSpells?.length) return false;
            if (selectedSpells.some(selected => !availableSpells.some(spell => spell.uuid === selected.uuid && !spell.isInnate && !spell.isKnown))) return false;
            for (const [tier, count] of Object.entries(spellsToChoose)) {
                const selectedInTier = selectedSpells.filter(s => Number(s.tier || s.system?.tier || 0) === Number(tier)).length;
                if (selectedInTier !== count) return false;
            }
        }

        // 9. Pending Choices (from Instruction Items)
        if (pendingChoices) return false;

        // 10. HP & Gold (Block if not set)
        if (targetLevel > 0 && hpRoll === null) return false;
        if (targetLevel === 1 && goldRoll === null) return false;

        // 11. Duplicate Spell Check
        if (extraSpellSelection.active) {
            const hasOverlap = selectedSpells.some(s =>
                extraSpellSelection.selected.some(es => (es.uuid || es._id) === (s.uuid || s._id))
            );
            if (hasOverlap) return false;
        }

        return true;
    }, [
        rolledTalents, requiredTalents, targetLevel, existingItems, statSelection, statPool, weaponMasterySelection, armorMasterySelection, activeClassObj, fixedChoices, fixedChoiceKey, levelData, authorityKey,
        rolledBoons, choiceRolls,
        statGrants, statChoices, spellAdvantageSelection, spellEffectData.ready, spellEffectOptions,
        extraSpellSelection, extraSpellData.ready, extraSpellsList, extraSpellGrants, extraSpellContext, needsMastery, masteryData.ready, masteryData.catalog,
        languageGroups, availableLanguages, fixedLanguages, selectedLanguages, knownLanguages, languageData, selectedLanguageGroups, skipLanguageSelection,
        isSpellcaster, spellsToChooseTotal, availableSpells, selectedSpells, spellsToChoose,
        pendingChoices,
        hpRoll, goldRoll, totalRequiredBoons
    ]);

    // HP Formula & Max Sync
    useEffect(() => {
        if (!activeClassObj) return;
        const hitDieStr = String(activeClassObj.system?.hitPoints || "d6");
        
        // Extract die value (e.g. from "1d8", "d8", "8")
        // Robust extraction: get the last number after any 'd'
        const parts = hitDieStr.toLowerCase().split('d');
        const dieVal = parseInt(parts.pop() || "6") || 6;

        const baseDie = `1d${dieVal}`;
        const formula = baseDie;
        const max = dieVal; // Max is just the die face value

        setHpFormula(prev => prev === formula ? prev : formula);
        setHpMax(max);
    }, [activeClassObj]);

    const goldFormula = "2d6 x 5";
    const goldMax = 60;

    return {
        state: {
            targetLevel,
            statuses,
            error,
            isSubmitting,
            operation,
            activeClassObj,
            rolledTalents,
            rolledBoons,
            hpRoll,
            goldRoll,
            statSelection,
            statPool,
            statGrants,
            statChoices,
            weaponMasterySelection,
            armorMasterySelection,
            spellAdvantageSelection,
            spellEffectData,
            spellEffectOptions,
            extraSpellSelection,
            isComplete,
            hpFormula,
            hpMax,
            goldFormula,
            goldMax,
            fetchedPatron,
            selectedPatronUuid,
            availablePatrons,
            loadingPatrons: statuses.patron === 'LOADING',
            pendingChoices,
            selectedLanguages,
            fixedLanguages,
            knownLanguages,
            languageGroups,
            languageData,
            selectedLanguageGroups,
            boonTable,
            availableSpells,
            selectedSpells,
            spellsToChoose,
            spellsToChooseTotal,
            isSpellcaster,
            requiredTalents,
            needsBoon,
            startingBoons: totalRequiredBoons, // Use the total for UI display
            choiceRolls,
            extraSpellsList,
            extraSpellRequired: extraSpellGrants.length,
            extraSpellData,
            // Add missing properties that were previously there if needed by other components
            // activeClassObj is already there.
            loading: Object.values(statuses).some(s => s === 'LOADING'),
            loadingClass: statuses.class === 'LOADING',
            confirmReroll,
            targetClassUuid,
            talentTable
        },
        actions: {
            refreshOperation: () => fetchLevelUpData(targetClassUuid),
            handleRollHP,
            handleRollGold,
            handleRollTalent,
            handleStatToggle,
            changeStatChoice,
            setWeaponMasterySelection,
            setArmorMasterySelection,
            setSpellAdvantageSelection,
            setExtraSpellSelection,
            handleConfirm,
            handleChoiceSelection,
            setTargetClassUuid,
            setSelectedPatronUuid: handlePatronChange,
            setHpRoll,
            setGoldRoll,
            setConfirmReroll,
            setError,
            setRolledTalents,
            setRolledBoons,
            setSelectedSpells,
            handleRollBoon,
            handleRemoveTalent,
            handleRemoveBoon,
            setSelectedLanguageGroups,
            handleStatPoolChange,
            handleResetTalents,
            handleResetBoons,
            handleResolveNested,
            isComplete // Expose isComplete in actions as well for signature match
        }
    };
};
