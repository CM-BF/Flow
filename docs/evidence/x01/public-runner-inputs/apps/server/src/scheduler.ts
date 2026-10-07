import { PgBoss } from 'pg-boss';
import type { Pool } from 'pg';

export async function startScheduler(databaseUrl: string, pool: Pool): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: databaseUrl, max: 3, connectionTimeoutMillis: 5000 });
  boss.on('error', error => { console.error('Scheduler error:', error.message); });
  try {
    await boss.start({ attempts: 3 });
    await boss.createQueue('flow-wake', { retryLimit: 5, retryDelay: 1, retryBackoff: true, expireInSeconds: 30 });
    await boss.work<{ taskId: string }>('flow-wake', { batchSize: 1, pollingIntervalSeconds: 0.5 }, async jobs => {
      for (const job of jobs) await pool.query("UPDATE flow.tasks SET dispatch_ready=true WHERE id=$1 AND status='queued'", [job.data.taskId]);
    });
    await pool.query("UPDATE flow.tasks SET dispatch_ready=true WHERE status='queued'");
    return boss;
  } catch (error) { await boss.stop().catch(() => undefined); throw error; }
}
