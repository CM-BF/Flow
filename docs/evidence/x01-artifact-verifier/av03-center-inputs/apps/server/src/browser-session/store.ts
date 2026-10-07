import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Pool } from 'pg';
import { BROWSER_SESSION_MAX_ACTIVE, BROWSER_SESSION_MAX_AGE_SECONDS } from '../../../../packages/contracts/src/browser-session.js';
import { HttpError, transaction } from '../database.js';

type IdentityRow = { center_id: string; owner_principal_id: string; auth_epoch_hash: string };
export interface BrowserSessionIdentity { centerId: string; ownerPrincipalId: string }
export async function migrateBrowserSessions(pool: Pool): Promise<void> {
  await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-migrations',0))");
    if ((await client.query('SELECT 1 FROM flow.migrations WHERE version=28')).rowCount) return;
    await client.query(await readFile(new URL('../../../../packages/storage/migrations/028-browser-sessions.sql', import.meta.url), 'utf8'));
    await client.query('INSERT INTO flow.migrations(version) VALUES(28)');
  });
}
const unauthorized = () => new HttpError(401, 'unauthorized', 'Authentication required.');

/** Only trusted startup changes the epoch. Reads never create identity or extend a session. */
export async function openBrowserSessionStore(pool: Pool, epochHash: string) {
  const row = await transaction(pool, async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('flow-browser-identity',0))");
    await client.query('INSERT INTO flow.browser_identity(singleton,center_id,owner_principal_id,auth_epoch_hash) VALUES(1,$1,$2,$3) ON CONFLICT DO NOTHING', [randomUUID(), randomUUID(), epochHash]);
    const current = (await client.query<IdentityRow>('SELECT * FROM flow.browser_identity WHERE singleton=1 FOR UPDATE')).rows[0]!;
    if (current.auth_epoch_hash !== epochHash) {
      await client.query('DELETE FROM flow.browser_sessions');
      await client.query('UPDATE flow.browser_identity SET auth_epoch_hash=$1 WHERE singleton=1', [epochHash]);
    }
    await client.query('DELETE FROM flow.browser_sessions WHERE expires_at<=clock_timestamp()');
    return current;
  });
  const identity = Object.freeze({ centerId: row.center_id, ownerPrincipalId: row.owner_principal_id });
  async function assertCurrent() {
    if (!(await pool.query('SELECT 1 FROM flow.browser_identity WHERE singleton=1 AND auth_epoch_hash=$1', [epochHash])).rowCount) throw unauthorized();
  }
  return {
    identity,
    assertCurrent,
    async read(tokenHash: string, cookieOrigin: string): Promise<{ expiresAt: string } | null> {
      const session = (await pool.query<{ expires_at: Date }>(`SELECT s.expires_at FROM flow.browser_sessions s
        JOIN flow.browser_identity i ON i.singleton=1 AND i.auth_epoch_hash=s.auth_epoch_hash
        WHERE s.token_hash=$1 AND s.cookie_origin=$2 AND s.auth_epoch_hash=$3 AND s.expires_at>clock_timestamp()`, [tokenHash, cookieOrigin, epochHash])).rows[0];
      return session ? { expiresAt: session.expires_at.toISOString() } : null;
    },
    async create(tokenHash: string, cookieOrigin: string): Promise<{ expiresAt: string }> {
      return transaction(pool, async client => {
        const current = (await client.query<IdentityRow>('SELECT * FROM flow.browser_identity WHERE singleton=1 FOR UPDATE')).rows[0];
        if (current?.auth_epoch_hash !== epochHash) throw unauthorized();
        await client.query('DELETE FROM flow.browser_sessions WHERE expires_at<=clock_timestamp()');
        const count = (await client.query<{ count: number }>('SELECT count(*)::int AS count FROM flow.browser_sessions')).rows[0]!.count;
        if (count >= BROWSER_SESSION_MAX_ACTIVE) throw new HttpError(409, 'session_capacity', 'End an existing connection or wait for it to expire.');
        const inserted = (await client.query<{ expires_at: Date }>(`INSERT INTO flow.browser_sessions(token_hash,auth_epoch_hash,cookie_origin,created_at,expires_at)
          SELECT $1,$2,$3,now,now+($4*interval '1 second') FROM (SELECT clock_timestamp() AS now) t RETURNING expires_at`, [tokenHash, epochHash, cookieOrigin, BROWSER_SESSION_MAX_AGE_SECONDS])).rows[0]!;
        return { expiresAt: inserted.expires_at.toISOString() };
      });
    },
    async revoke(tokenHash: string, cookieOrigin: string): Promise<void> {
      await pool.query('DELETE FROM flow.browser_sessions WHERE token_hash=$1 AND cookie_origin=$2 AND auth_epoch_hash=$3', [tokenHash, cookieOrigin, epochHash]);
    },
  };
}
