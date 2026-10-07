import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: ['docs/evidence/req15-turn-page-batch/http-consumer.test.ts'],
  maxWorkers: 1, fileParallelism: false, cache: false,
  testTimeout: 40000, hookTimeout: 55000,
} });
