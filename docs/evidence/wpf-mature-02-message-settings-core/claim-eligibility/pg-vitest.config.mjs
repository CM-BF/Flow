import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const cacheDir=process.env.FLOW_X01_BINDING_CACHE;if(!cacheDir)throw Error('owned cache required');
export default {root,cacheDir,resolve:{alias:{'@flow/contracts':fileURLToPath(new URL('../../../../packages/contracts/src/index.ts',import.meta.url)),'@flow/plugin-runtime':fileURLToPath(new URL('../../../../packages/plugin-runtime/src/package-store.ts',import.meta.url))}},test:{include:['apps/server/src/execution-profiles/message-settings-claim-pg.test.ts'],maxWorkers:1,fileParallelism:false,cache:false,testTimeout:60000,hookTimeout:60000}};
