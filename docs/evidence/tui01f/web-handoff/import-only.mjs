import assert from 'node:assert/strict';
import net from 'node:net';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only inspection precedes this process: every entry exports a factory/function;
// the center's Pool/migrations/timers start only inside createServer, and no factory is invoked here.
const attempted = [];
for (const [object, key] of [[net.Socket.prototype, 'connect'], [net.Server.prototype, 'listen']]) {
  object[key] = () => { attempted.push(key); throw Error('Import attempted forbidden resource: ' + key); };
}
globalThis.fetch = () => { attempted.push('fetch'); throw Error('Import attempted forbidden resource: fetch'); };
for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  const original = childProcess[key];
  childProcess[key] = function (...args) {
    // tsx's existing compiler binary is a loader dependency, not an application/service launch.
    if (typeof args[0] === 'string' && /\/esbuild\/bin\/esbuild$/.test(args[0]) && Array.isArray(args[1]) && args[1].every(value => /^--(?:service=|ping$)/.test(value))) {
      return original.apply(this, args);
    }
    attempted.push(key); throw Error('Import attempted forbidden resource: ' + key);
  };
}
syncBuiltinESMExports();
const wt = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/';
const entries = [
  [wt + 'personal-history-compatibility/apps/server/src/index.ts', 'createServer'],
  [resolve('apps/runner/src/runtime.ts'), 'runRunner'],
  [resolve('apps/tui/src/task-controls/fixture.ts'), 'CancelJourney'],
  [wt + 'continuous-native-goal-acceptance/experiments/continuous-goal-acceptance/operator-watchdog.mjs', 'startTotalDeadline'],
  [wt + 'personal-retained-web-compatibility/experiments/personal-current-release/fixture.mjs', 'diskBytes'],
  [wt + 'personal-history-compatibility/tools/personal-preview/web-artifact.mjs', 'verifyWebArtifact'],
  [wt + 'personal-history-compatibility/tools/personal-preview/web-release.mjs', 'releaseAsset'],
];
const loaded = [];
for (const [path, name] of entries) { const module = await import(pathToFileURL(path).href); assert.equal(typeof module[name], 'function'); loaded.push({ path, export: name }); }
const playwright = await import('@playwright/test'); assert.equal(typeof playwright.chromium.connectOverCDP, 'function');
assert.deepEqual(attempted, []);
process.stdout.write(JSON.stringify({ loaded, playwright: 'module-only; no launch/connect', attemptedResourceOperations: attempted,
  factoryInvocations: 0, PG: 0, Chrome: 0, PTY: 0, provider: 0 }) + '\n');
