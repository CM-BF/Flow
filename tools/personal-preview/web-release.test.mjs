import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readWebRelease, planWebRelease, loadReleaseAssets, releaseAsset, importWebCompatibility, verifyWebCompatibility } from './web-release.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const head = 'a'.repeat(40); const digest = 'b'.repeat(64);
const compatibilityIds = new Map();
const checks = { read: ['ownerAuthenticated', 'conversationBound', 'taskBound'], send: ['acceptedTurnBound', 'requestedProfilePreserved'], recover: ['sameKey', 'sameBody', 'sameTurn'], negotiation: ['legacyReadable', 'streamHeaderHandled', 'profileHeaderHandled'] };
async function report(directory, artifact, backendHead = head) {
  const path = join(directory, `report-${artifact.artifactId}`); await mkdir(path, { recursive: true });
  const hashes = {};
  for (const [name, fields] of Object.entries(checks)) {
    const bytes = JSON.stringify({ format: 1, check: name, backendHead, artifactId: artifact.artifactId, observations: Object.fromEntries(fields.map(name => [name, true])) });
    hashes[name] = sha(bytes); await writeFile(join(path, `${name}.json`), bytes);
  }
  await writeFile(join(path, 'report.json'), JSON.stringify({ format: 1, policy: 'flow-web-api-v1', backendHead, artifact, checks: hashes }));
  return path;
}
async function artifact(directory, label, releaseId, extras = {}) {
  const content = { 'index.html': `<html>${label}</html>`, 'assets/lazy.js': `export default '${label}'`, ...extras };
  const files = Object.entries(content).sort(([a], [b]) => a.localeCompare(b)).map(([path, text]) => ({ path, bytes: Buffer.byteLength(text), sha256: sha(text) }));
  const manifest = { format: releaseId ? 2 : 1, policy: releaseId ? 'flow-static-web-v2' : 'flow-static-web-v1', sourceHead: head,
    ...(releaseId ? { releaseId, apiContractDigest: digest } : {}), files, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0) };
  const bytes = Buffer.from(JSON.stringify(manifest)); const artifactId = sha(bytes); const path = join(directory, 'web-artifacts', artifactId);
  await mkdir(path, { recursive: true, mode: 0o700 }); await mkdir(join(path, 'dist'), { mode: 0o700 });
  for (const [name, value] of Object.entries(content)) { await mkdir(join(path, 'dist', name, '..'), { recursive: true }); await writeFile(join(path, 'dist', name), value); }
  await writeFile(join(path, 'manifest.json'), bytes, { mode: 0o600 });
  const value = { artifactId, sourceHead: head, manifestDigest: artifactId };
  compatibilityIds.set(artifactId, await importWebCompatibility({ directory, reportDirectory: await report(directory, value) }));
  return value;
}
async function fixture(callback) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc04-release-')));
  try { await callback(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
async function save(directory, release) { await writeFile(join(directory, 'web-release.json'), JSON.stringify(release), { mode: 0o600 }); }
const request = (artifact, expectedVersion, action = 'publish') => ({ artifact, expectedVersion, action, backendHead: head, compatibilityId: compatibilityIds.get(artifact.artifactId) });
test('release CAS retains precise old namespaces, rollback changes only current, and full retention refuses publication', async () => {
  await fixture(async directory => {
    const one = await artifact(directory, 'one'); const two = await artifact(directory, 'two', '2'.repeat(32)); const three = await artifact(directory, 'three', '3'.repeat(32)); const four = await artifact(directory, 'four', '4'.repeat(32));
    let value = await planWebRelease({ directory, ...request(one, 0, 'bootstrap') }); await save(directory, value);
    await assert.rejects(planWebRelease({ directory, ...request(two, 0) }), { code: 'WEB_RELEASE_VERSION_CONFLICT' });
    value = await planWebRelease({ directory, ...request(two, 1) }); await save(directory, value);
    let assets = await loadReleaseAssets({ directory, release: value });
    assert.equal((await releaseAsset(assets, '/assets/lazy.js')).bytes.toString(), "export default 'one'");
    assert.equal((await releaseAsset(assets, `/__flow_releases/${'2'.repeat(32)}/assets/lazy.js`)).bytes.toString(), "export default 'two'");
    assert.equal((await releaseAsset(assets, '/')).bytes.toString(), '<html>two</html>');
    value = await planWebRelease({ directory, ...request(one, 2, 'rollback') }); await save(directory, value);
    assert.equal(value.current, one.artifactId); assert.equal(value.artifacts.length, 2);
    value = await planWebRelease({ directory, ...request(three, 3) }); await save(directory, value);
    await assert.rejects(planWebRelease({ directory, ...request(four, 4) }), { code: 'WEB_RETENTION_BUDGET_EXCEEDED' });
    await assert.rejects(planWebRelease({ directory, ...request(four, 4, 'rollback') }), { code: 'WEB_ROLLBACK_NOT_RETAINED' });
    assert.equal((await readWebRelease(directory)).version, 4);
  });
});
test('legacy collisions, namespace reuse, unsafe paths and corrupt metadata fail before replacing the old release', async () => {
  await fixture(async directory => {
    const one = await artifact(directory, 'one'); const other = await artifact(directory, 'other');
    const value = await planWebRelease({ directory, ...request(one, 0, 'bootstrap') }); await save(directory, value);
    await assert.rejects(planWebRelease({ directory, ...request(other, 1) }), { code: 'WEB_LEGACY_ASSET_CONFLICT' });
    const namespaced = await artifact(directory, 'new', '1'.repeat(32)); const duplicate = await artifact(directory, 'different', '1'.repeat(32));
    const next = await planWebRelease({ directory, ...request(namespaced, 1) }); await save(directory, next);
    await assert.rejects(planWebRelease({ directory, ...request(duplicate, 2) }), { code: 'WEB_RELEASE_NAMESPACE_CONFLICT' });
    const assets = await loadReleaseAssets({ directory, release: next });
    for (const path of ['/__flow_releases/missing/assets/lazy.js', '/assets/missing.js', '/%2e%2e/config.json', '/assets/%2f..%2fconfig.json', '/\\config.json']) assert.equal(await releaseAsset(assets, path), null);
    await writeFile(join(directory, 'web-release.json'), '{broken');
    await assert.rejects(readWebRelease(directory), { code: 'WEB_RELEASE_METADATA_INVALID' });
    assert.equal((await releaseAsset(assets, '/assets/lazy.js')).bytes.toString(), "export default 'one'");
  });
});
test('changed file bytes, backend mismatch, invalid compatibility and metadata limits are rejected', async () => {
  await fixture(async directory => {
    const one = await artifact(directory, 'one', '1'.repeat(32));
    const value = await planWebRelease({ directory, ...request(one, 0, 'bootstrap') }); await save(directory, value);
    await assert.rejects(planWebRelease({ directory, ...request(one, 1), backendHead: 'z' }), { code: 'WEB_COMPATIBILITY_REQUIRED' });
    await assert.rejects(planWebRelease({ directory, ...request(one, 1), compatibilityId: '' }), { code: 'WEB_COMPATIBILITY_REQUIRED' });
    await assert.rejects(verifyWebCompatibility({ directory, artifact: one, backendHead: 'c'.repeat(40), compatibilityId: compatibilityIds.get(one.artifactId) }), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    const evidencePath = await report(directory, one);
    const bad = JSON.parse(await readFile(join(evidencePath, 'report.json'))); delete bad.checks.send; await writeFile(join(evidencePath, 'report.json'), JSON.stringify(bad));
    await assert.rejects(importWebCompatibility({ directory, reportDirectory: evidencePath }), { code: 'WEB_COMPATIBILITY_INVALID' });
    const assets = await loadReleaseAssets({ directory, release: value });
    await writeFile(join(directory, 'web-artifacts', one.artifactId, 'dist/assets/lazy.js'), 'changed');
    await assert.rejects(releaseAsset(assets, `/__flow_releases/${'1'.repeat(32)}/assets/lazy.js`), { code: 'WEB_ASSET_CHANGED' });
    await writeFile(join(directory, 'web-release.json'), ' '.repeat(16_385));
    await assert.rejects(readWebRelease(directory), { code: 'WEB_RELEASE_METADATA_INVALID' });
  });
});

test('hot publish and rollback preserve an open SSE stream, old chunks and same-origin credentials', async () => {
  const { startStaticWeb } = await import('./static-web.mjs'); const { commitWebRelease } = await import('./web-release.mjs');
  const { createServer } = await import('node:http'); const { fileURLToPath } = await import('node:url');
  await fixture(async directory => {
    const one = await artifact(directory, 'one', undefined, { 'assets/burst.js': 'x'.repeat(131_072) }); const two = await artifact(directory, 'two', '2'.repeat(32));
    let finish; let seenAuth; const center = createServer((request, response) => { seenAuth = request.headers.authorization; response.writeHead(200, { 'content-type': 'text/event-stream' }); response.write('data: before\n\n'); finish = () => response.end('data: after\n\n'); });
    const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
    const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
    const centerPort = await listen(center); const reservation = createServer(); const webPort = await listen(reservation); await close(reservation);
    let server; const abort = new AbortController();
    try {
      let value = await planWebRelease({ directory, ...request(one, 0, 'bootstrap') }); await commitWebRelease(directory, value);
      server = await startStaticWeb({ directory, artifact: one, repository: fileURLToPath(new URL('../../', import.meta.url)), webPort, centerPort });
      const url = `http://127.0.0.1:${webPort}`;
      const parallel = await Promise.all(Array.from({ length: 20 }, async () => { const response = await fetch(`${url}/assets/burst.js`); const body = await response.text(); return { status: response.status, bytes: body.length }; }));
      assert.ok(parallel.every(value => value.status === 200 && value.bytes === 131_072));
      const response = await fetch(`${url}/api/events`, { headers: { authorization: 'Bearer synthetic-owner' }, signal: abort.signal }); const reader = response.body.getReader();
      assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: before\n\n');
      value = await planWebRelease({ directory, ...request(two, 1) }); await commitWebRelease(directory, value);
      assert.equal(await (await fetch(url)).text(), '<html>two</html>');
      assert.equal(await (await fetch(`${url}/assets/lazy.js`)).text(), "export default 'one'");
      assert.equal(await (await fetch(`${url}/__flow_releases/${'2'.repeat(32)}/assets/lazy.js`)).text(), "export default 'two'");
      assert.equal((await fetch(`${url}/__flow_releases/missing/file.js`, { headers: { accept: 'text/html' } })).status, 404);
      assert.equal((await (await fetch(`${url}/__flow_preview_identity`)).json()).releaseVersion, 2);
      finish(); assert.equal(new TextDecoder().decode((await reader.read()).value), 'data: after\n\n'); await reader.cancel();
      assert.equal(seenAuth, 'Bearer synthetic-owner');
      value = await planWebRelease({ directory, ...request(one, 2, 'rollback') }); await commitWebRelease(directory, value);
      assert.equal(await (await fetch(url)).text(), '<html>one</html>');
      assert.equal((await fetch(`${url}/__flow_releases/${'2'.repeat(32)}/assets/lazy.js`)).status, 200);
      await rm(join(directory, 'web-release.json'));
      assert.equal((await fetch(url)).status, 503);
    } finally { abort.abort(); await server?.close(); await close(center); }
  });
});
