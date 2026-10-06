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

async function ownListener(register) {
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
  const controller = new AbortController();
  let closeObserved = false;
  server.on('close', () => { closeObserved = true; });
  const owned = {
    port: null, bound: false,
    connections: () => connections, healthy: () => healthy,
    close: () => new Promise(resolve => {
      const finish = () => { clearTimeout(timer); resolve(closeObserved && sockets.size === 0); };
      const timer = setTimeout(() => resolve(false), 1000);
      server.once('close', finish);
      controller.abort();
      for (const socket of sockets) socket.destroy();
      server.close(() => { if (closeObserved) finish(); });
    }),
  };
  register(owned); // Ownership precedes listen; failed bind still closes in the caller's finally.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { controller.abort(); reject(Error('Listener deadline')); }, 1000);
    server.once('error', error => { clearTimeout(timer); controller.abort(); reject(error); });
    server.listen({ host: '127.0.0.1', port: 0, exclusive: true, signal: controller.signal }, () => {
      clearTimeout(timer);
      resolve();
    });
  });
  owned.port = server.address().port; owned.bound = true;
  return owned;
}

// Fixed recipes only; no caller-supplied executable, profile or alternate peer.
function recipeFor(scenario) {
  if (scenario === 'original-canary') return { canary: true, sandbox: true, profile: path.join(here, 'default-deny.sb') };
  if (scenario === 'node-runtime-metadata-canary') return { canary: true, sandbox: true, profile: path.join(here, '../node-runtime-metadata/candidate.sb') };
  if (!['node-control', 'node-profile-control', 'node-canary'].includes(scenario)) throw Error('Unknown fixed scenario');
  return { canary: scenario === 'node-canary', sandbox: scenario !== 'node-control', profile: path.join(here, '../node-rootliteral/candidate.sb') };
}
function outputInventory(roots) {
  const files = []; let bytes = 0; let entries = 0;
  function visit(directory, depth) {
    assert.ok(depth <= 4);
    for (const name of fs.readdirSync(directory)) {
      assert.ok(++entries <= 64 && /^[A-Za-z0-9_.-]{1,96}$/.test(name));
      const file = path.join(directory, name), stat = fs.lstatSync(file);
      if (stat.isDirectory() && !stat.isSymbolicLink()) { visit(file, depth + 1); continue; }
      let data;
      if (stat.isSymbolicLink()) {
        assert.equal(file, path.join(roots[0].directory, 'state/escape-link'));
        data = Buffer.from(fs.readlinkSync(file));
        assert.equal(data.toString(), path.join(roots[1].directory, 'denied-marker.txt'));
      } else {
        assert.ok(stat.isFile() && stat.size <= 65536);
        const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
        try { const opened = fs.fstatSync(fd); assert.equal(opened.ino, stat.ino); assert.equal(opened.dev, stat.dev); data = fs.readFileSync(fd); }
        finally { fs.closeSync(fd); }
        assert.equal(data.length, stat.size);
      }
      bytes += data.length; assert.ok(bytes <= 65536);
      files.push({ path: file, bytes: data.length, sha256: sha256(data), symlink: stat.isSymbolicLink() });
    }
  }
  for (const root of roots) visit(root.directory, 0);
  return { complete: true, bytes, files };
}

