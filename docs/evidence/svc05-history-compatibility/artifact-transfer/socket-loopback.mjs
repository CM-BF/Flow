/** One isolated diagnostic. Fixed production source; observers never repair sockets. */
import http from 'node:http';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
import { mkdir, mkdtemp, realpath, lstat, open, readFile, symlink, statfs } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { boundedFile } from './import-d629.mjs';

const start = performance.now(), execute = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const repository = fileURLToPath(new URL('../../../../', import.meta.url));
const evidence = process.argv[2];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const proposalBytes = await readFile(join(here, 'socket-reproduction-proposal.json'));
if (digest(proposalBytes) !== '1d36654722d07f07f43c5e131bd93af836096d2a721ff827f91dcb02c56e10ee') throw Error('PROPOSAL_CHANGED');
const proposal = JSON.parse(proposalBytes), limits = proposal.limits;
const artifactId = 'd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88';
const artifactSource = '/private/tmp/flow-release03-prepare-5069586-u1zh3mln/artifacts/web-artifacts/' + artifactId;
if (!evidence?.startsWith(here + '/') || process.argv.length !== 3) throw Error('OWN_NEW_EVIDENCE_REQUIRED');
const freeBytes = async () => { const v = await statfs(tmpdir()); return Number(v.bavail) * Number(v.bsize); };
if (await freeBytes() < limits.freshFreeRequiredBytes) throw Error('SPACE_GATE');
await mkdir(evidence, { mode: 0o700 });
const root = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc05h-sockets-'))), initial = await lstat(root);
const report = { startedAt: new Date().toISOString(), root, identity: { dev: initial.dev, ino: initial.ino },
  pid: process.pid, node: process.version, executable: process.execPath, attempts: 0, phase: 'prepare', inputs: [], requests: [], events: [], snapshots: [], ports: [],
  outcome: 'unknown', pg: 0, provider: 0, personalActions: 0, cleanup: 'pending' };
