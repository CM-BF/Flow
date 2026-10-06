import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import { createServer } from '../../server/src/index.js';
import { runCli } from './index.js';

it('persists plugin declarations through CLI/client and production routes without claiming a package is installed', async () => {
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const name = `flow_plugin_cli_${process.pid}_${Date.now()}`;
  let created = false;
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  const temporary = await mkdtemp(path.join(tmpdir(), 'flow-plugin-cli-'));
  try {
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
    server = await createServer({ databaseUrl, ownerToken: 'plugin-cli-owner' });
    let url = await server.listen({ port: 0, host: '127.0.0.1' });
    const client = new FlowClient({ baseUrl: url, token: 'plugin-cli-owner' });
    const cli = async (args: string[]) => {
      const output: string[] = []; const errors: string[] = [];
      const code = await runCli(args, { out: text => output.push(text), err: text => errors.push(text) }, { FLOW_URL: url, FLOW_TOKEN: 'plugin-cli-owner' });
      return { code, value: output[0] ? JSON.parse(output[0]) : undefined, errors };
    };
    const inputFile = path.join(temporary, 'input.json');
    const registration = {
      scope: { workspaceId: 'personal', projectId: null },
      version: { packageName: '@flow/test-renderer', packageVersion: '1.0.0', source: 'npm', declaredSha256: 'a'.repeat(64), license: 'MIT', hostApiMajor: 1, capabilities: ['renderer'], publicConfiguration: [{ key: 'compact', kind: 'boolean', required: true }] },
    };
    await writeFile(inputFile, JSON.stringify(registration));
    const registered = await cli(['plugin', 'register', '--input', inputFile, '--key', 'register']);
    expect(registered.code).toBe(0);
    const id = registered.value.snapshot.installation.id;
    expect(registered.value.snapshot).toMatchObject({ revision: 1, configurationStatus: 'incomplete', grants: [], installation: { registrationStatus: 'registered', runtimeStatus: 'unavailable' } });
    expect((await cli(['plugin', 'register', '--input', inputFile, '--key', 'register'])).value).toMatchObject({ replayed: true, operation: { id: registered.value.operation.id } });
    expect((await cli(['plugin', 'register', '--input', inputFile])).code).toBe(2);
    expect((await cli(['plugin', 'list', '--limit', '1'])).value.installations.map((item: { id: string }) => item.id)).toEqual([id]);
    await writeFile(inputFile, JSON.stringify({ expectedRevision: 1, reason: 'Use compact display', change: { kind: 'configure', values: { compact: true } } }));
    const configured = await cli(['plugin', 'change', id, '--input', inputFile, '--key', 'configure']);
    expect(configured.code).toBe(0);
    expect(configured.value.snapshot).toMatchObject({ revision: 2, configurationStatus: 'ready', installation: { runtimeStatus: 'unavailable' } });
    expect((await cli(['plugin', 'change', id, '--input', inputFile, '--key', 'stale'])).code).toBe(3);
    expect((await cli(['plugin', 'show', id, '--revision', '1'])).value.configuration).toEqual({});
    expect((await cli(['plugin', 'versions', id])).value.versions[0].packageVersion).toBe('1.0.0');
    const history = await cli(['plugin', 'history', id, '--limit', '1']);
    expect(history.value.operations).toHaveLength(1);
    const operation = await cli(['plugin', 'operation', id, configured.value.operation.id]);
    expect(operation.value).toMatchObject({ kind: 'configure', beforeRevision: 1, afterRevision: 2, status: 'succeeded' });
    const project = await client.createProject({ workspaceId: 'personal', title: 'Other scope' }, 'project');
    expect((await cli(['plugin', 'list', '--project', project.snapshot.project.id])).value.installations).toEqual([]);
    expect((await client.list()).tasks).toEqual([]);
    expect((await cli(['plugin', 'install', id])).code).toBe(2);
    await server.close(); server = await createServer({ databaseUrl, ownerToken: 'plugin-cli-owner' });
    url = await server.listen({ port: 0, host: '127.0.0.1' });
    expect((await cli(['plugin', 'show', id])).value).toMatchObject({ revision: 2, configuration: { compact: true }, installation: { runtimeStatus: 'unavailable' } });
  } finally {
    await server?.close();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    await admin.end(); await rm(temporary, { recursive: true, force: true });
  }
}, 15000);
