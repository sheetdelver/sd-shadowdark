import type { MigrationCheckHook } from '@sheet-delver/sdk';
import { analyze } from './effect-keys';

/** current / migration-needed / unresolved for one ActiveEffect target. */
const check: MigrationCheckHook = input => {
    const result = analyze(input);
    return result.status === 'migration-needed' ? { status: 'migration-needed' } : result;
};
export default check;
