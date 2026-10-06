// One owned, detached command; no protocol, retry, queue, or agent loop.
import { spawn } from 'node:child_process';
import { createStderrCapture } from '../../../apps/runner/src/codex/stderr-capture.ts';

export function runOwnedCommand(options, budget, dependencies = {}) {
  const start = dependencies.spawn ?? spawn;
  const signal = dependencies.signal ?? ((pid, value) => process.kill(pid, value));
  return new Promise(resolve => {
    let child; let settled = false; let stopped = false; let closeObserved = false;
    let code = null; let terminationSignal = null; let reason = 'completed';
    const timers = []; const buffers = { stdout: [], stderr: [] };
    const captures = Object.fromEntries(['stdout', 'stderr'].map(name => [name, createStderrCapture({
      maxBytes: 65536, write(bytes) { budget.consume(bytes.length); buffers[name].push(bytes); },
    })]));
    const groupGone = () => {
      if (!child?.pid) return true;
      try { signal(-child.pid, 0); return false; } catch (error) { return error?.code === 'ESRCH'; }
    };
    const send = value => {
      if (!child?.pid) return;
      try { signal(-child.pid, value); } catch { /* Unknown is checked with groupGone; never expose OS errors. */ }
    };
    const finish = forced => {
      if (settled) return;
      settled = true;
      for (const timer of timers) clearTimeout(timer);
      if (forced) {
        for (const name of ['stdout', 'stderr']) { captures[name].error(); child?.[name]?.destroy(); }
        if (!closeObserved) child?.unref(); // Bounded observation cannot keep CLI alive through an unknown owned child.
      }
      child?.stdin?.destroy();
      const streams = Object.fromEntries(['stdout', 'stderr'].map(name => [name, captures[name].report(closeObserved)]));
      const pipes = options.stdio === 'pipe';
      resolve({ safe: { pid: child?.pid ?? null, reason, closeObserved, groupGone: groupGone(), code, signal: terminationSignal,
        streams: pipes ? streams : null }, stdout: Buffer.concat(buffers.stdout), stderr: Buffer.concat(buffers.stderr) });
    };
    const stop = why => {
      if (stopped || settled) return;
      stopped = true; reason = why; send('SIGTERM');
      timers.push(setTimeout(() => send('SIGKILL'), 250));
      timers.push(setTimeout(() => finish(true), 750));
    };
    try {
      child = start(options.executable, options.args, { cwd: options.cwd, env: options.environment,
        detached: true, stdio: options.stdio === 'pipe' ? ['pipe', 'pipe', 'pipe'] : options.stdio });
    } catch { reason = 'spawn-failed'; closeObserved = true; finish(false); return; }
    child.once('error', () => stop('spawn-error'));
    for (const name of ['stdout', 'stderr']) if (child[name]) {
      child[name].on('data', chunk => {
        if (settled) return;
        captures[name].push(chunk);
        const status = captures[name].report(false);
        if (status.truncated || status.observerFailed) stop('output-bound');
      });
      child[name].once('end', () => captures[name].end());
      child[name].once('error', () => { captures[name].error(); stop('stream-error'); });
    }
    child.once('close', (exitCode, exitSignal) => {
      closeObserved = true; code = exitCode; terminationSignal = exitSignal;
      if (groupGone()) finish(false); else stop('group-close-unconfirmed');
    });
    timers.push(setTimeout(() => stop('deadline'), options.timeoutMs));
  });
}
