import type { PluginVerifierExecution } from '../../../../packages/contracts/src/verifier-runner-claim.js';
import type { PluginVerifierBinding } from '../../../../packages/contracts/src/plugin-verification-binding.js';
import { bindingExecutionKind, claimVerificationReference } from './verification.js';
import type { PoolClient } from 'pg';
import type { PluginToolExecution } from '../../../../packages/contracts/src/plugin-runner-claim.js';
import type { PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
import type { TaskRecord } from '../tasks.js';
import { HttpError, sha256 } from '../database.js';
import { loadInstallation, readSnapshot } from '../plugins/storage.js';
import { readBinding } from './store.js';

/** Applied before ORDER/LIMIT. $2 is authenticated runner, $3/$4 the current v3 host tuple.
 * Disabled registrations retain accepted pins; current tool permission is always required. */
export const pluginClaimEligibilitySql = `AND (
  NOT EXISTS (SELECT 1 FROM flow.plugin_tool_bindings pb WHERE pb.task_id=t.id)
  OR EXISTS (SELECT 1 FROM flow.plugin_tool_bindings pb
    JOIN flow.plugin_binding_executions be ON be.binding_id=pb.id
    JOIN flow.plugin_runtime_hosts ph ON ph.runner_id=pb.target_runner_id AND ph.store_id=pb.store_id AND ph.host_api_major=pb.host_api_major
    JOIN flow.plugin_installations pi ON pi.id=pb.registration_id
    JOIN flow.plugin_revisions pr ON pr.installation_id=pi.id AND pr.revision=pi.revision
    WHERE pb.task_id=t.id AND pb.target_runner_id=$2 AND (
      (be.kind='tool' AND pb.store_id=$3 AND pb.host_api_major=$4 AND pr.grants ? 'tool')
      OR (be.kind='verifier' AND pb.store_id=$5 AND pb.host_api_major=$6 AND pr.grants ? 'verifier'
        AND EXISTS (SELECT 1 FROM flow.plugin_verification_references vr WHERE vr.binding_id=pb.id
          AND $7::jsonb @> jsonb_build_array(jsonb_build_object('id',vr.rule->>'algorithmId','version',(vr.rule->>'algorithmVersion')::integer)))))))`;

/** Caller holds runner then task (and attempt on replay). Registration lock fences grant changes.
 * This returns the original immutable pin, never a new binding or a phase authorization. */
export async function claimPluginBinding(client: PoolClient, task: TaskRecord, runnerId: string,
  qualification?: PluginToolExecution, verifier?: PluginVerifierExecution): Promise<PluginToolBinding | PluginVerifierBinding | undefined> {
  const exists = await client.query('SELECT 1 FROM flow.plugin_tool_bindings WHERE task_id=$1', [task.id]);
  if (!exists.rowCount) return undefined;
  const binding = await readBinding(client, task.id);
  const kind = await bindingExecutionKind(client, binding.bindingId);
  const hostQualification = kind === 'verifier' ? verifier : qualification;
  if (!hostQualification || binding.targetRunnerId !== runnerId || binding.storeId !== hostQualification.storeId
    || binding.hostApiMajor !== hostQualification.hostApiMajor
    || (kind === 'tool' && binding.protocol !== qualification?.bindingProtocol)
    || binding.inputDigest !== sha256(task.submission.prompt)) {
    throw new HttpError(409, 'plugin_claim_unavailable', 'The frozen binding does not match the current plugin host.');
  }
  await loadInstallation(client, binding.registrationId, true);
  const current = await readSnapshot(client, binding.registrationId);
  const host = await client.query('SELECT 1 FROM flow.plugin_runtime_hosts WHERE runner_id=$1 AND store_id=$2 AND host_api_major=$3',
    [runnerId, hostQualification.storeId, hostQualification.hostApiMajor]);
  if (!current.grants.includes(kind) || !host.rowCount
    || current.installation.scope.workspaceId !== binding.scope.workspaceId || current.installation.scope.projectId !== binding.scope.projectId) {
    throw new HttpError(409, 'plugin_claim_unavailable', 'Current tool permission and the exact published host are required.');
  }
  return kind === 'verifier' ? claimVerificationReference(client, task, binding, verifier!) : binding;
}
