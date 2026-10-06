import Fastify from 'fastify';
import type { Pool } from 'pg';
import { afterEach, expect, it } from 'vitest';
import { HttpError } from '../database.js';
import { registerContextHistoryRoutes } from './routes.js';
import { contextHistoryResponseSchema } from '../../../../packages/contracts/src/context-observation-history.js';

const applications: ReturnType<typeof Fastify>[] = [];
afterEach(async () => { await Promise.all(applications.splice(0).map(app => app.close())); });
async function fixture() {
  const calls: string[] = []; let released = 0;
  const client = { async query(sql: string, values: unknown[] = []) {
    calls.push(sql);
    if (sql.includes('FROM flow.tasks')) return { rows: values[0] === 'known-task' ? [{ id: 'known-task', current_attempt_id: null }] : [] };
    return { rows: [] };
  }, release() { released++; } };
  const pool = { async connect() { return client; } } as unknown as Pool;
  const app = Fastify(); applications.push(app);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) return reply.code(error.status).send({ error: { code: error.code } });
    return reply.code(500).send({ error: { code: 'internal_error' } });
  });
  // The real global owner auth remains in createServer; this local hook tests registration inheritance only.
  app.addHook('preHandler', async request => {
    if (request.headers.authorization !== 'Bearer fixture-owner') throw new HttpError(401, 'unauthorized', 'Fixture owner required.');
  });
  registerContextHistoryRoutes(app, pool);
  return { app, calls, released: () => released };
}
it('serves the public history DTO with no-store and a read-only transaction', async () => {
  const { app, calls, released } = await fixture();
  const result = await app.inject({ method: 'GET', url: '/api/tasks/known-task/context/history', headers: { authorization: 'Bearer fixture-owner' } });
  expect(result.statusCode).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
  expect(contextHistoryResponseSchema.parse(result.json())).toMatchObject({ taskId: 'known-task', attemptId: null, latest: null, current: { kind: 'unknown' }, remaining: { kind: 'unknown' } });
  expect(calls[0]).toBe('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); expect(calls.at(-1)).toBe('COMMIT'); expect(released()).toBe(1);
});
it('inherits host authentication before reading a task', async () => {
  const { app, calls } = await fixture();
  expect((await app.inject('/api/tasks/known-task/context/history')).statusCode).toBe(401); expect(calls).toEqual([]);
});
it('returns missing task 404 and releases its rolled-back read transaction', async () => {
  const { app, calls, released } = await fixture();
  const result = await app.inject({ url: '/api/tasks/missing/context/history', headers: { authorization: 'Bearer fixture-owner' } });
  expect(result.statusCode).toBe(404); expect(calls.at(-1)).toBe('ROLLBACK'); expect(released()).toBe(1);
});
it.each(['attemptId=foreign', 'expected=current', 'after=1'])('rejects caller supplied identity or cursor %s', query => {
  return fixture().then(async ({ app, calls }) => {
    const result = await app.inject({ url: `/api/tasks/known-task/context/history?${query}`, headers: { authorization: 'Bearer fixture-owner' } });
    expect(result.statusCode).toBe(400); expect(calls).toEqual([]);
  });
});
