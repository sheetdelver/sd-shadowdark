import { createHash } from 'node:crypto';
import { creationGrantReview } from '../../logic/creation-grants';
import { prepareCharacterCreation } from './level-up';
import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { isSdkError, getErrorMessage, SdkError } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { callerOf, requestRevision, contextConflict, requireOwnedActor } from '../access';
import { callerLanguagePlan } from '../languages';
import { canonicalUuid } from '../../logic/identity';
import { prepareShadowdarkView } from '../../logic/prepared-view';
import { requestRules } from '../access';
import { validateLanguageSelections, validateLanguageInventory, languageEditingPlan } from '../../logic/languages';
import { spellReview } from '../../logic/spell-review';
import { withActorLock } from '../operation-lock';

export async function resolveLanguageIdentity(uuid: unknown, type: 'Class' | 'Ancestry', req: ModuleServerRequest) {
    if (uuid === undefined || uuid === null || uuid === '') return null;
    const exact = canonicalUuid(uuid);
    if (!exact) throw new SdkError('validation', `${type} requires an exact UUID.`);
    const doc = await shadowdarkAdapter.resolveDocumentFor(exact, callerOf(req));
    if (!doc || doc.type !== type) throw new SdkError('validation', `${type} ${exact} is unavailable or has the wrong type.`);
    return { ...doc, uuid: exact };
}
export async function handleLanguagePlan(req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const body = await req.json<any>();
        if (body.mode === 'inventory') {
            const plan = await inventoryPlan(req, body.actorId);
            return contextConflict(req.runtime, revision) ?? json({ ...plan, contextRevision: revision });
        }
        const ancestry = await resolveLanguageIdentity(body.ancestryUuid, 'Ancestry', req);
        const classDoc = await resolveLanguageIdentity(body.classUuid, 'Class', req);
        let existing: string[] = [];
        if (body.actorId) {
            const actor: any = await requireOwnedActor(req.runtime, body.actorId);
            existing = Array.isArray(actor.system?.languages) ? actor.system.languages : [];
        }
        const plan = await callerLanguagePlan(callerOf(req), ancestry, classDoc, existing);
        return contextConflict(req.runtime, revision) ?? json({ ...plan, contextRevision: revision });
    } catch (e) { return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e)); }
}

async function inventoryPlan(req: ModuleServerRequest, actorId: string) {
    if (typeof actorId !== 'string' || !actorId) throw new SdkError('validation', 'Choose a character before editing languages.');
    const actor: any = await requireOwnedActor(req.runtime, actorId);
    if (actor.type !== 'Player') throw new SdkError('validation', 'Language allowances apply to player characters.');
    if (!Array.isArray(actor.system?.languages) || actor.system.languages.some((value: unknown) => typeof value !== 'string'))
        throw new SdkError('validation', 'The character’s stored languages need review before editing.');
    const source = spellReview(actor);
    const ancestry = await resolveLanguageIdentity(actor.system?.ancestry, 'Ancestry', req);
    const classDoc = await resolveLanguageIdentity(actor.system?.class, 'Class', req);
    if (!ancestry || (actor.system?.level?.value > 0 && !classDoc))
        throw new SdkError('not_ready', 'The character’s ancestry and class must be available to review language allowances.');
    const native = await callerLanguagePlan(callerOf(req), ancestry, classDoc, [], 'inventory');
    const plan = { ...native, ...languageEditingPlan(native, native.rows) };
    const latest = await requireOwnedActor(req.runtime, actorId);
    if (spellReview(latest) !== source) throw new SdkError('conflict', 'The character changed. Refresh language choices.');
    const current = Array.isArray(actor.system?.languages) ? actor.system.languages : [];
    return { ...plan, current, review: createHash('sha256').update(JSON.stringify([source, { ...plan,
        rows: [...plan.rows].sort((a, b) => a.uuid!.localeCompare(b.uuid!)),
        groups: plan.groups.map(group => ({ ...group, options: [...group.options].sort() })) }])).digest('hex') };
}

