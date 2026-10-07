import type { FastifyInstance } from 'fastify';

/** Bound HTTP draining only; closing a connection does not cancel a database transaction. */
export function registerShutdown(app: FastifyInstance, graceMs = 1000): void {
  if (!Number.isSafeInteger(graceMs) || graceMs < 1 || graceMs > 10_000) throw new Error('Invalid shutdown grace period.');
  let timer: NodeJS.Timeout | undefined;
  let closing = false;
  const clearDeadline = () => { clearTimeout(timer); timer = undefined; };
  app.server.once('close', clearDeadline);
  app.addHook('onSend', async (_request, reply, payload) => {
    if (closing) reply.header('Connection', 'close');
    return payload;
  });
  app.addHook('preClose', async () => {
    closing = true;
    if (!app.server.listening) return;
    // Fastify has marked routes closing. Stop TCP admission before other preClose hooks drain SSE.
    // Fastify later calls close again; Node permits this and Fastify accepts ERR_SERVER_NOT_RUNNING.
    app.server.close(() => undefined);
    timer = setTimeout(() => {
      process.stderr.write('Center shutdown: HTTP drain deadline reached; remaining connections closed, unacknowledged outcomes unknown.\n');
      app.server.closeAllConnections();
    }, graceMs);
    timer.unref();
  });
  app.addHook('onClose', async () => { clearDeadline(); });
}
