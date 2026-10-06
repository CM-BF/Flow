import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect } from 'vitest';
import { FlowClient } from '../../../../packages/client/src/index.js';
import { createServer } from '../index.js';

/** One randomly named database and dynamic HTTP port per test module. No shared services. */
export function publicGoalFixture(label: string) {
  const name = `flow_o12_${randomUUID().replaceAll('-', '')}`;
  const url = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const token = 'o12-private-owner';
  let app: Awaited<ReturnType<typeof createServer>>;
  let address = ''; let created = false;
  const requests: { path: string; method: string; status: number; bytes: number; materials: boolean }[] = [];
  async function start() { app = await createServer({ databaseUrl: url, ownerToken: token, leaseMs: 2000 });
    app.addHook('onSend', async (request, reply, payload) => { if (typeof payload === 'string') requests.push({ path: request.url, method: request.method, status: reply.statusCode, bytes: Buffer.byteLength(payload), materials: payload.includes('PRIVATE_MATERIAL') }); return payload; });
    address = await app.listen({ host: '127.0.0.1', port: 0 }); }
  beforeAll(async () => { await admin.query(`CREATE DATABASE ${name}`); created = true; await start(); });
  afterAll(async () => {
    try { await app?.close(); } finally {
      if (created) await admin.query(`DROP DATABASE ${name}`);
      const remaining = (await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [name])).rows;
      await admin.end(); await save(`${label}-cleanup`, { database: name, remaining, serverClosed: true });
    }
  });
  const client = () => new FlowClient({ baseUrl: address, token });
  async function http(path: string, body?: unknown, credential = token) {
    const response = await fetch(address + path, { method: body === undefined ? 'GET' : 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json', 'idempotency-key': randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
    return { status: response.status, body: await response.json() as any, cache: response.headers.get('cache-control') };
  }
  async function setup() {
    let snapshot = (await http('/api/projects', { title: 'O12 public goal journey' })).body.snapshot;
    const nodes: string[] = [];
    for (const title of ['A', 'B']) {
      const added = await http(`/api/projects/${snapshot.project.id}/commands`, { expectedRevision: snapshot.project.revision, reason: 'Two independent nodes', change: { kind: 'add-node', title } });
      expect(added.status).toBe(200); snapshot = added.body.snapshot; nodes.push(added.body.changedNodeId);
    }
    const goalId = (await http('/api/goals', { projectId: snapshot.project.id, originalGoal: 'PRIVATE_MATERIAL original', constraints: 'No provider', acceptance: 'Exact output' })).body.goal.id as string;
    for (const nodeId of nodes) await client().commandGoal(goalId, { kind: 'define-input', nodeId, expectedInputVersion: 0, input: goalInput(), reason: 'Freeze input' }, randomUUID());
    return { goalId, projectId: snapshot.project.id as string, nodes: nodes as [string, string], snapshot };
  }
  return { client, http, setup, requests, restart: async () => { await app.close(); await start(); }, address: () => address };
}
export const goalInput = (goal = 'PRIVATE_MATERIAL_纸鸢😀'.repeat(75)) => ({ goal, constraints: 'No provider', acceptance: 'nonempty', verification: { kind: 'nonempty' as const } });
export async function save(name: string, data: unknown) {
  const dir = process.env.FLOW_O12_EVIDENCE_DIR; if (!dir) return;
  await mkdir(dir, { recursive: true }); await writeFile(join(dir, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
}
