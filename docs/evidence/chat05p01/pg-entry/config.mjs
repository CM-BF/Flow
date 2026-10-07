import { defineConfig } from 'vitest/config';
export default defineConfig({
  cacheDir: process.env.FLOW_TEST_CACHE_DIR,
  test: {
    include: ['apps/server/src/native-activity-body/body.test.ts'],
    fileParallelism: false, maxWorkers: 1,
    testTimeout: 25000, hookTimeout: 20000,
    reporters: ['default', 'json'],
    outputFile: { json: 'docs/evidence/chat05p01/pg-run-01/vitest.json' },
  },
});
