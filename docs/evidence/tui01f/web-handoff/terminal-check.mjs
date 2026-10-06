import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, lstat, readFile, writeFile, rm, statfs } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { supervise } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/continuous-native-goal-acceptance/experiments/continuous-goal-acceptance/operator.mjs';
import { startTotalDeadline } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/continuous-native-goal-acceptance/experiments/continuous-goal-acceptance/operator-watchdog.mjs';
import { writeRecord } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/continuous-native-goal-acceptance/experiments/continuous-goal-acceptance/records.mjs';
import { diskBytes } from '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-retained-web-compatibility/experiments/personal-current-release/fixture.mjs';
const HERE = dirname(fileURLToPath(import.meta.url)), ROOT = resolve(HERE, '../../../..');
const mode = process.argv[2]; assert(process.argv.length === 3 && ['startup', 'local', 'types'].includes(mode));
const start = performance.now(), free = await statfs(ROOT); assert(free.bavail * free.bsize >= 1024 ** 3 + 4 * 1024 ** 2);
const directory = join(HERE, 'terminal-' + mode); await mkdir(directory, { mode: 0o700 });
const sources = await Promise.all(['experiments/tui-web-control-handoff/journey.ts', 'experiments/tui-web-control-handoff/terminal.py',
  'docs/evidence/tui01f/web-handoff/terminal-observation.test.mjs', 'docs/evidence/tui01f/web-handoff/terminal-check.mjs'].map(async path => {
    const data = await readFile(join(ROOT, path)); return { path, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  }));
const digest = createHash('sha256').update(JSON.stringify(sources)).digest('hex');
const bounds = mode === 'startup' ? { workMs: 15000, cleanupMs: 5000 } : { workMs: 7000, cleanupMs: 2000 };
await writeRecord(join(directory, 'reservation.json'), { at: new Date().toISOString(), mode, digest, sources, bounds,
  freeBefore: free.bavail * free.bsize, outcome: 'unknown-retain', rawLimit: 512 * 1024, privateLimit: 1024 ** 2, PG: 0, Chrome: 0, provider: 0 }, { exclusive: true });
const watchdog = await startTotalDeadline({ directory, run: 'terminal-' + randomUUID(), sourceDigest: digest,
  totalMs: mode === 'startup' ? 20000 : 10000, finalCheckpointMs: 250 });
const privatePath = join(directory, 'private'); await mkdir(privatePath, { mode: 0o700 });
const info = await lstat(privatePath), identity = { dev: info.dev, ino: info.ino };
const token = 'synthetic-startup-' + randomUUID();
const env = { PATH: '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', TERM: 'xterm-256color', LANG: 'en_US.UTF-8',
  FLOW_URL: 'http://127.0.0.1:9', FLOW_TOKEN: token, FLOW_TUI_STATE_DIR: join(privatePath, 'journal'), TSX_DISABLE_CACHE: '1', TUI_TEST_NODE: process.execPath };
// initialize is local-journal-only. Startup sends no /open, /send, or other center operation.
const command = mode === 'startup' ? ['/usr/bin/python3', 'experiments/tui-web-control-handoff/terminal.py', '--startup-only']
  : mode === 'local' ? [process.execPath, '--import', 'tsx', '--test', 'docs/evidence/tui01f/web-handoff/terminal-observation.test.mjs']
  : [process.execPath, 'node_modules/typescript/bin/tsc', '-p', 'docs/evidence/tui01f/web-handoff/tsconfig.json', '--pretty', 'false'];
const child = spawn(command[0], command.slice(1), { cwd: ROOT, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
const chunks = [[], []]; let bytes = 0, retained = 0, overflow = false, closed = false;
child.once('close', () => { closed = true; }); child.once('error', () => { overflow = true; });
for (const [index, stream] of [child.stdout, child.stderr].entries()) stream.on('data', chunk => {
  bytes += chunk.length; const piece = chunk.subarray(0, Math.max(0, 512 * 1024 - retained));
  chunks[index].push(Buffer.from(piece)); retained += piece.length; if (bytes > 512 * 1024) overflow = true;
});
assert(child.pid); await watchdog.register([child.pid]);
await writeRecord(join(directory, 'child.json'), { pid: child.pid, pgid: child.pid, command, privatePath, identity }, { exclusive: true });
const measure = async () => {
  const space = await statfs(ROOT), own = await diskBytes(privatePath);
  assert(space.bavail * space.bsize >= 1024 ** 3 && own.bytes <= 1024 ** 2);
  return { groups: [], metrics: { free: space.bavail * space.bsize, privateBytes: own.bytes, observedOutputBytes: bytes } };
};
const supervision = await supervise({ child, bounds, sample: measure, outputFailure: () => overflow,
  markStop: reason => writeRecord(join(directory, 'STOP.json'), { reason, outcome: 'unknown-retain' }, { exclusive: true }),
  persist: value => writeRecord(join(directory, 'supervision.json'), value, { exclusive: true }) });
const output = chunks.map(parts => Buffer.concat(parts).toString('utf8').split(token).join('[redacted]'));
for (const [index, name] of ['stdout.txt', 'stderr.txt'].entries()) await writeFile(join(directory, name), output[index], { flag: 'wx', mode: 0o600 });
const passed = supervision.outcome === 'processes-complete' && closed && !overflow;
const metrics = (await measure()).metrics;
const report = { mode, digest, command, selected: mode === 'local' ? 2 : mode === 'startup' ? 1 : null,
  outcome: passed ? 'passed' : 'failed-unknown', supervision, pipesClosed: closed, observedBytes: bytes, retainedBytes: retained,
  primaryFailure: supervision.reason, privatePath, identity, metrics, PG: 0, Chrome: 0, provider: 0, elapsedMs: Math.ceil(performance.now() - start) };
await writeRecord(join(directory, 'checkpoint.json'), report, { exclusive: true });
let privateRemoved = false;
if (passed) {
  const current = await lstat(privatePath); assert(current.isDirectory() && !current.isSymbolicLink() && current.dev === identity.dev && current.ino === identity.ino);
  await rm(privatePath, { recursive: true, force: false }); await assert.rejects(lstat(privatePath), { code: 'ENOENT' }); privateRemoved = true;
}
await writeRecord(join(directory, 'result.json'), { ...report, privateRemoved }, { exclusive: true });
await watchdog.complete();
process.stdout.write(JSON.stringify({ mode, outcome: report.outcome, directory, privateRemoved, elapsedMs: report.elapsedMs }) + '\n');
if (!passed) process.exitCode = 1;
