import { SPELL_CLASSES, grantSource } from './spell-grants';
import { parseUuid, type DocumentRef } from './identity';

export interface SpellMishap {
    label: string;
    table: DocumentRef | null;
}

/** Exact native 4.0.6 Class/Talent identities. Missing tables are never replaced. */
export function spellMishap(classUuid: string | null, tier: number | null, itemOverride: boolean, items: any[]): SpellMishap | undefined {
    const dabbler = itemOverride && items.some(item => grantSource(item) === 'Compendium.shadowdark.talents.Item.Om7QWre7U4Tbh84B');
    if (classUuid === SPELL_CLASSES.wizard || dabbler) {
        const id = tier === 1 || tier === 2 ? 'NiiJKAiBjpPAj5U1'
            : tier === 3 || tier === 4 ? 'tXhX6Iv3rOc6GlF6' : tier === 5 ? 'q83PUKIAznuLpqSr' : null;
        return { label: 'Wizard mishap', table: id ? parseUuid(`Compendium.shadowdark.rollable-tables.RollTable.${id}`) : null };
    }
    if (classUuid === SPELL_CLASSES.witch) return { label: 'Diabolical mishap', table: null };
    return undefined;
}
