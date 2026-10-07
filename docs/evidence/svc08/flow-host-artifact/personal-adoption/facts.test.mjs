import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { persistedFacts, protection } from './procedure.mjs';

// These are already archived, sanitized observations; no personal or database access.
const before = JSON.parse(await readFile(new URL('./attempt-02/migration-before.json', import.meta.url)));
const savedAfter = JSON.parse(await readFile(new URL('./attempt-02/replacement-before.json', import.meta.url)));
function liveAfter() {
  const facts = structuredClone(savedAfter);
  facts.database.runner[0].maintenance_updated_at = new Date(facts.database.runner[0].maintenance_updated_at);
  return facts;
}

test('live Date and identical persisted ISO agree without changing the original facts', () => {
  const live = liveAfter(), original = structuredClone(live);
  assert.deepEqual(before.database.runner, savedAfter.database.runner);
  assert.equal(protection(before, live).checks.maintenance, false);
  const normalized = persistedFacts(live);
  assert.equal(protection(before, normalized).protected, true);
  assert.deepEqual(normalized.database.runner, before.database.runner);
  assert.deepEqual(live, original);
});

test('a different maintenance time still refuses preservation', () => {
  const live = liveAfter();
  live.database.runner[0].maintenance_updated_at.setTime(live.database.runner[0].maintenance_updated_at.getTime() + 1);
  assert.equal(protection(before, persistedFacts(live)).checks.maintenance, false);
});

test('null agrees only with null and does not alias a timestamp or missing value', () => {
  const first = structuredClone(before), second = structuredClone(savedAfter);
  first.database.runner[0].maintenance_updated_at = null;
  second.database.runner[0].maintenance_updated_at = null;
  assert.equal(protection(persistedFacts(first), persistedFacts(second)).protected, true);
  assert.equal(protection(persistedFacts(first), persistedFacts(liveAfter())).checks.maintenance, false);
  delete second.database.runner[0].maintenance_updated_at;
  assert.throws(() => persistedFacts(second));
});

test('invalid or noncanonical time representations fail closed', () => {
  for (const value of [new Date(NaN), undefined, 0, {}, '', '2026-10-07', '2026-10-07T06:00:00Z']) {
    const live = liveAfter(); live.database.runner[0].maintenance_updated_at = value;
    assert.throws(() => persistedFacts(live));
  }
});

test('normalization preserves every other maintenance field and unknown keys for strict comparison', () => {
  for (const [key, value] of Object.entries({ id: 'different-runner', maintenance_state: 'paused', maintenance_version: 19,
    maintenance_operation_id: 'different-operation', unrecognized_field: 'never-discard' })) {
    const live = liveAfter(); live.database.runner[0][key] = value;
    const normalized = persistedFacts(live);
    assert.equal(normalized.database.runner[0][key], value);
    assert.equal(protection(before, normalized).checks.maintenance, false);
  }
});
