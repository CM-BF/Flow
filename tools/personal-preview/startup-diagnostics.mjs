import { constants, writeSync, fsyncSync, fstatSync } from 'node:fs';
import { open, lstat, realpath, mkdir, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const STARTUP_STDERR_BYTES = 64 * 1024;
const roles = ['center', 'runner', 'web'];
const phases = ['configuration-ready', 'marker', 'policy', 'runtime', 'child-spawn', 'child-running', 'child-exit', 'startup-failed'];
const safeCodes = new Set([
  'RUNNER_SLOT_PROFILE_MISMATCH', 'RUNNER_SLOT_PROFILE_CHANGED', 'RUNNER_SLOT_CONFIGURATION_CHANGED',
  'RUNNER_SLOT_DIRECTORY_CHANGED', 'RUNNER_SLOT_REGISTRATION_UNKNOWN', 'RUNNER_SLOTS_RUNTIME_UNSUPPORTED',
  'RUNNER_SLOTS_ARTIFACT_REQUIRED', 'RUNNER_SLOT_FILE_CHANGED', 'RUNNER_SLOT_FILE_INVALID',
  'RUNNER_SLOT_CATALOG_LIMIT', 'RUNNER_SLOT_CATALOG_CHANGED', 'UNDECLARED_SERVICE_RECORD',
  'STARTUP_UNCONFIRMED', 'STARTUP_DIAGNOSTICS_UNAVAILABLE', 'SERVICE_EXITED_DURING_START', 'SERVICE_START_UNCONFIRMED',
  'SERVICE_NOT_OWNED', 'NATIVE_CONFIGURATION_CHANGED', 'RUNNER_IDENTITY_UNAVAILABLE', 'SOURCE_CHANGED_DURING_START',
  'CENTER_IDENTITY_UNCONFIRMED', 'CENTER_REQUEST_REJECTED', 'DATABASE_NOT_OWNED', 'DATABASE_IDENTITY_MISMATCH',
  'BACKEND_PRIVATE_STATE_INVALID', 'BACKEND_DESCRIPTOR_INVALID', 'BACKEND_MANIFEST_INVALID',
  'BACKEND_INSTALLATION_SOURCE_MISMATCH', 'BACKEND_HOST_VERSION_UNSUPPORTED', 'CONFIGURATION_IDENTITY_MISMATCH',
  'BROWSER_CONFIGURATION_INVALID', 'BROWSER_CONFIGURATION_CHANGED', 'WEB_COMPATIBILITY_REQUIRED',
  'WEB_COMPATIBILITY_INVALID', 'WEB_BACKEND_SOURCE_MISMATCH', 'PRIVATE_FILE_REQUIRED',
  'EACCES', 'EPERM', 'ENOENT', 'EEXIST', 'ENOSPC', 'EIO', 'ELOOP', 'EMFILE', 'ENFILE', 'ECONNREFUSED', 'ETIMEDOUT',
]);
export function startupErrorCode(error) { return safeCodes.has(error?.code) ? error.code : 'STARTUP_UNCONFIRMED'; }
export function startupFailure(error, role, phase, recordKey = role) {
  if (role === 'runner-settings') role = 'runner';
  return { ...(role === 'runner' && recordKey === 'runner-settings' ? { recordKey } : {}), role: roles.includes(role) ? role : null, phase: ['spawn', 'ready', 'final-verification', ...phases].includes(phase) ? phase : 'unknown', code: startupErrorCode(error), at: new Date().toISOString() };
}
export function publicStartupFailure(value) {
  if (!value) return null;
  const safe = startupFailure({ code: value.code }, value.role, value.phase, value.recordKey ?? value.role);
  return { ...safe, at: /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.at ?? '') ? value.at : null };
}

