export default {
  cacheDir: process.env.FLOW_S01P07_CACHE,
  test: { include: ['packages/contracts/src/runner-claim.test.ts', 'packages/client/src/runner-claim.test.ts',
    'apps/runner/src/admission-journal.test.ts', 'apps/runner/src/runtime-claim-recovery.test.ts',
    'apps/runner/src/runtime-shutdown.test.ts', 'apps/runner/src/runtime-capacity.test.ts', 'apps/runner/src/runner.test.ts'],
    fileParallelism: false, maxWorkers: 1, testTimeout: 8000, hookTimeout: 8000 },
};
