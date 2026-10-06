import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [kind, label, selection] = process.argv.slice(2);
assert(['prefix', 'consumer', 'types'].includes(kind));
assert(/^[a-z][a-z0-9-]+$/.test(label ?? ''));
assert(process.versions.node.startsWith('24.'));
const repository = dirname(resolve(execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8' }).trim()));
const directory = 'docs/evidence/chat06p02';
const testFiles = kind === 'consumer'
  ? ['apps/server/src/assistant-stream/stream.test.ts', 'apps/server/src/assistant-stream-compatibility/compatibility.test.ts']
  : ['apps/server/src/assistant-stream/prefix-hash.test.ts'];
const args = kind === 'types'
  ? [resolve(repository, 'node_modules/typescript/bin/tsc'), '-p', `${directory}/types.tsconfig.json`, '--noEmit']
  : [resolve(repository, 'node_modules/vitest/vitest.mjs'), 'run', ...testFiles, '--config', `${directory}/vitest.config.mjs`, '--configLoader', 'runner', ...(selection ? ['-t', selection] : [])];
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n'))]
  .filter(path => path === 'apps/server/src/assistant-stream/store.ts' || testFiles.includes(path) || path.startsWith(`${directory}/`) && /\.(?:mjs|tsconfig\.json)$/.test(path));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const sourceFiles = files.sort().map(path => ({ path, sha256: sha(path) }));
const logPath = `${directory}/${label}.log`;
const log = openSync(logPath, 'wx');
const startedAt = new Date().toISOString(), started = performance.now();
let result;
try { result = spawnSync(process.execPath, args, { stdio: ['ignore', log, log], timeout: 120000 }); }
finally { closeSync(log); }
const record = { kind, selection: selection ?? null, command: [process.execPath, ...args], startedAt, completedAt: new Date().toISOString(), elapsedMs: performance.now() - started,
  exitCode: result.status, signal: result.signal, error: result.error?.message ?? null, sourceFiles, log: logPath, logSha256: sha(logPath),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
writeFileSync(`${directory}/${label}-result.json`, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ kind, label, exitCode: result.status, signal: result.signal }) + '\n');
process.exitCode = result.status ?? 1;
