// Lexical temporary-root contract only. Ownership/realpath/dev/ino checks remain in host-records.
import assert from 'node:assert/strict';

export function isHostDirectory(value) {
  // Compare the entire match: JavaScript $ alone also matches before a final newline.
  return typeof value === 'string' && /^\/private\/tmp\/flow-svc09a-host-[A-Za-z0-9_-]+$/.exec(value)?.[0] === value;
}

export function hostInputPath(value) {
  const suffix = '/input.json';
  assert.ok(typeof value === 'string' && value.endsWith(suffix)
    && isHostDirectory(value.slice(0, -suffix.length)), 'OWNED_HOST_INPUT_PATH_REQUIRED');
  return value;
}
