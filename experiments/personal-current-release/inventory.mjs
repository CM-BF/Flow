import assert from 'node:assert/strict';
import { readFile, readdir, lstat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const PERSONAL = '/Users/citrine/.flow-personal';
export const BACKEND = '362af3bac77541e5a60979326bcf4d4b8c947915';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
/** Read-only allowlist. No config/token parsing, network request, or personal tool invocation. */
export async function inventory() {
  const read = async name => JSON.parse(await readFile(join(PERSONAL, name), 'utf8'));
  const state = await read('state.json'), release = await read('web-release.json'), maintenance = await read('maintenance.json');
  assert.equal(release.artifacts.length, 2); assert.equal(release.version, 2);
  assert.equal(state.source.head, release.backendHead);
  const artifacts = [];
  for (const descriptor of release.artifacts) {
    assert.match(descriptor.artifactId, /^[a-f0-9]{64}$/);
    const directory = join(PERSONAL, 'web-artifacts', descriptor.artifactId);
    const bytes = await readFile(join(directory, 'manifest.json')); const manifest = JSON.parse(bytes);
    assert.equal(sha(bytes), descriptor.manifestDigest); assert.equal(manifest.sourceHead, descriptor.sourceHead);
    let total = 0; const found = [];
    async function scan(path, prefix = '') {
      for (const name of (await readdir(path)).sort()) {
        const info = await lstat(join(path, name)); assert.equal(info.isSymbolicLink(), false);
        if (info.isDirectory()) await scan(join(path, name), prefix + name + '/');
        else { assert.ok(info.isFile()); const file = await readFile(join(path, name)); total += file.length; found.push({ path: prefix + name, bytes: file.length, sha256: sha(file) }); }
      }
    }
    await scan(join(directory, 'dist')); assert.deepEqual(found, manifest.files); assert.equal(total, manifest.totalBytes);
    artifacts.push({ descriptor, directory, manifest, verifiedFiles: found.length, verifiedBytes: total });
  }
  return { observedAt: new Date().toISOString(), targetBackend: BACKEND, currentBackend: state.source,
    maintenance: { phase: maintenance.phase, resumeVersion: maintenance.resumeVersion },
    web: { releaseVersion: release.version, current: release.current, backendHead: release.backendHead, updatedAt: release.updatedAt },
    processes: Object.fromEntries(Object.entries(state.processes).map(([role, record]) => [role, { pid: record.pid, group: record.group, startedAt: record.startedAt }])),
    artifacts, personalActions: 0, providerQueries: 0,
    limits: 'File observations only; no fresh process/DB/maintenance HTTP health claim. No personal config or tokens read.' };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await inventory(); await writeFile(process.argv[2], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ artifacts: result.artifacts.length, backend: result.currentBackend.head, maintenance: result.maintenance, releaseVersion: result.web.releaseVersion }));
}
