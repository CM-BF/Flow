import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  resolve: { alias: { '@flow/contracts': fileURLToPath(new URL('../../../packages/contracts/src/index.ts', import.meta.url)) } },
  test: { include: ['apps/server/src/event-state.test.ts'], fileParallelism: false, testTimeout: 10_000, hookTimeout: 20_000 },
});
