import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, lstat, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readCompletedMigration } from './completed-migration.mjs';
import { sha } from './procedure.mjs';

const names = ['reservation.json', 'migration-result.json', 'migration-checkpoint.json', 'migration-before.json', 'migrate-outer.json'];
const originals = Object.fromEntries(await Promise.all(names.map(async name => [name, JSON.parse(await readFile(new URL('./attempt-02/' + name, import.meta.url)))])));
const artifact = originals['migration-result.json'].artifact;
async function fixture(change, check) {
  const directory = await mkdtemp(join(tmpdir(), 'completed-migration-')), root = await lstat(directory);
  try {
    const records = structuredClone(originals);
    records['reservation.json'].identity = { dev: root.dev, ino: root.ino };
    change(records);
    const files = [];
    for (const name of names) {
      const bytes = Buffer.from(JSON.stringify(records[name]) + '\n'), path = join(directory, name);
      await writeFile(path, bytes, { mode: 0o600, flag: 'wx' }); const info = await lstat(path);
      files.push({ name, bytes: bytes.length, sha256: sha(bytes), dev: info.dev, ino: info.ino });
    }
    const input = { directory, identity: { dev: root.dev, ino: root.ino }, files, inputSha256: records['reservation.json'].inputSha256 };
    await check(input, directory);
  } finally {
    const after = await lstat(directory); assert.equal(after.dev, root.dev); assert.equal(after.ino, root.ino);
    await rm(directory, { recursive: true });
  }
}
test('the exact complete checkpoint is read without changing its five original files', async () => {
  await fixture(() => {}, async input => {
    const result = await readCompletedMigration(input, artifact);
    assert.equal(result.result.outcome, 'migrated'); assert.deepEqual(result.result.artifact, artifact);
    for (const row of input.files) assert.equal(sha(await readFile(join(input.directory, row.name))), row.sha256);
    assert.deepEqual((await readdir(input.directory)).sort(), [...names].sort());
  });
});
test('tampered bytes are refused even when the JSON remains valid', async () => {
  await fixture(() => {}, async input => {
    const path = join(input.directory, 'migration-result.json'); await writeFile(path, JSON.stringify({ outcome: 'migrated' }));
    await assert.rejects(readCompletedMigration(input, artifact));
  });
});
test('wrong root, wrong file identity and missing original are refused', async () => {
  await fixture(() => {}, async input => {
    const root = structuredClone(input); root.identity.ino++;
    await assert.rejects(readCompletedMigration(root, artifact));
    const file = structuredClone(input); file.files[0].ino++;
    await assert.rejects(readCompletedMigration(file, artifact));
    const missing = structuredClone(input); missing.files.pop();
    await assert.rejects(readCompletedMigration(missing, artifact));
  });
});
test('a failed or incomplete prior supervisor cannot authorize request continuation', async () => {
  for (const delta of [{ exit_code: 1 }, { owned_state: 'unknown' }, { eof: { stdout: true, stderr: false } }]) {
    await fixture(records => Object.assign(records['migrate-outer.json'], delta), async input => {
      await assert.rejects(readCompletedMigration(input, artifact));
    });
  }
});
test('unknown migration, wrong artifact and wrong checkpoint phase cannot continue', async () => {
  for (const change of [records => { records['migration-result.json'].outcome = 'unknown'; },
    records => { records['migration-result.json'].artifact.sourceHead = '0'.repeat(40); },
    records => { records['migration-checkpoint.json'].phase = 'not-complete'; }]) {
    await fixture(change, async input => { await assert.rejects(readCompletedMigration(input, artifact)); });
  }
});
