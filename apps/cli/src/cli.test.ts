import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { runCli } from './index.js';

function cliSettings() {
  return { protocol: 'flow.claude-turn-settings.v1', profile: { id: randomUUID(), runnerId: randomUUID(), configDigest: 'a'.repeat(64) },
    requested: { model: 'configured-alias', thinking: 'adaptive', effort: { kind: 'level', value: 'high' }, speed: 'fast' } };
}

it('conversation profiles uses the explicit catalog and preserves cursor, limit and cancellation', async () => {
  const paths: string[] = [];
  await withCenter((request, response) => {
    paths.push(request.url!); expect(request.headers['x-flow-execution-profile']).toBe('flow.claude-turn-settings.v1');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ protocol: 'flow.claude-turn-settings.v1', profiles: [], nextCursor: null }));
  }, async env => {
    const output: string[] = []; const io = { out: (text: string) => output.push(text), err: (text: string) => output.push(text) };
    const args = ['conversation', 'profiles', '--after', 'cursor/value', '--limit', '2', '--json'];
    expect(await runCli(args, io, env)).toBe(0);
    expect(JSON.parse(output[0]!).protocol).toBe('flow.claude-turn-settings.v1');
    expect(await runCli(args, io, env, AbortSignal.abort())).toBe(4);
    expect(await runCli(['conversation', 'profiles', '--limit', '0'], io, env)).toBe(2);
  });
  expect(paths).toEqual(['/api/execution-profiles?after=cursor%2Fvalue&limit=2']);
});

