/** Existing host seam only. No top-level execution, CLI, sampler spawn or run permission. */
import { prepareTrustedToolHost, TrustedToolHostPreparationError } from '../../../docs/evidence/s01/native-initialize/fixed-source/apps/runner/src/engineering/native-tool-host.js';
import type { CodexTransport } from '../../../docs/evidence/s01/native-initialize/fixed-source/apps/runner/src/codex/types.js';
import type { Instance } from './sequence.js';
type Options = Parameters<typeof prepareTrustedToolHost>[0];
type Host = Awaited<ReturnType<typeof prepareTrustedToolHost>>;
export function trustedInstance(options: Omit<Options, 'signal'>, ownership: {
  // Trusted owned-tree observer, never a default true or a direct-PID replacement.
  registered(pid: number): void;
  closed(): Promise<boolean>;
}): Instance {
  let pending: Promise<Host> | undefined, host: Host | undefined;
  let failed: TrustedToolHostPreparationError | undefined, transport: CodexTransport | undefined;
  let started = false;
  return {
    async start(signal) {
      if (started) throw Error('START_CONSUMED'); started = true;
      pending = prepareTrustedToolHost({ ...options, signal });
      try {
        host = await pending;
        signal.throwIfAborted();
        transport = host.createTransport({ workingDirectory: options.directory, signal });
        const pid = transport.snapshot().pid;
        if (pid === null) throw Error('PID_UNKNOWN');
        ownership.registered(pid);
        await transport.ready;
        signal.throwIfAborted();
      } catch (error) { if (error instanceof TrustedToolHostPreparationError) failed = error; throw error; }
    },
    async close(signal) {
      if (!started) return { exited: true, eof: true, hostWriteSettled: true, membersClosed: true };
      // Wait for the actual prepare operation; the sequence's absolute close observation may expire.
      try { if (pending) host ??= await pending; } catch (error) {
        if (error instanceof TrustedToolHostPreparationError) failed = error;
      }
      const cleanup = await (host ?? failed)?.close(signal);
      const closed = cleanup?.child === 'confirmed-exited' && transport ? await transport.closed : undefined;
      const capture = closed?.stderrCapture;
      return {
        exited: cleanup?.child === 'confirmed-exited' || cleanup?.child === 'not-started',
        eof: !transport ? cleanup?.child === 'not-started' : Boolean(capture?.streamEnded && capture.childCloseObserved
          && !capture.incomplete && !capture.observerFailed && !capture.truncated && capture.observedBytes === capture.writtenBytes),
        hostWriteSettled: cleanup?.hostWrite === 'settled',
        membersClosed: await ownership.closed(),
      };
    },
  };
}

import { spawn } from 'node:child_process';
import { constants, openSync, closeSync, fstatSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createSampleLedger, compareSamples, type Sample } from './snapshot.js';
import { runStages, realClock, type Clock, type Ports } from './sequence.js';

interface SamplerBinding { path: string; bytes: number; sha256: string }
/** Bounded single-flight private channel, no subprocess signalling or ownership inference. */
function samplerChannel(binding: SamplerBinding, signal: AbortSignal) {
  signal.throwIfAborted();
  if (!Number.isSafeInteger(binding.bytes) || binding.bytes < 1 || binding.bytes > 131072) throw Error('SAMPLER_BYTES');
  const fd = openSync(binding.path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size !== binding.bytes || createHash('sha256').update(readFileSync(fd)).digest('hex') !== binding.sha256)
      throw Error('SAMPLER_BINDING');
  } finally { closeSync(fd); }
  const child = spawn(binding.path, [], { env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' }, stdio: ['pipe','pipe','pipe'] });
  const ledger = createSampleLedger();
  const frames: { stage: number; header: unknown; rows: readonly unknown[] }[] = [];
  let buffer = '', total = 0, fault: string | null = null, stdoutEof = false, stderrEof = false;
  let active: { stage: number; header?: unknown; count: number; rows: unknown[]; resolve(value: Sample): void; reject(error: Error): void; dispose(): void } | undefined;
  const fail = (code: string) => { fault ??= code; const pending = active; active = undefined; pending?.dispose(); pending?.reject(Error(code)); };
  child.on('error', () => fail('SAMPLER_SPAWN'));
  child.stdin.on('error', () => fail('SAMPLER_WRITE'));
  child.stderr.on('data', chunk => { total += chunk.length; fail('SAMPLER_STDERR'); });
  child.stderr.on('end', () => { stderrEof = true; });
  child.stdout.on('end', () => { stdoutEof = true; if (active || buffer.length) fail('SAMPLER_TRUNCATED'); });
  child.stdout.on('data', (chunk: Buffer) => {
    total += chunk.length;
    if (total > 524288 || !chunk.every(byte => byte < 128)) { fail('SAMPLER_OUTPUT'); return; }
    buffer += chunk.toString('ascii');
    if (buffer.length > 16384) { fail('SAMPLER_BUFFER'); buffer = ''; return; }
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      const pending = active;
      if (!pending || line.length > 256) { fail('SAMPLER_EXTRA'); return; }
      try {
        const value: unknown = JSON.parse(line);
        if (pending.header === undefined) {
          const count = (value as { count?: unknown })?.count;
          if (!Number.isInteger(count) || (count as number) < 1 || (count as number) > 32) throw Error();
          pending.header = value; pending.count = count as number;
        } else pending.rows.push(value);
        if (pending.rows.length === pending.count) {
          const sample = ledger.accept(pending.header, pending.rows, pending.stage);
          frames.push({ stage: pending.stage, header: pending.header, rows: pending.rows });
          active = undefined; pending.dispose(); pending.resolve(sample);
        }
      } catch { fail('SAMPLER_DECODE'); return; }
    }
  });
  let closePromise: Promise<{ known: boolean; pid: number | null; stdoutEof: boolean; stderrEof: boolean; fault: string | null; code: number | null; signal: NodeJS.Signals | null; samples: ReturnType<typeof ledger.facts>; frames: typeof frames; bytes: number }> | undefined;
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
    child.once('close', (code, exitSignal) => { if (active) fail('SAMPLER_CLOSED'); resolve({ code, signal: exitSignal }); });
  });
  const cancel = () => { fail('SAMPLER_CANCELLED'); child.stdin.end(); };
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  return {
    sample(stage: number, phase: AbortSignal): Promise<Sample> {
      if (active || fault || phase.aborted) return Promise.reject(Error('SAMPLER_UNAVAILABLE'));
      return new Promise((resolve, reject) => {
        const stop = () => fail('SAMPLER_CANCELLED');
        active = { stage, count: -1, rows: [], resolve, reject, dispose: () => phase.removeEventListener('abort', stop) };
        phase.addEventListener('abort', stop, { once: true });
        if (phase.aborted) { stop(); return; }
        child.stdin.write('sample\n', error => { if (error) fail('SAMPLER_WRITE'); });
      });
    },
    close() {
      closePromise ??= (async () => {
        child.stdin.end(); const result = await exited; signal.removeEventListener('abort', cancel);
        return { known: result.code === 0 && result.signal === null && !fault && stdoutEof && stderrEof && !active && !buffer,
          pid: child.pid ?? null, stdoutEof, stderrEof, fault, ...result, samples: ledger.facts(), frames, bytes: total };
      })();
      return closePromise;
    },
  };
}
function pause(clock: Clock, deadline: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const aborted = () => { clear(); reject(Error('CANCELLED')); };
    const clear = clock.alarm(deadline, () => { signal.removeEventListener('abort', aborted); resolve(); });
    signal.addEventListener('abort', aborted, { once: true }); if (signal.aborted) aborted();
  });
}
/** Caller supplies already owned paths/binding, byte inventory and identity-safe cleanup.
 * No real runtime caller/admission is provided by this preparation. */
