'use client';

import React, { useMemo } from 'react';
import { LightRemaining } from './components/LightRemaining';
import { useSDK } from '@sheet-delver/sdk/react';
import { useShadowdarkActor } from './context/ShadowdarkActorContext';
import { presentDescription } from '../logic/description';
import { RANGE_LABELS } from '../logic/resource-cards';
import type { PreparedAction } from '../logic/actions';
import { itemControls, type ItemControl } from '../logic/inventory-controls';

/**
 * Inventory rows render prepared item views (`actor.derived.items`) and prepared
 * attack actions; they do not compute slots, properties or damage. Writes address
 * the exact embedded Item id with only the changed field.
 */
export interface QuantityControlProps {
    itemId: string;
    value: number;
    label: string;
}

export function QuantityControl({ itemId, value, label }: QuantityControlProps) {
    const { updateItem } = useShadowdarkActor();
    const change = (event: React.MouseEvent, delta: number) => {
        event.stopPropagation();
        const next = Math.max(0, value + delta);
        if (next !== value) updateItem(itemId, { 'system.quantity': next });
    };
    return (
        <div className="flex items-center gap-1 text-xs bg-neutral-100 rounded px-1">
            <button type="button" onClick={(e) => change(e, -1)} disabled={value <= 0} aria-label={`Decrease ${label} quantity`}
                className="hover:bg-neutral-300 rounded w-9 h-9 flex items-center justify-center touch-manipulation disabled:opacity-30">−</button>
            <span className="mx-1 min-w-[2ch] text-center font-bold" aria-label={`${label} quantity`}>{value}</span>
            <button type="button" onClick={(e) => change(e, 1)} aria-label={`Increase ${label} quantity`}
                className="hover:bg-neutral-300 rounded w-9 h-9 flex items-center justify-center touch-manipulation">+</button>
        </div>
    );
}

export interface ItemRowProps {
    item: any;
    expandedItems: Set<string>;
    toggleItem: (id: string) => void;
    isTreasure?: boolean;
    onSell?: (item: any) => void;
    onDelete?: (item: any) => void;
}

const formatCost = (cost: any) => {
    const parts = (['gp', 'sp', 'cp'] as const).filter(unit => Number(cost?.[unit] ?? 0) > 0).map(unit => `${cost[unit]} ${unit}`);
    return parts.length ? parts.join(', ') : '-';
};

