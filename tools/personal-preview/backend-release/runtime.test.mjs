import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, writeFile, readFile, rename, rm, symlink, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { BACKEND_POLICY } from './index.mjs';
import { createLaunchRuntimeResolver, assertInstallationSource, serviceRuntime, backendRuntime } from './host.mjs';
import { inventory } from './files.mjs';
import { nodeIdentity } from './node-identity.mjs';

async function fixture(t) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'runtime-reuse-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const config = { directory, repository: join(directory, 'repository') };
  await mkdir(config.repository, { mode: 0o700 });
  const store = join(directory, 'backend-artifacts'); await mkdir(store, { mode: 0o700 });
  const artifacts = [];
  for (const digit of ['a', 'b', 'c']) {
    const sourceHead = digit.repeat(40), bytes = Buffer.from(JSON.stringify({ sourceHead }));
    const artifactId = createHash('sha256').update(bytes).digest('hex');
    const location = join(store, artifactId), root = join(location, 'root');
    await mkdir(location, { mode: 0o700 }); await mkdir(root, { mode: 0o755 });
    await writeFile(join(location, 'manifest.json'), bytes, { mode: 0o600 });
    artifacts.push({ policy: BACKEND_POLICY, artifactId, manifestDigest: artifactId, sourceHead });
  }
  let calls = 0;
  const resolve = async (value, artifact) => { calls++; const root = artifact ? join(value.directory, 'backend-artifacts', artifact.artifactId, 'root') : value.repository;
    return { root, entry: join(root, 'tools/personal-preview/cli.mjs'), artifact }; };
  const save = (name, value) => writeFile(join(directory, name), JSON.stringify(value), { mode: 0o600 });
  return { config, artifacts, resolve, calls: () => calls, save, root: a => join(store, a.artifactId, 'root'), manifest: a => join(store, a.artifactId, 'manifest.json') };
}

test('source authentication and runtime stage share one full verification for this launch', async t => {
  const f = await fixture(t), a = f.artifacts[0], launch = createLaunchRuntimeResolver(f.resolve);
  await f.save('state.json', { backendArtifact: a });
  await assertInstallationSource(f.config, f.root(a), 'center', launch.resolve); launch.seal();
  const runtime = await serviceRuntime(f.config, { backendArtifact: a }, 'center', launch.resolve);
  assert.equal(runtime.root, f.root(a)); assert.equal(f.calls(), 1);
  assert.throws(() => { runtime.artifact.sourceHead = 'f'.repeat(40); }, TypeError);
  await createLaunchRuntimeResolver(f.resolve).resolve(f.config, a); assert.equal(f.calls(), 2);
});

test('pending source fallback is bounded and independent web selects its own artifact', async t => {
  const f = await fixture(t), [a, b] = f.artifacts, launch = createLaunchRuntimeResolver(f.resolve);
  await f.save('state.json', { backendArtifact: a, webHost: { artifact: b } });
  await f.save('maintenance.json', { backendArtifact: b });
  await assertInstallationSource(f.config, f.root(b), 'runner', launch.resolve); launch.seal();
  await serviceRuntime(f.config, { backendArtifact: b }, 'runner', launch.resolve); assert.equal(f.calls(), 2);
  const web = createLaunchRuntimeResolver(f.resolve);
  await assertInstallationSource(f.config, f.root(b), 'web', web.resolve); web.seal();
  await serviceRuntime(f.config, { backendArtifact: a, webHost: { artifact: b } }, 'web', web.resolve); assert.equal(f.calls(), 3);
});

test('sealed descriptor and installation namespace changes fail before new verification', async t => {
  const f = await fixture(t), [a, b] = f.artifacts;
  for (const [config, artifact] of [[f.config, b], [{ ...f.config, repository: '/different' }, a], [{ ...f.config, directory: '/different' }, a], [f.config, null]]) {
    const launch = createLaunchRuntimeResolver(f.resolve); await launch.resolve(f.config, a); launch.seal();
    const before = f.calls(); await assert.rejects(launch.resolve(config, artifact), { code: 'BACKEND_LAUNCH_IDENTITY_CHANGED' }); assert.equal(f.calls(), before);
  }
});

test('changed manifest bytes and same-byte replaced manifest both reject reuse', async t => {
  const f = await fixture(t), [a, b] = f.artifacts;
  for (const [artifact, replacement] of [[a, Buffer.from('changed')], [b, await readFile(f.manifest(b))]]) {
    const launch = createLaunchRuntimeResolver(f.resolve); await launch.resolve(f.config, artifact); launch.seal();
    const path = f.manifest(artifact); await rename(path, `${path}.original`); await writeFile(path, replacement, { mode: 0o600 });
    await assert.rejects(launch.resolve(f.config, artifact), error => ['BACKEND_MANIFEST_MISMATCH', 'BACKEND_LAUNCH_IDENTITY_CHANGED'].includes(error.code));
  }
});