/** Future call requires reviewed profile AND approved R06 target. Never retries a canary. */
export async function runSyntheticCanary(createCodexTransport, { r06Target, peerBytes, scenario = 'original-canary' }) {
  const recipe = recipeFor(scenario);
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
    const createdDirectory = fs.mkdtempSync(prefix);
    const root = { createdDirectory, directory: createdDirectory, ino: null, dev: null, prepared: false };
    roots.push(root); // Creation owns a path even before canonicalization or identity can succeed.
    root.directory = fs.realpathSync(createdDirectory);
    const stat = fs.lstatSync(root.directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    root.ino = stat.ino; root.dev = stat.dev;
    fs.chmodSync(root.directory, 0o700);
    root.prepared = true;
    return root.directory;
  }
  const runId = randomBytes(16).toString('hex');
  let control;
  let listener;
  let transport;
  let factoryAttempted = false;
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
    if (recipe.canary) await ownListener(value => { listener = value; });
    fs.writeFileSync(path.join(control, 'config.json'), JSON.stringify({ runId, allowedRoot, deniedRoot, port: listener?.port ?? null, node: bootstrap.node.path }), { mode: 0o400, flag: 'wx' });
    fs.writeFileSync(path.join(control, 'peer.mjs'), peerBytes, { mode: 0o400, flag: 'wx' });
    for (const file of ['canary-preload.mjs']) {
      fs.copyFileSync(path.join(here, file), path.join(control, file), fs.constants.COPYFILE_EXCL);
      fs.chmodSync(path.join(control, file), 0o400);
    }
    fs.copyFileSync(recipe.profile, path.join(control, 'default-deny.sb'), fs.constants.COPYFILE_EXCL);
    fs.chmodSync(path.join(control, 'default-deny.sb'), 0o400);
    if (!recipe.canary) {
      fs.copyFileSync(path.join(here, '../diagnostics/immediate-exit.mjs'), path.join(control, 'immediate-exit.mjs'), fs.constants.COPYFILE_EXCL);
      fs.chmodSync(path.join(control, 'immediate-exit.mjs'), 0o400);
    }
    // Keep owner directory write permission so a denied creation measures Seatbelt, not POSIX mode.
    fs.chmodSync(control, 0o700);
    const nodeArgs = ['--jitless', '--no-addons', ...(recipe.canary
      ? ['--import', path.join(control, 'canary-preload.mjs'), path.join(control, 'peer.mjs'), 'normal']
      : [path.join(control, 'immediate-exit.mjs')])];
    const options = {
      spawn: {
        executable: recipe.sandbox ? '/usr/bin/sandbox-exec' : bootstrap.node.path, cwd: state,
        args: recipe.sandbox ? ['-D', `ALLOW_ROOT=${allowedRoot}`, '-D', `DENY_ROOT=${deniedRoot}`, '-f', path.join(control, 'default-deny.sb'), bootstrap.node.path, ...nodeArgs] : nodeArgs,
        environment: { PATH: '/usr/bin:/bin', HOME: path.join(state, 'home'), CODEX_HOME: path.join(state, 'codex'),
          TMPDIR: path.join(state, 'tmp'), LANG: 'C', LC_ALL: 'C', TZ: 'UTC' },
      },
      initialize: { clientInfo: { name: 'flow_seatbelt_canary', title: 'Synthetic isolation canary', version: '1' },
        capabilities: { experimentalApi: false, requestAttestation: false } },
      limits: { initializeTimeoutMs: 3000, requestTimeoutMs: 1000, terminateMs: 500, killMs: 500,
        frameBytes: 4096, inboundBytes: 8192, outboundBytes: 8192, inboundFrames: 8, outboundFrames: 8, pendingRequests: 1, serverRequests: 1 },
    };
    factoryAttempted = true;
    transport = createCodexTransport(options);
    if (!recipe.canary) {
      await transport.ready.catch(() => {});
      const close = await transport.closed;
      result = { passed: close.exitCode === 7 && close.signal === null, reason: 'fixed-control-exit-only', retainedRoots: [allowedRoot, deniedRoot] };
      return result;
    }
    const ready = await transport.ready;
    assert.equal(ready.userAgent, 'synthetic/1');
    if (scenario !== 'original-canary') assert.deepEqual(await transport.receive(), { kind: 'notification', method: 'synthetic/ready', params: { initialized: true } });
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
        if (scenario !== 'original-canary') {
          const snapshot = transport.snapshot();
          result.protocol = { ignoredResponses: snapshot.ignoredResponses, inboundFrames: snapshot.inboundFrames };
          result.stdoutBoundConfirmed = childClosed && snapshot.ignoredResponses === 0 && snapshot.inboundFrames === 0
            && close.reason === (recipe.canary ? 'CLOSED' : 'DISCONNECTED');
          result.passed &&= result.stdoutBoundConfirmed;
        }
      } catch { childClosed = false; }
    } else childClosed = !factoryAttempted;
    let listenerClosed = !listener;
    try { if (listener) listenerClosed = await listener.close(); } catch { listenerClosed = false; }
    if (scenario !== 'original-canary') {
      result.listener = { created: Boolean(listener), bound: listener?.bound ?? false, port: listener?.port ?? null,
        healthy: listener?.healthy() ?? null, accepted: listener?.connections() ?? 0, closed: listenerClosed };
      result.outputInventory = { complete: false, bytes: null, files: [] };
    }
    result.listenerClosed = listenerClosed;
    result.passed &&= childClosed && listenerClosed;
    result.retainedRoots = roots.map(root => root.createdDirectory);
    if (childClosed && listenerClosed) {
      // Only roots created by this invocation; no port/PID scan or other-service cleanup.
      try {
        for (const root of roots) {
          assert.ok(root.prepared && root.ino !== null && root.dev !== null, 'Root preparation or identity unknown');
          const stat = fs.lstatSync(root.directory);
          assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.ino === root.ino && stat.dev === root.dev);
        }
        if (scenario !== 'original-canary') result.outputInventory = outputInventory(roots);
        if (control && fs.existsSync(control)) fs.chmodSync(control, 0o700);
        for (const root of roots) fs.rmSync(root.directory, { recursive: true });
        result.retainedRoots = [];
      } catch { result.passed = false; result.reason = 'cleanup-unconfirmed'; }
    }
  }
  return result;
}
