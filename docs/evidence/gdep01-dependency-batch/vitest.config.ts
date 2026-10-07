import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['apps/server/src/goals/dependency-content.test.ts'], fileParallelism: false, maxWorkers: 1, testTimeout: 3000, hookTimeout: 3000 }, cacheDir: process.env.TMPDIR });
