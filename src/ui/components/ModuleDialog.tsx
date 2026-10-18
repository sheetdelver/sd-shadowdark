'use client';

import React from 'react';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Accessible module-local dialog frame (the SDK exposes no generic resource
 * dialog). Provides dialog semantics and naming, focus containment, Escape and
 * backdrop dismissal, focus return to the opener, a scrollable body that respects
 * mobile safe areas, and a `suspended` state while a host dialog (SDK RollDialog
 * at layer 100, ConfirmationModal at 130) is stacked on top of it. The active
 * frame clears the floating host tools; suspension lowers the inert frame so
 * those shared dialogs retain their own focus and presentation.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModuleDialogProps {
    open: boolean;
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    /** Inert while another (host) dialog is stacked above. */
    suspended?: boolean;
    /**
     * `card` is a fixed-size card (24rem wide, 24rem tall) that grows wider (to
     * 34rem) and taller (to 88dvh, then scrolls) when its content needs room.
     * Phones use the full width and content height.
     */
    size?: 'md' | 'lg' | 'card';
    describedBy?: string;
    closeLabel?: string;
    layer?: number;
}

export default function ModuleDialog({ open, title, subtitle, onClose, children, footer, suspended = false, size = 'md',
    describedBy, closeLabel = 'Close', layer = 160 }: ModuleDialogProps) {
    const titleId = useId();
    const panel = useRef<HTMLDivElement>(null);
    const opener = useRef<Element | null>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

    useEffect(() => {
        if (!open) return;
        opener.current = document.activeElement;
        const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
        first?.focus();
        return () => {
            const target = opener.current as HTMLElement | null;
            if (target && document.contains(target)) target.focus();
        };
    }, [open]);

    useEffect(() => {
        if (!open || suspended) return;
        const onKey = (event: KeyboardEvent) => {
            if (!panel.current) return;
            if (event.key === 'Escape') { event.stopPropagation(); onCloseRef.current(); return; }
            if (event.key !== 'Tab') return;
            const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(element => element.offsetParent !== null || element === document.activeElement);
            if (!items.length) { event.preventDefault(); panel.current.focus(); return; }
            const first = items[0], last = items[items.length - 1];
            const active = document.activeElement;
            if (!panel.current.contains(active)) { event.preventDefault(); first.focus(); }
            else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
        };
        document.addEventListener('keydown', onKey, true);
        return () => document.removeEventListener('keydown', onKey, true);
    }, [open, suspended]);

    if (!open) return null;
    const card = size === 'card';
    const width = card ? 'sm:w-fit sm:min-w-[24rem] sm:max-w-[min(34rem,calc(100vw-2rem))] sm:min-h-[min(24rem,88dvh)]'
        : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl';
    return (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ zIndex: suspended ? Math.min(layer, 90) : layer }}
            aria-hidden={suspended || undefined} inert={suspended}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={() => !suspended && onClose()} />
            <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={describedBy} tabIndex={-1}
                className={`relative flex w-full ${width} max-h-[92dvh] sm:max-h-[88dvh] flex-col bg-white text-black border-2 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] outline-none`}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className={`flex items-start justify-between gap-3 bg-black text-white ${card ? 'pl-3 pr-1 py-1.5' : 'px-4 py-3'}`}>
                    <div className={`min-w-0 ${card ? 'py-1' : ''}`}>
                        <h2 id={titleId} className={`font-serif ${card ? 'text-lg' : 'text-xl'} font-bold leading-tight break-words`}>{title}</h2>
                        {subtitle && <p className={`${card ? 'text-[10px]' : 'text-xs'} uppercase tracking-widest text-neutral-300 mt-0.5`}>{subtitle}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label={closeLabel}
                        className="shrink-0 min-h-11 min-w-11 flex items-center justify-center text-white/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400">
                        <X aria-hidden="true" className="w-6 h-6" />
                    </button>
                </div>
                <div className={`flex-1 overflow-y-auto overscroll-contain ${card ? 'px-3 py-3' : 'px-4 py-4'}`}>{children}</div>
                {footer && <div className={`border-t-2 border-black bg-neutral-100 ${card ? 'px-3 py-2' : 'px-4 py-3'}`}>{footer}</div>}
            </div>
        </div>
    );
}
