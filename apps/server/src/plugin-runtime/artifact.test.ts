import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { beforeEach, expect, test, vi } from 'vitest';
import { runnerEventSchema } from '../../../../packages/contracts/src/runner.js';
import type { PluginArtifactSource } from '../../../../packages/contracts/src/plugin-artifact.js';
import type { PluginToolBinding } from '../../../../packages/contracts/src/plugin-runtime.js';
import type { TaskRecord } from '../tasks.js';
import type { AttemptRecord } from '../runners.js';

const effects = vi.hoisted(() => ({ binding: vi.fn(), artifact: vi.fn(), detail: vi.fn(), timeline: vi.fn(), invoke: vi.fn() }));
vi.mock('./store.js', () => ({ readBinding: effects.binding }));
vi.mock('../evidence.js', () => ({ saveArtifact: effects.artifact, saveDetail: effects.detail, verifyArtifact: vi.fn() }));
vi.mock('../timeline.js', () => ({ appendTimeline: effects.timeline }));
vi.mock('../../../runner/src/plugins/host.js', async importOriginal => ({
  ...await importOriginal<typeof import('../../../runner/src/plugins/host.js')>(), invokeInstalledTool: effects.invoke,
}));
import { executePluginTool } from '../../../runner/src/plugins/execution.js';
import { textDigest } from '../../../runner/src/verifier.js';
import { applyEvent } from '../events.js';

function fixture() {
  const taskId = randomUUID(), runnerId = randomUUID(), attemptId = randomUUID();
  const source: PluginArtifactSource = { protocol: 'flow.plugin-artifact.v1', bindingId: randomUUID(), invocationId: randomUUID(),
    taskId, attemptId, ownerVersion: 2, installationId: 'a'.repeat(64), artifactId: randomUUID(), artifactSha256: 'b'.repeat(64),
    treeDigest: 'c'.repeat(64), hostApiMajor: 1 };
  const binding: PluginToolBinding = { protocol: 'flow.plugin-runtime.v1', bindingId: source.bindingId, invocationId: source.invocationId,
    taskId, targetRunnerId: runnerId, materialId: source.installationId, treeDigest: source.treeDigest, hostApiMajor: 1,
    artifact: { artifactId: source.artifactId, name: 'semver-compare', version: '1.0.0', sha256: source.artifactSha256, bytes: 99, integrity: 'sha512-'+'A'.repeat(86)+'==' },
    registrationId: randomUUID(), registrationRevision: 4, versionId: randomUUID(), scope: { workspaceId: 'personal', projectId: null },
    materialInstallOperationId: randomUUID(), storeId: 'trusted-store', configuration: {}, inputDigest: 'd'.repeat(64), createdAt: new Date().toISOString() };
  const task: TaskRecord = { id: taskId, submission: { harness: 'fixture', title: 'Tool', prompt: 'input' }, status: 'running', verification_status: 'pending',
    created_at: new Date(), updated_at: new Date(), cursor: 0, owner_version: 2, current_attempt_id: attemptId, pending_decision: null,
    usage: { inputTokens: null, outputTokens: null, costUsd: null, costKind: 'unknown', incomplete: true }, latest_artifact_id: null, latest_artifact_version: null };
  const attempt: AttemptRecord = { id: attemptId, task_id: taskId, runner_id: runnerId, owner_version: 2, lease_expires_at: new Date(Date.now()+5000),
    last_heartbeat_at: null, last_event_at: null, last_sequence: 0, native_session_id: null, completed_at: null };
  const query = vi.fn().mockResolvedValue({ rows: [{ phase: 'load' }, { phase: 'invoke' }], rowCount: 2 });
  const client = { query } as unknown as PoolClient;
  const event = { id: randomUUID(), sequence: 1, type: 'artifact' as const, artifactId: 'plugin-'+source.invocationId,
    title: 'Plugin tool output', content: '-1', mediaType: 'text/plain', version: 'e'.repeat(64), pluginSource: source };
  effects.binding.mockResolvedValue(binding);
  return { task, attempt, client, query, source, binding, event };
}
beforeEach(() => { vi.clearAllMocks(); effects.artifact.mockResolvedValue({ id: 'artifact-detail', title: 'Tool' });
  effects.detail.mockResolvedValue({ id: 'source-detail', title: 'Source association' }); });

