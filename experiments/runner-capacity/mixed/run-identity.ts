import { createHash } from 'node:crypto';
import { queueSourceBindings } from './queue-source-bindings.js';
import { CONTRACT, LARGE_CONTRACT, type RunContract } from './contract.js';
import { QUEUE_PROBE, BUFFERED_QUEUE, BUFFERED_IDENTITY, isQueueIdentity, queueContract } from './queue-probe.js';
import { COMPARISON, sideContract, type Side } from './ab-budget.js';

type SourceBinding = Readonly<{ path: string; bytes: number; sha256: string }>;
type RunIdentity = Readonly<{ id: string; base: string; output: string; preparation: string; contract: RunContract; requiredSources: readonly SourceBinding[] }>;
const legacy: RunIdentity = Object.freeze({
  id: 'legacy-v1', contract: CONTRACT, base: '4391bbf9f1785212d098ef6aa1c01a0320a003d3',
  output: 'docs/evidence/s01/mixed-run', preparation: 'docs/evidence/s01/mixed-preparation', requiredSources: Object.freeze([]),
});
const afterDrain: RunIdentity = Object.freeze({
  id: 'after-drain-v1', contract: CONTRACT, base: '0cee7556befa1988e60bae94b510240122c34b88',
  output: 'docs/evidence/s01/mixed-after-drain-run', preparation: 'docs/evidence/s01/mixed-after-drain-preparation',
  requiredSources: Object.freeze([
    Object.freeze({ path: 'apps/runner/src/runtime.ts', bytes: 14564, sha256: '790c706fd1207211334e77fa428d31d54e79dca91b6d66b35d56ab54f6512c8e' }),
    Object.freeze({ path: 'apps/runner/src/runtime-shutdown.test.ts', bytes: 13720, sha256: '09670094e39e2a3b2da6286c763d161e5b359231d472e655b2d44fe4c1a8c42d' }),
  ]),
});

const afterLightReads: RunIdentity = Object.freeze({ id: 'after-light-reads-128-v1', base: LARGE_CONTRACT.base, contract: LARGE_CONTRACT,
  output: 'docs/evidence/s01/mixed-128-run', preparation: 'docs/evidence/s01/mixed-128-preparation',
  requiredSources: Object.freeze([
  {
    "path": "apps/runner/src/runtime.ts",
    "bytes": 14832,
    "sha256": "f42986ab9f637c20ae8d804e7de17a0b028729875b8c253bd5692d8272e14edc"
  },
  {
    "path": "apps/runner/src/fixture.ts",
    "bytes": 2615,
    "sha256": "d9312d4765bad250acd6f1e9aef3b652e565aae57910f3c4966ebfe4b0e1642d"
  },
  {
    "path": "packages/client/src/index.ts",
    "bytes": 44108,
    "sha256": "a481b2422039612e109dfb08d0502b20f3550ef53247ada0a0fc400810d2f9dd"
  },
  {
    "path": "apps/server/src/runners.ts",
    "bytes": 11992,
    "sha256": "894fe80e02c3e9caa0d9eeeab1a80dcdd44fc15b81bbc6a30d519b45b7c37ea9"
  },
  {
    "path": "apps/server/src/sessions.ts",
    "bytes": 1593,
    "sha256": "901eefd23c4a1e33e2639149c7335e64bd63ecb0aaed3fb61e69e920ce9d847a"
  },
  {
    "path": "apps/server/src/events.ts",
    "bytes": 8678,
    "sha256": "4a2404d4a82f05dc3538c871dac3e9f0c15f5936310624bee787d6039e37f853"
  },
  {
    "path": "apps/server/src/tasks.ts",
    "bytes": 6621,
    "sha256": "eb49e822b01da67a02fda26800253f29b7c64df0f3b5b68076aab918b11ee64e"
  },
  {
    "path": "apps/server/src/queries.ts",
    "bytes": 2605,
    "sha256": "16070c2e9aede9ab7bfb011512e8be147c58f830a69ea2dcf2834004e0f0c0e4"
  },
  {
    "path": "apps/server/src/task-read-projection.ts",
    "bytes": 821,
    "sha256": "7194976171df9af15552a23d33958c3141178b311f686adc95cb435c30be04b4"
  },
  {
    "path": "apps/server/src/assistant-stream/queries.ts",
    "bytes": 5368,
    "sha256": "e8987ea10d90c16c61dbaf043b5ed32192ce184f4fd7a20a84659b653e22d7f5"
  },
  {
    "path": "apps/server/src/reconciliation.ts",
    "bytes": 11658,
    "sha256": "0c775485c18b5865192d0137cf69bab4517ab7142f4d69fca0f5d61d1e2527cd"
  },
  {
    "path": "apps/server/src/scheduler.ts",
    "bytes": 957,
    "sha256": "e7414df7cb05afbcf7205db030ee5825a9da0793c4c5ce2c237abba69a38aa0a"
  },
  {
    "path": "apps/server/src/index.ts",
    "bytes": 13507,
    "sha256": "e1c4bbc0c7d78132ed9f45af527ceaf65725f31321aedbce25af0171a261fdab"
  }
]),
});

export function selectRunIdentity(name = 'legacy-v1'): RunIdentity {
  if (name === 'legacy-v1') return legacy;
  if (name === 'after-drain-v1') return afterDrain;
  if (name === 'after-light-reads-128-v1') return afterLightReads;
  if (name === 'event-state-A-v1' || name === 'event-state-B-v1') {
    const side: Side = name === 'event-state-A-v1' ? 'A' : 'B';
    return Object.freeze({ id: name, base: COMPARISON.revisions[side], contract: sideContract(side),
      output: COMPARISON.output + '/' + side, preparation: COMPARISON.preparation,
      requiredSources: Object.freeze([{ path: 'apps/server/src/events.ts', bytes: side === 'A' ? 8678 : 8529,
        sha256: side === 'A' ? '4a2404d4a82f05dc3538c871dac3e9f0c15f5936310624bee787d6039e37f853' : '270065bc93cb5c5aeb306ffd3329ea122e6ee00eec6ba1808628694b1f7a1e02' }]) });
  }
  if (isQueueIdentity(name)) {
    const single = name === BUFFERED_IDENTITY;
    const side = single || name === 'queue-probe-O1-v1' ? 'A' : 'B';
    return Object.freeze({ id: name, base: QUEUE_PROBE.revisions[side], contract: queueContract(side),
      output: single ? BUFFERED_QUEUE.output + '/buffered' : QUEUE_PROBE.output + '/' + (side === 'A' ? 'O1' : 'O2'), preparation: QUEUE_PROBE.preparation, requiredSources: Object.freeze(queueSourceBindings.map(row => Object.freeze({ ...row }))) });
  }
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
