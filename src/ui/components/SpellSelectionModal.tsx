
import { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { presentDescription } from '../../logic/description';
import { canonicalUuid } from '../../logic/identity';
import { useSDK } from '@sheet-delver/sdk/react';
import { logger } from '@sheet-delver/sdk';
import { useShadowdarkCollections } from '../context/ShadowdarkUIContext';
import { CollectionStatus } from './CollectionStatus';

interface SpellOption {
    name: string;
    uuid: string;
    img?: string;
    tier: number;
    class?: string[];
    description?: string;
    system?: any; // To support getSafeDescription
}

interface SpellSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (selected: SpellOption[]) => void;
    title: string;
    tier?: number;
    /** Exact Class UUID whose spell list is offered. */
    classUuid?: string;
    /** Owned spells: source UUID (for matching) and whether they are innate. */
    knownSpells: SpellOption[];
    maxSelections?: number;
    isSaving?: boolean;
    actor?: any;
}

export default function SpellSelectionModal({
    isOpen,
    onClose,
    onSave,
    title,
    tier,
    classUuid,
    knownSpells,
    maxSelections,
    isSaving = false,
    actor
}: SpellSelectionModalProps) {
    const { resolveImageUrl } = useSDK();
    const data = useShadowdarkCollections(['spells'], isOpen);
    const { collections } = data;
    const [search, setSearch] = useState('');
    const [selectedUuids, setSelectedUuids] = useState<Set<string>>(new Set());
    const [expandedUuids, setExpandedUuids] = useState<Set<string>>(new Set());
    const [fetchedData, setFetchedData] = useState<Record<string, { description: string, system: any }>>({});
    const [loadingUuids, setLoadingUuids] = useState<Set<string>>(new Set());

    // Tracks if we have already initialized for the current "open" session
    const [hasInitialized, setHasInitialized] = useState(false);
    const [initialKnownUuids, setInitialKnownUuids] = useState<Set<string>>(new Set());

    // Spells whose system.class contains this exact class UUID (fetch-pack rows keep
    // canonical references); no class-name substring or terminal-ID matching.
    const availableSpells = useMemo(() => {
        const fullSpells = data.ready ? collections.spells : [];
        const target = canonicalUuid(classUuid);
        if (!tier || !target) return [];
        const innate = new Set(knownSpells.filter(spell => (spell as any).isInnate).map(spell => spell.uuid));
        return fullSpells.filter((s: any) => Number(s.system?.tier ?? s.tier) === tier
            && (Array.isArray(s.system?.class) ? s.system.class : []).some((value: unknown) => canonicalUuid(value) === target))
            .map((s: any) => ({
                name: s.name, uuid: canonicalUuid(s.uuid) ?? s.uuid, tier, img: s.img,
                description: s.system?.description, system: s.system, isInnate: innate.has(canonicalUuid(s.uuid) ?? ''),
            }));
    }, [data.ready, collections, tier, classUuid, knownSpells]);

    const toggleExpand = (spell: SpellOption) => {
        if (isSaving) return;
        const newSet = new Set(expandedUuids);
        if (newSet.has(spell.uuid)) {
            newSet.delete(spell.uuid);
        } else {
            newSet.add(spell.uuid);
        }
        setExpandedUuids(newSet);
    };

    // Initialize selection from known spells ONLY when the modal opens
    useEffect(() => {
        if (isOpen && data.ready && !hasInitialized) {
            const initialSet = new Set<string>();
            // Owned spells match by their recorded source identity only.
            const knownSources = new Set(knownSpells.map(s => s.uuid).filter(Boolean));
            availableSpells.forEach((s: any) => {
                if (knownSources.has(s.uuid)) initialSet.add(s.uuid);
            });
            setSelectedUuids(initialSet);
            setInitialKnownUuids(new Set(initialSet));
            setHasInitialized(true);
        } else if (!isOpen) {
            setHasInitialized(false);
            setSearch('');
        }
    }, [isOpen, knownSpells, availableSpells, hasInitialized, data.ready]);

    const filteredSpells = useMemo(() => {
        let result = availableSpells;
        if (search) {
            const lower = search.toLowerCase();
            result = availableSpells.filter(s =>
                s.name.toLowerCase().includes(lower)
            );
        }
        return result.sort((a, b) => {
            if (a.tier !== b.tier) return a.tier - b.tier;
            return a.name.localeCompare(b.name);
        });
    }, [availableSpells, search]);

    const toggleSpell = (uuid: string) => {
        if (isSaving) return;
        const newSet = new Set(selectedUuids);
        if (newSet.has(uuid)) {
            newSet.delete(uuid);
        } else {
            if (maxSelections && selectableCount >= maxSelections) return;
            newSet.add(uuid);
        }
        setSelectedUuids(newSet);
    };

    const innateUuids = useMemo(() => {
        const set = new Set<string>();
        availableSpells.forEach(s => {
            if ((s as any).isInnate) set.add(s.uuid);
        });
        return set;
    }, [availableSpells]);

    const selectableCount = useMemo(() => {
        let count = 0;
        selectedUuids.forEach(uuid => {
            if (!innateUuids.has(uuid)) count++;
        });
        return count;
    }, [selectedUuids, innateUuids]);

    const isMaxReached = maxSelections ? selectableCount >= maxSelections : false;

    const handleSave = () => {
        if (!data.ready || isSaving) return;
        const selected = availableSpells.filter(s => selectedUuids.has(s.uuid));
        onSave(selected);
        // We do NOT call onClose() here anymore; SpellsTab.tsx will call it after the async save completes.
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div
                className="bg-neutral-100 w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col border-4 border-black"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-black text-white p-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-serif font-bold tracking-wider uppercase">{title}</h2>
                        <div className="text-xs font-sans tracking-widest uppercase mt-1 text-neutral-400">
                            Selected: <span className={selectableCount > (maxSelections || 99) ? "text-red-500 font-bold" : "text-amber-500 font-bold"}>{selectableCount}</span>
                            {maxSelections !== undefined && (
                                <> / <span className="text-white">{maxSelections}</span></>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="p-2 hover:bg-neutral-800 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Filter spells by name..."
                            disabled={isSaving}
                            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:translate-x-[2px] focus:translate-y-[2px] focus:shadow-none transition-all outline-none font-serif text-xl disabled:opacity-50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Table Header */}
                    <div className="border-b-2 border-black pb-2 px-2 flex items-end justify-between font-serif font-bold uppercase tracking-widest text-neutral-500 text-[10px]">
                        <div className="flex-1 pl-12 flex items-center justify-between">
                            <span className="font-bold">Spell Name</span>
                            {expandedUuids.size > 0 && (
                                <button
                                    onClick={() => setExpandedUuids(new Set())}
                                    disabled={isSaving}
                                    className="mr-4 text-amber-600 hover:text-amber-700 underline flex items-center gap-1 transition-colors disabled:opacity-30"
                                >
                                    <ChevronUp className="w-3 h-3" />
                                    Collapse All
                                </button>
                            )}
                        </div>
                        <span className="w-12 text-center">Select</span>
                    </div>

                    {/* Spell List */}
                    <div className="flex-1 overflow-y-auto space-y-0 pr-2 custom-scrollbar border-t-2 border-black">
                        <CollectionStatus state={data} label="Loading spells…" />
                        {filteredSpells.map((spell, idx) => {
                            const isSelected = selectedUuids.has(spell.uuid);
                            const isExpanded = expandedUuids.has(spell.uuid);
                            const fetched = fetchedData[spell.uuid];
                            const description = spell.description || fetched?.description;
                            const isLoading = loadingUuids.has(spell.uuid);

                            const isInnate = innateUuids.has(spell.uuid);
                            const isPreExisting = initialKnownUuids.has(spell.uuid);

                            // Only lock innate spells; pre-existing known spells can be swapped
                            const isLocked = isInnate;

                            const disabled = (!isSelected && isMaxReached) || isSaving || isLocked;

                            return (
                                <div key={(spell as any).uuid || (spell as any)._id || `spell-select-${idx}`} className={`border-b border-black/20 last:border-b-0 transition-all ${isSelected ? 'bg-amber-50/50' : 'bg-white hover:bg-neutral-50'} ${isSaving ? 'opacity-70 pointer-events-none' : ''} ${isLocked ? 'opacity-60' : ''}`}>
                                    <div
                                        className={`flex items-center gap-3 py-1.5 px-2 cursor-pointer transition-colors`}
                                        onClick={() => toggleExpand(spell)}
                                    >
                                        {/* Image */}
                                        <div className="w-10 h-10 border border-black bg-black flex-shrink-0 flex items-center justify-center overflow-hidden">
                                            {spell.img ? (
                                                <img src={resolveImageUrl(spell.img)} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-white font-serif font-bold text-lg">{spell.name.charAt(0)}</span>
                                            )}
                                        </div>

                                        {/* Name */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-serif font-bold text-base uppercase leading-tight truncate flex items-center gap-2">
                                                <span className={isLocked ? 'text-neutral-500' : 'text-black'}>
                                                    {spell.name}
                                                    {(isInnate || (isPreExisting && !isInnate)) && <span className="ml-2 text-[10px] text-neutral-400 font-sans normal-case tracking-tight">(Known)</span>}
                                                </span>
                                                {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                                            </div>
                                        </div>

                                        {/* Select Button */}
                                        <div className="w-12 flex justify-center">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSpell(spell.uuid);
                                                }}
                                                disabled={disabled}
                                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                                                    ? 'bg-black text-white border-black'
                                                    : disabled
                                                        ? 'bg-neutral-50 border-neutral-300 cursor-not-allowed'
                                                        : 'bg-white border-black hover:border-amber-500'
                                                    }`}
                                            >
                                                {isSelected && <Check className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Expanded Info */}
                                    {isExpanded && (
                                        <div className="p-4 pt-2 border-t border-dashed border-neutral-200 bg-neutral-50">
                                            <div className="space-y-4">
                                                {/* Metadata row inside expanded info */}
                                                <div className="flex flex-wrap gap-6 py-2 border-b border-neutral-200">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest">Duration</span>
                                                        <span className="font-serif text-black uppercase">
                                                            {(() => {
                                                                const system = spell.system || {};
                                                                const val = system.duration?.value;
                                                                const type = system.duration?.type || '-';
                                                                if (val === undefined || val === null || val === '' || val === -1) return type.charAt(0).toUpperCase() + type.slice(1);
                                                                return `${val} ${type.charAt(0).toUpperCase() + type.slice(1)}${val !== 1 ? 's' : ''}`;
                                                            })()}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-widest">Range</span>
                                                        <span className="font-serif text-black uppercase">{spell.system?.range || 'Close'}</span>
                                                    </div>
                                                </div>

                                                <div className="text-sm font-serif leading-relaxed text-neutral-800 prose prose-sm max-w-none">
                                                    {description ? (
                                                        <div dangerouslySetInnerHTML={{ __html: presentDescription(description) }} />
                                                    ) : (
                                                        <span className="italic text-neutral-400">No description available.</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {data.ready && filteredSpells.length === 0 && (
                            <div className="text-center py-20 text-neutral-400 italic border-2 border-dashed border-neutral-200 rounded-lg">
                                No spells found matching your filter.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-neutral-200 border-t-2 border-black flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-8 py-3 border-2 border-black font-serif font-bold text-lg hover:bg-neutral-300 transition-all active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        CANCEL
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !data.ready}
                        className="px-10 py-3 bg-black text-white border-2 border-black font-serif font-bold text-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Check className="w-5 h-5" />
                        )}
                        {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                    </button>
                </div>
            </div>
        </div>
    );
}
