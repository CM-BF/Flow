import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { test, vi } from 'vitest';
import { prepareDarwinWriterHost, prepareDarwinStockHelper, prepareDarwinReadOnlyHost, type StockHelperCompletion } from './native-authority.js';
import * as codex from '../codex/index.js';
import { STOCK_CODEX } from './native-authority-darwin.js';
import { normalizeOptions } from '../codex/options.js';

const root = process.env.FLOW_ENG01J_SCRATCH;
const binary = process.env.FLOW_ENG01J_CANARY;
const inherited = Number(process.env.FLOW_ENG01J_INHERITED_FD);
// Ordinary collection must neither require a canary nor spawn a native process.
const canRun = process.platform === 'darwin' && process.env.FLOW_ENG01J_DARWIN_CANARY === '1'
  && Boolean(root && binary) && Number.isSafeInteger(inherited) && inherited >= 3;
function fixture() {
  assert.ok(root && binary);
  const directory = mkdtempSync(join(root!, 'writer-'));
  const executable = join(directory, 'canary'); copyFileSync(binary!, executable);
  writeFileSync(join(directory, 'calculator.mjs'), '0'); writeFileSync(join(directory, 'baseline.txt'), '0');
  return { directory, executable, executableSha256: createHash('sha256').update(readFileSync(executable)).digest('hex'), arguments: ['app-server', String(inherited)] };
}

test.skipIf(!canRun)('real R06 factory closes the inherited regular FD and holds the sandboxed writer handle', async () => {
  assert.ok(fstatSync(inherited).isFile());
  assert.equal(writeSync(inherited, 'P'), 1); // This FD really is writable in the Node host, before R06 spawn.
  const input = fixture(), host = await prepareDarwinWriterHost(input);
  const controller = new AbortController();
  const transport = host.createTransport({ signal: controller.signal, workingDirectory: input.directory });
  try {
    await transport.ready;
    const pid = transport.snapshot().pid;
    assert.ok(pid);
    assert.deepEqual(await transport.receive(), { kind: 'notification', method: 'canary/result', params: {
      pid, inheritedWrite: -1, inheritedErrno: 9, allowedWrite: 1, deniedOpen: -1, deniedErrno: 1,
    } });
    assert.equal(readFileSync(join(input.directory, 'calculator.mjs'), 'utf8'), 'X');
    assert.equal(readFileSync(join(input.directory, 'baseline.txt'), 'utf8'), '0');
    assert.throws(() => host.createTransport({ signal: controller.signal, workingDirectory: input.directory }));
  } finally {
    const stopped = await host.close();
    assert.equal(stopped.child, 'confirmed-exited');
    assert.equal(stopped.writeAccess, 'unknown'); // No model/all-delegation qualification was granted.
    assert.deepEqual(await host.close(), stopped);
  }
});

const helperScratch = process.env.FLOW_ENG01J_HELPER_SCRATCH;
const prepareHelper = process.platform === 'darwin' && process.env.FLOW_ENG01J_HELPER_PREPARE === '1' && Boolean(helperScratch);
function helperFixture() {
  assert.ok(helperScratch);
  const directory = mkdtempSync(join(helperScratch, 'workspace-'));
  const runtimeDirectory = mkdtempSync(join(helperScratch, 'runtime-'));
  for (const child of ['control', 'state']) mkdirSync(join(runtimeDirectory, child), { mode: 0o700 });
  writeFileSync(join(directory, 'calculator.mjs'), '0', { mode: 0o600 });
  const startupRecipe = readFileSync(new URL('../../../../docs/evidence/eng01j/helper-host/startup-input.sb', import.meta.url), 'utf8');
  return { directory, runtimeDirectory, startupRecipe, contents: Buffer.from('X') };
}
const helperSuccess: StockHelperCompletion = { exitCode: 0, ownedState: 'absent', stdoutEof: true, stderrEof: true,
  failure: false, stdout: '{"status":"ok","payload":{"operation":"fs/writeFile","response":{}}}\n' };

