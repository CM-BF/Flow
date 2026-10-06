import fs, { mkdtemp, realpath, mkdir, cp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { create, Header } from 'tar';
import { gzipSync } from 'node:zlib';
import { test, expect, vi, afterAll } from 'vitest';
import { prepareInstalledPackage, readInstalledPackage, type PackagePrepareInput } from './package-store.js';

const createdRoots: string[] = [];
afterAll(async () => {
  const retained: string[] = [];
  for (const root of createdRoots) { try { await fs.lstat(root); retained.push(root); } catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') retained.push(root); } }
  const report = process.env.FLOW_X01_STORE_CLEANUP_REPORT;
  if (report) await writeFile(report, JSON.stringify({ checkedAt: new Date().toISOString(), createdRoots, retained }) + '\n');
  expect(retained).toEqual([]);
});

async function fixture() {
  let root = await mkdtemp(join(tmpdir(), 'flow-plugin-material-test-'));
  createdRoots.push(root);
  try {
  root = await realpath(root);
  const source = join(root, 'source'); const storeRoot = join(root, 'store');
  await mkdir(source); await mkdir(storeRoot, { mode: 0o700 });
  await cp(fileURLToPath(new URL('../../../fixtures/plugins/text-tool', import.meta.url)), join(source, 'package'), { recursive: true });
  const tarballPath = join(root, 'package.tgz');
  await create({ cwd: source, file: tarballPath, gzip: true, portable: true, noMtime: true }, ['package']);
  const bytes = await readFile(tarballPath);
  const artifact = { artifactId: randomUUID(), name: '@flow-fixtures/text-tool', version: '1.0.0', bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), integrity: 'sha512-' + createHash('sha512').update(bytes).digest('base64') };
  const input: PackagePrepareInput = { artifact, tarballPath, store: { root: storeRoot, storeId: 'self-owned', allowedDigests: [artifact.sha256] } };
  return { root, input };
  } catch (error) { await rm(root, { recursive: true, force: true }); throw error; }
}

test('a real npm fixture is installed once and independently read with exact identity after restart', async () => {
  const f = await fixture();
  try {
    const installed = await prepareInstalledPackage(f.input);
    expect(installed.receipt.artifact).toEqual(f.input.artifact);
    expect(installed.receipt.files.map(file => file.path)).toEqual(['flow-plugin.json', 'index.mjs', 'package.json']);
    expect(installed.receipt.manifest).toEqual({ schemaVersion: 1, hostApiMajor: 1, kind: 'tool', entrypoint: 'index.mjs' });
    expect(await readFile(installed.entrypoint, 'utf8')).toContain('export function invoke');
    expect(await prepareInstalledPackage(f.input)).toEqual(installed);
    expect(await readInstalledPackage(structuredClone(f.input))).toEqual(installed);
    expect(await readdir(f.input.store.root)).toEqual([installed.receipt.installationId]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

type Entry = { path: string; body?: Buffer; type?: 'File' | 'Directory' | 'SymbolicLink' | 'Link' | 'CharacterDevice' | 'ExtendedHeader' | 'GlobalExtendedHeader' | 'OldExtendedHeader' | 'NextFileHasLongPath' | 'NextFileHasLongLinkpath' | 'OldGnuLongPath' | 'Unsupported'; linkpath?: string };
function tarBytes(entries: Entry[], tail = Buffer.alloc(1024)) {
  return Buffer.concat([...entries.flatMap(entry => {
    const body = entry.body ?? Buffer.alloc(0); const block = Buffer.alloc(512);
    new Header({ path: entry.path, type: entry.type === 'Unsupported' ? 'File' : entry.type ?? 'File', linkpath: entry.linkpath, size: body.length, mode: 0o600 }).encode(block);
    if (entry.type === 'Unsupported') { block[156] = 90; block.fill(32, 148, 156); block.write(block.reduce((sum, byte) => sum + byte, 0).toString(8).padStart(6, '0') + '\0 ', 148); }
    return [block, body, Buffer.alloc((512 - body.length % 512) % 512)];
  }), tail]);
}
async function fixtureEntries(): Promise<Entry[]> {
  return Promise.all(['package.json', 'flow-plugin.json', 'index.mjs'].map(async name => ({ path: 'package/' + name,
    body: await readFile(new URL('../../../fixtures/plugins/text-tool/' + name, import.meta.url)) })));
}
async function replaceArchive(f: Awaited<ReturnType<typeof fixture>>, bytes: Buffer) {
  await writeFile(f.input.tarballPath, bytes);
  f.input.artifact.bytes = bytes.length; f.input.artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
  f.input.artifact.integrity = 'sha512-' + createHash('sha512').update(bytes).digest('base64');
  f.input.store.allowedDigests = [f.input.artifact.sha256];
}

test.each([
  ['traversal', { path: 'package/../escape', body: Buffer.from('x') }],
  ['absolute', { path: '/package/escape', body: Buffer.from('x') }],
  ['wrong prefix', { path: 'other/index.mjs', body: Buffer.from('x') }],
  ['backslash', { path: 'package/a\\b', body: Buffer.from('x') }],
  ['symbolic link', { path: 'package/link', type: 'SymbolicLink', linkpath: '../outside' }],
  ['hard link', { path: 'package/link', type: 'Link', linkpath: 'package/index.mjs' }],
  ['device', { path: 'package/device', type: 'CharacterDevice' }],
  ['unsupported ignored entry', { path: 'package/unknown', type: 'Unsupported' }],
  ['duplicate file', { path: 'package/index.mjs', body: Buffer.from('replaced') }],
  ['path under regular file', { path: 'package/index.mjs/child', body: Buffer.from('x') }],
  ['metadata', { path: 'meta', type: 'ExtendedHeader', body: Buffer.from('17 comment=hello\n') }],
  ['oversized ignored metadata', { path: 'meta', type: 'ExtendedHeader', body: Buffer.alloc(16385, 97) }],
] as const)('rejects the whole package for %s without installing a partial tree', async (_name, entry) => {
  const f = await fixture();
  try {
    await replaceArchive(f, gzipSync(tarBytes([...await fixtureEntries(), entry])));
    await expect(prepareInstalledPackage(f.input)).rejects.toMatchObject({ code: 'ARCHIVE_REJECTED' });
    expect(await readdir(f.input.store.root)).toEqual([]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test.each(['padding bomb', 'file bytes', 'file count', 'nested gzip', 'crc', 'truncated file'] as const)('bounds complete archive consumption for %s', async mode => {
  const f = await fixture();
  try {
    let entries = await fixtureEntries(); let raw = tarBytes(entries);
    if (mode === 'padding bomb') raw = tarBytes(entries, Buffer.alloc(1024 * 1024));
    if (mode === 'file bytes') raw = tarBytes([...entries, { path: 'package/large', body: Buffer.alloc(256 * 1024 + 1) }]);
    if (mode === 'file count') raw = tarBytes([...entries, ...Array.from({ length: 14 }, (_, i) => ({ path: 'package/file' + i }))]);
    if (mode === 'truncated file') raw = raw.subarray(0, 522);
    let archive = gzipSync(raw);
    if (mode === 'nested gzip') archive = gzipSync(archive);
    if (mode === 'crc') archive[archive.length - 8] = archive[archive.length - 8]! ^ 1;
    await replaceArchive(f, archive);
    await expect(prepareInstalledPackage(f.input)).rejects.toMatchObject({ code: ['padding bomb', 'file bytes', 'file count'].includes(mode) ? 'TOO_LARGE' : 'ARCHIVE_REJECTED' });
    expect(await readdir(f.input.store.root)).toEqual([]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test.each(['name', 'version', 'scripts', 'dependencies', 'manifest bytes', 'host api', 'missing entry'] as const)('rejects incompatible static declarations: %s', async mode => {
  const f = await fixture();
  try {
    const entries = await fixtureEntries(); const pkg = JSON.parse(entries[0]!.body!.toString()); const manifest = JSON.parse(entries[1]!.body!.toString());
    if (mode === 'name') pkg.name = 'other'; if (mode === 'version') pkg.version = '2.0.0';
    if (mode === 'scripts') pkg.scripts = { install: 'should-never-run' }; if (mode === 'dependencies') pkg.dependencies = { other: '1.0.0' };
    if (mode === 'manifest bytes') pkg.description = 'x'.repeat(16385);
    if (mode === 'host api') manifest.hostApiMajor = 2; if (mode === 'missing entry') manifest.entrypoint = 'missing.mjs';
    entries[0]!.body = Buffer.from(JSON.stringify(pkg)); entries[1]!.body = Buffer.from(JSON.stringify(manifest));
    await replaceArchive(f, gzipSync(tarBytes(entries)));
    await expect(prepareInstalledPackage(f.input)).rejects.toMatchObject({ code: 'MANIFEST_REJECTED' });
    expect(await readdir(f.input.store.root)).toEqual([]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('rejects corrupt artifact identity, untrusted content, pre-abort and a symlink store before publication', async () => {
  const f = await fixture();
  try {
    await expect(prepareInstalledPackage({ ...f.input, artifact: { ...f.input.artifact, integrity: 'sha512-' + 'A'.repeat(86) + '==' } })).rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' });
    await expect(prepareInstalledPackage({ ...f.input, store: { ...f.input.store, allowedDigests: [] } })).rejects.toMatchObject({ code: 'UNTRUSTED_PACKAGE' });
    await expect(prepareInstalledPackage({ ...f.input, signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'CANCELLED' });
    const linked = join(f.root, 'linked'); await fs.symlink(f.input.store.root, linked);
    await expect(prepareInstalledPackage({ ...f.input, store: { ...f.input.store, root: linked } })).rejects.toMatchObject({ code: 'INVALID_STORE' });
    expect(await readdir(f.input.store.root)).toEqual([]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('concurrent identical installations preserve the one receipt and leave no stages', async () => {
  const f = await fixture();
  try {
    const values = await Promise.all(Array.from({ length: 4 }, () => prepareInstalledPackage(f.input)));
    for (const value of values) expect(value).toEqual(values[0]);
    expect(await readdir(f.input.store.root)).toEqual([values[0]!.receipt.installationId]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test.each(['tamper', 'extra', 'symlink', 'missing'] as const)('restart read rejects %s without overwriting the existing installation', async mode => {
  const f = await fixture();
  try {
    const installed = await prepareInstalledPackage(f.input); const directory = join(f.input.store.root, installed.receipt.installationId, 'package');
    if (mode === 'extra') await writeFile(join(directory, 'extra'), 'unexpected');
    else {
      await fs.chmod(installed.entrypoint, 0o600); await fs.unlink(installed.entrypoint);
      if (mode === 'tamper') await writeFile(installed.entrypoint, 'changed');
      if (mode === 'symlink') await fs.symlink(join(f.root, 'outside'), installed.entrypoint);
    }
    await expect(readInstalledPackage(f.input)).rejects.toBeInstanceOf(Error);
    await expect(prepareInstalledPackage(f.input)).rejects.toBeInstanceOf(Error);
    expect(await readdir(f.input.store.root)).toEqual([installed.receipt.installationId]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('a write failure closes prior writers and removes only its own unpublished stage', async () => {
  const f = await fixture(); const original = fs.open;
  try {
    const marker = join(f.input.store.root, 'unrelated'); await mkdir(marker); await writeFile(join(marker, 'keep'), 'keep');
    const spy = vi.spyOn(fs, 'open').mockImplementation((path, flags, mode) => String(path).endsWith('/index.mjs') ? Promise.reject(new Error('private failure')) : original(path, flags, mode));
    try { await expect(prepareInstalledPackage(f.input)).rejects.toMatchObject({ code: 'STORAGE_FAILED' }); } finally { spy.mockRestore(); }
    expect(await readdir(f.input.store.root)).toEqual(['unrelated']); expect(await readFile(join(marker, 'keep'), 'utf8')).toBe('keep');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('unknown writer close retains its owned stage instead of deleting it or claiming success', async () => {
  const f = await fixture(); const original = fs.open;
  try {
    const spy = vi.spyOn(fs, 'open').mockImplementation(async (path, flags, mode) => {
      const handle = await original(path, flags, mode);
      if (String(path).endsWith('/index.mjs')) { const close = handle.close.bind(handle); handle.close = async () => { await close(); throw new Error('unknown close'); }; }
      return handle;
    });
    try { await expect(prepareInstalledPackage(f.input)).rejects.toMatchObject({ code: 'UNKNOWN' }); } finally { spy.mockRestore(); }
    const names = await readdir(f.input.store.root); expect(names).toHaveLength(1); expect(names[0]).toMatch(/^\.stage-/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('a lost rename acknowledgement is unknown and the exact committed installation remains independently readable', async () => {
  const f = await fixture(); const original = fs.rename;
  try {
    const spy = vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => { await original(from, to); throw new Error('unknown ack'); });
    try { await expect(prepareInstalledPackage(f.input)).rejects.toMatchObject({ code: 'UNKNOWN' }); } finally { spy.mockRestore(); }
    const read = await readInstalledPackage(f.input);
    expect(await prepareInstalledPackage(f.input)).toEqual(read);
    expect(await readdir(f.input.store.root)).toEqual([read.receipt.installationId]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('mid-write cancellation settles the owned file and leaves no unpublished installation', async () => {
  const f = await fixture(); const original = fs.open; const abort = new AbortController();
  try {
    const spy = vi.spyOn(fs, 'open').mockImplementation(async (path, flags, mode) => {
      const handle = await original(path, flags, mode);
      if (String(path).endsWith('/index.mjs')) abort.abort();
      return handle;
    });
    try { await expect(prepareInstalledPackage({ ...f.input, signal: abort.signal })).rejects.toMatchObject({ code: 'CANCELLED' }); } finally { spy.mockRestore(); }
    expect(await readdir(f.input.store.root)).toEqual([]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('a replaced staging identity is retained and never recursively deleted as the original stage', async () => {
  const f = await fixture(); const original = fs.open; let replacement = '';
  try {
    const spy = vi.spyOn(fs, 'open').mockImplementation(async (path, flags, mode) => {
      if (String(path).endsWith('/index.mjs')) {
        replacement = String(path).slice(0, String(path).lastIndexOf('/package/'));
        await fs.rename(replacement, replacement + '-moved'); await mkdir(replacement, { mode: 0o700 }); await writeFile(join(replacement, 'keep'), 'replacement');
        throw new Error('write failed after replacement');
      }
      return original(path, flags, mode);
    });
    try { await expect(prepareInstalledPackage(f.input)).rejects.toMatchObject({ code: 'UNKNOWN' }); } finally { spy.mockRestore(); }
    expect(await readFile(join(replacement, 'keep'), 'utf8')).toBe('replacement');
    expect(await readdir(f.input.store.root)).toHaveLength(2);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test.each(['nonzero trailing bytes', 'missing terminal blocks'] as const)('rejects incomplete or concatenated TAR: %s', async mode => {
  const f = await fixture();
  try {
    const valid = tarBytes(await fixtureEntries());
    const bytes = mode === 'nonzero trailing bytes' ? Buffer.concat([valid, Buffer.from('not-padding')]) : valid.subarray(0, valid.length - 1024);
    await replaceArchive(f, gzipSync(bytes));
    await expect(prepareInstalledPackage(f.input)).rejects.toMatchObject({ code: 'ARCHIVE_REJECTED' });
    expect(await readdir(f.input.store.root)).toEqual([]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

const zeroMetadataCases = (['ExtendedHeader', 'GlobalExtendedHeader', 'OldExtendedHeader', 'NextFileHasLongPath', 'NextFileHasLongLinkpath', 'OldGnuLongPath'] as const)
  .flatMap(type => (['before', 'after'] as const).map(position => ({ type, position })));
test.each(zeroMetadataCases)('rejects zero-length metadata $type $position regular package entries', async ({ type, position }) => {
  const f = await fixture();
  try {
    const entries = await fixtureEntries(); const metadata: Entry = { path: 'meta', type };
    await replaceArchive(f, gzipSync(tarBytes(position === 'before' ? [metadata, ...entries] : [...entries, metadata])));
    await expect(prepareInstalledPackage(f.input)).rejects.toMatchObject({ code: 'ARCHIVE_REJECTED' });
    expect(await readdir(f.input.store.root)).toEqual([]);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
