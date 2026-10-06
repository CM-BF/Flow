import { fileURLToPath } from 'node:url';

// Existing declared dependencies only; every Flow alias points into this worktree.
export default {
  root: fileURLToPath(new URL('../../../', import.meta.url)),
  cacheDir: fileURLToPath(new URL('./.vertical-validation-cache/vite', import.meta.url)),
  resolve: { alias: {
    "@flow/contracts": fileURLToPath(new URL("../../../packages/contracts/src/index.ts", import.meta.url)),
    "@flow/client": fileURLToPath(new URL("../../../packages/client/src/index.ts", import.meta.url)),
    "@flow/plugin-runtime": fileURLToPath(new URL("../../../packages/plugin-runtime/src/package-store.ts", import.meta.url)),
    "@anthropic-ai/claude-agent-sdk": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/@anthropic-ai+claude-agent-sdk@0.3.290_@anthropic-ai+sdk@0.131.0_zod@4.6.5__@modelcontextprot_qzqoiskwjgbes3l4fvedsmb7w4/node_modules/@anthropic-ai/claude-agent-sdk/sdk.mjs",
    "@fastify/cors": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/@fastify+cors@11.3.0/node_modules/@fastify/cors/index.js",
    "fastify": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/fastify@5.12.5/node_modules/fastify/fastify.js",
    "npm-package-arg": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/npm-package-arg@13.0.2/node_modules/npm-package-arg/lib/npa.js",
    "pacote": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/pacote@21.5.1/node_modules/pacote/lib/index.js",
    "pg": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/pg@8.23.1/node_modules/pg/esm/index.mjs",
    "pg-boss": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/pg-boss@12.37.0_@opentelemetry+api@1.9.1/node_modules/pg-boss/dist/index.js",
    "ssri": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/ssri@13.0.1/node_modules/ssri/lib/index.js",
    "tar": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/tar@7.5.22/node_modules/tar/dist/esm/index.min.js",
    "vitest": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/vitest@4.0.18_@opentelemetry+api@1.9.1_@types+node@24.19.1_jiti@2.7.0_lightningcss@1.33.0_tsx@4.23.15/node_modules/vitest/dist/index.js",
    "zod": "/Users/citrine/Projects/AgentHarness/Flow/node_modules/.pnpm/zod@4.6.5/node_modules/zod/index.js"
  } },
  test: { include: ['packages/contracts/src/claude-message-settings.test.ts', 'packages/contracts/src/assistant.test.ts', 'packages/contracts/src/execution-profiles.test.ts', 'apps/runner/src/claude-message-settings.test.ts'], fileParallelism: false, maxWorkers: 1 },
};
