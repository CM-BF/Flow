import { defineConfig } from 'vitest/config';
export default defineConfig({ cacheDir: process.env.FLOW_S01_DELIVERY_TMP,
  test: { include: ['experiments/runner-capacity/mixed/pg-delivery.test.ts'], maxWorkers: 1, fileParallelism: false, testTimeout: 5000, hookTimeout: 5000 } });
