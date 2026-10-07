import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./public-runner-inputs/',import.meta.url));
const cacheDir=process.env.FLOW_X01_BINDING_CACHE;
if(!cacheDir?.startsWith('/'))throw Error('Owned cache required');
export default {root,cacheDir,resolve:{alias:{'@flow/client':root+'packages/client/src/index.ts','@flow/contracts':root+'packages/contracts/src/index.ts','@flow/plugin-runtime':root+'packages/plugin-runtime/src/package-store.ts'}},test:{include:['apps/server/src/plugin-runtime/public-runner-pg.test.ts'],maxWorkers:1,fileParallelism:false,cache:false,testTimeout:45000,hookTimeout:60000}};
