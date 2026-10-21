'use client';

import React, { useState } from 'react';
import { useSDK } from '@sheet-delver/sdk/react';

/** A removed/unavailable optional portrait restores the original image once. */
export default function ArtworkImage({ src, fallback, className, onUnavailable }: {
    src: string; fallback?: string; className?: string; onUnavailable?: () => void;
}) {
    const { resolveImageUrl } = useSDK();
    const [failed, setFailed] = useState<string[]>([]);
    const selected = !failed.includes(src) ? src : fallback && !failed.includes(fallback) ? fallback : null;
    return selected ? <img src={resolveImageUrl(selected)} alt="" className={className} onError={() => {
        setFailed(previous => [...previous, selected]);
        if (!fallback || selected === fallback) onUnavailable?.();
    }} /> : null;
}
