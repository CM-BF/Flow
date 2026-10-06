import { afterEach, expect, test } from 'vitest';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { FlowClient, decodeConversationCreated, decodeConversationTurnAccepted, assertConversationCreationMatches, assertConversationContextMatches, UnknownConversationAcknowledgementError } from './index.js';
import { conversationCreationSchema, type ClaudeTurnSettings, type ConversationCreated, type ConversationTurnAccepted, type KnowledgeCitation, type ConversationContextReference } from '@flow/contracts';
const closers: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closers.splice(0).reverse()) await close(); });
const creation = conversationCreationSchema.parse({ title: 'Original' });
function created(): ConversationCreated {
  return { conversation: { ...structuredClone(creation), id: randomUUID(), revision: 0, createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z' },
    capabilities: { followUp: true, queue: false, steer: false, perTurnModel: false, perTurnThinking: false, perTurnTools: false }, replayed: false };
}
function accepted(): ConversationTurnAccepted {
  const value = created(); const id = randomUUID();
  return { conversation: { ...value.conversation, revision: 1 }, replayed: false, turn: {
    id: randomUUID(), conversationId: value.conversation.id, number: 1, createdAt: value.conversation.createdAt,
    user: { role: 'user', text: '  Original 中文🙂\n' },
    task: { id, title: value.conversation.title, harness: 'claude', status: 'queued', verificationStatus: 'pending', createdAt: value.conversation.createdAt, updatedAt: value.conversation.updatedAt },
    effective: { model: null, tools: null, thinking: 'unknown', source: null }, assistant: { state: 'pending', reason: 'execution-pending' },
    telemetry: { kind: 'execution', taskId: id, title: 'Execution' },
  } };
}
async function http(reply: (body: string, key: string | undefined) => string | Promise<string>) {
  const requests: { body: string; key?: string }[] = [];
  const server = createServer(async (request, response) => {
    const pieces: Buffer[] = []; for await (const piece of request) pieces.push(piece as Buffer);
    const body = Buffer.concat(pieces).toString(); const key = request.headers['idempotency-key'] as string | undefined;
    requests.push({ body, key }); response.setHeader('content-type', 'application/json'); response.end(await reply(body, key));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  closers.push(() => new Promise<void>(done => { server.closeAllConnections(); server.close(() => done()); }));
  const address = server.address(); if (!address || typeof address === 'string') throw Error('Fixture address missing');
  return { client: new FlowClient({ baseUrl: `http://127.0.0.1:${address.port}`, token: 'synthetic-owner' }), requests };
}
test.each(['{}', '{not-json', 'null'])('HTTP 200 unconfirmed creation ACK %s is unknown without hidden retry or raw data', async raw => {
  const { client, requests } = await http(() => raw);
  await expect(client.createConversation(creation, 'original-key')).rejects.toMatchObject({ code: 'conversation_ack_unknown' });
  expect(requests).toEqual([{ key: 'original-key', body: JSON.stringify(creation) }]);
});
test('HTTP request identity is captured from the sent bytes before the caller can mutate its input', async () => {
  const value = created(); const input = structuredClone(creation);
  const { client, requests } = await http(() => JSON.stringify(value));
  const sending = client.createConversation(input, 'frozen-key'); input.title = 'Later title'; input.requested.model = 'Later model';
  expect((await sending).conversation.title).toBe('Original');
  expect(requests).toEqual([{ key: 'frozen-key', body: JSON.stringify(creation) }]);
});
test('HTTP mismatched accepted turn is unknown and never becomes delivery success', async () => {
  const value = accepted(); const input = { expectedRevision: 0, text: value.turn.user.text, mode: 'follow-up' as const };
  value.turn.conversationId = randomUUID();
  const { client, requests } = await http(() => JSON.stringify(value));
  await expect(client.submitConversationTurn(value.conversation.id, input, 'turn-key')).rejects.toMatchObject({ code: 'conversation_ack_unknown' });
  expect(requests).toHaveLength(1);
});

const citation = (n = 1): KnowledgeCitation => ({ projectId: 'project-a', sourceId: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`, version: 1, contentDigest: 'a'.repeat(64), locator: { kind: 'utf8-bytes', start: 2, end: 6 } });

function messageSettings(): ClaudeTurnSettings {
  return { protocol: 'flow.claude-turn-settings.v1' as const,
    profile: { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) },
    requested: { model: 'configured-alias', thinking: 'adaptive' as const, effort: { kind: 'level' as const, value: 'high' as const }, speed: 'fast' as const } };
}
test('rejects a missing message settings snapshot in an otherwise valid send receipt', () => {
  const value = accepted();
  expect(() => decodeConversationTurnAccepted(value, value.conversation.id, {
    expectedRevision: 0, text: value.turn.user.text, mode: 'follow-up', messageSettings: messageSettings(),
  })).toThrow(UnknownConversationAcknowledgementError);
});

test('nested send settings stay frozen to the exact body while a caller edits its next request', async () => {
  const value = accepted(); value.turn.messageSettings = messageSettings();
  const input = { ...turnInput(value), messageSettings: structuredClone(value.turn.messageSettings) };
  const sent = JSON.stringify(input); const { client, requests } = await http(() => JSON.stringify(value));
  const pending = client.submitConversationTurn(value.conversation.id, input, 'settings-stable');
  input.messageSettings.profile.configDigest = 'b'.repeat(64); input.messageSettings.requested.model = 'next-draft';
  input.messageSettings.requested.effort = { kind: 'level', value: 'low' };
  expect(await pending).toEqual(value); expect(requests).toEqual([{ body: sent, key: 'settings-stable' }]);
});

test('send settings mismatch or malformed observations retain unknown without raw response or retry', async () => {
  const value = accepted(); value.turn.messageSettings = messageSettings();
  const input = { ...turnInput(value), messageSettings: structuredClone(value.turn.messageSettings) };
  const variants = [undefined, null, { ...input.messageSettings, protocol: 'wrong' },
    ...['id', 'runnerId', 'configDigest'].map(field => ({ ...input.messageSettings, profile: { ...input.messageSettings.profile, [field]: field === 'configDigest' ? 'b'.repeat(64) : randomUUID() } })),
    { ...input.messageSettings, requested: { ...input.messageSettings.requested, model: 'unconfirmed-secret-model' } }];
  let body: unknown = value;
  const { client, requests } = await http(() => JSON.stringify(body));
  for (const snapshot of variants) {
    body = { ...value, turn: { ...value.turn, messageSettings: snapshot } };
    await expect(client.submitConversationTurn(value.conversation.id, input, 'unchanged-key')).rejects.toMatchObject({
      code: 'conversation_ack_unknown', message: 'The conversation acknowledgement is unconfirmed. Keep the original request identity.',
    });
  }
  expect(requests).toHaveLength(variants.length);
  expect(requests.every(request => request.key === 'unchanged-key' && request.body === JSON.stringify(input))).toBe(true);
});

test('requested and observed settings preserve absent, null and alias facts and reject contradictory wrappers', () => {
  const value = accepted(); const snapshot = messageSettings(); value.turn.messageSettings = snapshot;
  const input = { ...turnInput(value), messageSettings: snapshot };
  for (const observed of [null, { source: 'claude.sdk.system.init' as const, model: 'actual-model-alias' },
    { source: 'claude.sdk.system.init' as const, model: 'actual-model-alias', effort: null, fastModeState: 'cooldown' as const, fastModeDisabledReason: 'pending' as const }]) {
    value.turn.effective = { ...value.turn.effective, model: observed?.model ?? null, messageSettings: { snapshot, observed } };
    const result = decodeConversationTurnAccepted(value, value.conversation.id, input);
    expect(result.turn.effective.messageSettings!.observed).toEqual(observed);
    expect(result.turn.messageSettings!.requested.model).toBe('configured-alias');
  }
  for (const observed of [{ source: 'wrong', model: 'actual-model-alias' }, { source: 'claude.sdk.system.init', model: '' },
    { source: 'claude.sdk.system.init', model: 'actual-model-alias', effort: 'unsupported' },
    { source: 'claude.sdk.system.init', model: 'actual-model-alias', fastModeState: null }]) {
    const bad = { ...value, turn: { ...value.turn, effective: { ...value.turn.effective, messageSettings: { snapshot, observed } } } };
    expect(() => decodeConversationTurnAccepted(bad, value.conversation.id, input)).toThrow(UnknownConversationAcknowledgementError);
  }
  value.turn.effective.model = snapshot.requested.model;
  expect(() => decodeConversationTurnAccepted(value, value.conversation.id, input)).toThrow(UnknownConversationAcknowledgementError);
  value.turn.effective.model = 'actual-model-alias';
  value.turn.effective.messageSettings!.snapshot = { ...snapshot, profile: { ...snapshot.profile, runnerId: randomUUID() } };
  expect(() => decodeConversationTurnAccepted(value, value.conversation.id, input)).toThrow(UnknownConversationAcknowledgementError);
});

test('new settings reject legacy runnerRequested even before a final wrapper exists', async () => {
  const value = accepted();
  const legacyRequested = { model: 'legacy-model', permissionMode: 'dontAsk' as const, thinking: 'disabled' as const };
  value.turn.effective.runnerRequested = legacyRequested;
  expect(decodeConversationTurnAccepted(value, value.conversation.id, turnInput(value))).toEqual(value);
  delete value.turn.effective.runnerRequested;
  value.turn.messageSettings = messageSettings();
  const input = { ...turnInput(value), messageSettings: structuredClone(value.turn.messageSettings) };
  // A queued turn has a valid requested snapshot without an execution/final wrapper.
  expect(decodeConversationTurnAccepted(value, value.conversation.id, input)).toEqual(value);
  value.turn.effective.runnerRequested = legacyRequested;
  const { client, requests } = await http(() => JSON.stringify(value));
  await expect(client.submitConversationTurn(value.conversation.id, input, 'pending-settings-key')).rejects.toMatchObject({
    code: 'conversation_ack_unknown', message: 'The conversation acknowledgement is unconfirmed. Keep the original request identity.',
  });
  expect(requests).toEqual([{ key: 'pending-settings-key', body: JSON.stringify(input) }]);
});

test('new settings reject disabled thinking in a final wrapper without changing the request identity', async () => {
  const value = accepted(); const snapshot = messageSettings(); value.turn.messageSettings = snapshot;
  const input = { ...turnInput(value), messageSettings: structuredClone(snapshot) };
  value.turn.effective.messageSettings = { snapshot, observed: null };
  expect(decodeConversationTurnAccepted(value, value.conversation.id, input)).toEqual(value);
  value.turn.effective.thinking = 'disabled';
  const { client, requests } = await http(() => JSON.stringify(value));
  await expect(client.submitConversationTurn(value.conversation.id, input, 'final-settings-key')).rejects.toMatchObject({
    code: 'conversation_ack_unknown', message: 'The conversation acknowledgement is unconfirmed. Keep the original request identity.',
  });
  expect(requests).toEqual([{ key: 'final-settings-key', body: JSON.stringify(input) }]);
});

test('optional settings capability is finite and leaves all legacy capability flags false', () => {
  const value = created(); const settings = messageSettings();
  value.capabilities.messageSettings = { protocol: settings.protocol, profile: settings.profile, choices: 'execution-profile' };
  expect(decodeConversationCreated(value, creation)).toEqual(value);
  expect(value.capabilities.perTurnThinking).toBe(false);
  for (const patch of [{ protocol: 'wrong' }, { profile: { ...settings.profile, id: 'invalid' } }, { choices: 'arbitrary' }]) {
    const bad = { ...value, capabilities: { ...value.capabilities, messageSettings: { ...value.capabilities.messageSettings, ...patch } } };
    expect(() => decodeConversationCreated(bad, creation)).toThrow(UnknownConversationAcknowledgementError);
  }
});
const context = (refs: KnowledgeCitation[]): ConversationContextReference => ({ id: 'context-a', contextDigest: 'b'.repeat(64), executionInputId: 'input-a', executionInputDigest: 'c'.repeat(64), templateVersion: 1,
  sources: refs.map(ref => ({ citation: structuredClone(ref), byteLength: ref.locator.end - ref.locator.start, currentVersionAtFreeze: 2, isCurrentAtFreeze: false })) });
function turnInput(value: ConversationTurnAccepted) { return { expectedRevision: value.turn.number - 1, text: value.turn.user.text, mode: 'follow-up' as const }; }
test('known receipt identity accepts additive fields without discarding them', () => {
  const value = created(); const extra = { ...value, future: { note: 'additive' }, conversation: { ...value.conversation, future: true, requested: { ...value.conversation.requested, future: true } } };
  expect(decodeConversationCreated(extra, creation)).toBe(extra);
  const turn = accepted(); expect(decodeConversationTurnAccepted(turn, turn.conversation.id, turnInput(turn))).toBe(turn);
});
test.each(['title', 'harness', 'projectId', 'profile', 'model', 'thinking', 'tools', 'revision', 'timestamp', 'capabilities', 'replayed'])('creation %s changes cannot confirm the frozen request', field => {
  const value = created();
  if (field === 'title') value.conversation.title = 'Different';
  else if (field === 'harness') Reflect.set(value.conversation, 'harness', 'codex');
  else if (field === 'projectId') value.conversation.projectId = 'different';
  else if (field === 'profile') value.conversation.executionProfile = { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) };
  else if (field === 'model') value.conversation.requested.model = 'different';
  else if (field === 'thinking') value.conversation.requested.thinking = 'enabled';
  else if (field === 'tools') value.conversation.requested.tools = 'none';
  else if (field === 'revision') value.conversation.revision = 1;
  else if (field === 'timestamp') value.conversation.createdAt = 'invalid';
  else if (field === 'capabilities') Reflect.deleteProperty(value, 'capabilities');
  else Reflect.deleteProperty(value, 'replayed');
  expect(() => decodeConversationCreated(value, creation)).toThrow(UnknownConversationAcknowledgementError);
});
test('creation field helper preserves optional profile/project presence and canonical defaults for a later GET', () => {
  const expected = { ...creation, projectId: 'project-a', executionProfile: { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) } };
  const summary = { ...created().conversation, ...expected, revision: 20 };
  expect(() => assertConversationCreationMatches(expected, summary)).not.toThrow();
  expect(() => assertConversationCreationMatches(expected, { ...summary, projectId: undefined })).toThrow();
  expect(() => assertConversationCreationMatches(expected, { ...summary, executionProfile: { ...expected.executionProfile, runnerId: randomUUID() } })).toThrow();
});
test.each(['conversation', 'number', 'revision', 'text', 'task', 'telemetry', 'effective', 'assistant'])('turn %s mismatch stays unknown', field => {
  const value = accepted(); const input = turnInput(value); const id = value.conversation.id;
  if (field === 'conversation') value.conversation.id = randomUUID();
  else if (field === 'number') value.turn.number++;
  else if (field === 'revision') value.conversation.revision++;
  else if (field === 'text') value.turn.user.text = value.turn.user.text.trim();
  else if (field === 'task') Reflect.deleteProperty(value.turn, 'task');
  else if (field === 'telemetry') value.turn.telemetry.taskId = randomUUID();
  else if (field === 'effective') Reflect.set(value.turn, 'effective', null);
  else Reflect.set(value.turn, 'assistant', { state: 'completed' });
  expect(() => decodeConversationTurnAccepted(value, id, input)).toThrow(UnknownConversationAcknowledgementError);
});
test('the maximum response revision is legal while oversized revisions and request exhaustion are rejected', () => {
  const value = accepted(); value.turn.number = 2_147_483_647; value.conversation.revision = value.turn.number;
  const input = turnInput(value);
  expect(decodeConversationTurnAccepted(value, value.conversation.id, input)).toBe(value);
  value.conversation.revision++; expect(() => decodeConversationTurnAccepted(value, value.turn.conversationId, input)).toThrow();
  expect(() => decodeConversationTurnAccepted(value, value.turn.conversationId, { ...input, expectedRevision: 2_147_483_647 })).toThrow();
});
test('ordered frozen context is matched through turn admission and never fetched as body', () => {
  const value = accepted(); const refs = [citation(2), citation(1)]; value.conversation.projectId = 'project-a'; value.turn.context = context(refs);
  const input = { ...turnInput(value), knowledge: refs };
  expect(decodeConversationTurnAccepted(value, value.conversation.id, input)).toBe(value);
  value.conversation.projectId = 'other'; expect(() => decodeConversationTurnAccepted(value, value.conversation.id, input)).toThrow();
});
test.each(['order', 'project', 'source', 'version', 'digest', 'kind', 'start', 'end', 'byteLength', 'freezeVersion', 'freezeFlag', 'contextDigest', 'executionDigest', 'templateVersion', 'missing'])('context %s cannot pass as additive metadata', field => {
  const refs = [citation(2), citation(1)]; const value = context(refs); const first = value.sources[0]!;
  if (field === 'order') value.sources.reverse();
  else if (field === 'project') first.citation.projectId = 'other';
  else if (field === 'source') first.citation.sourceId = randomUUID();
  else if (field === 'version') first.citation.version++;
  else if (field === 'digest') first.citation.contentDigest = 'd'.repeat(64);
  else if (field === 'kind') Reflect.set(first.citation.locator, 'kind', 'characters');
  else if (field === 'start') first.citation.locator.start++;
  else if (field === 'end') first.citation.locator.end++;
  else if (field === 'byteLength') first.byteLength++;
  else if (field === 'freezeVersion') first.currentVersionAtFreeze = 0;
  else if (field === 'freezeFlag') first.isCurrentAtFreeze = true;
  else if (field === 'contextDigest') value.contextDigest = 'invalid';
  else if (field === 'executionDigest') value.executionInputDigest = 'invalid';
  else if (field === 'templateVersion') Reflect.set(value, 'templateVersion', 2);
  else Reflect.deleteProperty(value, 'sources');
  expect(() => assertConversationContextMatches(refs, value)).toThrow(UnknownConversationAcknowledgementError);
});
test('context absent/empty and reference/byte bounds preserve the existing v1 contract', () => {
  expect(() => assertConversationContextMatches(undefined, undefined)).not.toThrow();
  expect(() => assertConversationContextMatches([], context([]))).not.toThrow();
  expect(() => assertConversationContextMatches(undefined, null)).toThrow();
  expect(() => assertConversationContextMatches([], context([citation()]))).toThrow();
  expect(() => assertConversationContextMatches([citation(), citation()], context([citation(), citation()]))).toThrow();
  expect(() => assertConversationContextMatches([citation(), { ...citation(2), projectId: 'other' }], context([]))).toThrow();
  expect(() => assertConversationContextMatches(Array.from({ length: 5 }, (_, i) => citation(i + 1)), context([]))).toThrow();
  const wide = [1, 2, 3].map(n => ({ ...citation(n), locator: { kind: 'utf8-bytes' as const, start: 0, end: 4096 } }));
  expect(() => assertConversationContextMatches(wide, context(wide))).toThrow();
});
test('available reply identities are tied to the accepted task and attempt without claiming execution completion', () => {
  const value = accepted(); const taskId = value.turn.task.id; const attemptId = randomUUID(); const detailId = randomUUID();
  value.turn.assistant = { state: 'available', role: 'assistant', messageId: 'a'.repeat(64), text: 'Reply', truncated: false,
    contentRef: { kind: 'detail', id: detailId, title: 'Result', taskId, attemptId }, source: { kind: 'assistant-final', source: 'claude.sdk.result', messageId: 'a'.repeat(64), taskId, attemptId,
      detailId, nativeSessionId: 'session', eventId: 'event', sourceMessageId: 'source', contentDigest: 'b'.repeat(64) } };
  expect(decodeConversationTurnAccepted(value, value.conversation.id, turnInput(value))).toBe(value);
  value.turn.assistant.source.attemptId = randomUUID();
  expect(() => decodeConversationTurnAccepted(value, value.conversation.id, turnInput(value))).toThrow();
});

test('nested turn knowledge is frozen from the actual HTTP body, not the caller object after dispatch', async () => {
  const value = accepted(); const refs = [citation()]; value.conversation.projectId = 'project-a'; value.turn.context = context(refs);
  const input = { ...turnInput(value), knowledge: refs }; const original = JSON.stringify(input);
  const { client, requests } = await http(() => JSON.stringify(value));
  const sending = client.submitConversationTurn(value.conversation.id, input, 'context-key');
  input.text = 'Changed later'; refs[0]!.locator.end = 7; refs.length = 0;
  expect(await sending).toEqual(value); expect(requests).toEqual([{ key: 'context-key', body: original }]);
});

test('attachment v2 ACK uses the same frozen public matcher and lost confirmation keeps the original HTTP identity', async () => {
  const value = accepted(); value.conversation.projectId = 'project-a';
  const refs = [1, 2].map(n => ({ kind: 'upload' as const, projectId: 'project-a', resourceId: `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`, version: 1 as const, contentDigest: String(n).repeat(64) }));
  value.turn.context = { id: 'context-a', contextDigest: 'b'.repeat(64), executionInputId: 'input-a', executionInputDigest: 'c'.repeat(64), templateVersion: 2,
    order: 'knowledge-then-attachments', sources: [], attachments: refs.map(reference => ({ reference, name: 'exact.txt', mediaType: 'text/plain', byteLength: 3 })) };
  const input = { ...turnInput(value), attachments: structuredClone(refs) }; const sent = JSON.stringify(input);
  let valid = false;
  const { client, requests } = await http(() => JSON.stringify(valid ? { ...value, replayed: true } : { ...value, turn: { ...value.turn, context: undefined } }));
  await expect(client.submitConversationTurn(value.conversation.id, input, 'attachment-stable-key')).rejects.toMatchObject({ code: 'conversation_ack_unknown' });
  valid = true;
  expect((await client.submitConversationTurn(value.conversation.id, input, 'attachment-stable-key')).replayed).toBe(true);
  expect(requests).toEqual([{ key: 'attachment-stable-key', body: sent }, { key: 'attachment-stable-key', body: sent }]);
  expect(() => assertConversationContextMatches([], value.turn.context, { projectId: 'project-a', attachments: refs })).not.toThrow();
  const swapped = { ...value.turn.context, attachments: [...value.turn.context.attachments].reverse() };
  expect(() => assertConversationContextMatches([], swapped, { projectId: 'project-a', attachments: refs })).toThrow(UnknownConversationAcknowledgementError);
  expect(() => assertConversationContextMatches([], value.turn.context, { projectId: 'other', attachments: refs })).toThrow(UnknownConversationAcknowledgementError);
  expect(() => assertConversationContextMatches([], { ...value.turn.context, executionInputDigest: 'bad' }, { projectId: 'project-a', attachments: refs })).toThrow(UnknownConversationAcknowledgementError);
  expect(() => assertConversationContextMatches([], value.turn.context, { projectId: 'project-a', attachments: [] })).toThrow(UnknownConversationAcknowledgementError);
});
