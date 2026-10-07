// Work-only consumer. No top-level artifact import, listener, pool, process or SDK call.
// A separately reviewed fixture owner must create/bind the private installation,
// real artifact, synthetic Web pointer and cleanup deadline before calling this.
import assert from 'node:assert/strict';
import { readFile, lstat, realpath } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { isHostDirectory } from './host-paths.mjs';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw Object.assign(new Error(code), { code }); };

export function validateHostInput(input) {
  if (!input || input.format !== 1 || !isHostDirectory(input.directory)
    || !/^[a-f0-9]{40}$/.test(input.sourceHead ?? '') || !/^[a-f0-9]{64}$/.test(input.artifact?.artifactId ?? '')
    || input.artifact.manifestDigest !== input.artifact.artifactId || input.artifact.sourceHead !== input.sourceHead
    || !isAbsolute(input.repository ?? '') || !Array.isArray(input.choices) || input.choices.length !== 2) fail('HOST_FIXED_INPUT_REQUIRED');
  return join(input.directory, 'backend-artifacts', input.artifact.artifactId, 'root');
}

export async function runHostConsumer({ input, checkpoint, pool }) {
  const root = validateHostInput(input); // Fails before any runtime or private installation read.
  if (typeof checkpoint !== 'function' || !pool || typeof pool.query !== 'function') fail('HOST_FIXTURE_OWNER_REQUIRED');
  const info = await lstat(input.directory);
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid() && (info.mode & 0o777) === 0o700);
  assert.equal(await realpath(input.directory), input.directory);
  const composition = JSON.parse(await readFile(new URL('./source-composition.json', import.meta.url), 'utf8'));
  for (const pin of composition.paths) {
    const path = join(root, pin.path), stat = await lstat(path);
    assert.ok(stat.isFile() && !stat.isSymbolicLink()); assert.equal(stat.size, pin.after.bytes);
    assert.equal(digest(await readFile(path)), pin.after.sha256, `SOURCE_PIN_${pin.path}`);
  }
  const load = relative => import(pathToFileURL(join(root, relative)).href);
  const preview = await load('tools/personal-preview/preview.mjs');
  const processes = await load('tools/personal-preview/process.mjs');
  const slotsModule = await load('tools/personal-preview/runner-slots.mjs');
  const { maintainPreview } = await load('tools/personal-preview/maintenance-host.mjs');
  const { backendRuntime } = await load('tools/personal-preview/backend-release/host.mjs');
  const config = await preview.loadPreviewConfiguration(input.directory);
  assert.equal(config.repository, input.repository);
  assert.equal((await backendRuntime(config, input.artifact)).root, root); // Complete inventory + sourceRepository.
  const recipe = await slotsModule.settingsRecipe({ format: 1, choices: input.choices });
  let requests = 0;
  async function http(path, { body, key, settings = false, expected = 200 } = {}) {
    if (++requests > 96) fail('HOST_EXPLICIT_HTTP_LIMIT');
    const response = await fetch(`http://127.0.0.1:${config.centerPort}${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { authorization: `Bearer ${config.ownerToken}`, ...(body === undefined ? {} : { 'content-type': 'application/json', 'idempotency-key': key }),
        ...(settings ? { 'X-Flow-Execution-Profile': 'flow.claude-turn-settings.v1' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(3000), redirect: 'error' });
    const reader = response.body.getReader(); const chunks = []; let bytes = 0;
    try { assert.equal(response.status, expected, `HTTP_STATUS_${path.split('?')[0]}`);
      for (;;) { const next = await reader.read(); if (next.done) break; bytes += next.value.length;
      if (bytes > 65536) fail('HOST_HTTP_BODY_LIMIT'); chunks.push(next.value); } }
    finally { await reader.cancel(); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  const state = () => preview.readPreviewJson(join(input.directory, 'state.json'));
  async function emptyQueue() {
    const value = (await pool.query('SELECT (SELECT count(*)::int FROM flow.tasks) AS tasks,(SELECT count(*)::int FROM flow.attempts) AS attempts')).rows[0];
    assert.deepEqual(value, { tasks: 0, attempts: 0 });
  }
  const result = { kind: 'SVC09A_REAL_HOST_WITH_INJECTED_ADAPTER', sourceHead: input.sourceHead, providerCalls: 0,
    providerQualification: 'unknown', actualNativeClaim: 'unknown', phases: [] };
  async function phase(name, fact) { result.phases.push({ name, fact }); await checkpoint(name, fact); }
  await phase('before-start', { sourceHead: input.sourceHead, artifactId: input.artifact.artifactId });
  await preview.assertPreviewMarker(config);
  const initialState = await state(); assert.deepEqual(initialState.backendArtifact, input.artifact);
  await preview.withPreviewLock(config, () => preview.startPreviewServices(config, initialState, input.webArtifact, input.artifact));
  await emptyQueue();
  const configured = await preview.loadPreviewConfiguration(input.directory);
  const before = await state();
  const defaultStatus = await preview.statusPreview({ directory: input.directory });
  assert.deepEqual(defaultStatus.runnerSlots.slots.map(v => v.slot), ['legacy']);
  assert.deepEqual(Object.keys(before.processes).sort(), ['center', 'runner', 'web']);
  const legacyFiles = {};
  for (const name of ['config.json', 'claude.json']) legacyFiles[name] = digest(await readFile(join(input.directory, name)));
  const legacyWork = await lstat(join(input.directory, 'runner'), { bigint: true });
  await phase('default-legacy', { processes: before.processes, runnerId: configured.runner.runnerId, files: legacyFiles });
  await preview.activatePreviewMessageSettings({ directory: input.directory, recipe: { format: 1, choices: input.choices } });
  await emptyQueue();
  const slots = await slotsModule.readRunnerSlots(configured), settingsSlot = slots.find(slot => slot.id === 'settings');
  assert.equal(slots.length, 2); assert.ok(settingsSlot); assert.notEqual(settingsSlot.runner.runnerId, configured.runner.runnerId);
  const active = await state();
  for (const key of ['center', 'runner', 'web']) assert.deepEqual(active.processes[key], before.processes[key]);
  for (const [name, hash] of Object.entries(legacyFiles)) assert.equal(digest(await readFile(join(input.directory, name))), hash);
  const unchangedWork = await lstat(join(input.directory, 'runner'), { bigint: true });
  assert.equal(unchangedWork.dev, legacyWork.dev); assert.equal(unchangedWork.ino, legacyWork.ino);
  const settingsProfile = await slotsModule.observeSettingsProfile(settingsSlot, after => http(`/api/execution-profiles?limit=100${after ? `&after=${encodeURIComponent(after)}` : ''}`, { settings: true }));
  assert.ok(settingsProfile); assert.deepEqual(settingsProfile.configuration, recipe.configuration);
  const legacyProfile = (await http('/api/execution-profiles?limit=100')).profiles.find(p => p.reference.runnerId === configured.runner.runnerId);
  assert.ok(legacyProfile); assert.equal(legacyProfile.configuration.turnSettings, undefined);
  await phase('settings-published', { processes: active.processes, legacy: legacyProfile.reference, settings: settingsProfile.reference, choices: input.choices });
  const drained = await maintainPreview({ directory: input.directory, action: 'bootstrap', backendId: input.artifact.artifactId });
  assert.equal(drained.state, 'draining'); assert.equal(drained.slots.length, 2); assert.equal(drained.activeAttempts, 0); assert.equal(drained.uncertainAttempts, 0);
  await phase('both-draining', drained);
  const paused = await maintainPreview({ directory: input.directory, action: 'refresh', target: input.sourceHead });
  assert.equal(paused.state, 'maintenance'); assert.equal(paused.update, 'ready-paused');
  for (const record of Object.values(active.processes)) assert.equal(await processes.inspectOwnedProcess(record), 'stopped');
  const restarted = await state();
  assert.deepEqual(Object.keys(restarted.processes).sort(), ['center', 'runner', 'runner-settings', 'web']);
  for (const [key, record] of Object.entries(restarted.processes)) { assert.notEqual(record.nonce, active.processes[key].nonce); assert.equal(await processes.inspectOwnedProcess(record), 'running'); }
  await phase('both-refreshed-held', { paused, processes: restarted.processes });
  const resumed = await maintainPreview({ directory: input.directory, action: 'resume' });
  assert.equal(resumed.state, 'accepting'); assert.ok(resumed.slots.every(v => v.state === 'accepting'));
  await phase('both-resumed', resumed); await emptyQueue();
  // No tasks exist until both native-capable production pollers have certainly stopped.
  await preview.withPreviewLock(configured, async () => {
    for (const key of ['runner-settings', 'runner']) assert.equal(await processes.stopOwnedProcess(restarted.processes[key]), 'stopped');
  });
  await phase('native-pollers-stopped', { legacy: restarted.processes.runner, settings: restarted.processes['runner-settings'] });
  const { runMixedConsumer } = await import('./mixed-runner.mjs');
  const mixed = await runMixedConsumer({ root, baseUrl: `http://127.0.0.1:${config.centerPort}`, slots,
    profiles: { legacy: legacyProfile, settings: settingsProfile }, choices: input.choices, http, pool, checkpoint });
  await phase('mixed-real-claims', mixed);
  // The independent outer cleanup owner also covers primary errors before this call.
  const stopped = await preview.stopPreview({ directory: input.directory });
  assert.ok(Object.values(stopped.processes).every(value => value === 'stopped'));
  await phase('all-host-slots-stopped', stopped);
  return { ...result, explicitHttpRequests: requests, databaseCleanup: 'pending-independent-owner', overall: 'WORK_COMPLETE_NOT_CLEANUP_PROOF' };
}
