import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { FastifyCorsOptions } from '@fastify/cors';
import type { Pool } from 'pg';
import { z } from 'zod';
import { BROWSER_SESSION_PROTOCOL, BROWSER_SESSION_MAX_AGE_SECONDS, browserSessionCommandSchema, type BrowserSessionRead, type BrowserSessionReady } from '../../../../packages/contracts/src/browser-session.js';
import { HttpError, sha256 } from '../database.js';
import { openBrowserSessionStore } from './store.js';
export { migrateBrowserSessions } from './store.js';

function origin(value: string): boolean {
  try { const url = new URL(value); return value.length <= 256 && url.origin === value && !url.username && !url.password
    && (url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)); }
  catch { return false; }
}
const settingsSchema = z.strictObject({ cookieOrigin: z.string().refine(origin), trustedOrigins: z.array(z.string().refine(origin)).min(1).max(16),
  authEpoch: z.string().min(1).max(128).regex(/^[\x21-\x7e]+$/) });
export type BrowserSessionOptions = z.infer<typeof settingsSchema>;
const unauthorized = () => new HttpError(401, 'unauthorized', 'Authentication required.');
const forbidden = () => new HttpError(403, 'browser_origin_forbidden', 'This browser origin is not authorized.');
const unsupported = () => new HttpError(503, 'browser_sessions_unsupported', 'Browser sessions are not configured.');
const same = (left: string, right: string) => timingSafeEqual(Buffer.from(sha256(left)), Buffer.from(sha256(right)));
const csrf = (token: string) => sha256('flow.browser-session.csrf.v1\0' + token);
const safeMethod = (request: FastifyRequest) => request.method === 'GET' || request.method === 'HEAD';
function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (header === undefined) return null;
  if (request.raw.rawHeaders.filter((_, i, a) => i % 2 === 0 && a[i]!.toLowerCase() === 'authorization').length > 1
    || !header.startsWith('Bearer ') || !header.slice(7)) throw unauthorized();
  return header.slice(7);
}
function cookieToken(request: FastifyRequest, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  if (Buffer.byteLength(header) > 8192) throw unauthorized();
  const matches = header.split(';').map(part => part.trim()).filter(part => part.slice(0, part.indexOf('=')) === name);
  if (!matches.length) return null;
  if (matches.length !== 1 || !new RegExp(`^${name}=[A-Za-z0-9_-]{43}$`).test(matches[0]!)) throw unauthorized();
  return matches[0]!.slice(name.length + 1);
}

