import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, chmod, writeFile, rm, symlink, link, rename, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createLocalAccessHandler, createLocalInstallationProvider, localInstallationFromOptions } from '../src/local-access.mjs';

const FAKE_TOKEN = 'synthetic_local_owner_token_for_tests_123456';
const ID = '00000000-0000-4000-8000-000000000001';
async function installation(t) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'flow-access-test-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = path.join(root, 'installation');
  const repository = path.join(root, 'repository');
  await mkdir(directory, { mode: 0o700 });
  await mkdir(repository);
  const binding = { directory, repository, installationId: ID, productOrigin: 'http://127.0.0.1:61228/' };
  const config = { format: 1, ...binding, webPort: 61228, centerPort: 61227, ownerToken: FAKE_TOKEN, databaseUrl: 'secret-not-returned' };
  const filename = path.join(directory, 'config.json');
  const save = value => writeFile(filename, JSON.stringify(value), { mode: 0o600 });
  await save(config);
  return { root, filename, binding, config, save };
}
async function endpoint(t, provider) {
  const handler = createLocalAccessHandler(provider);
  const server = http.createServer(async (request, response) => {
    if (!await handler(request, response)) { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const port = server.address().port;
  return ({ method = 'POST', route = '/api/local-access/owner-token', headers = {} } = {}) => new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, method, path: route, agent: false, headers: Object.fromEntries(Object.entries({
      Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-Mode': 'cors',
      'X-Flow-Local-Access': '1', ...headers,
    }).filter(([, value]) => value !== null)) }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.setTimeout(2000, () => request.destroy(new Error('test request timeout')));
    request.on('error', reject); request.end();
  });
}
function fakeProvider(readOwnerToken = async () => FAKE_TOKEN) {
  return { metadata: { enabled: true, productUrl: 'http://127.0.0.1:61228/', unrelatedSecret: FAKE_TOKEN }, readOwnerToken };
}

test('default off ignores even malformed installation environment', async t => {
  assert.equal(await localInstallationFromOptions([], { FLOW_DASHBOARD_LOCAL_INSTALLATION: '{bad' }), undefined);
  const request = await endpoint(t);
  const metadata = await request({ method: 'GET', route: '/api/local-access' });
  assert.equal(metadata.status, 200);
  assert.deepEqual(JSON.parse(metadata.body), { enabled: false, productUrl: 'http://127.0.0.1:61228/', centerUrl: '', centerMode: 'web-proxy' });
  assert.equal((await request()).status, 404);
});

test('metadata never reads or serializes credentials; explicit POST reads once with no-store', async t => {
  let reads = 0;
  const request = await endpoint(t, fakeProvider(async () => { reads += 1; return FAKE_TOKEN; }));
  const metadata = await request({ method: 'GET', route: '/api/local-access' });
  assert.equal(reads, 0); assert.ok(!metadata.body.includes(FAKE_TOKEN));
  const token = await request();
  assert.equal(token.status, 200); assert.deepEqual(JSON.parse(token.body), { ownerToken: FAKE_TOKEN });
  assert.equal(reads, 1);
  for (const result of [metadata, token]) {
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
    assert.equal(result.headers['referrer-policy'], 'no-referrer');
    assert.equal(result.headers['access-control-allow-origin'], undefined);
  }
});

for (const [name, options, status] of [
  ['wrong Host', { headers: { Host: 'attacker.invalid' } }, 403],
  ['same-site other port', { headers: { Origin: 'http://127.0.0.1:61228' } }, 403],
  ['null Origin', { headers: { Origin: 'null' } }, 403],
  ['empty Origin', { headers: { Origin: '' } }, 403],
  ['absent Origin', { headers: { Origin: null } }, 403],
  ['absent fetch metadata', { headers: { 'Sec-Fetch-Site': null } }, 403],
  ['cross-site fetch', { headers: { 'Sec-Fetch-Site': 'cross-site' } }, 403],
  ['same-site fetch', { headers: { 'Sec-Fetch-Site': 'same-site' } }, 403],
  ['navigation', { headers: { 'Sec-Fetch-Mode': 'navigate' } }, 403],
  ['missing deliberate header', { headers: { 'X-Flow-Local-Access': '' } }, 403],
  ['forwarded spoof', { headers: { Host: 'attacker.invalid', 'X-Forwarded-Host': '127.0.0.1:4320', Origin: 'http://127.0.0.1:4320' } }, 403],
  ['GET credential', { method: 'GET' }, 405],
  ['preflight', { method: 'OPTIONS' }, 405],
  ['query file selector', { route: '/api/local-access/owner-token?path=config.json' }, 404],
  ['unknown route', { route: '/api/local-access/elsewhere' }, 404],
]) test(`rejects ${name} before provider access`, async t => {
  let reads = 0;
  const request = await endpoint(t, fakeProvider(async () => { reads += 1; return FAKE_TOKEN; }));
  const result = await request(options);
  assert.equal(result.status, status); assert.equal(reads, 0);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.ok(!result.body.includes(FAKE_TOKEN));
});

