import { defineConfig } from 'vitest/config';
if (!process.env.FLOW_S01_DELIVERY_TMP) throw new Error('owned_cache_path_required');
export default defineConfig({ cacheDir: process.env.FLOW_S01_DELIVERY_TMP,
  test: { include: ['experiments/runner-capacity/mixed/queue-buffered.test.ts', 'experiments/runner-capacity/mixed/ab-sequence.test.ts'],
    maxWorkers: 1, fileParallelism: false, testTimeout: 5000, hookTimeout: 5000 } });
