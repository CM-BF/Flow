import { Client } from 'pg';

export interface QueryCounts {
  total: number;
  readOnlyTransactionStarts: number;
  timelineReads: number;
  select: number;
  begin: number;
  commit: number;
  other: number;
}

function emptyCounts(): QueryCounts {
  return { total: 0, readOnlyTransactionStarts: 0, timelineReads: 0, select: 0, begin: 0, commit: 0, other: 0 };
}

/** Counts submitted statements, not database execution time or pool waits. */
export function instrumentQueries(database: string) {
  const original = Client.prototype.query;
  let active = false;
  let counts = emptyCounts();
  Client.prototype.query = function (this: Client, ...args: unknown[]) {
    const connection = Reflect.get(this, 'connectionParameters') as { database?: string };
    if (active && connection.database === database) {
      const input = args[0];
      const sql = (typeof input === 'string' ? input : (input as { text?: string })?.text ?? '').trim();
      counts.total++;
      const verb = sql.split(/\s/, 1)[0]?.toLowerCase();
      if (verb === 'select' || verb === 'begin' || verb === 'commit') counts[verb]++;
      else counts.other++;
      if (sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY') counts.readOnlyTransactionStarts++;
      if (sql.startsWith('SELECT entry FROM flow.timeline WHERE task_id=$1 AND cursor>$2')) counts.timelineReads++;
    }
    // Preserve pg callback, promise and Query overload behavior unchanged.
    return Reflect.apply(original, this, args);
  } as typeof original;
  return {
    start() { counts = emptyCounts(); active = true; },
    stop() { active = false; return { ...counts }; },
    restore() { active = false; Client.prototype.query = original; },
  };
}

export function distribution(samples: number[]) {
  if (!samples.length) throw new Error('Cannot summarize empty measurements.');
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.ceil(p * sorted.length) - 1]!;
  return { n: samples.length, min: sorted[0]!, p50: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1)! };
}
