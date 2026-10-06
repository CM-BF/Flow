import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import { createServer } from '../../server/src/index.js';
import { runCli } from './index.js';

it('uses production registration and the same versioned project through public client and CLI, retaining history and rejecting stale writes', async () => {
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const name = `flow_f01_${process.pid}_${Date.now()}`;
  let created = false;
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  const temporary = await mkdtemp(path.join(tmpdir(), 'flow-project-cli-'));
  try {
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
    server = await createServer({ databaseUrl, ownerToken: 'f01-owner' });
    let url = await server.listen({ port: 0, host: '127.0.0.1' });
    const cli = async (args: string[]) => {
      const lines: string[] = []; const errors: string[] = [];
      const code = await runCli(args, { out: text => lines.push(text), err: text => errors.push(text) }, { FLOW_URL: url, FLOW_TOKEN: 'f01-owner' });
      return { code, value: lines[0] ? JSON.parse(lines[0]) : undefined, errors };
    };
    expect((await cli(['project','workspaces'])).value.workspaces[0].id).toBe('personal');
    const createdProject = await cli(['project','create','--title','CLI goal','--key','new-project']);
    expect(createdProject.code).toBe(0);
    const id = createdProject.value.snapshot.project.id;
    const client = new FlowClient({ baseUrl: url, token: 'f01-owner' });
    expect((await client.projects()).projects.map(project => project.id)).toContain(id);
    const file = path.join(temporary, 'change.json');
    await writeFile(file, JSON.stringify({ expectedRevision: 1, reason: 'Define first accepted subtask', change: { kind: 'add-node', title: 'Read material', taskId: null, parent: null } }));
    const changed = await cli(['project','change', id, '--input', file, '--key','add-once']);
    expect(changed.code).toBe(0);
    expect(changed.value.snapshot.graph.nodes).toHaveLength(1);
    expect((await cli(['project','change', id, '--input', file, '--key','add-once'])).value.replayed).toBe(true);
    expect((await cli(['project','change', id, '--input', file, '--key',randomUUID()])).code).toBe(3);
    expect((await cli(['project','show',id,'--revision','1'])).value.graph.nodes).toEqual([]);
    expect((await client.list()).tasks).toEqual([]); // Planning never implicitly dispatches execution.
    await server.close(); server = await createServer({ databaseUrl, ownerToken: 'f01-owner' });
    url = await server.listen({ port: 0, host: '127.0.0.1' });
    const restored = await cli(['project','show',id]);
    expect(restored.value.project.revision).toBe(2);
    expect(restored.value.graph.nodes[0].title).toBe('Read material');
    expect((await cli(['project','create','--title','missing replay key'])).code).toBe(2);
  } finally {
    await server?.close();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    await admin.end(); await rm(temporary,{ recursive: true, force: true });
  }
}, 15000);
