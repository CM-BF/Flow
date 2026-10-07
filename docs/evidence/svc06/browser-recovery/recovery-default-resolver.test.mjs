import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, realpath, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const fixed = JSON.parse(await readFile(new URL('./recovery-default-resolver.json', import.meta.url)));
const repository = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-browser-recovery';
const original = execFileSync('/usr/bin/git', ['show', `${fixed.base}:${fixed.path}`], { cwd: repository, encoding: 'utf8' });
const hostSource = execFileSync('/usr/bin/git', ['show', `${fixed.base}:tools/personal-preview/backend-release/host.mjs`], { cwd: repository, encoding: 'utf8' });
assert.equal(createHash('sha256').update(original).digest('hex'), fixed.before.sha256);
assert.equal(original.split(fixed.replacement.before).length, 2);
const corrected = original.replace(fixed.replacement.before, fixed.replacement.after);
assert.equal(createHash('sha256').update(corrected).digest('hex'), fixed.after.sha256);
const fail = code => { throw Object.assign(new Error(code), { code }); };

// Execute the real public preview export and real host identity branch. Only the
// full artifact inventory verifier and unrelated services are injected; no PG,
// installed artifact, personal directory or service is accessed by this fixture.
async function fixture(t, { legacy = false, source = corrected, wrongSource = false, launch = false } = {}) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'resolver-default-')));
  t.after(() => rm(directory, { recursive: true }));
  const manifest = Buffer.from(JSON.stringify({ fixture: true }));
  const artifactId = launch ? createHash('sha256').update(manifest).digest('hex') : 'b'.repeat(64);
  const moduleRoot = launch ? join(directory, 'backend-artifacts', artifactId, 'root') : join(directory, 'artifact-root');
  await mkdir(moduleRoot, { mode: 0o700, recursive: true });
  if (launch) await writeFile(join(moduleRoot, '..', 'manifest.json'), manifest, { mode: 0o600 });
  const config = { format: 1, installationId: randomUUID(), directory,
    repository: legacy ? moduleRoot : join(directory, 'source-repository'),
    databaseName: `flow_preview_${'a'.repeat(24)}`,
    databaseUrl: `postgresql://fixture@127.0.0.1:55432/flow_preview_${'a'.repeat(24)}`,
    adminUrl: 'postgresql://fixture@127.0.0.1:55432/postgres', centerPort: 1234, webPort: 1235 };
  const artifact = { policy: 'flow.backend-artifact.v1', artifactId, manifestDigest: artifactId, sourceHead: 'c'.repeat(40) };
  const nonce = randomUUID(), stages = [], spawned = [];
  for (const [name, value] of [['config.json', config], ['state.json', { backendArtifact: artifact,
    processes: launch ? { center: { nonce, pid: process.pid } } : {} }]]) {
    await writeFile(join(directory, name), JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  }
  let verifications = 0;
  const processPort = launch ? { ...process, argv: ['node', 'fixture', `--flow-preview=${nonce}`], on() {}, off() {} } : process;
  const context = vm.createContext({ process: processPort, Buffer, URL, AbortSignal });
  const synthetic = values => new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
  const verifyBackendArtifact = async input => {
    assert.equal(input.directory, directory); assert.equal(JSON.stringify(input.artifact), JSON.stringify(artifact));
    verifications++;
    return { root: moduleRoot, manifest: { sourceRepository: wrongSource ? '/different' : config.repository,
      inventory: { entries: [{ path: 'tools/personal-preview/backend-release/host.mjs' }] } } };
  };
  const host = new vm.SourceTextModule(hostSource, { context });
  await host.link(async specifier => {
    if (specifier.startsWith('node:')) return synthetic(await import(specifier));
    if (specifier === './index.mjs') return synthetic({ BACKEND_POLICY: artifact.policy, verifyBackendArtifact });
    if (specifier === './files.mjs') return synthetic({ fail });
    throw new Error('unexpected host dependency');
  });
  await host.evaluate();
  const url = pathToFileURL(join(moduleRoot, 'tools/personal-preview/preview.mjs'));
  const preview = new vm.SourceTextModule(source, { context, identifier: url.href, initializeImportMeta: meta => { meta.url = url.href; } });
  const imports = new Map([...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)].map(match => [match[2], match[1].split(',').map(v => v.trim())]));
  await preview.link(async specifier => {
    if (specifier === './backend-release/host.mjs') return host;
    if (specifier === 'node:child_process') return synthetic({ spawn: (...args) => {
      assert.ok(launch); assert.equal(verifications, 1); spawned.push(args); return { pid: 9876, kill() {} };
    },
      execFile: (_file, _args, _options, done) => done(Object.assign(new Error('synthetic'), { code: 128, stderr: 'not a git repository' })) });
    if (specifier.startsWith('node:')) return synthetic(await import(specifier));
    const values = Object.fromEntries(imports.get(specifier).map(name => [name, () => fail('UNUSED_SERVICE_PORT')]));
    if (specifier === './browser-session-configuration.mjs') {
      values.pinnedBrowserSessionConfiguration = async () => null;
      values.readBrowserSessionLaunch = async () => ({ settings: null });
    }
    if (launch && specifier === 'pg') values.Pool = class {
      async query() { return { rows: [{ installation_id: config.installationId, directory }] }; }
      async end() {}
    };
    if (launch && specifier === './environment.mjs') values.serviceEnvironment = () => ({});
    if (launch && specifier === './startup-diagnostics.mjs') Object.assign(values, {
      openStartupDiagnostics: async () => ({ stage: async phase => { stages.push(phase); }, finish: async () => {} }),
      observeStartupChild: async () => ({ code: 0 }),
      startupFailure: (error, role, phase) => ({ role, phase, name: error.name, code: error.code ?? null }),
      startupErrorCode: error => error.code ?? null,
    });
    return synthetic(values);
  });
  await preview.evaluate();
  return { config, artifact, moduleRoot, preview: preview.namespace, stages, spawned, verifications: () => verifications };
}

