import { fileURLToPath } from 'node:url';

export default {
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./.validation-cache/vite', import.meta.url)),
  resolve: { alias: { zod: '/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/zod@4.6.5/node_modules/zod/index.js' } },
  test: { include: ['packages/contracts/src/claude-turn-settings.test.ts'], fileParallelism: false, maxWorkers: 1 },
};
