import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const cacheDir=process.env.FLOW_X01_BINDING_CACHE;if(!cacheDir?.startsWith('/'))throw Error('Owned cache required');
export default {root,cacheDir,test:{include:['apps/runner/src/plugins/semver-upstream-upgrade.test.ts'],maxWorkers:1,fileParallelism:false,cache:false,testTimeout:15000,hookTimeout:15000}};
