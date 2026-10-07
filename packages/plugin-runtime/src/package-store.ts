import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { Parser } from 'tar';

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
  manifest: { schemaVersion: 1; hostApiMajor: 1; kind: 'tool' | 'verifier'; entrypoint: string };
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
const MAX_ARCHIVE = 8 * 1024 * 1024;
const MAX_EXPANDED = 1024 * 1024;
const MAX_FILE = 256 * 1024;
const MAX_JSON = 16 * 1024;
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
function fail(code: string): never { throw new PackageStoreError(code); }
const cancelled = (signal?: AbortSignal) => { if (signal?.aborted) fail('CANCELLED'); };
const isCode = (error: unknown, code: string) => !!error && typeof error === 'object' && 'code' in error && error.code === code;
interface Context extends PackageReadInput { installationId: string; directory: string }
interface Contents { files: Map<string, Buffer>; manifest: InstalledPackageReceipt['manifest'] }

function context(input: PackageReadInput): Context {
  if (!input || typeof input !== 'object') fail('INVALID_INPUT');
  const a = input.artifact; const s = input.store;
  if (!a || !s || typeof a.artifactId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(a.artifactId)
    || typeof a.name !== 'string' || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(a.name) || a.name.length > 214
    || typeof a.version !== 'string' || a.version.length > 128 || !/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.+-]+)?$/.test(a.version)
    || !Number.isSafeInteger(a.bytes) || a.bytes <= 0 || a.bytes > MAX_ARCHIVE
    || typeof a.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(a.sha256)
    || typeof a.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(a.integrity)
    || typeof s.root !== 'string' || !isAbsolute(s.root) || resolve(s.root) !== s.root
    || typeof s.storeId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(s.storeId)
    || !Array.isArray(s.allowedDigests) || s.allowedDigests.length > 1024) fail('INVALID_INPUT');
  if (!s.allowedDigests.includes(a.sha256)) fail('UNTRUSTED_PACKAGE');
  const artifact = { artifactId: a.artifactId, name: a.name, version: a.version, bytes: a.bytes, sha256: a.sha256, integrity: a.integrity };
  const store = { root: s.root, storeId: s.storeId, allowedDigests: [...s.allowedDigests] };
  const installationId = hash(JSON.stringify({ storeId: store.storeId, artifact }));
  return { artifact, store, signal: input.signal, installationId, directory: join(store.root, installationId) };
}
async function trustedRoot(c: Context) {
  cancelled(c.signal);
  const stat = await fs.lstat(c.store.root);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0
    || process.getuid && stat.uid !== process.getuid() || await fs.realpath(c.store.root) !== c.store.root) fail('INVALID_STORE');
}
async function boundedFile(path: string, limit: number, signal?: AbortSignal): Promise<Buffer> {
  cancelled(signal);
  const handle = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > limit) fail('INTEGRITY_MISMATCH');
    const buffer = Buffer.alloc(limit + 1); let bytes = 0;
    for (;;) {
      cancelled(signal);
      const read = await handle.read(buffer, bytes, Math.min(64 * 1024, buffer.length - bytes), bytes);
      bytes += read.bytesRead;
      if (bytes > limit) fail('TOO_LARGE');
      if (read.bytesRead === 0) return buffer.subarray(0, bytes);
    }
  } finally {
    try { await handle.close(); } catch { throw new PackageStoreError('UNKNOWN', [path]); }
  }
}
async function expandedArchive(compressed: Buffer, signal?: AbortSignal): Promise<Buffer> {
  if (compressed[0] !== 0x1f || compressed[1] !== 0x8b) fail('ARCHIVE_REJECTED');
  const chunks: Buffer[] = []; let bytes = 0;
  const source = Readable.from([compressed]); const unzip = createGunzip();
  const sink = new Writable({ write(chunk: Buffer, _encoding, done) {
    bytes += chunk.length;
    if (bytes > MAX_EXPANDED) done(new PackageStoreError('TOO_LARGE'));
    else { chunks.push(chunk); done(); }
  } });
  try { await pipeline(source, unzip, sink, { signal }); }
  catch (error) { if (signal?.aborted) fail('CANCELLED'); if (error instanceof PackageStoreError) throw error; fail('ARCHIVE_REJECTED'); }
  cancelled(signal);
  // Parser auto-detects gzip; never allow a second decompression beyond our meter.
  const expanded = Buffer.concat(chunks, bytes);
  if (expanded[0] === 0x1f && expanded[1] === 0x8b) fail('ARCHIVE_REJECTED');
  return expanded;
}
function packagePath(raw: string, directory = false): string {
  if (Buffer.byteLength(raw) > 240 || !raw.startsWith('package/')) fail('ARCHIVE_REJECTED');
  const path = raw.slice(8).replace(directory ? /\/$/ : /$^/, '');
  if (directory && path === '') return '';
  if (!path || path.split('/').some(part => !/^[a-z0-9][a-z0-9._-]*$/.test(part) || part === 'node_modules')) fail('ARCHIVE_REJECTED');
  return path;
}
function parseArchive(expanded: Buffer): Promise<Map<string, Buffer>> {
  return new Promise((resolveFiles, reject) => {
    const files = new Map<string, Buffer>(); const paths = new Set<string>(); let entries = 0; let failed = false; let eof = false;
    // tar 7.5.22 silently skips zero-byte metadata, and 0 restores the default maximum.
    // -1 routes every valid nonnegative metadata size to ignoredEntry, rejecting the whole archive.
    const parser = new Parser({ strict: true, maxMetaEntrySize: -1, brotli: false, zstd: false });
    const stop = (error: unknown) => {
      if (failed) return; failed = true;
      const safe = error instanceof PackageStoreError ? error : new PackageStoreError('ARCHIVE_REJECTED');
      reject(safe); parser.abort(safe);
    };
    parser.on('error', error => { if (!failed) { failed = true; reject(error instanceof PackageStoreError ? error : new PackageStoreError('ARCHIVE_REJECTED')); } });
    parser.on('eof', () => { eof = true; });
    parser.on('ignoredEntry', () => stop(new PackageStoreError('ARCHIVE_REJECTED')));
    parser.on('meta', () => stop(new PackageStoreError('ARCHIVE_REJECTED')));
    parser.on('entry', entry => {
      try {
        if (++entries > 64 || !['File', 'OldFile', 'Directory'].includes(entry.type) || entry.linkpath) fail('ARCHIVE_REJECTED');
        const directory = entry.type === 'Directory'; const path = packagePath(entry.path, directory);
        if (paths.has(path)) fail('ARCHIVE_REJECTED'); paths.add(path);
        if (directory) { if (entry.size !== 0) fail('ARCHIVE_REJECTED'); entry.resume(); return; }
        if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_FILE || files.size >= 16) fail('TOO_LARGE');
        const chunks: Buffer[] = []; let bytes = 0;
        // Reserve before consuming, so zero-length entries also count.
        files.set(path, Buffer.alloc(0));
        entry.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > entry.size || bytes > MAX_FILE) stop(new PackageStoreError('TOO_LARGE')); else chunks.push(chunk); });
        entry.on('error', stop);
        entry.on('end', () => { if (bytes !== entry.size) stop(new PackageStoreError('ARCHIVE_REJECTED')); else files.set(path, Buffer.concat(chunks, bytes)); });
        entry.resume();
      } catch (error) { stop(error); }
    });
    parser.on('end', () => { if (!failed) resolveFiles(files); });
    try {
      // Public Parser owns TAR grammar; its EOF event distinguishes final padding from another hidden archive.
      for (let offset = 0; offset < expanded.length && !failed; offset += 512) {
        const block = expanded.subarray(offset, offset + 512);
        if (eof) { if (block.some(byte => byte !== 0)) fail('ARCHIVE_REJECTED'); }
        else parser.write(block);
      }
      if (!failed) { if (!eof) fail('ARCHIVE_REJECTED'); parser.end(); }
    } catch (error) { stop(error); }
  });
}
function jsonObject(bytes: Buffer | undefined): Record<string, unknown> {
  if (!bytes || bytes.length > MAX_JSON) fail('MANIFEST_REJECTED');
  try { const value: unknown = JSON.parse(bytes.toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) fail('MANIFEST_REJECTED'); return value as Record<string, unknown>; }
  catch { return fail('MANIFEST_REJECTED'); }
}
function contents(files: Map<string, Buffer>, artifact: PackageArtifactIdentity): Contents {
  const pkg = jsonObject(files.get('package.json')); const manifest = jsonObject(files.get('flow-plugin.json'));
  const forbidden = ['scripts', 'dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'bundledDependencies', 'bundleDependencies'];
  if (pkg.name !== artifact.name || pkg.version !== artifact.version || pkg.type !== 'module' || forbidden.some(key => key in pkg)) fail('MANIFEST_REJECTED');
  if (Object.keys(manifest).sort().join(',') !== 'entrypoint,hostApiMajor,kind,schemaVersion' || manifest.schemaVersion !== 1 || manifest.hostApiMajor !== 1
    || (manifest.kind !== 'tool' && manifest.kind !== 'verifier') || typeof manifest.entrypoint !== 'string' || !manifest.entrypoint.endsWith('.mjs')) fail('MANIFEST_REJECTED');
  packagePath('package/' + manifest.entrypoint);
  if (!files.has(manifest.entrypoint)) fail('MANIFEST_REJECTED');
  for (const path of files.keys()) for (const other of files.keys()) if (other.startsWith(path + '/')) fail('ARCHIVE_REJECTED');
  return { files, manifest: { schemaVersion: 1, hostApiMajor: 1, kind: manifest.kind, entrypoint: manifest.entrypoint } };
}
function receipt(c: Context, material: Contents): InstalledPackageReceipt {
  const files = [...material.files].map(([path, data]) => ({ path, bytes: data.length, sha256: hash(data) })).sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { schemaVersion: 1, installationId: c.installationId, storeId: c.store.storeId, artifact: c.artifact,
    manifest: material.manifest, files, treeDigest: hash(JSON.stringify(files)) };
}
function result(c: Context, value: InstalledPackageReceipt): InstalledPackage {
  return { receipt: value, entrypoint: pathToFileURL(join(c.directory, 'package', value.manifest.entrypoint)) };
}
async function readMaterial(c: Context): Promise<InstalledPackage> {
  const stat = await fs.lstat(c.directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('INTEGRITY_MISMATCH');
  const names = (await fs.readdir(c.directory)).sort();
  if (names.join(',') !== 'package,receipt.json') fail('INTEGRITY_MISMATCH');
  const stored = jsonObject(await boundedFile(join(c.directory, 'receipt.json'), MAX_JSON, c.signal));
  const files = new Map<string, Buffer>(); let entries = 0; let total = 0;
  async function walk(path: string, relative: string) {
    if (++entries > 64) fail('INTEGRITY_MISMATCH');
    const item = await fs.lstat(path);
    if (item.isSymbolicLink()) fail('INTEGRITY_MISMATCH');
    if (item.isDirectory()) { for (const name of await fs.readdir(path)) await walk(join(path, name), relative ? relative + '/' + name : name); }
    else {
      packagePath('package/' + relative);
      if (!item.isFile() || files.size >= 16) fail('INTEGRITY_MISMATCH');
      const bytes = await boundedFile(path, MAX_FILE, c.signal); total += bytes.length;
      if (total > MAX_EXPANDED) fail('INTEGRITY_MISMATCH'); files.set(relative, bytes);
    }
  }
  await walk(join(c.directory, 'package'), '');
  const expected = receipt(c, contents(files, c.artifact));
  // Receipts are emitted only by this module in canonical field order.
  if (JSON.stringify(stored) !== JSON.stringify(expected)) fail('INTEGRITY_MISMATCH');
  cancelled(c.signal); return result(c, expected);
}
async function writeDurable(path: string, bytes: Uint8Array) {
  const file = await fs.open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(bytes); await file.sync(); await file.chmod(0o400); }
  finally { try { await file.close(); } catch { throw new PackageStoreError('UNKNOWN', [path]); } }
}
async function syncDirectory(path: string) {
  const file = await fs.open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await file.sync(); } finally { try { await file.close(); } catch { throw new PackageStoreError('UNKNOWN', [path]); } }
}
async function publish(c: Context, material: Contents): Promise<InstalledPackage> {
  const value = receipt(c, material);
  const stage = await fs.mkdtemp(join(c.store.root, '.stage-'));
  let identity: { dev: number; ino: number } | undefined; let renameRequested = false; let published = false; let retain = false;
  try {
    const stat = await fs.lstat(stage); identity = { dev: stat.dev, ino: stat.ino };
    const directories = new Set<string>([join(stage, 'package')]);
    await fs.mkdir(join(stage, 'package'), { mode: 0o700 });
    for (const [path, bytes] of material.files) {
      cancelled(c.signal); const destination = join(stage, 'package', path);
      await fs.mkdir(dirname(destination), { recursive: true, mode: 0o700 });
      let directory = dirname(destination);
      while (directory !== stage) { directories.add(directory); directory = dirname(directory); }
      await writeDurable(destination, bytes);
    }
    await writeDurable(join(stage, 'receipt.json'), Buffer.from(JSON.stringify(value)));
    for (const directory of [...directories].sort((a, b) => b.length - a.length)) await syncDirectory(directory);
    await syncDirectory(stage); cancelled(c.signal); renameRequested = true;
    try { await fs.rename(stage, c.directory); published = true; }
    catch (error) {
      if (!isCode(error, 'EEXIST') && !isCode(error, 'ENOTEMPTY')) throw error;
      renameRequested = false; return await readMaterial(c);
    }
    await syncDirectory(c.store.root); cancelled(c.signal); return result(c, value);
  } catch (error) {
    if (renameRequested || error instanceof PackageStoreError && error.code === 'UNKNOWN') { retain = true; throw new PackageStoreError('UNKNOWN', [published ? c.directory : stage, ...(renameRequested && !published ? [c.directory] : [])]); }
    if (error instanceof PackageStoreError) throw error;
    throw new PackageStoreError('STORAGE_FAILED');
  } finally {
    // Unknown rename/close is retained. Never delete a published install or guess who owns a replaced directory.
    if (!published && !renameRequested && !retain) {
      if (!identity) throw new PackageStoreError('UNKNOWN', [stage]);
      try {
        const stat = await fs.lstat(stage);
        if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== identity.dev || stat.ino !== identity.ino) throw new Error('changed');
        await fs.rm(stage, { recursive: true });
      } catch { throw new PackageStoreError('UNKNOWN', [stage]); }
    }
  }
}
export async function prepareInstalledPackage(input: PackagePrepareInput): Promise<InstalledPackage> {
  const c = context(input); const tarballPath = input.tarballPath;
  try {
    await trustedRoot(c);
    try { return await readMaterial(c); } catch (error) { if (!isCode(error, 'ENOENT')) throw error; }
    if (typeof tarballPath !== 'string' || !isAbsolute(tarballPath)) fail('INVALID_INPUT');
    const bytes = await boundedFile(tarballPath, MAX_ARCHIVE, c.signal);
    if (bytes.length !== c.artifact.bytes || hash(bytes) !== c.artifact.sha256 || 'sha512-' + createHash('sha512').update(bytes).digest('base64') !== c.artifact.integrity) fail('INTEGRITY_MISMATCH');
    const expanded = await expandedArchive(bytes, c.signal);
    const material = contents(await parseArchive(expanded), c.artifact); cancelled(c.signal);
    return await publish(c, material);
  } catch (error) { if (error instanceof PackageStoreError) throw error; throw new PackageStoreError('STORAGE_FAILED'); }
}
export async function readInstalledPackage(input: PackageReadInput): Promise<InstalledPackage> {
  const c = context(input);
  try { await trustedRoot(c); return await readMaterial(c); }
  catch (error) { if (error instanceof PackageStoreError) throw error; if (isCode(error, 'ENOENT')) fail('NOT_FOUND'); throw new PackageStoreError('STORAGE_FAILED'); }
}
