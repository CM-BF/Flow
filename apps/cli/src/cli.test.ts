import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { runCli } from './index.js';

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
