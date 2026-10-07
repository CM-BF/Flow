import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, request as httpRequest, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BACKEND = 'af51c621696230fbced12227670f014ca73bd8a1';
export const BACKEND_ROOT = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-history-compatibility';
export const ARTIFACT = Object.freeze({ artifactId: 'd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88',
  manifestDigest: 'd629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88', sourceHead: '5069586a9f17332de526e101eca3a4250cbc8d91' });
export const ARTIFACT_ROOT = '/private/tmp/flow-release03-prepare-5069586-u1zh3mln/artifacts';
export const CONFLICT_DRAFT = '保留中文🙂\nconflicting terminal draft';
export const WEB_A = 'TUI01F Web first task A';
export const WEB_B = 'TUI01F Web continued task B';
export const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export type WireRecord = { role: 'web' | 'terminal'; method: string; path: string; key: string | null; body: string;
  status: number | null; responseBody: string | null; completed: boolean };

/** A bounded test gate, not a second conversation state machine. The center remains authoritative. */
export class HandoffWrites {
  readonly writes: WireRecord[] = [];
  private terminalSends = 0;
  private webSends = 0;
  private cancels = 0;
  private firstTask: string | undefined;
  private secondAllowed = false;
  private release?: () => void;
  private reject?: (error: Error) => void;
  private onHeld!: (record: WireRecord) => void;
  readonly held = new Promise<WireRecord>(resolve => { this.onHeld = resolve; });
  constructor(readonly conversationId: string) { assert.match(conversationId, /^[a-f0-9-]{36}$/); }
  async begin(role: WireRecord['role'], path: string, key: string, body: string) {
    assert.ok(key.length > 0 && key.length <= 200 && !/[\r\n]/.test(key));
    assert.ok(Buffer.byteLength(body) <= 16384);
    const value = JSON.parse(body), turnPath = `/api/conversations/${this.conversationId}/turns`;
    const record: WireRecord = { role, method: 'POST', path, key, body, status: null, responseBody: null, completed: false };
    if (path === turnPath && role === 'terminal') {
      assert.equal(++this.terminalSends, 1); assert.equal(value.text, CONFLICT_DRAFT); assert.equal(value.mode, 'follow-up');
      assert.equal(value.expectedRevision, 0); this.writes.push(record);
      const held = new Promise<void>((resolve, reject) => { this.release = resolve; this.reject = reject; });
      this.onHeld(record); await held; return record;
    }
    if (path === turnPath && role === 'web') {
      const number = ++this.webSends; assert.ok(number <= 2);
      assert.equal(value.text, number === 1 ? WEB_A : WEB_B); assert.equal(value.mode, 'follow-up');
      if (number === 2) assert.equal(this.secondAllowed, true);
    } else {
      assert.equal(role, 'terminal'); assert.ok(this.firstTask); assert.equal(path, `/api/tasks/${this.firstTask}/cancel`);
      assert.equal(++this.cancels, 1); assert.equal(body, '{}');
    }
    this.writes.push(record); return record;
  }
  complete(record: WireRecord, status: number, response: string) {
    record.status = status; record.responseBody = response; record.completed = true;
    const value = JSON.parse(response);
    if (record.role === 'web') {
      assert.ok(status >= 200 && status < 300); assert.equal(value.conversation.id, this.conversationId);
      assert.equal(value.turn.number, this.webSends); assert.match(value.turn.task.id, /^[a-f0-9-]{36}$/);
      if (this.webSends === 1) this.firstTask = value.turn.task.id;
    } else if (record.path.endsWith('/turns')) {
      assert.equal(status, 409); assert.equal(value.error?.code, 'conversation_revision_conflict');
    } else {
      assert.ok(status >= 200 && status < 300); assert.equal(value.id, this.firstTask);
      assert.ok(['cancel_requested', 'cancelled'].includes(value.status));
    }
  }
  releaseConflict() { assert.ok(this.firstTask && this.release); const release = this.release; this.release = undefined; this.reject = undefined; release(); }
  allowSecond(taskId: string) { assert.equal(taskId, this.firstTask); assert.equal(this.cancels, 1); this.secondAllowed = true; }
  abort() { this.reject?.(Error('Handoff ended with the immutable request still held')); this.release = undefined; this.reject = undefined; }
  verify() {
    assert.equal(this.terminalSends, 1); assert.equal(this.webSends, 2); assert.equal(this.cancels, 1);
    assert.equal(this.writes.length, 4); assert.ok(this.writes.every(value => value.completed));
  }
}

async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const address = server.address(); assert.ok(address && typeof address !== 'string'); return `http://127.0.0.1:${address.port}`;
}
async function close(server: Server) {
  server.closeAllConnections(); if (!server.listening) return;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
async function requestBody(request: IncomingMessage) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; assert.ok(size <= 16384); chunks.push(chunk); }
  return Buffer.concat(chunks).toString('utf8');
}

