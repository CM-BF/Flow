import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { pluginInstallRequestSchema, pluginInstallCommandSchema } from '@flow/contracts';
import { runCli } from './index.js';

it('maps five static installation commands with strict bounded input, stable keys and no implicit retry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flow-install-cli-')), file = join(root, 'input.json');
  const calls: Array<{ method: string; path: string; body: unknown; key?: string }> = [];
  let status = 202;
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    expect(request.headers.authorization).toBe('Bearer install-owner');
    if (raw) expect((request.url!.endsWith('/commands') ? pluginInstallCommandSchema : pluginInstallRequestSchema).safeParse(body).success).toBe(true);
    calls.push({ method: request.method!, path: request.url!, body, key: request.headers['idempotency-key'] as string | undefined });
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(status === 409 ? { error: { code: 'state_conflict', message: 'State changed.' } } :
      request.method === 'POST' ? { operationId: 'operation', replayed: true } : { status: 'unknown', nextCursor: null }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Expected loopback');
  const out: string[] = [], err: string[] = [];
  const invoke = (args: string[], signal?: AbortSignal) => runCli(args, { out: s => out.push(s), err: s => err.push(s) },
    { FLOW_URL: `http://127.0.0.1:${address.port}`, FLOW_TOKEN: 'install-owner' }, signal);
  const input = { expectedRevision: 3, fetchOperationId: randomUUID(), fetchAttemptId: randomUUID(), reason: '固定材料 古😀' };
  const args = ['plugin', 'install', 'plugin/古', 'version/一', '--input', file, '--key', 'stable-install'];
  try {
    await writeFile(file, JSON.stringify(input));
    expect(await invoke(args)).toBe(0); expect(JSON.parse(out.at(-1)!)).toEqual({ operationId: 'operation', replayed: true });
    expect(calls[0]).toEqual({ method: 'POST', path: '/api/plugins/plugin%2F%E5%8F%A4/versions/version%2F%E4%B8%80/install', body: input, key: 'stable-install' });
    status = 200;
    expect(await invoke(['plugin', 'installs', 'plugin/古', '--after', 'cursor', '--limit', '2'])).toBe(0);
    expect(await invoke(['plugin', 'install-show', 'operation/一'])).toBe(0);
    expect(await invoke(['plugin', 'install-history', 'operation/一', '--after', '17', '--limit', '3'])).toBe(0);
    expect(calls.slice(1).map(call => call.path)).toEqual(['/api/plugins/plugin%2F%E5%8F%A4/material-installs?after=cursor&limit=2', '/api/plugin-installs/operation%2F%E4%B8%80', '/api/plugin-installs/operation%2F%E4%B8%80/history?after=17&limit=3']);
    await writeFile(file, JSON.stringify({ action: 'reconcile', reason: 'Inspect saved material only.' }));
    const change = ['plugin', 'install-change', 'operation/一', '--input', file, '--key', 'stable-command'];
    expect(await invoke(change)).toBe(0); expect(calls.at(-1)).toMatchObject({ path: '/api/plugin-installs/operation%2F%E4%B8%80/commands', key: 'stable-command' });
    status = 409; expect(await invoke(change)).toBe(3); expect(err.at(-1)).toBe('State changed.');
    const count = calls.length;
    expect(await invoke(change, AbortSignal.abort())).toBe(4);
    expect(await invoke(change.slice(0, -2))).toBe(2);
    await writeFile(file, JSON.stringify({ action: 'load', reason: 'No execution authority.' })); expect(await invoke(change)).toBe(2);
    await writeFile(file, ' '.repeat(4097)); expect(await invoke(args)).toBe(2);
    expect(await invoke(['--help'])).toBe(0); expect(out.at(-1)).toContain('plugin install PLUGIN VERSION');
    expect(calls).toHaveLength(count);
    expect(await readFile(new URL('../README.md', import.meta.url), 'utf8')).toContain('FLOW_PLUGIN_INSTALL_CONFIG');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true }); }
});
