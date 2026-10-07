import assert from 'node:assert/strict';
/** A connection sample cannot substitute for the supervisor's settled writer identity. */
export function requireAbsentWork(terminal, reservation, input) {
  assert.equal(terminal.format, 1);
  assert.equal(terminal.inputSha256, reservation.inputSha256);
  assert.equal(terminal.directory, input.directory);
  assert.equal(terminal.runName, input.runName);
  assert.equal(terminal.ownership, 'newChildSession');
  assert.ok(Number.isSafeInteger(terminal.pid) && terminal.pid > 1);
  assert.equal(terminal.ownedState, 'absent', 'WORK_WRITER_NOT_ABSENT_KEEP_DATABASE');
  assert.equal(terminal.supervisionError, undefined);
}
