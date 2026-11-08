/** Stable operation IDs also work on local HTTP hosts without randomUUID. */
export const newRequestId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
