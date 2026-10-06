export default {
  cacheDir: '/tmp/flow-wpf02-node-rootliteral-vitest-cache',
  resolve: { alias: [{ find: 'vitest', replacement: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js' }] },
  test: { include: ['experiments/codex-app-server-conformance/node-rootliteral/*.test.ts',
    'experiments/codex-app-server-conformance/diagnostics/composition-preparation.test.ts',
    'experiments/codex-app-server-conformance/diagnostics/driver-preparation.test.ts'], pool: 'threads', maxWorkers: 1,
    fileParallelism: false, testTimeout: 3000, hookTimeout: 3000 },
};
