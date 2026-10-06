import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { openSync, closeSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [kind, label] = process.argv.slice(2);
assert(['unit', 'observer', 'types', 'imports', 'syntax'].includes(kind), 'Only pure unit or noEmit checks are allowed.');
assert(/^[a-z][a-z0-9-]+$/.test(label ?? ''), 'A new evidence label is required.');
assert(process.versions.node.startsWith('24.'), 'Use the fixed Node24 runtime.');
const root = dirname(resolve(execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()));
const directory = 'experiments/assistant-stream-cost';
const args = kind === 'imports' ? ['--import', resolve(root, 'node_modules/tsx/dist/loader.mjs'), `${directory}/imports.ts`]
  : kind === 'syntax' ? ['--check', `${directory}/run.mjs`]
  : kind !== 'types'
  ? [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', `${directory}/${kind === 'observer' ? 'observer' : 'workload'}.test.ts`, '--config', `${directory}/vitest.config.mjs`, '--configLoader', 'runner']
  : [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', `${directory}/types.tsconfig.json`, '--noEmit'];
const sourceFiles = readdirSync(directory).filter(name => /\.(ts|mjs|json)$/.test(name)).sort().map(name => {
  const path = `${directory}/${name}`;
  return { path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') };
});
const path = `docs/evidence/chat06p01/${label}.log`;
const log = openSync(path, 'wx'); // A reused label must fail before spawning the check.
const startedAt = new Date().toISOString();
const started = performance.now();
let run;
try { run = spawnSync(process.execPath, args, { stdio: ['ignore', log, log], timeout: 30000, env: { ...process.env, TSX_TSCONFIG_PATH: resolve(directory, 'runtime.tsconfig.json') } }); }
finally { closeSync(log); }
const record = { kind, command: [process.execPath, ...args], startedAt, completedAt: new Date().toISOString(), elapsedMs: performance.now() - started,
  exitCode: run.status, signal: run.signal, error: run.error?.message ?? null, sourceFiles, log: path,
  logSha256: createHash('sha256').update(readFileSync(path)).digest('hex'), scope: 'pure checks only; no PG/server/task/model workload' };
writeFileSync(`docs/evidence/chat06p01/${label}-result.json`, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ kind, label, exitCode: run.status, signal: run.signal }) + '\n');
process.exitCode = run.status ?? 1;
