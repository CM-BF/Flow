export default {
  cacheDir: process.env.FLOW_C02_TEST_CACHE,
  resolve: { alias: { vitest: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js' } },
  test: { include: ['apps/runner/src/configuration.test.ts', 'apps/runner/src/native-harness/codex/launch.test.ts'],
    pool: 'forks', maxWorkers: 1, minWorkers: 1, fileParallelism: false, testTimeout: 2000, hookTimeout: 2000 },
};
