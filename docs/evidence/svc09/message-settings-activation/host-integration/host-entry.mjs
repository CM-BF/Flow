// Work owner: no retry, no public installation, no native adapter invocation.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { statfs } from 'node:fs/promises';
import { validateHostInput, runHostConsumer } from './host-consumer.mjs';
import { setupFixture, poolOptions, exclusive } from './host-fixture.mjs';
import { privateJson, recorder, rootIdentity, failure } from './host-records.mjs';
import { hostInputPath } from './host-paths.mjs';

export function validateArguments(argv) {
  assert.equal(argv.length, 2); assert.equal(argv[0], '--work-once');
  return hostInputPath(argv[1]);
}

export function assertResourceSample({ directory, databaseBytes, freeBytes }) {
  assert.ok(directory.state === 'complete' && directory.entries <= 4096 && directory.logical_bytes <= 32 * 1024 ** 2, 'PRIVATE_MEASUREMENT_LIMIT_OR_UNKNOWN');
  assert.ok(databaseBytes === null || databaseBytes <= 128 * 1024 ** 2, 'OWN_DATABASE_BYTE_LIMIT');
  assert.ok(freeBytes >= 1024 ** 3, 'LIVE_RESERVE_LIMIT');
}

export async function main(argv) {
  const input = await privateJson(validateArguments(argv));
  const root = validateHostInput(input); await rootIdentity(input);
  assert.equal(input.records, join(input.directory, 'records'));
  assert.equal(input.providerCalls, 0);
  const record = recorder(input, 'work');
  let phase = 'setup', primary = null, pool = null; const cleanupFailures = [];
  const checkpoint = async (name, fact) => {
    const sampled = await promisify(execFile)(input.python.path, [fileURLToPath(new URL('./measure-once.py', import.meta.url)), argv[1]],
      { timeout: 1000, maxBuffer: 8192, env: { PATH: '/usr/bin:/bin', PYTHONDONTWRITEBYTECODE: '1' } });
    const directory = JSON.parse(sampled.stdout);
    const databaseBytes = pool ? Number((await pool.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes) : null;
    const disk = await statfs(input.directory), freeBytes = disk.bavail * disk.bsize;
    await record(name, fact, { directory, databaseBytes, freeBytes, meaning: 'Phase observations, not atomic or physical peak limits' });
    assertResourceSample({ directory, databaseBytes, freeBytes });
  };
  try {
    // Import resolution is fixed to the verified clone, never the moving checkout.
    const { backendRuntime } = await import(pathToFileURL(join(root, 'tools/personal-preview/backend-release/host.mjs')).href);
    await backendRuntime({ directory: input.directory, repository: input.repository }, input.artifact);
    const setup = await setupFixture({ input, root, checkpoint, adminUrl: process.env.FLOW_SVC09A_ADMIN_URL });
    input.webArtifact = setup.webArtifact;
    const { Pool } = createRequire(join(root, 'package.json'))('pg');
    pool = new Pool(poolOptions(setup.config.databaseUrl));
    phase = 'host-consumer';
    const result = await runHostConsumer({ input, pool, checkpoint });
    await checkpoint('work-complete', result);
  } catch (error) { primary = failure(error, phase); }
  finally {
    if (pool) try { await pool.end(); } catch (error) { cleanupFailures.push(failure(error, 'work-pool-close')); }
  }
  const result = { phase, primary, cleanupFailures, workComplete: !primary && cleanupFailures.length === 0,
    providerCalls: 0, cleanup: 'PENDING_INDEPENDENT_OWNER', privateDirectory: 'KEEP' };
  await record('work-closure', result); // Preserve the first failure even when resource measurement itself failed.
  await exclusive(join(input.records, 'work-result.json'), result);
  process.stdout.write(JSON.stringify(result) + '\n');
  return result.workComplete ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(process.argv.slice(2)); }
  catch (error) { process.stderr.write(JSON.stringify(failure(error, 'entry-or-persistence')) + '\n'); process.exitCode = 1; }
}
