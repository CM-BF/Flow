/** Bounded startup observations only; this module owns no application resource. */
export const STARTUP_MIGRATIONS = [
  'migrate', 'migrateWorkspace', 'migrateProjects', 'migrateProtocolDispatch', 'migrateGoals',
  'migrateConversations', 'migratePlugins', 'migrateAssistantMessages', 'migrateExecutionProfiles',
  'migrateConversationQueue', 'migrateGoalToolRuns', 'migrateGoalGraphProposals', 'migrateKnowledge',
  'migrateRunnerMaintenance', 'migrateConversationContext', 'migrateGoalGraphRuns', 'migrateNativeActivities',
  'migrateGoalContext', 'migrateAssistantStreams', 'migratePackageFetches', 'migrateActiveSteering',
  'migrateNativeHarnessSources', 'migrateAttachments', 'migrateContextObservationHistory',
  'migrateBrowserSessions', 'migratePluginInstallations', 'migratePluginRuntime', 'migrateGoalProgressions',
  'migrateGoalPlanConfirmations', 'migrateClaudeMessageSettings', 'migrateNativeActivityBodies',
] as const;
const phases = [...STARTUP_MIGRATIONS, 'main', 'configuration', 'authentication', 'cors',
  'scheduler', 'routes', 'ready-conversation', 'ready-goal', 'listen'] as const;
export type StartupPhase = typeof phases[number];
export type StartupEvent = { phase: StartupPhase; event: 'point' | 'enter' | 'settled' | 'error'; error?: unknown };
export type StartupObserver = (event: StartupEvent) => void;
export const STARTUP_PROGRESS_LIMITS = Object.freeze({ frames: 128, bytes: 8192 });
export const STARTUP_PROGRESS_PREFIX = '@flow-startup ';
type IncompleteReason = 'frame-limit' | 'byte-limit' | 'write-error' | 'backpressure' | 'clock-invalid' | 'invalid-event' | 'phase-open';
export interface StartupProgressSummary {
  state: 'disabled' | 'complete' | 'incomplete'; frames: number; bytes: number;
  reason?: IncompleteReason;
}
const errorNames = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'AggregateError', 'DatabaseError', 'error']);
const errorCodes = new Set(['EADDRINUSE', 'EACCES', 'EPERM', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
  'ENOTFOUND', 'EPIPE', 'ENOENT', 'EIO', 'ENOSPC', 'EMFILE', 'ENFILE']);
function safeError(error: unknown): { n: string; c: string | null } {
  try {
    const value = error as { name?: unknown; code?: unknown } | null;
    const name = value?.name, code = value?.code;
    return { n: typeof name === 'string' && errorNames.has(name) ? name : 'Unknown',
      c: typeof code === 'string' && (errorCodes.has(code) || /^[0-9A-Z]{5}$/.test(code)) ? code : null };
  } catch { return { n: 'Unknown', c: null }; }
}

/** Observer failures cannot prevent an operation or replace its exact thrown value. */
export async function withStartupPhase<T>(observer: StartupObserver | undefined, phase: StartupPhase, operation: () => T | Promise<T>): Promise<T> {
  const report = (event: StartupEvent['event'], error?: unknown) => {
    try { observer?.({ phase, event, ...(event === 'error' ? { error } : {}) }); } catch { /* Observation has no lifecycle authority. */ }
  };
  report('enter');
  try { const result = await operation(); report('settled'); return result; }
  catch (error) { report('error', error); throw error; }
}

/**
 * write must be synchronous/non-blocking (for example stderr.write), not a filesystem owner.
 * A complete footer means this bounded stream closed, not that every expected phase ran.
 * Missing footer, write failure or partial capture remains incomplete at the consumer.
 */
export function createStartupProgress(options: {
  enabled: boolean; write: (frame: string) => boolean | void; now?: () => number;
}): { observe: StartupObserver; finish: (outcome: 'listening' | 'failed') => StartupProgressSummary } {
  const now = options.now ?? (() => performance.now());
  const pending = new Set<StartupPhase>();
  let frames = 0, bytes = 0, elapsed = 0, origin: number | undefined, lastTime: number | undefined;
  let closed = !options.enabled, reason: IncompleteReason | undefined;
  const summary = (): StartupProgressSummary => ({ state: !options.enabled ? 'disabled' : reason ? 'incomplete' : 'complete',
    frames, bytes, ...(reason ? { reason } : {}) });
  const clock = () => {
    const value = now();
    if (!Number.isFinite(value) || value < 0 || (lastTime !== undefined && value < lastTime)) throw Error();
    lastTime = value;
    origin ??= value;
    elapsed = Math.min(2_147_483_647, Math.floor(value - origin));
    return elapsed;
  };
  const line = (fields: object) => STARTUP_PROGRESS_PREFIX + JSON.stringify({ v: 1, s: frames + 1, ms: elapsed, ...fields }) + '\n';
  const write = (frame: string) => {
    // Count offered bytes conservatively: a sink may accept them and then throw or backpressure.
    frames++; bytes += Buffer.byteLength(frame);
    try { if (options.write(frame) === false) { reason = 'backpressure'; closed = true; } }
    catch { reason = 'write-error'; closed = true; }
  };
  const incomplete = (cause: IncompleteReason) => {
    reason = cause; closed = true;
    const frame = line({ e: 'incomplete', why: cause });
    if (frames < STARTUP_PROGRESS_LIMITS.frames && bytes + Buffer.byteLength(frame) <= STARTUP_PROGRESS_LIMITS.bytes) write(frame);
  };
  const observe: StartupObserver = event => {
    if (closed) return;
    try {
      if (!phases.includes(event.phase) || !['point', 'enter', 'settled', 'error'].includes(event.event)
        || event.event === 'enter' && pending.has(event.phase)
        || (event.event === 'settled' || event.event === 'error') && !pending.has(event.phase)) { incomplete('invalid-event'); return; }
      try { clock(); } catch { incomplete('clock-invalid'); return; }
      const frame = line({ p: event.phase, e: event.event, ...(event.event === 'error' ? safeError(event.error) : {}) });
      // Reserve one frame and 256 bytes for an explicit complete/incomplete footer.
      if (frames + 1 >= STARTUP_PROGRESS_LIMITS.frames) { incomplete('frame-limit'); return; }
      if (bytes + Buffer.byteLength(frame) > STARTUP_PROGRESS_LIMITS.bytes - 256) { incomplete('byte-limit'); return; }
      if (event.event === 'enter') pending.add(event.phase);
      if (event.event === 'settled' || event.event === 'error') pending.delete(event.phase);
      write(frame);
    } catch { incomplete('invalid-event'); }
  };
  return { observe, finish(outcome) {
    if (closed) return summary();
    if (outcome !== 'listening' && outcome !== 'failed') { incomplete('invalid-event'); return summary(); }
    if (pending.size) { incomplete('phase-open'); return summary(); }
    try { clock(); } catch { incomplete('clock-invalid'); return summary(); }
    write(line({ e: 'complete', outcome })); closed = true;
    return summary();
  } };
}
