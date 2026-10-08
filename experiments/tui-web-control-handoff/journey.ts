import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { lstat, mkdir, readFile, statfs } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import type { Page } from '@playwright/test';
import type { CancelJourney } from '../../apps/tui/src/task-controls/fixture.js';
import { BACKEND, BACKEND_ROOT, ARTIFACT, CONFLICT_DRAFT, WEB_A, WEB_B, HandoffWrites, openPreview, sha } from './preview.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const EVIDENCE = join(ROOT, 'docs/evidence/tui01f/web-handoff');
const O16 = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/continuous-native-goal-acceptance/experiments/continuous-goal-acceptance';
const R01 = '/Users/citrine/Projects/AgentHarness/Flow-worktrees/personal-retained-web-compatibility/experiments/personal-current-release';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BOUNDS = Object.freeze({ workMs: 90_000, totalMs: 150_000, rawBytes: 4 * 1024 ** 2,
  privateBytes: 16 * 1024 ** 2, reserveBytes: 1024 ** 3, startBytes: 1024 ** 3 + 128 * 1024 ** 2 });
const OWN = ['apps/tui/src/task-controls/fixture.ts', 'apps/tui/src/task-controls/fixture-process.ts', 'experiments/tui-web-control-handoff/journey.ts',
  'experiments/tui-web-control-handoff/preview.ts', 'experiments/tui-web-control-handoff/terminal.py'];
const load = (root: string, name: string) => import(pathToFileURL(join(root, name)).href);

/** Preserve the actual bounded reason; remove credentials before truncation, without mapping it to a generic allowlist. */
export function safeFailure(stage: string, error: unknown, secrets: readonly string[] = []) {
  const field = (value: unknown, limit: number) => {
    let text = typeof value === 'string' ? value : '';
    for (const secret of secrets) if (secret) text = text.split(secret).join('[redacted]');
    text = text.replace(/synthetic-tui01f-[0-9a-f-]+/gi, '[redacted]').replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [redacted]')
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
      .replace(/[\x00-\x1f\x7f]/g, ' ');
    let bounded = '';
    for (const character of text) { if (Buffer.byteLength(bounded + character) > limit) break; bounded += character; }
    return bounded;
  };
  const detail = error instanceof Error ? error as NodeJS.ErrnoException : undefined;
  return { stage: field(stage, 96), name: field(detail?.name ?? typeof error, 64),
    code: field(detail?.code, 64) || null, message: field(detail?.message ?? String(error), 512) };
}

async function bounded<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error(label)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
async function until<T>(read: () => Promise<T>, accepts: (value: T) => boolean, signal: AbortSignal, ms = 8000): Promise<T> {
  const deadline = performance.now() + ms;
  do { signal.throwIfAborted(); const value = await bounded(read(), Math.min(1500, ms), 'Observation deadline');
    if (performance.now() < deadline && accepts(value)) return value; await pause(30, undefined, { signal });
  } while (performance.now() < deadline);
  throw Error('Expected public observation unavailable');
}
async function sourceIdentity() {
  const request = JSON.parse(await readFile(join(EVIDENCE, 'input-request.json'), 'utf8'));
  const helpers = JSON.parse(await readFile(join(EVIDENCE, 'helper-inputs.json'), 'utf8'));
  const bindings = [...request.backendBindings, ...helpers.bindings];
  for (const row of bindings) {
    const info = await lstat(row.path); assert.ok(info.isFile() && !info.isSymbolicLink() && info.size === row.bytes);
    assert.equal(sha(await readFile(row.path)), row.sha256, `Fixed input changed: ${row.path}`);
  }
  const files = await Promise.all(OWN.map(async path => ({ path, sha256: sha(await readFile(join(ROOT, path))) })));
  return { digest: sha(JSON.stringify({ files, inputs: bindings.map(row => ({ path: row.path, sha256: row.sha256 })) })), files,
    backend: BACKEND, artifact: ARTIFACT, inputCount: bindings.length };
}

