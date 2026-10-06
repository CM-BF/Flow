// Use the existing fixed toolchain; this worktree intentionally has no installed node_modules.
export default {
  cacheDir: '/tmp/flow-wpf02-diagnostic-vite-cache',
  resolve: { alias: { vitest: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js' } },
  test: { include: ['apps/runner/src/codex/stderr-capture.test.ts'], pool: 'threads', maxWorkers: 1,
    fileParallelism: false, testTimeout: 5000, hookTimeout: 5000 },
};
