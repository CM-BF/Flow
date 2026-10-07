import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { readFile } from 'node:fs/promises';
import { idSchema, WORKSPACE_ID } from '@flow/contracts';
import { projectCreationSchema, projectCommandSchema } from '../../../../packages/contracts/src/projects.js';
import { HttpError, transaction } from '../database.js';
import { integerQuery } from '../queries.js';
import { createProject, changeProject } from './commands.js';
import { projectSnapshot, workspaceList, projectList } from './storage.js';

export async function migrateProjects(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=4')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/004-projects.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(4)');
  });
}
export function registerProjectRoutes(app: FastifyInstance, pool: Pool): void {
  app.get('/api/workspaces', () => workspaceList(pool));
  app.get<{ Querystring: { workspaceId?: string; after?: string; limit?: string } }>('/api/projects', request => {
    const { workspaceId = WORKSPACE_ID, after, limit } = request.query;
    if (after !== undefined && !idSchema.safeParse(after).success) throw new HttpError(400, 'invalid_cursor', 'Invalid project cursor.');
    return projectList(pool, workspaceId, integerQuery(limit, 40, 100, 1), after);
  });
  app.post('/api/projects', async (request, reply) => {
    const input = projectCreationSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_project', 'A personal workspace and project title are required.');
    return reply.code(201).send(await createProject(pool, input.data, String(request.headers['idempotency-key'] ?? '')));
  });
  app.post<{ Params: { id: string } }>('/api/projects/:id/commands', request => {
    const input = projectCommandSchema.safeParse(request.body);
    if (!input.success) throw new HttpError(400, 'invalid_project_command', 'A versioned project command and reason are required.');
    return changeProject(pool, request.params.id, input.data, String(request.headers['idempotency-key'] ?? ''));
  });
  app.get<{ Params: { id: string }; Querystring: { revision?: string } }>('/api/projects/:id', request =>
    projectSnapshot(pool, request.params.id, request.query.revision === undefined ? undefined : integerQuery(request.query.revision, 1, 2_147_483_647, 1)));
}
