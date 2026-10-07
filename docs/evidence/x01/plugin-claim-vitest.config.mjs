import { defineConfig } from 'vitest/config';
import { isAbsolute } from 'node:path';
const cacheDir = process.env.FLOW_X01_BINDING_CACHE;
if (!cacheDir || !isAbsolute(cacheDir)) throw new Error('Owned absolute cache is required');
export default defineConfig({ cacheDir, test: { include: ['packages/contracts/src/plugin-runner-claim.test.ts',
  'apps/runner/src/admission-plugin-claim.test.ts'], fileParallelism: false, maxWorkers: 1,
  testTimeout: 5000, hookTimeout: 5000, cache: false } });
