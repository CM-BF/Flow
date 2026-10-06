import { createRequire } from 'node:module';
const fixed = '/Users/citrine/Projects/AgentHarness/Flow';
const require = createRequire(`${fixed}/package.json`);
const runtimePaths = [fixed, `${fixed}/apps/server`, `${fixed}/apps/runner`, `${fixed}/packages/contracts`];
const root = new URL('../../../', import.meta.url).pathname;
export default {
  cacheDir: '/tmp/flow-wpf02-native-catalog-cache',
  resolve: { alias: [
    { find: '@flow/contracts', replacement: `${root}packages/contracts/src/index.ts` },
    { find: '@flow/client', replacement: `${root}packages/client/src/index.ts` },
    { find: 'vitest', replacement: `${fixed}/node_modules/vitest/dist/index.js` },
    ...['zod', 'pg', 'pg-boss', 'fastify', '@fastify/cors', 'npm-package-arg', 'pacote', 'ssri', '@anthropic-ai/claude-agent-sdk'].map(name => ({ find: name, replacement: require.resolve(name, { paths: runtimePaths }) })),
  ] },
  test: { include: ['packages/contracts/src/execution-profiles.test.ts', 'apps/server/src/execution-profiles/native-catalog.test.ts',
    'apps/server/src/execution-profiles/execution-profiles.test.ts', 'apps/server/src/execution-profiles/steering-admission.test.ts',
    'packages/client/src/execution-profiles.test.ts', 'packages/client/src/native-profile-publication.test.ts'],
    pool: 'threads', maxWorkers: 1, fileParallelism: false, testTimeout: 15_000, hookTimeout: 15_000 },
};
