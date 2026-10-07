import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./inputs/',import.meta.url));
export default {root,resolve:{alias:{'@flow/contracts':root+'packages/contracts/src/index.ts','@flow/client':root+'packages/client/src/index.ts','@flow/plugin-runtime':root+'packages/plugin-runtime/src/package-store.ts'}},test:{environment:'node',testTimeout:5000,fileParallelism:false,maxWorkers:1,pool:'forks'}};
