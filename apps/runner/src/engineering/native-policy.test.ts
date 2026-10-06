import { expect, it } from 'vitest';
import type { Json } from '../codex/types.js';
import { createNativeFileRecipe } from './native-policy.js';
const file = { type: 'fileChange', id: 'patch-1', changes: [{ path: 'calculator.mjs', kind: { type: 'update', move_path: null }, diff: '-a-b\n+a+b' }], status: 'inProgress' };
const request = { threadId: 'thread', turnId: 'turn', itemId: 'patch-1', startedAtMs: 1 };
function setup() { const r = createNativeFileRecipe('gpt-6-astra', '/owned', 'Fix calculator'); r.evidence.bindThread('thread'); r.evidence.bindTurn({ id: 'turn', items: [] }); return r; }
function item(r: ReturnType<typeof setup>, value: unknown, phase = 'started') { r.evidence.accept({ method: `item/${phase}`, params: { threadId: 'thread', turnId: 'turn', completedAtMs: 1, item: value } as Json }); }
const approve = (r: ReturnType<typeof setup>, params: Json = request) => r.respond('item/fileChange/requestApproval', params);
it('binds one exact update to its request, completion and terminal before accepting the same final projection', () => {
  const r = setup(); item(r, file); expect(approve(r)).toEqual({ allowed: true, reply: { result: { decision: 'accept' } } });
  const done = { ...file, status: 'completed' }; item(r, done, 'completed');
  const final = { type: 'agentMessage', id: 'final', text: 'Fixed', phase: 'final_answer', delivery: null, questions: null };
  item(r, final, 'completed'); r.evidence.accept({ method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed', error: null, itemsView: 'full', items: [done, final] } } });
  expect(r.evidence.observation.state).toBe('completed'); expect(() => r.checkCompletion()).not.toThrow();
});
it.each(['../calculator.mjs', '/owned/calculator.mjs', '.git/config', 'other.mjs', 'a/../calculator.mjs'])('rejects noncanonical or extra path %s before approval', path => { const r = setup(); expect(() => item(r, { ...file, changes: [{ ...file.changes[0], path }] })).toThrow(); });
it.each([{ type: 'add' }, { type: 'delete' }, { type: 'update', move_path: 'other.mjs' }])('rejects an unsupported file operation %s', kind => { expect(() => item(setup(), { ...file, changes: [{ ...file.changes[0], kind }] })).toThrow(); });
it.each(['commandExecution', 'mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall', 'subAgentActivity', 'webSearch', 'imageGeneration', 'functionCallOutput', 'futureTool'])('rejects observed %s in terminal items as well as started items', type => {
  expect(() => item(setup(), { type, id: 'bad' })).toThrow(); const r = setup();
  expect(() => r.evidence.accept({ method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed', error: null, itemsView: 'full', items: [{ type, id: 'bad' }] } } })).toThrow();
});
it.each([{ ...request, threadId: 'other' }, { ...request, turnId: 'other' }, { ...request, itemId: 'other' }, { ...request, grantRoot: '/owned' }, { ...request, extra: true }])('denies an unbound or expanded approval %s and never grants later requests', params => { const r = setup(); item(r, file); expect(approve(r, params).allowed).toBe(false); expect(approve(r).allowed).toBe(false); });
it('denies requests without prior changes, repeats and every non-file tool request', () => {
  expect(approve(setup()).allowed).toBe(false); const r = setup(); item(r, file); expect(approve(r).allowed).toBe(true); expect(approve(r).allowed).toBe(false);
  for (const method of ['item/commandExecution/requestApproval', 'item/permissions/requestApproval', 'item/tool/call', 'mcpServer/elicitation/request', 'item/tool/requestUserInput', 'account/chatgptAuthTokens/refresh', 'attestation/generate', 'execCommandApproval', 'applyPatchApproval', 'future/request']) expect(setup().respond(method, request).allowed).toBe(false);
});
it('rejects changed, unapproved, incomplete or terminal-only file evidence', () => {
  const r = setup(); item(r, file); expect(() => item(r, { ...file, status: 'completed' }, 'completed')).toThrow();
  const changed = setup(); item(changed, file); approve(changed);
  expect(() => item(changed, { ...file, status: 'completed', changes: [{ ...file.changes[0], diff: 'different' }] }, 'completed')).toThrow();
  expect(() => changed.checkCompletion()).toThrow(); expect(() => setup().checkCompletion()).toThrow();
});
it('bounds diff bytes and file item count', () => {
  expect(() => item(setup(), { ...file, changes: [{ ...file.changes[0], diff: '🙂'.repeat(4097) }] })).toThrow();
  const r = setup(); for (let i = 0; i < 16; i++) item(r, { ...file, id: `patch-${i}` });
  expect(() => item(r, { ...file, id: 'overflow' })).toThrow();
});
it('rejects reroute and mismatched thread configuration without calling it actual model evidence', () => {
  const r = setup(); expect(() => r.evidence.accept({ method: 'model/rerouted', params: { threadId: 'thread', turnId: 'turn', fromModel: 'gpt-6-astra', toModel: 'other' } })).toThrow();
  const reply = { thread: { id: 'thread' }, model: 'gpt-6-astra', approvalPolicy: 'untrusted', sandbox: { type: 'workspaceWrite', writableRoots: ['/owned'], networkAccess: false, excludeTmpdirEnvVar: true, excludeSlashTmp: true } };
  expect(r.readThread(reply)).toEqual({ threadId: 'thread' }); expect(() => r.readThread({ ...reply, model: 'unknown' })).toThrow();
  expect(() => r.readThread({ ...reply, sandbox: { ...reply.sandbox, networkAccess: true } })).toThrow();
});
