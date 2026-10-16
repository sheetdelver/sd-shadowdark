'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { logger } from '@sheet-delver/sdk';
import { useSDK } from '@sheet-delver/sdk/react';
import { useShadowdarkLevelUp } from '../hooks/useShadowdarkLevelUp';
import type { PreparedAction, ActionRequest } from '../../logic/actions';
import type { ItemControl } from '../../logic/inventory-controls';

/**
 * ShadowdarkActorContext — client state for one Actor sheet.
 *
 * - Rules come only from the prepared view (`actor.derived`); this context never
 *   recomputes bonuses, damage or spell abilities.
 * - Drafts and debounce timers are scoped to the current Actor id and cancelled
 *   on Actor change/unmount; an immediate write cancels a pending debounce for
 *   the same path.
 * - `pending` counts in-flight operations; failures reject, notify and roll back
 *   optimistic state.
 * - Actions open the SDK RollDialog with prepared defaults; spells, Class
 *   Abilities and potions execute through the module action route, guarded
 *   against duplicate submission.
 */
export interface ActionResponse {
    success: boolean;
    outcome?: { total: number; natural: number | null; success: boolean | null; criticalSuccess: boolean; criticalFailure: boolean } | null;
    consequences?: Array<{ description: string; status: 'applied' | 'failed'; error?: string }>;
    pending?: string[];
    /** `partial` when a consequence was not saved; a retry with the same request id applies only the rest. */
    state?: 'complete' | 'partial';
    /** Problems after the result was final (e.g. chat posting); the roll is not repeated. */
    warnings?: string[];
    error?: string;
}

export type CardTarget = { kind: 'item'; itemId: string } | { kind: 'document'; uuid: string };

interface RollDialogState {
    open: boolean;
    title: string;
    type: 'attack' | 'ability' | 'spell';
    defaults: any;
    callback: ((options: any) => void) | null;
}

interface ShadowdarkActorState {
    actor: any | null;
    isSaving: boolean;
    pending: number;
    updateActor: (path: string, value: any, options?: { immediate?: boolean }) => Promise<boolean>;
    updateItem: (itemId: string, patch: Record<string, unknown>, deletedEffectRefs?: string[]) => Promise<boolean>;
    deleteItem: (itemId: string) => Promise<boolean>;
    createItem: (itemData: any) => Promise<boolean>;
    performRoll: (type: string, key: string, options?: any) => Promise<void>;
    toggleEffect: (ref: string, enabled: boolean) => Promise<boolean>;
    deleteEffect: (ref: string) => Promise<boolean>;
    createEffect: (payload: any) => Promise<boolean>;
    updateEffect: (ref: string, patch: any) => Promise<boolean>;
    getDraftValue: (path: string, fallback: any) => any;
    rollDialog: RollDialogState;
    /** Open the roll flow for a prepared action (dialog, confirmation or direct use). */
    startAction: (action: PreparedAction, options?: { focus?: boolean; onSettled?: (result: ActionResponse | null) => void }) => void;
    /** Compatibility: roll dialog for an ability key or an item id. */
    triggerRollDialog: (type: string, key: string, options?: any) => void;
    closeRollDialog: () => void;
    isActionBusy: (actionId: string) => boolean;
    /** Apply a native inventory control (equip/stash/light) and its side effects. */
    runItemControl: (control: ItemControl) => Promise<boolean>;
    pendingConfirmation: { title: string; message: string; onConfirm: () => void } | null;
    cancelConfirmation: () => void;
    refreshActor: () => Promise<void>;
    card: CardTarget | null;
    openCard: (target: CardTarget) => void;
    closeCard: () => void;
    triggerLevelUp: () => void;
    showLevelUpModal: boolean;
    levelUpData: any;
    closeLevelUp: () => void;
}

const ShadowdarkActorContext = createContext<ShadowdarkActorState | undefined>(undefined);

const noopAsync = async () => {};
const requestId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^\w-]/g, '');

