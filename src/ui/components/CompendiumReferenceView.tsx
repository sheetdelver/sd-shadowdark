'use client';
import React from 'react';
import { CardBody, CardNotes } from './ResourceCardBody';
import type { ResourceCard } from '../../logic/resource-cards';

/** Content only. Core supplies the dialog, focus and caller/source lifecycle. */
export default function CompendiumReferenceView({ model }: { model: unknown }) {
    const card = model as ResourceCard;
    return <><CardBody card={card} informational />
        <div className="sd-reference-notes border-t-2 border-black p-3 space-y-2"><CardNotes card={card} /></div>
    </>;
}
