import { defineConfig } from 'vitest/config';
export default defineConfig({test:{fileParallelism:false,maxWorkers:1,testTimeout:3000,hookTimeout:3000,cache:false}});
