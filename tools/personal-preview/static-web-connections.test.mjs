import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp, mkdir, realpath, lstat, open, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { startStaticWeb } from './static-web.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const connections = server => new Promise((resolve, reject) => server.getConnections((error, count) => error ? reject(error) : resolve(count)));
const listen = server => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server.address().port)); });
const close = server => new Promise((resolve, reject) => { server.closeAllConnections(); server.close(error => error ? reject(error) : resolve()); });
async function within(promise, milliseconds) {
  let timer;
  try { return await Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve(false), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function checkpoint(path, value) {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  if (bytes.length > 16384) throw new Error('CHECKPOINT_LIMIT');
  const handle = await open(path, 'w', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}
async function syntheticArtifact(directory) {
  const content = Buffer.from('<!doctype html><title>SVC08 synthetic</title>');
  const sourceHead = 'a2e7803161ffb7e2158eaf3c13531448d2a777b0';
  const manifest = Buffer.from(`${JSON.stringify({ format: 1, policy: 'flow-static-web-v1', sourceHead,
    files: [{ path: 'index.html', bytes: content.length, sha256: sha(content) }], totalBytes: content.length })}\n`);
  const artifactId = sha(manifest);
  const root = join(directory, 'web-artifacts', artifactId);
  await mkdir(join(root, 'dist'), { recursive: true, mode: 0o700 });
  await writeFile(join(root, 'manifest.json'), manifest, { flag: 'wx', mode: 0o600 });
  await writeFile(join(root, 'dist/index.html'), content, { flag: 'wx', mode: 0o600 });
  return { sourceHead, artifactId, manifestDigest: artifactId };
}

test('upstream completion, truncated FIN and RST settle downstream connections', { timeout: 6000 }, async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc08-')));
  const identity = await lstat(directory);
  const report = { directory, dev: identity.dev, ino: identity.ino, requests: 0, cases: [], events: [], primaryFailure: null, cleanup: { state: 'pending' } };
  const evidence = process.env.SVC08_CHECKPOINT ?? join(directory, 'checkpoint.json');
  const originalCreateServer = http.createServer;
  const frontendSockets = new Set();
  const upstreamSockets = new Set();
  const frontendServers = [];
  const triggers = new Map();
  const pending = new Set();
  let web;
  let upstream;
  let stage = 'reservation';
  const event = (side, name, detail = {}) => {
    if (report.events.length >= 128) throw new Error('EVENT_LIMIT');
    report.events.push({ side, name, ...detail });
  };
  function observeSockets(server, side, sockets) {
    server.on('connection', socket => {
      sockets.add(socket);
      event(side, 'connection');
      socket.on('end', () => event(side, 'end'));
      socket.on('close', hadError => { sockets.delete(socket); event(side, 'close', { hadError }); });
    });
  }
  try {
    await checkpoint(evidence, report);
    const artifact = await syntheticArtifact(directory);
    upstream = originalCreateServer((request, response) => {
      const mode = new URL(request.url, 'http://fixture').searchParams.get('mode');
      event('upstream', 'request', { mode, authorizationPreserved: request.headers.authorization === 'Bearer svc08-synthetic', originPreserved: request.headers.origin === 'http://synthetic.invalid' });
      triggers.set(mode, () => {
        if (mode === 'complete') response.end();
        else if (mode === 'fin') response.socket.end();
        else if (mode === 'rst') response.socket.resetAndDestroy();
      });
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write('data: ready\n\n');
    });
    observeSockets(upstream, 'upstream', upstreamSockets);
    const centerPort = await listen(upstream);
    const reservation = originalCreateServer();
    const webPort = await listen(reservation);
    await close(reservation);
    assert.ok(![61227, 61228, 4320].includes(webPort) && ![61227, 61228, 4320].includes(centerPort));
    report.ports = { centerPort, webPort };
    // Observe the actual Vite server; this wrapper only forwards original calls and adds passive listeners.
    http.createServer = function (...args) {
      const server = originalCreateServer.apply(this, args);
      frontendServers.push(server); observeSockets(server, 'frontend', frontendSockets); return server;
    };
    syncBuiltinESMExports();
    stage = 'start-static-web';
    web = await startStaticWeb({ directory, artifact, repository: process.cwd(), webPort, centerPort });
    assert.equal(frontendServers.length, 1);
    const frontend = frontendServers[0];
    for (const mode of ['complete', 'fin', 'rst']) {
      stage = mode;
      const outcome = { mode, firstFrame: false, bytes: 0, terminal: null };
      let end;
      const terminal = new Promise(resolve => { end = resolve; });
      const request = http.get({ host: '127.0.0.1', port: webPort, path: `/api/events?mode=${mode}`, agent: false,
        headers: { authorization: 'Bearer svc08-synthetic', origin: 'http://synthetic.invalid' } }, response => {
        outcome.status = response.statusCode;
        response.on('data', bytes => {
          outcome.bytes += bytes.length;
          if (!outcome.firstFrame) { outcome.firstFrame = true; triggers.get(mode)(); }
        });
        for (const name of ['end', 'aborted', 'error', 'close']) response.on(name, error => {
          outcome.terminal ??= name; outcome.errorCode ??= error?.code; end(true);
        });
      });
      pending.add(request); report.requests++;
      request.on('error', error => { outcome.requestError = error.code; end(true); });
      outcome.settledWithin300ms = await within(terminal, 300);
      await pause(15);
      outcome.beforeOwnCleanup = { frontendConnections: await connections(frontend), frontendTracked: frontendSockets.size,
        upstreamConnections: await connections(upstream), upstreamTracked: upstreamSockets.size };
      report.cases.push(outcome);
      await checkpoint(evidence, report);
      request.destroy(); pending.delete(request);
      await pause(20);
    }
    stage = 'final-identity';
    const identityResult = await new Promise((resolve, reject) => {
      const request = http.get({ host: '127.0.0.1', port: webPort, path: '/__flow_preview_identity', agent: false }, response => {
        const chunks = []; let size = 0;
        response.on('data', bytes => { size += bytes.length; if (size > 4096) response.destroy(); else chunks.push(bytes); });
        response.on('error', reject);
        response.on('end', () => resolve({ status: response.statusCode, value: JSON.parse(Buffer.concat(chunks)) }));
      });
      pending.add(request); request.on('close', () => pending.delete(request)); request.on('error', reject);
    });
    report.requests++;
    report.finalIdentity = identityResult;
    assert.equal(identityResult.status, 200); assert.deepEqual(identityResult.value, artifact);
    assert.equal(report.requests, 4);
    const leaks = report.cases.filter(value => !value.firstFrame || !value.settledWithin300ms || value.beforeOwnCleanup.frontendConnections !== 0);
    assert.deepEqual(leaks.map(value => value.mode), [], 'upstream termination must settle downstream before fixture cleanup');
    assert.ok(report.events.filter(value => value.name === 'request').every(value => value.authorizationPreserved && value.originPreserved));
  } catch (error) {
    report.primaryFailure = { stage, name: error.name, code: error.code, message: error.message.slice(0, 512) };
    throw error;
  } finally {
    // Save the earliest result before cleanup; cleanup cannot turn a behavioral failure green.
    let durable = false;
    try { await checkpoint(evidence, report); durable = true; }
    finally {
      for (const request of pending) request.destroy();
      for (const socket of frontendSockets) socket.destroy();
      for (const socket of upstreamSockets) socket.destroy();
      if (web) await web.close();
      else for (const server of frontendServers) if (server.listening) await close(server);
      if (upstream?.listening) await close(upstream);
      http.createServer = originalCreateServer; syncBuiltinESMExports();
    }
    await pause(15);
    report.cleanup = { state: 'closed', frontendTracked: frontendSockets.size, upstreamTracked: upstreamSockets.size,
      frontendListening: frontendServers.some(server => server.listening), upstreamListening: upstream?.listening ?? false, directory: 'KEEP' };
    await checkpoint(evidence, report);
    const current = await lstat(directory);
    if (durable && evidence !== join(directory, 'checkpoint.json') && current.dev === identity.dev && current.ino === identity.ino
      && current.isDirectory() && frontendSockets.size === 0 && upstreamSockets.size === 0) {
      await rm(directory, { recursive: true }); report.cleanup.directory = 'removed'; await checkpoint(evidence, report);
    }
  }
});
