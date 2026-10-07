import { defineConfig } from 'vitest/config';
import { isAbsolute } from 'node:path';
const cacheDir=process.env.FLOW_X01_BINDING_CACHE;
if (!cacheDir || !isAbsolute(cacheDir)) throw new Error('Owned cache required');
export default defineConfig({cacheDir,test:{include:['apps/runner/src/plugins/semver-package.test.ts'],fileParallelism:false,maxWorkers:1,testTimeout:10000,hookTimeout:10000,cache:false}});
