export default {
  cacheDir: process.env.FLOW_STARTUP_PROGRESS_SCRATCH + '/vite-cache',
  test: {
    include: ['apps/server/src/startup-progress.test.ts', 'apps/server/src/startup-progress-consumer.test.ts'],
    environment: 'node', pool: 'threads', maxWorkers: 1, fileParallelism: false,
    testTimeout: 3000, hookTimeout: 3000, cache: false,
  },
};
