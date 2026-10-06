import { afterAll, afterEach, expect, test } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdtemp, readdir, rm, readFile, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchPackageArtifact, readPackageArtifact } from './index.js';

const facts: Record<string, unknown>[] = [];
let completedCleanups = 0;
const cleanups: (() => Promise<void>)[] = [];
afterAll(async () => {
  if (process.env.FLOW_X04_EVIDENCE) await writeFile(process.env.FLOW_X04_EVIDENCE, JSON.stringify({
    node: process.version, platform: process.platform, arch: process.arch,
    recordedAt: new Date().toISOString(), nativeModelQueries: 0, completedCleanups, facts,
  }, null, 2) + '\n');
});
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) { await cleanup(); completedCleanups++; } });
async function temp() { const root = await mkdtemp(join(tmpdir(), 'flow-x04-registry-')); cleanups.push(() => rm(root, { recursive: true, force: true })); return root; }
async function registry(handler: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handler);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections(); server.close(error => error ? reject(error) : resolve());
  }));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing address');
  return `http://127.0.0.1:${address.port}/`;
}
function archive(packageJson: string) {
  const content = Buffer.from(packageJson);
  const header = Buffer.alloc(512);
  header.write('package/package.json');
  header.write('0000644\0', 100); header.write('0000000\0', 108); header.write('0000000\0', 116);
  header.write(content.length.toString(8).padStart(11, '0') + '\0', 124);
  header.write('00000000000\0', 136); header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
  const checksum = header.reduce((sum, value) => sum + value, 0);
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148);
  return gzipSync(Buffer.concat([header, content, Buffer.alloc((512 - content.length % 512) % 512 + 1024)]));
}
const inputFor = (body: Buffer) => ({ name: '@flow/package-test', version: '1.2.3', integrity: `sha512-${createHash('sha512').update(body).digest('base64')}` });
function metadata(tarball: string, body: Buffer) {
  const input = inputFor(body);
  return JSON.stringify({ name: input.name, 'dist-tags': { latest: input.version }, versions: {
    [input.version]: { name: input.name, version: input.version, dist: { tarball, integrity: input.integrity } },
  } });
}
const settings = (root: string, registry: string) => ({ root, registry, allowInsecureLoopback: true });

test('real pacote stores the exact tarball without npmrc credentials, extraction or install scripts', async () => {
  const root = await temp();
  const marker = join(root, 'script-ran');
  const body = archive(JSON.stringify({ name: '@flow/package-test', version: '1.2.3',
    scripts: { preinstall: `node -e "require('fs').writeFileSync('${marker}','executed')"` } }));
  const requests: { url?: string; auth?: string; cookie?: string }[] = [];
  let url = '';
  url = await registry((req, res) => {
    requests.push({ url: req.url, auth: req.headers.authorization, cookie: req.headers.cookie });
    res.end(req.url === '/@flow%2fpackage-test' ? metadata(url + 'package.tgz', body) : body);
  });
  await writeFile(join(root, '.npmrc'), `//127.0.0.1/:_authToken=synthetic-secret\nregistry=https://unrelated.invalid\n`);
  const envKeys = ['npm_config_userconfig', 'npm_config_registry', 'NPM_TOKEN'] as const;
  const previous = envKeys.map(key => process.env[key]);
  process.env.npm_config_userconfig = join(root, '.npmrc');
  process.env.npm_config_registry = 'https://unrelated.invalid';
  process.env.NPM_TOKEN = 'synthetic-secret';
  let value;
  try { value = await fetchPackageArtifact(settings(root, url), inputFor(body)); }
  finally { envKeys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
  }); }
  expect(requests.map(r => r.url)).toEqual(['/@flow%2fpackage-test', '/package.tgz']);
  expect(requests.every(r => !r.auth && !r.cookie)).toBe(true);
  expect(await readFile(join(root, 'artifacts', value.artifactId, 'package.tgz'))).toEqual(body);
  expect(await readdir(join(root, 'artifacts', value.artifactId))).toEqual(['package.tgz', 'receipt.json']);
  await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' });
  expect(await readPackageArtifact(root, value.artifactId)).toEqual(value);
  expect(await readdir(join(root, 'staging'))).toEqual([]);
  facts.push({ case: 'download-without-execution', requests, receipt: value, identicalBytes: true, scriptMarkerAbsent: true, stagingEmpty: true });
});