/** Fixed real App files; separate origins distinguish real TUI and Web requests without altering their bodies. */
export async function openPreview(connection: { origin: string; token: string; conversationId: string }, signal: AbortSignal) {
  const { verifyWebArtifact } = await import(pathToFileURL(join(BACKEND_ROOT, 'tools/personal-preview/web-artifact.mjs')).href);
  const { releaseAsset } = await import(pathToFileURL(join(BACKEND_ROOT, 'tools/personal-preview/web-release.mjs')).href);
  const entry = await verifyWebArtifact({ directory: ARTIFACT_ROOT, artifact: ARTIFACT });
  const namespace = `/__flow_releases/${entry.manifest.releaseId}/`;
  type Asset = { path: string; bytes: number; sha256: string };
  const index = entry.manifest.files.find((file: Asset) => file.path === 'index.html'); assert.ok(index);
  const snapshot = { index: { ...index, path: join(entry.dist, index.path) }, assets: new Map(entry.manifest.files
    .filter((file: Asset) => file.path !== 'index.html').map((file: Asset) => [namespace + file.path, { ...file, path: join(entry.dist, file.path) }])) };
  const gate = new HandoffWrites(connection.conversationId), records: WireRecord[] = [], errors: string[] = [];
  const upstreams = new Set<ReturnType<typeof httpRequest>>(); let responseBytes = 0, requests = 0, closed = false;
  const handler = (role: WireRecord['role']) => (request: IncomingMessage, response: ServerResponse) => {
    const operation = async () => {
      signal.throwIfAborted(); const path = request.url ?? '/';
      assert.ok(path.startsWith('/') && !path.startsWith('//') && path.length <= 2048);
      if (!path.startsWith('/api/')) {
        if (role !== 'web' || !['GET', 'HEAD'].includes(request.method ?? '')) { response.writeHead(405).end(); return; }
        const file = await releaseAsset(snapshot, path.split('?')[0], request.headers.accept?.includes('text/html'));
        if (!file) { response.writeHead(404).end(); return; }
        const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
        response.writeHead(200, { 'content-type': mime[extname(file.path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
        response.end(request.method === 'HEAD' ? undefined : file.bytes); return;
      }
      if (request.headers.authorization !== `Bearer ${connection.token}`) { response.writeHead(401).end(); return; }
      assert.ok(++requests <= 1000); assert.ok(['GET', 'POST'].includes(request.method ?? ''));
      const body = await requestBody(request); if (request.method === 'GET') assert.equal(body, '');
      const record = request.method === 'POST' ? await gate.begin(role, path, String(request.headers['idempotency-key'] ?? ''), body)
        : { role, method: 'GET', path, key: null, body, status: null, responseBody: null, completed: false } as WireRecord;
      records.push(record); signal.throwIfAborted();
      const origin = new URL(connection.origin);
      const upstream = httpRequest({ hostname: origin.hostname, port: origin.port, method: request.method, path,
        headers: { ...request.headers, host: origin.host } }, incoming => {
        record.status = incoming.statusCode ?? null;
        const json = incoming.headers['content-type']?.includes('application/json'), chunks: Buffer[] = []; let bytes = 0;
        response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.on('data', (chunk: Buffer) => {
          responseBytes += chunk.length; bytes += chunk.length;
          if (responseBytes > 2 * 1024 ** 2 || json && bytes > 256 * 1024) { errors.push('Response byte budget exceeded'); upstream.destroy(); response.destroy(); return; }
          if (json) chunks.push(chunk);
          if (!response.write(chunk)) { incoming.pause(); response.once('drain', () => incoming.resume()); }
        });
        incoming.on('end', () => {
          try {
            record.completed = true; if (json) record.responseBody = Buffer.concat(chunks).toString('utf8');
            if (record.method === 'POST') { assert.ok(json && record.responseBody); gate.complete(record, incoming.statusCode!, record.responseBody); }
            response.end();
          } catch { errors.push('Public acknowledgement did not match the fixed recipe'); response.destroy(); }
        });
        incoming.on('error', () => { if (!closed && !response.destroyed) errors.push('Upstream interrupted'); response.destroy(); });
      });
      upstreams.add(upstream); upstream.once('close', () => upstreams.delete(upstream));
      upstream.on('error', () => { if (!closed && !response.destroyed) errors.push('Upstream request failed'); response.destroy(); });
      response.once('close', () => upstream.destroy()); upstream.end(body);
    };
    void operation().catch(() => { if (!closed) errors.push('Request refused or unknown'); response.destroy(); });
  };
  const web = createServer(handler('web')), terminal = createServer(handler('terminal'));
  const shutdown = async () => { if (closed) return; closed = true; gate.abort(); for (const request of upstreams) request.destroy(); await Promise.all([close(web), close(terminal)]); };
  const abort = () => { void shutdown().catch(() => { errors.push('Bridge shutdown unknown'); }); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const webOrigin = await listen(web), terminalOrigin = await listen(terminal); signal.throwIfAborted();
    return { webOrigin, terminalOrigin, gate, records, errors, artifact: { ...ARTIFACT, totalBytes: entry.manifest.totalBytes },
      close: async () => { await shutdown(); signal.removeEventListener('abort', abort); assert.deepEqual(errors, []); } };
  } catch (error) { await shutdown(); signal.removeEventListener('abort', abort); throw error; }
}
