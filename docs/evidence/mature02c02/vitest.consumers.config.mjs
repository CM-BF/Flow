export default {
  cacheDir: process.env.FLOW_C02_TEST_CACHE,
  resolve: { alias: { vitest: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js' } },
  test: { include: [
    'apps/runner/src/native-harness/codex/adapter.test.ts',
    'apps/runner/src/native-harness/codex/exchange.test.ts',
    'apps/runner/src/engineering/native-writer.test.ts',
  ], pool: 'forks', maxWorkers: 1, minWorkers: 1, fileParallelism: false, testTimeout: 4000, hookTimeout: 4000 },
};
