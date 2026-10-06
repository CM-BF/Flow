export default { cacheDir: '/tmp/flow-wpf02-native-pagesize-vitest-cache', test: {
  include: ['experiments/codex-app-server-conformance/native-pagesize/host.test.ts'],
  pool: 'threads', maxWorkers: 1, fileParallelism: false, testTimeout: 5000, hookTimeout: 5000,
} };
