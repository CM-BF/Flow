import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { migrate } from '../database.js';
import { migrateNativeActivities } from './index.js';
import { nativeActivities } from './store.js';

it('first-upgrades a persisted legacy schema before version20 and preserves task/attempt/detail bytes', async () => {
  const database = `flow_chat05_upgrade_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const pool = new Pool({ connectionString: `postgresql://flow:flow-local-only@127.0.0.1:55432/${database}`, max: 1 });
  let created = false;
  try {
    await admin.query(`CREATE DATABASE ${database}`);
    created = true;
    // No createServer/beforeAll here: only the actual legacy migrations 1/2 run first.
    await migrate(pool);
    const taskId = randomUUID(), runnerId = randomUUID(), attemptId = randomUUID(), detailId = randomUUID();
    await pool.query('INSERT INTO flow.tasks(id,submission,status,current_attempt_id,owner_version) VALUES($1,$2,$3,$4,1)',
      [taskId, { title: 'Persisted legacy task', prompt: 'Legacy 中文 🌱', harness: 'fixture' }, 'succeeded', attemptId]);
    await pool.query('INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity) VALUES($1,$2,$3,$4,1)',
      [runnerId, 'Synthetic legacy runner', randomUUID(), ['fixture']]);
    await pool.query('INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,completed_at) VALUES($1,$2,$3,1,clock_timestamp(),clock_timestamp())', [attemptId, taskId, runnerId]);
    await pool.query('INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [detailId, taskId, attemptId, 'Legacy evidence', 'detail', '原始内容\nwith exact bytes 🌱', 'text/plain']);
    const persisted = async () => (await pool.query(`SELECT row_to_json(t)::text AS task, row_to_json(a)::text AS attempt, row_to_json(d)::text AS detail
      FROM flow.tasks t JOIN flow.attempts a ON a.task_id=t.id JOIN flow.details d ON d.attempt_id=a.id WHERE t.id=$1`, [taskId])).rows;
    const before = await persisted();
    expect(before).toHaveLength(1);
    expect((await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows).toEqual([{ version: 1 }, { version: 2 }]);
    expect((await pool.query("SELECT to_regclass('flow.native_activities') AS table_name")).rows[0].table_name).toBeNull();

    await migrateNativeActivities(pool);
    expect(await persisted()).toEqual(before);
    expect(await nativeActivities(pool, taskId, 20)).toEqual({ activities: [], nextCursor: null });
    expect((await pool.query('SELECT version FROM flow.migrations ORDER BY version')).rows).toEqual([{ version: 1 }, { version: 2 }, { version: 20 }]);
    await migrateNativeActivities(pool);
    expect(await persisted()).toEqual(before);
    expect((await pool.query('SELECT count(*)::int AS total FROM flow.migrations WHERE version=20')).rows[0].total).toBe(1);
  } finally {
    await pool.end();
    try { if (created) await admin.query(`DROP DATABASE ${database}`); }
    finally { await admin.end(); }
  }
});
