'use client';

import type { ModuleDashboardDialogProps } from '@sheet-delver/sdk';
import { useSDK } from '@sheet-delver/sdk/react';
import ShadowdarkImportModal from './ShadowdarkImportModal';

export default function ShadowdarkImportDashboardDialog({ onClose }: ModuleDashboardDialogProps) {
    const { navigate } = useSDK();

    return <ShadowdarkImportModal
        onClose={onClose}
        onImportSuccess={id => {
            onClose();
            navigate(`/actors/${encodeURIComponent(id)}`);
        }}
    />;
}
