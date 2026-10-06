const cacheDir = process.env.CHAT06P03_CACHE_DIR;
if (!cacheDir) throw new Error('An owned CHAT06P03 cache directory is required.');
export default {
  root: new URL('../../../', import.meta.url).pathname,
  cacheDir,
  resolve: { alias: {
    vitest: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js',
    zod: '/Users/citrine/Projects/AgentHarness/Flow/packages/contracts/node_modules/zod/index.js',
  } },
  test: { include: ['apps/runner/src/assistant-stream/accumulator-incremental.test.ts'],
    pool: 'forks', maxWorkers: 1, fileParallelism: false, testTimeout: 5000,
    cache: false },
};
