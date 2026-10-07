import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { PLUGIN_RUNTIME_PROTOCOL, pluginGrantReceiptSchema, type PluginGrantRequest, type PluginGrantReceipt, type PluginRuntimeCommand, type PluginToolTaskRequest } from '../../../../packages/contracts/src/plugin-runtime.js';
import type { PluginSnapshot } from '../../../../packages/contracts/src/plugins.js';
import { canonical, HttpError, sha256, transaction } from '../database.js';
import { appendPluginRevision, loadInstallation, readSnapshot } from '../plugins/storage.js';
import { ownedAttempt } from '../runners.js';
import { acceptTask, command, commandInTransaction } from '../tasks.js';
import { assertPluginHost, assertTrustedPluginHost, installedMaterial, type TrustedPluginHostPolicy, latestRuntimeRevision, readBinding, readRuntime, recordBinding } from './store.js';

function requireToolPermission(snapshot: PluginSnapshot): void {
  if (!snapshot.grants.includes('tool')) throw new HttpError(403, 'plugin_tool_grant_required', 'Current tool permission is required.');
}
function requireRevision(actual: number, expected: number): void {
  if (actual !== expected) throw new HttpError(409, 'plugin_revision_conflict', 'Plugin registration changed.');
}

export async function changePluginRuntime(pool: Pool, registrationId: string, input: PluginRuntimeCommand, key: string, policy?: TrustedPluginHostPolicy) {
  const result = await command(pool, `plugin.runtime.command:${registrationId}`, key, input, async client => {
    // Never acquire a runner lock after the registration lock.
    if (input.change.kind === 'enable') {
      await assertPluginHost(client, input.change.targetRunnerId, input.change.storeId);
      assertTrustedPluginHost(policy, { protocol: PLUGIN_RUNTIME_PROTOCOL, runnerId: input.change.targetRunnerId, storeId: input.change.storeId, hostApiMajor: 1 });
    }
    const installation = await loadInstallation(client, registrationId, true);
    requireRevision(installation.revision, input.expectedRevision);
    const current = await readSnapshot(client, registrationId);
    if (input.change.kind === 'enable') {
      requireToolPermission(current);
      if (current.configurationStatus !== 'ready') throw new HttpError(409, 'plugin_configuration_incomplete', 'Complete public configuration before enabling.');
      await installedMaterial(client, current, input.change.materialInstallOperationId, input.change.storeId);
    }
    const changed = await appendPluginRevision(client, installation, { versionId: current.version.id,
      configuration: current.configuration, grants: current.grants, kind: input.change.kind, inputDigest: sha256(canonical(input)) });
    const enabled = input.change.kind === 'enable' ? input.change : null;
    await client.query(`INSERT INTO flow.plugin_runtime_revisions(registration_id,revision,version_id,desired_enabled,
      material_install_operation_id,target_runner_id,store_id,host_api_major) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [registrationId, changed.snapshot.revision, current.version.id, enabled !== null, enabled?.materialInstallOperationId ?? null,
      enabled?.targetRunnerId ?? null, enabled?.storeId ?? null, enabled ? 1 : null]);
    return { ...changed, runtime: await readRuntime(client, registrationId, policy) };
  });
  return { ...result.value, replayed: result.replayed };
}

/** Unmounted until the claim reader filters bindings and trusted runtime dispatch/recovery are integrated. */
export async function admitPluginToolTask(pool: Pool, boss: PgBoss, registrationId: string, input: PluginToolTaskRequest, key: string, policy?: TrustedPluginHostPolicy) {
  const result = await command(pool, `plugin.tool-task:${registrationId}`, key, input, async client => {
    const candidate = await latestRuntimeRevision(client, registrationId);
    if (!candidate?.desired_enabled || !candidate.target_runner_id || !candidate.store_id) throw new HttpError(409, 'plugin_not_enabled', 'Enable this plugin before binding a new task.');
    await assertPluginHost(client, candidate.target_runner_id, candidate.store_id);
    assertTrustedPluginHost(policy, { protocol: PLUGIN_RUNTIME_PROTOCOL, runnerId: candidate.target_runner_id, storeId: candidate.store_id, hostApiMajor: 1 });
    const installation = await loadInstallation(client, registrationId, true);
    requireRevision(installation.revision, input.expectedRevision);
    const runtime = await latestRuntimeRevision(client, registrationId);
    if (!runtime?.desired_enabled || runtime.revision !== installation.revision || runtime.revision !== candidate.revision) {
      throw new HttpError(409, 'plugin_enable_revision_changed', 'Enable the current registration revision before binding a new task.');
    }
    const current = await readSnapshot(client, registrationId);
    requireToolPermission(current);
    if (current.configurationStatus !== 'ready') throw new HttpError(409, 'plugin_configuration_incomplete', 'Complete public configuration before binding a task.');
    const material = await installedMaterial(client, current, runtime.material_install_operation_id!, runtime.store_id!);
    const task = await acceptTask(client, boss, { title: input.title, prompt: input.input, harness: 'fixture',
      ...(input.verification ? { verification: input.verification } : {}) });
    const binding = await recordBinding(client, { protocol: PLUGIN_RUNTIME_PROTOCOL, bindingId: randomUUID(), invocationId: randomUUID(), taskId: task.id,
      registrationId, registrationRevision: current.revision, versionId: current.version.id, scope: current.installation.scope,
      materialInstallOperationId: runtime.material_install_operation_id!, targetRunnerId: runtime.target_runner_id!, storeId: runtime.store_id!,
      materialId: material.installationId, treeDigest: material.treeDigest, hostApiMajor: 1, artifact: material.artifact,
      configuration: current.configuration, inputDigest: sha256(input.input) });
    return { task, binding };
  });
  return { ...result.value, replayed: result.replayed };
}

interface AuthorizationRecord { attempt_id: string; owner_version: number; runner_id: string; authorized_revision: number }
export async function authorizePluginPhase(pool: Pool, runnerId: string, input: PluginGrantRequest, key: string): Promise<PluginGrantReceipt> {
  return transaction(pool, async client => {
    // Every request, including a cached ACK, rechecks the live fence and current grant.
    const { task, attempt } = await ownedAttempt(client, runnerId, input);
    const live = (await client.query<{ live: boolean }>('SELECT $1::timestamptz>clock_timestamp() AS live', [attempt.lease_expires_at])).rows[0]!.live;
    if (!live || attempt.completed_at || task.status !== 'running') throw new HttpError(409, 'plugin_attempt_inactive', 'The tool attempt is no longer allowed to act.');
    const binding = await readBinding(client, task.id);
    if (binding.bindingId !== input.bindingId || binding.invocationId !== input.invocationId || binding.targetRunnerId !== runnerId
      || binding.inputDigest !== sha256(task.submission.prompt)) throw new HttpError(409, 'plugin_binding_mismatch', 'The frozen binding does not match this attempt.');
    await loadInstallation(client, binding.registrationId, true);
    const current = await readSnapshot(client, binding.registrationId);
    requireToolPermission(current);
    // Disabling blocks new bindings. It does not revoke grants or rewrite an accepted pin.
    const result = await commandInTransaction(client, `plugin.tool-phase:${runnerId}`, key, input, async () => {
      const prior = (await client.query<AuthorizationRecord>(`SELECT attempt_id,owner_version,runner_id,authorized_revision FROM flow.plugin_tool_authorizations
        WHERE binding_id=$1 AND invocation_id=$2 AND phase=$3`, [binding.bindingId, binding.invocationId, input.phase])).rows[0];
      if (prior && (prior.attempt_id !== attempt.id || prior.owner_version !== attempt.owner_version || prior.runner_id !== runnerId)) {
        throw new HttpError(409, 'plugin_phase_already_bound', 'This package action belongs to an earlier attempt.');
      }
      if (input.phase === 'invoke' && !(await client.query(`SELECT 1 FROM flow.plugin_tool_authorizations
        WHERE binding_id=$1 AND invocation_id=$2 AND phase='load' AND attempt_id=$3 AND owner_version=$4 AND runner_id=$5`,
      [binding.bindingId, binding.invocationId, attempt.id, attempt.owner_version, runnerId])).rowCount) {
        throw new HttpError(409, 'plugin_load_not_authorized', 'Load authorization must precede invocation.');
      }
      if (!prior) await client.query(`INSERT INTO flow.plugin_tool_authorizations(binding_id,invocation_id,phase,task_id,attempt_id,
        owner_version,runner_id,registration_id,authorized_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [binding.bindingId, binding.invocationId, input.phase, task.id, attempt.id, attempt.owner_version, runnerId, binding.registrationId, current.revision]);
      return pluginGrantReceiptSchema.parse({ ...input, protocol: PLUGIN_RUNTIME_PROTOCOL, taskId: task.id, runnerId,
        authorizedRevision: prior?.authorized_revision ?? current.revision, replayed: prior !== undefined });
    });
    // Registration/advisory locks may have consumed the lease. This includes cached replays.
    // Check after every blocking authority operation; it is not a wall-clock guarantee through COMMIT.
    const stillLive = (await client.query<{ live: boolean }>('SELECT $1::timestamptz>clock_timestamp() AS live', [attempt.lease_expires_at])).rows[0]!.live;
    if (!stillLive) throw new HttpError(409, 'plugin_attempt_inactive', 'The tool attempt lease expired while authorization was pending.');
    return { ...result.value, replayed: result.replayed || result.value.replayed };
  });
}
