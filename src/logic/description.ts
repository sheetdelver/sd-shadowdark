import { processHtmlContent } from '@sheet-delver/sdk';
import { canonicalUuid } from './identity';

/**
 * The single description presentation path. Source HTML is never rewritten:
 * this returns display HTML only. Foundry enrichers handled here are
 * `@UUID[...]{Label}` (typed reference link), `[[/r formula]]` / `[[/roll formula]]`
 * (roll button) and Shadowdark `[[check DC stat]]` (check button). The result is
 * always passed through the SDK sanitizer.
 */
const escapeAttribute = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function descriptionSource(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && typeof (value as { value?: unknown }).value === 'string') return (value as { value: string }).value;
    return '';
}

export function enrichDescription(raw: unknown): string {
    let html = descriptionSource(raw);
    html = html.replace(/@UUID\[([^\]]+)\](?:\{([^}]*)\})?/g, (_match, uuid: string, label?: string) => {
        const canonical = canonicalUuid(uuid);
        const text = escapeText(label || 'Linked document');
        return canonical
            ? `<a class="content-link" data-link="true" data-uuid="${escapeAttribute(canonical)}">${text}</a>`
            : `<span class="content-link unresolved" title="Unsupported reference">${text}</span>`;
    });
    html = html.replace(/\[\[(.*?)\]\]/g, (match, content: string) => {
        const clean = content.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
        const check = /^check\s+(\d+)\s+(str|dex|con|int|wis|cha)$/i.exec(clean);
        if (check) {
            return `<button type="button" data-action="roll-check" data-dc="${check[1]}" data-stat="${check[2].toLowerCase()}">check ${check[2].toUpperCase()} (DC ${check[1]})</button>`;
        }
        const roll = /^\/(?:r|roll)\s+(.+)$/i.exec(clean);
        if (roll) {
            const formula = roll[1].trim();
            return `<button type="button" data-action="roll-formula" data-formula="${escapeAttribute(formula)}">roll ${escapeText(formula)}</button>`;
        }
        return match;
    });
    return html;
}

/** Sanitized display HTML for a description string or `{ value }` object. */
export function presentDescription(raw: unknown, baseUrl?: string): string {
    return String(processHtmlContent(enrichDescription(raw), baseUrl));
}

/** Informational reference cards keep labels/formulas, never inline controls.
 * Sanitize first, then turn links/buttons into text containers (also covers
 * source-authored controls rather than just generated Foundry enrichers). */
export function presentReferenceDescription(raw: unknown, baseUrl?: string): string {
    return presentDescription(raw, baseUrl)
        .replace(/<(a|button)\b[^>]*>/gi, '<span>')
        .replace(/<\/(a|button)>/gi, '</span>')
        .replace(/<(?:input|select|textarea|form)\b[^>]*>[\s\S]*?<\/(?:select|textarea|form)>/gi, '')
        .replace(/<(?:input|form)\b[^>]*\/?>/gi, '');
}
