import { defineConfig } from 'vitest/config';
export default defineConfig({ cacheDir: process.env.FLOW_S01_WIRING_TMP, test: { include: ['experiments/runner-capacity/mixed/pg-delivery-wiring.test.ts'], maxWorkers: 1, fileParallelism: false, testTimeout: 10000, hookTimeout: 5000 } });
