// Two fixed controller files plus links to one unchanged artifact. No process or service authority.
import assert from 'node:assert/strict';
import { lstat, readFile, realpath, mkdir, open, symlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function bytesAt(path, pin) {
  const before = await lstat(path, { bigint: true });
  assert.ok(before.isFile() && !before.isSymbolicLink() && before.size === BigInt(pin.bytes));
  const bytes = await readFile(path), after = await lstat(path, { bigint: true });
  assert.equal(before.dev, after.dev); assert.equal(before.ino, after.ino); assert.equal(before.mtimeNs, after.mtimeNs);
  assert.equal(bytes.length, pin.bytes); assert.equal(sha(bytes), pin.sha256); return bytes;
}
export async function prepareControllerDriver(input, directory) {
  assert.equal(input.format, 1); assert.equal(input.controllerSource, 'f0e434bd04c496fbd60e8458c3f840f4d7b25e80');
  assert.equal(input.artifact.sourceHead, '098b0d51512dfaa04c30ca7cbe103684720fe29f');
  assert.equal(input.artifact.artifactId, '2515a9069f07f1c6253e4eeb647ec3a105bca1fa3c9561f7bb11dca195bc3bd4');
  assert.equal(input.manifest.sha256, input.artifact.artifactId);
  assert.equal(await realpath(input.artifactRoot), input.artifactRoot);
  const source = await lstat(input.artifactRoot, { bigint: true });
  assert.deepEqual({ dev: String(source.dev), ino: String(source.ino) }, input.artifactRootIdentity);
  await bytesAt(input.manifest.path, input.manifest);
  for (const pin of input.relativeClosure) await bytesAt(join(input.artifactRoot, pin.path), pin);
  assert.equal(await realpath(join(input.artifactRoot, input.barePg.link)), input.barePg.realpath);
  for (const pin of input.barePg.pins) await bytesAt(join(input.artifactRoot, pin.relativeToArtifact), pin);
  const parent = await lstat(dirname(directory));
  assert.ok(parent.isDirectory() && !parent.isSymbolicLink() && parent.uid === process.getuid() && (parent.mode & 0o777) === 0o700);
  assert.equal(await realpath(dirname(directory)), dirname(directory));
  await mkdir(directory, { mode: 0o700 }); // Existing namespaces are never reused.
  const created = [directory]; const directories = new Set([directory]);
  async function parents(path) {
    if (directories.has(path)) return;
    await parents(dirname(path)); await mkdir(path, { mode: 0o700 }); directories.add(path); created.push(path);
  }
  for (const pin of input.controller) {
    assert.ok(['tools/personal-preview/preview.mjs', 'tools/personal-preview/process.mjs'].includes(pin.path));
    const bytes = await bytesAt(join(input.controllerRepository, pin.path), pin), path = join(directory, pin.path);
    await parents(dirname(path));
    const file = await open(path, 'wx', 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    created.push(path);
  }
  for (const relative of [...input.directLinks, input.barePg.link]) {
    assert.ok(relative === input.barePg.link || input.relativeClosure.some(pin => pin.path === relative));
    const path = join(directory, relative); await parents(dirname(path));
    const target = join(input.artifactRoot, relative); await symlink(target, path); created.push(path);
    assert.equal(await realpath(path), await realpath(target));
  }
  const identities = [];
  for (const path of created) {
    const info = await lstat(path, { bigint: true });
    identities.push({ path, dev: String(info.dev), ino: String(info.ino), kind: info.isSymbolicLink() ? 'symlink' : info.isDirectory() ? 'directory' : 'file' });
  }
  return { entry: join(directory, 'tools/personal-preview/preview.mjs'), identities };
}
