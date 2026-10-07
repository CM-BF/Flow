/** A single invocation of the reviewed current migration; the protocol owns all mutations. */
import assert from 'node:assert/strict';
import { lstat, mkdir, realpath, statfs } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { privateBytes } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-web-connection-lifecycle/docs/evidence/svc08/flow-host-artifact/personal-adoption/file-readers.mjs';
import { record } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/backend-release/docs/evidence/svc06/update-diagnostics-candidate/migration-adapter.mjs';
import { validateCurrentMigrationInput, loadCurrentMigrationModules, migrateCurrentArtifact } from './current-migration.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const safe = error => ({ name: error.name, code: /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'CURRENT_IMPORT_FAILED' });

export function invocationInput(input, identity) {
  assert.equal(input.ready, true, 'FRESH_INSTANCE_REQUIRED');
  assert.equal(input.runIdentity, null, 'RUN_MUST_BE_CREATED_EXCLUSIVELY');
  const value = { ...input, runIdentity: identity };
  validateCurrentMigrationInput(value);
  return value;
}

export async function readInstance(path, digest) {
  assert.ok(isAbsolute(path)); assert.match(digest, /^[a-f0-9]{64}$/);
  const { bytes, info } = await privateBytes(path, 131072);
  assert.equal(info.mode & 0o777, 0o600); assert.equal(await realpath(path), path);
  assert.equal(sha(bytes), digest, 'FIXED_INSTANCE_CHANGED');
  return JSON.parse(bytes);
}

export async function runImport(input, digest) {
  invocationInput(input, { dev: '0', ino: '0' }); // Pure required-parameter validation before any personal I/O.
  const parent = dirname(input.runDirectory), parentStat = await lstat(parent);
  assert.ok(parentStat.isDirectory() && !parentStat.isSymbolicLink()); assert.equal(await realpath(parent), parent);
  await mkdir(input.runDirectory, { mode: 0o700 }); // Existing namespace, including a symlink, is never reusable.
  const info = await lstat(input.runDirectory, { bigint: true });
  assert.ok(info.isDirectory() && !info.isSymbolicLink() && info.uid === BigInt(process.getuid()) && (info.mode & 0o777n) === 0o700n);
  assert.equal(await realpath(input.runDirectory), input.runDirectory);
  const runtime = invocationInput(input, { dev: String(info.dev), ino: String(info.ino) });
  await record(join(input.runDirectory, 'reservation.json'), { at: new Date().toISOString(), inputSha256: digest,
    runIdentity: runtime.runIdentity, artifact: input.artifact, personalAction: 'not-started' });
  let resourceFailure, active, primary, minimumFree = Infinity, samples = 0;
  const sample = () => active ?? (active = (async () => {
    try {
      const space = await statfs(input.runDirectory), free = Number(space.bavail) * Number(space.bsize);
      minimumFree = Math.min(minimumFree, free); samples++;
      assert.ok(free >= input.budget.liveBytes, 'LIVE_SPACE_GATE');
    } catch (error) { resourceFailure ??= error; } finally { active = null; }
  })());
  const healthy = () => { if (resourceFailure) throw resourceFailure; };
  await sample();
  const timer = setInterval(sample, 200);
  try {
    healthy(); const modules = await loadCurrentMigrationModules(runtime); healthy();
    await migrateCurrentArtifact(modules, runtime, healthy); healthy();
  } catch (error) { primary = error; }
  finally {
    clearInterval(timer); if (active) await active; await sample();
    try { await record(join(input.runDirectory, 'resource.json'), { minimumFree, samples,
      failure: resourceFailure ? safe(resourceFailure) : null, atomicPeak: false }); }
    catch (error) { primary ??= error; }
  }
  if (primary) throw primary; healthy();
  return { outcome: 'migration-complete', source: input.artifact.sourceHead, artifact: input.artifact.artifactId };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const [action, path, digest, ...extra] = process.argv.slice(2);
    assert.equal(action, '--execute-fixed-import'); assert.equal(extra.length, 0);
    console.log(JSON.stringify(await runImport(await readInstance(path, digest), digest)));
  } catch (error) { console.error(JSON.stringify({ outcome: 'unknown-keep', error: safe(error) })); process.exitCode = 1; }
}