const abort = new AbortController(); let fatal;
function stop(code) { if (!fatal) fatal = code; abort.abort(); }
function guard() { if (fatal) throw Error(fatal); if (performance.now() - start >= limits.workMs) { stop('WORK_DEADLINE'); throw Error(fatal); } }
function event(kind, value = {}) {
  if (report.events.length >= 2500) { stop('EVENT_LIMIT'); return; }
  report.events.push({ ms: Math.round(performance.now() - start), kind, ...value });
}
async function record(name, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  if (bytes.length > 400_000) throw Error('RECORD_LIMIT');
  const file = await open(join(evidence, name), 'wx', 0o600);
  try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
  const dir = await open(evidence, 'r'); try { await dir.sync(); } finally { await dir.close(); }
}
await record('reservation.json', { ...report, limits, proposalSha256: digest(proposalBytes) });
const timer = setTimeout(() => stop('WORK_DEADLINE'), Math.max(1, limits.workMs - (performance.now() - start)));
process.on('SIGTERM', () => stop('SUPERVISOR_STOP'));
const clients = new Set(), servers = [], socketRecords = [], held = [];
const originalCreate = http.createServer;
let role = 'frontend', nextSocket = 1, staticWeb, upstream, frontend;
let knownLogicalBytes = 0;
function observe(server, label) {
  const state = { server, label, sockets: new Set(), drops: 0, requests: 0, closed: false };
  server.on('close', () => { state.closed = true; event('server-close', { label }); });
  server.on('connection', socket => {
    const item = { id: nextSocket++, label, socket, closed: false, finalRead: 0, finalWritten: 0 };
    state.sockets.add(socket); socketRecords.push(item); event('connection', { label, id: item.id });
    if (label === 'upstream' && state.sockets.size > 64) stop('UPSTREAM_LIMIT');
    socket.on('end', () => event('socket-end', { label, id: item.id }));
    socket.on('error', error => event('socket-error', { label, id: item.id, code: error.code ?? 'UNKNOWN' }));
    socket.on('close', hadError => {
      item.closed = true; item.finalRead = socket.bytesRead; item.finalWritten = socket.bytesWritten;
      state.sockets.delete(socket); event('socket-close', { label, id: item.id, hadError });
    });
  });
  server.on('request', request => {
    state.requests++; event('http-arrival', { label, path: (request.url ?? '').slice(0, 80) });
  });
  server.on('drop', () => { state.drops++; event('drop', { label }); });
  servers.push(state); return state;
}
http.createServer = function (...args) { const server = Reflect.apply(originalCreate, this, args); observe(server, role); return server; };
syncBuiltinESMExports();
const count = server => new Promise((resolve, reject) => server.getConnections((error, n) => error ? reject(error) : resolve(n)));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function snapshot(label) {
  guard(); const values = [];
  for (const state of servers) values.push({ role: state.label, getConnections: await count(state.server), tracked: state.sockets.size, drops: state.drops, requests: state.requests });
  const observedWireBytes = socketRecords.reduce((n, s) => n + (s.closed ? s.finalRead + s.finalWritten : s.socket.bytesRead + s.socket.bytesWritten), 0);
  const available = await freeBytes();
  if (available < limits.reserveBytes || observedWireBytes > limits.totalObservedWireBytesStop) stop('RESOURCE_STOP');
  const entry = { label, ms: Math.round(performance.now() - start), values, observedWireBytes, available };
  report.snapshots.push(entry); guard(); return entry;
}
async function settle(label, milliseconds = 1000) {
  const until = performance.now() + milliseconds;
  do {
    guard();
    if ((await Promise.all(servers.map(s => count(s.server)))).every(n => n === 0) && servers.every(s => s.sockets.size === 0)) return snapshot(label);
    await delay(25);
  } while (performance.now() < until);
  return snapshot(label);
}
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string' || address.address !== '127.0.0.1' || [61227, 61228].includes(address.port)) throw Error('PORT_IDENTITY');
  report.ports.push(address.port); return address.port;
}
async function write(path, bytes) {
  knownLogicalBytes += bytes.length;
  if (knownLogicalBytes > limits.ownTempLogicalStopBytes) throw Error('TEMP_LIMIT');
  const file = await open(path, 'wx', 0o600); try { await file.writeFile(bytes); } finally { await file.close(); }
}
function attempt() { guard(); if (++report.attempts > 136 || clients.size >= 65) throw Error('ATTEMPT_LIMIT'); }
function partialReset(port) {
  attempt();
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: '127.0.0.1', port }); clients.add(socket);
    const deadline = setTimeout(() => { socket.destroy(); reject(Error('PARTIAL_DEADLINE')); }, 2000);
    const stopped = () => { socket.destroy(); reject(Error(fatal ?? 'STOPPED')); }; abort.signal.addEventListener('abort', stopped, { once: true });
    socket.once('connect', () => socket.write('GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n', () => socket.resetAndDestroy()));
    socket.on('error', error => event('client-partial-error', { code: error.code ?? 'UNKNOWN' }));
    socket.once('close', () => { clearTimeout(deadline); abort.signal.removeEventListener('abort', stopped); clients.delete(socket); resolve(); });
  });
}
function request(port, path, mode = 'complete') {
  attempt();
  return new Promise((resolve, reject) => {
    let bytes = 0, done = false, body = Buffer.alloc(0), response;
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', agent: false, headers: { Connection: 'close' } });
    const row = { path, mode, status: null, error: null, bodyBytes: 0 }; report.requests.push(row);
    const finish = (error, value) => {
      if (done) return; done = true; clearTimeout(deadline); abort.signal.removeEventListener('abort', stopped);
      if (error) { req.destroy(); reject(error); } else resolve(value);
    };
    const stopped = () => finish(Error(fatal ?? 'STOPPED'));
    const deadline = setTimeout(() => finish(Error('REQUEST_DEADLINE')), 2000);
    abort.signal.addEventListener('abort', stopped, { once: true });
    req.on('socket', socket => { clients.add(socket); socket.once('close', () => clients.delete(socket)); });
    req.on('error', error => {
      row.error = error.code ?? 'UNKNOWN';
      if (mode === 'drop') finish(null, row); else if (!done) finish(error);
    });
    req.on('response', res => {
      response = res; row.status = res.statusCode;
      if (res.statusCode !== 200) { finish(Error('HTTP_STATUS')); return; }
      res.on('error', error => { if (!done) finish(error); });
      res.on('data', chunk => {
        bytes += chunk.length; row.bodyBytes = bytes;
        if (bytes > 4096) { finish(Error('BODY_LIMIT')); return; }
        body = Buffer.concat([body, chunk]);
        if (mode === 'abort' || mode === 'hold') {
          if (bytes !== 16 || body.toString() !== 'data: 12345678\n\n') { finish(Error('SSE_FRAME')); return; }
          if (mode === 'abort') { finish(null, row); req.destroy(); res.destroy(); }
          else { held.push({ req, res }); finish(null, row); }
        }
      });
      res.on('end', () => finish(null, { row, body }));
    });
    req.end();
  });
}
try {
  const moduleRoot = join(root, 'modules'); await mkdir(moduleRoot, { mode: 0o700 });
  for (const input of proposal.inputs) {
    const bytes = input.ref ? (await execute('git', ['-C', repository, 'show', `${input.ref}:${input.path}`], { encoding: 'buffer', timeout: 2000, maxBuffer: 100_000 })).stdout
      : await boundedFile(input.path.startsWith('/') ? input.path : join(repository, input.path), input.bytes, input.sha256);
    if (bytes.length !== input.bytes || digest(bytes) !== input.sha256) throw Error('INPUT_CHANGED');
    report.inputs.push({ path: input.path, bytes: bytes.length, sha256: digest(bytes) });
    if (input.ref) await write(join(moduleRoot, input.path.split('/').at(-1)), bytes);
  }
  for (const name of ['net', '_http_server']) if (digest(process.binding('natives')[name]) !== proposal.inputs.find(x => x.path === `/tmp/flow-svc05h-${name}-embedded-source.js`).sha256) throw Error('NODE_SOURCE_CHANGED');
  const state = join(root, 'state'), target = join(state, 'web-artifacts', artifactId);
  await mkdir(join(target, 'dist/assets'), { recursive: true, mode: 0o700 });
  const manifestInfo = await lstat(join(artifactSource, 'manifest.json'));
  const manifestBytes = await boundedFile(join(artifactSource, 'manifest.json'), manifestInfo.size, artifactId), manifest = JSON.parse(manifestBytes);
  if (manifest.files.length !== 10 || manifest.totalBytes !== 1588311) throw Error('ARTIFACT_CHANGED');
  for (const file of manifest.files) {
    if (file.path !== 'index.html' && !/^assets\/[A-Za-z0-9_.-]+$/.test(file.path)) throw Error('ARTIFACT_PATH');
    await write(join(target, 'dist', file.path), await boundedFile(join(artifactSource, 'dist', file.path), file.bytes, file.sha256));
  }
  await write(join(target, 'manifest.json'), manifestBytes);
  const localRepo = join(root, 'repo'); await mkdir(join(localRepo, 'apps/web/node_modules'), { recursive: true, mode: 0o700 });
  await write(join(localRepo, 'apps/web/package.json'), Buffer.from('{"type":"module"}'));
  await symlink(dirname(proposal.inputs.find(x => x.path.endsWith('/vite/package.json')).path), join(localRepo, 'apps/web/node_modules/vite'));
  const release = await import(pathToFileURL(join(moduleRoot, 'web-release.mjs')).href);
  const compatibilityId = await release.importWebCompatibility({ directory: state, reportDirectory: join(repository, 'docs/evidence/svc05-history-compatibility/release-preparation/candidate-compatibility') });
  const artifact = { artifactId, sourceHead: manifest.sourceHead, manifestDigest: artifactId };
  await release.commitWebRelease(state, await release.planWebRelease({ directory: state, artifact, expectedVersion: 0, action: 'bootstrap', backendHead: proposal.productRef, compatibilityId }));
  role = 'upstream';
  upstream = http.createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/api/sse') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' }); res.write('data: 12345678\n\n');
  });
  const centerPort = await listen(upstream);
  const reservation = net.createServer(); const webPort = await listen(reservation);
  await new Promise((resolve, reject) => reservation.close(e => e ? reject(e) : resolve()));
  role = 'frontend';
  const { startStaticWeb } = await import(pathToFileURL(join(moduleRoot, 'static-web.mjs')).href);
  staticWeb = await startStaticWeb({ directory: state, repository: localRepo, artifact, webPort, centerPort });
  frontend = servers.find(s => s.label === 'frontend');
  if (!frontend || servers.length !== 2 || frontend.server.maxConnections !== 64 || frontend.server.listenerCount('clientError') < 1) throw Error('SERVER_POLICY');
  frontend.server.on('clientError', error => event('client-error', { code: error.code ?? 'UNKNOWN' }));
  report.phase = 'baseline';
  const index = await request(webPort, '/');
  if (index.body.length !== 950 || digest(index.body) !== '542c52c4c40abc54a9f6cf30a9f271b93c0ae7e092ef22864f017ce273d91fc3') throw Error('INDEX_IDENTITY');
  const identity = await request(webPort, '/__flow_preview_identity');
  if (JSON.parse(identity.body).artifactId !== artifactId) throw Error('IDENTITY');
  await settle('baseline-zero');
  report.phase = 'churn';
  for (let i = 0; i < 64; i++) {
    if (i % 2 === 0) await partialReset(webPort); else await request(webPort, '/api/sse', 'abort');
    if ((i + 1) % 8 === 0) await snapshot(`churn-${i + 1}`);
  }
  const churn = await settle('churn-final', 7000);
  report.churnReturnedZero = churn.values.every(v => v.getConnections === 0 && v.tracked === 0);
  if (!report.churnReturnedZero) {
    report.outcome = 'RETENTION_CANDIDATE'; report.calibration = 'SKIPPED_NONZERO';
  } else {
    await request(webPort, '/__flow_preview_identity'); await settle('pre-calibration-zero');
    report.phase = 'calibration';
    for (let i = 0; i < 64; i++) await request(webPort, '/api/sse', 'hold');
    const full = await snapshot('calibration-64');
    if (full.values.find(v => v.role === 'frontend').getConnections !== 64) throw Error('CALIBRATION_COUNT');
    const before = { drops: frontend.drops, requests: frontend.requests };
    const overflow = await request(webPort, '/__flow_preview_identity', 'drop');
    await delay(20);
    report.calibration = { before, after: { drops: frontend.drops, requests: frontend.requests }, overflow,
      dropBeforeHttp: frontend.drops === before.drops + 1 && frontend.requests === before.requests && overflow.status === null && overflow.error !== null };
    if (!report.calibration.dropBeforeHttp) throw Error('CALIBRATION_NOT_ESTABLISHED');
    for (const { req, res } of held) { req.destroy(); res.destroy(); }
    const drained = await settle('calibration-drained', 7000);
    if (!drained.values.every(v => v.getConnections === 0 && v.tracked === 0)) throw Error('CALIBRATION_RETAINED');
    const restored = await request(webPort, '/__flow_preview_identity');
    if (JSON.parse(restored.body).artifactId !== artifactId) throw Error('RESTORED_IDENTITY');
    report.outcome = 'CHURN_NOT_REPRODUCED_CAPACITY_DROP_CONFIRMED';
  }
} catch (error) {
  report.failure = { message: String(error.message).slice(0, 180), code: error.code ?? null };
  report.outcome = 'FAILED_OR_UNKNOWN';
} finally {
  clearTimeout(timer); report.workElapsedMs = Math.round(performance.now() - start); report.phase = 'cleanup';
  await record('cleanup-started.json', { at: new Date().toISOString(), workElapsedMs: report.workElapsedMs });
  abort.abort(); for (const socket of clients) socket.destroy();
  try {
    let cleanupTimer;
    try { await Promise.race([Promise.all([
      staticWeb?.close(),
      ...servers.filter(s => s !== frontend).map(s => new Promise((resolve, reject) => { s.server.closeAllConnections(); s.server.close(e => e ? reject(e) : resolve()); }))
    ]), new Promise((_, reject) => { cleanupTimer = setTimeout(() => reject(Error('CLEANUP_DEADLINE')), 7000); })]); }
    finally { clearTimeout(cleanupTimer); }
    report.serverCleanup = await Promise.all(servers.map(async s => ({ role: s.label, listening: s.server.listening, closed: s.closed, connections: await count(s.server), tracked: s.sockets.size })));
    report.cleanup = report.serverCleanup.every(s => !s.listening && s.closed && s.connections === 0 && s.tracked === 0) ? 'SERVERS_STOPPED_TMP_RETAINED_FOR_SUPERVISOR' : 'UNKNOWN_KEEP';
  } catch (error) { report.cleanup = 'UNKNOWN_KEEP'; report.cleanupError = { code: error.code ?? null, message: String(error.message).slice(0, 180) }; }
  http.createServer = originalCreate; syncBuiltinESMExports();
  report.knownLogicalBytes = knownLogicalBytes; report.elapsedMs = Math.round(performance.now() - start);
  report.sockets = socketRecords.map(s => ({ id: s.id, role: s.label, closed: s.closed, destroyed: s.socket.destroyed, readableEnded: s.socket.readableEnded, writableFinished: s.socket.writableFinished, bytesRead: s.closed ? s.finalRead : s.socket.bytesRead, bytesWritten: s.closed ? s.finalWritten : s.socket.bytesWritten }));
  await record('checkpoint.json', report);
  process.stdout.write(JSON.stringify({ outcome: report.outcome, attempts: report.attempts, cleanup: report.cleanup, elapsedMs: report.elapsedMs }) + '\n');
  process.exitCode = report.outcome === 'FAILED_OR_UNKNOWN' || report.cleanup === 'UNKNOWN_KEEP' ? 1 : 0;
}
