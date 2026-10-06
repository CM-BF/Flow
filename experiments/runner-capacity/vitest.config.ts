import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['experiments/runner-capacity/statistics.test.ts'], testTimeout: 5000, fileParallelism: false } });
