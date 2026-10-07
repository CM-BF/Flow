import local from './vitest.config.mjs';

export default {
  ...local,
  test: {
    ...local.test,
    include: ['docs/evidence/svc07/pg-transaction.test.ts'],
    testTimeout: 5_000,
    hookTimeout: 5_000,
  },
};
