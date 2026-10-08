import type { HarnessAdapter, HarnessContext } from '@flow/contracts';

const phases = ['adapter', 'session', 'barrier', 'ownership', 'assistant-final', 'artifact', 'verification', 'runtime'] as const;
type Phase = typeof phases[number];
const notices = new Set(['connection-lost', 'ownership-lost', 'adapter-failed', 'events-retained', 'admission-blocked', 'recovery-waiting']);
const names = new Set(['Error', 'TypeError', 'FlowApiError', 'ZodError', 'AbortError', 'TimeoutError', 'EventStorageError', 'NativeExecutionError']);
const codes = new Set(['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EPIPE', 'ABORT_ERR', 'ENOSPC', 'EIO',
  'assistant_session_mismatch', 'assistant_identity', 'assistant_source_mismatch', 'assistant_conflict',
  'steering_final_unsealed', 'ownership_lost', 'attempt_conflict', 'invalid_request', 'unsupported_event']);
const maximumFrames = 64, maximumBytes = 32 * 1024;
type Identity = { taskId: string | null; attemptId: string | null; runnerId: string | null; ownerVersion: number | null };
type Frame = { sequence: number; elapsedMs: number; phase: Phase; state: 'start' | 'settled' | 'failed' | 'notice';
  identity: Identity; error?: { name: string | null; code: string | null; status: number | null }; notice?: string | null };

function field(value: unknown, key: string): unknown {
  try { return value !== null && typeof value === 'object' ? Reflect.get(value, key) : undefined; }
  catch { return undefined; }
}
function allowed(value: unknown, values: Set<string>): string | null {
  return typeof value === 'string' && values.has(value) ? value : null;
}
function identity(value: unknown): Identity {
  const id = (key: string) => {
    const item = field(value, key);
    return typeof item === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(item) ? item : null;
  };
  const version = field(value, 'ownerVersion');
  return { taskId: id('taskId'), attemptId: id('attemptId'), runnerId: id('runnerId'),
    ownerVersion: typeof version === 'number' && Number.isSafeInteger(version) && version > 0 ? version : null };
}
function safeError(error: unknown): NonNullable<Frame['error']> {
  const status = field(error, 'status');
  return { name: allowed(field(error, 'name'), names),
    code: allowed(field(error, 'code'), codes) ?? allowed(field(field(error, 'cause'), 'code'), codes),
    status: typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null };
}

/** Fixture-only observations. No I/O, retries, cancellation, or lifecycle authority. */
export class FixtureObservation {
  private readonly started = performance.now();
  private readonly frames: Frame[] = [];
  private bytes = 0;
  private incomplete = false;

  private append(phase: Phase, state: Frame['state'], execution: unknown, detail: Pick<Frame, 'error' | 'notice'> = {}) {
    try {
      if (!phases.includes(phase)) { this.incomplete = true; return; }
      const frame: Frame = { sequence: this.frames.length + 1, elapsedMs: Math.floor(performance.now() - this.started),
        phase, state, identity: identity(execution), ...detail };
      const bytes = Buffer.byteLength(JSON.stringify(frame)) + 1;
      if (this.frames.length >= maximumFrames || this.bytes + bytes > maximumBytes - 256) { this.incomplete = true; return; }
      this.frames.push(frame); this.bytes += bytes;
    } catch { this.incomplete = true; } // Diagnostic failures cannot replace an operation's result.
  }

  async run<T>(phase: Phase, execution: unknown, operation: () => Promise<T>): Promise<T> {
    this.append(phase, 'start', execution);
    try {
      const value = await operation(); this.append(phase, 'settled', execution); return value;
    } catch (error) {
      this.append(phase, 'failed', execution, { error: safeError(error) }); throw error;
    }
  }

  notice(value: unknown) {
    this.append('runtime', 'notice', value, { notice: allowed(field(value, 'type'), notices) });
  }

  snapshot() {
    return { incomplete: this.incomplete, maximumFrames, maximumBytes, runtimeFinalization: 'NOT_OBSERVED' as const,
      frames: this.frames.map(frame => ({ ...frame, identity: { ...frame.identity }, ...(frame.error ? { error: { ...frame.error } } : {}) })) };
  }
}

/** The fixture's adapter consumes the same wrapper as the pure fault-injection tests. */
export function observeFixtureAdapter(adapter: HarnessAdapter, observation: FixtureObservation): HarnessAdapter {
  return { ...adapter, run(context) {
    const execution = context.executionIdentity;
    const observed: HarnessContext = { ...context,
      emit(data) {
        if (!['session', 'assistant-final', 'artifact', 'verification'].includes(data.type)) return context.emit(data);
        return observation.run(data.type as Phase, execution, () => context.emit(data));
      },
      assertOwnership: () => observation.run('ownership', execution, () => context.assertOwnership()),
    };
    return observation.run('adapter', execution, () => adapter.run(observed));
  } };
}
