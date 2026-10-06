import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import { createServer } from '../../../../apps/server/src/index.js';
import { createClaudeAdapter, type ClaudeQuery } from '../../../../apps/runner/src/claude.js';
import { describeExecutionProfile, guardExecutionProfile } from '../../../../apps/runner/src/execution-profiles.js';
import { runRunner } from '../../../../apps/runner/src/runtime.js';
import { graphPeer, finalResult } from '../../../../apps/runner/src/goal-graph-tools/test-peer.js';
import { createGoalEntry, createGoalSession, type GoalEntryRecord, type GoalIntent, type GoalPlanningInput } from './index.js';
import type { GoalGraphRunAccepted } from '../../../contracts/src/goal-graph-runs.js';
import type { GoalNativeExecutionResult } from '../../../contracts/src/goal-native-executions.js';

const database = `flow_o13_journey_${randomUUID().replaceAll('-', '')}`;
const adminUrl = 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres'; const url = new URL(adminUrl); url.pathname = '/' + database;
const admin = new Pool({ connectionString: adminUrl, max: 1, statement_timeout: 5000 });
const token = randomUUID(), marker = randomUUID();
const requests: { path: string; key: string; body: unknown }[] = [], runtimes: { stop: AbortController; promise: Promise<void> }[] = [];
const facts: Record<string, unknown> = { database, providerCalls: 0, boundary: 'Real public HTTP/PG, runtime/outbox and SDK adapter; two injected query transports. Synthetic graph content is not actual model planning.' };
let created = false, pool: Pool, app: Awaited<ReturnType<typeof createServer>>, directory = '', address = '', dropPath = '';
const owner = () => new FlowClient({ baseUrl: address, token });
async function start() {
  app = await createServer({ databaseUrl: url.href, ownerToken: token, automaticQueueScan: false, leaseMs: 30_000 });
  app.addHook('onSend', async (request, reply) => {
    if (request.method === 'POST' && (request.url === '/api/goals' || request.url.endsWith('/graph-runs') || request.url.endsWith('/native-executions'))) requests.push({ path: request.url, key: String(request.headers['idempotency-key']), body: structuredClone(request.body) });
    if (dropPath && request.url === dropPath && request.method === 'POST' && reply.statusCode < 300) { dropPath = ''; reply.raw.destroy(); }
  });
  address = await app.listen({ host: '127.0.0.1', port: 0 });
}
beforeAll(async () => {
  facts.before = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows; expect(facts.before).toEqual([]);
  await admin.query(`CREATE DATABASE "${database}"`); created = true; await admin.query(`COMMENT ON DATABASE "${database}" IS '${marker}'`);
  directory = await mkdtemp(join(tmpdir(), 'flow-o13-')); pool = new Pool({ connectionString: url.href, max: 2 }); await start();
});
afterAll(async () => {
  try {
    for (const r of runtimes) r.stop.abort(); await Promise.all(runtimes.map(r => r.promise));
    await app?.close(); await pool?.end();
    if (created) { expect((await admin.query("SELECT shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=$1", [database])).rows[0].marker).toBe(marker);
      facts.connections = (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1', [database])).rows; expect(facts.connections).toEqual([]); await admin.query(`DROP DATABASE "${database}"`); }
    facts.remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database])).rows; expect(facts.remaining).toEqual([]);
    if (directory) { await rm(directory, { recursive: true, force: true }); facts.directoryRemoved = true; }
  } finally { await admin.end(); await writeFile(`docs/evidence/o13/journey-facts-${database}.json`, JSON.stringify({ ...facts, requests }, null, 2) + '\n'); }
});
function disk<T>() {
  return {
    async load(namespace: string): Promise<unknown | null> { try { return JSON.parse(await readFile(join(directory, createHash('sha256').update(namespace).digest('hex') + '.json'), 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; } },
    async save(namespace: string, record: T | null) { const path = join(directory, createHash('sha256').update(namespace).digest('hex') + '.json'); await writeFile(path + '.tmp', JSON.stringify(record), { mode: 0o600 }); await rename(path + '.tmp', path); },
  };
}
async function harness(kind: 'planner' | 'child', query: ClaudeQuery) {
  const registered = await owner().registerRunner({ name: `O13 injected ${kind}`, harnesses: ['claude'], capacity: 1 });
  const material = join(directory, 'release-facts.txt'); if (kind === 'child') await writeFile(material, 'Release fact: the synthetic preview is ready.', { mode: 0o600 });
  const options = { materialFiles: kind === 'child' ? [material] : [], allowRead: kind === 'child', requireReadApproval: false, goalGraphTools: kind === 'planner', model: 'synthetic-no-provider', timeoutMs: 7000, maxTurns: 4, maxBudgetUsd: 0.1, query };
  const adapter = createClaudeAdapter(options), configuration = describeExecutionProfile(options, adapter);
  const published = await new FlowClient({ baseUrl: address, token: registered.token }).publishExecutionProfile({ configuration });
  return { pin: published.profile.reference, runnerId: registered.runnerId, client: () => new FlowClient({ baseUrl: address, token: registered.token }), start() {
    const stop = new AbortController(); const promise = runRunner({ baseUrl: address, token: registered.token, workingDirectory: join(directory, kind), signal: stop.signal, adapters: [guardExecutionProfile(adapter, published.profile.reference, configuration)], pollIntervalMs: 20, heartbeatIntervalMs: 50 });
    runtimes.push({ stop, promise }); return { async close() { stop.abort(); await promise; } };
  } };
}
function session(goalId: string) { return createGoalSession({ goalId, connectionId: 'isolated-center', intents: disk<GoalIntent>(), client: owner() }); }
const value = (raw: any) => { expect(raw.isError).not.toBe(true); return JSON.parse(raw.content[0].text); };

it('one durable natural-language entry composes injected planning, explicit readonly child and independent fixed delivery acceptance', async () => {
  const project = (await owner().createProject({ workspaceId: 'personal', title: 'O13 continuous goal' }, randomUUID())).snapshot.project;
  const natural = { projectId: project.id, originalGoal: '请为这个合成预览写一段准确的发布说明，然后交给我确认。', constraints: 'Only readonly text; no engineering changes.', acceptance: 'Owner checks the exact release fact and accepts or leaves unaccepted.' };
  const entryOptions = () => ({ connectionId: 'isolated-center', entryId: 'one-entry', store: disk<GoalEntryRecord>(), client: owner() });
  let entry = createGoalEntry(entryOptions()); await entry.initialize(); dropPath = '/api/goals';
  expect((await entry.submit(natural)).state).toBe('unknown'); await entry.dispose(); entry = createGoalEntry(entryOptions()); await entry.initialize();
  expect(requests.filter(r => r.path === '/api/goals')).toHaveLength(1);
  const acceptedEntry = await entry.recover(); expect(acceptedEntry.state).toBe('bound'); const goalId = entry.snapshot().goalId!; await entry.dispose();
  let graphCalls = 0, childCalls = 0, graphCloses = 0, childCloses = 0;
  const plannerQuery: ClaudeQuery = ({ prompt, options }) => Object.assign((async function* () {
    graphCalls++; expect(prompt).toContain(natural.originalGoal); const peer = await graphPeer(options!);
    try {
      expect(value(await peer.callTool({ name: 'graph_read', arguments: { request: { view: 'graph' } } })).nodes).toEqual([]);
      const proposal = { expectedProjectRevision: 1, reason: 'Synthetic SDK transport plans a reviewable text journey.', additions: [
        { key: 'draft', title: 'Draft release note', dependencies: [] },
        { key: 'review', title: 'Review exact release note', dependencies: [{ kind: 'proposed', key: 'draft' }] },
        { key: 'deliver', title: 'Deliver after acceptance', dependencies: [{ kind: 'proposed', key: 'review' }] },
      ] };
      const saved = value(await peer.callTool({ name: 'graph_command', arguments: { command: { kind: 'propose', proposal }, idempotencyKey: 'synthetic-propose' } })).proposal;
      value(await peer.callTool({ name: 'graph_command', arguments: { command: { kind: 'apply', proposalId: saved.id, expectedProjectRevision: 1, proposalDigest: saved.proposalDigest }, idempotencyKey: 'synthetic-apply' } }));
    } finally { await peer.close(); }
    yield finalResult('o13-synthetic-planner');
  })(), { close() { graphCloses++; } });
  const text = '合成预览已就绪；请确认这份发布说明。';
  const childQuery: ClaudeQuery = ({ prompt, options }) => Object.assign((async function* () {
    childCalls++; expect(prompt).toContain('Write one factual sentence, explicitly frozen by the owner.'); expect(prompt).toContain(natural.originalGoal);
    expect(options!.tools).toEqual(['Read']); expect(options!.disallowedTools).toEqual(expect.arrayContaining(['Write', 'Edit', 'Bash', 'Agent']));
    const material = String(prompt).split('\n').find(line => line.startsWith('Authorized material: '))!.slice('Authorized material: '.length);
    expect(await readFile(material, 'utf8')).toBe('Release fact: the synthetic preview is ready.');
    const hook = options!.hooks!.PreToolUse![0]!.hooks[0]!;
    const base = { hook_event_name: 'PreToolUse' as const, session_id: 'o13-child', transcript_path: 'synthetic', cwd: options!.cwd!, tool_use_id: randomUUID() };
    expect(await hook({ ...base, tool_name: 'Read', tool_input: { file_path: material } }, undefined, { signal: options!.abortController!.signal })).toMatchObject({ hookSpecificOutput: { permissionDecision: 'allow' } });
    expect(await hook({ ...base, tool_name: 'Write', tool_input: { file_path: material, content: 'never written' } }, undefined, { signal: options!.abortController!.signal })).toMatchObject({ hookSpecificOutput: { permissionDecision: 'deny' } });
    yield { ...finalResult('o13-synthetic-child'), result: text } as ReturnType<ClaudeQuery> extends AsyncIterable<infer T> ? T : never;
  })(), { close() { childCloses++; } });
  const planner = await harness('planner', plannerQuery), child = await harness('child', childQuery);
  let control = session(goalId); await control.initialize(); expect((await control.planning()).runs).toEqual([]);
  const planning: GoalPlanningInput = { prompt: 'Read the original goal, propose and apply at most three nodes; do not execute children.', scope: { baseRevision: 1, allowedExistingNodes: [], maxProposals: 1, maxApplications: 1, maxNewNodes: 3, maxNewEdges: 2 }, execution: { harness: 'claude', executionProfile: planner.pin } };
  dropPath = `/api/goals/${goalId}/graph-runs`; expect((await control.command({ kind: 'graph-plan', input: planning })).state).toBe('unknown');
  expect(() => control.command({ kind: 'graph-plan', input: planning })).toThrow(/existing command/);
  const graphAck = await control.recover(); expect(graphAck.state).toBe('acknowledged'); const graph = (graphAck as { receipt: GoalGraphRunAccepted }).receipt;
  const other = session(goalId); await other.initialize(); expect((await other.planning()).runs[0]).toMatchObject({ id: graph.run.id, task: { id: graph.task.id }, mode: 'claude' }); await other.dispose();
  const graphRuntime = planner.start(); await expect.poll(async () => (await owner().show(graph.task.id)).status, { timeout: 10_000 }).toBe('succeeded'); await graphRuntime.close();
  const plan = await control.plan(); expect(plan.nodes).toHaveLength(3); expect(plan.nodes.every(n => n.inputRef === null)).toBe(true); expect(childCalls).toBe(0);
  const node = plan.nodes.find(n => n.title === 'Draft release note')!;
  const stale = createGoalSession({ goalId, connectionId: 'independent-owner', intents: disk<GoalIntent>(), client: owner() }); await stale.initialize();
  const definition = { kind: 'goal' as const, input: { kind: 'define-input' as const, nodeId: node.id, expectedInputVersion: 0, input: { goal: 'Write one factual sentence, explicitly frozen by the owner.', constraints: 'Read the selected synthetic release fact only.', acceptance: 'Owner reviews the exact sentence; nonempty is only mechanical.', verification: { kind: 'nonempty' as const } }, reason: 'The owner approves this actual input; graph titles do not create executable inputs.' } };
  expect((await control.command(definition)).state).toBe('acknowledged'); expect((await stale.command(definition)).state).toBe('rejected'); await stale.dispose();
  await control.observe([node.id]);
  const execute = { nodeId: node.id, expectedInputVersion: 1, previousExecutionId: null, dependencies: [], reason: 'Owner selects the separately pinned readonly text profile.', executionProfile: child.pin };
  expect((await control.command({ kind: 'native-execute', input: { ...execute, executionProfile: planner.pin } })).state).toBe('rejected');
  // The rejection refreshes plan observation; explicitly read the selected actual input again.
  await control.observe([node.id]); dropPath = `/api/goals/${goalId}/native-executions`;
  expect((await control.command({ kind: 'native-execute', input: execute })).state).toBe('unknown'); await control.dispose();
  const beforeRestart = (await owner().goalDelivery(goalId, { view: 'state', nodeIds: [node.id] })); expect(beforeRestart.view).toBe('state');
  await app.close(); await start(); control = session(goalId); const countBeforeRecovery = requests.length; await control.initialize(); expect(requests.length).toBe(countBeforeRecovery);
  const executionAck = await control.recover(); expect(executionAck.state).toBe('acknowledged'); const execution = (executionAck as { receipt: GoalNativeExecutionResult }).receipt;
  expect((await owner().show(execution.task!.id)).status).toBe('queued'); expect((await control.planning()).runs[0]!.id).toBe(graph.run.id);
  const childRuntime = child.start(); await expect.poll(async () => (await owner().show(execution.task!.id)).status, { timeout: 10_000 }).toBe('succeeded'); await childRuntime.close();
  const reviewer = createGoalSession({ goalId, connectionId: 'independent-reviewer', intents: disk<GoalIntent>(), client: owner() }); await reviewer.initialize();
  const state = await reviewer.observe([node.id]); expect(state.nodes[0]!.accepted).toBeNull(); expect(state.nodes[0]!.execution!.task.verificationStatus).toBe('passed');
  const binding = state.nodes[0]!.execution!.artifact!; const detail = await reviewer.read({ kind: 'artifact', binding }); expect('content' in detail && detail.content).toBe(text);
  expect((await reviewer.command({ kind: 'goal', input: { kind: 'accept-delivery', nodeId: node.id, executionId: execution.executionId!, expectedCurrentExecutionId: null, reason: 'Independent owner reviewed this exact synthetic text and explicitly accepts it.' } })).state).toBe('acknowledged');
  expect((await reviewer.observe([node.id])).nodes[0]!.deliveryCurrent).toBe(true); expect((await reviewer.history()).items.map(i => i.kind)).toContain('accept-delivery');
  await reviewer.dispose(); await control.dispose();
  expect(graphCalls).toBe(1); expect(childCalls).toBe(1); expect(graphCloses).toBe(1); expect(childCloses).toBe(1);
  for (const path of ['/api/goals', `/api/goals/${goalId}/graph-runs`]) { const sent = requests.filter(r => r.path === path); expect(sent).toHaveLength(2); expect(sent[0]).toEqual(sent[1]); }
  const nativeSent = requests.filter(r => r.path.endsWith('/native-executions')); expect(nativeSent).toHaveLength(3); expect(nativeSent[1]).toEqual(nativeSent[2]);
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.tasks')).rows[0].n).toBe(2);
  Object.assign(facts, { goalId, graphRunId: graph.run.id, plannerTaskId: graph.task.id, childTaskId: execution.task!.id, binding, graphCalls, childCalls, graphCloses, childCloses, nativeProviderQueries: 0, mechanicalAndBusinessAcceptanceSeparate: true });
});

it('a revoked claimed child stays uncertain and neither a new profile nor a fresh client can repeat its execution', async () => {
  let calls = 0;
  const query: ClaudeQuery = () => Object.assign((async function* () { calls++; yield finalResult('must-not-run'); })(), { close() {} });
  const retired = await harness('child', query), replacement = await harness('child', query);
  const project = (await owner().createProject({ workspaceId: 'personal', title: 'Negative fixture: uncertain execution' }, randomUUID())).snapshot.project;
  const added = await owner().changeProject(project.id, { expectedRevision: 1, reason: 'Structural negative-test fixture, not model planning', change: { kind: 'add-node', title: 'Uncertain text', parent: null, taskId: null } }, randomUUID());
  const goal = (await owner().createGoal({ projectId: project.id, originalGoal: 'Negative recovery test', constraints: 'No provider execution', acceptance: 'Never accept unknown work' }, randomUUID())).goal;
  const nodeId = added.changedNodeId!; const c = session(goal.id); await c.initialize();
  expect((await c.command({ kind: 'goal', input: { kind: 'define-input', nodeId, expectedInputVersion: 0, input: { goal: 'Exact negative input', constraints: 'No execution', acceptance: 'Unknown remains unresolved', verification: { kind: 'nonempty' } }, reason: 'Owner fixes input' } })).state).toBe('acknowledged');
  await c.observe([nodeId]);
  const input = { nodeId, expectedInputVersion: 1, dependencies: [], previousExecutionId: null, reason: 'One controlled admission', executionProfile: retired.pin };
  expect(() => c.command({ kind: 'native-execute', input: { ...input, executionProfile: undefined } } as any)).toThrow();
  const accepted = await c.command({ kind: 'native-execute', input }); expect(accepted.state).toBe('acknowledged'); const execution = (accepted as { receipt: GoalNativeExecutionResult }).receipt;
  await expect.poll(async () => (await retired.client().claim()).assignment?.task.id, { timeout: 3000 }).toBe(execution.task!.id);
  await owner().revokeRunner(retired.runnerId); expect((await owner().show(execution.task!.id)).status).toBe('uncertain');
  await c.dispose(); const fresh = session(goal.id); await fresh.initialize(); const state = await fresh.observe([nodeId]); expect(state.nodes[0]!.reason).toBe('execution-uncertain');
  const before = (await pool.query('SELECT count(*)::int AS n FROM flow.tasks')).rows[0].n;
  const current = { ...input, previousExecutionId: execution.executionId! };
  expect((await fresh.command({ kind: 'native-execute', input: current })).state).toBe('rejected');
  await fresh.observe([nodeId]); const replacementResult = await fresh.command({ kind: 'native-execute', input: { ...current, executionProfile: replacement.pin } });
  expect(replacementResult).toMatchObject({ state: 'rejected', code: 'execution_unsettled' });
  expect((await fresh.command({ kind: 'goal', input: { kind: 'accept-delivery', nodeId, executionId: execution.executionId!, expectedCurrentExecutionId: null, reason: 'Must reject missing verified delivery' } })).state).toBe('rejected');
  expect((await pool.query('SELECT count(*)::int AS n FROM flow.tasks')).rows[0].n).toBe(before); expect(calls).toBe(0); await fresh.dispose();
  facts.uncertain = { taskId: execution.task!.id, executionId: execution.executionId, status: (await owner().show(execution.task!.id)).status, newTaskCount: 0, injectedQueryCalls: calls };
});
