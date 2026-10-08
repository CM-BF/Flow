import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceIdentity } from '../../../../experiments/continuous-goal-acceptance/identity.mjs';
import { nativeEnvironmentPolicy } from '../../../../experiments/continuous-goal-acceptance/native-environment.mjs';
import { writeRecord } from '../../../../experiments/continuous-goal-acceptance/records.mjs';

export function publicHomeEnvironment(binding) {
  return { ...nativeEnvironmentPolicy.environment(binding),
    CLAUDE_CODE_ENTRYPOINT: 'sdk-ts', CLAUDE_AGENT_SDK_VERSION: '0.3.290',
    CLAUDE_CODE_SDK_READS_SESSION_STATE: '1' };
}

export async function prepare() {
  const control = resolve('docs/evidence/o16/auth-home-factor-once');
  const reservation = JSON.parse(await readFile(join(control, 'reservation.json'), 'utf8'));
  assert.equal(reservation.kind, 'O16_HOME_FACTOR_AUTH_STATUS_ONCE');
  const root = reservation.scratch, info = await lstat(root.path);
  assert(info.isDirectory() && !info.isSymbolicLink() && info.uid === process.getuid());
  assert.equal(info.dev, root.dev); assert.equal(info.ino, root.ino);
  const source = await sourceIdentity();
  assert.equal(source.digest, 'c6d957f101c1084a1298c8c933d81ee898bfe94a5faa0f4e3d19139d5d056816');
  assert.equal(nativeEnvironmentPolicy.digest, '4111341d2a26aac0b95c72deb2c571415b0d893ffad23d81d0fbaaaf8e518659');
  const binding = await nativeEnvironmentPolicy.prepare(root.path, source);
  await writeRecord(join(control, 'prepared.json'), { binding, environment: publicHomeEnvironment(binding),
    sourceDigest: source.digest, sourceFiles: source.files.length, aliases: source.dependencies.length,
    SDKImports: 0, queryCalls: 0 }, { exclusive: true });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['--prepare-home-factor-once']);
  await prepare();
}
