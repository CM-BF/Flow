import { defineConfig } from 'vitest/config';
if (!process.env.FLOW_S01_DELIVERY_TMP) throw new Error('owned_cache_required');
export default defineConfig({cacheDir:process.env.FLOW_S01_DELIVERY_TMP,test:{include:['experiments/runner-capacity/mixed/delivery-packing.test.ts'],maxWorkers:1,fileParallelism:false,testTimeout:5000}});
