// Proposal only. No CLI entry point; this module was not invoked during preparation.
// The caller injects APPROVED R06 createCodexTransport. R06 alone owns the child.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { randomBytes, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const evidence = path.resolve(here, '../../../docs/evidence/wpf-mature-02/isolation');
const R06_TARGET = 'a239b14d5328c78cca02a8757e26f2b65502f926';
const marker = 'owned-denied-marker-no-secret';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function ownListener() {
  let connections = 0;
  let healthy = true;
  const sockets = new Set();
  const server = net.createServer(socket => {
    connections++;
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    socket.destroy(); // Never sends or reads application bytes.
  });
  server.maxConnections = 1;
  server.on('error', () => { healthy = false; });
  await new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); reject(Error('Listener deadline')); }, 1000);
    server.once('error', error => { clearTimeout(timer); controller.abort(); reject(error); });
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true, signal: controller.signal }, () => {
      clearTimeout(timer);
      resolve();
    });
  });
  return {
    port: server.address().port,
    connections: () => connections,
    healthy: () => healthy,
    close: () => new Promise(resolve => {
      for (const socket of sockets) socket.destroy();
      const timer = setTimeout(() => resolve(false), 1000);
      server.close(error => { clearTimeout(timer); resolve(!error); });
    }),
  };
}

/** Future call requires reviewed profile AND approved R06 target. Never retries a canary. */
export async function runSyntheticCanary(createCodexTransport, { r06Target, peerBytes }) {
  assert.equal(r06Target, R06_TARGET);
  assert.ok(Buffer.isBuffer(peerBytes) && peerBytes.length <= 65536, 'Invalid synthetic fixture bytes');
  const bootstrap = JSON.parse(fs.readFileSync(path.join(evidence, 'bootstrap-inspection.json'), 'utf8'));
  const binding = JSON.parse(fs.readFileSync(path.join(evidence, 'r06-binding.json'), 'utf8'));
  assert.equal(sha256(peerBytes), binding.peerSha256, 'R06 fixture changed');
  for (const [file, expected] of Object.entries({ ...bootstrap.nonSystemRuntimeHashes, ...bootstrap.wrapperAndOSMetadataHashes })) {
    assert.equal(sha256(fs.readFileSync(file)), expected, 'Runtime dependency changed');
  }
  const roots = [];
  function makeRoot(prefix) {
    const directory = fs.realpathSync(fs.mkdtempSync(prefix));
    const stat = fs.lstatSync(directory);
    roots.push({ directory, ino: stat.ino, dev: stat.dev });
    fs.chmodSync(directory, 0o700);
    return directory;
  }
  const runId = randomBytes(16).toString('hex');
  let control;
  let listener;
  let transport;
  let childClosed = false;
  let result = { passed: false, reason: 'preparation-failed', retainedRoots: [] };
  try {
    const allowedRoot = makeRoot('/private/tmp/flow-wpf02-allow-');
    const deniedRoot = makeRoot('/private/tmp/flow-wpf02-deny-');
    control = path.join(allowedRoot, 'control');
    const state = path.join(allowedRoot, 'state');
    fs.mkdirSync(control, { mode: 0o700 });
    fs.mkdirSync(state, { mode: 0o700 });
    for (const name of ['home', 'codex', 'tmp']) fs.mkdirSync(path.join(state, name), { mode: 0o700 });
    fs.writeFileSync(path.join(deniedRoot, 'denied-marker.txt'), marker, { mode: 0o600, flag: 'wx' });
    fs.symlinkSync(path.join(deniedRoot, 'denied-marker.txt'), path.join(state, 'escape-link'));
    listener = await ownListener();
    fs.writeFileSync(path.join(control, 'config.json'), JSON.stringify({ runId, allowedRoot, deniedRoot, port: listener.port, node: bootstrap.node.path }), { mode: 0o400, flag: 'wx' });
    fs.writeFileSync(path.join(control, 'peer.mjs'), peerBytes, { mode: 0o400, flag: 'wx' });
    for (const file of ['canary-preload.mjs', 'default-deny.sb']) {
      fs.copyFileSync(path.join(here, file), path.join(control, file), fs.constants.COPYFILE_EXCL);
      fs.chmodSync(path.join(control, file), 0o400);
    }
    // Keep owner directory write permission so a denied creation measures Seatbelt, not POSIX mode.
    fs.chmodSync(control, 0o700);
    const options = {
      spawn: {
        executable: '/usr/bin/sandbox-exec', cwd: state,
        args: ['-D', `ALLOW_ROOT=${allowedRoot}`, '-D', `DENY_ROOT=${deniedRoot}`, '-f', path.join(control, 'default-deny.sb'),
          bootstrap.node.path, '--jitless', '--no-addons', '--import', path.join(control, 'canary-preload.mjs'), path.join(control, 'peer.mjs'), 'normal'],
        environment: { PATH: '/usr/bin:/bin', HOME: path.join(state, 'home'), CODEX_HOME: path.join(state, 'codex'),
          TMPDIR: path.join(state, 'tmp'), LANG: 'C', LC_ALL: 'C', TZ: 'UTC' },
      },
      initialize: { clientInfo: { name: 'flow_seatbelt_canary', title: 'Synthetic isolation canary', version: '1' },
        capabilities: { experimentalApi: false, requestAttestation: false } },
      limits: { initializeTimeoutMs: 3000, requestTimeoutMs: 1000, terminateMs: 500, killMs: 500,
        frameBytes: 4096, inboundBytes: 8192, outboundBytes: 8192, inboundFrames: 8, outboundFrames: 8, pendingRequests: 1, serverRequests: 1 },
    };
    transport = createCodexTransport(options);
    const ready = await transport.ready;
    assert.equal(ready.userAgent, 'synthetic/1');
    const reportPath = path.join(state, 'canary-result.json');
    const stat = fs.lstatSync(reportPath);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 4096);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.runId, runId);
    assert.equal(report.passed, true);
    assert.equal(Object.keys(report.checks).length, 7);
    assert.ok(Object.values(report.checks).every(value => value === true));
    assert.equal(listener.connections(), 0);
    assert.equal(listener.healthy(), true);
    assert.equal(fs.readFileSync(path.join(deniedRoot, 'denied-marker.txt'), 'utf8'), marker);
    assert.equal(fs.existsSync(path.join(deniedRoot, 'blocked-write.txt')), false);
    result = { passed: true, reason: 'canary-checks-only', report, retainedRoots: [allowedRoot, deniedRoot] };
  } catch {
    result.reason = 'canary-or-transport-failed'; // No raw error/path/environment output.
  } finally {
    if (transport) {
      try {
        const close = await transport.close();
        childClosed = close.child === 'confirmed-exited';
        result.close = close;
      } catch { childClosed = false; }
    } else childClosed = true;
    const listenerClosed = listener ? await listener.close() : true;
    result.listenerClosed = listenerClosed;
    result.passed &&= childClosed && listenerClosed;
    result.retainedRoots = roots.map(root => root.directory);
    if (childClosed && listenerClosed) {
      // Only roots created by this invocation; no port/PID scan or other-service cleanup.
      try {
        for (const root of roots) {
          const stat = fs.lstatSync(root.directory);
          assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.ino === root.ino && stat.dev === root.dev);
        }
        if (control && fs.existsSync(control)) fs.chmodSync(control, 0o700);
        for (const root of roots) fs.rmSync(root.directory, { recursive: true });
        result.retainedRoots = [];
      } catch { result.passed = false; result.reason = 'cleanup-unconfirmed'; }
    }
  }
  return result;
}
