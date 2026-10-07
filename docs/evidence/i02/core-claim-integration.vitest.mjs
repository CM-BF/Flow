import {fileURLToPath} from 'node:url';
const cacheDir=process.env.FLOW_I02_CACHE; if(!cacheDir) throw Error('OWN_CACHE_REQUIRED');
export default {root:fileURLToPath(new URL('../../../',import.meta.url)),cacheDir,test:{include:['apps/server/src/runner-claim-routes.test.ts','apps/server/src/plugin-runtime/claim.test.ts'],maxWorkers:1,fileParallelism:false,cache:false,testTimeout:10000,hookTimeout:10000}};