export async function runStockBaseline(input: {
  sampler: SamplerBinding; originMs: number; signal: AbortSignal;
  slots(level: number): readonly Omit<Options, 'signal'>[];
  bytes: Ports['bytes']; cleanup: Ports['cleanup'];
  // Must confirm all owned descendants for the native instance, not just its direct PID.
  membersClosed(pid: number | null): Promise<boolean>;
}, clock: Clock = realClock) {
  if (!Number.isFinite(input.originMs) || clock.now() < input.originMs || clock.now() > input.originMs + 10_000) throw Error('PREFLIGHT_TIME');
  input.signal.throwIfAborted();
  const closing = new AbortController();
  const combined = AbortSignal.any([input.signal, closing.signal]);
  const sampler = samplerChannel(input.sampler, combined);
  const stopAtDeadline = clock.alarm(input.originMs + 70_000, () => closing.abort());
  const measurements: { level: number; intervals: ReturnType<typeof compareSamples>[] }[] = [];
  let expected: number[] = [], samplerClose: Awaited<ReturnType<typeof sampler.close>> | undefined;
  try {
    const result = await runStages({
      allocate(level) {
        const slots = input.slots(level); if (slots.length !== level) throw Error('SLOT_COUNT'); expected = [];
        const paths = slots.flatMap(slot => [slot.directory, slot.runtimeDirectory]);
        if (new Set(paths).size !== paths.length) throw Error('SHARED_PATH');
        return slots.map(slot => { let pid: number | null = null; return trustedInstance(slot, {
          registered(value) { pid = value; expected.push(value); }, closed: () => input.membersClosed(pid),
        }); });
      },
      async observe(level, duration, phase) {
        const began = clock.now(); let previous = await sampler.sample(level, phase);
        const intervals: ReturnType<typeof compareSamples>[] = []; measurements.push({ level, intervals });
        if (expected.length !== level || !expected.every(pid => previous.members.some(member => member.pid === pid))) return { known: false };
        for (let i = 1; i <= 8; i++) {
          await pause(clock, began + i * duration / 8, phase);
          const next = await sampler.sample(level, phase);
          const comparison = compareSamples(previous, next); intervals.push(comparison);
          if (!comparison.known) return { known: false };
          previous = next;
        }
        return { known: true };
      },
      bytes: input.bytes, cleanup: input.cleanup,
    }, input.originMs, input.signal, clock);
    // Child close must also settle before the common whole-run deadline; outer OPS14 remains authority.
    const remaining = input.originMs + 70_000 - clock.now();
    if (remaining <= 0) closing.abort();
    const timeout = new Promise<undefined>(resolve => {
      const clear = clock.alarm(input.originMs + 70_000, () => { closing.abort(); resolve(undefined); });
      void sampler.close().then(value => { samplerClose = value; clear(); resolve(undefined); }, () => { clear(); resolve(undefined); });
    });
    await timeout;
    return { ...result, known: result.known && samplerClose?.known === true && clock.now() < input.originMs + 70_000,
      sampler: samplerClose ?? { known: false, fault: 'CLOSE_UNKNOWN' }, measurements, nativeWriteAccess: 'unknown' as const };
  } finally { stopAtDeadline(); closing.abort(); void sampler.close().catch(() => {}); }
}
