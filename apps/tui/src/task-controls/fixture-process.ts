import assert from 'node:assert/strict';
import type { ChildProcess } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';

type Observation = { state: 'present' | 'absent' | 'unknown'; code: string | null };
type Failure = { phase: 'child' | 'signal' | 'group' | 'child-close'; code: string | null };
type Ports = {
  observe?: (pgid: number) => void;
  signal?: (pgid: number, signal: NodeJS.Signals) => void;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
  termMs?: number;
  reapMs?: number;
};
const safeCode = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException)?.code;
  return ['ESRCH', 'EPERM', 'EACCES', 'EINVAL', 'EINTR', 'EIO', 'ENOENT'].includes(code ?? '') ? code! : null;
};

/** One registered child session, not arbitrary PID ownership. Close and group absence are separate evidence. */
export function ownProcessGroup(child: ChildProcess, ports: Ports = {}) {
  const pgid = child.pid;
  assert(Number.isSafeInteger(pgid) && pgid! > 1);
  const observe = ports.observe ?? (id => { process.kill(-id, 0); });
  const send = ports.signal ?? ((id, action) => { process.kill(-id, action); });
  const now = ports.now ?? (() => performance.now()), wait = ports.wait ?? pause;
  const termMs = ports.termMs ?? 3000, reapMs = ports.reapMs ?? 1000;
  assert(Number.isFinite(termMs) && termMs > 0 && termMs <= 3000 && Number.isFinite(reapMs) && reapMs > 0 && reapMs <= 1000);
  let exited = child.exitCode !== null || child.signalCode !== null, closed = false, signalBlocked = false;
  let failure: Failure | null = null, firstUnknown: Observation | undefined;
  const observations: Observation[] = [], signals: NodeJS.Signals[] = [];
  child.once('exit', () => { exited = true; });
  child.once('close', () => { exited = true; closed = true; });
  child.on('error', error => { failure ??= { phase: 'child', code: safeCode(error) }; signalBlocked = true; });
  function state() {
    let observation: Observation;
    try { observe(pgid!); observation = { state: 'present', code: null }; }
    catch (error) {
      const code = safeCode(error);
      observation = { state: code === 'ESRCH' ? 'absent' : 'unknown', code };
      if (observation.state === 'unknown') { signalBlocked = true; firstUnknown ??= observation; }
    }
    if (observations.length < 8) observations.push(observation);
    else observations[7] = observation; // Retain the final observation within a fixed bound.
    return observation.state;
  }
  function signal(action: NodeJS.Signals) {
    // Node reaps its child before emitting exit. Never signal a potentially recycled group after that boundary.
    if (signalBlocked || exited || child.exitCode !== null || child.signalCode !== null || state() !== 'present') return;
    try { send(pgid!, action); signals.push(action); }
    catch (error) { if (safeCode(error) !== 'ESRCH') { failure ??= { phase: 'signal', code: safeCode(error) }; signalBlocked = true; } }
  }
  async function awaitClosure(deadline: number) {
    while (now() < deadline) {
      if (state() === 'absent' && closed) return;
      await wait(Math.min(25, Math.max(0, deadline - now())));
    }
  }
  async function settle() {
    const started = now(), deadline = started + termMs + reapMs;
    if (state() === 'present') signal('SIGTERM');
    await awaitClosure(started + termMs);
    if (!signalBlocked && !closed && state() === 'present') signal('SIGKILL');
    await awaitClosure(deadline);
    const finalState = state();
    if (finalState !== 'absent') failure ??= { phase: 'group', code: firstUnknown?.code ?? null };
    if (!closed) failure ??= { phase: 'child-close', code: null };
    return { pgid: pgid!, stopped: finalState === 'absent' && closed, signals: [...signals], observations: [...observations],
      child: { pid: pgid!, closed, exitCode: child.exitCode, signal: child.signalCode }, firstUnknown: firstUnknown ?? null, failure };
  }
  let settlement: ReturnType<typeof settle> | undefined;
  return { pgid: pgid!, stop: () => settlement ??= settle() };
}
