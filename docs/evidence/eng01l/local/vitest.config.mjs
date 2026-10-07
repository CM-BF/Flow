export default {
 cacheDir: process.env.FLOW_ENG01L_CACHE,
 resolve: { alias: { vitest: '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/vitest/dist/index.js', '@flow/contracts': '/Users/citrine/Projects/AgentHarness/Flow-worktrees/engineering-readonly-tool-host/packages/contracts/src/index.ts', zod: '/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/packages/contracts/node_modules/zod/index.js' } },
 test: { include: ['apps/runner/src/engineering/native-authority-darwin.test.ts','apps/runner/src/engineering/native-authority.test.ts','apps/runner/src/engineering/native-tool-host.test.ts'], environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false, testTimeout: 3000, hookTimeout: 3000 }
};