test('nonloopback peer cannot obtain metadata or token even with exact headers', async () => {
  let reads = 0;
  const handler = createLocalAccessHandler(fakeProvider(async () => { reads += 1; return FAKE_TOKEN; }));
  let status;
  await handler({ url: '/api/local-access', method: 'GET', headers: { host: '127.0.0.1:4320' }, socket: { localPort: 4320, remoteAddress: '192.0.2.1' } }, {
    writeHead: value => { status = value; }, end() {},
  });
  assert.equal(status, 403); assert.equal(reads, 0);
});

test('provider exception and malformed value never escape into HTTP errors', async t => {
  for (const reader of [async () => { throw new Error(`private path /secret/${FAKE_TOKEN}`); }, async () => '\r\nsecret']) {
    const request = await endpoint(t, fakeProvider(reader));
    const result = await request();
    assert.equal(result.status, 503); assert.ok(!result.body.includes(FAKE_TOKEN)); assert.ok(!result.body.includes('/secret/'));
  }
});

test('one outstanding read; failure releases the read slot', async t => {
  let entered; const started = new Promise(resolve => { entered = resolve; });
  let release; let reads = 0;
  const request = await endpoint(t, fakeProvider(async () => {
    reads += 1;
    if (reads === 1) { entered(); await new Promise(resolve => { release = resolve; }); throw new Error('synthetic failure'); }
    return FAKE_TOKEN;
  }));
  const first = request(); await started;
  try { assert.equal((await request()).status, 409); assert.equal(reads, 1); }
  finally { release(); }
  assert.equal((await first).status, 503);
  assert.equal((await request()).status, 200); assert.equal(reads, 2);
});

test('bound provider projects one credential and accepts a same-installation atomic rotation', async t => {
  const data = await installation(t);
  const provider = await createLocalInstallationProvider(data.binding);
  assert.ok(!JSON.stringify(provider.metadata).includes(FAKE_TOKEN));
  assert.equal(await provider.readOwnerToken(), FAKE_TOKEN);
  const next = `${FAKE_TOKEN}_rotated`;
  const replacement = `${data.filename}.new`;
  await writeFile(replacement, JSON.stringify({ ...data.config, ownerToken: next }), { mode: 0o600 });
  await rename(replacement, data.filename);
  assert.equal(await provider.readOwnerToken(), next);
});

for (const [name, mutate] of [
  ['permissive file', async data => chmod(data.filename, 0o644)],
  ['permissive directory', async data => chmod(data.binding.directory, 0o755)],
  ['symlink file', async data => { await rename(data.filename, `${data.filename}.real`); await symlink(`${data.filename}.real`, data.filename); }],
  ['hardlinked file', async data => link(data.filename, `${data.filename}.alias`)],
  ['oversized file', async data => writeFile(data.filename, 'x'.repeat(65537))],
  ['malformed JSON', async data => writeFile(data.filename, '{')],
  ['invalid UTF8', async data => writeFile(data.filename, Buffer.from([0xff]))],
  ['wrong identity', async data => data.save({ ...data.config, installationId: '00000000-0000-4000-8000-000000000002' })],
  ['wrong repository', async data => data.save({ ...data.config, repository: data.root })],
  ['wrong Web port', async data => data.save({ ...data.config, webPort: 55049 })],
  ['wrong declared directory', async data => data.save({ ...data.config, directory: data.root })],
  ['invalid token', async data => data.save({ ...data.config, ownerToken: '\r\nnot-a-token' })],
  ['replaced directory', async data => { await rename(data.binding.directory, `${data.binding.directory}.old`); await mkdir(data.binding.directory, { mode: 0o700 }); await data.save(data.config); }],
]) test(`provider rejects ${name} with a safe error`, async t => {
  const data = await installation(t);
  const provider = await createLocalInstallationProvider(data.binding);
  await mutate(data);
  await assert.rejects(provider.readOwnerToken(), error => {
    assert.ok(!error.message.includes(FAKE_TOKEN)); assert.ok(!error.message.includes(data.root)); return true;
  });
});

test('startup refuses a directory symlink and incomplete opt-in without reading config', async t => {
  const data = await installation(t);
  const alias = path.join(data.root, 'alias'); await symlink(data.binding.directory, alias);
  await assert.rejects(createLocalInstallationProvider({ ...data.binding, directory: alias }));
  await assert.rejects(localInstallationFromOptions(['--local-installation'], {}));
  await assert.rejects(createLocalInstallationProvider({ ...data.binding, productOrigin: 'https://example.invalid/' }));
});
