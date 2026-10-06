import type { PackageArtifactIdentity, TrustedPackageStore } from '@flow/plugin-runtime';

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
  authorize(binding: Readonly<FrozenToolInvocation>): Promise<void>;
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
export async function invokeInstalledTool(_input: PluginToolInput): Promise<PluginToolResult> {
  throw new PluginToolError('NOT_IMPLEMENTED');
}
