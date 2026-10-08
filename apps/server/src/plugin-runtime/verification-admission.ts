import { assertVerificationInputFits } from '../../../../packages/plugin-runtime/src/verification-input.js';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { PgBoss } from 'pg-boss';
import { pluginVerificationAdmissionSchema, verificationAdmissionIdentity, type PluginVerificationAdmission } from '../../../../packages/contracts/src/plugin-verification-admission.js';
import { pluginVerificationRequestSchema } from '../../../../packages/contracts/src/plugin-verification.js';
import { PLUGIN_RUNTIME_PROTOCOL } from '../../../../packages/contracts/src/plugin-runtime.js';
import { HttpError, sha256 } from '../database.js';
import { acceptTask, command } from '../tasks.js';
import { applyProjectCommand } from '../projects/commands.js';
import { loadProject } from '../projects/storage.js';
import { loadInstallation, readSnapshot } from '../plugins/storage.js';
import { assertTrustedVerifier, type TrustedPluginVerifierPolicy } from '../plugin-verification-configuration.js';
import { assertSourceProject } from './verification.js';
import { assertPluginHost, assertTrustedPluginHost, installedMaterial, latestRuntimeRevision, recordBinding, type TrustedPluginHostPolicy } from './store.js';

/** No transaction is opened here. Project identity is derived before acquiring its mutation lock. */
export async function lockSourceProject(client: PoolClient, taskId: string, workspaceId: string, scopedProject: string | null, expectedRevision: number) {
  const authorities = (await client.query<{ project_id: string | null }>(`SELECT project_id FROM flow.project_task_bindings WHERE task_id=$1
    UNION ALL SELECT c.project_id FROM flow.conversation_turns ct JOIN flow.conversations c ON c.id=ct.conversation_id WHERE ct.task_id=$1 LIMIT 3`, [taskId])).rows;
  const projectId = authorities[0]?.project_id;
  if (!projectId || authorities.length > 2 || authorities.some(row => row.project_id !== projectId) || scopedProject !== null && scopedProject !== projectId) {
    throw new HttpError(409, 'verification_source_project', 'The source requires one unambiguous authorized project.');
  }
  const project = await loadProject(client, projectId, true);
  if (project.workspace_id !== workspaceId || project.revision !== expectedRevision) throw new HttpError(409, 'stale_source_project', 'Reload the exact source project revision.');
  await assertSourceProject(client, taskId, projectId, workspaceId);
  return project;
}

/** Public owner route must authenticate before this command, including cached replies. */
export async function admitPluginVerification(pool: Pool, boss: PgBoss, registrationId: string, raw: PluginVerificationAdmission,
  key: string, hosts: TrustedPluginHostPolicy, algorithms: TrustedPluginVerifierPolicy) {
  const input = pluginVerificationAdmissionSchema.parse(raw);
  const requestIdentity = verificationAdmissionIdentity(registrationId, input);
  const result = await command(pool, `plugin.verification-task:${registrationId}`, key, input, async client => {
    const candidate = await latestRuntimeRevision(client, registrationId);
    if (!candidate?.desired_enabled || !candidate.target_runner_id || !candidate.store_id || !candidate.material_install_operation_id) {
      throw new HttpError(409, 'plugin_not_enabled', 'Enable the exact verifier before creating a verification task.');
    }
    await assertPluginHost(client, candidate.target_runner_id, candidate.store_id);
    assertTrustedPluginHost(hosts, { protocol: PLUGIN_RUNTIME_PROTOCOL, runnerId: candidate.target_runner_id, storeId: candidate.store_id, hostApiMajor: 1 });
    const installation = await loadInstallation(client, registrationId, true);
    const current = await readSnapshot(client, registrationId);
    const runtime = await latestRuntimeRevision(client, registrationId);
    if (installation.revision !== input.expectedRevision || !runtime?.desired_enabled || runtime.revision !== current.revision || runtime.revision !== candidate.revision) {
      throw new HttpError(409, 'plugin_revision_conflict', 'Reload and enable the current verifier revision.');
    }
    if (!current.grants.includes('verifier') || current.configurationStatus !== 'ready') throw new HttpError(403, 'plugin_verifier_grant_required', 'Current verifier permission and configuration are required.');
    const material = await installedMaterial(client, current, candidate.material_install_operation_id, candidate.store_id, 'verifier');
    assertTrustedVerifier(algorithms, { artifactSha256: material.artifact.sha256, treeDigest: material.treeDigest, hostApiMajor: 1,
      algorithmId: input.rule.algorithmId, algorithmVersion: input.rule.algorithmVersion });
    const project = await lockSourceProject(client, input.source.taskId, current.installation.scope.workspaceId, current.installation.scope.projectId, input.expectedSourceProjectRevision);
    const artifact = (await client.query<{ content: string }>(`SELECT d.content FROM flow.artifacts a JOIN flow.details d ON d.id=a.detail_id
      WHERE a.task_id=$1 AND a.attempt_id=$2 AND a.artifact_id=$3 AND a.version=$4
      AND d.task_id=a.task_id AND d.attempt_id=a.attempt_id AND d.artifact_version=a.version AND octet_length(d.content)<=8192 LIMIT 1`,
    [input.source.taskId, input.source.attemptId, input.source.artifactId, input.source.version])).rows[0];
    if (!artifact || sha256(artifact.content) !== input.source.version) throw new HttpError(409, 'verification_source_missing', 'The exact bounded source artifact is unavailable.');
    const verification = pluginVerificationRequestSchema.parse({ source: { ...input.source, content: artifact.content }, rule: input.rule });
    const prompt = JSON.stringify(verification);
    try { assertVerificationInputFits(verification); } catch { throw new HttpError(413, 'verification_input_limit', 'The complete source and rule exceed the verifier input limit.'); }
    const created = await acceptTask(client, boss, { title: input.title, prompt, harness: 'fixture' });
    const changed = await applyProjectCommand(client, project.id, { expectedRevision: input.expectedSourceProjectRevision,
      reason: 'Create exact-artifact verification task', change: { kind: 'add-node', title: input.title, taskId: created.id, parent: null } });
    const node = changed.snapshot.graph.nodes.find(value => value.id === changed.changedNodeId);
    const task = changed.snapshot.tasks.find(value => value.id === node?.taskId);
    if (!task || task.id !== created.id) throw new Error('Verification project binding was not created.');
    const binding = await recordBinding(client, { protocol: PLUGIN_RUNTIME_PROTOCOL, bindingId: randomUUID(), invocationId: randomUUID(), taskId: task.id,
      registrationId, registrationRevision: current.revision, versionId: current.version.id, scope: current.installation.scope,
      materialInstallOperationId: candidate.material_install_operation_id, targetRunnerId: candidate.target_runner_id, storeId: candidate.store_id,
      materialId: material.installationId, treeDigest: material.treeDigest, hostApiMajor: 1, artifact: material.artifact,
      configuration: current.configuration, inputDigest: sha256(prompt) });
    await client.query(`INSERT INTO flow.plugin_verification_references(binding_id,source_task_id,source_attempt_id,artifact_id,artifact_version,project_id,rule)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [binding.bindingId, input.source.taskId, input.source.attemptId, input.source.artifactId, input.source.version, project.id, JSON.stringify(input.rule)]);
    return { task, binding, project: { id: project.id, revision: changed.snapshot.project.revision, nodeId: node!.id } };
  });
  // command() has already compared the normalized digest, including historical receipts.
  return { ...result.value, replayed: result.replayed, requestIdentity };
}
