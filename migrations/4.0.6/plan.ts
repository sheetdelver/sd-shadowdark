import type { MigrationPlanHook } from '@sheet-delver/sdk';
import { analyze } from './effect-keys';

/** The effect's full `changes` / `system.changes` replacement, in its stored shape. */
const plan: MigrationPlanHook = input => {
    const result = analyze(input);
    if (result.status === 'migration-needed') return { status: 'patch', updates: result.updates };
    if (result.status === 'unresolved') return { status: 'unresolved', reason: result.reason };
    return { status: 'no-op' };
};
export default plan;
