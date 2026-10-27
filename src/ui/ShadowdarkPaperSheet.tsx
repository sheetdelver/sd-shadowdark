'use client';

import React, { useState } from 'react';
import { groupPaperTalents, talentLevelLabel } from './talent-display';
import { Flame, FlameKindling } from 'lucide-react';
import { LightRemaining } from './components/LightRemaining';
import { SheetCharacterName } from './components/SheetCharacterName';
import NotesModal from './components/NotesModal';
import { useShadowdarkActor } from './context/ShadowdarkActorContext';
import { LuckControl } from './components/LuckControl';
import { bonusLabel, type PreparedAction } from '../logic/actions';

interface ShadowdarkPaperSheetProps {
    onToggleView: () => void;
}

/**
 * Single-page ("paper") layout. It renders the same prepared view and actions as
 * the tabbed sheet: no rule is computed here. Spell, feature and gear names open
 * the shared resource card; casting happens from the card.
 */
const box = 'border-2 border-black relative';
const tag = 'bg-black text-white text-xs font-black uppercase px-2 py-0.5 w-fit absolute top-0 left-0';
const row = 'w-full text-left flex justify-between items-baseline gap-2 border-b border-black border-dotted py-1 min-h-11 sm:min-h-0 hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600';

const FEATURE_TYPES = ['Talent', 'Boon', 'Class Ability'];

