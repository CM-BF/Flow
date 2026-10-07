import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { transaction } from './database.js';

/** Run after existing migrations 1..24. A forward-only change preserves all prior final/profile rows. */
export async function migrateNativeHarnessSources(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=25')).rowCount) return;
    await client.query(await readFile(new URL('../../../packages/storage/migrations/025-native-harness-sources.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(25)');
  });
}
