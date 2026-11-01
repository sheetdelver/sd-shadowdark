import type { ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, parseRollResult } from '@sheet-delver/sdk';
import type { SpellMishap } from '../logic/spell-mishaps';
import { formatUuid } from '../logic/identity';
import { presentReferenceDescription } from '../logic/description';
import { shadowdarkAdapter } from './ShadowdarkAdapter';
import { callerOf } from './access';

export interface MishapReceipt {
    rule: SpellMishap;
    status: 'pending' | 'started' | 'complete' | 'unavailable' | 'uncertain';
    total?: number;
    description?: string;
}

/** One follow-up roll, after the casting result and its inventory consequences.
 * Persist before dispatch; a lost roll/chat response never authorizes a reroll.
 * Table text is informational: damage, follow-up instructions and repairs remain
 * for the player/GM to adjudicate, not arbitrary document writes.
 */
export async function rollSpellMishap(receipt: MishapReceipt, req: ModuleServerRequest,
    speaker: Record<string, unknown>, rollMode: string | undefined, warnings: string[], dependencies: string[], save: () => Promise<void>) {
    if (receipt.status === 'started') {
        receipt.status = 'uncertain';
        warnings.push(`${receipt.rule.label} has no confirmed completion. Check chat and resolve it with the GM; it will not be rolled again.`);
        await save(); return;
    }
    if (receipt.status !== 'pending') return;
    const uuid = receipt.rule.table ? formatUuid(receipt.rule.table) : null;
    let table: any;
    try {
        table = uuid ? await shadowdarkAdapter.resolveDocumentFor(uuid, callerOf(req)) : null;
        if (!table || typeof table.formula !== 'string' || !table.formula.trim()
            || !Array.isArray(table.results) || !table.results.length) throw new Error('The correct table is unavailable or not readable.');
    } catch (e) {
        receipt.status = 'unavailable';
        warnings.push(`${receipt.rule.label} required. ${getErrorMessage(e)} Resolve it with the GM; the casting result will not be repeated.`);
        await save(); return;
    }
    if (uuid && !dependencies.includes(uuid)) dependencies.push(uuid);
    receipt.status = 'started'; await save();
    try {
        const raw = await req.runtime.rolls.roll(table.formula, receipt.rule.label, { displayChat: true, rollMode: rollMode as any, speaker });
        const roll = parseRollResult(raw, table.formula);
        if (!Number.isFinite(roll.total)) throw new Error('No confirmed mishap total was returned.');
        receipt.total = roll.total;
        const matched = table.results.filter((row: any) => Array.isArray(row.range) && roll.total >= row.range[0] && roll.total <= row.range[1]);
        // Native Wizard tables include document links alongside their text on
        // result 1. Display the text's explicit instructions; do not recursively
        // follow links or infer/mutate a character from arbitrary table prose.
        receipt.description = matched.map((row: any) => presentReferenceDescription(row.description || row.text || row.name || '', req.runtime.foundryUrl)).filter(Boolean).join('<br>');
        if (!receipt.description) throw new Error('The rolled table result has no readable description.');
        receipt.status = 'complete'; await save();
        try {
            await req.runtime.chat.send({ content: `<p><strong>${receipt.rule.label}</strong> (${roll.total})</p>${receipt.description}`, speaker }, { rollMode: rollMode as any, speaker });
        } catch (e) {
            warnings.push(`Mishap rolled ${roll.total}, but its result text could not be posted: ${getErrorMessage(e)}. It will not be rolled again.`);
        }
    } catch (e) {
        receipt.status = 'uncertain';
        warnings.push(`${receipt.rule.label} needs review: ${getErrorMessage(e)}. Check chat before resolving it manually; this request will not roll again.`);
    }
    await save();
}