export default function ShadowdarkPaperSheet({ onToggleView }: ShadowdarkPaperSheetProps) {
    const { actor, updateActor, startAction, openCard, triggerLevelUp, isActionBusy, openRest } = useShadowdarkActor();
    const [notesModalOpen, setNotesModalOpen] = useState(false);
    const derived = actor.derived ?? {};
    const actions: PreparedAction[] = derived.actions ?? [];
    const views: any[] = derived.items ?? [];
    const itemById = (id: string) => (actor.items ?? []).find((item: any) => String(item.id ?? item._id) === id);

    const stat = (key: string, label: string) => {
        const ability = derived.abilities?.[key];
        const action = actions.find(entry => entry.kind === 'check' && entry.request.stat === key);
        return (
            <button type="button" key={key} onClick={() => action && startAction(action)} disabled={!action}
                aria-label={`${label} check, ${ability?.value ?? ''} (${bonusLabel(ability?.mod ?? 0)})`}
                className={`${box} h-20 p-1 hover:bg-neutral-100 focus-visible:bg-neutral-100`}>
                <span className={tag}>{label}</span>
                <span className="flex items-end justify-center h-full pb-1 gap-1">
                    {ability?.value !== null && ability?.value !== undefined && <span className="text-3xl font-bold">{ability.value}</span>}
                    <span className={`font-bold ${ability?.value === null ? 'text-3xl' : 'text-lg text-neutral-600 mb-1'}`}>({bonusLabel(ability?.mod ?? 0)})</span>
                </span>
            </button>
        );
    };

    const attacks = [...(derived.attacks?.melee ?? []).map((a: any) => ({ ...a, _type: 'Melee' })), ...(derived.attacks?.ranged ?? []).map((a: any) => ({ ...a, _type: 'Ranged' }))];
    const spells = views.filter(view => view.type === 'Spell').sort((a, b) => (Number(itemById(a.id)?.system?.tier ?? 0) - Number(itemById(b.id)?.system?.tier ?? 0)) || a.name.localeCompare(b.name));
    const magic = views.filter(view => view.type === 'Scroll' || view.type === 'Wand');
    const features = groupPaperTalents(views.filter(view => FEATURE_TYPES.includes(view.type)), actor.items ?? []);
    const gear = views.filter(view => view.physical);
    const freeCarry = gear.filter(view => view.freeCarry > 0 && !view.stashed);
    const ownedClass = (actor.items ?? []).find((item: any) => item.type === 'Class');
    const showPatron = !!derived.identity?.patron?.ref || ownedClass?.system?.patron?.required === true;
    const label = (entry: any) => entry?.label ?? entry?.value ?? '';
    const notesText = String(actor.details?.notes ?? '').replace(/<[^>]*>/g, '');

    const info = (title: string, value: React.ReactNode) => (
        <div className={`${box} min-h-16 p-1`}>
            <span className={tag}>{title}</span>
            <div className="flex items-end justify-center h-full w-full pt-5 pb-1 px-1 text-lg font-bold text-center break-words">{value || '-'}</div>
        </div>
    );

    return (
        <div className="relative w-full flex flex-col bg-white font-serif text-sm">
            <div className="bg-white text-black w-full p-3 sm:p-4 md:p-6 relative flex flex-col gap-4">
                <div className="flex flex-col md:grid md:grid-cols-12 gap-4 items-start mb-4">
                    <div className="w-full md:col-span-6 xl:col-span-8 flex flex-col items-center gap-2 text-center pt-2">
                        <h1 className="text-[clamp(2rem,5vw,3.75rem)] font-black tracking-tighter uppercase leading-none">ShadowDark</h1>
                        <div className="flex flex-wrap justify-center items-center gap-2">
                        <button type="button" onClick={onToggleView}
                            className="print:hidden text-xs font-bold uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                            Manage Character Sheet
                        </button>
                        <button type="button" onClick={openRest} className="print:hidden text-xs font-bold uppercase tracking-widest border-2 border-black px-3 py-2 hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] inline-flex items-center gap-1"><FlameKindling size={14} aria-hidden="true" />Rest</button>
                        </div>
                    </div>
                    <div className={`w-full md:col-span-6 xl:col-span-4 ${box} p-2 pt-6 h-24 flex flex-col text-2xl font-bold`}>
                        <span className={tag}>Name</span>
                        <label className="sr-only" htmlFor="sd-paper-name">Name</label>
                        <SheetCharacterName hp={derived.hp?.value} className="flex-1 w-full"><input id="sd-paper-name" key={actor.name} type="text" defaultValue={actor.name}
                            onBlur={(e) => e.target.value !== actor.name && updateActor('name', e.target.value, { immediate: true })}
                            className="w-full min-w-0 h-full text-2xl font-bold bg-transparent outline-none px-1" /></SheetCharacterName>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 flex-1 items-start">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-2">{[['str', 'STR'], ['dex', 'DEX'], ['con', 'CON']].map(([key, text]) => stat(key, text))}</div>
                            <div className="flex flex-col gap-2">{[['int', 'INT'], ['wis', 'WIS'], ['cha', 'CHA']].map(([key, text]) => stat(key, text))}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className={`${box} h-24 flex flex-col`}>
                                <span className="bg-black text-white text-xs font-black uppercase px-2 py-0.5 w-fit">HP</span>
                                <div className="flex-1 flex items-center justify-center text-2xl font-bold">
                                    <label className="sr-only" htmlFor="sd-paper-hp">Current hit points</label>
                                    <input id="sd-paper-hp" key={actor.system?.attributes?.hp?.value} type="number" min={0} max={derived.hp?.max}
                                        defaultValue={actor.system?.attributes?.hp?.value ?? 0}
                                        onBlur={(e) => {
                                            const value = Math.min(Number(derived.hp?.max ?? 0), Math.max(0, parseInt(e.target.value) || 0));
                                            if (value !== actor.system?.attributes?.hp?.value) updateActor('system.attributes.hp.value', value, { immediate: true });
                                        }}
                                        className="w-12 text-center bg-transparent outline-none border-b-2 border-black hover:bg-neutral-100 focus:bg-neutral-100 rounded" />
                                    <span className="text-neutral-400 mx-1 text-xl" aria-hidden="true">/</span>
                                    <span aria-label="Maximum hit points">{derived.hp?.max ?? 0}</span>
                                </div>
                            </div>
                            <div className={`${box} h-24 flex flex-col`}>
                                <span className="bg-black text-white text-xs font-black uppercase px-2 py-0.5 w-fit">AC</span>
                                <div className="flex-1 flex items-center justify-center text-3xl font-bold">{derived.ac ?? '-'}</div>
                            </div>
                        </div>
                        <div className={`${box} p-1 pt-6 flex flex-col`}>
                            <span className={tag}>Luck</span>
                            <LuckControl compact />
                        </div>
                        <section className={`${box} flex flex-col`} aria-label="Attacks">
                            <span className="bg-black text-white text-xs font-black uppercase px-2 py-0.5 w-fit">Attacks ({attacks.length})</span>
                            <ul className="p-2 max-h-[28rem] overflow-y-auto">
                                {attacks.map((atk: any) => {
                                    const action = actions.find(entry => entry.id === atk.actionId);
                                    return (
                                        <li key={atk.actionId} className="flex items-center gap-1 border-b border-black border-dotted">
                                            <button type="button" className="flex-1 min-w-[5rem] text-left py-1 min-h-11 sm:min-h-0" onClick={() => openCard({ kind: 'item', itemId: atk.id })} aria-label={`${atk.name} details`}>
                                                <span className="block text-xs font-bold uppercase break-words">{atk.derived?.count > 1 ? `${atk.derived.count} × ` : ''}{atk.name}</span>
                                                <span className="block text-[10px] text-neutral-600 font-bold uppercase tracking-wider">{atk.derived?.mode ?? atk._type}{atk.derived?.handedness === 'NPC attack' || atk.derived?.mode?.includes('handed') ? '' : ` • ${atk.derived?.handedness}`}</span>
                                            </button>
                                            <button type="button" onClick={() => action && startAction(action)} disabled={!action?.available || (action && isActionBusy(action.id))}
                                                title={action?.reason ?? undefined} aria-label={`Roll ${atk.name} ${String(atk.derived?.mode ?? atk._type).toLowerCase()} attack`}
                                                className="shrink max-w-[55%] text-xs font-bold px-2 min-h-11 sm:min-h-8 border border-black text-right break-words hover:bg-black hover:text-white disabled:opacity-40">
                                                {atk.derived?.toHit} <span title={atk.derived?.warnings?.join(' ')}>{atk.derived?.damage}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                                {attacks.length === 0 && <li className="text-[10px] text-neutral-500 italic text-center py-2">No equipped weapons</li>}
                            </ul>
                        </section>
                    </div>

                    <div className="flex flex-col gap-4">
                        {info('Ancestry', actor.details?.ancestry)}
                        {info('Class', actor.details?.class)}
                        <div className={`${box} h-16 p-1 flex items-center justify-center`}>
                            <span className={tag}>Level</span>
                            {actor.advancementPending || derived.levelUp ? (
                                <button type="button" onClick={triggerLevelUp} className="mt-3 bg-amber-500 text-black px-2 py-1 text-xs font-bold rounded hover:bg-amber-400">{actor.advancementPending ? 'Review advancement' : 'LEVEL UP!'}</button>
                            ) : <span className="text-2xl font-bold pt-4">{derived.level ?? 0}</span>}
                        </div>
                        <div className={`${box} h-16 flex flex-col`}>
                            <span className={tag}>XP</span>
                            <div className="flex-1 flex items-center justify-center text-xl font-bold pt-4">
                                <label className="sr-only" htmlFor="sd-paper-xp">Experience points</label>
                                <input id="sd-paper-xp" key={actor.system?.level?.xp} type="number" min={0} defaultValue={actor.system?.level?.xp || 0}
                                    onBlur={(e) => { const xp = Math.max(0, parseInt(e.target.value) || 0); if (xp !== actor.system?.level?.xp) updateActor('system.level.xp', xp, { immediate: true }); }}
                                    className="w-12 text-center bg-transparent outline-none border-b-2 border-black hover:bg-neutral-100 focus:bg-neutral-100 rounded" />
                                <span className="text-neutral-400 mx-1" aria-hidden="true">/</span>
                                <span>{derived.xpNextLevel ?? 0}</span>
                            </div>
                        </div>
                        {info('Title', actor.details?.title)}
                        {info('Alignment', <span className="capitalize">{actor.details?.alignment}</span>)}
                        {info('Background', actor.details?.background)}
                        {info('Deity', label(derived.identity?.deity) || actor.details?.deity)}
                        {showPatron && info('Patron', label(derived.identity?.patron) || actor.details?.patron)}
                    </div>

                    <div className="flex flex-col gap-4">
                        {(derived.showSpellsTab || spells.length > 0 || magic.length > 0) && (
                            <section className={`${box} flex flex-col min-h-[4rem]`} aria-label="Spells">
                                <span className={tag}>Spells</span>
                                <ul className="p-3 pt-8">
                                    {spells.map(view => {
                                        const item = itemById(view.id);
                                        return (
                                            <li key={view.id}>
                                                <button type="button" className={row} onClick={() => openCard({ kind: 'item', itemId: view.id })}>
                                                    <span className={`text-xs font-bold uppercase break-words ${view.lost ? 'line-through opacity-60' : ''}`}>{view.name}{view.innate ? ' *' : ''}</span>
                                                    <span className="text-[10px] text-neutral-600 shrink-0">{view.lost ? 'Lost · ' : ''}{item?.system?.tier !== undefined ? `T${item.system.tier}` : ''}</span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                    {magic.map(view => (
                                        <li key={view.id}>
                                            <button type="button" className={row} onClick={() => openCard({ kind: 'item', itemId: view.id })}>
                                                <span className="text-xs font-bold uppercase break-words">{view.name}</span>
                                                <span className="text-[10px] text-neutral-600 shrink-0">{view.type}{view.broken ? ' · Broken' : ''}</span>
                                            </button>
                                        </li>
                                    ))}
                                    {spells.length === 0 && magic.length === 0 && <li className="text-[10px] text-neutral-500 italic text-center mt-2">No spells known</li>}
                                </ul>
                            </section>
                        )}
                        <section className={`${box} flex flex-col min-h-[8rem]`} aria-label="Talents and abilities">
                            <span className={tag}>Talents</span>
                            <ul className="p-3 pt-8">
                                {features.map(({ view, items }) => (
                                    <li key={view.id}>
                                        <button type="button" className={row} onClick={() => openCard({ kind: 'item', itemId: view.id })}>
                                            <span className={`text-xs font-bold uppercase break-words ${view.lost ? 'line-through opacity-60' : ''}`}>{view.name}{items.length > 1 ? ` (x${items.length})` : ''}{talentLevelLabel(items) && <span className="block text-[10px] font-normal normal-case text-neutral-600">{talentLevelLabel(items)}</span>}</span>
                                            <span className="text-[10px] text-neutral-600 shrink-0">{view.type === 'Talent' ? '' : view.type}{view.uses?.limited ? ` ${view.uses.available}/${view.uses.max}` : ''}</span>
                                        </button>
                                    </li>
                                ))}
                                {features.length === 0 && <li className="text-[10px] text-neutral-500 italic text-center mt-2">No talents recorded</li>}
                            </ul>
                        </section>
                        {info('Languages', <span className="text-xs uppercase tracking-wider">{(actor.details?.languages ?? []).filter(Boolean).join(', ')}</span>)}
                        <button type="button" className={`${box} flex flex-col flex-1 min-h-[8rem] text-left hover:bg-neutral-50`} onClick={() => setNotesModalOpen(true)} aria-label="Edit notes">
                            <span className={tag}>Notes</span>
                            <span className="w-full p-4 pt-8 font-serif text-sm line-clamp-6">
                                {notesText || <span className="italic text-neutral-500">Click to add notes...</span>}
                            </span>
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className={`${box} h-16 flex items-center justify-center`}>
                            <span className={tag}>Slots</span>
                            <span className="text-2xl font-bold pt-3">{derived.slotsUsed ?? 0} / {derived.maxSlots ?? '-'}</span>
                        </div>
                        <div className={`${box} p-2`}>
                            <span className={tag}>Gold</span>
                            <div className="flex justify-around items-center pt-6 pb-2">
                                {(['gp', 'sp', 'cp'] as const).map(unit => (
                                    <label key={unit} className="flex flex-col items-center">
                                        <span className="text-xs font-bold uppercase">{unit}</span>
                                        <input key={actor.system?.coins?.[unit]} type="number" min={0} defaultValue={actor.system?.coins?.[unit] || 0}
                                            onBlur={(e) => { const value = Math.max(0, parseInt(e.target.value) || 0); if (value !== (actor.system?.coins?.[unit] || 0)) updateActor(`system.coins.${unit}`, value, { immediate: true }); }}
                                            className="border-b-2 border-black w-14 text-center bg-transparent outline-none text-lg font-bold" />
                                    </label>
                                ))}
                            </div>
                        </div>
                        <section className={`${box} flex flex-col`} aria-label="Gear">
                            <span className={tag}>Gear</span>
                            <ol className="p-3 pt-8">
                                {gear.map((view, index) => {
                                    const item = itemById(view.id);
                                    return (
                                        <li key={view.id}>
                                            <button type="button" className={row} onClick={() => openCard({ kind: 'item', itemId: view.id })}>
                                                <span className="flex gap-1 min-w-0">
                                                    <span className="w-5 text-xs font-bold shrink-0">{index + 1}.</span>
                                                    <span className="text-xs font-bold uppercase break-words">{view.name}{view.quantity > 1 ? ` ×${view.quantity}` : ''}{view.lightSource && <LightRemaining light={item?.system?.light} />}</span>
                                                </span>
                                                <span className="flex items-center gap-1 shrink-0 text-[9px] font-bold uppercase">
                                                    {view.lightSource && item?.system?.light?.active && (
                                                        <span className="flex items-center gap-0.5 text-orange-700" title="Lit"><Flame size={10} aria-hidden="true" /><span className="sr-only">Lit</span></span>
                                                    )}
                                                    {view.stashed ? 'Stashed' : view.equipped ? 'Equipped' : 'Carried'}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ol>
                        </section>
                        <section className={`${box} flex flex-col min-h-[4rem]`} aria-label="Free to carry">
                            <span className={tag}>Free to Carry</span>
                            <ul className="p-3 pt-8 text-xs font-bold uppercase">
                                {freeCarry.map(view => <li key={view.id} className="border-b border-black border-dotted py-1">{view.name} ({view.freeCarry} free)</li>)}
                                {freeCarry.length === 0 && <li className="text-[10px] text-neutral-500 italic normal-case">No free-carry items</li>}
                            </ul>
                        </section>
                    </div>
                </div>
            </div>

            <NotesModal isOpen={notesModalOpen} onClose={() => setNotesModalOpen(false)} />
        </div>
    );
}
