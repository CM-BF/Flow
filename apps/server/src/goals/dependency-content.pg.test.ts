import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { PoolClient, QueryResult } from 'pg';
import type { GoalArtifactBinding } from '../../../../packages/contracts/src/goals.js';
import { DependencyDatabaseFixture } from '../../../../docs/evidence/gdep01-dependency-batch/pg-fixture.js';
import { HttpError, migrate, sha256, transaction } from '../database.js';
import { migrateProjects } from '../projects/index.js';
import { loadProject } from '../projects/storage.js';
import { dependencyContent } from './dependency-content.js';

let fixture: DependencyDatabaseFixture;
beforeAll(async () => {
  fixture = await DependencyDatabaseFixture.prepare();
  await fixture.create();
  await fixture.work('migrate', async () => { await migrate(fixture.pool); await migrateProjects(fixture.pool); });
});
afterAll(async () => { if (fixture) await fixture.finish(); });

/** Controlled relational fixture, not evidence of public runner artifact writes. */
async function seed(contents: string[]): Promise<GoalArtifactBinding[]> {
  return transaction(fixture.pool, async client => {
    const taskId = randomUUID(), attemptId = randomUUID(), runnerId = randomUUID();
    await client.query("INSERT INTO flow.tasks(id,submission) VALUES($1,'{}')", [taskId]);
    await client.query("INSERT INTO flow.runners(id,name,token_hash,harnesses,capacity) VALUES($1,'gdep',$1,ARRAY['fixture'],1)", [runnerId]);
    await client.query('INSERT INTO flow.attempts(id,task_id,runner_id,owner_version,lease_expires_at,completed_at) VALUES($1,$2,$3,1,now(),now())', [attemptId, taskId, runnerId]);
    const records = contents.map(content => ({ id: randomUUID(), artifact: randomUUID(), content, version: sha256(content) }));
    await client.query(`INSERT INTO flow.details(id,task_id,attempt_id,title,kind,content,media_type,artifact_version)
      SELECT x.id,$1,$2,'fixture','artifact',x.content,'text/plain',x.version FROM jsonb_to_recordset($3::jsonb) AS x(id text,content text,version text)`, [taskId, attemptId, JSON.stringify(records)]);
    await client.query(`INSERT INTO flow.artifacts(task_id,artifact_id,version,attempt_id,detail_id)
      SELECT $1,x.artifact,x.version,$2,x.id FROM jsonb_to_recordset($3::jsonb) AS x(id text,artifact text,version text)`, [taskId, attemptId, JSON.stringify(records.map(({ content: _content, ...record }) => record))]);
    return records.map(record => ({ nodeId: randomUUID(), executionId: randomUUID(), taskId, artifactId: record.artifact, artifactVersion: record.version, detailId: record.id }));
  });
}

// Independent old implementation oracle from fixed base69a71e3 commands.ts.
async function sequential(client: PoolClient, bindings: GoalArtifactBinding[]) {
  let size = 0; const context = [];
  for (const binding of bindings) {
    const row = (await client.query<{ content: string }>(`SELECT d.content FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id
      WHERE a.task_id=$1 AND a.artifact_id=$2 AND a.version=$3 AND a.detail_id=$4`, [binding.taskId, binding.artifactId, binding.artifactVersion, binding.detailId])).rows[0];
    if (!row || sha256(row.content) !== binding.artifactVersion) throw new HttpError(409, 'dependency_artifact', 'The exact dependency artifact is unavailable.');
    size += row.content.length;
    if (size > 16_000) throw new HttpError(409, 'input_too_large', 'Dependency content exceeds the bounded execution context.');
    context.push({ ...binding, content: row.content });
  }
  return context;
}
function observe(client: PoolClient) {
  const calls: { text: string; values: unknown[]; bodyBytes: number; rows: number }[] = [];
  const proxy = new Proxy(client, { get(target, key) {
    if (key === 'query') return async (text: string, values: unknown[]) => {
      const result: QueryResult<{ content: string | null }> = await target.query(text, values);
      calls.push({ text, values, bodyBytes: result.rows.reduce((n, row) => n + (row.content === null ? 0 : Buffer.byteLength(row.content)), 0), rows: result.rows.length });
      return result;
    };
    const value: unknown = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
  } });
  return { client: proxy, calls };
}
async function failureCode(action: () => Promise<unknown>) {
  try { await action(); throw new Error('Expected domain rejection'); }
  catch (error) { if (!(error instanceof HttpError)) throw error; return { code: error.code, status: error.status, message: error.message }; }
}

