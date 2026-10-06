/** Static material only. Center installation state and invocation authority live elsewhere. */
export interface PackageArtifactIdentity {
  artifactId: string;
  name: string;
  version: string;
  bytes: number;
  sha256: string;
  integrity: string;
}
export interface TrustedPackageStore {
  root: string;
  storeId: string;
  allowedDigests: readonly string[];
}
export interface InstalledPackageReceipt {
  schemaVersion: 1;
  installationId: string;
  storeId: string;
  artifact: PackageArtifactIdentity;
  manifest: { schemaVersion: 1; hostApiMajor: 1; kind: 'tool'; entrypoint: string };
  files: readonly { path: string; bytes: number; sha256: string }[];
  treeDigest: string;
}
export interface InstalledPackage {
  receipt: InstalledPackageReceipt;
  /** Host-local location; never serialize this as a public DTO. */
  entrypoint: URL;
}
export interface PackageReadInput {
  artifact: PackageArtifactIdentity;
  store: TrustedPackageStore;
  signal?: AbortSignal;
}
export interface PackagePrepareInput extends PackageReadInput { tarballPath: string }
export class PackageStoreError extends Error {
  constructor(readonly code: string, readonly retained: readonly string[] = []) {
    super(`Package store operation failed: ${code}`);
    this.name = 'PackageStoreError';
  }
}
export async function prepareInstalledPackage(_input: PackagePrepareInput): Promise<InstalledPackage> {
  throw new PackageStoreError('NOT_IMPLEMENTED');
}
export async function readInstalledPackage(_input: PackageReadInput): Promise<InstalledPackage> {
  throw new PackageStoreError('NOT_IMPLEMENTED');
}
