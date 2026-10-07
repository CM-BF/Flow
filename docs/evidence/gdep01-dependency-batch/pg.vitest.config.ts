import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['apps/server/src/goals/dependency-content.pg.test.ts'], fileParallelism: false, maxWorkers: 1, testTimeout: 20_000, hookTimeout: 115_000 }, cacheDir: process.env.TMPDIR });
