import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { TimelineEntry } from '@flow/contracts';
import type { TaskRecord } from './tasks.js';

export async function appendTimeline(client: PoolClient, task: TaskRecord, value: { kind: 'text'; text: string } | { kind: 'reference'; reference: { id: string; title: string } }): Promise<void> {
  task.cursor += 1;
  const entry: TimelineEntry = { id: randomUUID(), cursor: task.cursor, createdAt: new Date().toISOString(), ...value };
  await client.query('INSERT INTO flow.timeline(task_id,cursor,entry) VALUES($1,$2,$3)', [task.id, task.cursor, JSON.stringify(entry)]);
}
