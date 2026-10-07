import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile, writeFile, mkdtemp, readdir, lstat, unlink, rmdir, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm';
import { saveJson } from './backend-release/files.mjs';

const require = createRequire(import.meta.url);
const ts = require('/Users/citrine/Projects/AgentHarness/Flow/node_modules/typescript');
const ownScratch = process.env.FLOW_MAINTENANCE_TARGET_SCRATCH;
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value !== null && typeof value === 'object'
  ? `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}` : JSON.stringify(value);
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const artifact = letter => ({ policy: 'flow.backend-artifact.v1', artifactId: letter.repeat(64), manifestDigest: letter.repeat(64), sourceHead: letter.repeat(40) });
const operationId = '11111111-1111-1111-1111-111111111111';
const runnerId = '22222222-2222-2222-2222-222222222222';
const requestId = '33333333-3333-3333-3333-333333333333';
const error = code => Object.assign(Error('synthetic private detail never published'), { code });

async function fixture(options, run) {
  assert.ok(ownScratch, 'explicit supervised own scratch required');
  const directory = await mkdtemp(join(ownScratch, 'target-')), identity = await lstat(directory);
  const state = { backendArtifact: artifact('a'), webHost: { artifact: artifact('c'), source: { digest: 'd'.repeat(64) } },
    processes: Object.fromEntries(['center', 'runner', 'web'].map((role, index) => [role, { role, pid: 500 + index, nonce: role }])) };
  const operation = { operationId, target: artifact('a').sourceHead, backendArtifact: artifact('a'), phase: 'starting',
    initialVersion: 21, holdKey: 'old-held-key', resumeKey: 'old-unused-resume-key' };
  const release = { version: 3, artifacts: [artifact('d'), artifact('e'), artifact('f')], retainedReports: ['old-1', 'old-2', 'old-3'] };
  const config = { directory, repository: '/synthetic/fixed-old-source', runner: { runnerId, token: 'synthetic-token' }, databaseUrl: 'postgres://synthetic.invalid/unused' };
  for (const [name, value] of Object.entries({ 'maintenance.json': operation, 'state.json': state, 'web-release.json': release })) await writeFile(join(directory, name), JSON.stringify(value), { mode: 0o600, flag: 'wx' });
  const input = { directory, operationId, requestId, expectedVersion: 23, expectedOperationDigest: digest(operation), expectedStateDigest: digest(state),
    expectedWebReleaseDigest: digest(release), expectedBackendArtifact: artifact('a'), expectedWebHostArtifact: artifact('c'), targetArtifact: artifact('b') };
  const calls = [], client = new EventEmitter(); let lock = false, writeCount = 0;
  client.query = async (sql, params) => {
    assert.equal(lock, true); calls.push(sql);
    if (sql.includes('FROM flow.runners')) {
      assert.match(sql, /FOR UPDATE$/); assert.deepEqual(Array.from(params), [runnerId]);
      return { rows: [{ id: runnerId, token_hash: createHash('sha256').update(config.runner.token).digest('hex'), revoked: false,
        maintenance_state: 'maintenance', maintenance_version: options.version ?? 23, maintenance_operation_id: operationId }] };
    }
    if (sql.includes('FROM flow.attempts')) { assert.match(sql, /completed_at IS NULL/); assert.deepEqual(Array.from(params), [runnerId]); return { rows: [{ active: options.active ?? 0, uncertain: options.uncertain ?? 0 }] }; }
    if (sql === 'COMMIT' && options.commitFailure) throw error('EIO');
    return { rows: [] };
  };
  client.release = discard => { calls.push(['release', discard]); };
  const readPrivate = async path => JSON.parse(await readFile(path, 'utf8'));
  const context = createContext({ Buffer, process: { getuid: () => process.getuid() } });
  const ports = {
    'node:crypto': { createHash }, 'node:path': { isAbsolute: path => path.startsWith('/'), join }, 'node:fs': { constants },
    'node:fs/promises': { open: async (...args) => {
      const handle = await open(...args);
      if (args[0] === directory && options.syncFailure) return { sync: async () => { throw error('EIO'); }, close: () => handle.close() };
      return handle;
    } },
    pg: { Pool: class {
      constructor(value) { calls.push('pool'); assert.equal(value.max, 1); assert.equal(value.connectionTimeoutMillis, 1500); assert.equal(value.statement_timeout, 3000); }
      connect(callback) { callback(null, client); }
      async end() { calls.push('pool.end'); if (options.endFailure) throw error('EPERM'); }
    } },
    './preview.mjs': { readPreviewJson: readPrivate, withPreviewLock: async (_config, callback) => {
      assert.equal(_config, config); lock = true;
      try { return await callback(); } finally { lock = false; if (options.lockFailure) throw error('EIO'); }
    }, assertPreviewMarker: async value => { assert.equal(value, config); calls.push('marker'); },
    inspectPreviewWebHostSource: async ({ directory: selectedDirectory, webHostArtifact }) => { assert.equal(selectedDirectory, directory); assert.equal(webHostArtifact.artifactId, artifact('b').artifactId); calls.push('new-web-source'); return { policy: 'flow.web-host-source.v1', digest: 'b'.repeat(64), files: [] }; } },
    './backend-release/host.mjs': {
      webHostArtifactDescriptor: value => { assert.ok(value?.artifactId); return { ...value }; },
      backendRuntime: async (value, selected) => { assert.equal(value, config); assert.equal(selected.artifactId, input.targetArtifact.artifactId); calls.push('target-verified'); },
      serviceRuntime: async (_config, selected, role) => { assert.equal(role, 'web'); assert.equal((selected.pendingWebHost ?? selected.webHost).artifact.artifactId, artifact(selected.pendingWebHost ? 'b' : 'c').artifactId); calls.push(selected.pendingWebHost ? 'new-web-verified' : 'old-web-verified'); },
    },
    './backend-release/files.mjs': { saveJson: async (path, value) => { assert.equal(lock, true); calls.push('write'); writeCount++;
      if (options.failWriteNumber === writeCount) throw error('ENOSPC');
      if (options.writeFailure === 'before') throw error('ENOSPC');
      await saveJson(path, value);
      if (options.writeFailure === 'after') throw error('EIO');
    } },
    './web-release.mjs': { readWebRelease: async () => options.noRelease ? null : readPrivate(join(directory, 'web-release.json')),
      findWebCompatibility: async args => { assert.equal(args.backendHead, input.targetArtifact.sourceHead); calls.push('web-qualification'); if (options.missingReport) throw error('WEB_COMPATIBILITY_REQUIRED'); },
      loadReleaseAssets: async args => { assert.equal(args.expectedBackendHead, input.targetArtifact.sourceHead); calls.push('assets'); } },
    './browser-session-configuration.mjs': { pinnedBrowserSessionConfiguration: async () => ({ context: null }) },
    './process.mjs': { inspectOwnedProcess: async record => { calls.push(['inspect', record.role]); return record.role === options.unknownRole ? 'unknown' : 'stopped'; } },
  };
  const source = await readFile(new URL('./maintenance-target.mjs', import.meta.url), 'utf8');
  const database = ts.transpileModule(await readFile(new URL('../../apps/server/src/database.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
  const entry = new SourceTextModule(source, { context }), db = new SourceTextModule(database, { context });
  async function link(specifier) {
    if (specifier === '../../apps/server/src/database.ts') return db;
    const values = specifier === 'node:fs/promises' ? { ...ports[specifier], readFile: async () => { throw Error('No migration reads'); } } : ports[specifier];
    assert.ok(values, `undeclared ${specifier}`);
    return new SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context });
  }
  await entry.link(link); await entry.evaluate();
  const invoke = request => entry.namespace.rebindHeldPreviewTarget(request, { loadCurrentConfiguration: async value => { assert.equal(value, directory); calls.push('old-authorized-loader'); return config; } });
  const select = async (selectedState, selectedOperation) => {
    lock = true;
    try { return await entry.namespace.selectHeldPreviewWebHost(config, new ports.pg.Pool({ max: 1, connectionTimeoutMillis: 1500, statement_timeout: 3000 }), selectedState, selectedOperation); }
    finally { lock = false; }
  };
  try { await run({ input, calls, invoke, select, read: readPrivate, directory, operation, state, release }); }
  finally {
    const current = await lstat(directory); assert.equal(current.dev, identity.dev); assert.equal(current.ino, identity.ino);
    for (const name of await readdir(directory)) { const path = join(directory, name), info = await lstat(path); assert.ok(info.isFile() && !info.isSymbolicLink() && info.nlink === 1 && info.uid === process.getuid()); await unlink(path); }
    await rmdir(directory);
  }
}

test('held target binds one backend and Web intent while preserving old Web in a private audit under the runner lock', { skip: !ownScratch }, async () => fixture({}, async f => {
  const result = await f.invoke(f.input); assert.equal(result.outcome, 'target-bound'); assert.equal(result.mutation, 'observed-written');
  const next = await f.read(join(f.directory, 'maintenance.json'));
  assert.equal(next.operationId, operationId); assert.equal(next.phase, 'target-bound'); assert.equal(next.resumeKey, f.operation.resumeKey);
  assert.equal(next.targetRebindings[0].before.backendArtifact.artifactId, artifact('a').artifactId);
  assert.equal(next.backendArtifact.artifactId, artifact('b').artifactId);
  assert.equal(next.webHostTarget.artifact.artifactId, artifact('b').artifactId); assert.equal(next.webHostTarget.status, 'pending');
  assert.deepEqual(next.targetRebindings[0].before.webHost, f.state.webHost);
  assert.deepEqual(next.targetRebindings[0].before.processes, f.state.processes);
  assert.equal(f.calls.filter(x => x === 'web-qualification').length, 3);
  assert.ok(f.calls.includes('old-web-verified') && f.calls.includes('new-web-verified'));
  assert.equal((await lstat(join(f.directory, 'maintenance.json'))).mode & 0o777, 0o600);
  assert.deepEqual(await f.read(join(f.directory, 'state.json')), f.state); assert.deepEqual(await f.read(join(f.directory, 'web-release.json')), f.release);
  assert.ok(f.calls.indexOf('web-qualification') < f.calls.indexOf('pool'));
  assert.ok(f.calls.findIndex(x => typeof x === 'string' && x.includes('FOR UPDATE')) < f.calls.indexOf('write'));
  assert.equal(f.calls.filter(x => Array.isArray(x) && x[0] === 'inspect').length, 3);
  assert.equal(f.calls.filter(x => typeof x === 'string' && /UPDATE flow|INSERT INTO|DELETE FROM/.test(x)).length, 0);
}));
for (const [name, options, code] of [
  ['version changed', { version: 24 }, 'MAINTENANCE_TARGET_HOLD'], ['active work', { active: 1 }, 'MAINTENANCE_TARGET_BUSY'],
  ['uncertain work', { uncertain: 1 }, 'MAINTENANCE_TARGET_BUSY'], ['unknown group', { unknownRole: 'runner' }, 'MAINTENANCE_TARGET_PROCESSES'],
  ['missing new-source report', { missingReport: true }, 'WEB_COMPATIBILITY_REQUIRED'],
]) test(`held target rejects ${name} without rewriting the operation`, { skip: !ownScratch }, async () => fixture(options, async f => {
  const result = await f.invoke(f.input); assert.equal(result.outcome, 'unconfirmed'); assert.equal(result.primary.code, code); assert.equal(result.mutation, 'not-written');
  assert.deepEqual(await f.read(join(f.directory, 'maintenance.json')), f.operation); assert.ok(!f.calls.includes('write'));
}));
test('held target rejects a changed local operation and never treats an absent release as permission to build', { skip: !ownScratch }, async () => {
  await fixture({}, async f => { const result = await f.invoke({ ...f.input, expectedOperationDigest: 'f'.repeat(64) }); assert.equal(result.primary.code, 'MAINTENANCE_TARGET_CHANGED'); assert.ok(!f.calls.includes('pool')); });
  await fixture({ noRelease: true }, async f => { f.input.expectedWebReleaseDigest = digest(null); const result = await f.invoke(f.input); assert.equal(result.primary.code, 'MAINTENANCE_TARGET_WEB'); assert.ok(!f.calls.includes('web-qualification')); });
});
for (const [name, options, persisted] of [
  ['pre-write failure', { writeFailure: 'before' }, false], ['post-rename failure', { writeFailure: 'after' }, true],
  ['directory sync failure', { syncFailure: true }, true], ['commit acknowledgement failure', { commitFailure: true }, true],
]) test(`held target retains ${name} as unconfirmed, without retry or rollback of the private target`, { skip: !ownScratch }, async () => fixture(options, async f => {
  const result = await f.invoke(f.input); assert.equal(result.outcome, 'unconfirmed'); assert.ok(result.primary); assert.equal(result.retry, 'not-authorized');
  assert.equal(f.calls.filter(x => x === 'write').length, 1);
  const observed = await f.read(join(f.directory, 'maintenance.json')); assert.equal(observed.backendArtifact.artifactId, artifact(persisted ? 'b' : 'a').artifactId);
  if (persisted) { const replay = await f.invoke(f.input); assert.equal(replay.mutation, 'not-written'); assert.equal(replay.primary.code, 'MAINTENANCE_TARGET_CHANGED'); }
  assert.ok(!JSON.stringify(result).includes('synthetic private'));
}));
test('held target preserves first write error separately from pool and lock release errors', { skip: !ownScratch }, async () => fixture({ writeFailure: 'after', endFailure: true, lockFailure: true }, async f => {
  const result = await f.invoke(f.input); assert.equal(result.primary.phase, 'operation-write'); assert.equal(result.primary.code, 'EIO');
  assert.deepEqual(Array.from(result.cleanup, x => x.phase), ['pool-close', 'lock-release']); assert.equal(result.outcome, 'unconfirmed');
}));


test('held Web selection consumes the same target under the row lock and records selected-stopped without starting', { skip: !ownScratch }, async () => fixture({}, async f => {
  assert.equal((await f.invoke(f.input)).outcome, 'target-bound');
  const operation = await f.read(join(f.directory, 'maintenance.json')), state = await f.read(join(f.directory, 'state.json'));
  await f.select(state, operation);
  assert.equal(state.webHost.selection, 'selected-stopped'); assert.equal(state.webHost.artifact.artifactId, operation.backendArtifact.artifactId);
  assert.equal(state.backendArtifact.artifactId, artifact('a').artifactId); assert.deepEqual(state.processes, f.state.processes);
  assert.equal(operation.webHostTarget.status, 'selected-stopped'); assert.equal(operation.webHostTarget.selectedStateDigest, digest(state));
  assert.deepEqual(await f.read(join(f.directory, 'state.json')), state);
  assert.equal(f.calls.filter(x => x === 'write').length, 3);
  assert.equal(f.calls.filter(x => Array.isArray(x) && x[0] === 'inspect').length, 6);
  await assert.rejects(f.select(state, operation), { code: 'MAINTENANCE_TARGET_SELECTION' });
}));
test('held Web selection refuses changed release before state write', { skip: !ownScratch }, async () => fixture({}, async f => {
  await f.invoke(f.input);
  const operation = await f.read(join(f.directory, 'maintenance.json'));
  await writeFile(join(f.directory, 'web-release.json'), JSON.stringify({ ...f.release, version: 4 }));
  await assert.rejects(f.select(f.state, operation), { code: 'MAINTENANCE_TARGET_CHANGED' });
  assert.deepEqual(await f.read(join(f.directory, 'state.json')), f.state); assert.equal(f.calls.filter(x => x === 'write').length, 1);
}));
test('interrupted Web selection retains new selected-stopped state and old pending intent, refusing blind retry', { skip: !ownScratch }, async () => fixture({ failWriteNumber: 3 }, async f => {
  await f.invoke(f.input); const operation = await f.read(join(f.directory, 'maintenance.json'));
  await assert.rejects(f.select(f.state, operation), { code: 'ENOSPC' });
  const persisted = await f.read(join(f.directory, 'state.json'));
  assert.equal(persisted.webHost.selection, 'selected-stopped'); assert.equal(persisted.webHost.artifact.artifactId, artifact('b').artifactId);
  assert.equal((await f.read(join(f.directory, 'maintenance.json'))).webHostTarget.status, 'pending');
  await assert.rejects(f.select(persisted, operation), { code: 'MAINTENANCE_TARGET_CHANGED' });
}));
