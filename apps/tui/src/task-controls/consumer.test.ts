import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { expect, test } from 'vitest';
import { createInteractionController, type Intent, type InteractionClient } from '@flow/interaction';
import { openIntentStore } from '../intent-store.js';
import { runHeadless } from '../headless.js';

test('the unchanged private journal and JSONL consumer reopen a cancel intent without dispatching on startup or EOF', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-tui-cancel-'));
  const connectionId = 'f'.repeat(64);
  const original: Intent = { version: 1, connectionId, key: randomUUID(), kind: 'task-cancel', conversationId: randomUUID(),
    turnId: randomUUID(), taskId: randomUUID(), input: {} };
  let store: Awaited<ReturnType<typeof openIntentStore>> | undefined;
  let controller: ReturnType<typeof createInteractionController> | undefined;
  let cancellations = 0, reads = 0;
  const client = { conversation: async () => { reads++; throw Error('Unexpected body read'); } } as unknown as InteractionClient;
  try {
    store = await openIntentStore(directory, connectionId); await store.save(original); await store.close(); store = undefined;
    store = await openIntentStore(directory, connectionId);
    controller = createInteractionController({ client, connectionId, intents: store,
      taskControl: { cancel: async () => { cancellations++; throw Error('Unexpected cancellation'); } } });
    await controller.initialize(); expect(controller.snapshot().pending).toEqual({ kind: 'task-cancel', status: 'unknown' });
    let output = '';
    const sink = new Writable({ write(chunk, _encoding, done) { output += chunk.toString(); done(); } });
    await runHeadless(controller, Readable.from(['{"type":"help"}\n']), sink);
    expect(JSON.parse(output).result.code).toBe('HELP'); expect(controller.snapshot().closed).toBe(true);
    expect(await store.load()).toEqual(original); expect(cancellations).toBe(0); expect(reads).toBe(0);
  } finally { await controller?.dispose(); await store?.close(); await rm(directory, { recursive: true, force: true }); }
});