test('replaced root, symbolic root and private permission changes reject reuse', async t => {
  const f = await fixture(t);
  for (const [index, artifact] of f.artifacts.entries()) {
    const launch = createLaunchRuntimeResolver(f.resolve); await launch.resolve(f.config, artifact); launch.seal();
    const root = f.root(artifact);
    if (index === 2) await chmod(join(root, '..'), 0o755);
    else { await rename(root, `${root}.original`); if (index === 0) await mkdir(root); else await symlink(`${root}.original`, root); }
    await assert.rejects(launch.resolve(f.config, artifact), { code: 'BACKEND_LAUNCH_IDENTITY_CHANGED' });
  }
});

test('mutation while full verification runs is rejected and failure is terminal', async t => {
  const f = await fixture(t), a = f.artifacts[0];
  const launch = createLaunchRuntimeResolver(async (...args) => { const runtime = await f.resolve(...args); await writeFile(f.manifest(a), 'changed'); return runtime; });
  await assert.rejects(launch.resolve(f.config, a), { code: 'BACKEND_MANIFEST_MISMATCH' });
  await assert.rejects(launch.resolve(f.config, a), { code: 'BACKEND_LAUNCH_UNCONFIRMED' }); assert.equal(f.calls(), 1);
});

test('one inflight only and at most two authentication candidates', async t => {
  const f = await fixture(t); let finish, began;
  const started = new Promise(resolve => { began = resolve; });
  const launch = createLaunchRuntimeResolver(async (...args) => { began(); await new Promise(resolve => { finish = resolve; }); return f.resolve(...args); });
  const pending = launch.resolve(f.config, f.artifacts[0]); await started;
  await assert.rejects(launch.resolve(f.config, f.artifacts[0]), { code: 'BACKEND_LAUNCH_UNCONFIRMED' }); finish(); await pending;
  const bounded = createLaunchRuntimeResolver(f.resolve);
  await bounded.resolve(f.config, f.artifacts[0]); await bounded.resolve(f.config, f.artifacts[1]);
  await assert.rejects(bounded.resolve(f.config, f.artifacts[2]), { code: 'BACKEND_LAUNCH_UNCONFIRMED' });
});

test('legacy source authentication and late first artifact resolution keep their original paths', async t => {
  const f = await fixture(t), launch = createLaunchRuntimeResolver(f.resolve);
  await assertInstallationSource(f.config, f.config.repository, 'center', launch.resolve); launch.seal(); assert.equal(f.calls(), 0);
  assert.equal((await launch.resolve(f.config, null)).root, f.config.repository); assert.equal(f.calls(), 1);
  const next = createLaunchRuntimeResolver(f.resolve); next.seal();
  assert.equal((await next.resolve(f.config, f.artifacts[0])).root, f.root(f.artifacts[0]));
});

test('real full artifact verifier is called once across source and service consumers', async t => {
  const f = await fixture(t), stage = join(f.config.directory, 'backend-artifacts', 'stage');
  await mkdir(stage, { mode: 0o700 }); const root = join(stage, 'root'); await mkdir(root, { mode: 0o755 });
  await mkdir(join(root, 'tools/personal-preview/backend-release'), { recursive: true });
  await writeFile(join(root, 'tools/personal-preview/backend-release/host.mjs'), 'export {};\n');
  await writeFile(join(root, 'tools/personal-preview/cli.mjs'), 'export {};\n');
  const sourceHead = 'd'.repeat(40);
  const bytes = JSON.stringify({ policy: BACKEND_POLICY, sourceHead, sourceRepository: f.config.repository, node: await nodeIdentity(), inventory: await inventory(root) });
  const artifactId = createHash('sha256').update(bytes).digest('hex');
  const artifact = { policy: BACKEND_POLICY, artifactId, manifestDigest: artifactId, sourceHead };
  await writeFile(join(stage, 'manifest.json'), bytes, { mode: 0o600 });
  await rename(stage, join(f.config.directory, 'backend-artifacts', artifactId));
  await f.save('state.json', { backendArtifact: artifact });
  let fullVerifications = 0;
  const launch = createLaunchRuntimeResolver(async (...args) => { fullVerifications++; return backendRuntime(...args); });
  await assertInstallationSource(f.config, f.root(artifact), 'center', launch.resolve); launch.seal();
  assert.equal((await serviceRuntime(f.config, { backendArtifact: artifact }, 'center', launch.resolve)).root, f.root(artifact));
  assert.equal(fullVerifications, 1);
});
