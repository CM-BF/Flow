import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['experiments/bounded-preview/consumer.generated.test.ts'], testTimeout: 30000, hookTimeout: 30000, fileParallelism: false } });
