import { logger } from '@sheet-delver/sdk';
import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Search, ChevronDown, ChevronRight, Shield, Backpack, Swords, Sparkles, Sprout, Briefcase, Plus, Flame, Sun, Target } from 'lucide-react';
import { useSDK } from '@sheet-delver/sdk/react';
import { useShadowdarkUI, useShadowdarkCollections } from '../context/ShadowdarkUIContext';
import { CollectionStatus } from './CollectionStatus';
import { presentDescription } from '../../logic/description';

interface GearSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (itemData: any) => Promise<void>;
}

type GearCategory = 'Armor' | 'Basic Gear' | 'Herbal Remedies' | 'Starting Gear' | 'Weapons' | 'Magic Items';

// Properties are resolved dynamically via useShadowdarkUI().resolveName and the 'properties' shard.

const FOLDER_IDS: Record<string, GearCategory> = {
    'np4FRJ73NRBEQKnS': 'Armor',
    '0ws7y8D3IktigkiB': 'Basic Gear',
    'LVzvIhYHieRT4O6q': 'Weapons',
    'iHOSxtXRWKd2vx1U': 'Herbal Remedies',
    'aDuF91SrY1z6oZoL': 'Starting Gear'
};

export default function GearSelectionModal({ isOpen, onClose, onCreate }: GearSelectionModalProps) {
    const { resolveImageUrl } = useSDK();
    const { resolveName } = useShadowdarkUI();
    const data = useShadowdarkCollections(['gear', 'magic-items', 'properties'], isOpen);
    const { collections } = data;
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<GearCategory>>(new Set(['Basic Gear']));
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        if (!isOpen || !dialogRef.current) return;
        const dialog = dialogRef.current;
        const previousFocus = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = 'hidden';
        return () => {
            dialog.close();
            document.body.style.overflow = previousOverflow;
            if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        };
    }, [isOpen]);

    // Combine and apply existing filtering logic to the cached collections
    const items = useMemo(() => {
        const gearItems = collections['gear'] || [];
        const magicItems = collections['magic-items'] || [];
        const allDocs = [...gearItems, ...magicItems];
        if (allDocs.length === 0) return [];

        return allDocs.filter((d: any) => {
            if (d._key && d._key.startsWith('!folders!')) return false;

            const validTypes = ['Basic', 'Weapon', 'Armor', 'Potion', 'Scroll', 'Wand', 'Gem', 'item', 'Item'];
            const dType = d.type || "";
            const typeMatch = validTypes.some(t => t.toLowerCase() === dType.toLowerCase());

            return typeMatch;
        });
    }, [collections]);

    const toggleCategory = (category: GearCategory) => {
        const newSet = new Set(expandedCategories);
        if (newSet.has(category)) {
            newSet.delete(category);
        } else {
            newSet.add(category);
        }
        setExpandedCategories(newSet);
    };

    const categorizedItems = useMemo(() => {
        const categories: Record<GearCategory, any[]> = {
            'Basic Gear': [],
            'Armor': [],
            'Weapons': [],
            'Herbal Remedies': [],
            'Starting Gear': [],
            'Magic Items': []
        };

        items.forEach(item => {
            // Search Filter
            if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
                return;
            }

            // Category Logic
            let category: GearCategory | null = null;

            if (item.pack?.includes('magic-items') || item.system?.magicItem === true) {
                category = 'Magic Items';
            } else if (item.folder && FOLDER_IDS[item.folder]) {
                category = FOLDER_IDS[item.folder];
            } else if (item.type === 'Armor') {
                category = 'Armor';
            } else if (item.type === 'Weapon') {
                category = 'Weapons';
            } else if (item.pack?.includes('gear') || item.pack?.includes('items')) {
                // Broad fallback for standard items
                category = 'Basic Gear';
            }

            if (category) {
                categories[category].push(item);
            }
        });

        // Sort items within categories
        Object.keys(categories).forEach(key => {
            categories[key as GearCategory].sort((a: any, b: any) => a.name.localeCompare(b.name));
        });

        return categories;
    }, [items, searchTerm]);

    if (!isOpen) return null;

    const CategoryIcon = ({ category }: { category: GearCategory }) => {
        switch (category) {
            case 'Armor': return <Shield size={18} className="text-neutral-400" />;
            case 'Basic Gear': return <Backpack size={18} className="text-neutral-400" />;
            case 'Herbal Remedies': return <Sprout size={18} className="text-neutral-400" />;
            case 'Starting Gear': return <Briefcase size={18} className="text-neutral-400" />;
            case 'Weapons': return <Swords size={18} className="text-neutral-400" />;
            case 'Magic Items': return <Sparkles size={18} className="text-neutral-400" />;
        }
    };

    const handleAdd = async (item: any) => {
        if (!data.ready) return;
        // Clone item data to create a new instance
        const newItemData = {
            name: item.name,
            type: item.type,
            img: item.img,
            system: JSON.parse(JSON.stringify(item.system || {}))
        };

        // Reset specific fields for a new distinct item
        // newItemData.system.equipped = false; // Usually false by default
        // newItemData.system.stashed = false;

        await onCreate(newItemData);
        // Optional: show toast or feedback
    };

    return (
        <dialog ref={dialogRef} aria-labelledby="shadowdark-gear-title"
            className="m-auto w-[calc(100%-1rem)] max-w-4xl max-h-[calc(100dvh-1rem)] border-0 p-0 bg-transparent text-black backdrop:bg-black/60 backdrop:backdrop-blur-sm"
            onCancel={event => { event.preventDefault(); onClose(); }}
            onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="bg-neutral-100 w-full h-[min(85dvh,calc(100dvh-1rem))] flex flex-col border-2 border-black overflow-hidden">

                {/* Header */}
                <div className="bg-black text-white p-4 flex justify-between items-center shrink-0">
                    <h2 id="shadowdark-gear-title" className="font-serif font-bold text-lg sm:text-xl uppercase tracking-wide flex items-center gap-2">
                        <Backpack size={24} />
                        Gear Selection
                    </h2>
                    <button type="button" aria-label="Close gear selection" onClick={onClose} className="shrink-0 min-h-11 min-w-11 flex items-center justify-center hover:text-red-400 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Sub-header / Search */}
                <div className="p-4 border-b-2 border-neutral-300 bg-white shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search gear..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-neutral-300 bg-neutral-50 rounded-sm focus:border-black focus:ring-1 focus:ring-black outline-none font-serif"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-4 space-y-4">
                    <CollectionStatus state={data} label="Loading gear…" />
                    {data.ready && items.length === 0 && <p>No gear is available in the readable collections.</p>}
                    {data.ready && (
                        (Object.keys(categorizedItems) as GearCategory[]).map(category => {
                            const itemsInCategory = categorizedItems[category];
                            if (itemsInCategory.length === 0) return null;

                            const isExpanded = expandedCategories.has(category);

                            return (
                                <div key={category} className="bg-white border-2 border-neutral-200">
                                    <button
                                        onClick={() => toggleCategory(category)}
                                        className="w-full flex items-center justify-between p-3 bg-neutral-100 hover:bg-neutral-200 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                            <CategoryIcon category={category} />
                                            <span className="font-serif font-bold uppercase tracking-wide text-sm">{category}</span>
                                            <span className="bg-neutral-300 text-neutral-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                                {itemsInCategory.length}
                                            </span>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="divide-y divide-neutral-100">
                                            {/* Column Headers */}
                                            <div className="hidden lg:grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400 px-4 py-2 border-b border-neutral-100">
                                                <div className="col-span-4 pl-12">Name</div>
                                                <div className="col-span-2 text-center">Cost</div>
                                                <div className="col-span-1 text-center">Slots</div>
                                                <div className="col-span-1 text-center">Type</div>
                                                <div className="col-span-3 text-center">Properties</div>
                                                <div className="col-span-1 text-center">Add</div>
                                            </div>

                                            {itemsInCategory.map((item: any) => {
                                                const isWeapon = item.type === 'Weapon';
                                                const isArmor = item.type === 'Armor';
                                                const properties = [];

                                                if (isArmor && item.system?.ac?.base) {
                                                    let acLabel = `AC ${item.system.ac.base}`;
                                                    if (item.system.ac.modifier) acLabel += ` +${item.system.ac.modifier}`;
                                                    properties.push({ label: acLabel, color: 'bg-zinc-200 text-zinc-700' });
                                                }

                                                if (isWeapon) {
                                                    if (item.system?.type) {
                                                        properties.push({ label: item.system.type, color: 'bg-zinc-200 text-zinc-700' }); // Melee/Ranged
                                                    }
                                                    if (item.system?.range) {
                                                        properties.push({ label: item.system.range, color: 'bg-blue-100 text-blue-700' }); // Close/Near etc
                                                    }
                                                }

                                                if (item.system?.properties && Array.isArray(item.system.properties)) {
                                                    item.system.properties.forEach((propId: string) => {
                                                        const propName = resolveName(propId, 'properties');
                                                        if (propName) {
                                                            properties.push({ label: propName, color: 'bg-slate-700 text-white' });
                                                        }
                                                    });
                                                }

                                                return (
                                                    <div key={item._id} className="grid grid-cols-[minmax(0,1fr)_2.75rem] lg:grid-cols-12 gap-3 lg:gap-2 p-3 items-stretch hover:bg-neutral-50 group">

                                                        {/* Name & Description Column */}
                                                        <div className="col-start-1 row-start-1 lg:col-start-auto lg:row-start-auto lg:col-span-4 min-w-0 flex gap-3 items-start relative">
                                                            <div className="w-12 h-12 border border-neutral-300 bg-neutral-100 shrink-0">
                                                                <img src={resolveImageUrl(item.img)} alt={item.name} className="w-full h-full object-cover" />
                                                            </div>
                                                            <div className="min-w-0 flex flex-col justify-center h-full gap-1">
                                                                <div className="font-bold font-serif text-lg leading-tight break-words">{item.name}</div>
                                                                {/* Description */}
                                                                <div
                                                                    className="text-sm lg:text-xs text-neutral-600 leading-relaxed break-words"
                                                                    dangerouslySetInnerHTML={{ __html: presentDescription(item.system?.description) }}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="col-start-1 row-start-2 flex flex-wrap items-center gap-x-4 gap-y-2 lg:contents">
                                                        {/* Cost Column */}
                                                        <div className="lg:col-span-2 flex flex-wrap gap-1 items-center lg:justify-center font-mono text-sm text-neutral-600">
                                                            <span className="lg:hidden font-semibold">Cost:</span>
                                                            {item.system?.cost?.gp > 0 && <span>{item.system.cost.gp} gp</span>}
                                                            {item.system?.cost?.sp > 0 && <span>{item.system.cost.sp} sp</span>}
                                                            {item.system?.cost?.cp > 0 && <span>{item.system.cost.cp} cp</span>}
                                                            {(!item.system?.cost?.gp && !item.system?.cost?.sp && !item.system?.cost?.cp) && <span>-</span>}
                                                        </div>

                                                        {/* Slots Column */}
                                                        <div className="lg:col-span-1 flex items-center lg:justify-center gap-1">
                                                            <span className="lg:hidden text-sm text-neutral-600 font-semibold">Slots:</span>
                                                            <span className="font-bold bg-neutral-200 text-neutral-700 rounded px-2 py-0.5 text-xs">
                                                                {item.system?.slots?.slots_used || 0}
                                                            </span>
                                                        </div>

                                                        {/* Type Icons Column */}
                                                        <div className="lg:col-span-1 flex flex-wrap items-center lg:justify-center gap-1.5">
                                                            {item.system?.isAmmunition && <span title="Ammunition" className="text-orange-500"><Target size={20} /></span>}
                                                            {item.system?.light?.isSource && <span title="Light Source" className="text-yellow-600"><Flame size={20} /></span>}
                                                            {item.system?.magicItem && <span title="Magic Item" className="text-purple-600"><Sparkles size={20} /></span>}
                                                            {item.system?.treasure && <span title="Treasure" className="text-amber-500"><Sun size={20} /></span>}
                                                        </div>
                                                        </div>

                                                        {/* Properties Column */}
                                                        <div className="col-start-1 row-start-3 lg:col-start-auto lg:row-start-auto lg:col-span-3 min-w-0 flex flex-wrap gap-1 content-center">
                                                            {properties.map((prop, idx) => (
                                                                <span key={idx} className={`text-xs uppercase font-bold px-1.5 py-0.5 rounded-sm break-words ${prop.color}`}>
                                                                    {prop.label}
                                                                </span>
                                                            ))}
                                                        </div>

                                                        {/* Add Button Column */}
                                                        <div className="col-start-2 row-start-1 row-span-3 lg:col-start-auto lg:row-start-auto lg:row-span-1 lg:col-span-1 flex items-start lg:items-stretch">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAdd(item)}
                                                                aria-label={`Add ${item.name} to inventory`}
                                                                className="w-full min-h-11 bg-black text-white hover:bg-neutral-800 transition-colors rounded-sm flex items-center justify-center"
                                                                title="Add to Inventory"
                                                            >
                                                                <Plus size={20} strokeWidth={3} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Key - Color Coded */}
                <div className="shrink-0 p-3 border-t border-neutral-300 bg-neutral-50 text-xs flex flex-wrap gap-x-4 gap-y-2 justify-center">
                    <span className="flex items-center gap-1.5 text-orange-500 font-bold"><Target size={16} /> Ammunition</span>
                    <span className="flex items-center gap-1.5 text-yellow-600 font-bold"><Flame size={16} /> Light Source</span>
                    <span className="flex items-center gap-1.5 text-purple-600 font-bold"><Sparkles size={16} /> Magic Item</span>
                    <span className="flex items-center gap-1.5 text-amber-500 font-bold"><Sun size={16} /> Treasure</span>
                </div>
            </div>
        </dialog>
    );
}