test.skipIf(!prepareHelper)('stock helper preparation freezes one request and reports only observed bytes, never revoked', async () => {
  const input = helperFixture(), host = await prepareDarwinStockHelper(input);
  const unknown = { outcome: 'unknown', writeAccess: 'unknown' };
  assert.deepEqual(await host.observe(helperSuccess), unknown); // No launch spec issued.
  input.contents[0] = 89;
  const launch = host.takeLaunch(new AbortController().signal);
  assert.equal(launch.args.at(-1), '--codex-run-as-fs-helper');
  assert.equal(launch.executable, '/usr/bin/sandbox-exec');
  assert.equal(launch.stdin, 'readonly-regular-file'); assert.equal(launch.extraDescriptors, 'closed');
  const request = JSON.parse(launch.requestLine);
  assert.deepEqual(request, { operation: 'fs/writeFile', params: { path: new URL('file://' + input.directory + '/calculator.mjs').href,
    dataBase64: 'WA==', followSymlinks: false, sandbox: null } });
  assert.ok(!launch.requestLine.includes('initialize'));
  assert.equal(launch.environment.CODEX_HOME, join(input.runtimeDirectory, 'state'));
  assert.throws(() => host.takeLaunch(new AbortController().signal));
  assert.deepEqual(await host.observe(helperSuccess), unknown); // Exit zero does not prove the write.
  writeFileSync(join(input.directory, 'calculator.mjs'), 'X'); // Explicit injected helper effect, no native invocation.
  for (const completion of [{ ...helperSuccess, failure: true }, { ...helperSuccess, exitCode: 1 },
    { ...helperSuccess, ownedState: 'unknown' as const }, { ...helperSuccess, stdoutEof: false },
    { ...helperSuccess, stderrEof: false }, { ...helperSuccess, stdout: '{"status":"error"}' },
    { ...helperSuccess, stdout: helperSuccess.stdout + helperSuccess.stdout },
    { ...helperSuccess, stdout: 'x'.repeat(16385) }]) assert.deepEqual(await host.observe(completion), unknown);
  assert.deepEqual(await host.observe(helperSuccess), { outcome: 'observed-write', writeAccess: 'unknown' });
  renameSync(join(input.directory, 'calculator.mjs'), join(input.directory, 'original'));
  writeFileSync(join(input.directory, 'calculator.mjs'), 'X', { mode: 0o600 });
  assert.deepEqual(await host.observe(helperSuccess), unknown); // Same bytes in a substituted inode are insufficient.
});

test.skipIf(!prepareHelper)('stock helper changed target and aborted handoff consume the one launch', async () => {
  const changed = helperFixture(), host = await prepareDarwinStockHelper(changed);
  writeFileSync(join(changed.directory, 'calculator.mjs'), 'changed');
  assert.throws(() => host.takeLaunch(new AbortController().signal));
  assert.throws(() => host.takeLaunch(new AbortController().signal));
  const unused = await prepareDarwinStockHelper(helperFixture()), abort = new AbortController(); abort.abort();
  assert.throws(() => unused.takeLaunch(abort.signal));
  assert.throws(() => unused.takeLaunch(new AbortController().signal));
  assert.deepEqual(await unused.observe(helperSuccess), { outcome: 'unknown', writeAccess: 'unknown' });
});

test.skipIf(!prepareHelper)('stock helper preparation rejects broad writes and nonprivate state before issuing a spec', async () => {
  const input = helperFixture();
  await assert.rejects(prepareDarwinStockHelper({ ...input, contents: Buffer.alloc(1025) }));
  await assert.rejects(prepareDarwinStockHelper({ ...input, runtimeDirectory: input.directory }));
  await assert.rejects(prepareDarwinStockHelper({ ...input, runtimeDirectory: '/private/tmp/eng01j-missing-runtime' }));
});

