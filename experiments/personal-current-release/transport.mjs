import { createServer, request as httpRequest } from 'node:http';
export async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}
export async function closeHttp(server) {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
export async function freePort() { const server = createServer(); const port = await listen(server); await closeHttp(server); return port; }
/** Bounded wire observation; never captures authorization. Drops only an acknowledged turn response. */
export async function observationProxy(centerPort) {
  const records = []; let drop = false, legacy = false;
  const server = createServer((request, response) => {
    if (records.length >= 2000) { response.writeHead(503); response.end(); return; }
    let bytes = 0; const chunks = [];
    request.on('data', chunk => { bytes += chunk.length; if (bytes > 65536) request.destroy(); else chunks.push(chunk); });
    request.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      const headers = { ...request.headers }; if (legacy) delete headers['x-flow-assistant-stream'];
      const lose = drop && request.method === 'POST' && /\/conversations\/[^/]+\/turns$/.test(request.url);
      if (lose) drop = false;
      const upstream = httpRequest({ hostname: '127.0.0.1', port: centerPort, path: request.url, method: request.method, headers }, incoming => {
        const raw = []; let size = 0;
        const record = { method: request.method, path: request.url, status: incoming.statusCode, key: request.headers['idempotency-key'], body: body || undefined,
          stream: request.headers['x-flow-assistant-stream'], forwardedStream: headers['x-flow-assistant-stream'], profile: headers['x-flow-execution-profile'], dropped: false };
        if (!lose) response.writeHead(incoming.statusCode, incoming.headers);
        incoming.on('data', chunk => { size += chunk.length; if (size <= 1048576) raw.push(chunk); if (!lose) response.write(chunk); });
        incoming.on('end', () => {
          if (size <= 1048576 && incoming.headers['content-type']?.includes('application/json')) {
            try { record.response = JSON.parse(Buffer.concat(raw).toString()); } catch { record.json = 'invalid'; }
          }
          record.responseBytes = size; record.dropped = lose && incoming.statusCode >= 200 && incoming.statusCode < 300;
          records.push(record);
          if (record.dropped) response.destroy(); else if (lose) { response.writeHead(incoming.statusCode, incoming.headers); response.end(Buffer.concat(raw)); } else response.end();
        });
      });
      upstream.on('error', () => { if (!response.destroyed) { response.writeHead(502); response.end(); } });
      response.on('close', () => upstream.destroy()); upstream.end(body);
    });
  });
  return { port: await listen(server), records, loseNextTurn: () => { drop = true; }, setLegacy: value => { legacy = value; }, close: () => closeHttp(server) };
}
export async function until(read, accepts, ms = 10000) {
  const end = Date.now() + ms;
  do { const value = await read(); if (accepts(value)) return value; await new Promise(resolve => setTimeout(resolve, 50)); } while (Date.now() < end);
  throw Error('Owned compatibility condition timed out');
}
