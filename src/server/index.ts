import { json, error, type ModuleServerRequest, type ModuleServerParams } from '@sheet-delver/sdk/server';
import { handleImport } from './api/import';
import { handleGetLevelUpData, handleRollHP, handleRollGold, handleFinalizeLevelUp, handleRollTalent, handleRollBoon } from "./api/level-up";
import { handleLearnSpell, handleGetSpellsBySource } from './api/spells';
import { handleGetDocument } from './api/document';
import { handleEffects } from './api/effects';
import { handleActorAction } from './api/actions';
import { handleActorView } from './api/actor-view';
import { handleLuck } from './api/luck';
import { handleBestiaryCard, handleBestiaryList } from './api/bestiary';
import { getErrorMessage, isSdkError } from '@sheet-delver/sdk';
import { handleGetCollection } from './api/collections';
import { handleIndex } from './api/index';
import { handleGetCustomMaps } from './api/custom-maps';
import { handleGetNotes, handleUpdateNotes } from './api/notes';
import {
    handleRandomizeCharacter,
    handleRandomizeName,
    handleRandomizeStats
} from './api/randomize-character';

const actorIdFrom = async (params: ModuleServerParams['params']) => (await params).route[1];

/** Effect routes report structured SDK errors instead of a generic 500. */
async function effectRoute(run: () => Promise<unknown>) {
    try {
        return json(await run());
    } catch (e) {
        if (isSdkError(e)) return error(e.code, e.message);
        return error('internal', getErrorMessage(e));
    }
}

export const apiRoutes = {
    'index': handleIndex,
    'custom-maps': handleGetCustomMaps,
    'import': handleImport,
    // Available fetch-pack IDs:
    // ancestries, backgrounds, classes, deities, patrons, spells,
    // talents, languages, gear, magic-items, conditions, spell-effects
    'fetch-pack/[id]': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        const packId = (await params).route[1];
        return handleGetCollection(req, packId);
    },
    'document/[uuid]': handleGetDocument,
    // Full-character randomizer (the Generator's "randomize all"); per-field randomize
    // logic lives in the getRandom* helpers that handleRandomizeCharacter composes.
    'actors/randomize': handleRandomizeCharacter,
    'actors/randomize/name': handleRandomizeName,
    'actors/randomize/stats': handleRandomizeStats,
    'actors/[id]/level-up/data': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleGetLevelUpData(await actorIdFrom(params), req);
    },
    'actors/[id]/effects': async (req: ModuleServerRequest, { params }: ModuleServerParams) =>
        effectRoute(async () => handleEffects(await actorIdFrom(params), req.runtime, 'list')),
    'actors/[id]/effects/choices': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        const url = new URL(req.url, 'http://localhost');
        return effectRoute(async () => handleEffects(await actorIdFrom(params), req.runtime, 'choices', { key: url.searchParams.get('key') }));
    },
    'actors/[id]/effects/create': async (req: ModuleServerRequest, { params }: ModuleServerParams) =>
        effectRoute(async () => ({ success: true, result: await handleEffects(await actorIdFrom(params), req.runtime, 'create', await req.json()) })),
    'actors/[id]/effects/update': async (req: ModuleServerRequest, { params }: ModuleServerParams) =>
        effectRoute(async () => ({ success: true, result: await handleEffects(await actorIdFrom(params), req.runtime, 'update', await req.json()) })),
    'actors/[id]/effects/toggle': async (req: ModuleServerRequest, { params }: ModuleServerParams) =>
        effectRoute(async () => ({ success: true, result: await handleEffects(await actorIdFrom(params), req.runtime, 'toggle', await req.json()) })),
    'actors/[id]/effects/delete': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        const url = new URL(req.url, 'http://localhost');
        return effectRoute(async () => ({ success: true, result: await handleEffects(await actorIdFrom(params), req.runtime, 'delete', { ref: url.searchParams.get('ref') }) }));
    },
    'actors/[id]/view': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleActorView(await actorIdFrom(params), req);
    },
    'actors/[id]/actions': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleActorAction(await actorIdFrom(params), req);
    },
    'actors/[id]/luck': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleLuck(await actorIdFrom(params), req);
    },
    'bestiary': handleBestiaryList,
    'bestiary/[uuid]': handleBestiaryCard,
    'actors/[id]/notes': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        const actorId = await actorIdFrom(params);
        if (req.method === 'GET') {
            return json(await handleGetNotes(actorId, req));
        } else if (req.method === 'POST') {
            return json(await handleUpdateNotes(actorId, req));
        }
        return json({ error: 'Method not allowed' }, { status: 405 });
    },
    'actors/[id]/level-up/roll-hp': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleRollHP(await actorIdFrom(params), req);
    },
    'actors/[id]/level-up/roll-gold': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleRollGold(await actorIdFrom(params), req);
    },
    'actors/[id]/level-up/finalize': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleFinalizeLevelUp(await actorIdFrom(params), req);
    },
    'actors/[id]/level-up/roll-talent': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleRollTalent(await actorIdFrom(params), req);
    },
    'actors/[id]/level-up/roll-boon': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleRollBoon(await actorIdFrom(params), req);
    },
    'actors/[id]/spells/learn': async (req: ModuleServerRequest, { params }: ModuleServerParams) => {
        return handleLearnSpell(await actorIdFrom(params), req);
    },
    'spells/list': async (req: ModuleServerRequest) => {
        return handleGetSpellsBySource(req);
    }
};
