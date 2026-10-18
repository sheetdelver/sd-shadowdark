import { json, error, type ModuleServerRequest } from '@sheet-delver/sdk/server';
import { isSdkError, getErrorMessage, SdkError } from '@sheet-delver/sdk';
import { shadowdarkAdapter } from '../ShadowdarkAdapter';
import { callerOf, requestRevision, contextConflict, requireOwnedActor } from '../access';
import { callerLanguagePlan } from '../languages';
import { canonicalUuid } from '../../logic/identity';
import { prepareShadowdarkView } from '../../logic/prepared-view';
import { requestRules } from '../access';
import { validateLanguageSelections } from '../../logic/languages';

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
        if (classDoc?.system?.spellcasting?.ability && actor.system.level.value === 1) {
            const lookups = await shadowdarkAdapter.callerLookups(actor, callerOf(req));
            const view = prepareShadowdarkView(actor, lookups, requestRules(req.runtime));
            if (!view.spellModel.sources.some(source => source.classUuid === classDoc.uuid)) return error('validation', 'The created character is missing its native casting grant or exact Class dependencies. Review its fixed source talents.');
            if (view.spellModel.owned.some(row => row.classification === 'unresolved')) return error('validation', 'A created Spell has unresolved Class data. Review the exact source before creation.');
        }
        const conflict = contextConflict(req.runtime, revision); if (conflict) return conflict;
        const created = await req.runtime.documents.create('Actor', { ...actor, system: { ...actor.system, languages: choices.languages } });
        return json({ success: true, id: created._id ?? created.id });
    } catch (e) { return contextConflict(req.runtime, revision) ?? error(isSdkError(e) ? e.code : 'internal', getErrorMessage(e)); }
}
