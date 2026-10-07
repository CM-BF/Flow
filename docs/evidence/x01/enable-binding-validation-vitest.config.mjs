import { defineConfig } from 'vitest/config';
import { isAbsolute } from 'node:path';

// Preparation only. The reviewed supervisor must own this fresh cache and TMPDIR.
const cacheDir = process.env.FLOW_X01_BINDING_CACHE;
if (!cacheDir || !isAbsolute(cacheDir)) throw new Error('An owned absolute X01 cache directory is required');
export default defineConfig({
  cacheDir,
  test: {
    include: ['packages/contracts/src/plugin-runtime.test.ts', 'apps/runner/src/plugins/execution.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    cache: false,
  },
});
