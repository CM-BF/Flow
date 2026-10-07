import assert from 'node:assert/strict';
import { lstat, realpath, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { digest, writeRecord } from './records.mjs';
import { failureFact } from './stage-policy.mjs';

const TEXT_BYTES = 4096, FILE_BYTES = 8192;
export function sdkErrorKind(frame) {
  if (frame?.type !== 'result') return null;
  if (frame.is_error === true) return frame.subtype === 'success' ? 'sdk-error-flag-with-success-subtype' : 'sdk-error-flag';
  return frame.subtype !== 'success' ? 'sdk-non-success-result' : null;
}
function privateText(frame, secrets) {
  let remaining = TEXT_BYTES, truncated = false, invalid = false;
  const fields = {};
  function text(value) {
    if (value === undefined) return null;
    if (typeof value !== 'string') { invalid = true; return null; }
    if (Buffer.byteLength(value) > 262_144) { invalid = true; truncated = true; return null; }
    let safe = value;
    for (const secret of secrets) if (secret) safe = safe.split(secret).join('[REDACTED]');
    safe = safe.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
      .replace(/\b(?:sk-ant-|sk-)[A-Za-z0-9_-]+/g, '[REDACTED]')
      .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|password)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
    const bytes = Buffer.from(safe); let end = Math.min(bytes.length, remaining);
    while (end > 0 && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    truncated ||= end < bytes.length; remaining -= end; return bytes.subarray(0, end).toString('utf8');
  }
  fields.result = text(frame.result);
  if (frame.errors === undefined) fields.errors = null;
  else if (!Array.isArray(frame.errors)) { invalid = true; fields.errors = null; }
  else {
    truncated ||= frame.errors.length > 16;
    fields.errors = frame.errors.slice(0, 16).map(text);
  }
  const present = typeof frame.result === 'string' && frame.result.length > 0 || (Array.isArray(frame.errors) && frame.errors.some(v => typeof v === 'string' && v.length > 0));
  return { fields, present, truncated, state: !present || invalid || truncated ? 'unknown' : 'recorded',
    constraint: invalid ? 'invalid-or-oversized-text' : truncated ? 'text-limit' : !present ? 'missing-text' : null };
}

/** One private, exclusive record per bound query; never reads environment/configuration or grants another entry. */
export async function createPrivateErrorRecorder({ directory, sourceDigest, phase, secrets = [] }) {
  assert(/^[a-f0-9]{64}$/.test(sourceDigest) && ['plan', 'children'].includes(phase));
  assert(Array.isArray(secrets) && secrets.length <= 4 && secrets.every(v => typeof v === 'string' && v.length <= 4096));
  const root = await realpath(directory), pin = await lstat(directory);
  assert(root === directory && pin.isDirectory() && pin.uid === process.getuid() && (pin.mode & 0o077) === 0);
  async function verifyRoot() {
    const now = await lstat(root);
    assert(now.isDirectory() && now.dev === pin.dev && now.ino === pin.ino && now.uid === pin.uid && (now.mode & 0o077) === 0, 'Private diagnostic root changed.');
  }
  return async (frame, binding) => {
    const kind = sdkErrorKind(frame); if (!kind) return null;
    const result = { kind, state: 'unknown', exists: 'unknown', bytes: null, sha256: null, truncated: null };
    try {
      await verifyRoot();
      assert(binding && ['planner', 'child-1', 'child-2'].includes(binding.slot));
      const identity = { sourceDigest, phase, binding };
      const body = privateText(frame, secrets), record = { kind: 'flow.o16.private-sdk-error.v1', ...identity, errorKind: kind, ...body };
      const file = `sdk-error-${digest(JSON.stringify(identity))}.json`, path = join(root, file);
      result.file = file; result.truncated = body.truncated; result.bodyPresent = body.present; result.constraint = body.constraint;
      // On partial write or directory-sync failure keep the exact file and report unknown; never overwrite/retry.
      await writeRecord(path, record, { exclusive: true, limit: FILE_BYTES }); await verifyRoot();
      const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      try {
        const info = await handle.stat();
        assert(info.isFile() && info.uid === pin.uid && info.dev === pin.dev && info.nlink === 1 && (info.mode & 0o777) === 0o600 && info.size <= FILE_BYTES);
        const bytes = Buffer.alloc(FILE_BYTES + 1), read = await handle.read(bytes, 0, bytes.length, 0);
        assert(read.bytesRead === info.size && read.bytesRead <= FILE_BYTES);
        const actual = bytes.subarray(0, read.bytesRead);
        assert.equal(actual.toString(), JSON.stringify(record, null, 2) + '\n');
        Object.assign(result, { state: body.state, exists: true, bytes: actual.length, sha256: digest(actual), dev: String(info.dev), ino: String(info.ino) });
      } finally { await handle.close(); }
    } catch (error) { result.failure = failureFact(error); }
    return result;
  };
}
