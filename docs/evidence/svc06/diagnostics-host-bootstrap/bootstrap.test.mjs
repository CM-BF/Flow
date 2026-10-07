import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const input = JSON.parse(await readFile(new URL('./inputs.json', import.meta.url), 'utf8'));
const modulePath = join(input.sourceDirectory, 'backend-artifacts', input.artifact.artifactId, 'root/tools/personal-preview/web-release.mjs');
const { planWebRelease, importWebCompatibility, commitWebRelease, readWebRelease } = await import(pathToFileURL(modulePath).href);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('initial bootstrap keeps real report guards and subsequent release CAS', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'svc06-bootstrap-contract-')));
  try {
    const html = '<html>NON_PRODUCTION_LOADER_FIXTURE</html>';
    const manifest = Buffer.from(JSON.stringify({ format: 1, policy: 'flow-static-web-v1', sourceHead: input.artifact.sourceHead, files: [{ path: 'index.html', bytes: Buffer.byteLength(html), sha256: sha(html) }], totalBytes: Buffer.byteLength(html) }));
    const artifact = { artifactId: sha(manifest), sourceHead: input.artifact.sourceHead, manifestDigest: sha(manifest) };
    const at = join(directory, 'web-artifacts', artifact.artifactId);
    await mkdir(join(at, 'dist'), { recursive: true, mode: 0o700 });
    await writeFile(join(at, 'manifest.json'), manifest, { mode: 0o600 }); await writeFile(join(at, 'dist/index.html'), html, { mode: 0o600 });
    const initial = { directory, artifact, backendHead: input.artifact.sourceHead, expectedVersion: 0 };
    await assert.rejects(planWebRelease({ ...initial, action: 'publish' }), { code: 'WEB_RELEASE_BOOTSTRAP_REQUIRED' });
    await mkdir(join(directory, 'web-compatibility'), { mode: 0o700 });
    await assert.rejects(planWebRelease({ ...initial, action: 'bootstrap' }), { code: 'WEB_COMPATIBILITY_REQUIRED' });
    assert.equal(await readWebRelease(directory), null);
    const reportDirectory = join(directory, 'NON_PRODUCTION_LOADER_FIXTURE'); await mkdir(reportDirectory, { mode: 0o700 });
    const checks = {}, keys = { read: ['ownerAuthenticated', 'conversationBound', 'taskBound'], send: ['acceptedTurnBound', 'requestedProfilePreserved'], recover: ['sameKey', 'sameBody', 'sameTurn'], negotiation: ['legacyReadable', 'streamHeaderHandled', 'profileHeaderHandled'] };
    for (const [check, fields] of Object.entries(keys)) {
      const bytes = JSON.stringify({ format: 1, check, backendHead: input.artifact.sourceHead, artifactId: artifact.artifactId, observations: Object.fromEntries(fields.map(key => [key, true])) });
      checks[check] = sha(bytes); await writeFile(join(reportDirectory, `${check}.json`), bytes, { mode: 0o600 });
    }
    await writeFile(join(reportDirectory, 'report.json'), JSON.stringify({ format: 1, policy: 'flow-web-api-v1', backendHead: input.artifact.sourceHead, artifact, checks }), { mode: 0o600 });
    const compatibilityId = await importWebCompatibility({ directory, reportDirectory });
    const planned = await planWebRelease({ ...initial, compatibilityId, action: 'bootstrap' });
    assert.equal(planned.version, 1); assert.equal(planned.current, artifact.artifactId); assert.equal(await readWebRelease(directory), null);
    await commitWebRelease(directory, planned);
    await assert.rejects(planWebRelease({ ...initial, compatibilityId, action: 'bootstrap' }), { code: 'WEB_RELEASE_VERSION_CONFLICT' });
    const next = await planWebRelease({ ...initial, compatibilityId, expectedVersion: 1, action: 'publish' });
    assert.equal(next.version, 2); assert.equal((await readWebRelease(directory)).version, 1);
  } finally { await rm(directory, { recursive: true }); }
});
