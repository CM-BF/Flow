import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["apps/web/test/workspace-layout.test.ts", "apps/web/test/plugin-host.test.ts", "apps/web/test/plugin-integration.test.ts"], testNamePattern: "Arc", fileParallelism: false, maxWorkers: 1, pool: "threads", testTimeout: 3000, hookTimeout: 3000 } });
