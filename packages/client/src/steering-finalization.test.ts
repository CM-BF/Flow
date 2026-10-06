import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { steeringMailboxSchema, steeringProposalLookupSchema, type SteeringFinalizationInput } from '../../contracts/src/active-steering.js';
import { steeringFinalizationSchema } from '../../contracts/src/runner.js';
import { FlowClient } from './index.js';

it('transports conditional steering finalization and recovery without deciding or retrying unknown outcomes', async () => {
  const calls: { path: string; raw: string }[] = [];
  const mailbox = { revision: 2, sealed: false, commands: [], delivery: { commandId: 'command/1', text: '  补充😀\n原文  ' } };
  const committed = { state: 'committed', proposalId: 'proposal/1', lastSequence: 6, replayed: true };
  const refused = { state: 'not-committed', proposalId: 'proposal/1', lastSequence: 3, controlRevision: 3, reason: 'control-changed' };
  const absent = { state: 'absent', proposalId: 'proposal/1' };
  let finalMode: 'committed' | 'refused' | 'denied' | 'disconnect' = 'committed';
  let found = false;
  const server = createServer(async (request, response) => {
    try {
      expect(request.method).toBe('POST');
      expect(request.headers.authorization).toBe('Bearer steering-runner');
      expect(request.headers['idempotency-key']).toBeUndefined();
      const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const raw = Buffer.concat(chunks).toString();
      calls.push({ path: request.url!, raw });
      const body: unknown = JSON.parse(raw);
      let reply: unknown;
      if (request.url === '/api/runner/steering/mailbox') { steeringMailboxSchema.parse(body); reply = mailbox; }
      else if (request.url === '/api/runner/steering/proposals/status') { steeringProposalLookupSchema.parse(body); reply = found ? committed : absent; }
      else {
        expect(request.url).toBe('/api/runner/steering/finalize');
        steeringFinalizationSchema.parse(body);
        if (finalMode === 'disconnect') { request.socket.destroy(); return; }
        if (finalMode === 'denied') {
          response.writeHead(409, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: { code: 'ownership_lost', message: 'Current authorization required.' } })); return;
        }
        reply = finalMode === 'refused' ? refused : committed;
      }
      response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(reply));
    } catch (error) { response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: { code: 'invalid_fixture_request', message: String(error) } })); }
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const client = new FlowClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, token: 'steering-runner' });
  const ownership = { attemptId: 'attempt/1', ownerVersion: 2 };
  const input: SteeringFinalizationInput = { ...ownership, proposalId: 'proposal/1', expectedRevision: 2, afterSequence: 3, nativeSessionId: 'native/1', resultId: 'result/1', events: [
    { id: 'artifact-event', sequence: 4, type: 'artifact', artifactId: 'artifact/1', title: '回复', version: 'a'.repeat(64), content: '  正文😀\n', mediaType: 'text/plain' },
    { id: 'verification-event', sequence: 5, type: 'verification', artifactId: 'artifact/1', artifactVersion: 'a'.repeat(64), verifierId: 'flow.text', verifierVersion: '1', inputDigest: 'b'.repeat(64), result: 'passed', evidence: 'Existing local verifier evidence.' },
    { id: 'final-event', sequence: 6, type: 'assistant-final', messageId: 'c'.repeat(64), nativeSessionId: 'native/1', source: 'claude.sdk.result', sourceMessageId: 'result/1', content: '  正文😀\n', settings: { requested: { model: 'fixed-model', permissionMode: 'dontAsk', thinking: 'disabled' }, effective: { model: null, permissionMode: null, tools: null, thinking: 'unknown' } } },
  ] };
  const lookup = { ...ownership, proposalId: input.proposalId };
  try {
    expect(await client.steeringMailbox(ownership)).toEqual(mailbox);
    expect(await client.finalizeSteering(input)).toEqual(committed);
    finalMode = 'refused'; expect(await client.finalizeSteering(input)).toEqual(refused);
    expect(await client.steeringProposalStatus(lookup)).toEqual(absent);
    found = true; expect(await client.steeringProposalStatus(lookup)).toEqual(committed);
    finalMode = 'denied'; await expect(client.finalizeSteering(input)).rejects.toMatchObject({ status: 409, code: 'ownership_lost' });
    finalMode = 'disconnect'; await expect(client.finalizeSteering(input)).rejects.toThrow();
    const beforeAbort = calls.length;
    await expect(client.steeringMailbox(ownership, AbortSignal.abort())).rejects.toThrow();
    await expect(client.finalizeSteering(input, AbortSignal.abort())).rejects.toThrow();
    await expect(client.steeringProposalStatus(lookup, AbortSignal.abort())).rejects.toThrow();
    expect(calls).toHaveLength(beforeAbort);
    expect(calls.map(call => call.path)).toEqual([
      '/api/runner/steering/mailbox', '/api/runner/steering/finalize', '/api/runner/steering/finalize',
      '/api/runner/steering/proposals/status', '/api/runner/steering/proposals/status',
      '/api/runner/steering/finalize', '/api/runner/steering/finalize',
    ]);
    expect(calls.filter(call => call.path.endsWith('/finalize')).map(call => call.raw)).toEqual(Array(4).fill(JSON.stringify(input)));
    expect(calls[0]?.raw).toBe(JSON.stringify(ownership));
    expect(calls[3]?.raw).toBe(JSON.stringify(lookup));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
