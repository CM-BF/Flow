import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { expect, test } from 'vitest';
import { ClaimFixture } from '../../../../docs/evidence/x01/center-claim-fixture.js';
import { bindingExecutionKind, claimVerificationReference } from './verification.js';
import { sha256 } from '../database.js';
import { readClaimReceipt, saveClaimReceipt } from '../runner-claim-receipts.js';
import { pluginClaimEligibilitySql } from './claim.js';

const capability = { bindingProtocol: 'flow.plugin-verification.v1' as const, storeId: 'owned-store', hostApiMajor: 1 as const,
  algorithms: [{ id: 'flow.json-object.required-keys' as const, version: 1 as const }] };
function referenceFixture() {
  const f = new ClaimFixture(); const source = { taskId: randomUUID(), attemptId: randomUUID(), artifactId: 'output', version: sha256('{"id":1}'), content: '{"id":1}' };
  const rule = { schemaVersion: 1 as const, algorithmId: 'flow.json-object.required-keys' as const, algorithmVersion: 1 as const, requiredKeys: ['id'] };
  f.task.submission.prompt = JSON.stringify({ source, rule }); f.binding.inputDigest = sha256(f.task.submission.prompt);
  const row = { source_task_id: source.taskId, source_attempt_id: source.attemptId, artifact_id: source.artifactId, artifact_version: source.version, project_id: 'project', rule };
  const state = { kind: 'verifier', projectRows: [{ project_id: 'project', workspace_id: 'personal' }], row: row as typeof row | undefined, content: source.content };
  const client = { async query(sql: string) {
    const rows = sql.startsWith('SELECT kind') ? (state.kind ? [{ kind: state.kind }] : [])
      : sql.includes('FROM flow.plugin_verification_references') ? (state.row ? [state.row] : [])
      : sql.includes('FROM flow.project_task_bindings') ? state.projectRows : [{ content: state.content }];
    return { rows, rowCount: rows.length };
  } } as unknown as PoolClient;
  return { f, state, client };
}
test('AV03 center positive kind never infers tool from missing verifier reference', async () => {
  const { f, state, client } = referenceFixture(); state.kind = '';
  await expect(bindingExecutionKind(client, f.binding.bindingId)).rejects.toMatchObject({ code: 'plugin_claim_unavailable' });
  state.kind = 'verifier'; state.row = undefined;
  await expect(claimVerificationReference(client, f.task, f.binding, capability)).rejects.toMatchObject({ code: 'plugin_claim_unavailable' });
});
test('AV03 center rechecks exact source content, scope and algorithm without choosing a new pin', async () => {
  const { f, state, client } = referenceFixture();
  const result = await claimVerificationReference(client, f.task, f.binding, capability);
  expect(result).toMatchObject({ executionKind: 'verifier', bindingId: f.binding.bindingId, verification: { projectId: 'project' } });
  for (const projects of [[], [{ project_id: 'other', workspace_id: 'personal' }], [{ project_id: 'project', workspace_id: 'other' }]]) {
    state.projectRows = projects; await expect(claimVerificationReference(client, f.task, f.binding, capability)).rejects.toMatchObject({ code: 'plugin_claim_unavailable' });
  }
  state.projectRows = [{ project_id: 'project', workspace_id: 'personal' }]; state.content = '{"id":2}';
  await expect(claimVerificationReference(client, f.task, f.binding, capability)).rejects.toMatchObject({ code: 'plugin_claim_unavailable' });
});
test('AV03 center one receipt namespace binds v4 full capability and conflicts across old protocols', async () => {
  const f = new ClaimFixture(); const input = { protocol: 'flow.runner-claim.v4' as const, runnerId: f.runnerId, requestId: randomUUID(), pluginVerifierExecution: capability };
  const identity = { runnerId: f.runnerId, taskId: f.task.id, attemptId: randomUUID(), ownerVersion: 1 };
  const client = f as unknown as PoolClient;
  await saveClaimReceipt(client, input, identity); expect(await readClaimReceipt(client, input)).toEqual(identity);
  await expect(readClaimReceipt(client, { ...f.request, requestId: input.requestId })).rejects.toMatchObject({ code: 'claim_key_conflict' });
  await expect(readClaimReceipt(client, { ...input, pluginToolExecution: f.request.pluginToolExecution })).rejects.toMatchObject({ code: 'claim_key_conflict' });
  expect(f.receipts).toHaveLength(1);
});
test('AV03 center eligibility explicitly gates positive tool/verifier identities before caller LIMIT', () => {
  expect(pluginClaimEligibilitySql).toContain("be.kind='tool'"); expect(pluginClaimEligibilitySql).toContain("be.kind='verifier'");
  expect(pluginClaimEligibilitySql).toContain('flow.plugin_verification_references');
  expect(pluginClaimEligibilitySql).toContain("pr.grants ? 'verifier'");
});
