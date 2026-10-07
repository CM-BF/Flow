export interface ConnectionRow { pid: number; state: string | null }
export interface ConnectionObservation { elapsedMs: number; rows?: ConnectionRow[]; errorCode?: string }
export interface ConnectionCheck { state: 'empty' | 'busy' | 'unknown'; observations: ConnectionObservation[] }

function errorCode(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? code : 'UNKNOWN';
}
async function queryBeforeDeadline(query: () => Promise<ConnectionRow[]>, remainingMs: number) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([query(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Object.assign(Error('Connection observation deadline'), { code: 'OBSERVATION_TIMEOUT' })), remainingMs);
    })]);
  } finally { clearTimeout(timer); }
}
/** Test-only resource observation; never terminates a database consumer. */
export async function observeConnections(query: () => Promise<ConnectionRow[]>,
  clock = { now: () => performance.now(), wait: (ms: number) => new Promise<void>(done => setTimeout(done, ms)) }): Promise<ConnectionCheck> {
  const start = clock.now(), observations: ConnectionObservation[] = [];
  // A monotonic deadline and sample cap bound both elapsed time and retained evidence.
  for (let sample = 0; sample < 60; sample++) {
    const remaining = 3000 - (clock.now() - start);
    if (remaining <= 0) break;
    try {
      const rows = await queryBeforeDeadline(query, remaining);
      if (rows.length > 32 || rows.some(row => !Number.isSafeInteger(row.pid) || row.pid <= 0
        || !(row.state === null || typeof row.state === 'string' && row.state.length <= 64))) {
        throw Object.assign(Error('Invalid connection observation'), { code: 'INVALID_OBSERVATION' });
      }
      observations.push({ elapsedMs: clock.now() - start, rows: rows.map(row => ({ pid: row.pid, state: row.state })) });
      if (clock.now() - start >= 3000) return { state: 'unknown', observations };
      if (!rows.length) return { state: 'empty', observations };
    } catch (error) {
      observations.push({ elapsedMs: clock.now() - start, errorCode: errorCode(error) });
      return { state: 'unknown', observations };
    }
    await clock.wait(Math.min(50, Math.max(0, 3000 - (clock.now() - start))));
  }
  return { state: 'busy', observations };
}

export interface DirectoryIdentity { dev: number; ino: number; directory: boolean; symbolicLink: boolean }
interface CleanupPorts {
  checkpoint(): Promise<unknown>;
  removeDatabase(): Promise<unknown>;
  readDirectory(): Promise<DirectoryIdentity>;
  removeDirectory(): Promise<unknown>;
}
export interface RetainedCleanup {
  checkpointConfirmed: boolean;
  databaseRemoved: boolean;
  temporaryRemoved: boolean;
  directoryObservation: DirectoryIdentity | null;
  failures: string[];
}
/** Test-only destructive gate: failed persistence never permits DB/tmp deletion. */
export async function cleanupAfterCheckpoint(ports: CleanupPorts, mayRemove: boolean,
  originalDirectory: DirectoryIdentity | undefined): Promise<RetainedCleanup> {
  const result: RetainedCleanup = { checkpointConfirmed: false, databaseRemoved: false, temporaryRemoved: false, directoryObservation: null, failures: [] };
  try { await ports.checkpoint(); result.checkpointConfirmed = true; }
  catch (error) { result.failures.push(`checkpoint:${errorCode(error)}`); return result; }
  if (!mayRemove) return result;
  // Missing original identity is uncertainty, never permission to learn a replacement.
  if (!originalDirectory?.directory || originalDirectory.symbolicLink) {
    result.failures.push('directory:ORIGINAL_IDENTITY_UNKNOWN'); return result;
  }
  try { await ports.removeDatabase(); result.databaseRemoved = true; }
  catch (error) { result.failures.push(`database:${errorCode(error)}`); return result; }
  try {
    const current = await ports.readDirectory(); result.directoryObservation = current;
    if (!current.directory || current.symbolicLink || current.dev !== originalDirectory.dev || current.ino !== originalDirectory.ino) {
      result.failures.push('directory:IDENTITY_MISMATCH'); return result;
    }
    await ports.removeDirectory(); result.temporaryRemoved = true;
  } catch (error) { result.failures.push(`directory:${errorCode(error)}`); }
  return result;
}
