import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { productionModule } from './ab-input.js';
import type { Row } from './proof.js';
export type ExperimentHttp = (path: string, body?: unknown, options?: { token?: string; key?: string }) => Promise<Row>;
export type ChatProbe = { conversationId: string; turnId: string; taskId: string; attemptId: string; runnerId: string; ownerVersion: number; content: string; version: string; sessionId: string };
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
  const probe = { conversationId, turnId, taskId, attemptId: attempt.id as string, runnerId: registration.runnerId as string,
    ownerVersion: attempt.ownerVersion as number, content, version, sessionId };
  validateChatRead(probe, await http(chatReadPath(probe, 0)), false);
  validateChatRead(probe, await http(chatReadPath(probe, 1)), true);
  return probe;
}
export function chatReadPath(chat: ChatProbe, index: number) {
  return '/api/conversations/' + chat.conversationId + (index % 2 ? '/turns?after=0&limit=20' : '');
}
export function validateChatRead(chat: ChatProbe, response: Row, page: boolean) {
  const turn = page ? response.turns?.[0] : response.lastTurn;
  if (page) assert.equal(response.turns.length, 1);
  else assert.equal(response.conversation.id, chat.conversationId);
  assert(turn && turn.id === chat.turnId && turn.task.id === chat.taskId, 'queue_chat_read_identity');
  assert.deepEqual(turn.assistant.source, { taskId: chat.taskId, attemptId: chat.attemptId, artifactVersion: chat.version });
  assert(turn.assistant.state === 'available' && turn.assistant.text === chat.content && turn.assistant.truncated === false, 'queue_chat_read_content');
}