export function ItemRow({ item, expandedItems, toggleItem, isTreasure, onSell, onDelete }: ItemRowProps) {
    const { resolveImageUrl, foundryUrl } = useSDK();
    const { actor, deleteItem, openCard, runItemControl } = useShadowdarkActor();
    const itemId = String(item.id ?? item._id);
    const view = (actor?.derived?.items ?? []).find((entry: any) => entry.id === itemId);
    // Unavailable modes (e.g. a two-handed grip with a shield) are not listed; the card explains them.
    const attacks: PreparedAction[] = (actor?.derived?.actions ?? []).filter((action: PreparedAction) => action.itemId === itemId && action.kind === 'attack' && action.available);
    const description = useMemo(() => presentDescription(item.system?.description, foundryUrl, actor?.derived?.rollData), [item.system?.description, foundryUrl, actor?.derived?.rollData]);
    const equipped = view?.equipped ?? item.system?.equipped === true;
    const stashed = view?.stashed ?? item.system?.stashed === true;
    const lit = item.system?.light?.active === true;
    const controls = itemControls(actor?.derived?.items ?? [], actor?.items ?? [], itemId);
    const control = (id: ItemControl['id']) => controls.find(entry => entry.id === id);
    const isExpanded = expandedItems.has(itemId);
    const hands = view?.weapon ? ` (${view.weapon.baseHandedness.toUpperCase()})` : '';

    const run = (event: React.MouseEvent, entry: ItemControl | undefined) => { event.stopPropagation(); if (entry) runItemControl(entry); };
    const button = 'w-10 h-10 flex items-center justify-center rounded hover:bg-neutral-200 touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-black';

    return (
        <div className="group hover:bg-neutral-100">
            <div className="grid grid-cols-12 p-2 gap-2 items-center font-serif text-sm">
                <button type="button" className="col-span-12 sm:col-span-6 font-bold flex items-center text-left min-h-11" aria-expanded={isExpanded}
                    onClick={() => toggleItem(itemId)}>
                    <img src={resolveImageUrl(item.img)} alt="" className="w-8 h-8 object-cover border border-black mr-2 bg-neutral-200 shrink-0" />
                    <span className="break-words">{item.name}{view?.lightSource && <LightRemaining light={item.system?.light} />}</span>
                    {view?.scroll?.spent && <span className="ml-2 text-[10px] uppercase border border-black px-1">Spent</span>}
                    {view?.lightSource && <span className={`ml-2 text-xs ${lit ? 'text-amber-700 font-bold' : 'text-neutral-500'}`}>{lit ? 'Lit' : 'Unlit'}</span>}
                    {view && !view.identified && <span className="ml-2 text-[10px] uppercase border border-black px-1">Unidentified</span>}
                </button>
                <div className="col-span-4 sm:col-span-2 text-center font-bold text-neutral-600 flex justify-center items-center">
                    {isTreasure ? <span className="text-amber-700">{formatCost(item.system?.cost)}</span>
                        : view && (item.system?.isAmmunition || Number(item.system?.slots?.per_slot ?? 1) > 1 || view.quantity !== 1)
                            ? <QuantityControl itemId={itemId} value={view.quantity} label={item.name} /> : ''}
                </div>
                <div className="col-span-2 text-center" aria-label="Slots">{view ? (view.slotsUsed === 0 ? '-' : view.slotsUsed) : '-'}</div>
                <div className="col-span-6 sm:col-span-2 flex justify-end sm:justify-center items-center gap-1 flex-wrap">
                    {!stashed && control('light') && (
                        <button type="button" onClick={(e) => run(e, control('light'))} className={`${button} ${lit ? 'text-amber-700' : 'text-neutral-500'}`}
                            title={control('light')!.title} aria-pressed={lit}
                            aria-label={lit ? `Extinguish ${item.name}` : `Light ${item.name}`}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill={lit ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.6-3a1 1 0 0 1 .9 2.5z" /></svg>
                        </button>
                    )}
                    {!stashed && control('equip') && (
                        <button type="button" onClick={(e) => run(e, control('equip'))} aria-pressed={equipped} title={control('equip')!.title}
                            className={`${button} ${equipped ? 'text-green-800' : 'text-neutral-500'}`} aria-label={equipped ? `Unequip ${item.name}` : `Equip ${item.name}`}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill={equipped ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        </button>
                    )}
                    {!equipped && control('stash') && (
                        <button type="button" onClick={(e) => run(e, control('stash'))} aria-pressed={stashed}
                            className={`${button} ${stashed ? 'text-blue-700' : 'text-neutral-500'}`} aria-label={stashed ? `Retrieve ${item.name}` : `Stash ${item.name}`}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill={stashed ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
                        </button>
                    )}
                    {isTreasure && onSell && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onSell(item); }} className={`${button} text-amber-800`} aria-label={`Sell ${item.name}`}>
                            <span aria-hidden="true" className="font-bold">$</span>
                        </button>
                    )}
                    {!equipped && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); onDelete ? onDelete(item) : deleteItem(itemId); }}
                            className={`${button} text-neutral-500 hover:text-red-700`} aria-label={`Delete ${item.name}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                    )}
                </div>
            </div>

            {isExpanded && (
                <div className="px-4 py-2 bg-neutral-50 text-sm border-t border-b border-neutral-200 font-serif">
                    <div className="flex flex-wrap gap-2 mb-2 text-xs font-bold uppercase text-neutral-600">
                        <span className="bg-neutral-200 px-1 rounded">{item.type}</span>
                        {view?.weapon && <>
                            <span>{item.system?.type === 'ranged' ? 'Ranged' : 'Melee'} • {RANGE_LABELS[item.system?.range] ?? item.system?.range ?? '-'}</span>
                            <span data-weapon-damage="base" title={view.weapon.baseWarnings.join(' ')}>Base damage{hands}: {view.weapon.baseDamage ?? 'Damage unavailable'}</span>
                            {attacks.map(action => (
                                <span key={action.id} data-weapon-damage="actor" title={[...(action.damage?.warnings ?? []), ...action.diagnostics].join(' ')}>
                                    Actor damage ({action.attack?.mode ?? 'attack'}): {action.damage?.formula ?? 'Damage unavailable'}
                                </span>
                            ))}
                            {!attacks.length && <span data-weapon-damage="actor">Actor damage{hands}: {view.weapon.baseDamage ?? 'Damage unavailable'}</span>}
                        </>}
                        {item.type === 'NPC Attack' && <>
                            <span>{(item.system?.ranges ?? []).map((range: string) => RANGE_LABELS[range] ?? range).join('/') || '-'}</span>
                            <span data-weapon-damage="base">Base damage: {item.system?.damage?.value || 'Damage unavailable'}</span>
                            {attacks.map(action => (
                                <span key={action.id} data-weapon-damage="actor" title={(action.damage?.warnings ?? []).join(' ')}>Attack damage: {action.damage?.formula ?? 'Damage unavailable'}</span>
                            ))}
                        </>}
                        {item.type === 'Armor' && <span>AC {item.system?.ac?.base ? `${item.system.ac.base}${item.system.ac.attribute ? ` + ${String(item.system.ac.attribute).toUpperCase()}` : ''}` : ''}{item.system?.ac?.modifier ? ` ${item.system.ac.modifier > 0 ? '+' : ''}${item.system.ac.modifier}` : ''}</span>}
                        {(view?.properties ?? []).map((property: any, index: number) => (
                            <span key={`${property.slug}-${index}`} className="bg-neutral-200 px-1 rounded">{property.name ?? 'Unresolved property'}</span>
                        ))}
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: description }} className="prose prose-sm max-w-none break-words" />
                    <button type="button" onClick={() => openCard({ kind: 'item', itemId })} className="mt-2 text-xs font-bold uppercase underline min-h-11">Open details</button>
                </div>
            )}
        </div>
    );
}
