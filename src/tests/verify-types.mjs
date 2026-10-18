/** Explicit module/UI/migration typing; Core's root config excludes module data.
 * Run from the pinned Core checkout: node <module>/src/tests/verify-types.mjs
 * SHADOWDARK_CORE optionally selects another configured, read-only toolchain.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const core = path.resolve(process.env.SHADOWDARK_CORE ?? process.cwd());
const moduleRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'shadowdark-types-'));
try {
    const config = path.join(temp, 'tsconfig.json');
    fs.writeFileSync(config, JSON.stringify({ extends: path.join(core, 'tsconfig.json'),
        compilerOptions: { incremental: false, noEmit: true, typeRoots: [path.join(core, 'node_modules/@types')] },
        // Use Next's public declarations directly; clean toolchain archives do
        // not have Next's generated next-env.d.ts until a server/build runs.
        include: ['src/**/*.ts', 'src/**/*.tsx', 'module/**/*.ts', 'module/**/*.tsx', 'migrations/**/*.ts'].map(p => path.join(moduleRoot, p)).concat(path.join(core, 'node_modules/next/index.d.ts')), exclude: [] }));
    const result = spawnSync(process.execPath, [path.join(core, 'node_modules/typescript/bin/tsc'), '-p', config], { cwd: core, stdio: 'inherit' });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
