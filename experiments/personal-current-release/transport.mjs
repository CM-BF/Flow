import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { extname, join } from 'node:path';
import { sha } from './inventory.mjs';
export async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  return server.address().port;
}
export async function closeHttp(server) {
  server.closeAllConnections();
  if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
export async function until(read, accepts, signal, ms = 10000) {
  const end = Date.now() + ms;
  do { signal?.throwIfAborted(); const value = await read(); if (accepts(value)) return value; await new Promise(resolve => setTimeout(resolve, 25)); } while (Date.now() < end);
  throw Error('Owned compatibility condition timed out');
}
/** ef458 method: a complete real upstream receipt precedes downstream headers and one-byte body prefix. */
async function truncateAck(incoming, response, bytes, record) {
  assert.ok(incoming.complete && bytes.length > 1 && bytes.length <= 128 * 1024);
  assert.ok(!incoming.headers['content-encoding'] || incoming.headers['content-encoding'] === 'identity');
  const contentType = incoming.headers['content-type'] ?? ''; assert.match(contentType, /^application\/json(?:\s*;|$)/i);
  const length = incoming.headers['content-length'], transfer = incoming.headers['transfer-encoding'];
  assert.ok(!(length && transfer) && (!transfer || transfer.toLowerCase() === 'chunked'));
  if (length !== undefined) { assert.match(length, /^\d+$/); assert.equal(Number(length), bytes.length); }
  assert.ok(bytes.equals(Buffer.from(bytes.toString('utf8'))));
  const ack = JSON.parse(bytes.toString('utf8')); assert.equal(typeof ack.turn?.id, 'string'); assert.equal(typeof ack.turn?.task?.id, 'string');
  const socket = response.socket; assert.ok(socket && !socket.destroyed);
  const prefix = bytes.subarray(0, 1), fault = { kind: 'truncated-ack-body', contentLength: bytes.length, contentType, prefixBytes: 1, prefixSha256: sha(prefix), headersFlushed: false, prefixFlushed: false, endFlushed: false, socketClosed: false };
  record.fault = fault;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { fault.error = 'ACK close deadline'; socket.destroy(); }, 1000);
    response.once('error', () => { fault.error = 'ACK response error'; socket.destroy(); });
    socket.once('error', () => { fault.error = 'ACK socket error'; });
    socket.once('close', hadError => { clearTimeout(timer); fault.socketClosed = true; if (hadError || fault.error || !fault.prefixFlushed || !fault.endFlushed) reject(Error(fault.error ?? 'ACK flush unknown')); else resolve(); });
    response.writeHead(record.status, { 'content-type': contentType, 'content-length': bytes.length, connection: 'close', 'cache-control': 'no-store' });
    response.flushHeaders(); fault.headersFlushed = true;
    response.write(prefix, error => { if (error) { fault.error = 'ACK prefix write failed'; socket.destroy(); return; } fault.prefixFlushed = true; socket.end(() => { fault.endFlushed = true; }); });
  });
}
/** Actual immutable App assets + public HTTP proxy. No synthetic UI or compatibility pointer is created. */
export async function previewHost(entry, centerPort, releaseAsset, signal) {
  const index = entry.manifest.files.find(x => x.path === 'index.html'); assert.ok(index);
  const namespace = entry.manifest.format === 2 ? `/__flow_releases/${entry.manifest.releaseId}/` : '/';
  const snapshot = { index: { ...index, path: join(entry.dist, index.path) }, assets: new Map(entry.manifest.files.filter(x => x.path !== 'index.html').map(x => [namespace + x.path, { ...x, path: join(entry.dist, x.path) }])) };
  const records = [], problems = [], upstreams = new Set(), faults = new Set(); let drop = false, legacy = false, capturedBytes = 0;
  const server = createServer((request, response) => {
    void (async () => {
      signal.throwIfAborted(); const path = request.url ?? '/';
      if (!/^\/api(?:\/|$)/.test(path)) {
        if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
        const file = await releaseAsset(snapshot, path.split('?')[0], request.headers.accept?.includes('text/html'));
        if (!file) { response.writeHead(404).end(); return; }
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
        response.writeHead(200, { 'content-type': mime[extname(file.path)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'content-length': file.bytes.length }); response.end(request.method === 'HEAD' ? undefined : file.bytes); return;
      }
      const chunks = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; assert.ok(bytes <= 65536); chunks.push(chunk); }
      assert.ok(records.length < 1000 && capturedBytes < 2 * 1024 * 1024);
      const body = Buffer.concat(chunks).toString('utf8'), headers = { ...request.headers };
      if (legacy) delete headers['x-flow-assistant-stream'];
      const lose = drop && request.method === 'POST' && /\/conversations\/[^/]+\/turns$/.test(path); if (lose) drop = false;
      const upstream = httpRequest({ hostname: '127.0.0.1', port: centerPort, path, method: request.method, headers }, incoming => {
        const json = incoming.headers['content-type']?.includes('application/json'), dropped = lose && incoming.statusCode >= 200 && incoming.statusCode < 300;
        const raw = []; let size = 0; if (lose && !dropped) problems.push('Expected accepted turn ACK');
        if (!dropped) response.writeHead(incoming.statusCode, incoming.headers);
        incoming.on('data', chunk => { if (json) { size += chunk.length; if (size <= 128 * 1024) raw.push(chunk); } if (!dropped) response.write(chunk); });
        incoming.on('end', () => {
          const rawBody = json && size <= 128 * 1024 ? Buffer.concat(raw).toString('utf8') : null;
          const record = { method: request.method, path, status: incoming.statusCode, key: request.headers['idempotency-key'] ?? null, body, stream: request.headers['x-flow-assistant-stream'] ?? null, forwardedStream: headers['x-flow-assistant-stream'] ?? null, profile: request.headers['x-flow-execution-profile'] ?? null, responseBody: path === '/api/runners' ? null : rawBody, dropped };
          const initialBytes = Buffer.byteLength(JSON.stringify(record)); capturedBytes += initialBytes;
          if (capturedBytes > 2 * 1024 * 1024 || records.length >= 1000) { problems.push('Wire bound exceeded'); response.destroy(); return; }
          records.push(record);
          if (dropped) {
            const write = (async () => { assert.ok(json && rawBody !== null); await truncateAck(incoming, response, Buffer.from(rawBody), record); })()
              .catch(() => { problems.push('ACK body fault unconfirmed'); response.destroy(); })
              .finally(() => { capturedBytes += Buffer.byteLength(JSON.stringify(record)) - initialBytes; if (capturedBytes > 2 * 1024 * 1024) problems.push('Wire fault bound exceeded'); });
            faults.add(write); void write.finally(() => faults.delete(write));
          } else response.end();
        });
        incoming.on('error', () => { if (!signal.aborted && !response.destroyed) problems.push('Upstream response interrupted'); response.destroy(); });
      });
      upstreams.add(upstream); upstream.once('close', () => upstreams.delete(upstream));
      upstream.on('error', () => { if (!response.destroyed && !signal.aborted) { problems.push('Upstream request failed'); if (!response.headersSent) response.writeHead(502); response.end(); } });
      response.on('close', () => upstream.destroy()); upstream.end(body);
    })().catch(() => { problems.push('Preview request failed'); if (!response.destroyed) { if (!response.headersSent) response.writeHead(503); response.end(); } });
  });
  const abort = () => { for (const upstream of upstreams) upstream.destroy(); server.closeAllConnections(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const port = await listen(server); signal.throwIfAborted();
    return { ...entry, url: `http://127.0.0.1:${port}`, port, records, problems, loseNextTurn: () => { assert.equal(drop, false); drop = true; }, setLegacy: value => { legacy = value; }, close: async () => { abort(); await closeHttp(server); await Promise.all(faults); signal.removeEventListener('abort', abort); assert.deepEqual(problems, []); } };
  } catch (e) { abort(); await closeHttp(server); signal.removeEventListener('abort', abort); throw e; }
}
