import { defineConfig } from 'vitest/config';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const snapshot = resolve(root, 'docs/evidence/x01-host-candidates-client/contract-snapshot/packages/contracts/src/plugin-runtime-hosts.ts');
export default defineConfig({ plugins: [{ name: 'fixed-host-contract', enforce: 'pre', resolveId(id, importer) {
  if (!importer || !id.startsWith('.')) return;
  const path = resolve(dirname(importer), id);
  if (path === resolve(root, 'packages/contracts/src/plugin-runtime-hosts.js')) return snapshot;
  if (importer === snapshot && (id === './plugins.js' || id === './plugin-runtime.js')) return resolve(root, 'packages/contracts/src', id.replace(/\.js$/, '.ts'));
} }], test: { fileParallelism: false, maxWorkers: 1, testTimeout: 3000, hookTimeout: 3000, cache: false } });
