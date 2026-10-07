import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { TaskRecord } from '../../../apps/server/src/tasks.js';
import type { AttemptRecord } from '../../../apps/server/src/runners.js';
import { sha256 } from '../../../apps/server/src/database.js';
import type { PluginToolBinding } from '../../../packages/contracts/src/plugin-runtime.js';
import type { PluginRunnerClaimRequest } from '../../../packages/contracts/src/plugin-runner-claim.js';

/** SQL-boundary fake, not a PostgreSQL execution or concurrency proof. Unexpected queries fail. */
export class ClaimFixture extends EventEmitter {
  readonly runnerId = randomUUID(); readonly queries: { sql: string; values: readonly unknown[] }[] = [];
  readonly task: TaskRecord = { id: randomUUID(), submission: { harness: 'fixture', title: 'Tool', prompt: 'hello' }, status: 'queued',
    verification_status: 'pending', created_at: new Date(), updated_at: new Date(), cursor: 0, owner_version: 0,
    current_attempt_id: null, pending_decision: null, usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: 'unknown', incomplete: true },
    latest_artifact_id: null, latest_artifact_version: null };
  readonly request: PluginRunnerClaimRequest = { protocol: 'flow.runner-claim.v3', runnerId: this.runnerId, requestId: randomUUID(),
    pluginToolExecution: { bindingProtocol: 'flow.plugin-runtime.v1', storeId: 'owned-store', hostApiMajor: 1 } };
  readonly binding: PluginToolBinding = { protocol: 'flow.plugin-runtime.v1', bindingId: randomUUID(), invocationId: randomUUID(), taskId: this.task.id,
    registrationId: randomUUID(), registrationRevision: 3, versionId: randomUUID(), scope: { workspaceId: 'personal', projectId: null },
    materialInstallOperationId: randomUUID(), targetRunnerId: this.runnerId, storeId: 'owned-store', materialId: 'a'.repeat(64), treeDigest: 'b'.repeat(64),
    hostApiMajor: 1, artifact: { artifactId: randomUUID(), name: 'owned-tool', version: '1.0.0', integrity: 'sha512-'+'A'.repeat(86)+'==', bytes: 100, sha256: 'c'.repeat(64) },
    configuration: { prefix: 'original' }, inputDigest: sha256('hello'), createdAt: new Date().toISOString() };
  receipts: { operation: string; key: string; digest: string; response: unknown }[] = [];
  attempt: AttemptRecord | undefined;
  plugin = true; grant = true; host = true; revoked = false; maintenance = 'accepting'; busy = 0; remaining = 5000;
  currentRevision = 3; beforeRegistration?: () => void; releases = 0;
  readonly pool = { connect: (callback?: (error: Error | undefined, client: PoolClient) => void) => {
    if (callback) { callback(undefined, this as unknown as PoolClient); return; }
    return Promise.resolve(this as unknown as PoolClient);
  } } as unknown as Pool;
  release() { this.releases++; }
  async query(sql: string, values: readonly unknown[] = []) {
    this.queries.push({ sql, values: structuredClone(values) });
    let rows: unknown[] = [];
    if (['BEGIN','COMMIT','ROLLBACK'].includes(sql)) return { rows, rowCount: 0 };
    if (sql === 'SELECT * FROM flow.runners WHERE id=$1 FOR UPDATE') rows = [{ id: this.runnerId, harnesses: ['fixture'], capacity: 2, revoked: this.revoked, maintenance_state: this.maintenance }];
    else if (sql.includes('SELECT operation,digest,response FROM flow.commands')) rows = this.receipts.filter(row => (values[0] as string[]).includes(row.operation) && row.key === values[1]);
    else if (sql.startsWith('INSERT INTO flow.commands')) { this.receipts.push({ operation: String(values[0]), key: String(values[1]), digest: String(values[2]), response: JSON.parse(String(values[3])) }); }
    else if (sql.includes('SELECT count(*)::integer AS count FROM flow.attempts')) rows = [{ count: this.busy }];
    else if (sql.includes('SELECT t.id FROM flow.tasks t')) {
      if (this.task.status === 'queued' && (!this.plugin || this.grant && this.host && values[2] === this.binding.storeId && values[3] === 1)) rows = [{ id: this.task.id }];
    } else if (sql.startsWith('SELECT * FROM flow.tasks WHERE id=$1')) rows = values[0] === this.task.id ? [this.task] : [];
    else if (sql.startsWith('SELECT id,version,mode FROM flow.goal_')) rows = [];
    else if (sql === 'SELECT 1 FROM flow.plugin_tool_bindings WHERE task_id=$1') rows = this.plugin ? [{}] : [];
    else if (sql === 'SELECT * FROM flow.plugin_tool_bindings WHERE task_id=$1') {
      const b = this.binding;
      rows = [{ id: b.bindingId, invocation_id: b.invocationId, task_id: b.taskId, registration_id: b.registrationId, registration_revision: b.registrationRevision,
        version_id: b.versionId, scope: b.scope, material_install_operation_id: b.materialInstallOperationId, target_runner_id: b.targetRunnerId,
        store_id: b.storeId, material_id: b.materialId, tree_digest: b.treeDigest, host_api_major: b.hostApiMajor, artifact: b.artifact,
        configuration: b.configuration, input_digest: b.inputDigest, created_at: new Date(b.createdAt) }];
    } else if (sql.startsWith('SELECT * FROM flow.plugin_installations')) {
      if (sql.endsWith('FOR UPDATE')) this.beforeRegistration?.();
      rows = [{ id: this.binding.registrationId, workspace_id: 'personal', project_id: null, package_name: 'owned-tool', revision: this.currentRevision,
        created_at: new Date(), updated_at: new Date() }];
    } else if (sql.includes('FROM flow.plugin_revisions r JOIN flow.plugin_versions')) rows = [{ revision: this.currentRevision, configuration: {}, grants: this.grant ? ['tool'] : [],
      id: this.binding.versionId, declaration: { publicConfiguration: [] }, created_at: new Date() }];
    else if (sql.startsWith('SELECT 1 FROM flow.plugin_runtime_hosts')) rows = this.host ? [{}] : [];
    else if (sql.startsWith('INSERT INTO flow.attempts')) {
      this.attempt = { id: String(values[0]), task_id: this.task.id, runner_id: this.runnerId, owner_version: Number(values[3]),
        lease_expires_at: new Date(Date.now()+Number(values[4])), last_heartbeat_at: null, last_event_at: null, last_sequence: 0, native_session_id: null, completed_at: null };
      rows = [this.attempt];
    } else if (sql.startsWith("UPDATE flow.tasks SET status='running'")) { this.task.status = 'running'; this.task.current_attempt_id = String(values[1]); this.task.owner_version++; }
    else if (sql.startsWith('SELECT * FROM flow.attempts')) rows = this.attempt ? [this.attempt] : [];
    else if (sql.startsWith('SELECT conversation_input_id FROM flow.tasks')) rows = [{ conversation_input_id: null }];
    else if (sql.startsWith('SELECT goal_input_id,conversation_input_id FROM flow.tasks')) rows = [{ goal_input_id: null, conversation_input_id: null }];
    else if (sql.startsWith('SELECT floor(EXTRACT(EPOCH')) rows = [{ remaining_ms: this.remaining }];
    else throw new Error('Unexpected SQL: '+sql.slice(0,160));
    return { rows, rowCount: rows.length };
  }
}
