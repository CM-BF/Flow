import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({ root: fileURLToPath(new URL('./.source', import.meta.url)), test: { include: ['apps/server/src/conversation-queue/queue.test.ts'], maxWorkers: 1, fileParallelism: false, testTimeout: 20000 } });
