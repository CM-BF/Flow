import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { HarnessAdapter, HarnessContext } from '@flow/contracts';
import { executionProfileConfigurationJson } from '../../../packages/contracts/src/execution-profiles.js';
import { describeExecutionProfile, guardExecutionProfile } from './execution-profiles.js';
import { textDigest } from './verifier.js';
import { loadRunnerConfiguration } from './configuration.js';

const directories: string[] = [];
afterEach(async () => { for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true }); });
it('describes the same fixed configuration used to construct its adapter without exposing material paths', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-chat03-config-')); directories.push(directory);
  const path = join(directory, 'manifest.json');
  await writeFile(path, JSON.stringify({ model: 'model-b', materialFiles: ['/private/authorized/material.txt'], requireReadApproval: true, maxTurns: 2, maxBudgetUsd: 0.25, timeoutMs: 2000 }));
  const loaded = await loadRunnerConfiguration(path);
  expect(loaded.profile).toMatchObject({ model: 'model-b', access: 'configured-readonly', requireReadApproval: true, thinking: 'disabled', permissionMode: 'dontAsk', limits: { maxTurns: 2, maxBudgetUsd: 0.25, timeoutMs: 2000 } });
  expect(loaded.profile!.adapterVersion).toBe(loaded.adapters.find(adapter => adapter.name === 'claude')!.version);
  expect(JSON.stringify(loaded.profile)).not.toContain('/private/authorized');
  expect(loaded.profile!.materialScopeDigest).toMatch(/^[a-f0-9]{64}$/);
  expect((await loadRunnerConfiguration()).profile).toBeNull();
});

it('rejects an old digest, another runner, or another profile before invoking the adapter', async () => {
  let calls = 0;
  const adapter: HarnessAdapter = { name: 'claude', version: 'claude-sdk-0.3.290-v2', async run() { calls++; } };
  const configuration = describeExecutionProfile({ model: 'alias', materialFiles: [] }, adapter);
  const reference = { id: randomUUID(), runnerId: randomUUID(), configDigest: textDigest(executionProfileConfigurationJson(configuration)) };
  const guarded = guardExecutionProfile(adapter, reference, configuration);
  const context: HarnessContext = { task: { title: 'Selected', harness: 'claude', prompt: 'hi' }, workingDirectory: '', signal: new AbortController().signal,
    async assertOwnership() {}, async emit() {}, async waitForDecision() { return 'reject'; } };
  for (const changed of [{ configDigest: '0'.repeat(64) }, { runnerId: randomUUID() }, { id: randomUUID() }]) {
    await expect(guarded.run({ ...context, task: { ...context.task, executionProfile: { ...reference, ...changed } } })).rejects.toThrow('does not match');
  }
  expect(calls).toBe(0);
  expect(() => guardExecutionProfile(adapter, reference, { ...configuration, model: 'changed' })).toThrow('does not match');
  await guarded.run({ ...context, task: { ...context.task, executionProfile: reference } });
  await guarded.run(context); // Legacy unprofiled admission remains compatible.
  expect(calls).toBe(2);
});

it('keeps material-path changes private while requiring a different configuration identity', () => {
  const adapter: HarnessAdapter = { name: 'claude', version: 'claude-sdk-0.3.290-v2', async run() {} };
  const first = describeExecutionProfile({ materialFiles: ['/private/first'] }, adapter);
  const changed = describeExecutionProfile({ materialFiles: ['/private/second'] }, adapter);
  expect(first.materialScopeDigest).not.toBe(changed.materialScopeDigest);
  expect(JSON.stringify([first, changed])).not.toContain('/private');
  const disabled = describeExecutionProfile({ materialFiles: ['/private/second'], allowRead: false }, adapter);
  expect(disabled).toEqual(describeExecutionProfile({ materialFiles: [] }, adapter));
});

it('does not invoke the configured adapter after cancellation or a failed ownership gate', async () => {
  let calls = 0;
  const adapter: HarnessAdapter = { name: 'claude', version: 'claude-sdk-0.3.290-v2', async run() { calls++; } };
  const configuration = describeExecutionProfile({ materialFiles: [] }, adapter);
  const reference = { id: randomUUID(), runnerId: randomUUID(), configDigest: textDigest(executionProfileConfigurationJson(configuration)) };
  const guarded = guardExecutionProfile(adapter, reference, configuration);
  const context: HarnessContext = { task: { title: 'Cancelled', harness: 'claude', prompt: 'hi', executionProfile: reference }, workingDirectory: '', signal: AbortSignal.abort(),
    async assertOwnership() { throw new Error('No ownership'); }, async emit() {}, async waitForDecision() { return 'reject'; } };
  await expect(guarded.run(context)).rejects.toThrow();
  await expect(guarded.run({ ...context, signal: new AbortController().signal })).rejects.toThrow('No ownership');
  expect(calls).toBe(0);
});

it.each([true, false])('publishes from the real startup entry before polling (publication accepted: %s)', async accepted => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-chat03-startup-')); directories.push(directory);
  const manifest = join(directory, 'manifest.json');
  await writeFile(manifest, JSON.stringify({ model: 'startup-alias', materialFiles: [] }));
  const paths: string[] = [];
  let configuration: unknown;
  const server = createServer(async (request, response) => {
    paths.push(request.url!);
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/runner/execution-profile') {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString()); configuration = body.configuration;
      if (!accepted) { response.writeHead(409).end(JSON.stringify({ error: { code: 'profile_immutable', message: 'New runner identity required.' } })); return; }
      response.end(JSON.stringify({ profile: { configuration: body.configuration, reference: { id: randomUUID(), runnerId: randomUUID(), configDigest: textDigest(executionProfileConfigurationJson(body.configuration)) } }, replayed: false })); return;
    }
    if (request.url === '/api/runner/claim') { response.end(JSON.stringify({ assignment: null, remainingLeaseMs: 0 })); return; }
    response.writeHead(404).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server has no port.');
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./main.ts', import.meta.url))], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)),
    env: { ...process.env, FLOW_A2A_ENDPOINTS_FILE: '', FLOW_URL: `http://127.0.0.1:${address.port}`, FLOW_RUNNER_TOKEN: 'synthetic-startup-token', FLOW_RUNNER_WORKDIR: directory, FLOW_CLAUDE_MATERIALS_FILE: manifest },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', text => { stderr += text; });
  const exited = new Promise<number | null>((resolve, reject) => { child.once('exit', resolve); child.once('error', reject); });
  try {
    if (accepted) {
      await expect.poll(() => paths.includes('/api/runner/claim'), { timeout: 5000 }).toBe(true);
      child.kill('SIGTERM');
    }
    await expect.poll(() => child.exitCode, { timeout: 5000 }).toBe(accepted ? 0 : 1);
    expect(await exited).toBe(accepted ? 0 : 1);
    expect(paths[0]).toBe('/api/runner/execution-profile');
    expect(configuration).toMatchObject({ model: 'startup-alias', access: 'none' });
    if (!accepted) expect(paths).toEqual(['/api/runner/execution-profile']);
    expect(stderr).not.toContain('synthetic-startup-token');
  } finally {
    if (child.exitCode === null) child.kill('SIGKILL');
    await exited;
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
