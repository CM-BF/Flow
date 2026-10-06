import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, readdir, realpath, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { prepareWebArtifact, verifyWebArtifact } from './web-artifact.mjs';
const execute = promisify(execFile);
const installedWeb = fileURLToPath(new URL('../../apps/web/node_modules', import.meta.url));
async function fixture(callback) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'flow-svc03-artifact-')));
  const repository = join(directory, 'repo'); const state = join(directory, 'state');
  await mkdir(join(repository, 'apps/web'), { recursive: true }); await mkdir(state, { mode: 0o700 });
  await writeFile(join(repository, '.gitignore'), 'node_modules\n.env\n');
  await writeFile(join(repository, 'pnpm-lock.yaml'), 'synthetic-lock\n');
  await writeFile(join(repository, 'apps/web/package.json'), '{"type":"module"}');
  await writeFile(join(repository, 'apps/web/index.html'), '<html><body>fixed source<script type="module" src="/main.js"></script></body></html>');
  await writeFile(join(repository, 'apps/web/main.js'), 'document.body.dataset.fixture=import.meta.env.VITE_FLOW_FIXTURE;document.body.dataset.leak=import.meta.env.VITE_SECRET_SENTINEL??"absent";');
  await writeFile(join(repository, 'apps/web/.env'), 'VITE_SECRET_SENTINEL=dot-env-private-marker\n');
  await symlink(installedWeb, join(repository, 'apps/web/node_modules'));
  await execute('git', ['init', '-q', repository]);
  await execute('git', ['-C', repository, 'add', '.']);
  await execute('git', ['-C', repository, '-c', 'user.name=Flow Test', '-c', 'user.email=flow-test@example.invalid', 'commit', '-qm', 'fixture']);
  const target = (await execute('git', ['-C', repository, 'rev-parse', 'HEAD'])).stdout.trim();
  try { await callback({ directory: state, repository, target }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}
test('builds a fixed verified artifact with no inherited or dotenv secrets and detects tampering', async () => {
  await fixture(async options => {
    process.env.VITE_SECRET_SENTINEL = 'inherited-private-marker';
    let artifact;
    try { artifact = await prepareWebArtifact(options); } finally { delete process.env.VITE_SECRET_SENTINEL; }
    assert.equal(artifact.sourceHead, options.target);
    assert.match(artifact.artifactId, /^[a-f0-9]{64}$/);
    const verified = await verifyWebArtifact({ directory: options.directory, artifact });
    const contents = await Promise.all(verified.manifest.files.map(file => readFile(join(verified.dist, file.path), 'utf8')));
    const document = { body: { dataset: {} }, createElement: () => ({ relList: { supports: () => true } }) };
    for (let i = 0; i < contents.length; i++) if (verified.manifest.files[i].path.endsWith('.js')) runInNewContext(contents[i], { document });
    assert.equal(document.body.dataset.fixture, 'false');
    assert.equal(document.body.dataset.leak, 'absent');
    assert.ok(!contents.join('').includes('private-marker'));
    assert.ok(verified.manifest.files.some(file => file.path === 'index.html'));
    await writeFile(join(verified.dist, 'index.html'), 'changed');
    await assert.rejects(verifyWebArtifact({ directory: options.directory, artifact }), { code: 'WEB_ARTIFACT_INTEGRITY_MISMATCH' });
  });
});

test('rejects a dirty or mismatched source before building and cleans a failed stage without changing the old artifact', async () => {
  await fixture(async options => {
    const artifact = await prepareWebArtifact(options);
    await assert.rejects(prepareWebArtifact({ ...options, target: '0'.repeat(40) }), { code: 'SOURCE_TARGET_NOT_CLEAN' });
    await writeFile(join(options.repository, 'apps/web/main.js'), 'dirty source');
    await assert.rejects(prepareWebArtifact(options), { code: 'SOURCE_TARGET_NOT_CLEAN' });
    await writeFile(join(options.repository, 'apps/web/main.js'), 'import "missing-package-deliberate";');
    await execute('git', ['-C', options.repository, 'add', '.']);
    await execute('git', ['-C', options.repository, '-c', 'user.name=Flow Test', '-c', 'user.email=flow-test@example.invalid', 'commit', '-qm', 'broken']);
    const target = (await execute('git', ['-C', options.repository, 'rev-parse', 'HEAD'])).stdout.trim();
    await assert.rejects(prepareWebArtifact({ ...options, target }), { code: 'WEB_BUILD_FAILED' });
    assert.deepEqual(await readdir(join(options.directory, 'web-artifacts')), [artifact.artifactId]);
    assert.equal((await verifyWebArtifact({ directory: options.directory, artifact })).manifest.sourceHead, options.target);
  });
});
test('concurrent identical builds converge without overwriting and reject extra files or symbolic links', async () => {
  await fixture(async options => {
    const [one, two] = await Promise.all([prepareWebArtifact(options), prepareWebArtifact(options)]);
    assert.deepEqual(one, two);
    assert.deepEqual(await readdir(join(options.directory, 'web-artifacts')), [one.artifactId]);
    const { dist } = await verifyWebArtifact({ directory: options.directory, artifact: one });
    const extra = join(dist, 'extra.txt'); await writeFile(extra, 'unlisted');
    await assert.rejects(verifyWebArtifact({ directory: options.directory, artifact: one }), { code: 'WEB_ARTIFACT_INTEGRITY_MISMATCH' });
    await rm(extra); await symlink(join(options.repository, 'pnpm-lock.yaml'), extra);
    await assert.rejects(verifyWebArtifact({ directory: options.directory, artifact: one }), { code: 'ARTIFACT_SYMLINK_REJECTED' });
  });
});

test('a source change during the build is rejected and leaves no published artifact', async () => {
  await fixture(async options => {
    await writeFile(join(options.repository, 'apps/web/vite.config.mjs'), `import {writeFileSync} from 'node:fs';\nexport default {plugins:[{name:'change-source',closeBundle(){writeFileSync(new URL('./main.js',import.meta.url),'changed during build')}}]};`);
    await execute('git', ['-C', options.repository, 'add', '.']);
    await execute('git', ['-C', options.repository, '-c', 'user.name=Flow Test', '-c', 'user.email=flow-test@example.invalid', 'commit', '-qm', 'source mutation fixture']);
    const target = (await execute('git', ['-C', options.repository, 'rev-parse', 'HEAD'])).stdout.trim();
    await assert.rejects(prepareWebArtifact({ ...options, target }), { code: 'SOURCE_TARGET_NOT_CLEAN' });
    assert.deepEqual(await readdir(join(options.directory, 'web-artifacts')), []);
  });
});

test('release namespace is fixed before build while manifest identity follows built bytes', async () => {
  await fixture(async options => {
    const releaseId = 'a1'.repeat(16);
    const artifact = await prepareWebArtifact({ ...options, releaseId });
    const verified = await verifyWebArtifact({ directory: options.directory, artifact });
    assert.equal(verified.manifest.format, 2); assert.equal(verified.manifest.releaseId, releaseId);
    assert.ok((await readFile(join(verified.dist, 'index.html'), 'utf8')).includes(`/__flow_releases/${releaseId}/assets/`));
    assert.deepEqual(await prepareWebArtifact({ ...options, releaseId }), artifact);
    const other = await prepareWebArtifact({ ...options, releaseId: 'b2'.repeat(16) });
    assert.notEqual(other.artifactId, artifact.artifactId);
    assert.equal(other.sourceHead, artifact.sourceHead);
    await prepareWebArtifact({ ...options, releaseId: 'c3'.repeat(16) });
    await assert.rejects(prepareWebArtifact({ ...options, releaseId: 'd4'.repeat(16) }), { code: 'WEB_ARTIFACT_STORAGE_BUDGET_EXCEEDED' });
  });
});


test('rejects oversized asset metadata before reading its bytes', async () => {
  await fixture(async options => {
    const artifact = await prepareWebArtifact(options); const verified = await verifyWebArtifact({ directory: options.directory, artifact });
    const huge = await open(join(verified.dist, 'large.bin'), 'wx');
    try { await huge.truncate(32 * 1024 * 1024 + 1); } finally { await huge.close(); }
    await assert.rejects(verifyWebArtifact({ directory: options.directory, artifact }), { code: 'WEB_ARTIFACT_TOO_LARGE' });
  });
});
