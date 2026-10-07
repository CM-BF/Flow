import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./inputs/',import.meta.url));
export default {root,resolve:{alias:{'@flow/contracts':root+'packages/contracts/src/index.ts','@flow/client':root+'packages/client/src/index.ts','@flow/plugin-runtime':root+'packages/plugin-runtime/src/package-store.ts','@av03/pre036-server':root+'apps/server/src/pre036-index.ts'}},test:{include:['apps/server/src/plugin-runtime/verification-pg.test.ts'],environment:'node',fileParallelism:false,maxWorkers:1,pool:'forks',testTimeout:20000,hookTimeout:60000}};
