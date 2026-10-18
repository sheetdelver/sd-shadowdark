/**
 * Isolated real Core process control for the ADR-0001 Core 0.19.1 harness.
 * Mirrors Core's own supervised acceptance setup: a copied Core workspace
 * (node_modules symlinked), an isolated data directory, the real manager
 * (`start-server.ts dev`) and a controlled upstream. Never uses the user's
 * root settings, data directory or any live Foundry.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn, type ChildProcess } from 'node:child_process';

export const CORE = path.resolve(process.env.SHADOWDARK_CORE ?? process.cwd());

export async function unusedPort() {
    const server = http.createServer();
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    await new Promise<void>(resolve => server.close(() => resolve()));
    return port;
}

export function prepareWorkspace(root: string) {
    const workspace = path.join(root, 'workspace');
    fs.mkdirSync(workspace, { recursive: true });
    for (const file of ['src', 'public', 'patches', 'package.json', 'package-lock.json', 'tsconfig.json', 'next.config.ts', 'postcss.config.cjs']) {
        fs.cpSync(path.join(CORE, file), path.join(workspace, file), { recursive: true });
    }
    fs.symlinkSync(path.join(CORE, 'node_modules'), path.join(workspace, 'node_modules'), 'dir');
    fs.mkdirSync(path.join(workspace, '.managed'));
    fs.copyFileSync(path.join(CORE, '.managed/tsconfig.paths.json'), path.join(workspace, '.managed/tsconfig.paths.json'));
    return workspace;
}

export function isolatedEnv(data: string): NodeJS.ProcessEnv {
    return { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(APP_|FOUNDRY_|SHEET_DELVER_|DATA_DIR$|USER_DATA$)/.test(key))),
        NODE_ENV: 'development', NPM_CONFIG_OFFLINE: 'true', NEXT_TELEMETRY_DISABLED: '1', SHEET_DELVER_DATA: data };
}

export class Manager {
    process: ChildProcess;
    log: number;
    constructor(readonly workspace: string, readonly data: string, readonly logFile: string) {
        this.log = fs.openSync(logFile, 'a');
        this.process = spawn(process.execPath, ['--import', 'tsx', 'src/scripts/start-server.ts', 'dev', `--data-dir=${data}`],
            { cwd: workspace, env: isolatedEnv(data), stdio: ['ignore', this.log, this.log], detached: true });
    }
    text() { return fs.readFileSync(this.logFile, 'utf8'); }
    corePids() { return [...this.text().matchAll(/Core Service \| Started \(pid=(\d+)/g)].map(row => Number(row[1])); }
    count(pattern: RegExp) { return [...this.text().matchAll(new RegExp(pattern.source, 'g'))].length; }
    private stopped = false;
    async stop() {
        if (this.stopped) return;
        this.stopped = true;
        if (this.process.exitCode === null) {
            try { process.kill(-this.process.pid!, 'SIGTERM'); } catch { /* already gone */ }
            await Promise.race([new Promise(resolve => this.process.once('close', resolve)), new Promise(resolve => setTimeout(resolve, 20_000))]);
            if (this.process.exitCode === null) try { process.kill(-this.process.pid!, 'SIGKILL'); } catch { /* gone */ }
        }
        fs.closeSync(this.log);
    }
}

/** Resource sampling of the newest Core process (rss/peak/cpu/io). */
export function sampler(manager: Manager, startedAt: number) {
    const samples: Array<Record<string, number>> = [];
    const timer = setInterval(() => {
        const pid = manager.corePids().at(-1); if (!pid) return;
        try {
            const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
            const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ').at(-1)!.split(' ');
            samples.push({ atMs: Date.now() - startedAt, pid, rssKiB: Number(status.match(/VmRSS:\s+(\d+)/)?.[1]),
                peakRssKiB: Number(status.match(/VmHWM:\s+(\d+)/)?.[1]), cpuTicks: Number(stat[11]) + Number(stat[12]) });
        } catch { /* replaced process */ }
    }, 500);
    return { samples, stop: () => clearInterval(timer) };
}

export class Http {
    cookie = ''; csrf = '';
    constructor(readonly api: string, readonly origin: string) {}
    async request(url: string, body?: unknown, headers: Record<string, string> = {}, method?: string, timeout = 30_000) {
        return fetch(`${this.api}${url}`, { method: method ?? (body === undefined ? 'GET' : 'POST'), signal: AbortSignal.timeout(timeout),
            headers: { Origin: this.origin, 'Content-Type': 'application/json', Cookie: this.cookie, 'X-Admin-Csrf-Token': this.csrf, ...headers },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    }
    async adminLogin(password: string) {
        const login = await this.request('/admin/auth/login', { password });
        if (login.status !== 200) throw new Error(`admin login ${login.status}`);
        this.cookie = login.headers.getSetCookie()[0].split(';')[0]; this.csrf = (await login.json()).csrfToken;
    }
}

export async function until<T>(label: string, operation: () => Promise<T | false>, manager: Manager, timeout = 300_000): Promise<T> {
    const end = Date.now() + timeout;
    let last: unknown;
    while (Date.now() < end) {
        try { const result = await operation(); if (result !== false) return result; } catch (error) { last = error; }
        if (manager.process.exitCode !== null) throw new Error(`Manager exited: ${manager.process.exitCode}`);
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw new Error(`Timed out: ${label}; last error ${last instanceof Error ? last.message : String(last)}; inspect ${manager.logFile}`);
}

/** A user session against Core's public login (controlled upstream accepts the name). */
export async function userSession(api: string, origin: string, username: string) {
    const response = await fetch(`${api}/api/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    if (response.status !== 200) throw new Error(`login ${username}: ${response.status} ${await response.text()}`);
    const cookie = response.headers.getSetCookie()[0].split(';')[0];
    const get = (url: string, headers: Record<string, string> = {}) => fetch(`${api}${url}`, { headers: { Cookie: cookie, Origin: origin, ...headers } });
    // Browser mutations carry the serving runtime token (Core rotates it on activation).
    const runtime = async () => String((await (await fetch(`${api}/api/status`)).json()).runtimeToken ?? '');
    const post = async (url: string, body: unknown, headers: Record<string, string> = {}, method = 'POST') => fetch(`${api}${url}`, { method,
        headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-SheetDelver-Runtime': await runtime(), ...headers }, body: JSON.stringify(body) });
    return { cookie, get, post };
}
