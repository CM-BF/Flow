import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { transaction } from '../database.js';
export type { PackageFetchHost } from './host.js';
export async function migratePackageFetches(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=23')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/023-plugin-package-fetches.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(23)');
  });
}
export { registerPackageFetchRoutes } from './routes.js';

export { startPackageFetchWorker, type PackageFetchWorker } from './worker.js';
