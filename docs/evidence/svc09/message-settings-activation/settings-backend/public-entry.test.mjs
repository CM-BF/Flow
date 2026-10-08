import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { mkdir, mkdtemp, realpath, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { loadSettingsBuild, composeSettingsInput, main, TARGET } from './build-entry.mjs';

const delta = JSON.parse(await readFile(new URL('./build-inputs.json', import.meta.url)));
const root = delta.sourceDirectory, sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = async path => {
  const bytes = await readFile(join(root, path)), pin = delta.sourceChanges.find(row => row.path === path);
  if (pin) { assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256); }
  return bytes.toString();
};
const previewSource = await source('tools/personal-preview/preview.mjs');
const hostSource = await source('tools/personal-preview/backend-release/host.mjs');
const slotSource = await source('tools/personal-preview/runner-slots.mjs');
const fail = code => { throw Object.assign(new Error(code), { code }); };

// Real public exports, source identity and launch resolver; synthetic inventory,
// PG and child only. This is not artifact import, an actual service, or a profile claim.
async function fixture(t, { wrongSource = false, role = 'center' } = {}) {
  const directory = await realpath(await mkdtemp(join(process.env.TMPDIR, 'settings-entry-')));
  t.after(() => rm(directory, { recursive: true }));
  const manifest = Buffer.from('{"synthetic":true}'), artifactId = sha(manifest);
  const moduleRoot = join(directory, 'backend-artifacts', artifactId, 'root');
  await mkdir(moduleRoot, { mode: 0o700, recursive: true });
  await writeFile(join(moduleRoot, '..', 'manifest.json'), manifest, { mode: 0o600 });
  const artifact = { policy: 'flow.backend-artifact.v1', artifactId, manifestDigest: artifactId, sourceHead: TARGET };
  const config = { format: 1, installationId: randomUUID(), directory, repository: join(directory, 'source'),
    databaseName: `flow_preview_${'a'.repeat(24)}`, databaseUrl: `postgresql://fixture@127.0.0.1:55432/flow_preview_${'a'.repeat(24)}`,
    adminUrl: 'postgresql://fixture@127.0.0.1:55432/postgres', centerPort: 1234, webPort: 1235,
    runner: { runnerId: randomUUID(), token: 'fixture-only' } };
  const nonce = randomUUID(), stages = [], spawned = [];
  const processPort = { ...process, argv: ['node', 'fixture', `--flow-preview=${nonce}`], on() {}, off() {} };
  const context = vm.createContext({ process: processPort, Buffer, URL, AbortSignal });
  const synthetic = values => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
  const slots = new vm.SourceTextModule(slotSource, { context });
  await slots.link(async name => { assert.ok(name.startsWith('node:')); return synthetic(await import(name)); });
  await slots.evaluate();
  for (const [name, value] of [['config.json', config], ['state.json', { backendArtifact: artifact, processes: { [role]: { nonce, pid: process.pid } } }],
    ['claude.json', slots.namespace.LEGACY_NATIVE_CONFIGURATION]]) await writeFile(join(directory, name), JSON.stringify(value), { mode: 0o600 });
  let verifications = 0;
  const host = new vm.SourceTextModule(hostSource, { context });
  await host.link(async name => {
    if (name.startsWith('node:')) return synthetic(await import(name));
    if (name === './files.mjs') return synthetic({ fail });
    assert.equal(name, './index.mjs');
    return synthetic({ BACKEND_POLICY: artifact.policy, verifyBackendArtifact: async input => {
      assert.equal(input.directory, directory); assert.equal(JSON.stringify(input.artifact), JSON.stringify(artifact)); verifications++;
      return { root: moduleRoot, manifest: { sourceRepository: wrongSource ? '/different' : config.repository,
        inventory: { entries: [{ path: 'tools/personal-preview/backend-release/host.mjs' }] } } };
    } });
  });
  await host.evaluate();
  const url = pathToFileURL(join(moduleRoot, 'tools/personal-preview/preview.mjs'));
  const preview = new vm.SourceTextModule(previewSource, { context, identifier: url.href, initializeImportMeta: meta => { meta.url = url.href; } });
  const imports = new Map([...previewSource.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)].map(match => [match[2], match[1].split(',').map(v => v.trim())]));
  await preview.link(async name => {
    if (name === './backend-release/host.mjs') return host;
    if (name === './runner-slots.mjs') return slots;
    if (name === 'node:child_process') return synthetic({ spawn: (...args) => {
      assert.equal(verifications, 1); spawned.push(args); return { pid: 9876, kill() {} };
    }, execFile: (_file, _args, _options, done) => done(Object.assign(new Error('synthetic'), { code: 128, stderr: 'not a git repository' })) });
    if (name.startsWith('node:')) return synthetic(await import(name));
    const values = Object.fromEntries(imports.get(name).map(key => [key, () => fail('UNUSED_PORT')]));
    if (name === 'pg') values.Pool = class { async query() { return { rows: [{ installation_id: config.installationId, directory }] }; } async end() {} };
    if (name === './browser-session-configuration.mjs') Object.assign(values, { pinnedBrowserSessionConfiguration: async () => null, readBrowserSessionLaunch: async () => ({ settings: null }) });
    if (name === './environment.mjs') values.serviceEnvironment = () => ({});
    if (name === './startup-diagnostics.mjs') Object.assign(values, {
      openStartupDiagnostics: async () => ({ stage: async value => stages.push(value), finish: async () => {} }),
      observeStartupChild: async (_child, _diagnostic, options) => { if (role === 'runner') assert.equal(options.runnerId, config.runner.runnerId); return { code: 0 }; },
      startupFailure: error => ({ name: error.name }), startupErrorCode: error => error.code ?? null,
    });
    return synthetic(values);
  });
  await preview.evaluate();
  return { config, preview: preview.namespace, verifications: () => verifications, spawned, stages };
}
test('settings source public default load resolves a selected artifact with real host identity checks', async t => {
  const f = await fixture(t); assert.equal((await f.preview.loadPreviewConfiguration(f.config.directory)).installationId, f.config.installationId);
  assert.equal(f.verifications(), 1);
});
test('settings source public default rejects a mismatched source', async t => {
  const f = await fixture(t, { wrongSource: true }); await assert.rejects(f.preview.loadPreviewConfiguration(f.config.directory), { code: 'BACKEND_INSTALLATION_SOURCE_MISMATCH' });
});
for (const role of ['center', 'runner']) test(`settings source ${role} wrapper uses resolve function and sealed single-launch verification`, async t => {
  const f = await fixture(t, { role }); await f.preview.runService(f.config.directory, role);
  assert.equal(f.verifications(), 1); assert.deepEqual(f.stages, ['marker', 'policy', 'runtime', 'child-spawn']); assert.equal(f.spawned.length, 1);
  if (role === 'runner') assert.equal(f.spawned[0][2].stdio[3], 'ipc');
});
test('settings source current initialization checks both actual slot keys and rejects stale nonce', async t => {
  const directory = await realpath(await mkdtemp(join(process.env.TMPDIR, 'settings-init-'))); t.after(() => rm(directory, { recursive: true }));
  await mkdir(join(directory, 'startup-diagnostics'), { mode: 0o700 });
  const { readRunnerInitialization } = await import(pathToFileURL(join(root, 'tools/personal-preview/startup-diagnostics.mjs')));
  for (const recordKey of ['runner', 'runner-settings']) {
    const record = { nonce: randomUUID(), pid: process.pid }, runnerId = randomUUID();
    const options = { directory, recordKey, record, runnerId };
    assert.equal(await readRunnerInitialization(options), false);
    await writeFile(join(directory, 'startup-diagnostics', `${recordKey}-${record.nonce}.json`), JSON.stringify({ format: 1, role: 'runner', recordKey,
      nonce: record.nonce, pid: record.pid, phase: 'child-running', runtimeInitialized: { protocol: 'flow.runner-startup.v1', runnerId, childPid: 9876 } }), { mode: 0o600 });
    assert.equal(await readRunnerInitialization(options), true);
    assert.equal(await readRunnerInitialization({ ...options, record: { ...record, nonce: randomUUID() } }), false);
  }
});
test('settings build actual input closure composes ten exact leaves and preserves SQL/runtime limits', async () => {
  const { input } = await loadSettingsBuild(); assert.equal(input.target, TARGET); assert.equal(input.sql.length, 33);
  assert.equal(input.resources.additionalBudgetBytes, 2317352960);
  for (const row of input.fixedSourceInputs) { const bytes = await readFile(join(root, row.path)); assert.equal(bytes.length, row.bytes); assert.equal(sha(bytes), row.sha256); }
  for (const row of input.sql) assert.equal(sha(await readFile(join(root, row.path))), row.sha256);
  const { LIMITS } = await import(pathToFileURL(join(root, 'tools/personal-preview/backend-release/files.mjs'))); assert.equal(LIMITS.artifacts, 5);
  await assert.rejects(main(['--execute-fixed-build']));
  assert.throws(() => composeSettingsInput({ ...input, target: delta.base }, { ...delta, sourceChanges: delta.sourceChanges.slice(1) }));
});
