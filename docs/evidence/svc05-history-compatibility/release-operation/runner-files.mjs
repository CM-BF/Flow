/** Bounded, non-atomic native-file observation; only the known admission rename can be resampled. */
import { lstat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { bounded, sha } from '../center-recovery/facts.mjs';

const idle = bytes => {
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  return value && Object.keys(value).sort().join(',') === 'assignments,inFlight,version'
    && value.version === 1 && value.inFlight === null && Array.isArray(value.assignments) && value.assignments.length === 0;
};
const directoryMatches = (actual, expected) => actual.isDirectory() && !actual.isSymbolicLink()
  && actual.uid === process.getuid() && actual.dev === expected.dev && actual.ino === expected.ino;
const fileMatches = (actual, expected) => actual.isFile() && !actual.isSymbolicLink()
  && actual.uid === process.getuid() && actual.dev === expected.dev && actual.ino === expected.ino
  && actual.size === expected.size && actual.mtimeMs === expected.mtimeMs && actual.ctimeMs === expected.ctimeMs;

export async function runnerFiles(root, baseUrl, io = { lstat, readdir, bounded }, { validateAdmission = idle } = {}) {
  // Same normalization/hash as fixed runtime.ts stateDirectory; never discover a journal by filename.
  const admissionPath = sha(baseUrl.replace(/\/$/, '')) + '/admission.json';
  const temporaryPath = admissionPath + '.tmp';
  const deadline = performance.now() + 250, observations = [], directories = new Map();
  let identity, observedEntries = 0, observedBytes = 0;
  const fail = code => Object.assign(Error(code), { code });
  const read = async operation => {
    const remaining = deadline - performance.now(); if (remaining <= 0) throw fail('RUNNER_SAMPLE_DEADLINE');
    let timer;
    try {
      const result = await Promise.race([operation(), new Promise((_, reject) => { timer = setTimeout(() => reject(fail('RUNNER_SAMPLE_DEADLINE')), remaining); })]);
      if (performance.now() >= deadline) throw fail('RUNNER_SAMPLE_DEADLINE');
      return result;
    } finally { clearTimeout(timer); }
  };
  const checkDirectory = async (path, expected) => {
    if (!directoryMatches(await read(() => io.lstat(path)), expected)) throw fail('RUNNER_DIRECTORY_IDENTITY');
  };
  const content = async (path, expected, max) => {
    const value = await read(() => io.bounded(path, max));
    observedBytes += value.bytes.length;
    if (observedBytes > 32 * 1024 * 1024 || !fileMatches(value.stat, expected)
      || !fileMatches(await read(() => io.lstat(path)), expected)) throw fail('RUNNER_FILE_CHANGED_OR_BOUND');
    return value.bytes;
  };
  try {
    if (typeof validateAdmission !== 'function') throw fail('RUNNER_ADMISSION_VALIDATOR');
    identity = await read(() => io.lstat(root));
    if (!directoryMatches(identity, identity)) throw fail('RUNNER_DIRECTORY_IDENTITY');
    for (let attempt = 0; attempt <= 2; attempt++) {
      const sample = { attempt, outcome: 'sampling', files: [], totalBytes: 0 };
      observations.push(sample); await checkDirectory(root, identity);
      const walk = async (path, expected, prefix = '', depth = 0) => {
        if (depth > 8) throw fail('RUNNER_DIRECTORY_DEPTH');
        const previous = directories.get(prefix);
        if (previous && !directoryMatches(expected, previous)) throw fail('RUNNER_DIRECTORY_IDENTITY');
        directories.set(prefix, expected);
        const entries = (await read(() => io.readdir(path, { withFileTypes: true }))).sort((a, b) => a.name.localeCompare(b.name)); await checkDirectory(path, expected);
        for (const entry of entries) {
          const name = entry.name;
          if (!name || name === '.' || name === '..' || name.includes('/') || name.includes('\0')) throw fail('RUNNER_ENTRY_NAME');
          if (++observedEntries > 512) throw fail('RUNNER_ENTRY_BOUND');
          const relative = prefix + name, next = join(path, name);
          if (relative === temporaryPath && !entry.isFile()) throw fail('RUNNER_FILE_IDENTITY');
          try {
            const st = await read(() => io.lstat(next));
            if (st.isSymbolicLink() || st.uid !== process.getuid()) throw fail('RUNNER_FILE_IDENTITY');
            if (st.isDirectory()) await walk(next, st, relative + '/', depth + 1);
            else {
              if (sample.files.length >= 256 || !st.isFile()) throw fail('RUNNER_FILE_BOUND');
              const bytes = await content(next, st, relative === admissionPath ? 65536 : 8 * 1024 * 1024);
              sample.files.push({ path: relative, bytes: bytes.length, sha256: sha(bytes) }); sample.totalBytes += bytes.length;
              if (relative === admissionPath) {
                sample.admission = { idle: validateAdmission(bytes) === true };
                if (!sample.admission.idle) throw fail('RUNNER_ADMISSION_NOT_IDLE');
              }
            }
          } catch (error) {
            // No missing directory/history file is retried. Only this enumerated, fixed temporary entry.
            if (relative === temporaryPath && error.code === 'ENOENT') throw Object.assign(fail('RUNNER_ADMISSION_RENAMED'), { retry: true });
            throw error;
          }
        }
        await checkDirectory(path, expected);
      };
      try {
        await walk(root, identity);
        if (!sample.admission?.idle) throw fail('RUNNER_ADMISSION_MISSING');
        if (sample.files.some(f => f.path === temporaryPath)) throw fail('RUNNER_ADMISSION_TEMP_PRESENT');
        const st = await read(() => io.lstat(join(root, admissionPath)));
        const bytes = await content(join(root, admissionPath), st, 65536);
        sample.admissionFinal = { path: admissionPath, idle: validateAdmission(bytes) === true, bytes: bytes.length, sha256: sha(bytes) };
        if (!sample.admissionFinal.idle || sample.admissionFinal.sha256 !== sample.files.find(f => f.path === admissionPath).sha256) throw fail('RUNNER_ADMISSION_CHANGED');
        await checkDirectory(root, identity); sample.outcome = 'idle';
        return { dev: identity.dev, ino: identity.ino, uid: identity.uid, files: sample.files, totalBytes: sample.totalBytes,
          admission: sample.admissionFinal, observations, retries: attempt, observedEntries, observedBytes, nonAtomic: true };
      } catch (error) {
        sample.outcome = 'unknown'; sample.code = /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'RUNNER_SAMPLE_UNKNOWN';
        await checkDirectory(root, identity);
        if (!error.retry || attempt === 2) throw error;
      }
    }
  } catch (error) {
    throw Object.assign(error, { runnerObservation: { dev: identity?.dev, ino: identity?.ino, uid: identity?.uid,
      observations, observedEntries, observedBytes, nonAtomic: true, outcome: 'unknown' } });
  }
}
