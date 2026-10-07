export default {
  cacheDir: process.env.FLOW_C02_TEST_CACHE,
  resolve: { alias: { vitest: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js' } },
  test: {
    include: ['apps/server/src/assistant-stream/public-stream-pg.test.ts'],
    pool: 'forks', maxWorkers: 1, minWorkers: 1, fileParallelism: false,
    testTimeout: 10000, hookTimeout: 65000,
  },
};