/** One bounded terminal observation: callers own registration; this port drains and reports its already-owned child. */
export function observeTerminal(child: ChildProcessWithoutNullStreams, stopGroup: () => Promise<{ stopped: boolean }>, secrets: readonly string[]) {
  const events: Array<{ phase: string; [key: string]: unknown }> = [];
  const stdout = new StringDecoder('utf8'), stderrDecoder = new StringDecoder('utf8');
  const redact = (text: string) => {
    for (const secret of secrets) if (secret) text = text.split(secret).join('[redacted]');
    return text.replace(/Bearer\s+[^\s"'<>]+/gi, 'Bearer [redacted]')
      .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@');
  };
  let pending = '', stderr = '', bytes = 0, pipesClosed = false;
  let failure: ReturnType<typeof safeFailure> | null = null;
  let exit: { code: number | null; signal: NodeJS.Signals | null } | null = null;
  let rejectFailure!: (error: Error) => void;
  const failed = new Promise<never>((_, reject) => { rejectFailure = reject; }); void failed.catch(() => {});
  const fail = (stage: string, error: unknown) => {
    if (failure) return;
    failure = safeFailure(stage, error, secrets);
    rejectFailure(Object.assign(Error(`${failure.stage}: ${failure.message}`), { name: failure.name, code: failure.code }));
  };
  const closed = new Promise<void>(resolve => child.once('close', (code, signal) => {
    pipesClosed = true; exit = { code, signal }; stderr += stderrDecoder.end();
    if (pending || stdout.end()) fail('terminal-protocol', Error('PTY JSONL ended with an incomplete record'));
    if (code !== 0 || !events.some(event => event.phase === 'finished')) fail('terminal-exit', Error(`PTY exited before successful finish (code ${code}, signal ${signal})`));
    resolve();
  }));
  child.once('error', error => fail('terminal-spawn', error));
  child.stdin.on('error', error => fail('terminal-input', error));
  child.stdout.on('error', error => fail('terminal-output', error));
  child.stderr.on('error', error => fail('terminal-stderr', error));
  child.stdout.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    if (bytes > 512 * 1024) { fail('terminal-output', Error('PTY output bound exceeded')); void stopGroup().catch(error => fail('terminal-stop', error)); return; }
    pending += stdout.write(chunk); let newline;
    while ((newline = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
      try {
        const message = JSON.parse(redact(line));
        assert.ok(events.length < 16 && ['progress', 'submitted', 'conflict-visible', 'cancelled-visible', 'recovered-visible', 'finished', 'failure'].includes(message.phase));
        if (message.phase === 'progress') assert.ok(['terminal-spawned', 'terminal-rendered', 'terminal-raw', 'terminal-opened'].includes(message.stage));
        assert.ok(!events.some(event => event.phase === message.phase && (message.phase !== 'progress' || event.stage === message.stage)));
        events.push(message);
        if (message.phase === 'failure') fail(message.error?.stage ?? 'terminal-driver', Object.assign(Error(message.error?.message ?? 'PTY driver failed'),
          { name: message.error?.name ?? 'Error', code: message.error?.code }));
      } catch (error) { fail('terminal-protocol', error); void stopGroup().catch(error => fail('terminal-stop', error)); }
    }
  });
  child.stderr.on('data', (chunk: Buffer) => {
    bytes += chunk.length;
    const available = Math.max(0, 64 * 1024 - Buffer.byteLength(stderr));
    stderr += stderrDecoder.write(chunk.subarray(0, available));
    fail('terminal-stderr', Error(redact(stderr)));
    if (chunk.length > available || bytes > 512 * 1024) void stopGroup().catch(error => fail('terminal-stop', error));
  });
  const report = () => ({ bytes, events, failure, stderr: redact(stderr), exit, pipesClosed, incompleteLineBytes: Buffer.byteLength(pending) });
  return { child, failed, report,
    send(phase: 'cancel' | 'recover', taskId: string) { assert.equal(failure, null); child.stdin.write(JSON.stringify({ phase, taskId }) + '\n'); },
    wait: (phase: string, signal: AbortSignal) => Promise.race([failed, until(async () => events.find(event => event.phase === phase), value => !!value, signal, 20_000)]),
    async settle() {
      const cleanupFailures: ReturnType<typeof safeFailure>[] = [];
      let settled: { stopped: boolean } = { stopped: false };
      try { settled = await bounded(stopGroup(), 4000, 'PTY group stop unknown'); }
      catch (error) { cleanupFailures.push(safeFailure('terminal-group-stop', error, secrets)); }
      try { await bounded(closed, 3000, 'PTY pipe close unknown'); }
      catch (error) { cleanupFailures.push(safeFailure('terminal-pipe-close', error, secrets)); }
      return { ...report(), settled, cleanupFailures };
    },
    async finish() {
      await Promise.race([failed, bounded(closed, 5000, 'PTY exit unknown')]);
      const settled = await stopGroup(); assert.equal(settled.stopped, true); assert.equal(failure, null); return { ...report(), settled };
    } };
}

/** Register the actual group before waiting for progress. Errors while waiting for held are independently observable. */
async function startTerminal(fixture: CancelJourney, origin: string, watchdog: { register: (groups: number[]) => Promise<void> }) {
  const connection = fixture.handoffConnection();
  const child = spawn('/usr/bin/python3', ['experiments/tui-web-control-handoff/terminal.py'], { cwd: ROOT, detached: true,
    stdio: ['pipe', 'pipe', 'pipe'], env: { PATH: '/opt/homebrew/opt/node@24/bin:/usr/bin:/bin', TERM: 'xterm-256color', LANG: 'en_US.UTF-8',
      FLOW_URL: origin, FLOW_TOKEN: connection.token, FLOW_TUI_STATE_DIR: fixture.handoffRuntimePath('pty-journal'),
      TSX_DISABLE_CACHE: '1', TUI_TEST_NODE: process.execPath, TUI_TEST_CONVERSATION: connection.conversationId } });
  let group: ReturnType<CancelJourney['registerHandoffGroup']> | undefined;
  const terminal = observeTerminal(child, async () => group ? group.stop() : { stopped: child.pid === undefined }, [connection.token]);
  assert.ok(child.pid); group = fixture.registerHandoffGroup(child);
  await watchdog.register([child.pid]); return terminal;
}

async function startBrowser(fixture: CancelJourney, watchdog: { register: (groups: number[]) => Promise<void> }, signal: AbortSignal) {
  const directory = fixture.handoffRuntimePath('chrome'); await mkdir(directory, { mode: 0o700 });
  const environment = Object.fromEntries(['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'LANG', 'LC_ALL', 'TZ']
    .filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]!])) as NodeJS.ProcessEnv;
  const child = spawn(CHROME, ['--remote-debugging-port=0', '--user-data-dir=' + directory, '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-default-apps', 'about:blank'],
    { detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: environment });
  assert.ok(child.pid); const group = fixture.registerHandoffGroup(child); let bytes = 0, failed = false;
  child.on('error', () => { failed = true; });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (chunk: Buffer) => {
    bytes += chunk.length; if (bytes > 65536) { failed = true; void group.stop().catch(() => {}); }
  });
  await watchdog.register([child.pid]);
  const port = await until(async () => {
    assert.equal(failed, false);
    const file = join(directory, 'DevToolsActivePort');
    try { const info = await lstat(file); assert.ok(info.isFile() && !info.isSymbolicLink() && info.size <= 4096);
      const lines = (await readFile(file, 'utf8')).split('\n'), value = Number(lines[0]);
      assert.ok(Number.isSafeInteger(value) && value > 0 && value < 65536 && lines[1]?.startsWith('/devtools/browser/')); return value;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  }, value => value !== null, signal);
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 5000 });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage(); page.setDefaultTimeout(5000); page.setDefaultNavigationTimeout(8000);
  return { browser, page, group, observation: () => ({ pid: child.pid, port, diagnosticBytes: bytes, diagnosticsWithinBound: !failed }) };
}

