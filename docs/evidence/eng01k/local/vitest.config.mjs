export default {
 cacheDir: process.env.FLOW_ENG01K_CACHE,
 resolve: { alias: { vitest: '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/vitest/dist/index.js', '@flow/contracts': '/Users/citrine/Projects/AgentHarness/Flow-worktrees/engineering-trusted-tool-writer/packages/contracts/src/index.ts', zod: '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/packages/contracts/node_modules/zod/index.js' } },
 test: { include: ['apps/runner/src/engineering/native-tool-writer.test.ts','apps/runner/src/engineering/native-tool-policy.test.ts','apps/runner/src/native-harness/codex/exchange.test.ts','apps/runner/src/engineering/native-writer.test.ts'], environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false, testTimeout: 3000, hookTimeout: 3000 }
};
