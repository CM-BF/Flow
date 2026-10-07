import consumers from './vitest.consumers.config.mjs';
export default { ...consumers, test: { ...consumers.test, include: [
  'apps/runner/src/native-harness/codex/adapter.test.ts',
  'apps/runner/src/native-harness/codex/continuity.test.ts',
] } };
