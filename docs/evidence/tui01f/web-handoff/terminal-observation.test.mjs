import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { observeTerminal } from '../../../../experiments/tui-web-control-handoff/journey.ts';

await test('actual ENOENT spawn fails the held-request race and retains its reason', async () => {
  const child = spawn('/flow-nonexistent-tui01f-executable', [], { stdio: ['pipe', 'pipe', 'pipe'] });
  const terminal = observeTerminal(child, async () => ({ stopped: true }), []);
  await assert.rejects(Promise.race([new Promise(() => {}), terminal.failed]), { code: 'ENOENT' });
  const report = await terminal.settle();
  assert.equal(report.failure.stage, 'terminal-spawn'); assert.equal(report.failure.code, 'ENOENT');
  assert.equal(report.pipesClosed, true); assert.equal(child.pid, undefined);
});

await test('shutdown-only failure is drained into the final report without replacing the primary error', async () => {
  const child = new EventEmitter(); Object.assign(child, { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  const terminal = observeTerminal(child, async () => {
    child.stdout.write(JSON.stringify({ phase: 'failure', error: { stage: 'terminal-render', name: 'RuntimeError',
      message: 'marker missing synthetic-private-token' }, result: { transcript: 'rendered synthetic-private-token' } }) + '\n');
    child.stderr.write('shutdown secondary synthetic-private-token');
    child.emit('close', 1, null); return { stopped: true };
  }, ['synthetic-private-token']);
  assert.deepEqual(terminal.report().events, []);
  const final = await terminal.settle();
  assert.equal(final.events[0].result.transcript, 'rendered [redacted]');
  assert.equal(final.failure.stage, 'terminal-render'); assert.equal(final.pipesClosed, true);
  assert.equal(final.stderr, 'shutdown secondary [redacted]');
  assert.equal(final.settled.stopped, true); assert.deepEqual(final.cleanupFailures, []);
  assert(!JSON.stringify(final).includes('synthetic-private-token'));
});
