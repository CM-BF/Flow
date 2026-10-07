import { defineConfig } from 'vitest/config';
if (!process.env.FLOW_S01_REPLAY_TMP) throw new Error('owned_cache_path_required');
export default defineConfig({ cacheDir: process.env.FLOW_S01_REPLAY_TMP,
  test: { include: ['experiments/runner-capacity/mixed/delivery-replay.test.ts'], maxWorkers: 1,
    fileParallelism: false, testTimeout: 5000, hookTimeout: 5000 } });
