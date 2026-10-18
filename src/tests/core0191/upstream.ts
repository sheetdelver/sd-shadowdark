/**
 * Controlled Foundry upstream for the isolated Core 0.19.1 harness (ADR-0001).
 * Modeled on Core's own supervised acceptance upstream (socket.io + /join),
 * with a generic in-memory document store: world documents, embedded children
 * (Item/ActiveEffect, Token ActorDelta), world and system packs, Settings,
 * Users and ChatMessages. Writes from one socket are broadcast to the others,
 * as Foundry does. This is not Foundry: it applies updates literally, without
 * Foundry's schema cleaning, so source oracles compare exactly what was sent.
 */
import http from 'node:http';
import express from 'express';
import { Server, type Socket } from 'socket.io';
import type { Doc } from './world';

export interface WorldState {
    game: Doc;
    users: Doc[];
    actors: Doc[];
    items: Doc[];
    scenes: Doc[];
    settings: Doc[];
    chat: Doc[];
    packs: Record<string, Doc[]>;
    packMetadata: Doc[];
}

export interface WriteRecord { socketUser: string; type: string; action: string; uuid: string; fields: string[]; at: number }

function setPath(target: Doc, field: string, value: unknown) {
    const parts = field.split('.');
    let cursor = target;
    for (const part of parts.slice(0, -1)) cursor = (cursor[part] ??= {});
    cursor[parts.at(-1)!] = structuredClone(value);
}
function merge(target: Doc, update: Doc) {
    for (const [key, value] of Object.entries(update)) {
        if (key === '_id') continue;
        if (key.includes('.')) { setPath(target, key, value); continue; }
        if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) merge(target[key], value as Doc);
        else target[key] = structuredClone(value);
    }
}

const HOLD = Symbol('held receipt');

export class ControlledUpstream {
    readonly app = express();
    readonly wire = http.createServer(this.app);
    readonly io = new Server(this.wire, { maxHttpBufferSize: 64 * 1024 * 1024 });
    port = 0;
    unavailable = false;
    writes: WriteRecord[] = [];
    reads = 0;
    wireBytes = 0;
    unknownEvents = new Map<string, number>();
    /** Controlled upstream refusal, for the unreadable required-pack regression. */
    deniedPacks = new Set<string>();
    /** Optional hook: fail an update after it was applied (lost receipt). */
    failAfterWrite?: (record: WriteRecord) => string | null;
    /** Withhold the receipt of the first service ActiveEffect batch that reaches this many migration writes. */
    holdAckAfter?: number;
    held = false;

    constructor(public state: WorldState) {
        this.app.use(express.json());
        this.app.get('/api/status', (_req, res) => this.unavailable ? res.status(503).end()
            : res.json({ active: true, world: state.game.world.id, system: state.game.system.id, version: state.game.release.generation === 13 ? '13.351' : '14.367' }));
        this.app.post('/join', (req, res) => {
            const id = req.body?.userId ?? req.body?.userid ?? state.users.find(row => row.name === req.body?.username)?._id ?? 'service';
            res.cookie('session', id); res.json({ success: true });
        });
        this.io.on('connection', socket => this.connect(socket));
    }

    async listen() {
        await new Promise<void>(resolve => this.wire.listen(0, '127.0.0.1', resolve));
        this.port = (this.wire.address() as { port: number }).port;
    }
    async close() { this.io.close(); await new Promise<void>(resolve => this.wire.close(() => resolve())); }
    disconnectAll() { for (const socket of this.io.sockets.sockets.values()) socket.disconnect(true); }
    userSockets() { return [...this.io.sockets.sockets.values()].filter(socket => socket.data.userId !== 'service'); }
    broadcast(payload: Doc, except?: Socket) {
        for (const socket of this.io.sockets.sockets.values()) if (socket !== except) socket.emit('modifyDocument', payload);
    }
    /** An external (Foundry-side) change, broadcast to every connected client. */
    externalUpdate(type: string, updates: Doc[], operation: Doc = {}) {
        const rows = this.collection(type, operation);
        const result = updates.map(update => { const row = rows.find(entry => entry._id === update._id)!; merge(row, update); return structuredClone(row); });
        this.broadcast({ type, action: 'update', operation: { ...operation, updates }, result, userId: 'human' });
    }
    migrationWrites() { return this.writes.filter(row => row.socketUser === 'service' && row.action === 'update'); }
    /** An external (Foundry-side) deletion of embedded or root documents. */
    externalDelete(type: string, ids: string[], operation: Doc = {}) {
        const rows = this.collection(type, operation);
        for (const id of ids) { const index = rows.findIndex(row => row._id === id); if (index >= 0) rows.splice(index, 1); }
        this.broadcast({ type, action: 'delete', operation: { ...operation, ids }, result: ids, userId: 'human' });
    }
    /** An external (Foundry-side) creation, e.g. an item added in Foundry. */
    externalCreate(type: string, data: Doc[], operation: Doc = {}) {
        const rows = this.collection(type, operation);
        rows.push(...structuredClone(data));
        this.broadcast({ type, action: 'create', operation: { ...operation, data }, result: structuredClone(data), userId: 'human' });
    }
    setSetting(key: string, value: unknown) {
        const row = this.state.settings.find(entry => entry.key === key);
        if (row) this.externalUpdate('Setting', [{ _id: row._id, value: JSON.stringify(value) }]);
        else {
            const created = { _id: `set${this.state.settings.length}${Date.now() % 1000}`, key, value: JSON.stringify(value) };
            this.state.settings.push(created);
            this.broadcast({ type: 'Setting', action: 'create', operation: { data: [created] }, result: [structuredClone(created)], userId: 'human' });
        }
    }