test('fixed f37 public default load reproduces TypeError before the verifier', async t => {
  const f = await fixture(t, { source: original });
  await assert.rejects(f.preview.loadPreviewConfiguration(f.config.directory), error => error.name === 'TypeError');
  assert.equal(f.verifications(), 0);
});
test('corrected public default load authenticates artifact through the original host resolver', async t => {
  const f = await fixture(t);
  assert.equal((await f.preview.loadPreviewConfiguration(f.config.directory)).installationId, f.config.installationId);
  assert.equal(f.verifications(), 1);
});
test('corrected public load preserves an explicit launch resolver and its descriptor', async t => {
  const f = await fixture(t); let calls = 0;
  const loaded = await f.preview.loadPreviewConfiguration(f.config.directory, 'runner', async (config, artifact) => {
    calls++; assert.equal(config.directory, f.config.directory); assert.equal(JSON.stringify(artifact), JSON.stringify(f.artifact));
    return { root: f.moduleRoot };
  });
  assert.equal(loaded.installationId, f.config.installationId); assert.equal(calls, 1); assert.equal(f.verifications(), 0);
});
test('corrected public default load still rejects an artifact from a different source', async t => {
  const f = await fixture(t, { wrongSource: true });
  await assert.rejects(f.preview.loadPreviewConfiguration(f.config.directory), { code: 'BACKEND_INSTALLATION_SOURCE_MISMATCH' });
  assert.equal(f.verifications(), 1);
});
test('corrected public legacy load retains the original repository identity path', async t => {
  const f = await fixture(t, { legacy: true });
  assert.equal((await f.preview.loadPreviewConfiguration(f.config.directory)).repository, f.moduleRoot);
  assert.equal(f.verifications(), 0);
});

const repair = JSON.parse(await readFile(new URL('./recovery-resolver-repair.json', import.meta.url)));
let repaired = original;
for (const change of repair.replacements) {
  assert.equal(repaired.split(change.before).length, 2);
  repaired = repaired.replace(change.before, change.after);
}
assert.equal(createHash('sha256').update(repaired).digest('hex'), repair.after.sha256);
test('runService original object passed to load fails before any service stage', async t => {
  const f = await fixture(t, { launch: true, source: corrected });
  await assert.rejects(f.preview.runService(f.config.directory, 'center'), error => error.name === 'TypeError');
  assert.equal(f.verifications(), 0); assert.deepEqual(f.stages, []); assert.deepEqual(f.spawned, []);
});
test('runService corrected load alone still rejects the object passed to runtime before spawn', async t => {
  const f = await fixture(t, { launch: true, source: corrected.replace(repair.replacements[1].before, repair.replacements[1].after) });
  await assert.rejects(f.preview.runService(f.config.directory, 'center'), error => error.name === 'TypeError');
  assert.equal(f.verifications(), 1); assert.deepEqual(f.stages, ['marker', 'policy', 'runtime']); assert.deepEqual(f.spawned, []);
});
test('runService repaired real resolver authenticates and seals then reuses one full verification', async t => {
  const f = await fixture(t, { launch: true, source: repaired });
  await f.preview.runService(f.config.directory, 'center');
  assert.equal(f.verifications(), 1); assert.deepEqual(f.stages, ['marker', 'policy', 'runtime', 'child-spawn']);
  assert.equal(f.spawned.length, 1); assert.equal(f.spawned[0][2].cwd, f.moduleRoot);
  assert.equal(JSON.parse(await readFile(join(f.config.directory, 'center-exit.json'), 'utf8')).code, 0);
});