test.skipIf(!canRun)('changed target identity rejects before transport; wrong executable digest is rejected', async () => {
  const input = fixture();
  await assert.rejects(prepareDarwinWriterHost({ ...input, executableSha256: '0'.repeat(64) }));
  const host = await prepareDarwinWriterHost(input);
  writeFileSync(join(input.directory, 'calculator.mjs'), 'changed');
  assert.throws(() => host.createTransport({ signal: new AbortController().signal, workingDirectory: input.directory }));
  assert.equal((await host.close()).writeAccess, 'unknown');
});

test.skipIf(!canRun)('closing an unused host permanently prevents launch', async () => {
  const input = fixture(), host = await prepareDarwinWriterHost(input);
  assert.equal((await host.close()).child, 'not-started');
  assert.throws(() => host.createTransport({ signal: new AbortController().signal, workingDirectory: input.directory }));
});

// Explicit preparation-only checks hash installed binaries but never execute either one.
const readonlyScratch = process.env.FLOW_ENG01L_TMP;
const readonlyPrepare = process.platform === 'darwin' && process.env.FLOW_ENG01L_PREPARE === '1' && Boolean(readonlyScratch);
function readonlyFixture() {
  assert.ok(readonlyScratch);
  const directory = mkdtempSync(join(readonlyScratch, 'workspace-')), runtimeDirectory = mkdtempSync(join(readonlyScratch, 'runtime-'));
  for (const child of ['control', 'state']) mkdirSync(join(runtimeDirectory, child), { mode: 0o700 });
  return { directory, runtimeDirectory, startupRecipe: readFileSync(new URL('../../../../docs/evidence/eng01j/helper-host/startup-input.sb', import.meta.url), 'utf8') };
}
test.skipIf(!readonlyPrepare)('ENG01L real read-only factory binds stock app-server and private environment through mocked R06 only', async () => {
  const input = readonlyFixture();
  const closed = { reason: 'CLOSED' as const, child: 'confirmed-exited' as const, exitCode: 0, signal: null, remoteEffects: 'unknown' as const };
  const transport: codex.CodexTransport = { ready: Promise.resolve({ userAgent: 'injected', platformFamily: 'test', platformOs: 'test' }),
    closed: Promise.resolve(closed), async close() { return closed; }, async request() { throw Error('No RPC permitted'); },
    async receive() { throw Error('No receive permitted'); }, async respond() { throw Error('No reply permitted'); }, snapshot() { throw Error('Unused'); } };
  const spawn = vi.spyOn(codex, 'createCodexTransport').mockImplementation(options => { normalizeOptions(options); return transport; });
  try {
    const sink = { maxBytes: 8192, write() {} };
    const host = await prepareDarwinReadOnlyHost({ ...input, privateStderr: sink }); assert.equal(spawn.mock.calls.length, 0);
    const signal = new AbortController().signal;
    assert.equal(host.createTransport({ signal, workingDirectory: input.directory }), transport);
    const options = spawn.mock.calls[0]![0];
    assert.deepEqual(options.spawn.args.slice(2), [STOCK_CODEX, 'app-server']);
    assert.equal(options.spawn.executable, '/usr/bin/sandbox-exec');
    assert.equal(options.spawn.args[0], '-f');
    const policy = readFileSync(options.spawn.args[1]!, 'utf8');
    assert.ok(!policy.includes('calculator.mjs')); assert.equal(lstatSync(options.spawn.args[1]!).mode & 0o777, 0o600);
    assert.equal(createHash('sha256').update(policy).digest('hex'), host.policySha256);
    assert.throws(() => normalizeOptions({ ...options, spawn: { ...options.spawn, args: ['-p', policy, STOCK_CODEX, 'app-server'] } }));
    assert.deepEqual(options.privateStderr, sink);
    assert.deepEqual(options.spawn.environment, { PATH: '/usr/bin:/bin', LANG: 'C', HOME: join(input.runtimeDirectory, 'state'),
      TMPDIR: join(input.runtimeDirectory, 'state'), CODEX_HOME: join(input.runtimeDirectory, 'state') });
    assert.deepEqual(options.initialize.capabilities, { experimentalApi: true, requestAttestation: false });
    assert.deepEqual(Object.keys(options.spawn).sort(), ['args', 'cwd', 'environment', 'executable']);
    assert.throws(() => host.createTransport({ signal, workingDirectory: input.directory }));
    assert.equal((await host.close()).child, 'confirmed-exited'); assert.equal((await host.close()).writeAccess, 'unknown');
    assert.equal(spawn.mock.calls.length, 1);
  } finally { spawn.mockRestore(); }
});
test.skipIf(!readonlyPrepare)('ENG01L profile replacement and repeated prepare preserve original control evidence and reject launch', async () => {
  const input = readonlyFixture(), host = await prepareDarwinReadOnlyHost(input);
  const path = join(input.runtimeDirectory, 'control', 'flow-readonly.sb'), original = readFileSync(path);
  await assert.rejects(prepareDarwinReadOnlyHost(input)); assert.deepEqual(readFileSync(path), original);
  renameSync(path, path + '.original'); writeFileSync(path, original, { mode: 0o600 });
  const spawn = vi.spyOn(codex, 'createCodexTransport').mockImplementation(() => { throw Error('Must not spawn'); });
  try {
    assert.throws(() => host.createTransport({ signal: new AbortController().signal, workingDirectory: input.directory }));
    assert.equal(spawn.mock.calls.length, 0); assert.equal((await host.close()).child, 'unconfirmed');
    assert.deepEqual(readFileSync(path + '.original'), original);
  } finally { spawn.mockRestore(); }
});
test.skipIf(!readonlyPrepare)('ENG01L bounded private stderr rejects excessive capture before creating a policy', async () => {
  const input = readonlyFixture();
  await assert.rejects(prepareDarwinReadOnlyHost({ ...input, privateStderr: { maxBytes: 8193, write() {} } }));
  assert.throws(() => lstatSync(join(input.runtimeDirectory, 'control', 'flow-readonly.sb')));
});
test.skipIf(!readonlyPrepare)('ENG01L changed private directory consumes launch without calling R06', async () => {
  const input = readonlyFixture(), host = await prepareDarwinReadOnlyHost(input);
  const spawn = vi.spyOn(codex, 'createCodexTransport').mockImplementation(() => { throw Error('Must not spawn'); });
  try {
    renameSync(join(input.runtimeDirectory, 'state'), join(input.runtimeDirectory, 'old-state'));
    mkdirSync(join(input.runtimeDirectory, 'state'), { mode: 0o700 });
    assert.throws(() => host.createTransport({ signal: new AbortController().signal, workingDirectory: input.directory }));
    assert.throws(() => host.createTransport({ signal: new AbortController().signal, workingDirectory: input.directory }));
    assert.equal(spawn.mock.calls.length, 0); assert.equal((await host.close()).child, 'unconfirmed');
  } finally { spawn.mockRestore(); }
});
test.skipIf(!readonlyPrepare)('ENG01L close before launch and invalid private runtime cannot start stock', async () => {
  const input = readonlyFixture(), host = await prepareDarwinReadOnlyHost(input);
  const spawn = vi.spyOn(codex, 'createCodexTransport').mockImplementation(() => { throw Error('Must not spawn'); });
  try {
    assert.equal((await host.close()).child, 'not-started');
    assert.throws(() => host.createTransport({ signal: new AbortController().signal, workingDirectory: input.directory }));
    await assert.rejects(prepareDarwinReadOnlyHost({ ...input, runtimeDirectory: input.directory }));
    assert.equal(spawn.mock.calls.length, 0);
  } finally { spawn.mockRestore(); }
});
