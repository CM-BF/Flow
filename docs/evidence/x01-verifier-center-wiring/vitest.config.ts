import { fileURLToPath } from 'node:url';
const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
export default {
  root: path('./inputs/'),
  resolve: { alias: { '@flow/contracts': path('./inputs/packages/contracts/src/index.ts'), '@flow/client': path('./inputs/packages/client/src/index.ts'), '@flow/plugin-runtime': path('./inputs/packages/plugin-runtime/src/package-store.ts') } },
  test: { include: ['apps/server/src/plugin-verification-wiring.test.ts'], fileParallelism: false, maxWorkers: 1, testTimeout: 5000, hookTimeout: 5000 },
};
