import { expect, test } from 'vitest';
import { pluginCommandSchema } from './plugins.js';
import { PLUGIN_RUNTIME_PROTOCOL, pluginGrantReceiptSchema, pluginHostPublicationSchema, pluginRuntimeCommandSchema,
  pluginRuntimeViewSchema, pluginToolBindingSchema, pluginToolTaskRequestSchema } from './plugin-runtime.js';

const id = '00000000-0000-4000-8000-000000000001';
const base = { expectedRevision: 1, reason: 'Owner enable' };
const binding = { protocol: PLUGIN_RUNTIME_PROTOCOL, bindingId: id, invocationId: id, taskId: id, registrationId: id,
  registrationRevision: 2, versionId: id, scope: { workspaceId: 'personal', projectId: null },
  materialInstallOperationId: id, targetRunnerId: id, storeId: 'owned-store', materialId: 'a'.repeat(64), treeDigest: 'b'.repeat(64),
  hostApiMajor: 1, artifact: { artifactId: id, name: 'owned-tool', version: '1.0.0', integrity: 'sha512-' + 'a'.repeat(86) + '==', bytes: 123, sha256: 'c'.repeat(64) },
  configuration: {}, inputDigest: 'd'.repeat(64), createdAt: '2026-10-06T23:00:00.000Z' };

test('new runtime commands do not extend the legacy mutation codec', () => {
  const enable = { ...base, change: { kind: 'enable', materialInstallOperationId: id, targetRunnerId: id, storeId: 'owned-store' } };
  expect(pluginRuntimeCommandSchema.parse(enable)).toEqual(enable);
  expect(pluginCommandSchema.safeParse(enable).success).toBe(false);
  expect(pluginRuntimeCommandSchema.safeParse({ ...base, change: { kind: 'configure', values: {} } }).success).toBe(false);
  for (const invalid of ['\0', '\ud800', '\udc00']) expect(pluginRuntimeCommandSchema.safeParse({ ...enable, reason: invalid }).success).toBe(false);
  for (const change of [{ kind: 'configure', values: {} }, { kind: 'set-grants', capabilities: ['tool'] }, { kind: 'select-version', versionId: id }]) {
    expect(pluginCommandSchema.safeParse({ ...base, change }).success).toBe(true);
  }
});
test('host publication is exact identity and accepts neither paths nor claim capability assertions', () => {
  const host = { protocol: PLUGIN_RUNTIME_PROTOCOL, storeId: 'owned-store', hostApiMajor: 1 };
  expect(pluginHostPublicationSchema.parse(host)).toEqual(host);
  for (const extra of [{ root: '/private' }, { claimCapable: true }, { runnerId: id }]) expect(pluginHostPublicationSchema.safeParse({ ...host, ...extra }).success).toBe(false);
  expect(pluginHostPublicationSchema.safeParse({ ...host, storeId: '/private/materials' }).success).toBe(false);
});
test('tool input has both task character and host UTF-8 byte bounds, without alternate execution options', () => {
  const task = { expectedRevision: 2, title: 'Compare versions', input: 'a'.repeat(16_000) };
  expect(pluginToolTaskRequestSchema.safeParse(task).success).toBe(true);
  expect(pluginToolTaskRequestSchema.safeParse({ ...task, input: '😀'.repeat(4096) }).success).toBe(true);
  expect(pluginToolTaskRequestSchema.safeParse({ ...task, input: '😀'.repeat(4097) }).success).toBe(false);
  expect(pluginToolTaskRequestSchema.safeParse({ ...task, input: '\ud800' }).success).toBe(false);
  expect(pluginToolTaskRequestSchema.safeParse({ ...task, input: '\udc00' }).success).toBe(false);
  expect(pluginToolTaskRequestSchema.parse({ ...task, input: '\ufeff😀' }).input).toBe('\ufeff😀');
  for (const invalid of ['\0', '\ud800', '\udc00']) {
    expect(pluginToolTaskRequestSchema.safeParse({ ...task, input: invalid }).success).toBe(false);
    expect(pluginToolTaskRequestSchema.safeParse({ ...task, title: 'title' + invalid }).success).toBe(false);
    expect(pluginToolTaskRequestSchema.safeParse({ ...task, verification: { kind: 'contains', expected: invalid } }).success).toBe(false);
  }
  for (const extra of [{ fixture: { scenario: 'success' } }, { resumeSessionId: id }, { executionProfile: {} }, { harness: 'claude' }]) {
    expect(pluginToolTaskRequestSchema.safeParse({ ...task, ...extra }).success).toBe(false);
  }
});
test('binding carries exact immutable material and finite configuration without input or local paths', () => {
  expect(pluginToolBindingSchema.parse(binding)).toEqual(binding);
  expect(pluginToolBindingSchema.safeParse({ ...binding, input: 'private input' }).success).toBe(false);
  expect(pluginToolBindingSchema.safeParse({ ...binding, root: '/private/materials' }).success).toBe(false);
  expect(pluginToolBindingSchema.safeParse({ ...binding, materialId: id }).success).toBe(false);
  expect(pluginToolBindingSchema.safeParse({ ...binding, artifact: { ...binding.artifact, source: { registry: 'https://example.org' } } }).success).toBe(false);
});
test('phase receipts preserve attempt fence and historical replay explicitly', () => {
  const value = { protocol: PLUGIN_RUNTIME_PROTOCOL, bindingId: id, invocationId: id, taskId: id, runnerId: id,
    attemptId: id, ownerVersion: 2, phase: 'invoke', authorizedRevision: 9, replayed: true };
  expect(pluginGrantReceiptSchema.parse(value)).toEqual(value);
  expect(pluginGrantReceiptSchema.safeParse({ ...value, phase: 'execute-again' }).success).toBe(false);
  expect(pluginGrantReceiptSchema.safeParse({ ...value, ownerVersion: 0 }).success).toBe(false);
});
test('enabled projection never claims loaded or callable and stale revisions cannot allow binding', () => {
  const value = { protocol: PLUGIN_RUNTIME_PROTOCOL, registrationId: id, currentRevision: 2, enabledRevision: 2,
    desiredEnabled: true, bindingAllowed: true, reason: 'ready', targetRunnerId: id, storeId: 'owned-store',
    materialInstallOperationId: id, loaded: 'unknown', callable: 'unknown' };
  expect(pluginRuntimeViewSchema.parse(value)).toEqual(value);
  expect(pluginRuntimeViewSchema.safeParse({ ...value, currentRevision: 3 }).success).toBe(false);
  expect(pluginRuntimeViewSchema.safeParse({ ...value, loaded: true }).success).toBe(false);
  expect(pluginRuntimeViewSchema.safeParse({ ...value, reason: 'revision-changed', bindingAllowed: false, currentRevision: 3 }).success).toBe(true);
  expect(pluginRuntimeViewSchema.safeParse({ ...value, enabledRevision: null, desiredEnabled: false, bindingAllowed: false, reason: 'not-enabled' }).success).toBe(false);
});