it('conversation send and enqueue consume complete bounded input and print acceptance without replacing settings', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flow-cli-settings-')); const filename = path.join(directory, 'input.json');
  const conversationId = randomUUID(); const snapshot = cliSettings(); const requests: { path: string; key: unknown; body: unknown }[] = [];
  const at = '2026-10-06T00:00:00Z';
  try {
    await withCenter(async (request, response) => {
      let raw = ''; for await (const chunk of request) raw += chunk; const body = JSON.parse(raw);
      requests.push({ path: request.url!, key: request.headers['idempotency-key'], body });
      response.writeHead(200, { 'content-type': 'application/json' });
      if (request.url!.endsWith('/queue')) response.end(JSON.stringify({ conversationId, queueRevision: 4, replayed: true,
        item: { id: randomUUID(), conversationId, sequence: 4, state: 'waiting', preview: body.text, truncated: false, promoted: null,
          createdAt: at, updatedAt: at, messageSettings: body.messageSettings } }));
      else {
        const taskId = randomUUID();
        response.end(JSON.stringify({ replayed: false, conversation: { id: conversationId, title: 'CLI', harness: 'claude',
          requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' }, revision: 1, createdAt: at, updatedAt: at },
          turn: { id: randomUUID(), conversationId, number: 1, createdAt: at, user: { role: 'user', text: body.text },
            task: { id: taskId, title: 'CLI', harness: 'claude', status: 'queued', verificationStatus: 'pending', createdAt: at, updatedAt: at },
            telemetry: { kind: 'execution', taskId, title: 'Execution' }, effective: { model: null, tools: null, thinking: 'unknown', source: null },
            assistant: { state: 'pending', reason: 'execution-pending' }, messageSettings: body.messageSettings } }));
      }
    }, async env => {
      const output: string[] = []; const io = { out: (text: string) => output.push(text), err: (text: string) => output.push(text) };
      await writeFile(filename, JSON.stringify({ expectedRevision: 0, text: '  Send 中文🙂\n', mode: 'follow-up', messageSettings: snapshot }));
      expect(await runCli(['conversation', 'send', conversationId, '--input', filename, '--key', 'send-settings', '--json'], io, env)).toBe(0);
      expect(JSON.parse(output[0]!).turn.messageSettings).toEqual(snapshot);
      expect(JSON.parse(output[0]!).turn.task.status).toBe('queued');
      await writeFile(filename, JSON.stringify({ expectedQueueRevision: 3, text: 'Queued text', messageSettings: snapshot }));
      expect(await runCli(['conversation', 'enqueue', conversationId, '--input', filename, '--key', 'enqueue-settings', '--json'], io, env)).toBe(0);
      expect(JSON.parse(output[1]!).item.messageSettings).toEqual(snapshot);
      expect(JSON.parse(output[1]!).replayed).toBe(true);
    });
    expect(requests.map(({ path, key }) => ({ path, key }))).toEqual([
      { path: `/api/conversations/${conversationId}/turns`, key: 'send-settings' }, { path: `/api/conversations/${conversationId}/queue`, key: 'enqueue-settings' },
    ]);
    expect(requests.every(request => (request.body as { messageSettings: unknown }).messageSettings && JSON.stringify((request.body as { messageSettings: unknown }).messageSettings) === JSON.stringify(snapshot))).toBe(true);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('conversation mutation rejects missing key, malformed or oversized JSON and non-follow-up mode before HTTP', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flow-cli-settings-invalid-')); const filename = path.join(directory, 'input.json'); let calls = 0;
  try {
    await withCenter((request, response) => { calls++; request.resume(); response.end('{}'); }, async env => {
      const io = { out() {}, err() {} }; const args = ['conversation', 'send', randomUUID(), '--input', filename];
      await writeFile(filename, JSON.stringify({ expectedRevision: 0, text: 'Text' }));
      expect(await runCli(args, io, env)).toBe(2);
      for (const text of ['{invalid', ' '.repeat(131_073), JSON.stringify({ expectedRevision: 0, text: 'Text', mode: 'queue' })]) {
        await writeFile(filename, text); expect(await runCli([...args, '--key', 'same-key'], io, env)).toBe(2);
      }
    });
    expect(calls).toBe(0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('conversation unknown ACK and conflict use existing nonzero exits without new keys or hidden retries', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flow-cli-settings-unknown-')); const filename = path.join(directory, 'input.json');
  const calls: { key: unknown; body: string }[] = [];
  try {
    await writeFile(filename, JSON.stringify({ expectedQueueRevision: 0, text: 'Text', messageSettings: cliSettings() }));
    await withCenter(async (request, response) => {
      let body = ''; for await (const chunk of request) body += chunk; calls.push({ key: request.headers['idempotency-key'], body });
      response.writeHead(calls.length === 1 ? 200 : 409, { 'content-type': 'application/json' });
      response.end(calls.length === 1 ? '{"secret":"do not echo raw"}' : JSON.stringify({ error: { code: 'queue_conflict', message: 'Refresh before a new action.' } }));
    }, async env => {
      const errors: string[] = []; const io = { out() {}, err: (text: string) => errors.push(text) };
      const args = ['conversation', 'enqueue', randomUUID(), '--input', filename, '--key', 'original-settings-key'];
      expect(await runCli(args, io, env)).toBe(4);
      expect(errors[0]).toContain('original --key'); expect(errors[0]).not.toContain('secret'); expect(calls).toHaveLength(1);
      expect(await runCli(args, io, env)).toBe(3);
    });
    expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

async function withCenter(handler: (request: IncomingMessage, response: ServerResponse) => void, action: (env: NodeJS.ProcessEnv) => Promise<void>) {
  const server = createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await action({ FLOW_URL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, FLOW_TOKEN: 'test-owner' }); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}

it('submits through the center with a caller-controlled idempotency key', async () => {
  let received: unknown;
  await withCenter(async (request, response) => {
    expect(request.url).toBe('/api/tasks');
    expect(request.headers['idempotency-key']).toBe('stable-request');
    let body = '';
    for await (const chunk of request) body += chunk;
    received = JSON.parse(body);
    response.writeHead(202, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ task: { id: 'task-1', status: 'queued' }, replayed: false }));
  }, async env => {
    const output: string[] = [];
    const code = await runCli(['submit', 'Read notes', '--title', 'Notes', '--key', 'stable-request', '--json'], { out: text => output.push(text), err: text => output.push(text) }, env);
    expect(code).toBe(0);
    expect(JSON.parse(output[0]!).task.id).toBe('task-1');
  });
  expect(received).toEqual({ title: 'Notes', prompt: 'Read notes', harness: 'fixture' });
});

const queuedTask = { id: 'task-1', title: 'Background job', status: 'queued', verificationStatus: 'pending', harness: 'fixture', createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', entries: [], watermark: 0, hasMore: false, pendingDecision: null, attempt: null, usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: 'unknown', incomplete: true }, prompt: 'Continue in background' };

it('stops watching at its timeout without sending a cancellation command', async () => {
  const requests: string[] = [];
  await withCenter((request, response) => {
    requests.push(request.url!);
    if (request.url!.includes('/stream')) {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.write(': connected\n\n');
    } else {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(queuedTask));
    }
  }, async env => {
    const code = await runCli(['watch', 'task-1', '--timeout', '200', '--json'], { out() {}, err() {} }, env);
    expect(code).toBe(124);
  });
  expect(requests.some(path => path.includes('/cancel'))).toBe(false);
  expect(requests).toContain('/api/tasks/task-1/stream?after=0');
});

it('reports cancel requested without claiming the runner already stopped', async () => {
  await withCenter((request, response) => {
    expect(request.url).toBe('/api/tasks/task-1/cancel');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ...queuedTask, status: 'cancel_requested' }));
  }, async env => {
    const output: string[] = [];
    expect(await runCli(['cancel', 'task-1'], { out: text => output.push(text), err() {} }, env)).toBe(0);
    expect(output.join()).toContain('cancel_requested');
    expect(output.join()).not.toContain('stopped');
  });
});


it('sends the selected durable decision and preserves conflict errors', async () => {
  let body = '';
  await withCenter(async (request, response) => {
    expect(request.url).toBe('/api/tasks/task-1/decision');
    expect(request.headers['idempotency-key']).toBe('decision-key');
    for await (const chunk of request) body += chunk;
    response.writeHead(409, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'decision_conflict', message: 'Decision already answered.' } }));
  }, async env => {
    const errors: string[] = [];
    const code = await runCli(['decision', 'task-1', 'approve', '--decision', 'choice-1', '--key', 'decision-key'], { out() {}, err: text => errors.push(text) }, env);
    expect(code).toBe(3);
    expect(errors).toEqual(['Decision already answered.']);
  });
  expect(JSON.parse(body)).toEqual({ decisionId: 'choice-1', answer: 'approve' });
});

