export default {
  cacheDir: process.env.FLOW_TEST_CACHE_DIR,
  test: {
    include: [
      'packages/client/src/browser-session.test.ts', 'packages/client/src/runner-claim.test.ts', 'packages/client/src/native-activity.test.ts',
      'apps/runner/src/runtime-claim-recovery.test.ts', 'apps/runner/src/runtime-shutdown.test.ts',
    ],
    testNamePattern: 'uses one explicit cookie mode|does not retry rejected or unknown session|preserves old Bearer|reads activity metadata|uses the existing bearer transport|treats malformed, mismatched and lost acknowledgements|preserves HTTP authorization/conflict|recovers an allocated but lost ACK|restarts an unresolved v2 opportunity|persists a late assignment|uses the original request deadline',
    maxWorkers: 1, fileParallelism: false, testTimeout: 10000, hookTimeout: 10000,
  },
};
