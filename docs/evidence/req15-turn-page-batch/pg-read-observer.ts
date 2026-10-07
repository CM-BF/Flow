import type { EventEmitter } from 'node:events';
import type { PoolClient, QueryResult } from 'pg';

interface Measurement {
  label: string; queryCalls: number; readyForQuery: number; dataRows: number; fieldUtf8Bytes: number;
  typedPrefixUtf8Bytes: number; legacyContentUtf8Bytes: number; otherFieldUtf8Bytes: number;
  taskProjectionIds: string[]; turnLimits: number[]; sqlControl: string[]; invalid: string | null;
  pageJsonUtf8Bytes: number | null; wallMilliseconds: number; completed: boolean;
}

/** Version-pinned observational seam. It delegates every SQL operation and never replaces rows. */
export function readObserver() {
  let active: Measurement | undefined;
  let barrier: (() => Promise<void>) | undefined;
  const measurements: Measurement[] = [], detach: (() => void)[] = [];
  let connected = 0;
  function attach(client: PoolClient) {
    connected++;
    const connection = (client as unknown as { connection: EventEmitter }).connection;
    let names: string[] = [];
    const description = (message: { fields: { name: string; format: string }[] }) => {
      names = message.fields.map(field => field.name);
      if (active && message.fields.some(field => field.format !== 'text')) active.invalid = 'Non-text result format';
    };
    const data = (message: { fields: (string | null)[] }) => {
      if (!active) return;
      active.dataRows++;
      if (message.fields.length !== names.length) active.invalid = 'Field description does not match row';
      for (const [index, field] of message.fields.entries()) {
        if (field !== null && typeof field !== 'string') { active.invalid = 'Non-text field'; continue; }
        const bytes = field === null ? 0 : Buffer.byteLength(field, 'utf8');
        active.fieldUtf8Bytes += bytes;
        if (names[index] === 'prefix') active.typedPrefixUtf8Bytes += bytes;
        else if (names[index] === 'content') active.legacyContentUtf8Bytes += bytes;
        else active.otherFieldUtf8Bytes += bytes;
      }
    };
    const ready = () => { if (active) active.readyForQuery++; };
    connection.on('rowDescription', description); connection.on('dataRow', data); connection.on('readyForQuery', ready);
    const original = client.query;
    const query = original.bind(client) as (sql: string, values?: unknown[]) => Promise<QueryResult>;
    const observedQuery = async (sql: string, values?: unknown[]) => {
      // This dedicated fixture only uses Promise-returning text queries, in serial order.
      if (typeof sql !== 'string' || (values !== undefined && !Array.isArray(values))) throw new Error('Unsupported observer query shape');
      if (active) {
        active.queryCalls++;
        if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) active.sqlControl.push(sql);
        if (sql === 'SELECT * FROM flow.tasks WHERE id=ANY($1::text[])') active.taskProjectionIds.push(...values![0] as string[]);
        if (sql.startsWith('SELECT * FROM flow.conversation_turns WHERE')) active.turnLimits.push(Number(values![2]));
      }
      const result = await query(sql, values);
      if (sql === 'SELECT * FROM flow.tasks WHERE id=ANY($1::text[])' && barrier) {
        const once = barrier; barrier = undefined;
        await once(); // The real task rows already resolved; writer COMMIT ACK precedes later reads.
      }
      return result;
    };
    const wrapper = observedQuery as typeof client.query;
    client.query = wrapper;
    detach.push(() => {
      connection.removeListener('rowDescription', description); connection.removeListener('dataRow', data); connection.removeListener('readyForQuery', ready);
      if (client.query === wrapper) client.query = original;
    });
  }
  async function measure<T>(label: string, run: () => Promise<T>): Promise<{ value: T; metric: Measurement }> {
    if (active) throw new Error('Overlapping subject measurements are not allowed');
    const metric: Measurement = { label, queryCalls: 0, readyForQuery: 0, dataRows: 0, fieldUtf8Bytes: 0,
      typedPrefixUtf8Bytes: 0, legacyContentUtf8Bytes: 0, otherFieldUtf8Bytes: 0, taskProjectionIds: [], turnLimits: [],
      sqlControl: [], invalid: null, pageJsonUtf8Bytes: null, wallMilliseconds: 0, completed: false };
    active = metric; const start = performance.now();
    try {
      const value = await run();
      metric.pageJsonUtf8Bytes = Buffer.byteLength(JSON.stringify(value), 'utf8'); metric.completed = true;
      if (metric.queryCalls !== metric.readyForQuery) metric.invalid = 'Query/ReadyForQuery counts differ';
      if (metric.invalid) throw new Error(`Measurement unavailable: ${metric.invalid}`);
      return { value, metric };
    } finally { metric.wallMilliseconds = performance.now() - start; measurements.push(metric); active = undefined; }
  }
  return { attach, measure, measurements, get connected() { return connected; },
    setBarrier(value?: () => Promise<void>) { barrier = value; },
    detach() { for (const remove of detach) remove(); },
  };
}
