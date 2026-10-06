import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const source = await realpath(path.dirname(fileURLToPath(import.meta.url)));
const dependencyRoot = await realpath('/tmp/flow-harness-eval.iq7BzZ/node_modules');
const pi = path.join(dependencyRoot, '@ai-sdk/harness-pi/node_modules/@earendil-works/pi-coding-agent');
const plugin = await realpath('/tmp/flow-ctx02-upstream-0.1.83/package');
const node = await realpath('/opt/homebrew/opt/node@24/bin/node');
const output = process.argv[2];
assert(output, 'Pass a new output JSON path; existing evidence is never overwritten');
const work = await realpath(await mkdtemp(path.join(tmpdir(), 'flow-ctx02-')));
const sentinel = `${work}-denied.txt`;
const hash = value => createHash('sha256').update(value).digest('hex');
const literal = value => JSON.stringify(value);
const startedAt = new Date().toISOString();
try {
  await writeFile(sentinel, 'SYNTHETIC_CTX02_OUTSIDE_ALLOWLIST', { flag: 'wx', mode: 0o600 });
  const readPaths = [dependencyRoot, plugin, work];
  // OS enforces network/fork/write restrictions. Node's built-in Permission
  // Model enforces the read allowlist; no addons, WASI or child/worker escape
  // flags are granted. Neither mechanism is a JS monkeypatch.
  const policy = `(version 1)\n(allow default)\n(deny network*)\n(deny process-fork)\n(deny file-write*)\n(allow file-write* (subpath ${literal(work)}) (literal "/dev/null"))\n`;
  const policyPath = path.join(work, 'sandbox.sb');
  await writeFile(policyPath, policy);
  const worker = path.join(work, 'worker.mjs');
  await writeFile(worker, await readFile(path.join(source, 'worker.mjs')));
  const args = ['-f', policyPath, node, '--permission', ...readPaths.map(p => `--allow-fs-read=${p}`), `--allow-fs-write=${work}`, worker, work, pi, plugin, sentinel];
  const result = spawnSync('/usr/bin/sandbox-exec', args, {
    cwd: work,
    env: { PATH: path.dirname(node), LANG: 'en_US.UTF-8', TZ: 'UTC', ACP_AUTO_UPDATE: '0', ACP_LOG_FILE: path.join(work, 'acp.log'), PI_CODING_AGENT_DIR: path.join(work, 'agent') },
    timeout: 20_000,
    maxBuffer: 1024 * 1024,
    encoding: 'utf8',
  });
  let child;
  try { child = JSON.parse(result.stdout.trim().split('\n').findLast(line => line.startsWith('{"probe":'))); } catch { /* raw output remains evidence */ }
  const record = { startedAt, completedAt: new Date().toISOString(), node, pi, plugin, policy, nodePermissions: args.slice(3, args.indexOf(worker)), status: result.status, signal: result.signal, spawnError: result.error?.message, child, stdout: result.stdout, stderr: result.stderr, sourceHashes: {} };
  for (const name of ['run.mjs', 'worker.mjs']) record.sourceHashes[name] = hash(await readFile(path.join(source, name)));
  await writeFile(output, JSON.stringify(record, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  process.stdout.write(JSON.stringify({ output, status: result.status, outcome: child?.outcome, childMs: child?.elapsedMs }) + '\n');
} finally {
  await rm(work, { recursive: true, force: true });
  await rm(sentinel, { force: true });
}
