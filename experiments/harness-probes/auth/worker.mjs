import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createRuntime, FIXED_NOW } from './runtime.mjs';

const [scenario, root] = process.argv.slice(2);
const keepAlive = setInterval(() => {}, 1000);
const token = (kind, index) => `synthetic-${kind}-${String(index).padStart(2, '0')}`;
const credential = (expiresAt = FIXED_NOW - 1, index = 0) => ({ marker: 'non-secret synthetic fixture', claudeAiOauth: {
  accessToken: token('access', index), refreshToken: token('refresh', index), expiresAt,
} });
const response = (index, status = 200) => new Response(JSON.stringify(status === 200
  ? { access_token: token('access', index), refresh_token: token('refresh', index), expires_in: 3600 }
  : { error: 'synthetic_already_rotated' }), { status });
const emit = value => process.stdout.write(`${JSON.stringify(value)}\n`);
function barrier(expected) {
  let count = 0, release;
  const ready = new Promise(resolve => { release = resolve; });
  return async () => { count += 1; if (count === expected) release(); await ready; };
}
async function seed(directory, contents = credential()) {
  const filename = path.join(directory, '.claude', '.credentials.json');
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, typeof contents === 'string' ? contents : JSON.stringify(contents), { mode: 0o600 });
  return filename;
}
function checked(trace) {
  assert.deepEqual(trace.forbiddenCalls, []);
  return trace;
}
async function priority() {
  const cases = [];
  for (const kind of ['fresh-file', 'expired-file', 'file-refresh-denied', 'invalid-file', 'keychain-refresh', 'custom-missing']) {
    const directory = path.join(root, kind);
    await mkdir(directory);
    await seed(directory, ['invalid-file', 'keychain-refresh'].includes(kind) ? '{invalid' : credential(kind === 'fresh-file' ? FIXED_NOW + 600_000 : FIXED_NOW - 1));
    const keychain = { text: JSON.stringify(credential(kind === 'keychain-refresh' ? FIXED_NOW - 1 : FIXED_NOW + 600_000, 99)) };
    let refreshes = 0;
    const runtime = await createRuntime({ root: directory, keychain, fetchImplementation: async () => { refreshes += 1; return response(1, kind === 'file-refresh-denied' ? 400 : 200); } });
    let result, failure;
    try { result = await runtime.read(kind === 'custom-missing' ? { env: { CLAUDE_CONFIG_DIR: path.join(directory, 'custom') } } : {}); }
    catch (error) { failure = error.message; }
    const saved = JSON.parse(await readFile(path.join(directory, '.claude/.credentials.json'), 'utf8').catch(() => 'null').then(text => text.startsWith('{invalid') ? 'null' : text));
    cases.push({ kind, selected: result?.CLAUDE_CODE_OAUTH_TOKEN ?? null, failure: failure ?? null, refreshes,
      keychainReads: runtime.trace.keychainReads, keychainWrites: runtime.trace.keychainWrites,
      fileAccessToken: saved?.claudeAiOauth?.accessToken ?? null,
      keychainAccessToken: JSON.parse(keychain.text).claudeAiOauth.accessToken, forbiddenCalls: checked(runtime.trace).forbiddenCalls });
  }
  assert.deepEqual(cases.map(item => [item.selected, item.refreshes, item.keychainReads]), [
    [token('access', 0), 0, 0], [token('access', 1), 1, 0], [null, 1, 0], [token('access', 99), 0, 1], [token('access', 1), 1, 1], [null, 0, 0],
  ]);
  assert.match(cases[2].failure, /status 400/);
  assert.equal(cases[4].keychainWrites, 1); assert.equal(cases[4].keychainAccessToken, token('access', 1));
  assert.equal(cases[4].fileAccessToken, null);
  const runtime = await createRuntime({ root, fetchImplementation: async () => { throw new Error('No refresh expected'); } });
  let readerCalls = 0;
  const result = await runtime.resolve({ processEnv: { ANTHROPIC_API_KEY: 'synthetic-explicit-env' }, readSubscription: async () => { readerCalls += 1; throw new Error('Must not read store'); } });
  assert.equal(result.ANTHROPIC_API_KEY, 'synthetic-explicit-env'); assert.equal(readerCalls, 0);
  return { cases, explicitEnvironmentSkipsSubscription: true, forbiddenCalls: checked(runtime.trace).forbiddenCalls };
}
async function threshold() {
  const runtime = await createRuntime({ root, fetchImplementation: async () => { throw new Error('No fetch expected'); } });
  const cases = [300_001, 300_000, 299_999, -1].map(offset => ({ offsetMs: offset, expiring: runtime.oauth.isAccessTokenExpiringSoon({ expiresAt: FIXED_NOW + offset }) }));
  assert.deepEqual(cases.map(item => item.expiring), [false, true, true, true]);
  return { fixedNow: FIXED_NOW, cases, forbiddenCalls: checked(runtime.trace).forbiddenCalls };
}
async function concurrent(mode, count) {
  const filename = await seed(root);
  const fetched = barrier(count), wrote = barrier(count), changedMode = barrier(count);
  const requests = [];
  const runtime = await createRuntime({ root,
    fetchImplementation: async (url, init) => {
      const index = requests.length + 1;
      const body = JSON.parse(init.body);
      assert.equal(url, 'https://platform.claude.com/v1/oauth/token');
      requests.push({ index, refreshToken: body.refresh_token, method: init.method, hasSignal: Boolean(init.signal) });
      await fetched();
      return response(index, mode === 'rotate-once' && index !== 1 ? 400 : 200);
    },
    hooks: mode === 'shared-temp' ? { after: async operation => {
      if (operation === 'writeFile') await wrote();
      if (operation === 'chmod') await changedMode();
    } } : {},
  });
  const settled = await Promise.allSettled(Array.from({ length: count }, () => runtime.read()));
  const results = settled.map((result, index) => result.status === 'fulfilled'
    ? { caller: index + 1, status: result.status, returnedToken: result.value.CLAUDE_CODE_OAUTH_TOKEN }
    : { caller: index + 1, status: result.status, code: result.reason.code ?? null, message: result.reason.message });
  let saved;
  try { const value = JSON.parse(await readFile(filename, 'utf8')); saved = { accessToken: value.claudeAiOauth.accessToken, refreshToken: value.claudeAiOauth.refreshToken }; }
  catch (error) { saved = { parseError: error.name }; }
  assert.equal(requests.length, count);
  assert.ok(requests.every(item => item.refreshToken === token('refresh', 0)));
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 1);
  if (mode === 'rotate-once') assert.equal(saved.refreshToken, token('refresh', 1));
  if (mode === 'shared-temp') assert.equal(new Set(runtime.trace.files.filter(item => item.operation === 'writeFile').map(item => item.path)).size, 1);
  return { mode, callers: count, samePid: process.pid, requests, results, saved,
    fileMode: ((await stat(filename)).mode & 0o777).toString(8), remainingFiles: await readdir(path.dirname(filename)), trace: checked(runtime.trace) };
}
async function hanging(mode) {
  await seed(root);
  const controller = new AbortController();
  let called = false, receivedSignal = false, settled = false;
  const runtime = await createRuntime({ root, fetchImplementation: async (_url, init) => {
    called = true; receivedSignal = Boolean(init.signal);
    const signal = mode === 'injected-timeout' ? AbortSignal.timeout(60) : mode === 'injected-cancel' ? controller.signal : null;
    return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  const began = performance.now();
  const pending = runtime.resolve().then(() => { settled = true; return 'fulfilled'; }, error => { settled = true; return error.name; });
  setTimeout(() => controller.abort(), 30);
  if (mode !== 'unbounded-refresh') return { mode, outcome: await pending, elapsedMs: performance.now() - began,
    called, upstreamFetchReceivedSignal: receivedSignal, trace: checked(runtime.trace) };
  await new Promise(resolve => setTimeout(resolve, 150));
  emit({ scenario, observation: { mode, called, upstreamFetchReceivedSignal: receivedSignal,
    callerAborted: controller.signal.aborted, helperSettledAfter150ms: settled, trace: checked(runtime.trace) } });
  await new Promise(() => {}); // Parent watchdog terminates this isolated process.
}

try {
  let observation;
  if (scenario === 'priority') observation = await priority();
  else if (scenario === 'threshold') observation = await threshold();
  else if (/^(rotate-once|shared-temp)-(2|16)$/.test(scenario)) {
    const [, mode, count] = scenario.match(/^(rotate-once|shared-temp)-(2|16)$/);
    observation = await concurrent(mode, Number(count));
  } else if (['unbounded-refresh', 'injected-timeout', 'injected-cancel'].includes(scenario)) observation = await hanging(scenario);
  else throw new Error('Unknown scenario');
  emit({ scenario, observation });
} catch (error) {
  emit({ scenario, failure: { name: error.name, message: error.message, stack: error.stack } }); process.exitCode = 1;
} finally { clearInterval(keepAlive); }
