import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

// Reuse the installed main dependency runtime; all experiment sources stay in this worktree.
const repository = dirname(resolve(execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()));
const requireDependency = createRequire(resolve(repository, 'package.json'));
export default {
  resolve: { alias: [{ find: /^vitest$/, replacement: resolve(dirname(requireDependency.resolve('vitest/package.json')), 'dist/index.js') }] },
  test: { include: ['experiments/assistant-stream-cost/workload.test.ts'], fileParallelism: false, testTimeout: 5000 },
};
