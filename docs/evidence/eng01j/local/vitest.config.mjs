export default {
  cacheDir: process.env.FLOW_ENG01J_CACHE,
  resolve: { alias: { vitest: '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/vitest/dist/index.js' } },
  test: {
    include: ['apps/runner/src/engineering/native-authority.test.ts', 'apps/runner/src/engineering/native-authority-darwin.test.ts'],
    environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false,
    testTimeout: 3000, hookTimeout: 3000,
  },
};
