export default {
  cacheDir: '/tmp/flow-wpf02-node-runtime-metadata-vitest-cache',
  resolve: { alias: [{ find: 'vitest', replacement: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js' }] },
  test: { include: ['experiments/codex-app-server-conformance/node-runtime-metadata/*.test.ts',
    'experiments/codex-app-server-conformance/node-loader-cause/probe.test.ts',
    'experiments/codex-app-server-conformance/node-rootliteral/host.test.ts',
    'experiments/codex-app-server-conformance/node-rootliteral/composition.test.ts'],
    pool: 'threads', maxWorkers: 1, fileParallelism: false, testTimeout: 3000, hookTimeout: 3000 },
};
