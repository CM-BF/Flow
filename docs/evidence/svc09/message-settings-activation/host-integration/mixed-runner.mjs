// Native work is replaced only at HarnessAdapter.run. The fixed runner owns the loop,
// durable admission, real center HTTP, heartbeat and completion ACK. No SDK invocation.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { join } from 'node:path';
import { lstat, readdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

export async function readMixedTaskRows(pool, taskIds) {
  try {
    return (await pool.query('SELECT t.id,t.submission,t.status,t.current_attempt_id,a.runner_id,a.id AS attempt_id FROM flow.tasks t JOIN flow.attempts a ON a.id=t.current_attempt_id WHERE t.id=ANY($1::text[]) ORDER BY t.id', [taskIds])).rows;
  } catch (cause) {
    throw Object.assign(new Error('Mixed task snapshot query failed', { cause }), { code: 'MIXED_TASK_QUERY_FAILED' });
  }
}

export async function runMixedConsumer({ root, baseUrl, slots, profiles, choices, http, pool, checkpoint }) {
  const load = path => import(pathToFileURL(join(root, path)).href);
  const { runRunner } = await load('apps/runner/src/runtime.ts');
  const { guardExecutionProfile } = await load('apps/runner/src/execution-profiles.ts');
  const { AdmissionJournal } = await load('apps/runner/src/admission-journal.ts');
  const stateDirectory = slot => join(slot.workdir, createHash('sha256').update(baseUrl).digest('hex'));
  const { FlowClient } = await load('packages/client/src/index.ts');
  async function quiescent(slot) {
    const directory = stateDirectory(slot), journal = await AdmissionJournal.open(directory);
    assert.equal(journal.unresolved(new Set()), false);
    assert.ok(journal.opportunity, 'Real production runner must already have bound its journal.');
    const observed = await new FlowClient({ baseUrl, token: slot.runner.token })
      .claimOpportunityStatus(journal.opportunity, AbortSignal.timeout(1500));
    assert.ok(['missing', 'unavailable'].includes(observed.state), 'Unresolved assignment is retained.');
    const entries = await readdir(directory); assert.ok(entries.length <= 4);
    for (const entry of entries) {
      if (entry === 'admission.json') continue;
      assert.match(entry, /^[a-f0-9]{64}$/); // Fixed runtime hashes the attempt UUID for its local directory.
      const path = join(directory, entry), info = await lstat(path);
      assert.ok(info.isDirectory() && !info.isSymbolicLink());
      const files = await readdir(path); assert.ok(files.length <= 8);
      assert.ok(!files.some(name => /(?:pending|uncertain)-events|final|proposal/.test(name)), 'Unknown or pending local outcome is retained.');
    }
    return { runnerId: slot.runner.runnerId, requestId: journal.opportunity.requestId, state: observed.state };
  }
  await checkpoint('mixed-initial-admission-status', await Promise.all(slots.map(quiescent)));
  const keys = { legacy: randomUUID(), settings: randomUUID() };
  const bodies = { legacy: { title: 'SVC09A synthetic legacy', prompt: 'Owned zero-provider routing fixture.', harness: 'claude' },
    settings: { title: 'SVC09A synthetic settings', prompt: 'Owned zero-provider routing fixture.', harness: 'claude',
      executionProfile: profiles.settings.reference, messageSettings: { protocol: 'flow.claude-turn-settings.v1', profile: profiles.settings.reference, requested: choices[0] } } };
  await checkpoint('mixed-submit-intents', { keys, bodies });
  const tasks = {};
  for (const id of ['legacy', 'settings']) {
    tasks[id] = (await http('/api/tasks', { body: bodies[id], key: keys[id], expected: 202 })).task;
    await checkpoint(`mixed-${id}-accepted`, { key: keys[id], taskId: tasks[id].id });
  }
  const stop = new AbortController(), claimed = [], notices = [], handles = [];
  const deadline = performance.now() + 15000;
  let primary;
  function start(id) {
    const slot = slots.find(value => value.id === id), profile = profiles[id];
    const adapter = guardExecutionProfile({ name: 'claude', version: profile.configuration.adapterVersion, async run(context) {
      assert.equal(context.task.id, tasks[id].id); assert.equal(context.executionIdentity.runnerId, slot.runner.runnerId);
      assert.deepEqual(context.task.messageSettings, bodies[id].messageSettings);
      await context.assertOwnership();
      const fact = { slot: id, taskId: context.task.id, identity: context.executionIdentity,
        requested: context.task.messageSettings ?? null, observed: 'unknown', source: 'injected-adapter-not-native' };
      claimed.push(fact); await checkpoint(`mixed-${id}-claimed`, fact);
    } }, profile.reference, profile.configuration);
    const state = { settled: false, error: null };
    state.promise = runRunner({ baseUrl, token: slot.runner.token, workingDirectory: slot.workdir,
      signal: stop.signal, adapters: [adapter], activeSteering: false, maxConcurrentAttempts: 1,
      pollIntervalMs: 500, heartbeatIntervalMs: 1000, requestTimeoutMs: 1500,
      onNotice: notice => { if (notices.length >= 32) stop.abort(); else notices.push(notice); } })
      .catch(error => { state.error = { name: error.name, code: /^[A-Z_]+$/.test(error.code ?? '') ? error.code : null }; stop.abort(); })
      .finally(() => { state.settled = true; });
    handles.push(state);
  }
  async function completed(id) {
    for (;;) {
      if (stop.signal.aborted || performance.now() >= deadline) throw Object.assign(new Error('MIXED_BOUND_OR_RUNTIME_FAILURE'), { code: 'MIXED_BOUND_OR_RUNTIME_FAILURE' });
      const task = await http(`/api/tasks/${tasks[id].id}`);
      if (task.status === 'succeeded') return task;
      assert.ok(['queued', 'running'].includes(task.status));
      await delay(250);
    }
  }
  let snapshots;
  try {
    start('settings'); const settings = await completed('settings'); // Legacy was queued first; no legacy consumer yet.
    assert.deepEqual(claimed.map(value => value.slot), ['settings']);
    assert.equal((await http(`/api/tasks/${tasks.legacy.id}`)).status, 'queued');
    start('legacy'); const legacy = await completed('legacy'); snapshots = { legacy, settings };
    // A server terminal row can precede the HTTP ACK reaching the local outbox.
    for (;;) {
      const pending = await Promise.all(slots.map(async slot => (await AdmissionJournal.open(stateDirectory(slot))).unresolved(new Set())));
      if (pending.every(value => !value)) break;
      if (performance.now() >= deadline || stop.signal.aborted) throw Object.assign(new Error('LOCAL_ACK_UNKNOWN'), { code: 'LOCAL_ACK_UNKNOWN' });
      await delay(25);
    }
  } catch (error) { primary = error; }
  finally { stop.abort(); await Promise.all(handles.map(value => value.promise)); }
  const closure = { loopsSettled: handles.every(value => value.settled), errors: handles.map(value => value.error), notices };
  await checkpoint('mixed-loop-closure', closure);
  if (primary) throw primary;
  assert.ok(closure.loopsSettled && closure.errors.every(value => value === null));
  assert.deepEqual(claimed.map(value => value.slot), ['settings', 'legacy']);
  const admissionStatus = await Promise.all(slots.map(quiescent));
  await checkpoint('mixed-final-admission-status', admissionStatus);
  const rows = await readMixedTaskRows(pool, [tasks.legacy.id, tasks.settings.id]);
  assert.equal(rows.length, 2);
  for (const id of ['legacy', 'settings']) {
    const row = rows.find(value => value.id === tasks[id].id), slot = slots.find(value => value.id === id);
    assert.equal(row.status, 'succeeded'); assert.equal(row.runner_id, slot.runner.runnerId);
    assert.deepEqual(row.submission, bodies[id]); assert.equal(row.attempt_id, claimed.find(value => value.slot === id).identity.attemptId);
  }
  return { claimed, rows, snapshots, closure, admissionStatus, providerCalls: 0, actualNativeClaim: 'unknown' };
}
