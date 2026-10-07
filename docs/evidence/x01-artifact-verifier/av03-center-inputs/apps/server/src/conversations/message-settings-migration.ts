import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { transaction } from '../database.js';

/** Mounted by the server owner after queue migration, before routes/workers accept messages. */
export async function migrateClaudeMessageSettings(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=32')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/032-claude-message-settings.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(32)');
  });
}