    private connect(socket: Socket) {
        socket.data.userId = socket.handshake.auth?.session ?? socket.handshake.query.session ?? 'service';
        socket.emit('session', { userId: socket.data.userId });
        socket.on('getJoinData', ack => ack?.(this.join()));
        socket.on('world', ack => ack?.(this.join()));
        socket.on('getWorldStatus', ack => ack?.(true));
        socket.on('modifyDocument', (request, ack) => {
            try { const response = this.modify(socket, request); if (response !== HOLD) ack?.(response); }
            catch (error) { ack?.({ error: { message: (error as Error).message } }); }
        });
        socket.onAny((event: string) => {
            if (!['getJoinData', 'world', 'getWorldStatus', 'modifyDocument'].includes(event)) this.unknownEvents.set(event, (this.unknownEvents.get(event) ?? 0) + 1);
        });
    }
    private join() {
        return { ...this.state.game, users: this.state.users, scenes: this.state.scenes, packs: this.state.packMetadata, activeUsers: [] };
    }
    /** Root rows for a type, or the embedded rows below `operation.parentUuid`. */
    collection(type: string, operation: Doc): Doc[] {
        const roots = (name: string): Doc[] => operation.pack ? (this.state.packs[operation.pack] ??= [])
            : name === 'Actor' ? this.state.actors : name === 'Item' ? this.state.items : name === 'Scene' ? this.state.scenes
            : name === 'User' ? this.state.users : name === 'Setting' ? this.state.settings : name === 'ChatMessage' ? this.state.chat : [];
        if (!operation.parentUuid) return roots(type);
        const parts = String(operation.parentUuid).split('.');
        let offset = parts[0] === 'Compendium' ? 3 : 0;
        const rootType = parts[offset++]; const rootId = parts[offset++];
        let parent: Doc | undefined = roots(rootType).find(row => row._id === rootId);
        while (parent && offset < parts.length) {
            const kind = parts[offset++]; const id = parts[offset++];
            parent = kind === 'ActorDelta' ? parent.delta ?? undefined
                : (parent[kind === 'Item' ? 'items' : kind === 'Token' ? 'tokens' : 'effects'] ?? []).find((row: Doc) => row._id === id);
        }
        if (!parent) throw new Error(`Unknown parent ${operation.parentUuid}`);
        if (type === 'ActorDelta') return [parent.delta];
        const field = type === 'Item' ? 'items' : type === 'ActiveEffect' ? 'effects' : type === 'Token' ? 'tokens' : null;
        if (!field) throw new Error(`Unsupported embedded ${type}`);
        return (parent[field] ??= []);
    }
    private modify(socket: Socket, request: Doc) {
        const { type, action, operation = {} } = request;
        const user = String(socket.data.userId);
        let rows = this.collection(type, operation);
        const prefix = operation.parentUuid ? `${operation.parentUuid}.` : operation.pack ? `Compendium.${operation.pack}.` : '';
        if (action === 'get') {
            if (this.deniedPacks.has(operation.pack)) throw new Error(`Permission denied reading ${operation.pack}; restore service-account access before retrying.`);
            this.reads++;
            if (operation.query?._id__in) rows = rows.filter(row => operation.query._id__in.includes(row._id));
            else if (operation.query?._id) rows = rows.filter(row => row._id === operation.query._id);
            const response = { type, action, operation, result: structuredClone(rows) };
            this.wireBytes += Buffer.byteLength(JSON.stringify(response));
            return response;
        }
        if (action === 'update') {
            const result: Doc[] = [];
            let failure: string | null = null;
            for (const update of operation.updates ?? []) {
                const target = rows.find(row => row._id === update._id);
                if (!target) throw new Error(`Unknown ${type} ${update._id}`);
                merge(target, update);
                result.push(structuredClone(target));
                const record = { socketUser: user, type, action, uuid: `${prefix}${type === 'ActorDelta' ? 'ActorDelta' : type}.${update._id}`,
                    fields: Object.keys(update).filter(key => key !== '_id'), at: Date.now() };
                this.writes.push(record);
                failure ??= this.failAfterWrite?.(record) ?? null;
            }
            const response = { type, action, operation, result, userId: user };
            this.broadcast(response, socket);
            if (failure) return { error: { message: failure } };
            if (this.holdAckAfter !== undefined && !this.held && user === 'service' && type === 'ActiveEffect' && this.migrationWrites().length >= this.holdAckAfter) {
                this.held = true;
                return HOLD;
            }
            return response;
        }
        if (action === 'create') {
            const created = (operation.data ?? []).map((data: Doc) => ({ _id: data._id ?? `${type.toLowerCase()}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, ...data }));
            rows.push(...created.map((row: Doc) => structuredClone(row)));
            for (const row of created) this.writes.push({ socketUser: user, type, action, uuid: `${prefix}${type}.${row._id}`, fields: Object.keys(row), at: Date.now() });
            const response = { type, action, operation, result: created, userId: user };
            this.broadcast(response, socket);
            return response;
        }
        if (action === 'delete') {
            const ids: string[] = operation.ids ?? [];
            for (const id of ids) { const index = rows.findIndex(row => row._id === id); if (index >= 0) rows.splice(index, 1); }
            for (const id of ids) this.writes.push({ socketUser: user, type, action, uuid: `${prefix}${type}.${id}`, fields: [], at: Date.now() });
            const response = { type, action, operation, result: ids, userId: user };
            this.broadcast(response, socket);
            return response;
        }
        throw new Error(`Unsupported action ${action}`);
    }
}
