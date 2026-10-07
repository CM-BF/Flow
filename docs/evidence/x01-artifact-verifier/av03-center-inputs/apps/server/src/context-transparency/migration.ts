import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { transaction } from '../database.js';

/** Requires the existing tasks/attempts/details schema; independent of attachment migration 026. */
export async function migrateContextObservationHistory(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=27')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/027-context-observation-history.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(27)');
  });
}
