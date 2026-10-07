import { readInstalledPackage, type PackageArtifactIdentity, type TrustedPackageStore } from '@flow/plugin-runtime';

/** Local consumer input. The future center binding/claim DTO remains separately owned. */
export interface FrozenToolInvocation {
  bindingId: string;
  invocationId: string;
  taskId: string;
  attemptId: string;
  ownerVersion: number;
  material: { installationId: string; storeId: string; artifact: PackageArtifactIdentity; treeDigest: string };
  configuration: Readonly<Record<string, string>>;
}
export interface PluginToolInput {
  store: TrustedPackageStore;
  binding: FrozenToolInvocation;
  input: string;
  signal: AbortSignal;
  /** Check current permission at each phase; an earlier ACK does not authorize the next action. */
  authorize(binding: Readonly<FrozenToolInvocation>, phase: 'load' | 'invoke'): Promise<void>;
  assertOwnership(): void | Promise<void>;
}
export interface PluginToolResult {
  kind: 'text';
  content: string;
  provenance: { bindingId: string; invocationId: string; taskId: string; attemptId: string; ownerVersion: number;
    installationId: string; artifactId: string; artifactSha256: string; treeDigest: string; hostApiMajor: 1 };
}
export class PluginToolError extends Error {
  constructor(readonly code: string) { super(`Plugin tool operation failed: ${code}`); this.name = 'PluginToolError'; }
}
const LIMIT = 16 * 1024;
function checkAbort(signal: AbortSignal) { if (signal.aborted) throw new PluginToolError('CANCELLED'); }
function frozenInvocation(input: PluginToolInput): FrozenToolInvocation {
  const b = input.binding;
  if (typeof input.input !== 'string' || Buffer.byteLength(input.input) > LIMIT
    || typeof input.authorize !== 'function' || typeof input.assertOwnership !== 'function' || !b
    || [b.bindingId, b.invocationId, b.taskId, b.attemptId].some(id => typeof id !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))
    || !Number.isSafeInteger(b.ownerVersion) || b.ownerVersion < 1 || !b.material
    || !/^[a-f0-9]{64}$/.test(b.material.installationId) || !/^[a-f0-9]{64}$/.test(b.material.treeDigest)
    || !b.configuration || typeof b.configuration !== 'object' || Array.isArray(b.configuration)
    || Object.entries(b.configuration).some(([key, value]) => !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) || typeof value !== 'string')
    || Buffer.byteLength(JSON.stringify(b.configuration)) > LIMIT) throw new PluginToolError('INVALID_INPUT');
  const artifact = Object.freeze({ ...b.material.artifact });
  return Object.freeze({ bindingId: b.bindingId, invocationId: b.invocationId, taskId: b.taskId, attemptId: b.attemptId, ownerVersion: b.ownerVersion,
    material: Object.freeze({ installationId: b.material.installationId, storeId: b.material.storeId, treeDigest: b.material.treeDigest, artifact }),
    configuration: Object.freeze({ ...b.configuration }) });
}
/** Abort ends observation, not package execution. The caller must retain uncertain runtime refs. */
function pending<T>(operation: () => T | Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    let started = false; let finished = false;
    const finish = (ok: boolean, value: unknown) => {
      if (finished) return; finished = true; signal.removeEventListener('abort', abort);
      if (ok) resolve(value as T); else reject(value);
    };
    const abort = () => finish(false, new PluginToolError(started ? 'OUTCOME_UNKNOWN' : 'CANCELLED'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    started = true;
    try { Promise.resolve(operation()).then(value => finish(true, value), () => finish(false, new PluginToolError('PACKAGE_FAILED'))); }
    catch { finish(false, new PluginToolError('PACKAGE_FAILED')); }
  });
}
export function invokeInstalledTool(input: PluginToolInput): Promise<PluginToolResult> {
  return invokeInstalledPackage(input, 'tool');
}
/** Explicit local verifier consumer; an installed verifier can never enter the legacy tool path. */
export function invokeInstalledVerifier(input: PluginToolInput): Promise<PluginToolResult> {
  return invokeInstalledPackage(input, 'verifier');
}
async function invokeInstalledPackage(input: PluginToolInput, kind: 'tool' | 'verifier'): Promise<PluginToolResult> {
  checkAbort(input.signal);
  const binding = frozenInvocation(input); const text = input.input;
  const installed = await readInstalledPackage({ artifact: binding.material.artifact, store: input.store, signal: input.signal });
  if (installed.receipt.installationId !== binding.material.installationId || installed.receipt.storeId !== binding.material.storeId
    || installed.receipt.treeDigest !== binding.material.treeDigest) throw new PluginToolError('MATERIAL_MISMATCH');
  if (installed.receipt.manifest.kind !== kind) throw new PluginToolError('PACKAGE_KIND_MISMATCH');
  checkAbort(input.signal); await input.assertOwnership();
  // An ES module's top level is executable, so loading needs its own current grant.
  await input.authorize(binding, 'load'); checkAbort(input.signal); await input.assertOwnership(); checkAbort(input.signal);
  // Keep the canonical installation URL stable: no per-invocation query/fragment or require.cache manipulation.
  const module = await pending(() => import(installed.entrypoint.href) as Promise<Record<string, unknown>>, input.signal);
  if (module.hostApiMajor !== 1 || typeof module.invoke !== 'function') throw new PluginToolError('HOST_API_MISMATCH');
  await input.assertOwnership(); checkAbort(input.signal);
  // Import may have awaited while permissions changed. Preserve authorization errors unchanged.
  await input.authorize(binding, 'invoke'); checkAbort(input.signal); await input.assertOwnership(); checkAbort(input.signal);
  const invoke = module.invoke as (value: { input: string; config: Readonly<Record<string, string>>; signal: AbortSignal }) => unknown;
  const output = await pending(() => invoke({ input: text, config: binding.configuration, signal: input.signal }), input.signal);
  await input.assertOwnership(); checkAbort(input.signal);
  if (typeof output !== 'string' || Buffer.byteLength(output) > LIMIT) throw new PluginToolError('OUTPUT_REJECTED');
  return { kind: 'text', content: output, provenance: { bindingId: binding.bindingId, invocationId: binding.invocationId,
    taskId: binding.taskId, attemptId: binding.attemptId, ownerVersion: binding.ownerVersion, installationId: installed.receipt.installationId,
    artifactId: installed.receipt.artifact.artifactId, artifactSha256: installed.receipt.artifact.sha256,
    treeDigest: installed.receipt.treeDigest, hostApiMajor: 1 } };
}
