// 'use client';

import React, { useState, useEffect } from 'react';
import { useSDK, useSDKComponents } from '@sheet-delver/sdk/react';
import { shadowdarkTheme } from './themes/shadowdark';
import { ItemRow } from './InventoryComponents';
import GemBagModal from './components/GemBagModal';
import CreateTreasureModal from './components/CreateTreasureModal';
import GearSelectionModal from './components/GearSelectionModal';
import { Gem, Plus } from 'lucide-react';

import { useShadowdarkActor } from './context/ShadowdarkActorContext';

export default function InventoryTab() {

    const { ConfirmationModal } = useSDKComponents();
    const {
        actor,
        updateActor,
        deleteItem,
        createItem,
        updateItem,
        getDraftValue
    } = useShadowdarkActor();
    const { addNotification } = useSDK();
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [isGemModalOpen, setIsGemModalOpen] = useState(false);
    const [isCreateTreasureModalOpen, setIsCreateTreasureModalOpen] = useState(false);
    const [isGearSelectionModalOpen, setIsGearSelectionModalOpen] = useState(false);

    const toggleItem = (id: string) => {
        const newSet = new Set(expandedItems);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setExpandedItems(newSet);
    };


    // Confirm Delete State
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    // Prepared inventory groups (ids) mapped to the raw items they describe.
    const byId = new Map((actor.items || []).map((item: any) => [String(item.id ?? item._id), item]));
    const viewOf = (id: string) => (actor.derived?.items ?? []).find((view: any) => view.id === id);
    const group = (ids: string[] = []) => ids.map(id => byId.get(id)).filter((item: any) => item && item.type !== 'Gem')
        .sort((a: any, b: any) => a.name.localeCompare(b.name));
    const equippedItems = group(actor.derived?.inventory?.equipped);
    const carriedItems = group(actor.derived?.inventory?.carried);
    const stashedItems = group(actor.derived?.inventory?.stashed);
    const isTreasure = (i: any) => viewOf(String(i.id))?.treasure === true;
    const displayEquipped = equippedItems.filter(i => !isTreasure(i));
    const displayCarried = carriedItems.filter(i => !isTreasure(i));
    const displayStashed = stashedItems;
    const treasureItems = [...equippedItems, ...carriedItems].filter(isTreasure);

    const slotBreakdown = actor.derived?.slotBreakdown || { gear: 0, treasure: 0, gems: 0, coins: 0 };
    const gearSlots = slotBreakdown.gear;
    const treasureSlots = slotBreakdown.treasure;
    const gemSlots = slotBreakdown.gems;
    const coinSlots = slotBreakdown.coins;
    const currentSlots = actor.derived?.slotsUsed ?? 0;
    const maxSlots = actor.derived?.maxSlots ?? 0;

    /**
     * Native sellAllItems order: remove the items, then credit their cost. Only
     * items actually removed are credited; a failed coin write is reported
     * with the exact amount so nothing is silently lost or duplicated.
     */
    const sellItems = async (items: any[]) => {
        const sold: any[] = [];
        for (const item of items) if (await deleteItem(String(item.id ?? item._id))) sold.push(item);
        if (!sold.length) return;
        const total = { gp: 0, sp: 0, cp: 0 };
        for (const item of sold) for (const unit of ['gp', 'sp', 'cp'] as const) total[unit] += Number(item.system?.cost?.[unit]) || 0;
        const coins = { ...(actor.system?.coins ?? {}) };
        for (const unit of ['gp', 'sp', 'cp'] as const) coins[unit] = (Number(coins[unit]) || 0) + total[unit];
        const credited = await updateActor('system.coins', coins, { immediate: true });
        const amount = (['gp', 'sp', 'cp'] as const).filter(unit => total[unit]).map(unit => `${total[unit]} ${unit}`).join(' ') || 'nothing';
        if (!credited) addNotification(`Sold ${sold.length} item(s) but could not add ${amount}; add the coins manually.`, 'error');
        else if (sold.length < items.length) addNotification(`Sold ${sold.length} of ${items.length} items for ${amount}; the rest were not removed.`, 'error');
        else addNotification(`Sold for ${amount}.`, 'success');
    };

    const handleSellTreasure = (item: any) => sellItems([item]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
            {/* MainInventory: Equipped, Carried, Stashed (Col 1 & 2) */}
            <div className="lg:col-span-2 space-y-6">

                {/* Equipped Gear Section */}

                {/* Equipped Gear Section */}
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="bg-black text-white p-2 font-bold font-serif uppercase tracking-widest text-sm mb-1">
                        Equipped Gear
                    </div>
                    <div className="hidden sm:grid grid-cols-12 text-xs font-bold uppercase tracking-widest text-neutral-500 border-b-2 border-black px-2 py-1">
                        <div className="col-span-6">Gear</div>
                        <div className="col-span-2 text-center">Qty</div>
                        <div className="col-span-2 text-center">Slots</div>
                        <div className="col-span-2 text-center">Actions</div>
                    </div>
                    <div className="divide-y divide-neutral-300">
                        {displayEquipped.map((item: any, idx: number) => (
                            <ItemRow key={item.id || item._id || `equipped-${idx}`} item={item} expandedItems={expandedItems} toggleItem={toggleItem} onDelete={(it) => setItemToDelete(String(it.id))} />
                        ))}
                        {(displayEquipped.length === 0) && (
                            <div className="text-center text-neutral-400 italic p-4 text-xs">Nothing equipped.</div>
                        )}
                    </div>
                </div>

                {/* Carried Gear Section (Not Equipped AND Not Stashed) */}
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="bg-black text-white p-2 font-bold font-serif uppercase tracking-widest text-sm mb-1 flex justify-between items-center">
                        <span>Carried Gear</span>
                        <button
                            type="button"
                            aria-label="Add gear"
                            onClick={() => setIsGearSelectionModalOpen(true)}
                            className="bg-white text-black text-[10px] px-2 py-0.5 rounded-sm flex items-center gap-1 hover:bg-neutral-200 transition-colors"
                        >
                            <Plus size={12} strokeWidth={4} />
                            Add
                        </button>
                    </div>
                    <div className="hidden sm:grid grid-cols-12 text-xs font-bold uppercase tracking-widest text-neutral-500 border-b-2 border-black px-2 py-1">
                        <div className="col-span-6">Item</div>
                        <div className="col-span-2 text-center">Qty</div>
                        <div className="col-span-2 text-center">Slots</div>
                        <div className="col-span-2 text-center">Actions</div>
                    </div>
                    <div className="divide-y divide-neutral-300">
                        {displayCarried.map((item: any, idx: number) => (
                            <ItemRow key={item.id || item._id || `carried-${idx}`} item={item} expandedItems={expandedItems} toggleItem={toggleItem} onDelete={(it) => setItemToDelete(String(it.id))} />
                        ))}
                        {(displayCarried.length === 0) && (
                            <div className="text-center text-neutral-400 italic p-4 text-xs">Nothing carried.</div>
                        )}
                    </div>
                </div>

                {/* Treasure Section */}
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="bg-black text-white p-2 font-bold font-serif uppercase tracking-widest text-sm mb-1 flex justify-between items-center">
                        <span>Treasure</span>
                        <button
                            type="button"
                            aria-label="Add treasure"
                            onClick={() => setIsCreateTreasureModalOpen(true)}
                            className="bg-white text-black text-[10px] px-2 py-0.5 rounded-sm flex items-center gap-1 hover:bg-neutral-200 transition-colors"
                        >
                            <Plus size={12} strokeWidth={4} />
                            Add
                        </button>
                    </div>
                    <div className="hidden sm:grid grid-cols-12 text-xs font-bold uppercase tracking-widest text-neutral-500 border-b-2 border-black px-2 py-1">
                        <div className="col-span-6">Item</div>
                        <div className="col-span-2 text-center">Value</div>
                        <div className="col-span-2 text-center">Slots</div>
                        <div className="col-span-2 text-center">Actions</div>
                    </div>
                    <div className="divide-y divide-neutral-300">
                        {treasureItems.map((item: any, idx: number) => (
                            <ItemRow key={item.id || item._id || `treasure-${idx}`} item={item} expandedItems={expandedItems} toggleItem={toggleItem} isTreasure={true} onSell={handleSellTreasure} onDelete={(it) => setItemToDelete(String(it.id))} />
                        ))}
                        {(treasureItems.length === 0) && (
                            <div className="text-center text-neutral-400 italic p-4 text-xs">No treasure found.</div>
                        )}
                    </div>
                </div>

                {/* Stashed Gear Section */}
                <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="bg-black text-white p-2 font-bold font-serif uppercase tracking-widest text-sm mb-1">
                        Stashed Gear
                    </div>
                    <div className="hidden sm:grid grid-cols-12 text-xs font-bold uppercase tracking-widest text-neutral-500 border-b-2 border-black px-2 py-1">
                        <div className="col-span-6">Item</div>
                        <div className="col-span-2 text-center">Qty</div>
                        <div className="col-span-2 text-center">Slots</div>
                        <div className="col-span-2 text-center">Actions</div>
                    </div>
                    <div className="divide-y divide-neutral-300">
                        {displayStashed.map((item: any, idx: number) => (
                            <ItemRow key={item.id || item._id || `stashed-${idx}`} item={item} expandedItems={expandedItems} toggleItem={toggleItem} onDelete={(it) => setItemToDelete(String(it.id))} />
                        ))}
                        {(displayStashed.length === 0) && (
                            <div className="text-center text-neutral-400 italic p-4 text-xs">Nothing stashed.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar with Updated Totals */}
            <div className="lg:col-start-3 row-start-1 lg:row-start-auto flex flex-col gap-6">

                {/* Slots Panel */}
                <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-serif font-bold text-lg border-b-2 border-black pb-1 mb-3 uppercase tracking-wide">Slots</h3>
                    <div className="flex justify-between items-baseline mb-3">
                        <span className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Total</span>
                        <span className={`text-3xl font-serif font-black ${currentSlots > maxSlots ? 'text-red-600' : 'text-black'}`}>
                            {currentSlots} / {maxSlots}
                        </span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                            <span className="text-neutral-500">Gear</span>
                            <span>{gearSlots}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                            <span className="text-neutral-500">Treasure</span>
                            <span>{treasureSlots}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                            <span className="text-neutral-500">Gems</span>
                            <span>{gemSlots}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-bold uppercase tracking-wider">
                            <span className="text-neutral-500">Coins</span>
                            <span>{coinSlots}</span>
                        </div>
                    </div>
                </div>

                {/* Coins Panel */}
                <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-serif font-bold text-lg border-b-2 border-black pb-1 mb-3 uppercase tracking-wide flex justify-between items-center">
                        Coins
                        <span className="text-[10px] text-neutral-600 font-sans tracking-tight">100 coins = 1 slot (after first 100)</span>
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="font-bold text-amber-600 font-serif">GP</label>
                            <input
                                type="number"
                                id="shadowdark-coins-gp" aria-label="GP" value={getDraftValue('system.coins.gp', actor.system?.coins?.gp || 0)}
                                onChange={(e) => updateActor('system.coins.gp', parseInt(e.target.value) || 0)}
                                className="w-20 text-right bg-neutral-100 border-b border-neutral-300 focus:border-black outline-none font-serif text-lg p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="font-bold text-neutral-500 font-serif">SP</label>
                            <input
                                type="number"
                                id="shadowdark-coins-sp" aria-label="SP" value={getDraftValue('system.coins.sp', actor.system?.coins?.sp || 0)}
                                onChange={(e) => updateActor('system.coins.sp', parseInt(e.target.value) || 0)}
                                className="w-20 text-right bg-neutral-100 border-b border-neutral-300 focus:border-black outline-none font-serif text-lg p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            <label className="font-bold text-orange-700 font-serif">CP</label>
                            <input
                                type="number"
                                id="shadowdark-coins-cp" aria-label="CP" value={getDraftValue('system.coins.cp', actor.system?.coins?.cp || 0)}
                                onChange={(e) => updateActor('system.coins.cp', parseInt(e.target.value) || 0)}
                                className="w-20 text-right bg-neutral-100 border-b border-neutral-300 focus:border-black outline-none font-serif text-lg p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Gems Panel */}
                <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-serif font-bold text-lg border-b-2 border-black pb-1 mb-3 uppercase tracking-wide">Gems</h3>
                    <div className="flex justify-between items-baseline mb-3">
                        <span className="text-sm font-bold text-neutral-500 uppercase tracking-widest">Total</span>
                        <span className="text-3xl font-serif font-black">
                            {(actor.items || []).filter((i: any) => i.type === 'Gem').length}
                        </span>
                    </div>
                    <button
                        onClick={() => setIsGemModalOpen(true)}
                        className="w-full py-2 bg-black text-white font-serif font-bold uppercase tracking-widest text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center justify-center gap-2"
                    >
                        <Gem size={14} />
                        Gem Bag
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!itemToDelete}
                title="Delete Item"
                message="Are you sure you want to delete this item? This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={() => {
                    if (itemToDelete) deleteItem(itemToDelete);
                    setItemToDelete(null);
                }}
                onCancel={() => setItemToDelete(null)}
                theme={shadowdarkTheme.modal}
            />

            {/* Gem Bag Modal */}
            <GemBagModal
                isOpen={isGemModalOpen}
                onClose={() => setIsGemModalOpen(false)}
                actor={actor}
                onCreateItem={createItem}
                onUpdateItem={updateItem}
                onSell={sellItems}
                onDeleteItem={(id: string) => setItemToDelete(id)}
            />

            {/* Create Treasure Modal */}
            <CreateTreasureModal
                isOpen={isCreateTreasureModalOpen}
                onClose={() => setIsCreateTreasureModalOpen(false)}
                onCreate={(data) => createItem(data)}
            />

            {/* Gear Selection Modal */}
            <GearSelectionModal
                isOpen={isGearSelectionModalOpen}
                onClose={() => setIsGearSelectionModalOpen(false)}
                onCreate={createItem}
            />
        </div>
    );
}


