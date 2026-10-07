import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, link, symlink, rm, lstat, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { privateBytes, runtimeBytes } from './file-readers.mjs';
const input = JSON.parse(await readFile(new URL('./inputs.json', import.meta.url)));
const python = input.reusedHelpers.find(row => row.path === '/usr/bin/python3');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(check) {
  const root = await mkdtemp(join(tmpdir(), 'svc08-reader-')); const initial = await lstat(root);
  try {
    const path = join(root, 'private'); await writeFile(path, 'private data', { mode: 0o600 });
    await check(root, path);
  } finally {
    const now = await lstat(root); assert.equal(now.dev, initial.dev); assert.equal(now.ino, initial.ino); await rm(root, { recursive: true });
  }
}
test('real root-owned Python is accepted only with its explicit full readonly pin', async () => {
  assert.equal(python.uid, 0); assert.ok(python.nlink > 1);
  const actual = await runtimeBytes(python); assert.equal(actual.bytes.length, python.bytes); assert.equal(sha(actual.bytes), python.sha256);
});
test('pinned Python rejects wrong owner, link count, inode, realpath, hash and missing pins', async () => {
  for (const wrong of [{ uid: process.getuid() }, { nlink: python.nlink + 1 }, { ino: (BigInt(python.ino) + 1n).toString() }, { realpath: '/wrong' }, { sha256: '0'.repeat(64) }, { uid: undefined }]) {
    await assert.rejects(runtimeBytes({ ...python, ...wrong }));
  }
});
test('the same system binary remains forbidden as a mutable private file', async () => {
  await assert.rejects(privateBytes(python.path, python.bytes));
});
test('owned private regular bytes pass; hardlinked private material is still rejected', async () => fixture(async (root, path) => {
  assert.equal((await privateBytes(path)).bytes.toString(), 'private data');
  await link(path, join(root, 'hardlink')); await assert.rejects(privateBytes(path));
}));
test('both readers reject a symlink even when it points at the correctly pinned owned file', async () => fixture(async (root, path) => {
  const info = await lstat(path), bytes = await readFile(path), alias = join(root, 'alias'); await symlink(path, alias);
  const pin = { path: alias, uid: info.uid, nlink: info.nlink, dev: String(info.dev), ino: String(info.ino), realpath: await realpath(path), bytes: bytes.length, sha256: sha(bytes) };
  await assert.rejects(privateBytes(alias)); await assert.rejects(runtimeBytes(pin));
}));
test('all 32 declared runtime inputs pass the same readonly gate without importing their modules', async () => {
  let count = 0;
  for (const row of input.rootToolClosure) { await runtimeBytes(row, join(input.repository, row.path)); count++; }
  for (const row of [...input.runtimeTools, ...input.resolvedRootEntries, ...input.reusedHelpers, input.supervisor]) { await runtimeBytes(row); count++; }
  assert.equal(count, 32);
});
