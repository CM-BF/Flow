import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
export default {root,resolve:{alias:[{find:/^@flow\/contracts$/,replacement:root+'packages/contracts/src/index.ts'},{find:/^@flow\/client$/,replacement:root+'packages/client/src/index.ts'},{find:/^@flow\/plugin-runtime$/,replacement:root+'packages/plugin-runtime/src/package-store.ts'}]},test:{include:['apps/server/src/plugin-verification-wiring.test.ts'],fileParallelism:false,maxWorkers:1,testTimeout:5000,hookTimeout:5000}};
