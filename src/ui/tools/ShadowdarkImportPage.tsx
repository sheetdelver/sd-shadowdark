'use client';

import React from 'react';
import { useSDK } from '@sheet-delver/sdk/react';
import ShadowdarkImportForm from '../components/ShadowdarkImportForm';

export default function ShadowdarkImportPage() {
    const { navigate } = useSDK();

    return <ShadowdarkImportForm
        onCancel={() => navigate('/')}
        onImportSuccess={id => navigate(`/actors/${encodeURIComponent(id)}`)}
    />;
}
