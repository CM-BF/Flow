import React, { act } from 'react';
import { afterEach, expect, test } from 'vitest';
import { mkdtemp, rm, readdir, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable, Writable } from 'node:stream';
import { cleanup, render } from 'ink-testing-library';
import { createInteractionController, type Intent, type InteractionClient } from '@flow/interaction';
import { openIntentStore } from './intent-store.js';
import { runHeadless } from './headless.js';
import { TerminalScreen } from './screen.js';
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const directories: string[] = []; const finalizers: (() => Promise<void>)[] = [];
afterEach(async () => { await act(async () => { cleanup(); for (const finalize of finalizers.splice(0)) await finalize(); }); await Promise.all(directories.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
const connectionId = 'a'.repeat(64);
async function directory() { const dir = await mkdtemp(join(tmpdir(), 'flow-tui01a-')); directories.push(dir); return dir; }
test('private intent survives reopen, blocks a second owner and is cleared atomically', async () => {
  const dir = await directory(); const store = await openIntentStore(dir, connectionId); finalizers.push(() => store.close());
  const intent: Intent = { version: 1, connectionId, key: randomUUID(), kind: 'create', input: { title: 'Frozen', harness: 'claude', requested: { model: 'runner-default', thinking: 'disabled', tools: 'configured-readonly' } } };
  await store.save(intent); await expect(openIntentStore(dir, connectionId)).rejects.toThrow();
  for (const file of await readdir(dir)) expect((await lstat(join(dir, file))).mode & 0o077).toBe(0);
  await store.close(); const reopened = await openIntentStore(dir, connectionId); finalizers.push(() => reopened.close());
  expect(await reopened.load()).toEqual(intent); await reopened.clear(); expect(await reopened.load()).toBeNull();
});
function controller() {
  const client = { conversations: async () => ({ conversations: [], nextCursor: null }) } as unknown as InteractionClient;
  const value = createInteractionController({ client, connectionId, intents: { load: async () => null, save: async () => {}, clear: async () => {} } });
  finalizers.push(() => value.dispose()); return value;
}
test('headless commands use the shared handler and quit without executing provider work', async () => {
  const value = controller(); await value.initialize(); let output = '';
  await runHeadless(value, Readable.from(['{"type":"help"}\n{"type":"quit"}\n']), new Writable({ write(chunk, _encoding, callback) { output += chunk.toString(); callback(); } }));
  const responses = output.trim().split('\n').map(line => JSON.parse(line));
  expect(responses[0].result.code).toBe('HELP'); expect(responses[1].result.code).toBe('QUIT'); expect(value.snapshot().closed).toBe(true);
});
test('actual Ink and controlled TextInput render without a local assistant runtime', async () => {
  const value = controller(); await value.initialize();
  let terminal!: ReturnType<typeof render>;
  await act(async () => { terminal = render(React.createElement(TerminalScreen, { controller: value })); });
  await expect.poll(() => terminal.lastFrame()).toContain('Flow');
  await act(async () => { terminal.stdin.write('中文🙂'); }); await expect.poll(() => value.snapshot().draft).toBe('中文🙂');
  await act(async () => { terminal.stdin.write('\u007f'); }); await expect.poll(() => value.snapshot().draft).toBe('中文');
  await act(async () => { terminal.stdin.write('\u0003'); }); await expect.poll(() => value.snapshot().closed).toBe(true);
});

test('descriptor completion changes the controlled editor without adding a literal tab', async () => {
  const value = controller(); await value.initialize(); let terminal!: ReturnType<typeof render>;
  await act(async () => { terminal = render(React.createElement(TerminalScreen, { controller: value })); });
  await act(async () => { terminal.stdin.write('/pro'); });
  await act(async () => { terminal.stdin.write('\t'); });
  expect(value.snapshot().draft).toBe('/profiles ');
});
