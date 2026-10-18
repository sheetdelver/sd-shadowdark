import type { MigrationVerifyHook } from '@sheet-delver/sdk';
import { analyze } from './effect-keys';

/** Valid when no in-scope pre-4.0 key with a native replacement remains. */
const verify: MigrationVerifyHook = input => {
    const result = analyze(input);
    if (result.status === 'current') return { valid: true };
    return { valid: false, reason: result.status === 'unresolved' ? result.reason : 'Pre-4.0 effect keys remain.' };
};
export default verify;
