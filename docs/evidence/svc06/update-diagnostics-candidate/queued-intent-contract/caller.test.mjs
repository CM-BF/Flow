import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSameOperation, assertBoundJournal, loadPlan } from './caller.mjs';
import { compareHistory } from '../maintenance-continuation.mjs';

test('same operation continuation rejects new operation, replacement backend and progressed phase', async () => {
  const plan = await loadPlan();
  const op = { operationId: plan.request.operationId, initialVersion: 18, target: plan.artifact.sourceHead, backendArtifact: plan.artifact, phase: 'drain-requested', holdKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' };
  assertSameOperation(op, plan);
  for (const change of [{ operationId: 'another' }, { initialVersion: 19 }, { phase: 'ready-paused' }, { target: 'movingmain' }, { backendArtifact: null }]) assert.throws(() => assertSameOperation({ ...op, ...change }, plan));
});
test('bound journal requires exact v2 identity and empty assignment but does not claim an HTTP success', () => {
  const value = { version: 2, runnerId: 'fixed-runner', opportunityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', assignments: [] };
  assertBoundJournal(value, 'fixed-runner');
  for (const change of [{ version: 1 }, { version: 3 }, { runnerId: 'other' }, { assignments: [{}] }, { inFlight: null }, { opportunityId: 'not-id' }]) assert.throws(() => assertBoundJournal({ ...value, ...change }, 'fixed-runner'));
});
test('old-column history permits only explicit pre-refresh audit additions and rejects same-count value changes', () => {
  const before = { identity: {}, omittedColumns: {}, tables: [
    { name: 'migrations', columns: ['version'], count: 1, digest: 'old-migration', row_hashes: ['old'] },
    { name: 'runner_maintenance_audit', columns: ['id'], count: 1, digest: 'old-audit', row_hashes: ['old-audit'] },
    { name: 'attempts', columns: ['id', 'completed_at'], count: 4, digest: 'unchanged' }] };
  const after = structuredClone(before); after.tables[1].count += 2; after.tables[1].row_hashes.push('drain', 'hold');
  compareHistory(before, after, 2, 0);
  const changed = structuredClone(after); changed.tables[2].digest = 'other'; assert.throws(() => compareHistory(before, changed, 2, 0));
  const changedAudit = structuredClone(after); changedAudit.tables[1].row_hashes[0] = 'replaced'; assert.throws(() => compareHistory(before, changedAudit, 2, 0));
  assert.throws(() => compareHistory(before, after, 1, 0));
});