export function ShadowdarkActorProvider({
    children,
    actor: initialActor,
    onUpdate,
    onDeleteItem,
    onCreateItem,
    onUpdateItem,
    onRoll,
    onAction,
    onToggleEffect,
    onDeleteEffect,
    onCreateEffect,
    onUpdateEffect,
    onRefresh
}: {
    children: React.ReactNode;
    actor: any;
    onUpdate: (path: string, value: any) => Promise<void>;
    onDeleteItem: (itemId: string) => Promise<void>;
    onCreateItem: (itemData: any) => Promise<void>;
    onUpdateItem: (itemId: string, patch: Record<string, unknown>, deletedEffectRefs?: string[]) => Promise<void>;
    onRoll: (type: string, key: string, options?: any) => Promise<void>;
    onAction?: (body: any) => Promise<ActionResponse>;
    onToggleEffect: (ref: string, enabled: boolean) => Promise<void>;
    onDeleteEffect: (ref: string) => Promise<void>;
    onCreateEffect: (payload: any) => Promise<void>;
    onUpdateEffect: (ref: string, patch: any) => Promise<void>;
    onAddPredefinedEffect?: unknown;
    onRefresh: () => Promise<void>;
}) {
    const actorId = String(initialActor?.id ?? initialActor?._id ?? '');
    const { addNotification } = useSDK();
    const [pending, setPending] = useState(0);
    const [drafts, setDrafts] = useState<{ actorId: string; values: Record<string, any> }>({ actorId, values: {} });
    const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set());
    const [busyActions, setBusyActions] = useState<Set<string>>(new Set());
    const [card, setCard] = useState<CardTarget | null>(null);
    const [pendingConfirmation, setPendingConfirmation] = useState<ShadowdarkActorState['pendingConfirmation']>(null);
    const [rollDialog, setRollDialog] = useState<RollDialogState>({ open: false, title: '', type: 'attack', defaults: {}, callback: null });
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
    const actorIdRef = useRef(actorId);
    const mounted = useRef(true);

    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    // A different Actor discards drafts, timers, optimistic state, dialogs and cards.
    useEffect(() => {
        actorIdRef.current = actorId;
        setDrafts({ actorId, values: {} });
        setOptimisticDeletedIds(new Set());
        setCard(null);
        setRollDialog(prev => ({ ...prev, open: false, callback: null }));
        const active = timers.current;
        return () => { for (const timer of Object.values(active)) clearTimeout(timer); timers.current = {}; };
    }, [actorId]);

    // Drop drafts the server now reflects; prune optimistic deletions it confirmed.
    useEffect(() => {
        setDrafts(prev => {
            if (prev.actorId !== actorId) return { actorId, values: {} };
            const next = { ...prev.values };
            let changed = false;
            for (const path of Object.keys(next)) {
                if (!timers.current[path] && getDeepValue(initialActor, path) === next[path]) { delete next[path]; changed = true; }
            }
            return changed ? { actorId, values: next } : prev;
        });
        setOptimisticDeletedIds(prev => {
            if (!prev.size) return prev;
            const present = new Set((initialActor?.items ?? []).map((item: any) => String(item.id ?? item._id)));
            const next = new Set([...prev].filter(id => present.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [initialActor, actorId]);

    const track = useCallback(async <T,>(label: string, run: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false }> => {
        setPending(count => count + 1);
        try {
            return { ok: true, value: await run() };
        } catch (error) {
            logger.error(`[ShadowdarkActorContext] ${label} failed:`, error);
            if (mounted.current) addNotification(`${label} failed: ${(error as Error)?.message ?? 'Unknown error'}`, 'error');
            return { ok: false };
        } finally {
            if (mounted.current) setPending(count => Math.max(0, count - 1));
        }
    }, [addNotification]);

    const clearDraft = useCallback((path: string) => {
        setDrafts(prev => {
            if (!(path in prev.values)) return prev;
            const next = { ...prev.values };
            delete next[path];
            return { ...prev, values: next };
        });
    }, []);

    const updateActor = useCallback(async (path: string, value: any, options: { immediate?: boolean } = {}) => {
        const owner = actorIdRef.current;
        setDrafts(prev => ({ actorId: owner, values: { ...(prev.actorId === owner ? prev.values : {}), [path]: value } }));
        if (timers.current[path]) { clearTimeout(timers.current[path]); delete timers.current[path]; }
        const write = async () => {
            if (actorIdRef.current !== owner) return false;
            const result = await track('Update', () => onUpdate(path, value));
            if (!result.ok) clearDraft(path);
            return result.ok;
        };
        if (options.immediate) return write();
        return new Promise<boolean>(resolve => {
            timers.current[path] = setTimeout(() => { delete timers.current[path]; write().then(resolve); }, 800);
        });
    }, [onUpdate, track, clearDraft]);

    const updateItem = useCallback(async (itemId: string, patch: Record<string, unknown>, deletedEffectRefs: string[] = []) =>
        (await track('Item update', () => onUpdateItem(itemId, patch, deletedEffectRefs))).ok, [onUpdateItem, track]);

    const deleteItem = useCallback(async (itemId: string) => {
        setOptimisticDeletedIds(prev => new Set(prev).add(itemId));
        const result = await track('Delete', () => onDeleteItem(itemId));
        if (!result.ok) setOptimisticDeletedIds(prev => { const next = new Set(prev); next.delete(itemId); return next; });
        return result.ok;
    }, [onDeleteItem, track]);

    const createItem = useCallback(async (itemData: any) => (await track('Create', () => onCreateItem(itemData))).ok, [onCreateItem, track]);
    const toggleEffect = useCallback(async (ref: string, enabled: boolean) => (await track('Effect toggle', () => onToggleEffect(ref, enabled))).ok, [onToggleEffect, track]);
    const deleteEffect = useCallback(async (ref: string) => (await track('Effect delete', () => onDeleteEffect(ref))).ok, [onDeleteEffect, track]);
    const createEffect = useCallback(async (payload: any) => (await track('Effect create', () => onCreateEffect(payload))).ok, [onCreateEffect, track]);
    const updateEffect = useCallback(async (ref: string, patch: any) => (await track('Effect update', () => onUpdateEffect(ref, patch))).ok, [onUpdateEffect, track]);
    const refreshActor = useCallback(async () => { await track('Refresh', onRefresh); }, [onRefresh, track]);
    const performRoll = useCallback(async (type: string, key: string, options?: any) => { await onRoll(type, key, options); }, [onRoll]);

    const { triggerLevelUp, showLevelUpModal, levelUpData, closeLevelUp } = useShadowdarkLevelUp(initialActor, addNotification as any);

    const getDraftValue = useCallback((path: string, fallback: any) =>
        drafts.actorId === actorId && drafts.values[path] !== undefined ? drafts.values[path] : fallback, [drafts, actorId]);

    const closeRollDialog = useCallback(() => setRollDialog(prev => ({ ...prev, open: false, callback: null })), []);
    const isActionBusy = useCallback((id: string) => busyActions.has(id), [busyActions]);

    // The item's own write goes first and stops the sequence on failure; native
    // side effects on other items follow, and a partial result is reported.
    const runItemControl = useCallback(async (control: ItemControl) => {
        const [own, ...others] = control.writes;
        const key = `control:${own?.itemId}:${control.id}`;
        if (!own || busyActions.has(key)) return false;
        setBusyActions(prev => new Set(prev).add(key));
        try {
            if (!(await updateItem(own.itemId, own.patch))) return false;
            let failed = 0;
            for (const write of others) if (!(await updateItem(write.itemId, write.patch))) failed++;
            if (failed && mounted.current) addNotification(`${control.label}: done, but ${failed} related item update(s) failed.`, 'error');
            return failed === 0;
        } finally {
            if (mounted.current) setBusyActions(prev => { const next = new Set(prev); next.delete(key); return next; });
        }
    }, [busyActions, updateItem, addNotification]);

    const runAction = useCallback(async (action: PreparedAction, body: Record<string, unknown>, onSettled?: (result: ActionResponse | null) => void) => {
        if (busyActions.has(action.id) || !onAction) { onSettled?.(null); return; }
        const owner = actorIdRef.current;
        setBusyActions(prev => new Set(prev).add(action.id));
        const result = await track(action.label, () => onAction({ requestId: requestId(), kind: action.kind, itemId: action.itemId,
            spellIndex: action.spell?.index ?? undefined, ...body }));
        if (mounted.current) setBusyActions(prev => { const next = new Set(prev); next.delete(action.id); return next; });
        if (!result.ok || actorIdRef.current !== owner) { onSettled?.(null); return; }
        const response = result.value;
        const failed = (response.consequences ?? []).filter(entry => entry.status === 'failed');
        if (failed.length || response.pending?.length) {
            addNotification(`${action.label}: rolled, but not every result was saved (${[...failed.map(entry => `${entry.description} ${entry.error ?? ''}`), ...(response.pending ?? [])].join('; ')}).`, 'error');
        }
        if (response.warnings?.length) addNotification(`${action.label}: ${response.warnings.join(' ')}`, 'warning');
        onSettled?.(response);
    }, [busyActions, onAction, track, addNotification]);

    /** RollDialog values are overrides only where the user changed a default. */
    const changedOverrides = (defaults: any, options: any) => {
        const overrides: Record<string, unknown> = {};
        for (const key of ['abilityBonus', 'itemBonus', 'talentBonus'] as const) {
            if (options?.[key] !== undefined && Number(options[key]) !== Number(defaults?.[key] ?? 0)) overrides[key] = Number(options[key]);
        }
        if (options?.advantageMode && options.advantageMode !== defaults?.advantageMode) overrides.advantageMode = options.advantageMode;
        if (options?.manualValue !== undefined && options.manualValue !== null) overrides.manualValue = Number(options.manualValue);
        return overrides;
    };

    const startAction = useCallback((action: PreparedAction, options: { focus?: boolean; onSettled?: (result: ActionResponse | null) => void } = {}) => {
        if (!action.available) {
            addNotification(action.reason ?? `${action.label} is unavailable.`, 'error');
            options.onSettled?.(null);
            return;
        }
        if (busyActions.has(action.id)) return;
        if (action.kind === 'potion' || (action.kind === 'ability' && action.dc === null)) {
            setPendingConfirmation({
                title: action.label,
                message: action.consequences.map(entry => entry.description).join(' ') || `${action.label}?`,
                onConfirm: () => { setPendingConfirmation(null); runAction(action, {}, options.onSettled); },
            });
            return;
        }
        const defaults = {
            abilityBonus: action.abilityBonus, itemBonus: action.itemBonus, talentBonus: action.talentBonus,
            showItemBonus: action.kind === 'attack',
            advantageMode: action.advantage > 0 ? 'advantage' : action.advantage < 0 ? 'disadvantage' : 'normal',
        };
        const dialogType = action.kind === 'spell' ? 'spell' : action.kind === 'check' || action.kind === 'ability' ? 'ability' : 'attack';
        setRollDialog({
            open: true, title: action.label, type: dialogType, defaults,
            callback: (rollOptions: any) => {
                const overrides = changedOverrides(defaults, rollOptions);
                closeRollDialog();
                if (action.kind === 'attack' || action.kind === 'check') {
                    const type = action.kind === 'check' ? 'ability' : 'item';
                    const key = action.kind === 'check' ? String(action.request.stat) : String(action.itemId);
                    performRoll(type, key, { ...overrides, attackType: action.request.attackType, handedness: action.request.handedness })
                        .then(() => options.onSettled?.({ success: true }));
                    return;
                }
                runAction(action, { overrides, focus: options.focus === true }, options.onSettled);
            },
        });
    }, [busyActions, addNotification, closeRollDialog, performRoll, runAction]);

    const triggerRollDialog = useCallback((type: string, key: string, options: any = {}) => {
        const actions: PreparedAction[] = initialActor?.derived?.actions ?? [];
        const action = type === 'ability'
            ? actions.find(entry => entry.kind === 'check' && entry.request.stat === key)
            : actions.find(entry => entry.itemId === key && (!options.attackType || entry.attack?.type === options.attackType));
        if (!action) {
            addNotification('That action is not available from the prepared character data.', 'error');
            return;
        }
        startAction(action);
    }, [initialActor, startAction, addNotification]);

    const computedActor = useMemo(() => {
        if (!initialActor || optimisticDeletedIds.size === 0) return initialActor;
        const keep = (id: unknown) => !optimisticDeletedIds.has(String(id));
        const derived = initialActor.derived ? {
            ...initialActor.derived,
            items: (initialActor.derived.items ?? []).filter((view: any) => keep(view.id)),
            actions: (initialActor.derived.actions ?? []).filter((action: any) => !action.itemId || keep(action.itemId)),
            attacks: {
                melee: (initialActor.derived.attacks?.melee ?? []).filter((row: any) => keep(row.id)),
                ranged: (initialActor.derived.attacks?.ranged ?? []).filter((row: any) => keep(row.id)),
            },
        } : initialActor.derived;
        return { ...initialActor, items: (initialActor.items || []).filter((item: any) => keep(item.id ?? item._id)), derived, computed: derived };
    }, [initialActor, optimisticDeletedIds]);

    const value: ShadowdarkActorState = {
        actor: computedActor,
        isSaving: pending > 0,
        pending,
        updateActor, updateItem, deleteItem, createItem, performRoll,
        getDraftValue, toggleEffect, deleteEffect, createEffect, updateEffect, refreshActor,
        triggerLevelUp, showLevelUpModal, levelUpData, closeLevelUp,
        rollDialog, startAction, triggerRollDialog, closeRollDialog, isActionBusy, runItemControl,
        pendingConfirmation, cancelConfirmation: () => setPendingConfirmation(null),
        card, openCard: setCard, closeCard: () => setCard(null),
    };

    return (
        <ShadowdarkActorContext.Provider value={value}>
            {children}
        </ShadowdarkActorContext.Provider>
    );
}

export function useShadowdarkActor() {
    const context = useContext(ShadowdarkActorContext);
    if (context === undefined) {
        throw new Error('useShadowdarkActor must be used within a ShadowdarkActorProvider');
    }
    return context;
}

/** Prepared actions for an owned item (shared by both layouts and cards). */
export function actionsForItem(actor: any, itemId: string): PreparedAction[] {
    return (actor?.derived?.actions ?? []).filter((action: PreparedAction) => action.itemId === itemId);
}

export type { PreparedAction, ActionRequest };
export { noopAsync };

// Utility to get deep nested values by string path (e.g. "system.attributes.hp.value")
function getDeepValue(obj: any, path: string) {
    return path.split('.').reduce((prev, curr) => {
        return prev ? prev[curr] : undefined;
    }, obj);
}