it.each([
  ['succeeded', 'passed', 0], ['succeeded', 'failed', 12],
  ['failed', 'pending', 10], ['cancelled', 'pending', 11], ['uncertain', 'pending', 13],
])('watch exposes %s / %s as exit %s', async (status, verificationStatus, expected) => {
  await withCenter((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ ...queuedTask, status, verificationStatus }));
  }, async env => {
    const output: string[] = [];
    expect(await runCli(['watch', 'task-1', '--json'], { out: text => output.push(text), err() {} }, env)).toBe(expected);
    expect(JSON.parse(output[0]!).status).toBe(status);
  });
});

it('reconnects at delivered cursor and drains terminal pages before exiting', async () => {
  const requests: string[] = [];
  const output: string[] = [];
  await withCenter((request, response) => {
    requests.push(request.url!);
    if (!request.url!.includes('/stream')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(queuedTask));
      return;
    }
    const first = request.url!.endsWith('after=0');
    const task = { ...queuedTask, status: 'succeeded', verificationStatus: 'passed' };
    const page = { entries: [{ id: first ? 'event-1' : 'event-2', cursor: first ? 1 : 2, createdAt: queuedTask.createdAt, kind: 'text', text: first ? 'first' : 'last' }], nextCursor: first ? 1 : 2, watermark: 2, task, usage: task.usage, pendingDecision: null, hasMore: first };
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end(`data: ${JSON.stringify(page)}\n\n`);
  }, async env => {
    expect(await runCli(['watch', 'task-1', '--json', '--timeout', '3000'], { out: text => output.push(text), err() {} }, env)).toBe(0);
  });
  expect(requests).toEqual(['/api/tasks/task-1', '/api/tasks/task-1/stream?after=0', '/api/tasks/task-1/stream?after=1']);
  expect(output.map(text => JSON.parse(text)).at(-1).entries[0].text).toBe('last');
});

