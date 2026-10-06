export type PackageArtifactErrorCode = 'INVALID_REQUEST' | 'INVALID_CONFIGURATION' | 'SOURCE_REJECTED'
  | 'INTEGRITY_MISMATCH' | 'TOO_LARGE' | 'TIMEOUT' | 'CANCELLED' | 'FETCH_FAILED' | 'STORAGE_FAILED' | 'NOT_FOUND';

export class PackageArtifactError extends Error {
  constructor(readonly code: PackageArtifactErrorCode) {
    super(`Package artifact operation failed: ${code}`);
    this.name = 'PackageArtifactError';
  }
}

export function sanitizedFailure(error: unknown, signal?: AbortSignal): PackageArtifactError {
  if (signal?.aborted) return signal.reason instanceof PackageArtifactError
    ? signal.reason : new PackageArtifactError('CANCELLED');
  if (error instanceof PackageArtifactError) return error;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  if (['EACCES', 'EPERM', 'ENOSPC', 'EROFS', 'ENOTDIR', 'EMFILE'].includes(String(code))) {
    return new PackageArtifactError('STORAGE_FAILED');
  }
  return new PackageArtifactError(code === 'EINTEGRITY' ? 'INTEGRITY_MISMATCH' : 'FETCH_FAILED');
}
