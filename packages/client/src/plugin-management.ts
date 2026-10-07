import { pluginRemovalPageSchema, type PluginRemovalQuery, type PluginRemovalPage } from '../../contracts/src/plugin-removal.js';
import { pluginRuntimeViewSchema, pluginToolBindingSchema, type PluginRuntimeCommand, type PluginRuntimeView, type PluginToolBinding, type PluginToolTaskRequest } from '../../contracts/src/plugin-runtime.js';
import { pluginConfigurationSchema, pluginRevisionSchema, pluginScopeSchema, pluginVersionSchema, type PluginMutationResult, type PluginCommand, type PluginSnapshot } from '../../contracts/src/plugins.js';
import type { AcceptedTask } from '../../contracts/src/tasks.js';
import { pluginHostCandidatesPageSchema, type PluginHostCandidatesQuery, type PluginHostCandidatesPage } from '../../contracts/src/plugin-runtime-hosts.js';

/** Retain the exact recovery identity; never print its potentially private body. */
export type PluginRequestIdentity = Readonly<{ path: string; key?: string; body?: string }>;
export class UnknownPluginAcknowledgementError extends Error {
  readonly code = 'plugin_ack_unknown';
  readonly request: PluginRequestIdentity;
  constructor(request: PluginRequestIdentity) {
    super('The plugin response could not be verified. The request outcome is unknown.');
    this.name = 'UnknownPluginAcknowledgementError';
    this.request = Object.freeze({ ...request });
  }
}

export function pluginRequestIdentity(path: string, key?: string, input?: unknown): PluginRequestIdentity {
  if (key !== undefined && (!key.trim() || key.length > 200)) throw new TypeError('A nonempty command key of at most 200 characters is required.');
  return Object.freeze({ path, ...(key === undefined ? {} : { key, body: JSON.stringify(input) }) });
}

function requireAck(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid plugin acknowledgement');
}
function record(value: unknown): Record<string, unknown> {
  requireAck(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
const validUuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value));
const validDigest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

export function decodePluginRuntime(value: unknown, registrationId: string): PluginRuntimeView {
  const runtime = pluginRuntimeViewSchema.parse(value);
  requireAck(runtime.registrationId === registrationId);
  return runtime;
}
export function decodePluginBinding(value: unknown, taskId: string): PluginToolBinding {
  const binding = pluginToolBindingSchema.parse(value);
  requireAck(binding.taskId === taskId);
  return binding;
}

/** One advisory page. An empty scanned page can still carry an opaque next cursor. */
export function decodePluginHostCandidates(value: unknown, id: string, input: PluginHostCandidatesQuery): PluginHostCandidatesPage {
  const page = pluginHostCandidatesPageSchema.parse(value);
  requireAck(page.registrationId === id && page.materialInstallOperationId === input.materialInstallOperationId
    && (page.nextCursor === null || page.nextCursor !== input.cursor));
  let previous = '';
  for (const candidate of page.candidates) {
    requireAck(candidate.runnerId > previous);
    previous = candidate.runnerId;
  }
  return page;
}

/** Keep the server order: the opaque cursor can retain precision absent from createdAt. */
export function decodePluginRemovalReferences(value: unknown, id: string, input: PluginRemovalQuery): PluginRemovalPage {
  const page = pluginRemovalPageSchema.parse(value);
  requireAck(page.registrationId === id && page.materialInstallOperationId === input.materialInstallOperationId
    && (page.nextCursor === null || page.nextCursor !== input.cursor));
  requireAck(new Set(page.references.map(reference => reference.bindingId)).size === page.references.length);
  // A different install operation can refer to the same physical material in this registration.
  return page;
}

