// Read only the current run's recorded nonces; never signal, alter state, or publish stderr content.
import { constants } from 'node:fs';
import { open, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const roles = ['center', 'runner', 'web'];
const noncePattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const require = condition => { if (!condition) throw Object.assign(Error('Observation unknown'), { code: 'STARTUP_DIAGNOSTICS_UNAVAILABLE' }); };
const identity = st => ({ dev: String(st.dev), ino: String(st.ino), uid: String(st.uid), nlink: String(st.nlink), mode: Number(st.mode & 0o777n) });

async function directoryIdentity(path) {
  const info = await lstat(path, { bigint: true });
  require(info.isDirectory() && !info.isSymbolicLink() && info.uid === BigInt(process.getuid()) && (info.mode & 0o777n) === 0o700n && await realpath(path) === path);
  return info;
}
async function readPrivate(path, limit) {
  const fd = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await fd.stat({ bigint: true });
    require(before.isFile() && before.uid === BigInt(process.getuid()) && before.nlink === 1n && (before.mode & 0o777n) === 0o600n && before.size <= BigInt(limit));
    const bytes = Buffer.alloc(Number(before.size) + 1); let size = 0;
    while (size < bytes.length) { const part = await fd.read(bytes, size, bytes.length - size, size); if (!part.bytesRead) break; size += part.bytesRead; }
    const after = await fd.stat({ bigint: true }), current = await lstat(path, { bigint: true });
    require(size === Number(before.size) && before.dev === after.dev && before.ino === after.ino && before.size === after.size && before.mtimeNs === after.mtimeNs && after.dev === current.dev && after.ino === current.ino && !current.isSymbolicLink());
    require(before.uid === after.uid && after.uid === current.uid && before.nlink === after.nlink && after.nlink === current.nlink && before.mode === after.mode && after.mode === current.mode);
    return { bytes: bytes.subarray(0, size), identity: identity(after) };
  } finally { await fd.close(); }
}

/** Observation errors are independent facts; this reader cannot replace the work/cleanup primary. */
export async function observeStartup({ directory, run, safety }) {
  const root = await directoryIdentity(directory);
  await directoryIdentity(run);
  const output = { state: 'observed', at: new Date().toISOString(), primary: null, roles: [], observations: [], stderrPolicy: 'Private original retained; public metadata only; at most 64KiB per nonce' };
  const unknown = (source, error) => { output.state = 'partial-unknown'; output.observations.push({ source, state: error.code === 'ENOENT' ? 'not-observed' : 'unknown', code: safety.startupErrorCode(error) }); };
  const records = new Map();
  for (const name of ['state.json', 'generation-1.json', 'generation-before-refresh.json', 'generation-2.json']) {
    try {
      const { bytes } = await readPrivate(join(name === 'state.json' ? directory : run, name), 65536);
      const value = JSON.parse(bytes.toString());
      if (name === 'state.json') output.primary = safety.publicStartupFailure(value.lastStartFailure);
      for (const [role, record] of Object.entries(name === 'state.json' ? value.processes ?? {} : value)) {
        require(roles.includes(role) && noncePattern.test(record.nonce) && Number.isSafeInteger(record.pid) && record.pid > 1 && record.pid === record.group);
        if (records.has(record.nonce)) require(records.get(record.nonce).role === role && records.get(record.nonce).pid === record.pid);
        records.set(record.nonce, { role, nonce: record.nonce, pid: record.pid }); require(records.size <= 6);
      }
    } catch (error) { unknown(name, error); }
  }
  for (const record of records.values()) {
    const fact = { ...record, phase: null, errorCode: null, exit: 'NOT_OBSERVED', stderr: null };
    const parent = join(directory, 'startup-diagnostics'), stem = join(parent, `${record.role}-${record.nonce}`);
    try {
      const parentBefore = await directoryIdentity(parent);
      const { bytes } = await readPrivate(`${stem}.json`, 4096), detail = JSON.parse(bytes.toString());
      require(detail.format === 1 && detail.role === record.role && detail.nonce === record.nonce && detail.pid === record.pid);
      const safe = safety.publicStartupFailure({ ...record, phase: detail.phase, code: detail.errorCode, at: detail.at });
      fact.phase = safe.phase; fact.at = safe.at; fact.errorCode = detail.errorCode ? safe.code : null;
      if (detail.exit) {
        require((detail.exit.code === null || Number.isInteger(detail.exit.code)) && (detail.exit.signal === null || /^SIG[A-Z0-9]+$/.test(detail.exit.signal)));
        fact.exit = { code: detail.exit.code, signal: detail.exit.signal };
      }
      const stderr = await readPrivate(`${stem}.stderr`, 65536);
      fact.stderr = { bytes: stderr.bytes.length, sha256: digest(stderr.bytes), identity: stderr.identity, complete: null, truncated: null, declaredMatchesObserved: null };
      if (detail.stderr) {
        require(Number.isSafeInteger(detail.stderr.bytes) && detail.stderr.bytes >= 0 && detail.stderr.bytes <= 65536 && Number.isSafeInteger(detail.stderr.observedBytes) && detail.stderr.observedBytes >= detail.stderr.bytes && /^[a-f0-9]{64}$/.test(detail.stderr.sha256) && typeof detail.stderr.complete === 'boolean' && typeof detail.stderr.truncated === 'boolean');
        Object.assign(fact.stderr, { complete: detail.stderr.complete, truncated: detail.stderr.truncated, observedBytes: detail.stderr.observedBytes, declaredMatchesObserved: detail.stderr.bytes === fact.stderr.bytes && detail.stderr.sha256 === fact.stderr.sha256 });
      }
      const parentAfter = await directoryIdentity(parent); require(parentBefore.dev === parentAfter.dev && parentBefore.ino === parentAfter.ino);
    } catch (error) { fact.observation = { state: error.code === 'ENOENT' ? 'not-observed' : 'unknown', code: safety.startupErrorCode(error) }; output.state = 'partial-unknown'; }
    output.roles.push(fact);
  }
  const after = await directoryIdentity(directory); require(root.dev === after.dev && root.ino === after.ino);
  require(Buffer.byteLength(JSON.stringify(output)) < 16384);
  return output;
}
