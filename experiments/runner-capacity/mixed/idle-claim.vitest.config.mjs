import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const mirror = resolve(root, 'docs/evidence/s01/idle-claim-cost/source-snapshot');
const mode = process.env.FLOW_S01_IDLE_MODE;
if (mode !== 'fake' && mode !== 'actual') throw Error('EXPLICIT_IDLE_MODE_REQUIRED');
const owned = process.env.FLOW_S01_IDLE_ROOT;
if (!owned || !owned.startsWith('/') || process.env.NODE_DISABLE_COMPILE_CACHE !== '1' || process.env.NODE_COMPILE_CACHE) throw Error('OWN_ROOT_AND_DISABLED_COMPILE_CACHE_REQUIRED');
export default {
  root,
  cacheDir: resolve(owned, 'vite'),
  resolve: { alias: {
    '@flow/contracts': resolve(mirror, 'packages/contracts/src/index.ts'),
    '@flow/client': resolve(mirror, 'packages/client/src/index.ts'),
    zod: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/zod@4.6.5/node_modules/zod',
  } },
  test: {
    include: [mode === 'actual' ? 'experiments/runner-capacity/mixed/idle-claim.test.ts' : 'experiments/runner-capacity/mixed/idle-claim-{observer,budget}.test.ts'],
    fileParallelism: false, maxWorkers: 1, minWorkers: 1, pool: 'forks',
    cache: false, watch: false, testTimeout: 15000, hookTimeout: 15000,
    experimental: { fsModuleCache: false },
    deps: { optimizer: { client: { enabled: false }, ssr: { enabled: false } } },
  },
};
