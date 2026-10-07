import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
const root = process.cwd();
export default defineConfig({ plugins: [{ name: 'fixed-x01-input', enforce: 'pre', resolveId(id, importer) {
 if (id === './plugin-runner.js' && importer?.endsWith('/packages/client/src/index.ts')) return resolve(root,'docs/evidence/mature06-readbound/support/packages/client/src/plugin-runner.ts');
 if (importer?.endsWith('/mature06-readbound/support/packages/client/src/plugin-runner.ts') && id.startsWith('../../contracts/src/')) return resolve(root,'packages/contracts/src',id.slice('../../contracts/src/'.length).replace(/\.js$/,'.ts'));
} }], test: { fileParallelism:false, maxWorkers:1, testTimeout:1500, hookTimeout:3000, cache:false } });
