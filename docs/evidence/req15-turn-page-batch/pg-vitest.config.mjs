import { defineConfig } from 'vitest/config';
export default defineConfig({ cacheDir: 'docs/evidence/req15-turn-page-batch/cache', test: {
  include: ['docs/evidence/req15-turn-page-batch/pg-turn-page.test.ts'], cache: false,
  maxWorkers: 1, fileParallelism: false, testTimeout: 21_000, hookTimeout: 28_000,
} });
