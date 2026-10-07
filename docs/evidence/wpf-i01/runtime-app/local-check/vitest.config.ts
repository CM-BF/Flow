import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["apps/web/test/plugin-integration.test.ts"], testNamePattern: "App session center runtime authority", fileParallelism: false, maxWorkers: 1, pool: "threads", testTimeout: 3000, hookTimeout: 3000 } });
