import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const { createContext, SourceTextModule, SyntheticModule } = vm;

const directory = fileURLToPath(new URL('.', import.meta.url));
const provenance = JSON.parse(await readFile(new URL('./provenance.json', import.meta.url), 'utf8'));
for (const file of provenance.files) {
  const data = await readFile(path.join(directory, 'upstream', file.copy));
  if (createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error(`Upstream hash mismatch: ${file.copy}`);
}

async function upstream() {
  const context = createContext({ Buffer, TextDecoder, setTimeout, clearTimeout, Date });
  const decoder = new SourceTextModule(stripTypeScriptTypes(await readFile(path.join(directory, 'upstream/jsonl-frame-decoder.ts'), 'utf8'), { mode: 'transform' }), { context });
  await decoder.link(() => { throw new Error('Unexpected decoder import'); }); await decoder.evaluate();
  const rpc = new SourceTextModule(stripTypeScriptTypes(await readFile(path.join(directory, 'upstream/jsonl-rpc-process.ts'), 'utf8'), { mode: 'transform' }), { context });
  const synthetic = (name, value) => new SyntheticModule([name], function () { this.setExport(name, value); }, { context });
  await rpc.link(specifier => {
    if (specifier === 'node:child_process') return new SyntheticModule([], function () {}, { context });
    if (specifier === './jsonl-frame-decoder.js') return decoder;
    if (specifier === '../../../utils/spawn.js') return synthetic('spawnProcess', () => { throw new Error('Default upstream spawning is forbidden in this probe'); });
    if (specifier === '../../../utils/tree-kill.js') return synthetic('terminateWithTreeKill', async child => {
      if (child.exitCode !== null || child.signalCode !== null) return 'exited';
      const closed = new Promise(resolve => child.once('close', resolve));
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 300);
      try { await closed; return 'exited'; } finally { clearTimeout(timer); }
    });
    throw new Error(`Unexpected RPC import: ${specifier}`);
  });
  await rpc.evaluate();
  return { JsonlFrameDecoder: decoder.namespace.JsonlFrameDecoder, JsonlRpcProcess: rpc.namespace.JsonlRpcProcess };
}
async function runProbe(root) {
  const { JsonlFrameDecoder, JsonlRpcProcess } = await upstream();
  const frames = [], problems = [];
  const decoder = new JsonlFrameDecoder({ frame: message => frames.push(message), problem: issue => problems.push(issue) });
  const payloadLength = 2 * 1024 * 1024;
  decoder.write('{"type":"event","text":"');
  for (let index = 0; index < 32; index += 1) decoder.write('x'.repeat(payloadLength / 32));
  const beforeNewline = { frames: frames.length, problems: [...problems] };
  decoder.write('"}\n');
  const longLine = { submittedPayloadCharacters: payloadLength, beforeNewline, afterNewline: { frames: frames.length, problems, recoveredCharacters: frames[0]?.text?.length ?? null } };
  let child;
  const warnings = [], chunkLengths = [];
  const rpc = new JsonlRpcProcess({ launch: { command: process.execPath, args: [], cwd: root }, diagnosticName: 'Synthetic RPC',
    defaultRequestTimeoutMs: 800, logger: { warn: (...args) => warnings.push(args) },
    spawn: () => {
      child = spawn(process.execPath, [path.join(directory, 'subprocess-fixture.mjs')], { cwd: root, env: { PATH: path.dirname(process.execPath), LANG: 'C.UTF-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
      child.stdout.on('data', chunk => chunkLengths.push(chunk.length));
      return child;
    },
  });
  let exited;
  const closed = new Promise(resolve => child.once('close', resolve));
  rpc.onExit(value => { exited = value; });
  try {
    const unicode = await rpc.request({ type: 'unicode' });
    const started = performance.now();
    const pending = [rpc.request({ type: 'hold' }, null), rpc.request({ type: 'exit' }, null)];
    const outcomes = await Promise.allSettled(pending);
    await closed;
    assert.equal(outcomes.filter(value => value.status === 'rejected').length, 2);
    const error = outcomes[0].reason.message;
    const stderr = error.slice(error.indexOf('\n') + 1);
    const pendingExit = { count: 2, rejected: 2, elapsedMs: performance.now() - started, exitCode: exited.code,
      exitSignal: exited.signal, processClosed: child.exitCode === 7,
      capturedStderrCharacters: stderr.length, capturedStderrBytes: Buffer.byteLength(stderr),
      oldPrefixRetained: stderr.includes('discarded-prefix:'), syntheticSecretRetained: stderr.includes('SYNTHETIC_SECRET_MARKER') };
    await rpc.requestStopWork({ type: 'abort' });
    return { unicode: { expected: '中文🙂', received: unicode.text, matches: unicode.text === '中文🙂', stdoutChunkBytes: chunkLengths },
      longLine, pendingExit, stopAfterExitResolved: true, warningCount: warnings.length };
  } finally {
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGKILL'); await closed; }
    await rpc.close();
  }
}

if (process.argv[2] === '--child') {
  try { console.log(JSON.stringify({ observation: await runProbe(process.argv[3]) })); }
  catch (error) { console.log(JSON.stringify({ failure: { message: error.message, stack: error.stack } })); process.exitCode = 1; }
} else {
  const filename = process.argv[2];
  if (!filename) throw new Error('Pass a new output JSON path.');
  const root = await mkdtemp(path.join(tmpdir(), 'flow-e01-paseo-'));
  const startedAt = new Date().toISOString();
  try {
    const outcome = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--experimental-vm-modules', '--no-warnings', fileURLToPath(import.meta.url), '--child', root], {
        env: { PATH: path.dirname(process.execPath), LANG: 'C.UTF-8' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
      });
      let stdout = '', stderr = '', timedOut = false;
      const killOwnedGroup = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } };
      const timer = setTimeout(() => { timedOut = true; killOwnedGroup(); }, 3000);
      child.stdout.on('data', data => { stdout += data; if (Buffer.byteLength(stdout) > 65536) killOwnedGroup(); });
      child.stderr.on('data', data => { stderr += data; if (Buffer.byteLength(stderr) > 8192) killOwnedGroup(); });
      child.on('error', reject);
      child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal, timedOut, stdout, stderr }); });
    });
    const result = { startedAt, finishedAt: new Date().toISOString(), node: process.version, upstreamCommit: provenance.commit,
      realModels: 0, cloudCalls: 0, syntheticOnly: true, ...outcome, result: outcome.code === 0 && !outcome.timedOut ? 'passed' : 'failed' };
    result.messages = outcome.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); delete result.stdout;
    await writeFile(filename, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ result: result.result, output: filename }));
    if (result.result !== 'passed') process.exitCode = 1;
  } finally { await rm(root, { recursive: true, force: true }); }
}