/** One reviewed primary-document patch. No retries or invented language grants. */
export async function handleManageLanguages(req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const body = await req.json<any>();
        const world = req.runtime.world?.snapshot().identity;
        const scope = world ? `${world.instanceId}:${world.worldId}:${body.actorId}` : `${shadowdarkAdapter.runtimeGeneration}:${body.actorId}`;
        return await withActorLock(scope, async () => {
            const plan = await inventoryPlan(req, body.actorId);
            const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
            if (body.contextRevision !== revision || body.review !== plan.review)
                return error('conflict', 'Language choices changed. Refresh and review them again.');
            const checked = validateLanguageInventory(plan, plan.current, body.languages);
            if (!checked.valid) return error('validation', checked.errors.join(' '));
            if (JSON.stringify(checked.languages) !== JSON.stringify(plan.current))
                await req.runtime.documents.patch('Actor', body.actorId, { 'system.languages': checked.languages });
            return json({ success: true });
        });
    } catch (e) { return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e)); }
}
/** Generator creates through the module's validated native choice workflow. */
export async function handleCreateCharacter(req: ModuleServerRequest) {
    const revision = requestRevision(req.runtime);
    try {
        const body = await req.json<any>();
        const actor = body.actor;
        if (!actor || actor.type !== 'Player' || ![0,1].includes(actor.system?.level?.value)) return error('validation', 'Generator requires a level0/1 Player source.');
        const ancestry = await resolveLanguageIdentity(actor.system?.ancestry, 'Ancestry', req);
        const classDoc = await resolveLanguageIdentity(actor.system?.class, 'Class', req);
        if (!ancestry || (actor.system.level.value === 1 && !classDoc)) return error('validation', 'Choose exact readable ancestry and class sources before creation.');
        const plan = await callerLanguagePlan(callerOf(req), ancestry, actor.system.level.value === 1 ? classDoc : null);
        const choices = validateLanguageSelections(plan, body.languageChoices);
        if (!choices.valid) return error('validation', choices.errors.join(' '));
        const submitted = actor.system?.languages;
        if (!Array.isArray(submitted) || submitted.length !== choices.languages.length || new Set(submitted).size !== submitted.length || submitted.some(uuid => !choices.languages.includes(uuid)))
            return error('validation', 'Language inventory must match its exact fixed grants and separate reviewed choice pools.');
        const changed = contextConflict(req.runtime, revision); if (changed) return changed;
        if (classDoc?.system?.spellcasting?.ability && actor.system.level.value === 1) {
            const lookups = await shadowdarkAdapter.callerLookups(actor, callerOf(req));
            const view = prepareShadowdarkView(actor, lookups, requestRules(req.runtime));
            if (!view.spellModel.sources.some(source => source.classUuid === classDoc.uuid)) return error('validation', 'The created character is missing its native casting grant or exact Class dependencies. Review its fixed source talents.');
            if (view.spellModel.owned.some(row => row.classification === 'unresolved')) return error('validation', 'A created Spell has unresolved Class data. Review the exact source before creation.');
        }
        if (actor.system.level.value === 1) {
            const prepared = body.creationPlan;
            if (!prepared?.choices || prepared.choices.targetLevel !== 1
                || canonicalUuid(prepared.choices.classUuid) !== classDoc?.uuid
                || canonicalUuid(prepared.choices.ancestryUuid) !== ancestry.uuid)
                return error('validation', 'Level-one creation requires its exact reviewed native advancement choices and identities.');
            if (prepared.contextRevision !== revision) return error('conflict', 'The creation plan belongs to an old world context. Prepare and review it again.');
            // Repeat the same authoritative advancement validation with current
            // caller sources. No earlier client check or submitted hash is trusted.
            const response = await prepareCharacterCreation(req, prepared.choices);
            if (response.status !== 200) return response;
            const current: any = await response.json();
            if (prepared.review !== current.creationPlan.review) return error('conflict', 'Native creation sources or choices changed. Prepare and review a fresh plan.');
            if (!Array.isArray(actor.items) || createHash('sha256').update(creationGrantReview(actor.items)).digest('hex') !== current.creationPlan.review)
                return error('validation', 'Submitted creation grants differ from the authoritative plan. Review exact ordinary, granted and extra Spell sources, counts and complete native fields.');
        }
        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        const created = await req.runtime.documents.create('Actor', { ...actor, system: { ...actor.system, languages: choices.languages } });
        return json({ success: true, id: created._id ?? created.id });
    } catch (e) { return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e)); }
}
