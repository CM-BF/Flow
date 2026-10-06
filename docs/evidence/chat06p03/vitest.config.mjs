export default {
  root: new URL('../../../', import.meta.url).pathname,
  resolve: { alias: {
    vitest: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js',
    zod: '/Users/citrine/Projects/AgentHarness/Flow/packages/contracts/node_modules/zod/index.js',
  } },
  test: { include: ['apps/runner/src/assistant-stream/accumulator-incremental.test.ts'],
    pool: 'forks', maxWorkers: 1, fileParallelism: false, testTimeout: 5000,
    cache: false },
};
