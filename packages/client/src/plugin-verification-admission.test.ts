import { afterEach, expect, test, vi } from 'vitest';
import { FlowApiError, FlowClient, UnknownPluginAcknowledgementError } from './index.js';
import { pluginVerificationAdmissionSchema, verificationAdmissionIdentity, type PluginVerificationAdmission } from '../../contracts/src/plugin-verification-admission.js';
const uuid = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const registration = uuid(1), project = uuid(2), taskId = uuid(3);
function input(): PluginVerificationAdmission { return { expectedRevision: 2, expectedSourceProjectRevision: 3, title: '  Verify  ', source: { taskId: 'source', attemptId: 'attempt', artifactId: 'artifact', version: 'a'.repeat(64) }, rule: { schemaVersion: 1, algorithmId: 'flow.json-object.required-keys', algorithmVersion: 1, requiredKeys: ['z', 'a'] } }; }
function acknowledgement() {
  const body = pluginVerificationAdmissionSchema.parse(input());
  return { task: { id: taskId, title: 'Verify', harness: 'fixture', status: 'queued', verificationStatus: 'pending', createdAt: '2026-10-08T00:00:00.000Z', updatedAt: '2026-10-08T00:00:00.000Z' }, replayed: false,
    project: { id: project, revision: 4, nodeId: uuid(4) }, requestIdentity: verificationAdmissionIdentity(registration, body),
    binding: { protocol: 'flow.plugin-runtime.v1', bindingId: uuid(5), invocationId: uuid(6), taskId, registrationId: registration, registrationRevision: 2, versionId: uuid(7),
      scope: { workspaceId: 'personal', projectId: null as string | null }, materialInstallOperationId: uuid(8), targetRunnerId: uuid(9), storeId: 'store', materialId: 'b'.repeat(64), treeDigest: 'c'.repeat(64), hostApiMajor: 1,
      artifact: { artifactId: uuid(10), name: 'verifier', version: '1.0.0', integrity: `sha512-${'A'.repeat(86)}==`, bytes: 10, sha256: 'd'.repeat(64) }, configuration: {}, inputDigest: 'e'.repeat(64), createdAt: '2026-10-08T00:00:00.000Z' } };
}
function client() { return new FlowClient({ baseUrl: 'https://flow.example', token: 'owner' }); }
afterEach(() => vi.unstubAllGlobals());
test('SDK verification admission freezes normalized body and forwards key, authentication and AbortSignal', async () => {
  let respond!: (response: Response) => void;
  const fetch = vi.fn((_url: string | URL | Request, _init?: RequestInit) => new Promise<Response>(resolve => { respond = resolve; })); vi.stubGlobal('fetch', fetch);
  const body = input(), controller = new AbortController(), signal = controller.signal;
  const pending = client().admitPluginVerificationTask(registration, body, 'original-key', signal);
  body.title = 'mutated'; body.source.version = 'f'.repeat(64); body.rule.requiredKeys.push('mutated');
  respond(new Response(JSON.stringify(acknowledgement())));
  expect((await pending).binding.scope.projectId).toBeNull();
  const [url, init] = fetch.mock.calls[0]!;
  expect(String(url)).toBe(`https://flow.example/api/plugins/${registration}/verification-tasks`);
  expect(init?.signal?.aborted).toBe(false); const reason = new Error('caller cancelled'); controller.abort(reason); expect(init?.signal?.aborted).toBe(true); expect(init?.signal?.reason).toBe(reason); expect(new Headers(init?.headers).get('authorization')).toBe('Bearer owner'); expect(new Headers(init?.headers).get('idempotency-key')).toBe('original-key');
  expect(JSON.parse(init!.body as string)).toEqual(pluginVerificationAdmissionSchema.parse(input())); expect(fetch).toHaveBeenCalledTimes(1);
});
test.each(['missing', 'registration', 'revision', 'projectRevision', 'title', 'source', 'rule', 'protocol'] as const)('SDK refuses %s request identity without fabricating proof', async kind => {
  const ack = acknowledgement(); const raw = ack as unknown as Record<string, unknown>;
  if (kind === 'missing') delete raw.requestIdentity;
  else if (kind === 'registration') ack.requestIdentity.registrationId = uuid(99);
  else if (kind === 'revision') ack.requestIdentity.expectedRevision++;
  else if (kind === 'projectRevision') ack.requestIdentity.expectedSourceProjectRevision++;
  else if (kind === 'title') ack.requestIdentity.title = 'different';
  else if (kind === 'source') ack.requestIdentity.source.attemptId = 'different';
  else if (kind === 'rule') ack.requestIdentity.rule.requiredKeys = ['different'];
  else (raw.requestIdentity as Record<string, unknown>).protocol = 'future';
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(raw))); vi.stubGlobal('fetch', fetch);
  await expect(client().admitPluginVerificationTask(registration, input(), 'same-key')).rejects.toMatchObject({ code: 'plugin_ack_unknown', request: { key: 'same-key', body: JSON.stringify(pluginVerificationAdmissionSchema.parse(input())) } });
  expect(fetch).toHaveBeenCalledTimes(1);
});
test.each(['binding-task', 'binding-registration', 'binding-revision', 'scope', 'project', 'node', 'project-revision'] as const)('SDK rejects inconsistent %s acknowledgement linkage', async kind => {
  const ack = acknowledgement();
  if (kind === 'binding-task') ack.binding.taskId = uuid(99);
  if (kind === 'binding-registration') ack.binding.registrationId = uuid(99);
  if (kind === 'binding-revision') ack.binding.registrationRevision++;
  if (kind === 'scope') ack.binding.scope.projectId = uuid(99);
  if (kind === 'project') ack.project.id = 'bad';
  if (kind === 'node') ack.project.nodeId = 'bad';
  if (kind === 'project-revision') ack.project.revision++;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(ack))));
  await expect(client().admitPluginVerificationTask(registration, input(), 'key')).rejects.toBeInstanceOf(UnknownPluginAcknowledgementError);
});
test('SDK accepts matching project scope and historical replay without a current-state GET', async () => {
  const ack = acknowledgement(); ack.binding.scope.projectId = project; ack.replayed = true;
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(ack))); vi.stubGlobal('fetch', fetch);
  expect((await client().admitPluginVerificationTask(registration, input(), 'key')).replayed).toBe(true); expect(fetch).toHaveBeenCalledTimes(1);
});
test.each([65536, 65537])('SDK admission enforces the exact %i-byte response boundary', async bytes => {
  const json = JSON.stringify(acknowledgement()); const raw = json + ' '.repeat(bytes - Buffer.byteLength(json));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(raw)));
  const request = client().admitPluginVerificationTask(registration, input(), 'key');
  if (bytes === 65536) expect((await request).task.id).toBe(taskId);
  else await expect(request).rejects.toBeInstanceOf(UnknownPluginAcknowledgementError);
});
test('SDK typed rejection and transport uncertainty retain distinct recovery behavior', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'idempotency_conflict', message: 'Conflict' } }), { status: 409 })).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError')).mockResolvedValueOnce(new Response(JSON.stringify({ ...acknowledgement(), replayed: true })));
  vi.stubGlobal('fetch', fetch); const api = client();
  await expect(api.admitPluginVerificationTask(registration, input(), 'key')).rejects.toBeInstanceOf(FlowApiError);
  await expect(api.admitPluginVerificationTask(registration, input(), 'key')).rejects.toMatchObject({ code: 'plugin_ack_unknown', request: { key: 'key' } });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect((await api.admitPluginVerificationTask(registration, input(), 'key')).replayed).toBe(true);
  expect(fetch.mock.calls[1]![1].body).toBe(fetch.mock.calls[2]![1].body);
});
