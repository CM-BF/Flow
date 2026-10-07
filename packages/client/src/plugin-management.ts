import { pluginRuntimeViewSchema, pluginToolBindingSchema, type PluginRuntimeCommand, type PluginRuntimeView, type PluginToolBinding, type PluginToolTaskRequest } from '../../contracts/src/plugin-runtime.js';
import { pluginConfigurationSchema, pluginScopeSchema, pluginVersionSchema, type PluginMutationResult } from '../../contracts/src/plugins.js';
import type { AcceptedTask } from '../../contracts/src/tasks.js';

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

/** Only the runtime endpoint's two kinds are covered; legacy registry commands remain separate. */
export function decodePluginRuntimeChanged(value: unknown, id: string, input: PluginRuntimeCommand): PluginMutationResult & { runtime: PluginRuntimeView } {
  const result = record(value), snapshot = record(result.snapshot), operation = record(result.operation);
  const installation = record(snapshot.installation), version = record(snapshot.version);
  const runtime = decodePluginRuntime(result.runtime, id), revision = input.expectedRevision + 1;
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
    && runtime.currentRevision === revision && installation.packageName === parsedVersion.packageName
    && installation.registrationStatus === 'registered' && installation.runtimeStatus === 'unavailable'
    && installation.runtimeReason === 'package_not_verified_or_loaded'
    && validDate(installation.createdAt) && validDate(installation.updatedAt)
    && ['ready', 'incomplete'].includes(String(snapshot.configurationStatus))
    && Array.isArray(snapshot.grants) && snapshot.grants.length <= 4
    && new Set(snapshot.grants).size === snapshot.grants.length
    && snapshot.grants.every(grant => parsedVersion.capabilities.includes(grant as typeof parsedVersion.capabilities[number])));
  if (input.change.kind === 'enable') {
    requireAck(runtime.desiredEnabled && runtime.enabledRevision === revision
      && runtime.materialInstallOperationId === input.change.materialInstallOperationId
      && runtime.targetRunnerId === input.change.targetRunnerId && runtime.storeId === input.change.storeId);
  } else {
    requireAck(!runtime.desiredEnabled && runtime.enabledRevision === null && runtime.targetRunnerId === null
      && runtime.storeId === null && runtime.materialInstallOperationId === null);
  }
  // All fields of these existing interface-only DTOs were checked above.
  return { ...(result as unknown as PluginMutationResult), runtime };
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
