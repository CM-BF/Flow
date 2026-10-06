import { createHash } from 'node:crypto';

type SourceBinding = Readonly<{ path: string; bytes: number; sha256: string }>;
type RunIdentity = Readonly<{ id: string; base: string; output: string; preparation: string; requiredSources: readonly SourceBinding[] }>;
const legacy: RunIdentity = Object.freeze({
  id: 'legacy-v1', base: '4391bbf9f1785212d098ef6aa1c01a0320a003d3',
  output: 'docs/evidence/s01/mixed-run', preparation: 'docs/evidence/s01/mixed-preparation', requiredSources: Object.freeze([]),
});
const afterDrain: RunIdentity = Object.freeze({
  id: 'after-drain-v1', base: '0cee7556befa1988e60bae94b510240122c34b88',
  output: 'docs/evidence/s01/mixed-after-drain-run', preparation: 'docs/evidence/s01/mixed-after-drain-preparation',
  requiredSources: Object.freeze([
    Object.freeze({ path: 'apps/runner/src/runtime.ts', bytes: 14564, sha256: '790c706fd1207211334e77fa428d31d54e79dca91b6d66b35d56ab54f6512c8e' }),
    Object.freeze({ path: 'apps/runner/src/runtime-shutdown.test.ts', bytes: 13720, sha256: '09670094e39e2a3b2da6286c763d161e5b359231d472e655b2d44fe4c1a8c42d' }),
  ]),
});

export function selectRunIdentity(name = 'legacy-v1'): RunIdentity {
  if (name === 'legacy-v1') return legacy;
  if (name === 'after-drain-v1') return afterDrain;
  throw new Error('Unreviewed mixed-run identity.');
}

export async function verifyRunSources(identity: RunIdentity, readSource: (path: string) => Promise<Buffer>): Promise<void> {
  for (const binding of identity.requiredSources) {
    const bytes = await readSource(binding.path);
    if (bytes.length !== binding.bytes || createHash('sha256').update(bytes).digest('hex') !== binding.sha256) {
      throw new Error('Required source differs from approved implementation: ' + binding.path);
    }
  }
}
