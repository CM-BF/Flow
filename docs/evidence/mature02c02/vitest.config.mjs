export default {
  cacheDir: process.env.FLOW_C02_TEST_CACHE,
  resolve: { alias: { vitest: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js' } },
  test: { include: [
    'packages/contracts/src/codex-session.test.ts',
    'packages/contracts/src/execution-profiles.test.ts',
    'apps/runner/src/native-harness/codex/session-storage.test.ts',
    'apps/runner/src/native-harness/codex/continuity.test.ts',
    'apps/runner/src/engineering/native-policy.test.ts',
  ], pool: 'forks', maxWorkers: 1, minWorkers: 1, fileParallelism: false, testTimeout: 2000, hookTimeout: 2000 },
};
