import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('./runtime-main-inputs/',import.meta.url));
const path=relative=>fileURLToPath(new URL('./runtime-main-inputs/'+relative,import.meta.url));
const cacheDir=process.env.FLOW_X01_BINDING_CACHE;
if(!cacheDir?.startsWith('/'))throw new Error('Owned cache required');
export default {root,cacheDir,resolve:{alias:{'@flow/client':path('packages/client/src/index.ts'),'@flow/contracts':path('packages/contracts/src/index.ts'),'@flow/plugin-runtime':path('packages/plugin-runtime/src/package-store.ts')}},test:{include:['apps/runner/src/plugins/runtime.test.ts','packages/client/src/plugin-runner.test.ts'],maxWorkers:1,fileParallelism:false,cache:false,testTimeout:3000,hookTimeout:3000}};