it('reads 199 ordered short dependencies once and records the actual SQL plan', async () => fixture.work('short-199', async () => {
  const bodies = Array.from({ length: 199 }, (_, i) => `正文${i}:e\u0301🙂\\\r\n`);
  const bindings = await seed(bodies);
  await transaction(fixture.pool, async client => {
    const observed = observe(client), result = await dependencyContent(observed.client, bindings);
    expect(result).toEqual(await sequential(client, bindings));
    expect(result.map(row => row.content)).toEqual(bodies); expect(observed.calls).toHaveLength(1);
    expect(observed.calls[0]!.bodyBytes).toBe(bodies.reduce((n, body) => n + Buffer.byteLength(body), 0));
    const call = observed.calls[0]!;
    const plan = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON, TIMING OFF) ${call.text}`, call.values);
    await fixture.evidence('short-199-plan', { queries: 1, rows: call.rows, decodedContentUtf8Bytes: call.bodyBytes, plan: plan.rows });
  }, true);
}));

it('keeps zero-query empty input and exact duplicate ordinals', async () => fixture.work('empty-duplicates', async () => {
  const [binding] = await seed(['']);
  await transaction(fixture.pool, async client => {
    const observed = observe(client); expect(await dependencyContent(observed.client, [])).toEqual([]); expect(observed.calls).toHaveLength(0);
    const duplicate = [binding!, binding!]; expect(await dependencyContent(observed.client, duplicate)).toEqual(await sequential(client, duplicate));
    expect(observed.calls).toHaveLength(1); expect(observed.calls[0]!.rows).toBe(2);
  }, true);
}));

it('includes the 48000-byte boundary and its complete crossing row', async () => fixture.work('byte-boundary', async () => {
  const bindings = await seed(['中'.repeat(16000), '', 'a', 'later']);
  await transaction(fixture.pool, async client => {
    expect((await dependencyContent(client, bindings.slice(0, 2))).map(row => row.content.length)).toEqual([16000, 0]);
    const observed = observe(client);
    expect(await failureCode(() => dependencyContent(observed.client, bindings))).toEqual(await failureCode(() => sequential(client, bindings)));
    expect(observed.calls[0]).toMatchObject({ rows: 3, bodyBytes: 48001 });
    await fixture.evidence('byte-boundary-result', { rows: observed.calls[0]!.rows, decodedContentUtf8Bytes: observed.calls[0]!.bodyBytes });
  }, true);
}));

it('bounds returned legal content by 48000 plus one complete 1MiB artifact', async () => fixture.work('crossing-large', async () => {
  const bindings = await seed(['中'.repeat(16000), 'x'.repeat(1048576), 'tail']);
  await transaction(fixture.pool, async client => {
    const observed = observe(client);
    expect(await failureCode(() => dependencyContent(observed.client, bindings))).toMatchObject({ code: 'input_too_large' });
    expect(observed.calls[0]).toMatchObject({ rows: 2, bodyBytes: 48000 + 1048576 });
    await fixture.evidence('large-boundary-result', { rows: 2, decodedContentUtf8Bytes: observed.calls[0]!.bodyBytes });
  }, true);
}));

it('preserves UTF16 sizing without normalizing Unicode or line endings', async () => fixture.work('unicode', async () => {
  const contents = ['🙂'.repeat(7995), 'e\u0301é\\\r\n']; const bindings = await seed(contents);
  await transaction(fixture.pool, async client => {
    expect(await dependencyContent(client, bindings)).toEqual(await sequential(client, bindings));
    expect((await dependencyContent(client, bindings)).map(row => row.content)).toEqual(contents);
  }, true);
}));

it('requires each of the four binding identities', async () => fixture.work('four-keys', async () => {
  const [binding] = await seed(['bound']);
  await transaction(fixture.pool, async client => {
    for (const key of ['taskId', 'artifactId', 'artifactVersion', 'detailId'] as const) {
      const altered = { ...binding!, [key]: key === 'artifactVersion' ? '0'.repeat(64) : randomUUID() };
      expect(await failureCode(() => dependencyContent(client, [altered]))).toEqual(await failureCode(() => sequential(client, [altered])));
    }
  }, true);
}));

it('preserves missing hash and length first-error order', async () => fixture.work('first-error', async () => {
  const [large, bad, valid] = await seed(['x'.repeat(16001), 'untampered', 'ok']);
  await fixture.pool.query('UPDATE flow.details SET content=$2 WHERE id=$1', [bad!.detailId, 'corrupt']);
  const missing = { ...valid!, detailId: randomUUID() };
  await transaction(fixture.pool, async client => {
    for (const refs of [[large!, missing], [missing, large!], [bad!, large!], [large!, bad!]]) {
      expect(await failureCode(() => dependencyContent(client, refs))).toEqual(await failureCode(() => sequential(client, refs)));
    }
    await client.query('SELECT 1');
  }, true);
}));

it('rolls back caller writes and retains the existing project lock boundary', async () => fixture.work('transaction-lock', async () => {
  const [binding] = await seed(['ok']); const projectId = randomUUID(), marker = randomUUID();
  await transaction(fixture.pool, async client => {
    await client.query("INSERT INTO flow.projects(id,workspace_id,title,revision) VALUES($1,'personal','gdep',1)", [projectId]);
    await client.query("INSERT INTO flow.project_revisions(project_id,revision,reason,actor,nodes) VALUES($1,1,'fixture','owner','[]')", [projectId]);
  });
  const missing = { ...binding!, detailId: randomUUID() };
  expect(await failureCode(() => transaction(fixture.pool, async client => {
    await loadProject(client, projectId, true);
    await client.query("INSERT INTO flow.tasks(id,submission) VALUES($1,'{}')", [marker]);
    return dependencyContent(client, [missing]);
  }))).toMatchObject({ code: 'dependency_artifact' });
  expect((await fixture.pool.query('SELECT id FROM flow.tasks WHERE id=$1', [marker])).rowCount).toBe(0);
  await transaction(fixture.pool, async locked => {
    await loadProject(locked, projectId, true);
    expect(await dependencyContent(locked, [binding!])).toEqual([{ ...binding!, content: 'ok' }]);
    await expect(transaction(fixture.pool, async contender => {
      await contender.query("SET LOCAL lock_timeout='100ms'"); await loadProject(contender, projectId, true);
    })).rejects.toMatchObject({ code: '55P03' });
  });
  await transaction(fixture.pool, client => loadProject(client, projectId, true));
  await fixture.sampleDatabase('work-completed');
}));
