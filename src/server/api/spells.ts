import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { getErrorMessage, logger } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../../server/ShadowdarkAdapter';

/**
 * POST /api/modules/shadowdark/actors/[id]/spells/learn
 * Learn a spell by UUID or ID.
 */
export async function handleLearnSpell(actorId: string, req: ModuleServerRequest) {
    try {
        const { spellUuid } = await req.json<{ spellUuid?: string }>();

        if (!spellUuid) {
            return error('validation', 'Spell UUID is required');
        }

        // 1. Fetch Spell Data (unified resolver, runtime-backed)
        const spellData = await shadowdarkAdapter.resolveDocument(spellUuid);

        if (!spellData) {
            return error('not_found', 'Spell not found');
        }

        // 2. Create the spell Item on the actor via the document store.
        const creationData = {
            name: spellData.name,
            type: 'Spell',
            img: spellData.img,
            system: spellData.system,
            flags: {
                core: { sourceId: spellUuid } // Link back to source
            }
        };

        const result = await req.runtime.documents.items.create({ type: 'Actor', id: actorId }, creationData);

        return json({ success: true, data: result });

    } catch (e: unknown) {
        logger.error('[API] Learn Spell Error:', e);
        return error('internal', getErrorMessage(e) || 'Failed to learn spell');
    }
}

/**
 * GET /api/modules/shadowdark/spells/list?source=...
 * Fetch spells filtered by class source (e.g. "Wizard"): declared-compendium spells plus any
 * custom world spells.
 */
export async function handleGetSpellsBySource(req: ModuleServerRequest) {
    try {
        const { searchParams } = new URL(req.url, 'http://localhost');
        const source = searchParams.get('source'); // e.g. "Wizard", "Priest"

        if (!source) {
            return error('validation', 'Source parameter is required (e.g. Wizard)');
        }

        const normalizedSource = source.toLowerCase();

        const checkClassMatch = (spellClasses: any) => {
            const classes = Array.isArray(spellClasses) ? spellClasses : [spellClasses].filter(Boolean);
            return classes.some((c: any) => {
                const cStr = String(c).toLowerCase();
                if (cStr === normalizedSource) return true;
                // UUID match (heuristic)
                if (cStr.includes(`.${normalizedSource}.`) || cStr.includes(`/${normalizedSource}/`)) return true;
                return false;
            });
        };

        // 1. Declared-compendium spells (offline, identity-stamped).
        const localSpells = await shadowdarkAdapter.getSpellsBySource(source);

        // 2. Custom world spells (the declared compendium is already covered above, so we only
        //    pull world Item spells here via the document store).
        const remoteSpells: any[] = [];
        try {
            const worldItems = await req.runtime.documents.list('Item', { filter: { type: 'Spell' } });
            for (const s of (worldItems.rows as any[])) {
                if (s.type !== 'Spell') continue;
                if (checkClassMatch(s.system?.class)) {
                    remoteSpells.push({
                        name: s.name,
                        uuid: s.uuid || `Item.${s._id}`,
                        img: s.img,
                        tier: s.system?.tier || 0,
                        system: s.system,
                        source: 'world'
                    });
                }
            }
        } catch (err) {
            logger.warn('[API] Failed to fetch world spells:', err);
        }

        // 3. Merge and de-duplicate by Name + Tier (local wins).
        const spellMap = new Map<string, any>();

        const addToMap = (spells: any[]) => {
            for (const s of spells) {
                const key = `${s.name}-${s.tier || 0}`;
                if (!spellMap.has(key)) {
                    spellMap.set(key, {
                        ...s,
                        uuid: s.uuid || s._id,
                        tier: s.tier || s.system?.tier || 0,
                        img: s.img,
                        classes: [source]
                    });
                }
            }
        };

        addToMap(localSpells);
        addToMap(remoteSpells);

        const merged = Array.from(spellMap.values()).sort((a, b) => {
            if (a.tier !== b.tier) return a.tier - b.tier;
            return a.name.localeCompare(b.name);
        });

        return json({ success: true, spells: merged });

    } catch (e: unknown) {
        logger.error('[API] Fetch Spells Error:', e);
        return error('internal', getErrorMessage(e));
    }
}
