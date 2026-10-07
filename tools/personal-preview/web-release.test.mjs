import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readWebRelease, planWebRelease, loadReleaseAssets, releaseAsset, importWebCompatibility, verifyWebCompatibility, findWebCompatibility } from './web-release.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const head = 'a'.repeat(40); const digest = 'b'.repeat(64);
const compatibilityIds = new Map();
const checks = { read: ['ownerAuthenticated', 'conversationBound', 'taskBound'], send: ['acceptedTurnBound', 'requestedProfilePreserved'], recover: ['sameKey', 'sameBody', 'sameTurn'], negotiation: ['legacyReadable', 'streamHeaderHandled', 'profileHeaderHandled'] };
async function report(directory, artifact, backendHead = head, context = null) {
  const format = context === null ? 1 : 2; const contextFields = context === null ? {} : { context };
  const path = join(directory, `report-${artifact.artifactId}`); await mkdir(path, { recursive: true });
  const hashes = {};
  for (const [name, fields] of Object.entries(checks)) {
    const bytes = JSON.stringify({ format, ...contextFields, check: name, backendHead, artifactId: artifact.artifactId, observations: Object.fromEntries(fields.map(name => [name, true])) });
    hashes[name] = sha(bytes); await writeFile(join(path, `${name}.json`), bytes);
  }
  await writeFile(join(path, 'report.json'), JSON.stringify({ format, policy: `flow-web-api-v${format}`, ...contextFields, backendHead, artifact, checks: hashes }));
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
    const one = await artifact(directory, 'one'); const two = await artifact(directory, 'two', '2'.repeat(32)); const three = await artifact(directory, 'three', '3'.repeat(32)); const four = await artifact(directory, 'four', '4'.repeat(32)); const five = await artifact(directory, 'five', '5'.repeat(32));
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
    value = await planWebRelease({ directory, ...request(four, 4) }); await save(directory, value);
    assert.deepEqual(value.artifacts, [one, two, three, four]);
    assets = await loadReleaseAssets({ directory, release: value });
    assert.equal((await releaseAsset(assets, '/assets/lazy.js')).bytes.toString(), "export default 'one'");
    for (const n of [2,3,4]) assert.ok(await releaseAsset(assets, `/__flow_releases/${String(n).repeat(32)}/assets/lazy.js`));
    await assert.rejects(planWebRelease({ directory, ...request(five, 5) }), { code: 'WEB_RETENTION_BUDGET_EXCEEDED' });
    await assert.rejects(planWebRelease({ directory, ...request(five, 5, 'rollback') }), { code: 'WEB_ROLLBACK_NOT_RETAINED' });
    assert.equal((await readWebRelease(directory)).version, 5);
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


test('serialized release observations preserve valid in-flight reads and reject actual metadata rollback', async () => {
  const { createWebReleaseSnapshot } = await import('./static-web.mjs');
  const { setImmediate } = await import('node:timers/promises');
  await fixture(async directory => {
    const one = await artifact(directory, 'one'); const two = await artifact(directory, 'two', '2'.repeat(32));
    const old = await planWebRelease({ directory, ...request(one, 0, 'bootstrap') }); await save(directory, old);
    let observedPointer = old; let hold = false; let entered; const captured = new Promise(resolve => { entered = resolve; });
    let release; const delayed = new Promise(resolve => { release = resolve; });
    const snapshot = createWebReleaseSnapshot(directory, { read: async () => {
      const value = observedPointer;
      if (hold) { hold = false; entered(); await delayed; }
      return value;
    } });
    assert.equal((await snapshot()).version, 1);
    hold = true; const earlier = snapshot(); await captured;
    const newer = await planWebRelease({ directory, ...request(two, 1) }); await save(directory, newer); observedPointer = await readWebRelease(directory);
    const later = snapshot();
    // A read that was already in flight may finish after a later read from the new pointer.
    // Allow the later read to finish if the observer started it; then complete the older one.
    await setImmediate(); await setImmediate(); release();
    const observed = await Promise.all([earlier, later]);
    assert.deepEqual(observed.map(value => value.version), [1, 2]);
    await save(directory, old); observedPointer = await readWebRelease(directory);
    await assert.rejects(snapshot(), { code: 'WEB_RELEASE_VERSION_CONFLICT' });
    await save(directory, { ...newer, updatedAt: '2020-01-01T00:00:00.000Z' }); observedPointer = await readWebRelease(directory);
    await assert.rejects(snapshot(), { code: 'WEB_RELEASE_VERSION_CONFLICT' });
    await save(directory, newer); observedPointer = await readWebRelease(directory); assert.equal((await snapshot()).version, 2);
    await rm(join(directory, 'web-release.json')); observedPointer = await readWebRelease(directory);
    await assert.rejects(snapshot(), { code: 'WEB_RELEASE_METADATA_MISSING' });
  });
});

const configuredContext = { format: 1, publicOrigin: 'https://public.example', policySha256: 'd'.repeat(64) };
test('SVC09 v2 reports bind all four checks and legacy v1 cannot stand in for configured evidence', async () => {
  await fixture(async directory => {
    const one = await artifact(directory, 'one');
    const id = compatibilityIds.get(one.artifactId);
    await assert.rejects(verifyWebCompatibility({ directory, artifact: one, backendHead: head, compatibilityId: id, expectedContext: configuredContext }), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    const reportDirectory = await report(directory, one, head, configuredContext);
    const v2 = await importWebCompatibility({ directory, reportDirectory });
    assert.equal((await verifyWebCompatibility({ directory, artifact: one, backendHead: head, compatibilityId: v2, expectedContext: configuredContext })).format, 2);
    for (const context of [ { ...configuredContext, publicOrigin: 'https://other.example' }, { ...configuredContext, policySha256: 'e'.repeat(64) } ]) {
      await assert.rejects(findWebCompatibility({ directory, artifact: one, backendHead: head, expectedContext: context }), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    }
    await assert.rejects(verifyWebCompatibility({ directory, artifact: one, backendHead: head, compatibilityId: v2 }), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    const check = JSON.parse(await readFile(join(reportDirectory, 'send.json'))); check.context = { ...configuredContext, policySha256: 'e'.repeat(64) };
    const raw = JSON.stringify(check); await writeFile(join(reportDirectory, 'send.json'), raw);
    const value = JSON.parse(await readFile(join(reportDirectory, 'report.json'))); value.checks.send = sha(raw); await writeFile(join(reportDirectory, 'report.json'), JSON.stringify(value));
    await assert.rejects(importWebCompatibility({ directory, reportDirectory }), { code: 'WEB_COMPATIBILITY_INCOMPLETE' });
  });
});
test('SVC09 old pointer serves only with a complete new running tuple and never changes historical bytes', async () => {
  await fixture(async directory => {
    const one = await artifact(directory, 'one'); const two = await artifact(directory, 'two', '2'.repeat(32));
    await save(directory, await planWebRelease({ directory, ...request(one, 0, 'bootstrap') }));
    const release = await planWebRelease({ directory, ...request(two, 1) }); await save(directory, release);
    const original = await readFile(join(directory, 'web-release.json')); const newHead = 'e'.repeat(40);
    const options = { directory, release, expectedBackendHead: newHead, expectedContext: configuredContext };
    await assert.rejects(loadReleaseAssets(options), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    const ids = {};
    ids[one.artifactId] = await importWebCompatibility({ directory, reportDirectory: await report(directory, one, newHead, configuredContext) });
    await assert.rejects(loadReleaseAssets(options), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    ids[two.artifactId] = await importWebCompatibility({ directory, reportDirectory: await report(directory, two, newHead, configuredContext) });
    const actual = await loadReleaseAssets(options);
    assert.deepEqual(actual.verifiedTuple, { backendHead: newHead, context: configuredContext, compatibilityIds: ids });
    const { createWebReleaseSnapshot } = await import('./static-web.mjs');
    const supplied = { ...configuredContext };
    const snapshot = createWebReleaseSnapshot(directory, { expectedBackendHead: newHead, expectedContext: supplied });
    const cached = await snapshot(); supplied.policySha256 = 'f'.repeat(64);
    assert.strictEqual(await snapshot(), cached); assert.deepEqual(cached.verifiedTuple.context, configuredContext);
    const other = createWebReleaseSnapshot(directory, { expectedBackendHead: head, expectedContext: configuredContext });
    await assert.rejects(other(), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    assert.equal((await releaseAsset(actual, '/')).bytes.toString(), '<html>two</html>');
    await assert.rejects(loadReleaseAssets({ ...options, expectedBackendHead: head }), { code: 'WEB_COMPATIBILITY_COMBINATION_UNKNOWN' });
    await assert.rejects(loadReleaseAssets({ ...options, expectedBackendHead: undefined }), { code: 'WEB_COMPATIBILITY_REQUIRED' });
    assert.deepEqual(await readFile(join(directory, 'web-release.json')), original);
    const planned = await planWebRelease({ directory, artifact: one, expectedVersion: 2, action: 'rollback', backendHead: newHead,
      compatibilityId: ids[one.artifactId], expectedContext: configuredContext });
    assert.equal(planned.version, 3); assert.deepEqual(planned.compatibilityIds, ids); assert.equal(planned.backendHead, newHead);
    assert.deepEqual(await readFile(join(directory, 'web-release.json')), original); // Planning is not publication.
  });
});
test('SVC09 report count bounds existing reads and imports without deleting any committed history', async () => {
  await fixture(async directory => {
    const one = await artifact(directory, 'one'); const reportDirectory = await report(directory, one);
    const store = join(directory, 'web-compatibility'); const existing = await readdir(store);
    for (let n = 0; n < 32; n++) await mkdir(join(store, n.toString(16).padStart(64, '0')));
    await assert.rejects(verifyWebCompatibility({ directory, artifact: one, backendHead: head, compatibilityId: compatibilityIds.get(one.artifactId) }), { code: 'WEB_COMPATIBILITY_BUDGET_EXCEEDED' });
    await assert.rejects(findWebCompatibility({ directory, artifact: one, backendHead: head }), { code: 'WEB_COMPATIBILITY_BUDGET_EXCEEDED' });
    await assert.rejects(importWebCompatibility({ directory, reportDirectory }), { code: 'WEB_COMPATIBILITY_BUDGET_EXCEEDED' });
    assert.equal((await readdir(store)).length, existing.length + 32);
  });
});

test('SVC09 fixed historical count3 host rejects a four-artifact pointer', async () => {
  const { execFile } = await import('node:child_process'); const { promisify } = await import('node:util');
  const { fileURLToPath } = await import('node:url');
  const { stdout } = await promisify(execFile)('git', ['show', '5b0bef86086a611937e098c78bc542fde6ed9539:tools/personal-preview/web-release.mjs'],
    { cwd: fileURLToPath(new URL('../../', import.meta.url)), timeout: 1000, maxBuffer: 65536 });
  assert.ok(stdout.includes('const MAX_ARTIFACTS = 3;'));
  const historicalSource = stdout.replace("'./web-artifact.mjs'", JSON.stringify(new URL('./web-artifact.mjs', import.meta.url).href));
  const historical = await import('data:text/javascript;base64,' + Buffer.from(historicalSource).toString('base64'));
  await fixture(async directory => {
    for (let n = 1; n <= 4; n++) {
      const next = await artifact(directory, String(n), String(n).repeat(32));
      await save(directory, await planWebRelease({ directory, ...request(next, n - 1, n === 1 ? 'bootstrap' : 'publish') }));
    }
    await assert.rejects(historical.readWebRelease(directory), { code: 'WEB_RELEASE_METADATA_INVALID' });
    assert.equal((await readWebRelease(directory)).artifacts.length, 4);
  });
});
