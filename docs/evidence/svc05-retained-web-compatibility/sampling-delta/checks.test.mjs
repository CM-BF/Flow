import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rename, rm, readdir, lstat, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { diskBytes, runPreviewWithCleanup } from '../../../../experiments/personal-current-release/fixture.mjs';

assert.ok(process.env.SVC05R01_TINY_ROOT);
async function owned(t) {
  const parent = await mkdtemp(join(process.env.SVC05R01_TINY_ROOT, 'case-'));
  t.after(() => rm(parent, { recursive: true }));
  const root = join(parent, 'root'); await mkdir(root); return { parent, root };
}
const absent = () => Object.assign(Error('gone'), { code: 'ENOENT' });

test('one real enumerate→atomic rename gets a bounded fresh sample', async t => {
  const { root } = await owned(t), old = join(root, 'admission.json.tmp'), current = join(root, 'admission.json');
  await writeFile(old, 'fixed small bytes'); let changed = false;
  const result = await diskBytes(root, 10, { readdir, lstat: async path => {
    if (path === old && !changed) { changed = true; await rename(old, current); }
    return lstat(path);
  } });
  assert.equal(result.bytes, 17); assert.equal(result.files, 1); assert.equal(result.retries, 1);
  assert.equal(result.observedEntries, 2); assert.deepEqual(result.vanishedEntries, [old]); assert.equal(result.nonAtomic, true);
});

test('persistent enumerated-child churn is unknown after at most two resamples', async t => {
  const { root } = await owned(t);
  await assert.rejects(diskBytes(root, 10, { readdir: async () => ['gone'], lstat: async path => {
    if (path === join(root, 'gone')) throw absent(); return lstat(path);
  } }), error => error.code === 'DISK_OBSERVATION_UNKNOWN' && error.vanishedEntries.length === 3 && error.observedEntries === 3);
});

test('root inode replacement after a child vanishes is unknown', async t => {
  const { parent, root } = await owned(t); let replaced = false;
  await assert.rejects(diskBytes(root, 10, { readdir: async () => ['gone'], lstat: async path => {
    if (path === join(root, 'gone')) {
      if (!replaced) { replaced = true; await rename(root, join(parent, 'old')); await mkdir(root); }
      throw absent();
    }
    return lstat(path);
  } }), /root identity changed/);
});

test('missing root and permission errors are not treated as transient children', async t => {
  const { parent, root } = await owned(t);
  await assert.rejects(diskBytes(join(parent, 'missing')), error => error.code === 'ENOENT');
  let denied = 0;
  await assert.rejects(diskBytes(root, 10, { readdir: async () => ['denied'], lstat: async path => {
    if (path === join(root, 'denied')) { denied++; throw Object.assign(Error('denied'), { code: 'EACCES' }); }
    return lstat(path);
  } }), error => error.code === 'EACCES');
  assert.equal(denied, 1);
});

test('root disappearance and nested directory read disappearance stay unknown', async t => {
  const { parent, root } = await owned(t);
  await assert.rejects(diskBytes(root, 10, { readdir: async () => ['gone'], lstat: async path => {
    if (path === join(root, 'gone')) { await rm(root, { recursive: true }); throw absent(); }
    return lstat(path);
  } }), error => error.code === 'ENOENT');
  const second = join(parent, 'second'); await mkdir(join(second, 'nested'), { recursive: true });
  await assert.rejects(diskBytes(second, 10, { lstat, readdir: async path => {
    if (path.endsWith('/nested')) throw absent(); return readdir(path);
  } }), error => error.code === 'ENOENT');
});

test('leaf links count only their own bytes; root links and directory swaps are unknown', async t => {
  const { parent, root } = await owned(t), target = join(parent, 'target');
  await writeFile(target, 'x'.repeat(100)); const leaf = join(root, 'link'); await symlink(target, leaf);
  const result = await diskBytes(root); assert.equal(result.bytes, (await lstat(leaf)).size); assert.notEqual(result.bytes, 100);
  const rootLink = join(parent, 'root-link'); await symlink(root, rootLink); await assert.rejects(diskBytes(rootLink), /root is not an owned directory/);
  await rm(leaf); const nested = join(root, 'nested'); await mkdir(nested); const outside = join(parent, 'outside'); await mkdir(outside); let swapped = false;
  await assert.rejects(diskBytes(root, 10, { lstat, readdir: async path => {
    if (path === nested && !swapped) { swapped = true; await rename(nested, join(parent, 'old-nested')); await symlink(outside, nested); }
    return readdir(path);
  } }), /directory identity changed/);
});

test('file-count budget is cumulative across retries and path traversal is refused', async t => {
  const { root } = await owned(t);
  await assert.rejects(diskBytes(root, 1, { readdir: async () => ['gone'], lstat: async path => {
    if (path === join(root, 'gone')) throw absent(); return lstat(path);
  } }), /file-count limit/);
  await assert.rejects(diskBytes(root, 10, { lstat, readdir: async () => ['../other'] }), /entry outside directory/);
});

test('a late response is unknown within the one shared sampling deadline', async t => {
  const { root } = await owned(t), started = performance.now();
  await assert.rejects(diskBytes(root, 10, { lstat, readdir: async () => { await new Promise(resolve => setTimeout(resolve, 280)); return []; } }), /deadline|late response/);
  assert.ok(performance.now() - started < 600);
});

test('earliest page failure and later cleanup failure retain separate identities', async () => {
  const workError = Error('original page assertion'), cleanupError = Error('later preview close'); const calls = [];
  const result = await runPreviewWithCleanup(async () => { calls.push('work'); throw workError; }, async () => { calls.push('close'); throw cleanupError; });
  assert.equal(result.workError, workError); assert.equal(result.cleanupError, cleanupError); assert.equal(result.value, undefined); assert.deepEqual(calls, ['work', 'close']);
  const closeOnly = await runPreviewWithCleanup(async () => 42, async () => { throw cleanupError; });
  assert.equal(closeOnly.value, 42); assert.equal(closeOnly.workError, undefined); assert.equal(closeOnly.cleanupError, cleanupError);
  const success = await runPreviewWithCleanup(async () => 42, async () => {}); assert.deepEqual(success, { value: 42, workError: undefined, cleanupError: undefined });
});
