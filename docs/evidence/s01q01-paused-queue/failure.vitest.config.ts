import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['docs/evidence/s01q01-paused-queue/pg-fixture.test.ts'], maxWorkers: 1, fileParallelism: false } });
