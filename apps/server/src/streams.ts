import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { eventPage, integerQuery } from './queries.js';

export function registerStreams(app: FastifyInstance, pool: Pool): void {
  const observers = new Set<() => void>();
  const queries = new Set<Promise<void>>();
  app.addHook('preClose', async () => {
    for (const close of observers) close();
    await Promise.all(queries);
  });
  app.get<{ Params: { id: string }; Querystring: { after?: string } }>('/api/tasks/:id/stream', async (request, reply) => {
    let cursor = integerQuery(request.query.after, 0, Number.MAX_SAFE_INTEGER);
    // 32 maximum-size escaped text entries stay below the client's frame bound.
    let page = await eventPage(pool, request.params.id, cursor, 32);
    let stopped = false;
    let busy = false;
    let lastSent = '';
    let lastWrite = Date.now();
    let timer: NodeJS.Timeout;
    const close = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      observers.delete(close);
      reply.raw.end();
    };
    const send = () => {
      const serialized = JSON.stringify(page);
      if (serialized !== lastSent) {
        lastSent = serialized;
        cursor = page.nextCursor;
        lastWrite = Date.now();
        if (!reply.raw.write(`event: update\ndata: ${serialized}\n\n`)) close();
      } else if (Date.now() - lastWrite >= 10_000) {
        lastWrite = Date.now();
        if (!reply.raw.write(': keepalive\n\n')) close();
      }
    };
    reply.hijack();
    for (const [name, value] of Object.entries(reply.getHeaders())) if (value !== undefined) reply.raw.setHeader(name, value);
    reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    reply.raw.on('close', close);
    observers.add(close);
    send();
    timer = setInterval(() => {
      if (stopped || busy) return;
      busy = true;
      const query = eventPage(pool, request.params.id, cursor, 32).then(next => {
        page = next;
        if (!stopped) send();
      }).catch(() => close()).finally(() => { busy = false; queries.delete(query); });
      queries.add(query);
    }, 250);
    timer.unref();
    if (stopped) clearInterval(timer);
  });
}