/** Single role/auth authority shared by HTTP preHandler and each SSE read/publish cycle. */
export async function createBrowserSessionAuthentication(pool: Pool, options: { ownerToken: string; browserSession?: BrowserSessionOptions }) {
  if (!options.ownerToken) throw new Error('ownerToken is required.');
  const settings = options.browserSession === undefined ? undefined : settingsSchema.parse(options.browserSession);
  if (settings && new Set(settings.trustedOrigins).size !== settings.trustedOrigins.length) throw new Error('Trusted browser origins must be unique.');
  const store = settings ? await openBrowserSessionStore(pool, sha256(JSON.stringify(['flow.browser-auth-epoch.v1', options.ownerToken, settings.authEpoch]))) : undefined;
  const cookieName = store && settings ? `${settings.cookieOrigin.startsWith('https:') ? '__Host-' : ''}flow-session-${sha256(JSON.stringify([store.identity.centerId, settings.cookieOrigin])).slice(0, 24)}` : '';
  const corsOptions: FastifyCorsOptions | undefined = settings ? { origin: [...settings.trustedOrigins], credentials: true, methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Flow-CSRF', 'X-Flow-Assistant-Stream', 'X-Flow-Execution-Profile', 'Accept', 'Last-Event-ID'] } : undefined;
  function browserOrigin(request: FastifyRequest) {
    if (!settings) throw unsupported();
    const host = request.headers.host;
    let destination = '';
    try { destination = new URL(`${request.protocol}://${host}`).origin; } catch { throw forbidden(); }
    if (destination !== settings.cookieOrigin) throw forbidden();
    const source = request.headers.origin;
    if (typeof source === 'string' && settings.trustedOrigins.includes(source)) return;
    if (source === undefined && safeMethod(request) && request.headers['sec-fetch-site'] === 'same-origin' && settings.trustedOrigins.includes(settings.cookieOrigin)) return;
    throw forbidden();
  }
  async function session(request: FastifyRequest, mutation: boolean): Promise<{ token: string; ready: BrowserSessionReady } | null> {
    if (!settings || !store) throw unsupported();
    browserOrigin(request);
    const token = cookieToken(request, cookieName); if (!token) return null;
    const row = await store.read(sha256(token), settings.cookieOrigin); if (!row) return null;
    if (mutation && (typeof request.headers['x-flow-csrf'] !== 'string' || !same(request.headers['x-flow-csrf'], csrf(token)))) throw new HttpError(403, 'csrf_required', 'A current browser CSRF token is required.');
    return { token, ready: { protocol: BROWSER_SESSION_PROTOCOL, state: 'ready', ...store.identity, expiresAt: row.expiresAt, csrfToken: csrf(token) } };
  }
  async function authenticate(request: FastifyRequest): Promise<void> {
    if (request.routeOptions.url === '/api/health' || request.method === 'OPTIONS') return;
    const runnerRoute = request.routeOptions.url?.startsWith('/api/runner/');
    const token = bearer(request);
    if (token !== null) {
      if (same(token, options.ownerToken)) {
        if (runnerRoute) throw new HttpError(403, 'wrong_role', 'A runner credential is required.');
        await store?.assertCurrent(); return;
      }
      const runner = (await pool.query<{ id: string }>('SELECT id FROM flow.runners WHERE token_hash=$1 AND NOT revoked', [sha256(token)])).rows[0];
      if (!runner) throw unauthorized();
      if (!runnerRoute) throw new HttpError(403, 'wrong_role', 'An owner credential is required.');
      request.runnerId = runner.id; return;
    }
    if (request.routeOptions.url === '/api/browser-session/connect') throw unauthorized();
    const reading = request.routeOptions.url === '/api/browser-session' && request.method === 'GET';
    if (!settings) { if (reading) return; throw unauthorized(); }
    const current = await session(request, !safeMethod(request));
    if (!current) { if (reading) return; throw unauthorized(); }
    if (runnerRoute) throw new HttpError(403, 'wrong_role', 'A runner credential is required.');
  }
  function setCookie(reply: FastifyReply, value: string, expiresAt?: string) {
    const secure = settings!.cookieOrigin.startsWith('https:');
    reply.header('Set-Cookie', `${cookieName}=${value}; Path=/; HttpOnly; SameSite=${secure ? 'None' : 'Strict'}${secure ? '; Secure' : ''}; Max-Age=${expiresAt ? BROWSER_SESSION_MAX_AGE_SECONDS : 0}${expiresAt ? '; Expires=' + new Date(expiresAt).toUTCString() : ''}`);
  }
  return {
    corsOptions, authenticate, authorizeStream: authenticate,
    async readSession(request: FastifyRequest): Promise<BrowserSessionRead> {
      if (!settings) return { protocol: BROWSER_SESSION_PROTOCOL, state: 'unsupported' };
      return (await session(request, false))?.ready ?? { protocol: BROWSER_SESSION_PROTOCOL, state: 'unauthenticated' };
    },
    async connect(request: FastifyRequest, reply: FastifyReply): Promise<BrowserSessionReady> {
      if (!settings || !store) throw unsupported();
      const owner = bearer(request); if (owner === null || !same(owner, options.ownerToken)) throw unauthorized();
      browserOrigin(request);
      const token = randomBytes(32).toString('base64url'), row = await store.create(sha256(token), settings.cookieOrigin);
      setCookie(reply, token, row.expiresAt);
      return { protocol: BROWSER_SESSION_PROTOCOL, state: 'ready', ...store.identity, expiresAt: row.expiresAt, csrfToken: csrf(token) };
    },
    async logout(request: FastifyRequest, _reply: FastifyReply): Promise<BrowserSessionRead> {
      if (!settings || !store) throw unsupported();
      const current = await session(request, true); if (!current) throw unauthorized();
      await store.revoke(sha256(current.token), settings.cookieOrigin);
      // A delayed response must not erase a newer connection's cookie. The revoked token is inert.
      return { protocol: BROWSER_SESSION_PROTOCOL, state: 'unauthenticated' };
    },
  };
}
export type BrowserSessionAuthentication = Awaited<ReturnType<typeof createBrowserSessionAuthentication>>;
export function registerBrowserSessionRoutes(app: FastifyInstance, authentication: BrowserSessionAuthentication): void {
  const empty = (value: unknown) => { if (!browserSessionCommandSchema.safeParse(value).success) throw new HttpError(400, 'invalid_request', 'This command expects an empty object.'); };
  app.get('/api/browser-session', async (request, reply) => { reply.header('Cache-Control', 'no-store'); return authentication.readSession(request); });
  app.post('/api/browser-session/connect', async (request, reply) => { empty(request.body); reply.header('Cache-Control', 'no-store'); return authentication.connect(request, reply); });
  app.post('/api/browser-session/logout', async (request, reply) => { empty(request.body); reply.header('Cache-Control', 'no-store'); return authentication.logout(request, reply); });
}
