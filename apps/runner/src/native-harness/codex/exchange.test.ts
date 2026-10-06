import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createCodexTransport } from '../../codex/index.js';
import type { CodexTransport } from '../../codex/types.js';
import { runOrdinaryCodexTurn } from './turn.js';

it('keeps the extracted ordinary consumer on one receive pump and closes its owned JSONL peer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'flow-eng01g-exchange-'));
  let peer: CodexTransport | undefined, active = 0, peak = 0, calls = 0;
  try {
    const final = await runOrdinaryCodexTurn({ harness: 'codex', adapterVersion: 'codex-app-server-0.154.0-v1', model: 'synthetic-model', reasoningEffort: null,
      serviceTier: null, serviceTierForTurn: 'default', access: 'none', approvalPolicy: 'never', sandboxMode: 'read-only', hostLimits: { wallTimeMs: 2000, maxOutputBytes: 1024 } },
    options => {
      peer = createCodexTransport({ spawn: { executable: process.execPath, args: [fileURLToPath(new URL('./peer.mjs', import.meta.url)), 'success'], cwd: directory, environment: { LANG: 'C' } },
        initialize: { clientInfo: { name: 'eng01g-peer', title: null, version: '1' }, capabilities: null }, signal: options.signal, limits: { terminateMs: 50, killMs: 50 } });
      const port = peer; return { ...port, async receive() { calls++; active++; peak = Math.max(peak, active); try { return await port.receive(); } finally { active--; } } };
    }, { prompt: 'Ordinary input', workingDirectory: directory, signal: new AbortController().signal, async assertOwnership() {} });
    expect(final.settings.actualExecution.evidence).toBe('unknown'); expect(final.content).toBe('Native peer result 中文🙂');
    expect(peak).toBe(1); expect(calls).toBeGreaterThan(1); expect(active).toBe(0);
    expect(peer!.snapshot().state).toBe('closed');
  } finally { if (peer) expect((await peer.close()).child).toBe('confirmed-exited'); await rm(directory, { recursive: true, force: true }); }
});
