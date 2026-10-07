import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { productionModule } from './ab-input.js';
import type { Row } from './proof.js';
export type ExperimentHttp = (path: string, body?: unknown, options?: { token?: string; key?: string }) => Promise<Row>;
export type ChatProbe = { conversationId: string; turnId: string; taskId: string; attemptId: string; runnerId: string; ownerVersion: number; content: string; version: string; sessionId: string; detailId?: string };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
/** A protocol-only synthetic result, using the existing public conversation fixture seam. No SDK/adapter/provider. */
export async function createCompletedChat(http: ExperimentHttp, submit: () => void, sourceDirectory: string, deadline: number, work: () => void): Promise<ChatProbe> {
  const created = await http('/api/conversations', { title: 'S01 queue probe completed chat' });
  const conversationId = created.conversation.id as string;
  assert(typeof conversationId === 'string' && created.conversation.revision === 0);
  submit(); // Unknown POST outcomes still consume the single task allowance.
  const admitted = await http('/api/conversations/' + conversationId + '/turns', { expectedRevision: 0, text: 'synthetic read fixture' });
  const taskId = admitted.turn.task.id as string; const turnId = admitted.turn.id as string;
  assert(typeof taskId === 'string' && typeof turnId === 'string');
  const registration = await http('/api/runners', { name: 'S01 protocol-only chat', harnesses: ['claude'], capacity: 1 });
  const credentials = { token: registration.token as string };
  const identity = await http('/api/runner/identity', undefined, credentials);
  assert.equal(identity.runnerId, registration.runnerId);
  const request = { protocol: 'flow.runner-claim.v2', runnerId: registration.runnerId, requestId: randomUUID() };
  const codec = await import(productionModule(sourceDirectory, 'packages/contracts/src/runner-claim.js'));
  let response: Row | undefined;
  for (let poll = 0; poll < 80; poll++) {
    work(); assert(performance.now() < deadline, 'queue_chat_claim_timeout');
    response = codec.decodeRunnerClaimResponse(await http('/api/runner/claim-opportunity', request, { ...credentials, key: request.requestId }), request, 'claim');
    if (response!.state === 'assigned') break;
    assert.equal(response!.state, 'empty', 'queue_chat_claim_unavailable');
    await sleep(500);
  }
  assert(response?.state === 'assigned' && response.assignment.task.id === taskId, 'queue_chat_claim_unknown');
  const { attempt } = response.assignment;
  const content = 'c'.repeat(1024); const version = digest(content); const sessionId = randomUUID();
  const events = [
    { type: 'session', nativeSessionId: sessionId, adapterVersion: 'claude-sdk-0.3.290-v1', resources: ['sdk:0.3.290', 'model:synthetic-test-model', 'tool:Read'] },
    { type: 'message', text: 'synthetic telemetry, not assistant content' },
    { type: 'artifact', artifactId: 'result', title: 'Synthetic chat reply', content, version, mediaType: 'text/plain' },
    { type: 'verification', artifactId: 'result', artifactVersion: version, verifierId: 'flow.text', verifierVersion: '1', inputDigest: digest(JSON.stringify({ artifactVersion: version, rule: { kind: 'nonempty' } })), result: 'passed', evidence: 'Synthetic protocol result' },
    { type: 'completed', outcome: 'succeeded' },
  ].map((event, index) => ({ ...event, id: randomUUID(), sequence: index + 1 }));
  const ack = await http('/api/runner/events', { attemptId: attempt.id, ownerVersion: attempt.ownerVersion, events }, credentials);
  assert.equal(ack.accepted, 5); assert.equal(ack.lastSequence, 5);
  const probe: ChatProbe = { conversationId, turnId, taskId, attemptId: attempt.id as string, runnerId: registration.runnerId as string,
    ownerVersion: attempt.ownerVersion as number, content, version, sessionId };
  probe.detailId = validateChatRead(probe, await http(chatReadPath(probe, 0)), false);
  validateChatRead(probe, await http(chatReadPath(probe, 1)), true);
  return probe;
}
export function chatReadPath(chat: ChatProbe, index: number) {
  return '/api/conversations/' + chat.conversationId + (index % 2 ? '/turns?after=0&limit=20' : '');
}
export function validateChatRead(chat: ChatProbe, response: Row, page: boolean) {
  const turn = page ? response.turns?.[0] : response.lastTurn;
  assert.equal(response.conversation?.id, chat.conversationId, 'queue_chat_conversation_identity');
  if (page) assert.equal(response.turns.length, 1);
  assert(turn && turn.id === chat.turnId && turn.conversationId === chat.conversationId && turn.task.id === chat.taskId, 'queue_chat_read_identity');
  const assistant = turn.assistant;
  assert(assistant?.state === 'available' && assistant.role === 'assistant' && assistant.text === chat.content && assistant.truncated === false, 'queue_chat_read_content');
  assert.equal(digest(assistant.text), chat.version, 'queue_chat_read_digest');
  const detailId: unknown = assistant.source?.detailId;
  assert(typeof detailId === 'string' && detailId.length > 0, 'queue_chat_detail_identity');
  if (chat.detailId !== undefined) assert.equal(detailId, chat.detailId, 'queue_chat_detail_changed');
  assert.deepEqual(assistant.source, { kind: 'adapter-final-artifact', adapterVersion: 'claude-sdk-0.3.290-v1',
    taskId: chat.taskId, attemptId: chat.attemptId, artifactId: 'result', artifactVersion: chat.version, detailId });
  assert.equal(assistant.messageId, 'artifact:' + detailId, 'queue_chat_message_identity');
  assert.deepEqual(assistant.contentRef, { kind: 'artifact', id: detailId, title: 'Synthetic chat reply', taskId: chat.taskId, attemptId: chat.attemptId });
  // The server allocates this detail ID; pin the first verified reference for subsequent reads.
  return detailId;
}
