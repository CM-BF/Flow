import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { transaction } from '../database.js';

/** The production and dedicated-test entry consume the same officially assigned SQL. */
export async function migratePluginInstallations(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=29')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/029-plugin-material-installs.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(29)');
  });
}
