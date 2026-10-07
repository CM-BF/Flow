import { createHash } from 'node:crypto';
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const id = uuid(1), taskId = uuid(2), now = '2026-10-07T10:00:00.000Z';
export const command = { expectedRevision: 2, reason: 'Enable installed material', change: { kind: 'enable' as const, materialInstallOperationId: uuid(3), targetRunnerId: uuid(4), storeId: 'store-1' } };
export const input = { expectedRevision: 3, title: 'Compare', input: '古😀', verification: { kind: 'contains' as const, expected: '1' } };
export const runtime = () => ({ protocol: 'flow.plugin-runtime.v1', registrationId: id, currentRevision: 3, enabledRevision: 3, desiredEnabled: true, bindingAllowed: true, reason: 'ready', ...command.change, loaded: 'unknown', callable: 'unknown' });
export function runtimeView() { const { kind, ...value } = runtime(); return value; }
export const binding = () => ({ protocol: 'flow.plugin-runtime.v1', bindingId: uuid(5), invocationId: uuid(6), taskId, registrationId: id, registrationRevision: 3, versionId: uuid(7), scope: { workspaceId: 'personal', projectId: null },
  materialInstallOperationId: uuid(3), targetRunnerId: uuid(4), storeId: 'store-1', materialId: 'a'.repeat(64), treeDigest: 'b'.repeat(64), hostApiMajor: 1,
  artifact: { artifactId: uuid(8), name: 'test-tool', version: '1.0.0', integrity: 'sha512-'+Buffer.alloc(64).toString('base64'), bytes: 100, sha256: 'c'.repeat(64) }, configuration: {},
  inputDigest: createHash('sha256').update(input.input).digest('hex'), createdAt: now });
export const accepted = () => ({ replayed: false, task: { id: taskId, title: input.title, harness: 'fixture', status: 'queued', verificationStatus: 'pending', createdAt: now, updatedAt: now }, binding: binding() });
export const changed = () => ({ replayed: false, runtime: runtimeView(), operation: { id: uuid(9), installationId: id, kind: 'enable', status: 'succeeded', actor: 'owner', inputDigest: 'd'.repeat(64), beforeRevision: 2, afterRevision: 3, createdAt: now },
  snapshot: { revision: 3, installation: { id, scope: { workspaceId: 'personal', projectId: null }, packageName: 'test-tool', revision: 3, registrationStatus: 'registered', runtimeStatus: 'unavailable', runtimeReason: 'package_not_verified_or_loaded', createdAt: now, updatedAt: now },
    version: { id: uuid(7), createdAt: now, packageName: 'test-tool', packageVersion: '1.0.0', source: 'npm', declaredSha256: 'c'.repeat(64), license: 'MIT', hostApiMajor: 1, capabilities: ['tool'], publicConfiguration: [] }, configuration: {}, configurationStatus: 'ready', grants: ['tool'] } });
export const response = (body: unknown, status=200) => new Response(JSON.stringify(body), { status });
