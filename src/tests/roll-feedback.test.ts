import { strict as assert } from 'node:assert';
import { createMockSdkContext } from '@sheet-delver/sdk/testing';
import { postActorRoll } from '../ui/pages/postActorRoll';

export async function run(): Promise<void> {
    const notices: Array<{ message: string; type?: string; options?: unknown }> = [];
    const requests: Array<{ url: string; body: any }> = [];
    let response = { success: true, result: { _id: 'chat-1', author: 'user-1', rolls: [] } } as any;
    let status = 200;
    let failure: Error | null = null;
    let invalidJson = false;
    const client = createMockSdkContext({ overrides: {
        addNotification(message, type, options) { notices.push({ message, type, options }); return notices.length; },
        async fetchWithAuth(url, init) {
            if (failure) throw failure;
            requests.push({ url, body: JSON.parse(String(init?.body)) });
            return new Response(invalidJson ? '<html>proxy error</html>' : JSON.stringify(response), { status });
        },
    } });
    const actor = { id: 'actor-1', name: 'Adventurer' };
    for (const rollMode of ['publicroll', 'selfroll', 'gmroll', 'blindroll']) {
        await postActorRoll(client, actor, 'ability', 'str', { rollMode, advantage: true });
        const request = requests.at(-1)!;
        assert.equal(request.url, '/api/actors/actor-1/roll');
        assert.deepEqual(request.body, {
            type: 'ability', key: 'str',
            options: { rollMode, advantage: true, speaker: { actor: actor.id, alias: actor.name } },
        });
        assert.equal(notices.length, 0, 'host chat owns posted roll feedback, including private rolls');
    }
    await postActorRoll(client, actor, 'item', 'weapon', {}, 'selfroll');
    assert.equal(requests.at(-1)!.body.options.rollMode, 'selfroll');
    const speaker = { actor: actor.id, alias: 'Custom' };
    await postActorRoll(client, actor, 'item', 'weapon', { rollMode: 'gmroll', speaker }, 'selfroll');
    assert.deepEqual(requests.at(-1)!.body.options.speaker, speaker);
    assert.equal(requests.at(-1)!.body.options.rollMode, 'gmroll');
    await postActorRoll(client, actor, 'formula', '1d6');
    assert.equal(requests.at(-1)!.body.options.rollMode, 'publicroll');
    response = { success: true, result: true };
    await postActorRoll(client, actor, 'item', 'torch');
    assert.equal(notices.length, 0, 'legacy item-use success also posts chat');

    response = { success: false, error: '<b>Denied</b>' };
    await postActorRoll(client, actor, 'ability', 'str');
    assert.deepEqual(notices.at(-1), { message: 'Roll failed: <b>Denied</b>', type: 'error', options: undefined });
    status = 500;
    response = { success: true };
    await postActorRoll(client, actor, 'ability', 'str');
    assert.equal(notices.at(-1)!.message, 'Roll failed: Unknown error');
    failure = new Error('Offline');
    await postActorRoll(client, actor, 'ability', 'str');
    assert.equal(notices.at(-1)!.message, 'Error: Offline');
    failure = null;
    invalidJson = true;
    await postActorRoll(client, actor, 'ability', 'str');
    assert.equal(notices.length, 4, 'one error notice per failed request');
    assert.ok(notices.every(n => n.type === 'error' && n.options === undefined));
    console.log('shadowdark roll feedback: PASS (host-owned success, visibility and explicit errors)');
}

if (import.meta.url === `file://${process.argv[1]}`) {
    run().catch(error => { console.error(error); process.exitCode = 1; });
}