test('real pacote corruption retry receives a fresh file and independently verifies the successful body', async () => {
  const root = await temp(); const body = archive('{"name":"@flow/package-test","version":"1.2.3"}');
  let url = ''; let attempts = 0;
  url = await registry((req, res) => {
    if (req.url === '/@flow%2fpackage-test') res.end(metadata(url + 'package.tgz', body));
    else { attempts++; res.end(attempts === 1 ? Buffer.from('corrupt') : body); }
  });
  const value = await fetchPackageArtifact(settings(root, url), inputFor(body));
  expect(attempts).toBe(2);
  expect(value.bytes).toBe(body.length);
  expect(await readPackageArtifact(root, value.artifactId)).toEqual(value);
  expect(await readdir(join(root, 'staging'))).toEqual([]);
  facts.push({ case: 'corruption-retry', attempts, bytes: value.bytes, stagingEmpty: true });
});

test('rejects cross-origin metadata and redirect targets before any target request', async () => {
  const root = await temp(); const body = archive('{}');
  let targetRequests = 0;
  const target = await registry((_req, res) => { targetRequests++; res.end(body); });
  for (const mode of ['metadata', 'redirect']) {
    let url = '';
    url = await registry((req, res) => {
      if (req.url === '/@flow%2fpackage-test') res.end(metadata(mode === 'metadata' ? target + 'stolen.tgz' : url + 'package.tgz', body));
      else { res.writeHead(302, { location: target + 'stolen.tgz' }); res.end(); }
    });
    await expect(fetchPackageArtifact(settings(root, url), inputFor(body))).rejects.toBeDefined();
    expect(targetRequests).toBe(0);
    facts.push({ case: 'cross-origin', mode, targetRequests });
    expect(await readdir(join(root, 'staging'))).toEqual([]);
  }
});

test('rejects changed-path redirects and metadata redirects without requesting their targets', async () => {
  const root = await temp(); const body = archive('{}'); let escaped = 0;
  for (const mode of ['tarball', 'metadata']) {
    let url = '';
    url = await registry((req, res) => {
      if (req.url === '/elsewhere') { escaped++; res.end(body); }
      else if (mode === 'metadata' || req.url === '/package.tgz') { res.writeHead(302, { location: url + 'elsewhere' }); res.end(); }
      else res.end(metadata(url + 'package.tgz', body));
    });
    await expect(fetchPackageArtifact(settings(root, url), inputFor(body))).rejects.toBeDefined();
    expect(escaped).toBe(0);
    facts.push({ case: 'changed-path', mode, targetRequests: escaped });
  }
});

test('metadata byte ceiling, tarball ceiling and total deadline bound real network reads', async () => {
  const root = await temp(); const body = archive('{}');
  for (const mode of ['metadata', 'tarball', 'timeout', 'same-url-loop']) {
    let url = ''; let bodies = 0;
    url = await registry((req, res) => {
      if (req.url === '/@flow%2fpackage-test') res.end(mode === 'metadata' ? 'x'.repeat(500) : metadata(url + 'package.tgz', body));
      else {
        bodies++;
        if (mode === 'timeout') { res.writeHead(200); res.write(body.subarray(0, 4)); }
        else if (mode === 'same-url-loop') { res.writeHead(302, { location: url + 'package.tgz' }); res.end(); }
        else res.end(body);
      }
    });
    const opts = { ...settings(root, url), timeoutMs: mode === 'timeout' ? 100 : 2000,
      metadataBytes: mode === 'metadata' ? 100 : 1024, maxBytes: mode === 'tarball' ? 10 : 1024 };
    await expect(fetchPackageArtifact(opts, inputFor(body))).rejects.toMatchObject({
      code: mode === 'timeout' ? 'TIMEOUT' : mode === 'same-url-loop' ? 'FETCH_FAILED' : 'TOO_LARGE',
    });
    expect(bodies).toBeLessThanOrEqual(21);
    facts.push({ case: 'limits', mode, requests: bodies, metadataBytes: opts.metadataBytes, maxBytes: opts.maxBytes, timeoutMs: opts.timeoutMs });
    expect(await readdir(join(root, 'staging'))).toEqual([]);
  }
});

test('permanent wrong SRI fails both bounded pacote attempts without an artifact or residue', async () => {
  const root = await temp(); const body = archive('{}'); const expected = archive('{"other":true}');
  let url = ''; let attempts = 0;
  url = await registry((req, res) => {
    if (req.url === '/@flow%2fpackage-test') res.end(metadata(url + 'package.tgz', expected));
    else { attempts++; res.end(body); }
  });
  await expect(fetchPackageArtifact(settings(root, url), inputFor(expected))).rejects.toMatchObject({ code: 'INTEGRITY_MISMATCH' });
  expect(attempts).toBe(2);
  expect(await readdir(root)).toEqual(['staging']);
  expect(await readdir(join(root, 'staging'))).toEqual([]);
  facts.push({ case: 'permanent-integrity-failure', attempts, publishedArtifacts: 0, stagingEmpty: true });
});
