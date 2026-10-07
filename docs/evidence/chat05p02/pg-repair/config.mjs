export default {
  cacheDir: process.env.FLOW_TEST_CACHE_DIR,
  test: { include: ['docs/evidence/chat05p02/pg-repair/material.test.ts'], maxWorkers: 1, fileParallelism: false, testTimeout: 3000 },
};
