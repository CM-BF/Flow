export default {
  cacheDir: '/tmp/flow-wpf02-diagnostic-driver-vite-cache',
  resolve: { alias: { vitest: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js' } },
  test: { include: ['experiments/codex-app-server-conformance/diagnostics/driver-preparation.test.ts'],
    pool: 'threads', maxWorkers: 1, fileParallelism: false, testTimeout: 5000, hookTimeout: 5000 },
};
