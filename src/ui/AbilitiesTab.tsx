'use client';

import React from 'react';

import { useSDK } from '@sheet-delver/sdk/react';
import { useShadowdarkActor } from './context/ShadowdarkActorContext';
import type { PreparedAction } from '../logic/actions';
import { bonusLabel } from '../logic/actions';
import { LuckControl } from './components/LuckControl';

/**
 * Advanced Abilities tab. Every value comes from the prepared view
 * (`actor.derived`): abilities, AC, HP, attacks and actions. Rows are buttons
 * with accessible names; details open the shared resource card.
 */
const cardStyle = "bg-white border-2 border-black p-4 text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative";
const header = (title: string, extra?: React.ReactNode) => (
    <div className="bg-black text-white p-1 -mx-4 -mt-4 mb-2 px-2 flex justify-between items-center border-b border-white">
        <h3 className="font-serif font-bold text-lg uppercase">{title}</h3>{extra}
    </div>
);

export default function AbilitiesTab() {
    const { resolveImageUrl } = useSDK();
    const { actor, updateActor, updateItem, getDraftValue, startAction, openCard, isActionBusy } = useShadowdarkActor();
    const derived = actor.derived ?? {};
    const actions: PreparedAction[] = derived.actions ?? [];
    const isNpc = derived.kind === 'NPC';

    const attackList = (rows: any[], kind: 'melee' | 'ranged') => (
        <ul className="space-y-2">
            {rows.map((row: any, idx: number) => {
                const action = actions.find(entry => entry.id === row.actionId);
                return (
                    <li key={row.actionId ?? `${kind}-${idx}`} className="bg-neutral-50 p-2 border border-neutral-200 flex justify-between items-center gap-2 hover:border-black">
                        <button type="button" className="text-left min-w-0 flex-1 min-h-11" onClick={() => openCard({ kind: 'item', itemId: row.id })}
                            aria-label={`${row.name} details`}>
                            <span className="font-bold font-serif text-lg leading-none break-words">
                                {row.derived?.count > 1 ? `${row.derived.count} × ` : ''}{row.name}
                            </span>
                            {row.derived?.modes > 1 && <span className="ml-2 text-[10px] uppercase tracking-wider font-bold border border-black px-1">{row.derived.mode}</span>}
                            {row.derived?.range && <span className="ml-2 text-[10px] text-neutral-500 uppercase tracking-wider font-bold">{row.derived.range}</span>}
                            <span className="block text-sm text-neutral-700 font-sans mt-1">
                                <span className="font-bold">{row.derived?.toHit}</span> to hit, <span title={row.derived?.warnings?.join(' ')} className="font-bold">{row.derived?.damage}</span> dmg
                                {row.derived?.special ? `, ${row.derived.special}` : ''}
                            </span>
                        </button>
                        {action && (
                            <button type="button" onClick={() => startAction(action)} disabled={!action.available || isActionBusy(action.id)}
                                title={action.reason ?? `Roll ${row.name} (${row.derived?.mode ?? kind})`} aria-label={`Roll ${row.name} ${String(row.derived?.mode ?? kind).toLowerCase()} attack`}
                                className="shrink-0 w-11 h-11 rounded-full bg-black flex items-center justify-center hover:scale-110 active:scale-95 disabled:opacity-40">
                                <img src="/icons/dice-d20.svg" alt="" className="w-8 h-8 brightness-0 invert" />
                            </button>
                        )}
                    </li>
                );
            })}
            {rows.length === 0 && <li className="text-neutral-500 text-sm italic text-center py-2">{isNpc ? 'No attacks.' : `No ${kind} weapons equipped.`}</li>}
        </ul>
    );

    const abilityActions = actions.filter(action => action.kind === 'ability');
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-20">
            <div className="md:col-span-1 flex flex-col gap-4">
                <div className={cardStyle}>
                    {header('HP')}
                    <div className="flex justify-center items-baseline gap-2 font-serif text-3xl font-bold pt-2">
                        <label className="sr-only" htmlFor="sd-hp-advanced">Current hit points</label>
                        <input id="sd-hp-advanced" type="number" min={0} max={derived.hp?.max}
                            value={getDraftValue('system.attributes.hp.value', actor.system?.attributes?.hp?.value ?? 0)}
                            onChange={(e) => updateActor('system.attributes.hp.value', Math.min(Number(derived.hp?.max ?? 0), Math.max(0, parseInt(e.target.value) || 0)))}
                            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                            className="w-16 text-center bg-neutral-100 rounded border-b-2 border-neutral-300 focus:border-black outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="text-neutral-400 text-xl font-sans font-light" aria-hidden="true">/</span>
                        <span aria-label="Maximum hit points">{derived.hp?.max ?? 0}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className={cardStyle}>
                        {header('AC')}
                        <div className="text-center font-serif text-3xl font-bold py-2" title={derived.acSource === 'npc-explicit' ? 'Explicit NPC AC' : 'Prepared from armor and effects'}>{derived.ac ?? '—'}</div>
                    </div>
                    {!isNpc && <div className={cardStyle}>{header('Luck')}<LuckControl /></div>}
                    {isNpc && derived.npc && (
                        <div className={cardStyle}>{header('Move')}<div className="text-center font-serif font-bold py-2">{derived.npc.move}{derived.npc.moveNote ? ` (${derived.npc.moveNote})` : ''}</div></div>
                    )}
                </div>

                {!isNpc && actor.system?.level && (
                    <div className={cardStyle}>
                        {header(`Level ${derived.level ?? 0}`, derived.levelUp ? <span className="bg-amber-500 text-black px-2 py-0.5 text-xs font-bold rounded">LEVEL UP!</span> : null)}
                        <div className="py-2">
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-neutral-600">XP Progress</span>
                                <span className="font-bold">{actor.system.level.xp ?? 0} / {derived.xpNextLevel}</span>
                            </div>
                            <div className="w-full bg-neutral-200 rounded-full h-2 overflow-hidden" role="progressbar" aria-label="XP progress"
                                aria-valuemin={0} aria-valuemax={derived.xpNextLevel || 1} aria-valuenow={actor.system.level.xp ?? 0}>
                                <div className="bg-black h-full" style={{ width: `${derived.xpNextLevel ? Math.min(100, ((actor.system.level.xp ?? 0) / derived.xpNextLevel) * 100) : 100}%` }} />
                            </div>
                        </div>
                    </div>
                )}

                <div className={cardStyle}>
                    {header('Stats')}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        {Object.entries(derived.abilities ?? {}).map(([key, stat]: [string, any]) => {
                            const action = actions.find(entry => entry.kind === 'check' && entry.request.stat === key);
                            return (
                                <button type="button" key={key} onClick={() => action && startAction(action)} disabled={!action}
                                    aria-label={`${key.toUpperCase()} check, modifier ${bonusLabel(stat.mod)}`}
                                    className="flex flex-col items-center bg-neutral-100 border-2 border-neutral-300 rounded min-h-11 hover:border-black hover:bg-white focus-visible:border-black group overflow-hidden">
                                    <span className="w-full bg-neutral-200 text-center py-1 border-b border-neutral-300 font-bold text-xs uppercase tracking-widest text-neutral-700">{key}</span>
                                    <span className="flex flex-col items-center py-2">
                                        {stat.value !== null && stat.value !== undefined && <span className="font-serif text-2xl font-bold leading-none mb-1">{stat.value}</span>}
                                        <span className={`font-serif font-bold ${stat.value === null ? 'text-2xl' : 'text-neutral-600 text-xs'}`}>({bonusLabel(stat.mod)})</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="md:col-span-2 flex flex-col gap-6">
                <section className={cardStyle} aria-label="Melee attacks">{header(isNpc ? 'Close Attacks' : 'Melee Attacks')}{attackList(derived.attacks?.melee ?? [], 'melee')}</section>
                <section className={cardStyle} aria-label="Ranged attacks">{header('Ranged Attacks')}{attackList(derived.attacks?.ranged ?? [], 'ranged')}</section>

                {abilityActions.length > 0 && (
                    <section className={cardStyle} aria-label="Class abilities">
                        {header('Class Abilities')}
                        <ul className="divide-y divide-neutral-200">
                            {abilityActions.map(action => {
                                const item = (actor.items ?? []).find((entry: any) => String(entry.id) === action.itemId);
                                const view = (derived.items ?? []).find((entry: any) => entry.id === action.itemId);
                                if (!item || !view) return null;
                                const uses = view.uses;
                                return (
                                    <li key={action.id} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                                        <button type="button" onClick={() => openCard({ kind: 'item', itemId: view.id })} className="flex-1 min-w-0 flex items-center gap-2 text-left min-h-11" aria-label={`${item.name} details`}>
                                            <img src={resolveImageUrl(item.img)} className="w-8 h-8 border border-black object-cover bg-neutral-200" alt="" />
                                            <span className={`font-serif font-bold text-lg leading-tight break-words ${view.lost ? 'opacity-60 line-through' : ''}`}>{item.name}</span>
                                            {view.lost && <span className="text-[10px] font-bold uppercase border border-red-700 text-red-800 px-1">Lost</span>}
                                        </button>
                                        {uses?.limited && (
                                            <span className="flex items-center gap-1" aria-label={`${uses.available} of ${uses.max} uses`}>
                                                <button type="button" aria-label={`Remove a use of ${item.name}`} className="w-8 h-8 border border-neutral-300 disabled:opacity-30"
                                                    disabled={uses.available <= 0} onClick={() => updateItem(view.id, { 'system.uses.available': uses.available - 1 })}>−</button>
                                                <span className="font-mono font-bold min-w-[4ch] text-center">{uses.available}/{uses.max}</span>
                                                <button type="button" aria-label={`Restore a use of ${item.name}`} className="w-8 h-8 border border-neutral-300 disabled:opacity-30"
                                                    disabled={uses.available >= uses.max} onClick={() => updateItem(view.id, { 'system.uses.available': uses.available + 1 })}>+</button>
                                            </span>
                                        )}
                                        <button type="button" onClick={() => startAction(action)} disabled={!action.available || isActionBusy(action.id)}
                                            title={action.reason ?? undefined} className="min-h-11 px-3 bg-black text-white text-xs font-bold uppercase disabled:opacity-40">Use</button>
                                        <button type="button" onClick={() => updateItem(view.id, { 'system.lost': !view.lost })}
                                            className="min-h-11 px-3 border border-black text-xs font-bold uppercase">{view.lost ? 'Restore' : 'Mark lost'}</button>
                                        {!action.available && action.reason && <span className="basis-full text-xs text-red-800">{action.reason}</span>}
                                    </li>
                                );
                            })}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}
