import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['experiments/runner-capacity/mixed/*.test.ts'], fileParallelism: false, testTimeout: 5000 } });
