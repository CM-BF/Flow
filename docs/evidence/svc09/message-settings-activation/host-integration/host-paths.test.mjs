import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lstat, symlink, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { isHostDirectory, hostInputPath } from './host-paths.mjs';
import { validateArguments } from './host-entry.mjs';
import { validateCleanupArguments } from './host-cleanup.mjs';
import { validateHostInput } from './host-consumer.mjs';
import { rootIdentity, privateJson } from './host-records.mjs';
import { exclusive } from './host-fixture.mjs';

const input = directory => ({ format: 1, directory, sourceHead: 'a'.repeat(40), repository: '/fixed/source',
  artifact: { artifactId: 'b'.repeat(64), manifestDigest: 'b'.repeat(64) }, choices: [{}, {}] });

test('actual Python mkdtemp root and the preserved underscore name cross all three input consumers', async () => {
  const actual = process.env.FLOW_SVC09A_PREPARE_SCRATCH;
  assert.ok(isHostDirectory(actual)); const info = await lstat(actual); assert.ok(info.isDirectory());
  for (const directory of [actual, '/private/tmp/flow-svc09a-host-e143n0_5', '/private/tmp/flow-svc09a-host-aZ0_-']) {
    const path = join(directory, 'input.json');
    assert.equal(validateArguments(['--work-once', path]), path);
    assert.equal(validateCleanupArguments(['--cleanup-once', path]), path);
    assert.equal(validateHostInput(input(directory)), join(directory, 'backend-artifacts', 'b'.repeat(64), 'root'));
  }
});

test('shared lexical contract rejects traversal, aliases, nested paths and arbitrary input files', () => {
  for (const directory of ['/private/tmp/flow-svc09a-host-', '/private/tmp/flow-svc09a-host-../outside',
    '/tmp/flow-svc09a-host-valid', '/private/tmp/flow-svc09a-host-valid/sub',
    '/private/tmp/flow-svc09a-host-%2foutside', '/private/tmp/flow-svc09a-host-abc\n']) {
    assert.equal(isHostDirectory(directory), false);
    assert.throws(() => validateHostInput(input(directory)));
    assert.throws(() => validateArguments(['--work-once', directory + '/input.json']));
    assert.throws(() => validateCleanupArguments(['--cleanup-once', directory + '/input.json']));
  }
  for (const path of ['/private/tmp/flow-svc09a-host-a/other.json', '/private/tmp/flow-svc09a-host-a/input.json/child']) assert.throws(() => hostInputPath(path));
  assert.throws(() => validateArguments(['--work-once', '/private/tmp/flow-svc09a-host-a/input.json', 'extra']));
  assert.throws(() => validateCleanupArguments(['--work-once', '/private/tmp/flow-svc09a-host-a/input.json']));
});

test('valid lexical names do not bypass pinned root identity or private-file symlink rejection', async () => {
  const directory = process.env.FLOW_SVC09A_PREPARE_SCRATCH;
  assert.ok(isHostDirectory(directory)); const info = await lstat(directory, { bigint: true });
  const pinned = { directory, directoryIdentity: { dev: String(info.dev), ino: String(info.ino) } };
  await rootIdentity(pinned);
  await assert.rejects(rootIdentity({ ...pinned, directoryIdentity: { ...pinned.directoryIdentity, ino: '0' } }));
  const file = join(directory, 'input.json'), fileLink = join(directory, 'input-link.json'), directoryLink = join(directory, 'directory-link');
  try {
    await exclusive(file, { synthetic: true }); await symlink(file, fileLink); await symlink(directory, directoryLink);
    await assert.rejects(privateJson(fileLink));
    await assert.rejects(rootIdentity({ ...pinned, directory: directoryLink }));
    assert.deepEqual(await privateJson(file), { synthetic: true });
  } finally {
    for (const path of [fileLink, directoryLink, file]) {
      try { await unlink(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const after = await lstat(directory, { bigint: true }); assert.equal(after.dev, info.dev); assert.equal(after.ino, info.ino);
  }
});
