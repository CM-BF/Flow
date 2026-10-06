import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCore, createInitialState, createContentStore, defaultConfig, storeCoveredOriginals, retrieveByRef } from './vendor/acp-kernel-0.0.101/dist/index.js';

export const hash = value => createHash('sha256').update(value).digest('hex');
const byteLength = text => Buffer.byteLength(text, 'utf8');
// A synthetic deterministic estimator, never provider token usage or a billing model.
const countTokens = text => Math.ceil(byteLength(text) / 4);
const core = createCore({ countTokens });
const config = defaultConfig(200_000, { preserveRecentMessages: 0, preserveRecentTokens: 0,
  compress: { minCompressRange: 500, minSummaryLength: 50, maxSummaryLength: 20_000 } });
export const SUMMARY = '本区间是已完成的合成实验记录：四条助手材料包含各自会话标识、序号、中文和emoji；本摘要不代表真实工程结论。需要原始字符时按ref回取，不能据此重复执行任何动作。';

export function createSession(sessionId) {
  const messages = Array.from({ length: 6 }, (_, i) => ({ id: `raw-${i}`, role: i === 0 || i === 5 ? 'user' : 'assistant', contentType: 'text',
    text: i === 0 ? '共同请求：保存合成材料并支持精确回取。' : `${sessionId} step ${i}\n${'合成原文🙂 alpha beta 0123456789; 不含凭据或真实数据。\n'.repeat(10)}` }));
  const rawBytes = messages.reduce((total, message) => total + byteLength(message.text), 0);
  return { schemaVersion: 1, kernelVersion: '0.0.101', sessionId, parentSessionId: null, revision: 0,
    messages, state: createInitialState(), contentStore: createContentStore(), rawBytes, rawDigest: hash(JSON.stringify(messages)) };
}
export function compressSession(session) {
  const input = { messages: session.messages, state: session.state, contentStore: session.contentStore, config,
    tokenCount: session.messages.reduce((total, message) => total + countTokens(message.text), 0), renderTags: 'none' };
  const referenced = core.processTurn(input);
  const refs = session.messages.slice(1, 5).map(message => referenced.state.messageRefs.byRaw[message.id]);
  const folded = core.applyCompression({ messages: session.messages, state: referenced.state, config,
    ranges: [{ startRef: refs[0], endRef: refs.at(-1), summary: SUMMARY }] });
  assert.deepEqual(folded.result.errors, []); assert.equal(folded.result.blocksCreated, 1);
  const blockIds = folded.state.blocks.filter(block => block.active).map(block => block.blockId);
  const contentStore = storeCoveredOriginals(referenced.contentStore, session.messages, folded.state, blockIds, countTokens);
  const visible = core.processTurn({ ...input, state: folded.state, contentStore });
  return { ...session, revision: 1, state: visible.state, contentStore: visible.contentStore,
    expected: refs.map((ref, index) => ({ ref, hash: hash(session.messages[index + 1].text), bytes: byteLength(session.messages[index + 1].text) })),
    visibleDigest: hash(JSON.stringify(visible.messages)), visibleBytes: visible.messages.reduce((total, message) => total + byteLength(message.text ?? ''), 0),
    compressionWarnings: folded.result.warnings };
}
export function retrieveOriginals(session) {
  let bytes = 0;
  for (const expected of session.expected) {
    const found = retrieveByRef(session.contentStore, expected.ref);
    assert.equal(found.ok, true); assert.equal(hash(found.text), expected.hash);
    assert.equal(byteLength(found.text), expected.bytes); bytes += expected.bytes;
  }
  assert.deepEqual(retrieveByRef(session.contentStore, 'm9999999'), { ok: false, reason: 'not-found' });
  return { verified: session.expected.length, bytes };
}
export const encodeSession = session => JSON.stringify(session);
export function decodeSession(text, expected) {
  const value = JSON.parse(text);
  // Host-only selected-version/session fence, not a general schema validator or production CAS.
  if (value.schemaVersion !== 1 || value.kernelVersion !== '0.0.101' || value.contentStore?.version !== 1
    || value.sessionId !== expected.sessionId || value.revision !== expected.revision) throw new Error('HOST_ENVELOPE_REJECTED');
  assert.equal(hash(JSON.stringify(value.messages)), value.rawDigest);
  retrieveOriginals(value);
  return value;
}
export function resumeProjection(session) {
  const projected = core.processTurn({ messages: session.messages, state: session.state, contentStore: session.contentStore,
    config, tokenCount: session.messages.reduce((total, message) => total + countTokens(message.text), 0), renderTags: 'none' });
  assert.equal(hash(JSON.stringify(projected.messages)), session.visibleDigest);
  return projected;
}
export function forkSession(parent, sessionId) {
  if (sessionId === parent.sessionId) throw new Error('HOST_FORK_REQUIRES_NEW_ID');
  return { ...structuredClone(parent), sessionId, parentSessionId: parent.sessionId, revision: 1 };
}