function decodePluginMutation(value: unknown, id: string, input: { expectedRevision: number; change: { kind: string } }): PluginMutationResult {
  const result = record(value), snapshot = record(result.snapshot), operation = record(result.operation);
  const installation = record(snapshot.installation), version = record(snapshot.version);
  const revision = pluginRevisionSchema.parse(input.expectedRevision + 1);
  const { id: versionId, createdAt, ...declaration } = version;
  const parsedVersion = pluginVersionSchema.parse(declaration);
  pluginScopeSchema.parse(installation.scope);
  pluginConfigurationSchema.parse(snapshot.configuration);
  requireAck(typeof result.replayed === 'boolean' && validUuid(versionId) && validDate(createdAt)
    && validUuid(operation.id) && validDate(operation.createdAt) && validDigest(operation.inputDigest)
    && operation.installationId === id && operation.kind === input.change.kind
    && operation.status === 'succeeded' && operation.actor === 'owner'
    && operation.beforeRevision === input.expectedRevision && operation.afterRevision === revision
    && installation.id === id && installation.revision === revision && snapshot.revision === revision
    && installation.packageName === parsedVersion.packageName
    && installation.registrationStatus === 'registered' && installation.runtimeStatus === 'unavailable'
    && installation.runtimeReason === 'package_not_verified_or_loaded'
    && validDate(installation.createdAt) && validDate(installation.updatedAt)
    && (snapshot.configurationStatus === 'ready' || snapshot.configurationStatus === 'incomplete')
    && Array.isArray(snapshot.grants) && snapshot.grants.length <= 4
    && new Set(snapshot.grants).size === snapshot.grants.length
    && snapshot.grants.every(grant => parsedVersion.capabilities.includes(grant as typeof parsedVersion.capabilities[number])));
  // Existing interface-only DTO fields have now been checked.
  return result as unknown as PluginMutationResult;
}

export function decodePluginRuntimeChanged(value: unknown, id: string, input: PluginRuntimeCommand): PluginMutationResult & { runtime: PluginRuntimeView } {
  const result = decodePluginMutation(value, id, input);
  const runtime = decodePluginRuntime(record(value).runtime, id);
  const revision = input.expectedRevision + 1;
  requireAck(runtime.currentRevision === revision);
  if (input.change.kind === 'enable') {
    requireAck(runtime.desiredEnabled && runtime.enabledRevision === revision
      && runtime.materialInstallOperationId === input.change.materialInstallOperationId
      && runtime.targetRunnerId === input.change.targetRunnerId && runtime.storeId === input.change.storeId);
  } else {
    requireAck(!runtime.desiredEnabled && runtime.enabledRevision === null && runtime.targetRunnerId === null
      && runtime.storeId === null && runtime.materialInstallOperationId === null);
  }
  return { ...result, runtime };
}

type PluginRegistryChange = Extract<PluginCommand['change'], { kind: 'configure' | 'set-grants' }>;
export type PluginRegistryCommand = Omit<PluginCommand, 'change'> & { change: PluginRegistryChange };

function checkConfiguration(snapshot: PluginSnapshot): void {
  const fields = new Map(snapshot.version.publicConfiguration.map(field => [field.key, field]));
  for (const [key, value] of Object.entries(snapshot.configuration)) {
    const field = fields.get(key);
    const valid = field?.kind === 'boolean' ? typeof value === 'boolean'
      : field?.kind === 'integer' ? typeof value === 'number' && Number.isInteger(value) && value >= field.min && value <= field.max
      : field?.kind === 'enum' ? typeof value === 'string' && field.values.includes(value) : false;
    requireAck(valid);
  }
  const incomplete = snapshot.version.publicConfiguration.some(field => field.required && !Object.hasOwn(snapshot.configuration, field.key));
  requireAck(snapshot.configurationStatus === (incomplete ? 'incomplete' : 'ready'));
}

/** Check the receipt at its recorded revision, including a historical replay; do not fetch current state. */
export function decodePluginRegistryChanged(value: unknown, id: string, input: PluginRegistryCommand): PluginMutationResult {
  const result = decodePluginMutation(value, id, input);
  checkConfiguration(result.snapshot);
  if (input.change.kind === 'configure') {
    const expected = input.change.values, actual = result.snapshot.configuration;
    requireAck(result.snapshot.configurationStatus === 'ready' && Object.keys(actual).length === Object.keys(expected).length
      && Object.entries(expected).every(([key, item]) => Object.hasOwn(actual, key) && actual[key] === item));
  } else {
    const expected = input.change.capabilities, actual = result.snapshot.grants;
    requireAck(actual.length === expected.length && actual.every((item, index) => item === expected[index]));
  }
  return result;
}

export async function decodePluginTaskAccepted(value: unknown, id: string, input: PluginToolTaskRequest): Promise<AcceptedTask & { binding: PluginToolBinding }> {
  const result = record(value), task = record(result.task);
  requireAck(validUuid(task.id));
  const binding = decodePluginBinding(result.binding, task.id as string);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.input));
  const inputDigest = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  requireAck(typeof result.replayed === 'boolean' && task.title === input.title && task.harness === 'fixture'
    && task.status === 'queued' && task.verificationStatus === 'pending'
    && validDate(task.createdAt) && validDate(task.updatedAt)
    && binding.registrationId === id && binding.registrationRevision === input.expectedRevision
    && binding.inputDigest === inputDigest);
  return { ...(result as unknown as AcceptedTask), binding };
}
