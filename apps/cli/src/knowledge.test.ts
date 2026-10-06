import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { FlowClient } from '@flow/client';
import { KNOWLEDGE_LIMITS, type KnowledgeCitation } from '@flow/contracts';
import { createServer } from '../../server/src/index.js';
import { runCli } from './index.js';

it('uses CLI and production knowledge routes for full-size escaped input, immutable citations, CAS and restart', async () => {
  const admin = new Pool({ connectionString: 'postgresql://flow:flow-local-only@127.0.0.1:55432/postgres', max: 1 });
  const name = `flow_knowledge_cli_${process.pid}_${Date.now()}`;
  const temporary = await mkdtemp(path.join(tmpdir(), 'flow-knowledge-cli-'));
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE ${name}`); created = true;
    const databaseUrl = `postgresql://flow:flow-local-only@127.0.0.1:55432/${name}`;
    server = await createServer({ databaseUrl, ownerToken: 'knowledge-cli-owner' });
    let url = await server.listen({ port: 0, host: '127.0.0.1' });
    const client = new FlowClient({ baseUrl: url, token: 'knowledge-cli-owner' });
    const project = (await client.createProject({ workspaceId: 'personal', title: 'Knowledge CLI' }, 'project')).snapshot.project.id;
    const cli = async (args: string[]) => {
      const output: string[] = []; const errors: string[] = [];
      const code = await runCli(['knowledge', ...args, '--project', project], { out: text => output.push(text), err: text => errors.push(text) }, { FLOW_URL: url, FLOW_TOKEN: 'knowledge-cli-owner' });
      return { code, value: output[0] ? JSON.parse(output[0]) : undefined, errors };
    };
    const file = path.join(temporary, 'input.json');
    const prefix = '中文🙂 exactSearch_\\"\r\n';
    const text = prefix + '\u0001'.repeat(KNOWLEDGE_LIMITS.textBytes - Buffer.byteLength(prefix));
    const raw = JSON.stringify({ expectedVersion: 0, title: 'Exact source', text });
    expect(Buffer.byteLength(raw)).toBeGreaterThan(1_500_000);
    await writeFile(file, raw);
    const accepted = await cli(['create', '--input', file, '--key', 'create']);
    expect(accepted.errors).toEqual([]); expect(accepted.code).toBe(0);
    const id = accepted.value.source.id;
    expect(accepted.value.version.byteLength).toBe(KNOWLEDGE_LIMITS.textBytes);
    expect((await cli(['create', '--input', file, '--key', 'create'])).value).toMatchObject({ replayed: true, source: { id } });
    expect((await cli(['list', '--limit', '1'])).value.sources.map((source: { id: string }) => source.id)).toEqual([id]);
    expect((await cli(['show', id])).value).toMatchObject({ source: { id, currentVersion: 1 }, isCurrent: true });
    const found = await cli(['search', 'exactSearch_']);
    expect(found.value.hits[0].source.id).toBe(id);
    const citation: KnowledgeCitation = { projectId: project, sourceId: id, version: 1, contentDigest: accepted.value.version.contentDigest, locator: { kind: 'utf8-bytes', start: 0, end: Buffer.byteLength(prefix) } };
    await writeFile(file, JSON.stringify({ expectedVersion: 1, text: 'new current material' }));
    expect((await cli(['publish', id, '--input', file, '--key', 'publish'])).value.version.version).toBe(2);
    expect((await cli(['publish', id, '--input', file, '--key', 'stale'])).code).toBe(3);
    expect((await cli(['version', id, '--version', '1'])).value.isCurrent).toBe(false);
    await writeFile(file, JSON.stringify({ citation }));
    expect((await cli(['resolve', '--input', file])).value).toEqual({ citation, text: prefix, isCurrent: false, currentVersion: 2 });
    await server.close(); server = await createServer({ databaseUrl, ownerToken: 'knowledge-cli-owner' });
    url = await server.listen({ port: 0, host: '127.0.0.1' });
    expect((await cli(['resolve', '--input', file])).value.text).toBe(prefix);
    await writeFile(file, JSON.stringify({ expectedVersion: 0, title: 'Too much raw text', text: 'x'.repeat(KNOWLEDGE_LIMITS.textBytes + 1) }));
    expect((await cli(['create', '--input', file, '--key', 'oversized-text'])).code).toBe(2);
    await writeFile(file, ' '.repeat(KNOWLEDGE_LIMITS.textBytes * 6 + 4097));
    const oversized = await cli(['create', '--input', file, '--key', 'oversized-json']);
    expect(oversized.code).toBe(2); expect(oversized.errors.join(' ')).toContain('exceed');
    await writeFile(file, Buffer.from([0x22, 0xff, 0x22]));
    expect((await cli(['create', '--input', file, '--key', 'invalid-utf8'])).code).toBe(2);
    await writeFile(file, '{not-json}');
    expect((await cli(['create', '--input', file, '--key', 'invalid-json'])).code).toBe(2);
    expect((await cli(['list'])).value.sources).toHaveLength(1);
  } finally {
    await server?.close();
    if (created) await admin.query(`DROP DATABASE ${name}`);
    await admin.end(); await rm(temporary, { recursive: true, force: true });
  }
}, 15000);
