import { timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { AgentCard } from '@a2a-js/sdk';
import { JsonRpcTransportHandler, ServerCallContext, validateVersion, type A2ARequestHandler } from '@a2a-js/sdk/server';

/** Node mounting and policy only; JSON-RPC codecs and dispatch come from the official SDK. */
export function createA2AHttpServer(options: { token: string; publicUrl?: string; handler: (address: () => string) => A2ARequestHandler }) {
  const signals = new Set<AbortController>();
  const server = createServer({ requestTimeout: 15_000, headersTimeout: 15_000 }, (request, response) => {
    void route(request, response).catch(() => { if (!response.headersSent) response.writeHead(500); response.end(); });
  });
  const handler = options.handler(() => {
    if (options.publicUrl) return options.publicUrl.replace(/\/$/, '');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Bridge must be listening before discovery.');
    return `http://127.0.0.1:${address.port}`;
  });
  const transport = new JsonRpcTransportHandler(handler);
  async function route(request: IncomingMessage, response: ServerResponse) {
    const expected = Buffer.from(`Bearer ${options.token}`);
    const actual = Buffer.from(request.headers.authorization ?? '');
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) { response.writeHead(401, { 'WWW-Authenticate': 'Bearer' }); response.end(); return; }
    const card = await handler.getAgentCard();
    if (request.method === 'GET' && request.url === '/.well-known/agent-card.json') {
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(AgentCard.toJSON(card))); return;
    }
    if (request.method !== 'POST' || request.url !== '/a2a') { response.writeHead(404); response.end(); return; }
    const controller = new AbortController(); signals.add(controller);
    response.on('close', () => controller.abort());
    const context = new ServerCallContext({ requestedVersion: String(request.headers['a2a-version'] ?? '0.3'), state: new Map<string, unknown>([['signal', controller.signal], ['commandKey', request.headers['idempotency-key']]]) });
    let requestId: unknown = null;
    try {
      request.setEncoding('utf8');
      let body = '';
      for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 2 * 1024 * 1024) { response.writeHead(413); response.end(); return; } }
      try { requestId = JSON.parse(body).id ?? null; } catch { /* Official transport emits the malformed request error. */ }
      validateVersion(context.requestedVersion, card, 'JSONRPC');
      const result = await transport.handle(body, context);
      if (Symbol.asyncIterator in result) {
        response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'A2A-Version': '1.0' });
        try {
          for await (const event of result) {
            const encoded = JSON.stringify(event);
            if (Buffer.byteLength(encoded) > 4 * 1024 * 1024) throw new Error('Protocol response exceeds the byte budget.');
            if (!response.write(`data: ${encoded}\n\n`)) await once(response, 'drain', { signal: controller.signal });
          }
        } catch (error) { if (!controller.signal.aborted) response.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: requestId, error: JsonRpcTransportHandler.mapToJSONRPCError(error) })}\n\n`); }
        response.end();
      } else {
        const encoded = JSON.stringify(result);
        if (Buffer.byteLength(encoded) > 4 * 1024 * 1024) throw new Error('Protocol response exceeds the byte budget.');
        response.writeHead(200, { 'Content-Type': 'application/json', 'A2A-Version': '1.0' }); response.end(encoded);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        response.writeHead(200, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ jsonrpc: '2.0', id: requestId, error: JsonRpcTransportHandler.mapToJSONRPCError(error) }));
      }
    } finally { signals.delete(controller); }
  }
  return Object.assign(server, { async shutdown() {
    for (const controller of signals) controller.abort();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  } });
}
