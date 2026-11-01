import React, { useState } from 'react';
import { X, Plus, Trash2, Pencil, Check, Coins } from 'lucide-react';

interface GemItem {
    id: string;
    name: string;
    system: {
        cost: {
            gp: number;
            sp: number;
            cp: number;
        };
        quantity: number;
    };
    img?: string;
}

interface GemBagModalProps {
    isOpen: boolean;
    onClose: () => void;
    actor: any;
    onCreateItem?: (data: any) => Promise<unknown>;
    onUpdateItem?: (itemId: string, patch: Record<string, unknown>) => Promise<unknown>;
    /** Sells gems through the inventory's single sale routine. */
    onSell?: (items: any[]) => Promise<unknown>;
    onDeleteItem?: (itemId: string) => unknown;
}

export default function GemBagModal({
    isOpen,
    onClose,
    actor,
    onCreateItem,
    onUpdateItem,
    onSell,
    onDeleteItem
}: GemBagModalProps) {
    const [valueError,setValueError]=useState('');
    const [editingGem, setEditingGem] = useState<GemItem | null>(null);
    const [newName, setNewName] = useState('');
    const [newGp, setNewGp] = useState(0);
    const [isAdding, setIsAdding] = useState(false);

    const gems = (actor.items || []).filter((i: any) => i.type === 'Gem')
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

    const totalValue = gems.reduce((acc: number, gem: any) => {
        const cost = gem.system?.cost || {};
        return acc + (Number(cost.gp) || 0) + (Number(cost.sp) || 0) / 10 + (Number(cost.cp) || 0) / 100;
    }, 0);

    const handleAdd = async () => {
        if (!newName.trim()||valueError) return;
        if (onCreateItem) {
            await onCreateItem({
                name: newName,
                type: 'Gem',
                img: 'icons/commodities/gems/gem-rough-ball-red.webp',
                system: {
                    cost: {
                        gp: Number(newGp),
                        sp: 0,
                        cp: 0
                    },
                    quantity: 1
                }
            });
            setNewName('');
            setNewGp(0);
            setIsAdding(false);
        }
    };

    const handleUpdate = async () => {
        if (!editingGem||!newName.trim()||valueError) return;
        if (onUpdateItem) {
            await onUpdateItem(editingGem.id, { name: newName, 'system.cost.gp': Number(newGp) });
            setEditingGem(null);
            setNewName('');
            setNewGp(0);
        }
    };

    const handleSell = async (gem: any) => { await onSell?.([gem]); };

    const handleSellAll = async () => {
        if (gems.length === 0) return;
        await onSell?.(gems);
    };

    const startEdit = (gem: any) => {
        setValueError('');setEditingGem(gem);
        setNewName(gem.name);
        setNewGp(gem.system?.cost?.gp || 0);
        setIsAdding(false);
    };

    const cancelEdit = () => {
        setValueError('');
        setEditingGem(null);
        setNewName('');
        setNewGp(0);
        setIsAdding(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={onClose}>
            <div className="bg-neutral-100 border-4 border-black w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-black p-4 flex justify-between items-center text-white">
                    <h2 className="text-2xl font-serif font-bold tracking-wider uppercase">Gem Bag</h2>
                    <button onClick={onClose} className="p-1 hover:bg-neutral-800 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Add Gem Section */}
                    {!isAdding && !editingGem && (
                        <button
                            onClick={() => setIsAdding(true)}
                            className="w-full py-2 border-2 border-dashed border-neutral-400 text-neutral-500 hover:border-black hover:text-black font-serif font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                        >
                            <Plus size={18} />
                            Add New Gem
                        </button>
                    )}

                    {(isAdding || editingGem) && (
                        <div className="bg-white border-2 border-black p-4 space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-serif font-bold uppercase tracking-widest text-sm border-b border-neutral-200 pb-2">
                                {isAdding ? 'Add New Gem' : 'Edit Gem'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">Gem Name</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        maxLength={200}
                                        onChange={(e) => setNewName(e.target.value)}
                                        className="w-full bg-neutral-50 border-2 border-black p-2 font-serif focus:bg-white outline-none"
                                        placeholder="e.g. Ruby"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">Value (GP)</label>
                                    <input
                                        type="text" inputMode="numeric" pattern="[0-9]*"
                                        value={newGp}
                                        onChange={()=>{}} onInput={(e) => {const raw=e.currentTarget.value,n=Number(raw);if(!/^\d*$/.test(raw)||!Number.isSafeInteger(n)||n<0||n>1000000){setValueError('Enter a whole number from 0 to 1000000.');return;}setValueError('');setNewGp(n);}}
                                        className="w-full bg-neutral-50 border-2 border-black p-2 font-serif focus:bg-white outline-none"
                                    />
                                    {valueError&&<p role="alert" className="text-red-700 text-sm">{valueError}</p>}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={cancelEdit}
                                    className="px-4 py-1 text-xs font-bold uppercase border-2 border-neutral-300 hover:border-black transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={isAdding ? handleAdd : handleUpdate}
                                    className="px-4 py-1 text-xs font-bold uppercase bg-black text-white border-2 border-black hover:bg-neutral-800 transition-colors flex items-center gap-1"
                                >
                                    <Check size={14} />
                                    {isAdding ? 'Add Gem' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Gem Table */}
                    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <div className="grid grid-cols-[1fr_80px_130px] border-b-2 border-black bg-neutral-100 text-[10px] font-bold uppercase tracking-widest p-2">
                            <div>Gem</div>
                            <div className="text-right">Value (GP)</div>
                            <div className="text-right">Actions</div>
                        </div>
                        <div className="divide-y divide-neutral-200">
                            {gems.map((gem: any, idx: number) => (
                                <div key={gem.id || gem._id || `gem-${idx}`} className="grid grid-cols-[1fr_80px_130px] items-center p-2 hover:bg-neutral-50 transition-colors">
                                    <div className="font-serif text-sm font-bold truncate pr-2">{gem.name}</div>
                                    <div className="text-right font-mono text-sm">{gem.system?.cost?.gp || 0}</div>
                                    <div className="flex justify-end gap-1">
                                        {onSell&&<button
                                            onClick={() => handleSell(gem)}
                                            className="p-1.5 text-amber-600 hover:text-amber-800 transition-colors"
                                            title="Sell Gem"
                                        >
                                            <Coins size={14} />
                                        </button>}
                                        <button
                                            onClick={() => startEdit(gem)}
                                            className="p-1.5 text-neutral-400 hover:text-black transition-colors"
                                            title="Edit"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                        <button
                                            onClick={() => onDeleteItem && onDeleteItem(gem.id)}
                                            className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {gems.length === 0 && (
                                <div className="p-8 text-center text-neutral-400 italic text-sm">
                                    Your gem bag is empty.
                                </div>
                            )}
                        </div>
                        <div className="border-t-2 border-black p-2 bg-neutral-50 flex justify-between items-center font-serif">
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-bold uppercase tracking-widest text-neutral-500">Total Value</span>
                                <span className="text-lg font-bold text-amber-600">{totalValue.toFixed(2)} GP</span>
                            </div>
                            {onSell && gems.length > 0 && (
                                <button
                                    onClick={handleSellAll}
                                    className="px-3 py-1 bg-amber-600 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-amber-700 transition-colors flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                                >
                                    <Coins size={12} />
                                    Sell All Gems
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-neutral-200 border-t-2 border-black flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-2 bg-black text-white font-serif font-bold uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
