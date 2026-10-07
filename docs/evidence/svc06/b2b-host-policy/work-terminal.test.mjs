import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAbsentWork } from './work-terminal.mjs';
const input = { directory: '/private/tmp/owned-fixture', runName: 'only-run' }, reservation = { inputSha256: 'a'.repeat(64) };
const base = { format: 1, ...input, ...reservation, ownership: 'newChildSession', pid: 1234, ownedState: 'absent', exitCode: 1, eof: { stdout: true, stderr: true } };
test('failed work with its complete group absent permits independent cleanup evidence', () => {
  requireAbsentWork(base, reservation, input);
});
test('unknown group or supervision exception never permits DROP even with empty connection evidence', () => {
  for (const terminal of [{ ...base, ownedState: 'unknown', connections: [] }, { ...base, supervisionError: 'OSError' }, { ...base, ownership: 'childPidOnly' }]) {
    assert.throws(() => requireAbsentWork(terminal, reservation, input));
  }
});
test('another namespace, input or invalid owner PID cannot authorize this cleanup', () => {
  for (const terminal of [{ ...base, runName: 'another' }, { ...base, directory: '/private/tmp/other' }, { ...base, inputSha256: 'b'.repeat(64) }, { ...base, pid: null }]) {
    assert.throws(() => requireAbsentWork(terminal, reservation, input));
  }
});
