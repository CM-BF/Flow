import { afterEach, expect, test } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchPackageArtifact } from './index.js';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const integrity = 'sha512-' + 'A'.repeat(86) + '==';

test('rejects non-exact registry references before staging or transport', async () => {
  const root = await mkdtemp(join(tmpdir(), 'flow-x04-test-')); roots.push(root);
  for (const input of [
    { name: 'foo', version: 'latest', integrity },
    { name: 'foo', version: '^1.0.0', integrity },
    { name: 'foo', version: 'npm:bar@1.0.0', integrity },
    { name: 'https://secret.invalid/file.tgz', version: '1.0.0', integrity },
    { name: 'foo', version: '1.0.0', integrity: 'sha1-invalid' },
  ]) {
    await expect(fetchPackageArtifact({ root, registry: 'https://registry.invalid/' }, input))
      .rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  }
  expect(await readdir(root)).toEqual([]);
});

const { createHash } = await import('node:crypto');
const { Readable } = await import('node:stream');
const { readFile, chmod, writeFile } = await import('node:fs/promises');
const { readPackageArtifact } = await import('./index.js');
const body = Buffer.from('synthetic compressed bytes: 中文 👋');
const request = { name: '@flow/test', version: '1.2.3', integrity: `sha512-${createHash('sha512').update(body).digest('base64')}` };
const fakeSource = {
  resolve: async () => 'https://registry.invalid/package.tgz',
  stream: async <T>(_url: string, _request: unknown, _context: unknown, consume: (body: any) => Promise<T>) => consume(Readable.from([body])),
};
async function temp() { const root = await mkdtemp(join(tmpdir(), 'flow-x04-test-')); roots.push(root); return root; }

test('publishes independent immutable receipts concurrently and reads them after a new caller starts', async () => {
  const root = await temp();
  const values = await Promise.all([1, 2].map(() => fetchPackageArtifact({ root, registry: 'https://registry.invalid/' }, request, undefined, fakeSource)));
  expect(new Set(values.map(value => value.artifactId)).size).toBe(2);
  for (const value of values) {
    expect(value.bytes).toBe(body.length);
    expect(await readFile(join(root, 'artifacts', value.artifactId, 'package.tgz'))).toEqual(body);
    expect(await readPackageArtifact(root, value.artifactId)).toEqual(value);
  }
  expect(await readdir(join(root, 'staging'))).toEqual([]);
});

test('each retry starts fresh instead of appending a failed partial body', async () => {
  const root = await temp();
  let callbacks = 0;
  const source = { ...fakeSource, async stream<T>(_url: string, _request: unknown, _context: unknown, consume: (stream: any) => Promise<T>) {
    callbacks++;
    await expect(consume(Readable.from([Buffer.from('partial')]))) .rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' });
    callbacks++;
    return consume(Readable.from([body]));
  } };
  const value = await fetchPackageArtifact({ root, registry: 'https://registry.invalid/' }, request, undefined, source);
  expect(callbacks).toBe(2);
  expect(value.bytes).toBe(body.length);
  expect(await readPackageArtifact(root, value.artifactId)).toEqual(value);
  expect(await readdir(join(root, 'staging'))).toEqual([]);
});

test('rejects wrong integrity and size with no published receipt or staging residue', async () => {
  const root = await temp();
  await expect(fetchPackageArtifact({ root, registry: 'https://registry.invalid/' }, { ...request, integrity }, undefined, fakeSource))
    .rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' });
  await expect(fetchPackageArtifact({ root, registry: 'https://registry.invalid/', maxBytes: 4 }, request, undefined, fakeSource))
    .rejects.toMatchObject({ code: 'TOO_LARGE' });
  expect(await readdir(join(root, 'staging'))).toEqual([]);
  expect(await readdir(root)).toEqual(['staging']);
});

test('caller cancellation and total deadline abort the stream and clear partial files', async () => {
  const root = await temp();
  for (const reason of ['caller', 'deadline']) {
    const stop = new AbortController();
    let destroyed = false;
    const source = { ...fakeSource, async stream<T>(_url: string, _request: unknown, _context: unknown, consume: (stream: any) => Promise<T>) {
      const stream = new Readable({ read() {} });
      stream.once('close', () => { destroyed = true; });
      stream.push(body.subarray(0, 4));
      if (reason === 'caller') setTimeout(() => stop.abort(), 10);
      return consume(stream);
    } };
    await expect(fetchPackageArtifact({ root, registry: 'https://registry.invalid/', timeoutMs: 80 }, request, stop.signal, source))
      .rejects.toMatchObject({ code: reason === 'caller' ? 'CANCELLED' : 'TIMEOUT' });
    expect(destroyed).toBe(true);
    expect(await readdir(join(root, 'staging'))).toEqual([]);
  }
});

test('sanitizes dependency exceptions and refuses tampered stored bytes', async () => {
  const root = await temp();
  const source = { ...fakeSource, async resolve() { throw new Error('secret-token https://u:pass@bad.invalid'); } };
  try { await fetchPackageArtifact({ root, registry: 'https://registry.invalid/' }, request, undefined, source); throw new Error('expected rejection'); }
  catch (error) { expect(String(error)).toBe('PackageArtifactError: Package artifact operation failed: FETCH_FAILED'); }
  const value = await fetchPackageArtifact({ root, registry: 'https://registry.invalid/' }, request, undefined, fakeSource);
  const path = join(root, 'artifacts', value.artifactId, 'package.tgz');
  await chmod(path, 0o600); await writeFile(path, 'changed');
  await expect(readPackageArtifact(root, value.artifactId)).rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' });
});

test('storage failure before download is explicit and never invokes the source', async () => {
  const root = await temp(); const blocked = join(root, 'not-a-directory'); await writeFile(blocked, 'occupied');
  let called = false;
  const source = { ...fakeSource, async resolve() { called = true; return 'https://registry.invalid/package.tgz'; } };
  await expect(fetchPackageArtifact({ root: blocked, registry: 'https://registry.invalid/' }, request, undefined, source))
    .rejects.toMatchObject({ code: 'STORAGE_FAILED' });
  expect(called).toBe(false);
  expect(await readFile(blocked, 'utf8')).toBe('occupied');
});