test('legacy artifact codec preserves bytes and actual event entry performs no source query', async () => {
  const f=fixture(); const { pluginSource: _source, ...legacy }=f.event;
  expect(runnerEventSchema.parse(legacy)).toEqual(legacy);
  await applyEvent(f.client,f.task,f.attempt,legacy);
  expect(f.query).not.toHaveBeenCalled(); expect(effects.binding).not.toHaveBeenCalled();
  expect(effects.detail).not.toHaveBeenCalled(); expect(effects.artifact).toHaveBeenCalledOnce(); expect(effects.timeline).toHaveBeenCalledOnce();
});
test('real event entry validates binding and exact phase tuple before saving the associated artifact/reference', async () => {
  const f=fixture(); expect(runnerEventSchema.parse(f.event)).toEqual(f.event);
  await applyEvent(f.client,f.task,f.attempt,f.event);
  expect(f.query).toHaveBeenCalledWith(expect.stringContaining('FROM flow.plugin_tool_authorizations'),
    [f.source.bindingId,f.source.invocationId,f.task.id,f.attempt.id,2,f.attempt.runner_id]);
  expect(effects.detail).toHaveBeenCalledWith(f.client,f.task.id,f.attempt.id,expect.objectContaining({ artifactVersion: f.event.version,
    content: JSON.stringify({artifactId:f.event.artifactId,artifactVersion:f.event.version,pluginSource:f.source}) }));
  expect(effects.artifact.mock.invocationCallOrder[0]).toBeGreaterThan(f.query.mock.invocationCallOrder[0]!);
  expect(effects.timeline).toHaveBeenCalledTimes(2);
});
test.each(['bindingId','invocationId','taskId','attemptId','artifactId'] as const)('wrong %s is rejected before any artifact write', async key => {
  const f=fixture(); f.event.pluginSource={...f.source,[key]:randomUUID()};
  await expect(applyEvent(f.client,f.task,f.attempt,f.event)).rejects.toMatchObject({code:'plugin_artifact_identity'});
  expect(effects.artifact).not.toHaveBeenCalled(); expect(effects.detail).not.toHaveBeenCalled();
});
test.each(['installationId','artifactSha256','treeDigest','ownerVersion','runner'] as const)('wrong %s cannot reuse a source association', async key => {
  const f=fixture(); if(key==='runner')f.binding.targetRunnerId=randomUUID();
  else if(key==='ownerVersion')f.event.pluginSource={...f.source,ownerVersion:3};
  else f.event.pluginSource={...f.source,[key]:'f'.repeat(64)};
  await expect(applyEvent(f.client,f.task,f.attempt,f.event)).rejects.toMatchObject({code:'plugin_artifact_identity'});
  expect(effects.artifact).not.toHaveBeenCalled();
});
test.each([[],[{phase:'load'}],[{phase:'invoke'}],[{phase:'load'},{phase:'load'}]])('missing or duplicate phase evidence fails closed: %j', async rows => {
  const f=fixture(); f.query.mockResolvedValue({rows,rowCount:rows.length});
  await expect(applyEvent(f.client,f.task,f.attempt,f.event)).rejects.toMatchObject({code:'plugin_artifact_authorization'});
  expect(effects.artifact).not.toHaveBeenCalled();
});
test('typed source rejects extra, malformed and unbounded data without changing legacy codec', () => {
  const f=fixture(); for(const source of [{...f.source,privatePath:'/secret'}, {...f.source,installationId:'x'.repeat(65536)},
    {...f.source,ownerVersion:Number.MAX_SAFE_INTEGER+1},{...f.source,protocol:'unknown'}]) {
    expect(runnerEventSchema.safeParse({...f.event,pluginSource:source}).success).toBe(false);
  }
  expect(Buffer.byteLength(JSON.stringify(f.source))).toBeLessThan(1024);
});
test('a source storage failure propagates to the existing report transaction instead of fabricating success', async () => {
  const f=fixture(); const failure=new Error('database write failed'); effects.detail.mockRejectedValueOnce(failure);
  await expect(applyEvent(f.client,f.task,f.attempt,f.event)).rejects.toBe(failure);
  expect(effects.timeline).toHaveBeenCalledTimes(1);
});

test('existing execution producer carries its host source into the typed artifact and actual event consumer', async () => {
  const f=fixture(); f.binding.inputDigest=textDigest(f.task.submission.prompt);
  const {protocol: _protocol,...provenance}=f.source;
  effects.invoke.mockResolvedValue({kind:'text',content:'-1',provenance});
  const result=await executePluginTool({binding:f.binding,task:{...f.task.submission,id:f.task.id},
    runnerId:f.attempt.runner_id,ownership:{attemptId:f.attempt.id,ownerVersion:2},
    store:{root:'/unused-no-package-access',storeId:f.binding.storeId,allowedDigests:[f.binding.artifact.sha256]},
    signal:new AbortController().signal,assertOwnership:()=>{},authorize:async()=>{throw new Error('Host is injected for the producer mapping test');}});
  const event=runnerEventSchema.parse({...result.artifact,id:randomUUID(),sequence:1});
  expect(event).toMatchObject({type:'artifact',pluginSource:f.source});
  await applyEvent(f.client,f.task,f.attempt,event);
  expect(effects.detail).toHaveBeenCalledOnce();
});
