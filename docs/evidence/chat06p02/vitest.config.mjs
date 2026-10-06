export default {
  "resolve": {
    "alias": [
      {
        "find": "@flow/contracts",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/assistant-stream-prefix-hash/packages/contracts/src/index.ts"
      },
      {
        "find": "@flow/client",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/assistant-stream-prefix-hash/packages/client/src/index.ts"
      },
      {
        "find": "@flow/protocols",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/assistant-stream-prefix-hash/packages/protocols/src/index.ts"
      },
      {
        "find": "pg",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/pg/esm/index.mjs"
      },
      {
        "find": "pg-boss",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/pg-boss/dist/index.js"
      },
      {
        "find": "fastify",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow/apps/server/node_modules/fastify/fastify.js"
      },
      {
        "find": "@fastify/cors",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow/apps/server/node_modules/@fastify/cors/index.js"
      },
      {
        "find": "zod",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow/packages/contracts/node_modules/zod/index.js"
      },
      {
        "find": "npm-package-arg",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/apps/server/node_modules/npm-package-arg/lib/npa.js"
      },
      {
        "find": "pacote",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/apps/server/node_modules/pacote/lib/index.js"
      },
      {
        "find": "ssri",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow-worktrees/m2-shared-foundation/apps/server/node_modules/ssri/lib/index.js"
      },
      {
        "find": "vitest",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/vitest/dist/index.js"
      },
      {
        "find": "@anthropic-ai/claude-agent-sdk",
        "replacement": "/Users/citrine/Projects/AgentHarness/Flow/apps/runner/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs"
      }
    ]
  },
  "test": {
    "include": [
      "apps/server/src/assistant-stream/prefix-hash.test.ts",
      "apps/server/src/assistant-stream/stream.test.ts",
      "apps/server/src/assistant-stream-compatibility/compatibility.test.ts"
    ],
    "fileParallelism": false,
    "testTimeout": 10000,
    "hookTimeout": 20000
  }
};
