import Fastify, { type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { createServer as reserveServer } from 'node:net';
import type { Pool } from 'pg';
import { HttpError } from '../database.js';
import { eventPage } from '../queries.js';
import { registerStreams } from '../streams.js';
import { createBrowserSessionAuthentication, registerBrowserSessionRoutes } from './index.js';

async function availablePort(): Promise<number> {
  const server = reserveServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (!address || typeof address === 'string') throw new Error('Owned fixture has no port.');
  return address.port;
}
/** Explicit test composition, not the production createServer mount. Never accepts a personal service address. */
export async function createBrowserSessionFixture(pool: Pool, options: {
  ownerToken: string; port?: number; enabled?: boolean; authEpoch?: string;
  cookieOrigin?: string; browserOrigin?: string; onClosing?: () => void; beforeStreamAuthorize?: (count: number, request: FastifyRequest) => Promise<void>;
  beforeLogoutResponse?: () => Promise<void>;
}) {
  const port = options.port ?? await availablePort(), address = `http://127.0.0.1:${port}`;
  const browserOrigin = options.browserOrigin ?? address;
  const authentication = await createBrowserSessionAuthentication(pool, { ownerToken: options.ownerToken,
    ...(options.enabled === false ? {} : { browserSession: { cookieOrigin: options.cookieOrigin ?? address, trustedOrigins: [...new Set([address, browserOrigin])], authEpoch: options.authEpoch ?? 'fixture-epoch-1' } }) });
  const app = Fastify({ logger: false }); let writes = 0, streamChecks = 0;
  app.decorateRequest('runnerId', null);
  app.setErrorHandler((error, _request, reply) => reply.code(error instanceof HttpError ? error.status : 500).send({ error: { code: error instanceof HttpError ? error.code : 'internal_error' } }));
  if (authentication.corsOptions) await app.register(cors, authentication.corsOptions);
  app.addHook('preHandler', authentication.authenticate);
  registerBrowserSessionRoutes(app, authentication);
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.routeOptions.url === '/api/browser-session/logout' && reply.statusCode === 200) await options.beforeLogoutResponse?.();
    return payload;
  });
  registerStreams(app, pool, async request => { streamChecks++; await options.beforeStreamAuthorize?.(streamChecks, request); await authentication.authorizeStream(request); });
  app.addHook('preClose', async () => { options.onClosing?.(); });
  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/protected', async () => ({ owner: true }));
  app.post('/api/protected', async () => ({ writes: ++writes }));
  app.get('/api/runner/protected', async request => ({ runnerId: request.runnerId }));
  app.get<{ Params: { id: string } }>('/api/tasks/:id', async request => eventPage(pool, request.params.id, 0));
  try { await app.listen({ host: '127.0.0.1', port }); }
  catch (error) { await app.close(); throw error; }
  return { app, address, port, browserOrigin, authentication, writes: () => writes, streamChecks: () => streamChecks,
    close: () => app.close() };
}
