// Experiment-only seam: one exact runtime spawn, while the real host wrapper keeps its PID.
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { openSync, writeSync, closeSync, fsyncSync, lstatSync, realpathSync } from 'node:fs';
import { join } from 'node:path';

function privateDirectory(path) {
  const stat = lstatSync(path);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o700);
  assert.equal(realpathSync(path), path);
}
function writeAll(fd, bytes) {
  for (let offset = 0; offset < bytes.length;) offset += writeSync(fd, bytes, offset, bytes.length - offset);
}
function errorName(error) { return /^[A-Za-z0-9_]{1,64}$/.test(error?.code ?? '') ? error.code : 'UNKNOWN'; }
function capture(logDirectory, limit) {
  privateDirectory(logDirectory);
  const files = {}, metadata = { limitPerStream: limit, stdout: { observed: 0, retained: 0 }, stderr: { observed: 0, retained: 0 }, errors: [] };
  try {
    for (const name of ['stdout', 'stderr']) files[name] = openSync(join(logDirectory, `${name}.private`), 'wx', 0o600);
  } catch (error) { for (const fd of Object.values(files)) closeSync(fd); throw error; }
  function finish(exit) {
    metadata.exit = exit;
    for (const fd of Object.values(files)) {
      try { fsyncSync(fd); } catch (error) { metadata.errors.push(errorName(error)); }
      finally { closeSync(fd); }
    }
    const fd = openSync(join(logDirectory, 'capture.json'), 'wx', 0o600);
    try { writeAll(fd, Buffer.from(JSON.stringify(metadata) + '\n')); fsyncSync(fd); } finally { closeSync(fd); }
    const directory = openSync(logDirectory, 'r'); try { fsyncSync(directory); } finally { closeSync(directory); }
  }
  return {
    attach(child) {
      for (const name of ['stdout', 'stderr']) child[name].on('data', bytes => {
        const state = metadata[name]; state.observed += bytes.length;
        const retained = bytes.subarray(0, Math.max(0, limit - state.retained));
        try { if (retained.length) { writeAll(files[name], retained); state.retained += retained.length; } }
        catch (error) { metadata.errors.push(errorName(error)); state.retained = limit; }
        state.truncated = state.observed > state.retained;
      });
      child.once('error', error => { metadata.errors.push(errorName(error)); });
      child.once('close', (code, signal) => finish({ code, signal }));
    },
    failed(error) { metadata.errors.push(errorName(error)); finish({ code: null, signal: 'spawn-error' }); },
  };
}
/** Only this experiment supplies the expectation; it is never accepted from a public request. */
export function installServiceBoundary({ profile, expected, logDirectory, captureBytes = 65536 }) {
  assert.ok(Number.isSafeInteger(captureBytes) && captureBytes > 0 && captureBytes <= 65536);
  const stat = lstatSync(profile); assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600);
  assert.equal(realpathSync(profile), profile);
  const original = childProcess.spawn;
  let consumed = false;
  childProcess.spawn = (program, argv, options) => {
    assert.equal(consumed, false, 'SECOND_RUNTIME_SPAWN_REJECTED');
    assert.equal(program, expected.program, 'RUNTIME_PROGRAM_MISMATCH');
    assert.deepEqual(argv, expected.argv, 'RUNTIME_ARGV_MISMATCH');
    assert.equal(options?.cwd, expected.cwd, 'RUNTIME_CWD_MISMATCH');
    assert.equal(options?.stdio, 'ignore', 'RUNTIME_STDIO_MISMATCH');
    assert.ok(!options.detached && options.env && !Object.hasOwn(options.env, 'NODE_OPTIONS'), 'RUNTIME_ENV_OR_SESSION_MISMATCH');
    consumed = true;
    const logs = capture(logDirectory, captureBytes);
    // Preserve the original argv/cwd/env and same group. Only the executable envelope and diagnostic stdio change.
    let child;
    try { child = original('/usr/bin/sandbox-exec', ['-f', profile, program, ...argv], { ...options, stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { logs.failed(error); throw error; }
    logs.attach(child); return child;
  };
  syncBuiltinESMExports();
  return () => consumed;
}