/** Persist the primary before cleanup; neither cleanup nor evidence errors replace it. */
export async function preserveStartupFailure({ state, error, role, phase, stop, save }) {
  state.lastError = 'START_UNCONFIRMED';
  state.lastStartFailure = startupFailure(error, role, phase);
  state.startCleanup = [];
  state.startEvidenceErrors = [];
  const persist = async () => {
    try { await save(state); } catch (writeError) { state.startEvidenceErrors.push(startupErrorCode(writeError)); }
  };
  await persist();
  for (const [ownedRole, record] of Object.entries(state.processes).reverse()) {
    try { state.startCleanup.push({ role: ownedRole, state: await stop(record) }); }
    catch (cleanupError) { state.startCleanup.push({ role: ownedRole, state: 'unknown', code: startupErrorCode(cleanupError) }); }
  }
  await persist();
  return state.lastStartFailure;
}

function fail() { throw Object.assign(new Error('Private startup evidence is unavailable.'), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' }); }
function sameIdentity(a, b) { return a.dev === b.dev && a.ino === b.ino; }
function privateFile(info, maximum) {
  if (!info.isFile() || info.uid !== BigInt(process.getuid()) || info.nlink !== 1n || (info.mode & 0o777n) !== 0o600n || info.size > BigInt(maximum)) fail();
}
async function privateDirectory(path) {
  const info = await lstat(path, { bigint: true });
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== BigInt(process.getuid()) || (info.mode & 0o777n) !== 0o700n || await realpath(path) !== path) fail();
  return info;
}
async function syncDirectory(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { await file.sync(); } finally { await file.close(); }
}

/** One nonce owns one bounded private record and stderr file; this module never signals a process. */
export async function openStartupDiagnostics({ directory, role, recordKey = role, nonce, pid }) {
  if (!roles.includes(role) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(nonce ?? '') || !Number.isSafeInteger(pid) || pid < 2) fail();
  if (recordKey !== role && !(role === 'runner' && recordKey === 'runner-settings')) fail();
  if (recordKey === 'runner-settings') {
    const { readRunnerSlots } = await import('./runner-slots.mjs');
    const file = await open(join(directory, 'config.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
    let config;
    try { privateFile(await file.stat({ bigint: true }), 65536); config = JSON.parse(await file.readFile('utf8')); } finally { await file.close(); }
    if (config.directory !== directory) fail();
    if (!(await readRunnerSlots(config)).some(slot => slot.key === recordKey)) fail();
  }
  const installation = await privateDirectory(directory);
  const parent = join(directory, 'startup-diagnostics');
  try { await mkdir(parent, { mode: 0o700 }); await syncDirectory(directory); } catch (error) { if (error.code !== 'EEXIST') throw error; }
  const identity = await privateDirectory(parent);
  const stem = join(parent, `${recordKey}-${nonce}`);
  const output = await open(`${stem}.stderr`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  let stream, retained = 0, observed = 0, writeError, closed = false, runtimeInitialized;
  let writes = Promise.resolve();
  const digest = createHash('sha256');
  async function checkIdentity() {
    const current = await privateDirectory(directory), child = await privateDirectory(parent);
    if (!sameIdentity(current, installation) || !sameIdentity(child, identity)) fail();
    const file = await open(join(directory, 'state.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const info = await file.stat({ bigint: true }); privateFile(info, 65536);
      const bytes = Buffer.alloc(65537); let size = 0;
      while (size < bytes.length) { const part = await file.read(bytes, size, bytes.length - size, size); if (!part.bytesRead) break; size += part.bytesRead; }
      const after = await file.stat({ bigint: true }); privateFile(after, 65536);
      if (!sameIdentity(after, await lstat(join(directory, 'state.json'), { bigint: true }))) fail();
      if (size !== Number(info.size) || !sameIdentity(info, after) || info.mtimeNs !== after.mtimeNs || info.size !== after.size) fail();
      const state = JSON.parse(bytes.subarray(0, size).toString('utf8'));
      if (state.processes?.[recordKey]?.nonce !== nonce || state.processes[recordKey].pid !== pid) fail();
    } finally { await file.close(); }
  }
  async function persist(phase, detail) {
    if (!phases.includes(phase)) fail();
    await checkIdentity();
    const value = { format: 1, role, ...(recordKey === role ? {} : { recordKey }), nonce, pid, phase, at: new Date().toISOString(), ...detail,
      ...(runtimeInitialized ? { runtimeInitialized } : {}) };
    try { privateFile(await lstat(`${stem}.json`, { bigint: true }), 4096); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const temporary = `${stem}.${randomUUID()}.tmp`;
    const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await file.writeFile(JSON.stringify(value) + '\n'); await file.sync(); } finally { await file.close(); }
    await rename(temporary, `${stem}.json`); await syncDirectory(parent);
  }
  function record(phase, detail = {}) {
    writes = writes.then(() => persist(phase, detail));
    return writes;
  }
  const streamError = error => { writeError ??= startupErrorCode(error); };
  const consume = bytes => {
    observed = Math.min(Number.MAX_SAFE_INTEGER, observed + bytes.length);
    if (writeError || closed || retained === STARTUP_STDERR_BYTES) return;
    const part = bytes.subarray(0, STARTUP_STDERR_BYTES - retained);
    try {
      privateFile(fstatSync(output.fd, { bigint: true }), STARTUP_STDERR_BYTES);
      let offset = 0;
      while (offset < part.length) {
        const count = writeSync(output.fd, part, offset, part.length - offset); if (count < 1) fail();
        digest.update(part.subarray(offset, offset + count)); offset += count; retained += count;
      }
    } catch (error) { streamError(error); }
  };
  try { privateFile(await output.stat({ bigint: true }), STARTUP_STDERR_BYTES); await record('configuration-ready'); }
  catch (error) { await output.close(); throw error; }
  return {
    stage: phase => record(phase),
    async initialized(childPid, runnerId) {
      if (closed || role !== 'runner' || runtimeInitialized || !Number.isSafeInteger(childPid) || childPid < 2
        || typeof runnerId !== 'string' || runnerId.length < 1 || runnerId.length > 256) fail();
      // Publish only after the record and its directory are durable. Any failed write/sync leaves
      // this bounded marker, so even a renamed-but-unconfirmed positive record is not readiness.
      const pending = await open(`${stem}.initializing`, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await pending.sync(); } finally { await pending.close(); }
      runtimeInitialized = { protocol: 'flow.runner-startup.v1', childPid, runnerId };
      await record('child-running');
      // This is the final publication operation. A crash can retain the marker, conservatively.
      await unlink(`${stem}.initializing`);
    },
    capture(stderr) {
      if (stream || closed || !stderr) fail(); stream = stderr;
      stream.on('data', consume); // Beyond 64KiB, drain without retaining or queuing any further chunks.
      stream.on('error', streamError);
    },
    async finish(exit, error) {
      if (closed) fail();
      // After child exit, an inherited pipe cannot hold the wrapper forever. A late EOF remains incomplete.
      if (stream && !stream.readableEnded && !stream.destroyed) await new Promise(resolve => {
        const done = () => { clearTimeout(timer); stream.off('end', done); stream.off('close', done); resolve(); };
        const timer = setTimeout(done, 100); stream.once('end', done); stream.once('close', done);
      });
      closed = true;
      const complete = stream ? stream.readableEnded : true;
      if (stream) { stream.off('data', consume); stream.destroy(); }
      try { fsyncSync(output.fd); } catch (failure) { streamError(failure); }
      try { await output.close(); } catch (failure) { streamError(failure); }
      const stderr = { bytes: retained, observedBytes: observed, sha256: digest.digest('hex'), truncated: observed > retained, complete,
        ...(writeError ? { errorCode: writeError } : {}) };
      const ended = exit ? { code: Number.isInteger(exit.code) ? exit.code : null, signal: /^SIG[A-Z0-9]+$/.test(exit.signal ?? '') ? exit.signal : null } : null;
      await record(error ? 'startup-failed' : 'child-exit', { exit: ended, stderr, ...(error ? { errorCode: startupErrorCode(error) } : {}) });
      return stderr;
    },
  };
}

/** Observe the actual child through exit even when diagnostic persistence fails. */
export async function observeStartupChild(child, diagnostic, { runnerId } = {}) {
  let ended = false, initialization;
  let diagnosticError, stderr;
  const exited = new Promise(resolve => {
    child.once('error', error => { ended = true; resolve({ code: null, signal: 'start-error', startupError: startupErrorCode(error) }); });
    child.once('exit', (code, signal) => { ended = true; resolve({ code, signal }); });
  });
  const initialized = value => {
    // One parent-created channel, one exact message. Neither stderr nor SDK events enter here.
    if (!ended && value && Object.keys(value).sort().join() === 'protocol,runnerId,type'
      && value.protocol === 'flow.runner-startup.v1' && value.type === 'runtime-initialized'
      && value.runnerId === runnerId && typeof runnerId === 'string' && runnerId.length <= 256) {
      initialization = Promise.resolve().then(() => diagnostic.initialized(child.pid, runnerId))
        .catch(error => { diagnosticError ??= startupErrorCode(error); });
    }
    if (child.connected) { try { child.disconnect(); } catch { /* A closed one-shot channel never licenses a second message. */ } }
  };
  if (runnerId !== undefined && child.connected) child.once('message', initialized);
  try { diagnostic.capture(child.stderr); } catch (error) { diagnosticError = startupErrorCode(error); child.stderr?.on('error', () => {}); child.stderr?.resume(); }
  try { await diagnostic.stage('child-running'); } catch (error) { diagnosticError ??= startupErrorCode(error); }
  const result = await exited;
  child.off('message', initialized);
  await initialization;
  try { stderr = await diagnostic.finish(result, result.startupError ? { code: result.startupError } : undefined); } catch (error) { diagnosticError ??= startupErrorCode(error); }
  return { ...result, ...(stderr ? { stderr } : {}), ...(diagnosticError ? { diagnosticError } : {}) };
}

/** A published profile is durable configuration. Only a receipt from this launch proves local initialization. */
export async function readRunnerInitialization({ directory, recordKey, record, runnerId }) {
  if (!['runner', 'runner-settings'].includes(recordKey) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(record?.nonce ?? '')
    || !Number.isSafeInteger(record?.pid) || record.pid < 2 || typeof runnerId !== 'string' || runnerId.length < 1 || runnerId.length > 256) return false;
  const parent = join(directory, 'startup-diagnostics'), path = join(parent, `${recordKey}-${record.nonce}.json`);
  try {
    await privateDirectory(directory); await privateDirectory(parent);
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await file.stat({ bigint: true }); privateFile(before, 4096);
      const bytes = Buffer.alloc(4097); let size = 0;
      while (size < bytes.length) { const part = await file.read(bytes, size, bytes.length - size, size); if (!part.bytesRead) break; size += part.bytesRead; }
      const after = await file.stat({ bigint: true }), named = await lstat(path, { bigint: true }); privateFile(after, 4096);
      if (!sameIdentity(before, after) || !sameIdentity(after, named) || before.mtimeNs !== after.mtimeNs || before.size !== after.size || size !== Number(before.size)) fail();
      // A failed persistence stage can leave a valid-looking JSON file. It remains unconfirmed.
      try { privateFile(await lstat(join(parent, `${recordKey}-${record.nonce}.initializing`), { bigint: true }), 0); return false; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      const value = JSON.parse(bytes.subarray(0, size).toString('utf8')), initialized = value.runtimeInitialized;
      return value.format === 1 && value.role === 'runner' && (value.recordKey ?? value.role) === recordKey && value.nonce === record.nonce
        && value.pid === record.pid && value.phase === 'child-running' && initialized?.protocol === 'flow.runner-startup.v1'
        && initialized.runnerId === runnerId && Number.isSafeInteger(initialized.childPid) && initialized.childPid > 1
        && Object.keys(initialized).sort().join() === 'childPid,protocol,runnerId';
    } finally { await file.close(); }
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
