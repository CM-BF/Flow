export default {
  cacheDir: process.env.FLOW_S01P07_CACHE,
  test: { include: ['apps/server/src/runner-claim-receipts.test.ts'], fileParallelism: false, maxWorkers: 1,
    bail: 1, testTimeout: 20000, hookTimeout: 80000 },
};
