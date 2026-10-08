import { mkdtemp, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createNativeEnvironmentPolicy } from './native-environment.mjs';
import { validatePermit, PHASE_LIMITS, NATIVE_MODEL } from './permit.mjs';

/** Test-only tiny regular files stand in for package, library and binary; nothing is executed. */
export async function environmentFixture(policyOptions) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'o16-env-unit-')));
  const runtime = [];
  for (const name of ['package.json', 'sdk.mjs', 'native']) {
    const bytes = Buffer.from(`synthetic-${name}`), path = join(root, name);
    await writeFile(path, bytes, { mode: 0o400, flag: 'wx' });
    runtime.push({ path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const phase = join(root, 'phase'); await mkdir(phase, { mode: 0o700 });
  const cwd = join(phase, 'runtime'); await mkdir(cwd, { mode: 0o700 });
  const policy = createNativeEnvironmentPolicy(runtime, policyOptions), source = { root, digest: 'a'.repeat(64) };
  const binding = await policy.prepare(phase, source);
  return { root, phase, cwd, runtime, policy, source, binding,
    nativeEnvironment: { policy, binding, source }, async dispose() { await rm(root, { recursive: true }); } };
}
export function permitInput(fixture, phase = 'plan', confirmation) {
  const now = Date.now();
  return { kind: 'flow.o16.phase-permit.v2', authorizedBy: 'Goal Owner', approvalId: 'synthetic-env-test-only', phase,
    sourceDigest: fixture.source.digest, worktree: fixture.source.root, environmentDigest: fixture.policy.digest,
    model: NATIVE_MODEL, limits: PHASE_LIMITS[phase], approvedAt: new Date(now - 1000).toISOString(),
    expiresAt: new Date(now + 60000).toISOString(), authorizationReference: 'SYNTHETIC unit fixture; no real model authorization',
    ...(confirmation ? { confirmation } : {}) };
}
export function fixturePermit(fixture) {
  return validatePermit(permitInput(fixture), { identity: fixture.source, phase: 'plan', environmentDigest: fixture.policy.digest });
}
