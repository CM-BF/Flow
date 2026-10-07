import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./inputs/',import.meta.url));
export default {root,resolve:{alias:{'@flow/contracts':root+'packages/contracts/src/index.ts','@flow/client':root+'packages/client/src/index.ts','@flow/plugin-runtime':root+'packages/plugin-runtime/src/package-store.ts'}},test:{include:['apps/server/src/plugin-runtime/verification-admission-pg.test.ts'],environment:'node',fileParallelism:false,maxWorkers:1,pool:'forks',testTimeout:25000,hookTimeout:60000}};
