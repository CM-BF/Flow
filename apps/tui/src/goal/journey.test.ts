import { createServer as proxyServer } from 'node:http';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import { createGoalTerminal } from './terminal.js';
import { openGoalIntentStore } from './store.js';
import { publicGoalFixture, goalInput, save } from '../../../server/src/goal-delivery/test-support.js';
const f = publicGoalFixture('tui01d');
const connectionId = 'e'.repeat(64);
async function terminal(goalId: string, client = f.client(), directory?: string) {
  const dir = directory ?? await mkdtemp(join(tmpdir(), 'flow-tui01d-'));
  const store = await openGoalIntentStore(dir, connectionId, goalId);
  const controller = createGoalTerminal({ client, connectionId, goalId, intents: store });
  await controller.initialize();
  return { dir, controller, close: async (remove = true) => { await controller.dispose(); await store.close(); if (remove) await rm(dir, { recursive: true, force: true }); } };
}
const define = (nodeId: string, expectedInputVersion = 1) => ({ kind: 'goal' as const, input: { kind: 'define-input' as const, nodeId, expectedInputVersion, input: goalInput('PRIVATE_MATERIAL replacement'), reason: 'Explicit owner update' } });
const run = (nodeId: string, previousExecutionId: string | null = null) => ({ kind: 'goal' as const, input: { kind: 'execute' as const, nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId, reason: 'Explicit fixture only', fixture: { scenario: 'success' as const } } });
async function peer(taskId: string) {
  const registration = (await f.http('/api/runners', { name: 'TUI01D deterministic peer', harnesses: ['fixture'], capacity: 1 })).body;
  let assignment: any;
  for (let i = 0; i < 40 && !assignment; i++) { assignment = (await f.http('/api/runner/claim', {}, registration.token)).body.assignment; if (!assignment) await new Promise(r => setTimeout(r, 25)); }
  expect(assignment?.task.id).toBe(taskId); let sequence = 0;
  return { async emit(...events: unknown[]) { const response = await f.http('/api/runner/events', { attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, events: events.map(e => ({ ...(e as object), id: randomUUID(), sequence: ++sequence })) }, registration.token); expect(response.status).toBe(200); } };
}
it('two real clients keep bodies lazy and sibling activity stable, then reject stale writes without replacement', async () => {
  const s = await f.setup(), first = await terminal(s.goalId), second = await terminal(s.goalId), [a, b] = s.nodes;
  try {
    const one = first.controller, two = second.controller, snapshot = one.snapshot();
    expect(one.snapshot()).toBe(snapshot); const start = f.requests.length;
    expect((await one.input('中文🙂\nlocal only')).code).toBe('DRAFT'); expect(f.requests.length).toBe(start);
    await one.execute({ type: 'observe' }); await one.execute({ type: 'history' });
    expect(f.requests.slice(start).some(r => r.materials)).toBe(false); expect(one.snapshot().goal.body).toBeNull();
    await one.execute({ type: 'input', nodeId: a, version: 1 }); const body = one.snapshot().goal.body, planRef = one.snapshot().goal.plan!.planRef;
    const sibling = await f.client().commandGoal(s.goalId, run(b).input, randomUUID()), worker = await peer(sibling.task!.id);
    const refreshes = [];
    for (const text of ['B start', 'B still working']) { await worker.emit({ type: 'message', text }); const at = f.requests.length; await one.execute({ type: 'observe' }); refreshes.push(...f.requests.slice(at)); }
    await worker.emit({ type: 'completed', outcome: 'succeeded' }); await one.execute({ type: 'plan' });
    expect(one.snapshot().goal.plan!.planRef).toBe(planRef); expect(one.snapshot().goal.body).toEqual(body);
    expect(refreshes).toHaveLength(2); expect(refreshes.every(r => !r.materials)).toBe(true);
    expect((await one.execute({ type: 'command', command: define(a) })).code).toBe('ACKNOWLEDGED');
    const before = f.requests.filter(r => r.method === 'POST').length;
    expect((await two.execute({ type: 'command', command: define(a) })).code).toBe('REJECTED');
    expect(f.requests.filter(r => r.method === 'POST').length - before).toBe(1);
    expect(two.snapshot().goal.plan!.nodes.find(n => n.id === a)!.inputRef!.version).toBe(2); expect(two.snapshot().goal.intent).toBeNull();
    const rev = one.snapshot().goal.plan!.projectRevision;
    const graph = { kind: 'project' as const, input: { expectedRevision: rev, reason: 'Explicit graph change', change: { kind: 'add-node' as const, title: 'C', parent: null, taskId: null } } };
    expect((await one.execute({ type: 'command', command: graph })).code).toBe('ACKNOWLEDGED');
    expect((await two.execute({ type: 'command', command: graph })).code).toBe('REJECTED'); expect(two.snapshot().goal.plan!.totalNodes).toBe(3);
    await save('tui-two-client', { noBodiesBeforeExpansion: true, refreshes, requestCount: refreshes.length, refreshBytes: refreshes.reduce((n, r) => n + r.bytes, 0), repeatedMaterialBytes: 0, originalInputBytes: Buffer.byteLength(JSON.stringify(body)), stablePlanRef: true, staleInputRejected: true, staleProjectRejected: true, replacementCommands: 0, draftRetained: one.snapshot().draft });
  } finally { await first.close(); await second.close(); }
});
it('pages 57 immutable explanation references without bodies and reads an exact historical version only on request', async () => {
  const s = await f.setup();
  for (let version = 1; version <= 54; version++) await f.client().commandGoal(s.goalId, { ...define(s.nodes[1], version).input, input: goalInput(`PRIVATE_MATERIAL history ${version}`) }, randomUUID());
  const t = await terminal(s.goalId); const references: number[] = [], requests = [];
  try {
    for (const type of ['history', 'history-next', 'history-next']) { const start = f.requests.length; expect((await t.controller.execute({ type })).ok).toBe(true); references.push(...t.controller.snapshot().goal.history!.items.map(i => i.reference.version)); requests.push(...f.requests.slice(start)); }
    expect(references).toHaveLength(57); expect(new Set(references).size).toBe(57); expect(requests).toHaveLength(3); expect(requests.every(r => !r.materials)).toBe(true);
    expect(t.controller.snapshot().goal.body).toBeNull(); expect((await t.controller.input(`/explain ${references[0]}`)).ok).toBe(true);
    expect(t.controller.snapshot().goal.body).toMatchObject({ view: 'explanation', reference: { version: references[0] }, historical: true });
    await save('tui-history', { references, requests, bodyRequestsBeforeExpansion: 0, totalReferenceBytes: requests.reduce((n, r) => n + r.bytes, 0), explicitBodyRequests: 1 });
  } finally { await t.close(); }
});
it('loses a real HTTP ACK, preserves private original intent across terminal/center restart, and explicitly recovers once', async () => {
  const s = await f.setup(), requests: { key: string; body: string }[] = []; let lose = true;
  const proxy = proxyServer(async (req, res) => {
    try {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(chunk as Buffer); const body = Buffer.concat(chunks).toString();
      const command = req.method === 'POST' && req.url?.endsWith('/commands'); if (command) requests.push({ key: String(req.headers['idempotency-key']), body });
      const response = await fetch(f.address() + req.url, { method: req.method, headers: { authorization: String(req.headers.authorization), 'content-type': 'application/json', 'idempotency-key': String(req.headers['idempotency-key'] ?? '') }, ...(body ? { body } : {}), signal: AbortSignal.timeout(5000) });
      const data = await response.text(); if (command && lose && response.ok) { lose = false; res.destroy(); return; }
      res.writeHead(response.status, { 'content-type': 'application/json' }); res.end(data);
    } catch { res.destroy(); }
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve)); const port = proxy.address(); if (!port || typeof port === 'string') throw Error('Missing proxy');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${port.port}`, token: 'o12-private-owner' }); let t = await terminal(s.goalId, client);
  try {
    expect((await t.controller.execute({ type: 'command', command: define(s.nodes[0]) })).code).toBe('UNKNOWN');
    expect(t.controller.snapshot().goal.intent).not.toBeNull(); const dir = t.dir; await t.close(false); await f.restart();
    t = await terminal(s.goalId, client, dir); expect(requests).toHaveLength(1); expect(t.controller.snapshot().goal.commandState).toBe('unknown');
    expect((await t.controller.input('/recover')).code).toBe('ACKNOWLEDGED'); expect(requests).toHaveLength(2); expect(requests[1]).toEqual(requests[0]); expect(t.controller.snapshot().goal.intent).toBeNull();
    await save('tui-lost-ack', { requests, originalIntentRestored: true, automaticResend: false, replayed: true, restarts: ['terminal controller/private file', 'center'] });
  } finally { await t.close(); proxy.closeAllConnections(); await new Promise<void>(r => proxy.close(() => r())); }
});
it('derives decision/cancel identities from observation, preserves running work on quit and explicitly expands fixed artifacts', async () => {
  const s = await f.setup(), nodeId = s.nodes[0]; let t = await terminal(s.goalId);
  try {
    expect((await t.controller.input(`/cancel ${nodeId}`)).ok).toBe(false);
    const accepted = await t.controller.execute({ type: 'command', command: run(nodeId) }); const receipt = (accepted.outcome as any).receipt;
    const worker = await peer(receipt.task.id), decisionId = randomUUID(); await worker.emit({ type: 'decision', decisionId, prompt: 'PRIVATE_MATERIAL decide 中文' });
    await t.controller.execute({ type: 'observe' }); expect(t.controller.snapshot().goal.body).toBeNull();
    expect((await t.controller.input(`/decision ${nodeId}`)).ok).toBe(true); expect(t.controller.snapshot().goal.body).toMatchObject({ pending: true, prompt: 'PRIVATE_MATERIAL decide 中文' });
    expect((await t.controller.input(`/decide ${nodeId} approve`)).code).toBe('ACKNOWLEDGED'); await t.controller.input('/quit'); expect((await f.client().show(receipt.task.id)).status).toBe('running');
    await t.close(); t = await terminal(s.goalId); await t.controller.input('/observe');
    expect((await t.controller.input(`/cancel ${nodeId}`)).code).toBe('ACKNOWLEDGED'); expect((await f.client().show(receipt.task.id)).status).toBe('cancel_requested');
    await worker.emit({ type: 'completed', outcome: 'cancelled' });
    const next = await t.controller.execute({ type: 'command', command: run(nodeId, receipt.executionId) }); const nextPeer = await peer((next.outcome as any).receipt.task.id);
    const content = 'PRIVATE_MATERIAL fixed artifact 中文🙂', artifactId = randomUUID(), version = createHash('sha256').update(content).digest('hex');
    const inputDigest = createHash('sha256').update(JSON.stringify({ artifactVersion: version, rule: { kind: 'nonempty' } })).digest('hex');
    await nextPeer.emit({ type: 'artifact', artifactId, version, title: 'Fixed output', mediaType: 'text/plain', content }, { type: 'verification', artifactId, artifactVersion: version, verifierId: 'flow.text', verifierVersion: '1', inputDigest, result: 'passed', evidence: '0provider fixture event producer' }, { type: 'completed', outcome: 'succeeded' });
    await t.controller.input('/observe'); expect(t.controller.snapshot().goal.state!.nodes[0]!.deliveryCurrent).toBe(false);
    expect((await t.controller.input(`/artifact ${nodeId}`)).ok).toBe(true); expect(t.controller.snapshot().goal.body).toMatchObject({ content });
    await save('tui-controls', { quitTaskStatus: 'running', cancelAckStatus: 'cancel_requested', stoppedOnlyAfterEvent: true, artifactId, version, mechanicalPassed: true, accepted: false });
  } finally { await t.close(); }
});
async function child(command: string, args: string[], env: NodeJS.ProcessEnv, input = '') {
  const child = spawn(command, args, { cwd: process.cwd(), env, stdio: ['pipe', 'pipe', 'pipe'] }); let stdout = '', stderr = '';
  child.stdout.on('data', b => { stdout += b; if (stdout.length > 2_000_000) child.kill('SIGTERM'); }); child.stderr.on('data', b => { stderr += b; }); child.stdin.end(input);
  const timeout = setTimeout(() => child.kill('SIGTERM'), 20_000), kill = setTimeout(() => child.kill('SIGKILL'), 22_000);
  try { const code = await new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); }); if (code !== 0) throw Error(`Child failed ${code}: ${stderr.slice(-3000)}`); return stdout; }
  finally { clearTimeout(timeout); clearTimeout(kill); }
}
it('runs the actual CLI headless and PTY on the public goal with CJK, narrow resize and local multiline draft', async () => {
  const s = await f.setup(), dir = await mkdtemp(join(tmpdir(), 'flow-tui01d-cli-'));
  const env = { PATH: process.env.PATH, TERM: 'xterm-256color', LANG: 'en_US.UTF-8', FLOW_URL: f.address(), FLOW_TOKEN: 'o12-private-owner', FLOW_TUI_STATE_DIR: dir, TUI_TEST_NODE: process.execPath, TUI_TEST_GOAL: s.goalId };
  try {
    const before = f.requests.filter(r => r.method === 'POST').length;
    const output = await child(process.execPath, ['--import', 'tsx', 'apps/tui/src/main.tsx', '--goal', s.goalId, '--headless'], env, '{"type":"observe"}\n{"type":"draft","text":"中文🙂\\nlocal only"}\n{"type":"quit"}\n');
    const lines = output.trim().split('\n').map(s => JSON.parse(s)); expect(lines.map(l => l.result.code)).toEqual(['OBSERVED', 'DRAFT', 'QUIT']); expect(lines[1].snapshot.draft).toBe('中文🙂\nlocal only');
    const pty = JSON.parse(await child('python3', ['apps/tui/test-fixtures/goal_driver.py'], env)); expect(pty).toMatchObject({ exitCode: 0, narrow: true, draftOnly: true, rawModeRestored: true });
    expect(f.requests.filter(r => r.method === 'POST').length).toBe(before); await save('tui-cli', { headless: lines, pty, postedCommands: 0 });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
