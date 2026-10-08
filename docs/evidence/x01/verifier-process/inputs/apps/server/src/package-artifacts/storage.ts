import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, open, readFile, rename, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import ssri from 'ssri';
import { packageArtifactSchema, type PackageArtifact } from '../../../../packages/contracts/src/package-artifacts.js';
import { PackageArtifactError } from './errors.js';
import type { SourceStream } from './source.js';

export interface StagedArtifact { directory: string; bytes: number; sha256: string }
export async function stageStream(root: string, stream: SourceStream, integrity: string, maxBytes: number,
  signal: AbortSignal): Promise<StagedArtifact> {
  // Pacote may invoke this callback again after corruption. No state/file/hash
  // from a previous callback may be reused, even inside one logical operation.
  let directory = '';
  // The pinned transport may forward a late socket error after the async
  // iterator has rejected. Keep an error listener on this owned stream; the
  // iterator still rejects the primary error and the operation never succeeds.
  stream.on('error', () => undefined);
  const sha256 = createHash('sha256');
  const verifier = ssri.create({ algorithms: ['sha512'] });
  let bytes = 0;
  let file;
  const abort = () => stream.destroy(new PackageArtifactError('CANCELLED'));
  signal.addEventListener('abort', abort, { once: true });
  try {
    signal.throwIfAborted();
    directory = await mkdtemp(join(root, 'body-'));
    file = await open(join(directory, 'package.tgz'), 'wx', 0o600);
    for await (const chunk of stream) {
      signal.throwIfAborted();
      bytes += chunk.byteLength;
      if (bytes > maxBytes) throw new PackageArtifactError('TOO_LARGE');
      verifier.update(chunk); sha256.update(chunk);
      await file.writeFile(chunk);
    }
    signal.throwIfAborted();
    if (bytes === 0 || verifier.digest().toString() !== integrity) throw new PackageArtifactError('INTEGRITY_MISMATCH');
    await file.sync();
    return { directory, bytes, sha256: sha256.digest('hex') };
  } catch (error) {
    stream.destroy();
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
    await file?.close();
  }
}

export async function publishArtifact(root: string, staged: StagedArtifact, receipt: PackageArtifact, signal: AbortSignal): Promise<void> {
  const file = await open(join(staged.directory, 'receipt.json'), 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(receipt) + '\n'); await file.sync(); } finally { await file.close(); }
  await chmod(join(staged.directory, 'package.tgz'), 0o400);
  await chmod(join(staged.directory, 'receipt.json'), 0o400);
  await mkdir(join(root, 'artifacts'), { recursive: true, mode: 0o700 });
  // Random internal UUIDs avoid caller path control and concurrent overwrite.
  signal.throwIfAborted();
  await rename(staged.directory, join(root, 'artifacts', receipt.artifactId));
}

export async function readPackageArtifact(root: string, artifactId: string): Promise<PackageArtifact> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(artifactId)) throw new PackageArtifactError('INVALID_REQUEST');
  const directory = join(root, 'artifacts', artifactId);
  try {
    if ((await stat(join(directory, 'receipt.json'))).size > 4096) throw new PackageArtifactError('STORAGE_FAILED');
    const receipt = packageArtifactSchema.parse(JSON.parse(await readFile(join(directory, 'receipt.json'), 'utf8')));
    if (receipt.artifactId !== artifactId) throw new PackageArtifactError('STORAGE_FAILED');
    const verifier = ssri.create({ algorithms: ['sha512'] });
    const sha256 = createHash('sha256');
    let bytes = 0;
    for await (const chunk of createReadStream(join(directory, 'package.tgz'))) {
      bytes += chunk.length;
      if (bytes > receipt.bytes) throw new PackageArtifactError('INTEGRITY_MISMATCH');
      verifier.update(chunk); sha256.update(chunk);
    }
    if (bytes !== receipt.bytes || sha256.digest('hex') !== receipt.sha256 || verifier.digest().toString() !== receipt.integrity) {
      throw new PackageArtifactError('INTEGRITY_MISMATCH');
    }
    return receipt;
  } catch (error) {
    if (error instanceof PackageArtifactError) throw error;
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') throw new PackageArtifactError('NOT_FOUND');
    throw new PackageArtifactError('STORAGE_FAILED');
  }
}
