import { defineConfig } from 'vitest/config';
import { isAbsolute } from 'node:path';

const cacheDir = process.env.FLOW_X01_BINDING_CACHE;
if (!cacheDir || !isAbsolute(cacheDir)) throw new Error('An owned absolute X01 cache directory is required');
export default defineConfig({
  cacheDir,
  test: {
    include: ['apps/server/src/plugin-runtime/runtime.test.ts', 'apps/server/src/plugins/plugins.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 10_000,
    hookTimeout: 60_000,
    cache: false,
  },
});
