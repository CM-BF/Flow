export default {
  cacheDir: process.env.FLOW_TEST_CACHE_DIR,
  test: {
    include: ['packages/client/src/native-activity-body.test.ts', 'apps/runner/src/native-activity-body/host.test.ts'],
    maxWorkers: 1, fileParallelism: false, testTimeout: 10000, hookTimeout: 10000,
  },
};
