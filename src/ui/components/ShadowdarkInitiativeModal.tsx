import React from 'react';
import { useSDKComponents } from '@sheet-delver/sdk/react';
import type { InitiativeRollModalProps } from '@sheet-delver/sdk/react';
import { shadowdarkTheme } from '../themes/shadowdark';

export default function ShadowdarkInitiativeModal(props: InitiativeRollModalProps) {
    const { RollDialog } = useSDKComponents();
    return (
        <RollDialog
            {...props}
            theme={shadowdarkTheme.rollDialog}
        />
    );
}
