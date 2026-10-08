import { defineConfig } from "vitest/config";
export default defineConfig({ cacheDir: process.env.TMPDIR, test: { include: ["apps/web/test/execution-profiles.test.ts", "apps/web/test/conversation-recovery.test.ts"], pool: "threads", maxWorkers: 1, fileParallelism: false, testTimeout: 3000, hookTimeout: 3000 } });
