import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
const hook = vi.hoisted(() => ({ base: '', roots: [] as string[], fault: '', listeners: 0, listenerCloses: 0, calls: 0, seen: [] as any[] }));
vi.mock('node:net', () => ({ default: { createServer() {
  hook.listeners++; const server: any = new EventEmitter(); server.listening = false;
  server.listen = (_options: any, ready: () => void) => {
    if (hook.fault === 'listen') { queueMicrotask(() => server.emit('error', Error('FAKE_LISTEN_FAILURE'))); return; }
    server.listening = true; ready();
  };
  server.address = () => ({ port: 43210 });
  server.close = (done: () => void) => { hook.listenerCloses++; if (hook.fault === 'listener-close') throw Error('FAKE_CLOSE_FAILURE'); server.listening = false; server.emit('close'); done(); };
  return server;
} } }));
vi.mock('node:fs', async original => {
  const real = await original<typeof import('node:fs')>();
  return { ...real, default: { ...real,
    readFileSync(file: any, ...args: any[]) {
      if (typeof file === 'string' && file.endsWith('/bootstrap-inspection.json')) return JSON.stringify({ node: { path: '/opt/homebrew/Cellar/node@24/24.20.0/bin/node' }, nonSystemRuntimeHashes: {}, wrapperAndOSMetadataHashes: {} });
      if (typeof file === 'string' && file.endsWith('/r06-binding.json')) return JSON.stringify({ peerSha256: createHash('sha256').update('fixed-peer').digest('hex') });
      return (real.readFileSync as any)(file, ...args);
    },
    mkdtempSync(_prefix: string) { const p = real.mkdtempSync(path.join(hook.base, 'owned-')); hook.roots.push(p); return p; },
  } };
});
import { runSyntheticCanary } from '../isolation/compose-canary.mjs';
const real = await vi.importActual<typeof import('node:fs')>('node:fs');
function factory(options: any) {
  hook.calls++; hook.seen.push(options);
  if (hook.fault === 'factory-throw') throw Error('FAKE_FACTORY_UNKNOWN');
  const canary = options.spawn.args.at(-1) === 'normal';
  if (canary) {
    const config = JSON.parse(real.readFileSync(path.join(path.dirname(options.spawn.cwd), 'control/config.json'), 'utf8'));
    const checks = Object.fromEntries(['allowedReadWrite', 'outsideReadDenied', 'outsideWriteDenied', 'controlWriteDenied', 'symlinkReadDenied', 'hardlinkCreationDenied', 'loopbackDenied'].map(key => [key, hook.fault !== 'denial-unknown']));
    real.writeFileSync(path.join(options.spawn.cwd, 'canary-result.json'), JSON.stringify({ version: 1, runId: config.runId, passed: hook.fault !== 'denial-unknown', checks }));
  }
  const closed = Promise.resolve({ reason: hook.fault === 'protocol-close' ? 'PROTOCOL' : hook.fault === 'limit-close' ? 'LIMIT' : canary ? 'CLOSED' : 'DISCONNECTED',
    child: hook.fault === 'unknown-close' ? 'unconfirmed' : 'confirmed-exited', exitCode: canary ? 0 : 7, signal: null });
  const ready = canary ? Promise.resolve({ userAgent: 'synthetic/1' }) : Promise.reject(Error('expected')); void ready.catch(() => {});
  return { ready, closed, close: () => closed,
    receive: () => Promise.resolve({ kind: 'notification', method: hook.fault === 'wrong-ready' ? 'wrong' : 'synthetic/ready', params: { initialized: true } }),
    snapshot: () => ({ ignoredResponses: hook.fault === 'extra-response' ? 1 : 0, inboundFrames: 0 }) };
}
const run = (scenario: string) => runSyntheticCanary(factory, { r06Target: 'a239b14d5328c78cca02a8757e26f2b65502f926', peerBytes: Buffer.from('fixed-peer'), scenario });
beforeEach(() => { hook.base = real.mkdtempSync('/private/tmp/flow-node-compose-test-'); hook.roots = []; hook.fault = ''; hook.listeners = 0; hook.listenerCloses = 0; hook.calls = 0; hook.seen = []; });
afterEach(() => real.rmSync(hook.base, { recursive: true, force: true }));
test.each(['node-control', 'node-profile-control'])('%s keeps same flags/output script and creates no listener', async scenario => {
  const result = await run(scenario);
  expect(result).toMatchObject({ passed: true, retainedRoots: [], listener: { created: false, closed: true }, outputInventory: { complete: true } });
  expect(hook.listeners).toBe(0); expect(hook.calls).toBe(1);
  expect(hook.seen[0].spawn.args).toContain('--jitless'); expect(hook.seen[0].spawn.args).toContain('--no-addons');
  expect(hook.seen[0].spawn.args).not.toContain('--experimental-transform-types');
  expect(Object.keys(hook.seen[0].spawn.environment).some(k => k.startsWith('NODE_'))).toBe(false);
  expect(hook.roots.every(p => !real.existsSync(p))).toBe(true);
});
test('canary alone creates one owned listener and returns seven bound observations with inventory', async () => {
  const result = await run('node-canary'); expect(result.passed).toBe(true);
  expect(Object.keys(result.report.checks)).toHaveLength(7); expect(hook.listeners).toBe(1); expect(hook.listenerCloses).toBe(1);
  expect(result.listener).toEqual({ created: true, bound: true, port: 43210, healthy: true, accepted: 0, closed: true });
  expect(result.outputInventory.complete).toBe(true); expect(result.retainedRoots).toEqual([]);
});
test('listen rejection remains owned, closes before cleanup, never reaches factory', async () => {
  hook.fault = 'listen'; const result = await run('node-canary');
  expect(hook.calls).toBe(0); expect(hook.listenerCloses).toBe(1);
  expect(result).toMatchObject({ passed: false, listenerClosed: true, retainedRoots: [] });
  expect(result.listener).toMatchObject({ created: true, bound: false, healthy: false, closed: true });
  expect(JSON.stringify(result)).not.toContain('FAKE_LISTEN_FAILURE');
});
test.each(['denial-unknown', 'wrong-ready', 'extra-response'])('%s never passes the seven-check/RPC gate', async fault => {
  hook.fault = fault; const result = await run('node-canary'); expect(result.passed).toBe(false); expect(result.listenerClosed).toBe(true);
});
test.each(['node-control', 'node-profile-control', 'node-canary'])('%s cannot infer a stdout bound from an empty inbox after protocol failure', async scenario => {
  for (const fault of ['protocol-close', 'limit-close']) {
    hook.fault = fault; const result = await run(scenario);
    expect(result).toMatchObject({ passed: false, stdoutBoundConfirmed: false, protocol: { ignoredResponses: 0, inboundFrames: 0 }, retainedRoots: [] });
  }
});
test.each(['factory-throw', 'unknown-close'])('%s retains all owned roots and marks inventory unknown', async fault => {
  hook.fault = fault; const result = await run('node-profile-control');
  expect(result).toMatchObject({ passed: false, retainedRoots: hook.roots, outputInventory: { complete: false } });
  expect(hook.roots.every(p => real.existsSync(p))).toBe(true);
});
test('arbitrary scenario never creates a root or invokes factory', async () => {
  await expect(run('/tmp/arbitrary.sb')).rejects.toThrow(); expect(hook.roots).toEqual([]); expect(hook.calls).toBe(0);
});

test('listener close rejection returns exact retained roots instead of losing the resource receipt', async () => {
  hook.fault = 'listener-close'; const result = await run('node-canary');
  expect(hook.listenerCloses).toBe(1);
  expect(result).toMatchObject({ passed: false, listenerClosed: false, retainedRoots: hook.roots, outputInventory: { complete: false } });
  expect(hook.roots.every(p => real.existsSync(p))).toBe(true);
  expect(JSON.stringify(result)).not.toContain('FAKE_CLOSE_FAILURE');
});
