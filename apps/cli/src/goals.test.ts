import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import { createServer } from '../../server/src/index.js';
import { runCli } from './index.js';

it('round-trips goal versions through public CLI/client and production registration without implicitly executing', async () => {
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const name = `flow_goal_cli_${process.pid}_${Date.now()}`;
  let created = false;
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  const temporary = await mkdtemp(path.join(tmpdir(), 'flow-goal-cli-'));
  try {
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
    server = await createServer({ databaseUrl, ownerToken: 'goal-cli-owner' });
    let url = await server.listen({ port: 0, host: '127.0.0.1' });
    const client = new FlowClient({ baseUrl: url, token: 'goal-cli-owner' });
    const cli = async (args: string[]) => {
      const output: string[] = []; const errors: string[] = [];
      const code = await runCli(args, { out: t => output.push(t), err: t => errors.push(t) }, { FLOW_URL: url, FLOW_TOKEN: 'goal-cli-owner' });
      return { code, value: output[0] ? JSON.parse(output[0]) : undefined, errors };
    };
    const project = (await client.createProject({ workspaceId: 'personal', title: 'Command integration' }, 'project')).snapshot;
    const node = await client.changeProject(project.project.id, { expectedRevision: 1, reason: 'Define bounded node', change: { kind: 'add-node', title: 'A', taskId: null, parent: null } }, 'node');
    const nodeId = node.changedNodeId!;
    const inputFile = path.join(temporary, 'input.json');
    const originalGoal = '  Preserve exact user goal\n';
    await writeFile(inputFile, JSON.stringify({ projectId: project.project.id, originalGoal, constraints: 'No models', acceptance: 'Fixed delivery' }));
    const admitted = await cli(['goal', 'create', '--input', inputFile, '--key', 'goal']);
    expect(admitted.code).toBe(0);
    const goalId = admitted.value.goal.id;
    expect((await cli(['goal', 'create', '--input', inputFile, '--key', 'goal'])).value.replayed).toBe(true);
    const first = { goal: 'Original input', constraints: 'No remote calls', acceptance: 'Nonempty output', verification: { kind: 'nonempty' } };
    await writeFile(inputFile, JSON.stringify({ kind: 'define-input', nodeId, expectedInputVersion: 0, input: first, reason: 'First accepted input' }));
    const defined = await cli(['goal', 'change', goalId, '--input', inputFile, '--key', 'define']);
    expect(defined.code).toBe(0);
    expect(defined.value.inputVersion).toBe(1);
    expect((await cli(['goal', 'change', goalId, '--input', inputFile, '--key', 'stale'])).code).toBe(3);
    expect((await cli(['goal', 'input', goalId, '--node', nodeId, '--version', '1'])).value.input).toEqual(first);
    expect((await cli(['goal', 'history', goalId, '--node', nodeId, '--limit', '1'])).value).toEqual({ executions: [], nextCursor: null });
    expect((await client.readGoal(goalId)).nodes[0]?.definition).not.toHaveProperty('input');
    expect((await client.list()).tasks).toEqual([]);
    expect((await cli(['goal', 'change', goalId, '--input', inputFile])).code).toBe(2);
    await server.close(); server = await createServer({ databaseUrl, ownerToken: 'goal-cli-owner' });
    url = await server.listen({ port: 0, host: '127.0.0.1' });
    expect((await cli(['goal', 'show', goalId])).value.goal.originalGoal).toBe(originalGoal);
    expect((await cli(['goal', 'input', goalId, '--node', nodeId])).value.version).toBe(1);
  } finally {
    await server?.close();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    await admin.end(); await rm(temporary, { recursive: true, force: true });
  }
}, 15000);