async function visibleTaskState(page: Page, turn: number, status: string) {
  const { expect } = await import('@playwright/test');
  await page.getByRole('button', { name: 'Conversation settings: runner-default', exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Conversation settings', exact: true });
  await dialog.locator('summary').filter({ hasText: /^Execution history/ }).click();
  await dialog.getByText(`Execution · turn ${turn}`, { exact: true }).click();
  const state = dialog.getByText(new RegExp(`^${status} · verification `)); await expect(state).toBeVisible();
  const text = await dialog.innerText(); assert.ok(Buffer.byteLength(text) <= 32768);
  await page.keyboard.press('Escape'); return { turn, status, visibleText: text };
}

export async function runJourney(permitPath: string) {
  const identity = await sourceIdentity();
  const permitInfo = await lstat(permitPath); assert.ok(permitInfo.isFile() && !permitInfo.isSymbolicLink() && permitInfo.size <= 4096);
  const permit = JSON.parse(await readFile(permitPath, 'utf8'));
  assert.match(permit.windowId ?? '', /^[a-z0-9-]{4,100}$/); assert.equal(permit.sourceDigest, identity.digest);
  assert.ok(Date.now() < Date.parse(permit.startBefore)); assert.equal(permit.providerCalls, 0);
  const space = await statfs(ROOT); assert.ok(space.bavail * space.bsize >= BOUNDS.startBytes);
  const { writeRecord } = await load(O16, 'records.mjs');
  // A durable exclusive window reservation prevents a second invocation from silently making a fresh run.
  const run = `handoff-${randomUUID()}`, directory = join(EVIDENCE, 'runs', run);
  await mkdir(join(EVIDENCE, 'windows'), { recursive: true, mode: 0o700 });
  await writeRecord(join(EVIDENCE, 'windows', permit.windowId + '.json'), { run, identity, permit, outcome: 'unknown-retain', bounds: BOUNDS }, { exclusive: true });
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const { startTotalDeadline } = await load(O16, 'operator-watchdog.mjs');
  const watchdog = await startTotalDeadline({ directory, run, sourceDigest: identity.digest, totalMs: BOUNDS.totalMs });
  await writeRecord(join(directory, 'reservation.json'), { run, identity, permit, bounds: BOUNDS, watchdogPid: watchdog.pid, outcome: 'unknown-retain' }, { exclusive: true });
  const { diskBytes } = await load(R01, 'fixture.mjs');
  const { CancelJourney } = await import('../../apps/tui/src/task-controls/fixture.js');
  const { createServer } = await load(BACKEND_ROOT, 'apps/server/src/index.ts');
  const { assistantSourcePolicy } = await load(BACKEND_ROOT, 'apps/server/src/native-harness-policy.ts');
  const assistantSource = assistantSourcePolicy('claude', 'claude.sdk.result');
  assert.ok(assistantSource?.adapterVersion, 'Fixed center must recognize the handoff assistant source');
  const stop = new AbortController(); let fixture: CancelJourney, preview: Awaited<ReturnType<typeof openPreview>> | undefined;
  let terminal: Awaited<ReturnType<typeof startTerminal>> | undefined, chrome: Awaited<ReturnType<typeof startBrowser>> | undefined;
  let sampling: Promise<unknown> | undefined, workPassed = false, stage = 'fixture-start';
  let workFailure: ReturnType<typeof safeFailure> | null = null;
  const cleanupFailures: Array<ReturnType<typeof safeFailure>> = [], failures: string[] = [], samples: unknown[] = [];
  const secrets: string[] = [];
  const describe = (at: string, error: unknown) => safeFailure(at, error, secrets);
  const sample = async () => {
    const space = await statfs(ROOT), raw = await diskBytes(directory), runtime = fixture?.facts.resources as { directory?: string } | undefined;
    const privateRoot = runtime?.directory;
    let privateBytes = 0, chromeBytes = 0;
    if (privateRoot) {
      const all = await diskBytes(privateRoot); privateBytes = all.bytes;
      try { chromeBytes = (await diskBytes(join(privateRoot, 'chrome'))).bytes; privateBytes -= chromeBytes; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    const measured = { freeBytes: space.bavail * space.bsize, rawBytes: raw.bytes, privateBytes, chromeBytes, at: new Date().toISOString() };
    assert.ok(measured.freeBytes >= BOUNDS.reserveBytes && raw.bytes <= BOUNDS.rawBytes - 128 * 1024 && privateBytes <= BOUNDS.privateBytes);
    if (samples.length < 300) samples.push(measured); return measured;
  };
  fixture = new CancelJourney(join(directory, 'fixture'), { kind: 'web-handoff', adapterVersion: assistantSource.adapterVersion,
    createCenter: createServer, beforeCleanup: sample });
  const reject = (reason: string, error: unknown = Error(reason), at = stage) => {
    workFailure ??= describe(at, error);
    if (!failures.includes(reason)) failures.push(reason); fixture.failed(reason); stop.abort();
  };
  const timer = setTimeout(() => reject('work-deadline'), BOUNDS.workMs);
  const terminate = () => reject('external-stop'); process.once('SIGTERM', terminate); process.once('SIGINT', terminate);
  const monitor = setInterval(() => { if (!sampling) sampling = sample().catch(error => reject('resource-observation-unknown', error, 'resource-observation')).finally(() => { sampling = undefined; }); }, 300);
  const dom: unknown[] = [];
  try {
    await fixture.start(); secrets.push(fixture.handoffConnection().token); stage = 'preview-open'; preview = await openPreview(fixture.handoffConnection(), stop.signal);
    stage = 'browser-start'; chrome = await startBrowser(fixture, watchdog, stop.signal); const page = chrome.page;
    const { expect } = await import('@playwright/test');
    stage = 'web-connect'; await page.goto(preview.webOrigin, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Owner token', { exact: true }).fill(fixture.handoffConnection().token);
    await page.getByRole('button', { name: 'Connect workspace', exact: true }).click();
    const chats = page.getByRole('button', { name: 'Chats', exact: true });
    if (!/\bactive\b/.test(await chats.getAttribute('class') ?? '')) await chats.click();
    await page.getByRole('navigation', { name: 'Conversations', exact: true }).getByRole('button', { name: 'TUI01F shared Web and terminal', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Message input', exact: true }).filter({ visible: true });
    await expect(input).toBeVisible();
    stage = 'terminal-start'; terminal = await startTerminal(fixture, preview.terminalOrigin, watchdog);
    stage = 'terminal-request-capture'; const held = await bounded(Promise.race([preview.gate.held, terminal.failed]), 15000, 'Original TUI request was not captured');
    await fixture.save('held-original-request.json', { ...held, bodyDigest: sha(held.body) });
    const send = async (text: string, number: number) => {
      stage = `web-send-${number}`; await input.fill(text); await page.getByRole('button', { name: 'Send message', exact: true }).filter({ visible: true }).click();
      const record = await until(async () => preview!.gate.writes.filter(row => row.role === 'web')[number - 1], row => !!row?.completed, stop.signal);
      assert.ok(record?.responseBody); const receipt = JSON.parse(record.responseBody); await fixture.observeHandoffTurn(receipt.turn.task.id);
      await expect(page.getByText(text, { exact: true }).filter({ visible: true })).toBeVisible(); return receipt.turn.task.id as string;
    };
    const a = await send(WEB_A, 1); stage = 'web-a-running'; dom.push(await visibleTaskState(page, 1, 'running'));
    stage = 'terminal-conflict-draft'; preview.gate.releaseConflict(); terminal.send('cancel', a);
    const conflict = await terminal.wait('conflict-visible', stop.signal); assert.equal(conflict?.draft, CONFLICT_DRAFT); assert.equal(conflict?.taskId, a);
    stage = 'terminal-a-cancelled'; await terminal.wait('cancelled-visible', stop.signal); await fixture.waitTask(a, 'cancelled', stop.signal);
    stage = 'web-a-cancelled'; dom.push(await visibleTaskState(page, 1, 'cancelled')); preview.gate.allowSecond(a);
    const b = await send(WEB_B, 2); terminal.send('recover', b);
    stage = 'terminal-b-recover'; const recovered = await terminal.wait('recovered-visible', stop.signal); assert.equal(recovered?.taskId, b);
    stage = 'terminal-quit'; await terminal.wait('finished', stop.signal); fixture.record('handoffPty', await terminal.finish());
    stage = 'b-running-after-terminal-exit'; await fixture.waitTask(b, 'running', stop.signal); preview.gate.verify(); dom.push(await visibleTaskState(page, 2, 'running'));
    stage = 'web-b-final'; fixture.release(b); await fixture.waitTask(b, 'succeeded', stop.signal);
    await expect(page.getByText('Synthetic fixture completed after observer exit.', { exact: true }).filter({ visible: true })).toBeVisible();
    dom.push(await visibleTaskState(page, 2, 'succeeded'));
    stage = 'handoff-completion'; await fixture.completeHandoff({ conflict: true, draftPreserved: true, singleCancel: true, recoveredB: true, exitWithoutCancel: true, visibleFinal: true });
    workPassed = true;
  } catch (error) { reject('handoff-work-failed', error); }
  finally {
    clearTimeout(timer); clearInterval(monitor); await sampling;
    const attempt = async (name: string, operation: () => Promise<unknown>, milliseconds = 8000) => {
      try { await bounded(operation(), milliseconds, name); } catch (error) { cleanupFailures.push(describe(name, error)); failures.push(name); fixture.failed(name); }
    };
    await attempt('stage-checkpoint', () => fixture.save('handoff-stages.json', { identity, workPassed, workFailure, cleanupFailures, failures, dom,
      writes: preview?.gate.writes ?? [], reads: preview?.records.filter(row => row.method === 'GET').map(row => ({ role: row.role, path: row.path, status: row.status, completed: row.completed })) ?? [],
      bridgeErrors: preview?.errors ?? [], terminal: terminal?.report() ?? null, chrome: chrome?.observation() ?? null, samples }));
    await attempt('browser-close', async () => { await chrome?.browser.close(); });
    await attempt('preview-close', async () => { await preview?.close(); });
    await attempt('terminal-settle-checkpoint', async () => {
      if (terminal) {
        const final = await terminal.settle();
        await fixture.save('terminal-settlement.json', final);
        assert.equal(final.settled.stopped, true); assert.equal(final.pipesClosed, true);
      }
    });
    await attempt('fixture-close', () => fixture.close(), 50_000);
    stop.abort(); process.off('SIGTERM', terminate); process.off('SIGINT', terminate);
    await writeRecord(join(directory, 'result.json'), { run, sourceDigest: identity.digest, selected: 1, passed: workPassed && failures.length === 0,
      workFailure, cleanupFailures, failures, cleanup: failures.length ? 'inspect-fixture-result-or-checkpoint; unknown resources retained' : 'fixture-confirmed', nativeQueryCalls: 0 }, { exclusive: true });
    const final = await diskBytes(directory); assert.ok(final.bytes <= BOUNDS.rawBytes);
    await watchdog.complete();
  }
  assert.equal(workPassed, true); assert.deepEqual(failures, []);
  process.stdout.write(JSON.stringify({ run, selected: 1, passed: 1, evidence: directory, provider: 0 }) + '\n');
}

export async function failureSelfTest() {
  const { test } = await import('node:test');
  await test('failure evidence retains stage and original bounded reason with credential redaction', () => {
    const token = 'synthetic-failure-check-token';
    const error = Object.assign(Error(`locator.click: button missing; ${token}; Bearer unrelated; postgresql://u:private@localhost/db; ` + '界'.repeat(300)),
      { name: 'TimeoutError', code: 'ETIMEDOUT' });
    const work = safeFailure('web-a-running', error, [token]);
    const cleanup = safeFailure('browser-close', Error('browser.close: connection closed'), [token]);
    assert.equal(work.stage, 'web-a-running'); assert.equal(work.name, 'TimeoutError'); assert.equal(work.code, 'ETIMEDOUT');
    assert.match(work.message, /^locator.click: button missing;/); assert.ok(Buffer.byteLength(work.message) <= 512);
    assert.ok(!work.message.includes(token) && !work.message.includes('unrelated') && !work.message.includes('private@'));
    assert.equal(cleanup.stage, 'browser-close'); assert.equal(cleanup.message, 'browser.close: connection closed');
    const python = spawnSync('/usr/bin/python3', ['experiments/tui-web-control-handoff/terminal.py', '--failure-self-test'],
      { cwd: ROOT, encoding: 'utf8', timeout: 3000, maxBuffer: 4096, env: { PATH: '/usr/bin:/bin' } });
    assert.equal(python.status, 0); assert.equal(python.stderr, '');
    const record = JSON.parse(python.stdout); assert.equal(record.stage, 'conflict-redraw');
    assert.equal(record.name, 'RuntimeError'); assert.equal(record.message, 'Visible PTY marker missing [redacted]');
  });
}

export async function selfTest() {
  const { test } = await import('node:test');
  const conversation = '11111111-1111-1111-1111-111111111111', a = '22222222-2222-2222-2222-222222222222';
  const path = `/api/conversations/${conversation}/turns`;
  const body = (text: string, revision: number) => JSON.stringify({ expectedRevision: revision, mode: 'follow-up', text });
  await test('held immutable TUI body receives actual conflict after one Web admission', async () => {
    const gate = new HandoffWrites(conversation); let forwarded = false;
    const pending = gate.begin('terminal', path, 'original-key', body(CONFLICT_DRAFT, 0)).then(value => { forwarded = true; return value; });
    const held = await gate.held; assert.equal(forwarded, false);
    const first = await gate.begin('web', path, 'web-a-key', body(WEB_A, 0));
    gate.complete(first, 201, JSON.stringify({ conversation: { id: conversation }, turn: { number: 1, task: { id: a } } }));
    gate.releaseConflict(); const released = await pending; assert.equal(released, held); assert.equal(released.key, 'original-key');
    assert.equal(released.body, body(CONFLICT_DRAFT, 0)); gate.complete(released, 409, JSON.stringify({ error: { code: 'conversation_revision_conflict' } }));
  });
  await test('unknown held request aborts without forwarding or a replacement key', async () => {
    const gate = new HandoffWrites(conversation); const pending = gate.begin('terminal', path, 'kept-key', body(CONFLICT_DRAFT, 0));
    await gate.held; gate.abort(); await assert.rejects(pending); assert.equal(gate.writes.length, 1); assert.equal(gate.writes[0]!.completed, false);
    await assert.rejects(gate.begin('terminal', path, 'replacement-key', body(CONFLICT_DRAFT, 0)));
  });
  await test('extra Web task, wrong cancel target and repeated cancel cannot be forwarded', async () => {
    const gate = new HandoffWrites(conversation);
    const first = await gate.begin('web', path, 'a', body(WEB_A, 0));
    gate.complete(first, 201, JSON.stringify({ conversation: { id: conversation }, turn: { number: 1, task: { id: a } } }));
    await assert.rejects(gate.begin('terminal', '/api/tasks/33333333-3333-3333-3333-333333333333/cancel', 'wrong', '{}'));
    const cancel = await gate.begin('terminal', `/api/tasks/${a}/cancel`, 'cancel-a', '{}');
    gate.complete(cancel, 200, JSON.stringify({ id: a, status: 'cancel_requested' })); gate.allowSecond(a);
    await gate.begin('web', path, 'b', body(WEB_B, 1));
    await assert.rejects(gate.begin('web', path, 'third', body('third', 2)));
    await assert.rejects(gate.begin('terminal', `/api/tasks/${a}/cancel`, 'cancel-twice', '{}'));
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--self-test' && process.argv.length === 3) await selfTest();
  else if (process.argv[2] === '--failure-self-test' && process.argv.length === 3) await failureSelfTest();
  else if (process.argv[2] === '--run' && process.argv.length === 4) await runJourney(resolve(process.argv[3]!));
  else throw Error('Explicit --self-test or --run <one-shot-permit> required');
}