it('applies observation timeout to the initial snapshot request too', async () => {
  await withCenter((_request, _response) => {}, async env => {
    expect(await runCli(['watch', 'task-1', '--timeout', '100'], { out() {}, err() {} }, env)).toBe(124);
  });
});


it('does not swallow SIGINT while an ordinary CLI command waits for HTTP', async () => {
  let received!: () => void;
  const pending = new Promise<void>(resolve => { received = resolve; });
  await withCenter((_request, _response) => { received(); }, async env => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'apps/cli/src/main.ts', 'show', 'task-1'], { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: 'ignore' });
    const exited = once(child, 'exit');
    try {
      await pending;
      child.kill('SIGINT');
      expect(await exited).toEqual([null, 'SIGINT']);
    } finally { child.kill('SIGKILL'); }
  });
});

it('reads cross-task activity and decisions without fetching folded details', async () => {
  const requests: string[] = [];
  await withCenter((request, response) => {
    requests.push(request.url!);
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ entries: [{ task: { id: 'task-2', title: 'Second task' }, entry: { kind: 'reference', reference: { id: 'artifact-2', title: 'Delivery' } } }], attention: [{ id: 'task-1', title: 'First task', pendingDecision: { id: 'decision-1', prompt: 'Approve release?' } }], tasksTruncated: false, attentionTruncated: false, projectionPending: false }));
  }, async env => {
    const output: string[] = [];
    expect(await runCli(['workspace', '--after', '0', '--limit', '20'], { out: text => output.push(text), err() {} }, env)).toBe(0);
    expect(output.join()).toContain('Second task: [Delivery] artifact-2');
    expect(output.join()).toContain('Approve release? [decision decision-1]');
  });
  expect(requests).toEqual(['/api/workspace?after=0&limit=20']);
});

it('validates a recovery file and sends only an explicit safe retry using its stable key', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'flow-cli-recovery-'));
  const filename = path.join(directory, 'retry.json');
  let received: unknown;
  const input = { attemptId: 'old', ownerVersion: 3, resolutionId: 'audit-1', safety: { strategy: 'revised-work', prompt: 'Inspect existing delivery, do not repeat the external write.', evidence: { explanation: 'The write succeeded before its acknowledgement was lost.', references: [] } } };
  try {
    await writeFile(filename, JSON.stringify(input));
    await withCenter(async (request, response) => {
      expect(request.url).toBe('/api/tasks/task-1/reconciliation/retry');
      expect(request.headers['idempotency-key']).toBe('safe-retry');
      let body = '';
      for await (const chunk of request) body += chunk;
      received = JSON.parse(body);
      response.writeHead(202, { 'content-type': 'application/json' });
      response.end('{"task":{"id":"task-new"}}');
    }, async env => {
      const output: string[] = [];
      expect(await runCli(['reconcile', 'retry', 'task-1', '--input', filename, '--key', 'safe-retry'], { out: text => output.push(text), err() {} }, env)).toBe(0);
      expect(JSON.parse(output[0]!).task.id).toBe('task-new');
      await writeFile(filename, JSON.stringify({ attemptId: 'old', ownerVersion: 3, resolutionId: 'audit-1' }));
      expect(await runCli(['reconcile', 'retry', 'task-1', '--input', filename, '--key', 'unsafe'], { out() {}, err() {} }, env)).toBe(2);
    });
    expect(received).toEqual(input);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
