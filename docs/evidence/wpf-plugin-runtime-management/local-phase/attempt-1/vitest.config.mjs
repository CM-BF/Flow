export default {
  "root": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-runtime-management",
  "cacheDir": "/private/tmp/plugin-runtime-local-eb1ma5iy/scratch/vite-cache",
  "resolve": {
    "alias": {
      "@flow/client": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-runtime-management/packages/client/src/index.ts",
      "@flow/contracts": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-plugin-runtime-management/packages/contracts/src/index.ts",
      "zod": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/.pnpm/zod@4.6.5/node_modules/zod/index.js",
      "vitest": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-integration/node_modules/.pnpm/vitest@4.0.18_@opentelemetry+api@1.9.1_@types+node@24.19.1_jiti@2.7.0_lightningcss@1.33.0_tsx@4.23.15/node_modules/vitest/dist/index.js"
    }
  },
  "test": {
    "include": [
      "apps/web/test/plugin-runtime-command.test.ts"
    ],
    "watch": false,
    "cache": false,
    "maxWorkers": 1,
    "fileParallelism": false,
    "pool": "threads",
    "environment": "node",
    "css": false
  }
};
