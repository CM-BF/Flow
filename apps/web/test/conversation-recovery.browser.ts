import { createHash } from "node:crypto";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { readFile, writeFile, readdir, lstat, statfs, mkdir, mkdtemp, rm, appendFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Locator, Page, Request, Response } from "@playwright/test";
import type { RecoveryDatabaseLease, RecoveryWire, startRecoveryFixture } from "./conversation-recovery.fixture";

// Only built-ins are loaded by the parent before fresh admission, monitoring and durable ownership facts.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const evidence = join(root, "docs/evidence/wpf-conversation-recovery");
const TOTAL_MS = 90_000, CLEANUP_MS = 15_000, EVIDENCE_BYTES = 8 * 1024 ** 2, LOG_BYTES = 1024 ** 2;
const RUN_RETAIN_RESERVE = 5 * 1024 ** 2; // 1MiB logs + <=2MiB report + two <=512KiB images + bounded owner/budget records.
const START_FREE = 1024 ** 3 + 128 * 1024 ** 2, STOP_FREE = 1024 ** 3 + 64 * 1024 ** 2;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const digest = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const text = (error: unknown) => error instanceof Error ? error.message : String(error);
const json = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
function requireThat(condition: unknown, message: string): asserts condition { if (!condition) throw Error(message); }
async function treeBytes(directory: string, scratch = false): Promise<number> {
  let total = 0;
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    try {
      const entry = await lstat(path);
      requireThat(scratch || !entry.isSymbolicLink(), "Retained evidence must not contain symlinks");
      // Chrome uses transient singleton symlinks: count their lstat bytes, never follow outside scratch.
      total += entry.isDirectory() ? await treeBytes(path, scratch) : entry.size;
    } catch (error) { if (!scratch || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return total;
}
async function freeBytes() { const value = await statfs(root); return value.bavail * value.bsize; }
const sourcePaths = ["apps/web/src/App.tsx", "apps/web/src/connection/session.ts", "apps/web/src/recovery/journal.ts", "apps/web/src/recovery/binding.tsx", "apps/web/src/conversations/ConversationThread.tsx", "apps/web/src/conversations/outbox.ts", "apps/web/src/conversations/projection.ts", "apps/web/src/conversations/queue/commands.ts", "apps/web/src/conversation-steering/control.ts", "apps/web/src/conversation-steering/SteeringControl.tsx", "apps/web/src/conversation-context/controller.ts", "apps/web/src/attachments/controller.ts", "apps/web/src/plugin-integration/attachments.tsx", "apps/web/src/plugin-integration/knowledge.tsx", "apps/web/src/plugin-integration/session.ts", "apps/web/src/plugin-integration/steering.tsx", "apps/web/test/conversation-recovery.test.ts", "apps/web/test/conversation-recovery.fixture.ts", "apps/web/test/conversation-recovery.browser.ts"];
type Gate = { allowRun: true; run: string; sourceCommit: string; sourceHashes: Record<string, string>; expiresAt: string;
  totalMs: number; minimumFreeBytes: number; scratchParent: string; maxScratchBytes: number };
type Init = { kind: "start"; directory: string; scratch: string; databaseUrl: string; workDeadline: number };
type BodyLossObservation = { path: string | null; key: string | null; bodySha256: string | null; status: number | null;
  headers: Record<string, string>; events: string[]; failure: string | null; finished: boolean };
type WorkerResult = { checks: string[]; pageErrors: string[]; failure: string | null; cleanupErrors: string[]; wire: RecoveryWire[]; coverage: Record<string, string>; bodyLoss: BodyLossObservation[] };
type TailObservation = { phase: string; elapsedMs: number; scratchBytes: number | null; evidenceBytes: number | null; freeBytes: number | null; errors: string[] };

async function supervisor() {
  requireThat(process.env.FLOW_RECOVERY_BROWSER === "1", "Separate real browser/PG approval is required");
  const gatePath = process.env.FLOW_RECOVERY_GATE, adminUrl = process.env.FLOW_RECOVERY_TEST_ADMIN;
  requireThat(gatePath && adminUrl, "Fresh explicit gate and isolated PG admin endpoint are required; no discovery/default");
  const gate = JSON.parse(await readFile(gatePath, "utf8")) as Gate;
  requireThat(gate.allowRun === true && /^[a-z0-9-]{1,48}$/.test(gate.run), "Invalid one-run gate");
  requireThat(Date.parse(gate.expiresAt) > Date.now(), "Admission expired");
  requireThat(Number.isFinite(gate.totalMs) && gate.totalMs >= 30_000 && gate.totalMs <= TOTAL_MS, "Invalid admitted time budget");
  requireThat(gate.minimumFreeBytes >= START_FREE && Number.isFinite(gate.minimumFreeBytes), "Browser start margin must be explicitly admitted");
  requireThat(Number.isSafeInteger(gate.maxScratchBytes) && gate.maxScratchBytes > 0 && gate.maxScratchBytes <= 64 * 1024 ** 2, "Scratch requires an explicit <=64MiB bound");
  requireThat(await realpath(gate.scratchParent) === "/private/tmp", "Scratch must use the explicitly admitted local tmp parent");
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", timeout: 2000 }).trim();
  requireThat(sourceCommit === gate.sourceCommit, "Source commit differs from admission");
  const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, digest(await readFile(join(root, path)))])));
  for (const path of sourcePaths) requireThat(sourceHashes[path] === gate.sourceHashes[path], `Admitted source mismatch: ${path}`);
  const dirty = !!execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8", timeout: 2000 }).trim();
  const runs = join(evidence, "browser-runs"); await mkdir(runs, { recursive: true });
  let priorMs = 0;
  for (const name of await readdir(runs)) {
    const previous = JSON.parse(await readFile(join(runs, name, "budget.json"), "utf8"));
    requireThat(previous.complete === true && previous.cleanupComplete === true && Number.isFinite(previous.elapsedMs), "Prior incomplete attempt requires explicit reconciliation");
    priorMs += previous.elapsedMs;
  }
  // Preserve accounting for any run made with the older entry point; never silently start a new budget.
  for (const name of (await readdir(evidence)).filter(name => name.endsWith("-browser-budget.json"))) {
    const previous = JSON.parse(await readFile(join(evidence, name), "utf8"));
    requireThat(previous.endedAt && Number.isFinite(previous.elapsedMs) && previous.cleanupErrors?.length === 0, "Legacy attempt lacks settled cleanup");
    priorMs += previous.elapsedMs;
  }
  requireThat(priorMs + gate.totalMs <= TOTAL_MS, "Cumulative browser/HTTP budget exhausted");
  requireThat(await freeBytes() >= gate.minimumFreeBytes, "Fresh free space below admitted start threshold");
  requireThat(await treeBytes(evidence) < EVIDENCE_BYTES - RUN_RETAIN_RESERVE, "Insufficient retained evidence headroom");
  const directory = join(runs, gate.run); await mkdir(directory, { mode: 0o700 }); // Exclusive: never overwrite a run.
  const began = performance.now(), workDeadline = Date.now() + gate.totalMs - CLEANUP_MS;
  const hardAt = began + gate.totalMs;
  const budget = { complete: false, cleanupComplete: false, startedAt: new Date().toISOString(), priorMs, permittedMs: gate.totalMs, cleanupReserveMs: CLEANUP_MS, elapsedMs: 0 };
  writeFileSync(join(directory, "budget.json"), JSON.stringify(budget), { mode: 0o600 });
  const children: ChildProcess[] = [], closed = new Map<ChildProcess, Promise<void>>();
  const errors: string[] = [], cleanupErrors: string[] = [];
  let lease: RecoveryDatabaseLease | undefined, scratch: string | undefined, result: WorkerResult | undefined;
  let minimumFreeBytes = Infinity, peakScratchBytes = 0, logBytes = 0, stopped = false, chromeRequested = false;
  let stopReason: string | undefined, interruptionRequested = false;
  let monitor: NodeJS.Timeout | undefined, monitoring: Promise<void> | undefined, logs = Promise.resolve();
  const signalGroups = (signal: NodeJS.Signals) => {
    for (const child of children) if (child.pid) try { process.kill(-child.pid, signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") cleanupErrors.push(text(error)); }
  };
  const hardStop = setTimeout(() => {
    signalGroups("SIGKILL");
    Object.assign(budget, { complete: false, cleanupComplete: false, elapsedMs: performance.now() - began });
    try {
      writeFileSync(join(directory, "budget.json"), JSON.stringify(budget), { mode: 0o600 });
      writeFileSync(join(directory, "hard-stop.json"), JSON.stringify({ at: new Date().toISOString(), scratch, database: lease?.database,
        databaseState: lease?.state, ownedPids: children.map(child => child.pid), cleanupConfirmed: false }), { mode: 0o600 });
    } finally { process.exit(1); } // Even a hard stop during final accounting invalidates the budget.
  }, gate.totalMs);
  const stop = (reason: string) => {
    // Cleanup stopping work is not evidence that a later stop request was recorded.
    if (stopReason === undefined) { stopReason = reason; errors.push(reason); }
    if (!stopped) { stopped = true; signalGroups("SIGTERM"); }
  };
  const interrupted = () => {
    if (interruptionRequested) return;
    interruptionRequested = true; stop("Supervisor interrupted");
  };
  process.on("SIGINT", interrupted); process.on("SIGTERM", interrupted);
  const working = () => { requireThat(!stopped && performance.now() < hardAt - CLEANUP_MS, "Work deadline reached; cleanup reserve started"); };
  const checkpoint = async () => {
    try {
      working();
      const free = await freeBytes(); minimumFreeBytes = Math.min(minimumFreeBytes, free);
      requireThat(free > STOP_FREE, "Free space reached stop margin");
      requireThat(await treeBytes(evidence) <= EVIDENCE_BYTES - 32 * 1024, "Evidence limit reached");
      if (scratch) { const bytes = await treeBytes(scratch, true); peakScratchBytes = Math.max(peakScratchBytes, bytes); requireThat(bytes <= gate.maxScratchBytes, "Scratch limit reached"); }
      working();
    } catch (error) { stop(text(error)); throw error; }
  };
  const own = (child: ChildProcess) => {
    children.push(child);
    closed.set(child, new Promise<void>(resolve => { child.once("close", () => resolve()); child.once("error", error => { stop(text(error)); resolve(); }); }));
    writeFileSync(join(directory, "process-owner.json"), JSON.stringify(children.map(child => ({ pid: child.pid ?? null }))), { mode: 0o600 });
    for (const output of [child.stdout, child.stderr]) output?.on("data", (chunk: Buffer) => {
      logBytes += chunk.length;
      if (logBytes > LOG_BYTES) { stop("Process output exceeded 1MiB"); return; }
      logs = logs.then(() => appendFile(join(directory, "process.log"), chunk)).catch(error => stop(text(error)));
    });
    return child;
  };
  let databaseCleanup: Awaited<ReturnType<RecoveryDatabaseLease["close"]>> | undefined;
  try {
    await json(join(directory, "sources.json"), { sourceCommit, dirty, sourceHashes });
    monitor = setInterval(() => { if (!monitoring) monitoring = checkpoint().catch(() => {}).finally(() => { monitoring = undefined; }); }, 250);
    await checkpoint(); // Before any Vite/PG/Playwright/business import or CREATE.
    const { RecoveryDatabaseLease } = await import("./conversation-recovery.fixture");
    await checkpoint();
    lease = new RecoveryDatabaseLease(adminUrl, directory);
    await lease.create(checkpoint);
    await checkpoint();
    scratch = await mkdtemp(join(gate.scratchParent, "flow-recovery-browser-"));
    await json(join(directory, "scratch-owner.json"), { scratch, maxBytes: gate.maxScratchBytes, retainedEvidence: false });
    await checkpoint();
    const crashpad = join(scratch, "crashpad"); await mkdir(crashpad); await checkpoint();
    const childEnv: NodeJS.ProcessEnv = { ...process.env, TSX_DISABLE_CACHE: "1", NODE_DISABLE_COMPILE_CACHE: "1", TMPDIR: scratch, TMP: scratch, TEMP: scratch, MAC_CHROMIUM_TMPDIR: scratch, BREAKPAD_DUMP_LOCATION: crashpad, XDG_CACHE_HOME: join(scratch, "cache") };
    delete childEnv.FLOW_RECOVERY_TEST_ADMIN;
    const chromeExecutable = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", profile = join(scratch, "chrome");
    const chromeArgs = ["--headless=new", "--remote-debugging-port=0", "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`,
      "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "about:blank"];
    await json(join(directory, "launch-config.json"), {
      temp: { TMPDIR: scratch, TMP: scratch, TEMP: scratch, MAC_CHROMIUM_TMPDIR: scratch, BREAKPAD_DUMP_LOCATION: crashpad, XDG_CACHE_HOME: join(scratch, "cache") },
      worker: { executable: process.execPath, selectedArgv: [fileURLToPath(import.meta.url), "--worker"], inheritedRuntimeArguments: "not recorded" },
      chrome: { executable: chromeExecutable, argv: chromeArgs },
    }); // Deliberate whitelist: never serialize inherited environment or credential-bearing arguments.
    const worker = own(spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--worker"], { cwd: root, detached: true,
      stdio: ["ignore", "pipe", "pipe", "ipc"], env: childEnv }));
    worker.on("message", message => {
      const data = message as { kind?: string; result?: WorkerResult };
      if (data.kind === "result") result = data.result;
      if (data.kind === "chrome" && !chromeRequested) {
        chromeRequested = true;
        void (async () => {
          await checkpoint(); requireThat(scratch, "Scratch ownership missing");
          await mkdir(profile); await checkpoint();
          const chrome = own(spawn(chromeExecutable, chromeArgs,
          { detached: true, stdio: ["ignore", "pipe", "pipe"], env: childEnv }));
          let port = "";
          while (!port) {
            await checkpoint(); requireThat(chrome.exitCode === null && chrome.signalCode === null, "Owned Chrome exited during startup");
            try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0] ?? ""; }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
            if (!port) await sleep(30);
          }
          requireThat(/^\d+$/.test(port), "Invalid Chrome endpoint"); await checkpoint();
          if (worker.connected) worker.send({ kind: "chrome-ready", endpoint: `http://127.0.0.1:${port}` });
        })().catch(error => stop("Chrome startup: " + text(error)));
      }
    });
    working(); worker.send({ kind: "start", directory, scratch, databaseUrl: lease.url, workDeadline } satisfies Init);
    while (worker.exitCode === null && worker.signalCode === null && !stopped) { await sleep(30); working(); }
    if (!result) errors.push("Worker did not return a complete result");
  } catch (error) { errors.push(text(error)); }
  finally {
    stopped = true; if (monitor) clearInterval(monitor); await monitoring;
    signalGroups("SIGTERM");
    const grace = Math.min(performance.now() + 2000, hardAt - 12_000);
    while (performance.now() < grace && children.some(child => child.exitCode === null && child.signalCode === null)) await sleep(30);
    signalGroups("SIGKILL");
    let allOwnedGroupsAbsent = true;
    for (const child of children) {
      await Promise.race([closed.get(child), sleep(Math.max(0, Math.min(500, hardAt - performance.now())))]);
      if (child.exitCode === null && child.signalCode === null) cleanupErrors.push(`Owned PID ${child.pid} exit unconfirmed`);
      let absent = false;
      if (child.pid) {
        try { process.kill(-child.pid, 0); cleanupErrors.push(`Owned process group ${child.pid} remains`); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ESRCH") absent = true;
          else cleanupErrors.push(`Owned process group ${child.pid} observation: ${text(error)}`);
        }
      } else cleanupErrors.push("Owned process has no confirmed PID");
      allOwnedGroupsAbsent = allOwnedGroupsAbsent && absent;
    }
    if (lease) try { databaseCleanup = await lease.close(hardAt); cleanupErrors.push(...databaseCleanup.errors); }
    catch (error) { cleanupErrors.push("Database cleanup: " + text(error)); }
    const terminal: TailObservation[] = [];
    const observeTail = async (phase: string, includeScratch = false, reserveBytes = 0): Promise<TailObservation> => {
      const observation: TailObservation = { phase, elapsedMs: 0, scratchBytes: null, evidenceBytes: null, freeBytes: null, errors: [] };
      const failed = (message: string) => { observation.errors.push(message); errors.push(`${phase}: ${message}`); };
      try {
        observation.freeBytes = await freeBytes(); minimumFreeBytes = Math.min(minimumFreeBytes, observation.freeBytes);
        if (observation.freeBytes <= STOP_FREE) failed("Free space reached stop margin");
      } catch (error) { failed("Free-space accounting: " + text(error)); }
      try {
        observation.evidenceBytes = await treeBytes(evidence);
        if (observation.evidenceBytes > EVIDENCE_BYTES - reserveBytes) failed("Retained evidence limit reached");
      } catch (error) { failed("Evidence accounting: " + text(error)); }
      if (includeScratch && scratch) try {
        observation.scratchBytes = await treeBytes(scratch, true); peakScratchBytes = Math.max(peakScratchBytes, observation.scratchBytes);
        if (observation.scratchBytes > gate.maxScratchBytes) failed("Scratch limit reached after child reaping");
      } catch (error) { failed("Scratch accounting: " + text(error)); }
      observation.elapsedMs = performance.now() - began;
      if (observation.elapsedMs > gate.totalMs || priorMs + observation.elapsedMs > TOTAL_MS) failed("Total browser budget exceeded");
      return observation; // No work-deadline guard: cleanup observations use the same absolute hard stop.
    };
    terminal.push(await observeTail("after-reap-before-removal", allOwnedGroupsAbsent, 16 * 1024));
    let scratchRemoved = !scratch;
    if (scratch) {
      if (!allOwnedGroupsAbsent) cleanupErrors.push("Scratch retained because owned-group absence is unresolved");
      else {
        // Accounting failures above remain failures; confirmed absence still permits safe cleanup.
        try { await rm(scratch, { recursive: true }); }
        catch (error) { cleanupErrors.push("Scratch cleanup: " + text(error)); }
        try { await lstat(scratch); cleanupErrors.push("Scratch still exists"); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") scratchRemoved = true; else cleanupErrors.push(text(error)); }
      }
    }
    await logs;
    if (result?.cleanupErrors.length) cleanupErrors.push(...result.cleanupErrors);
    if (result?.failure) errors.push(result.failure);
    const persistReports = async (complete: boolean) => {
      const elapsedMs = performance.now() - began;
      Object.assign(budget, { complete, cleanupComplete: allOwnedGroupsAbsent && scratchRemoved && cleanupErrors.length === 0, elapsedMs });
      await json(join(directory, "supervisor.json"), { passed: complete && stopReason === undefined && !interruptionRequested && allOwnedGroupsAbsent && scratchRemoved && !!result && !errors.length && !cleanupErrors.length && elapsedMs <= gate.totalMs && priorMs + elapsedMs <= TOTAL_MS,
        errors, cleanupErrors, databaseCleanup, processIds: children.map(child => ({ pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode })),
        stopReason, interruptionRequested, allOwnedGroupsAbsent, minimumFreeBytes, peakScratchBytes, logBytes, scratchRemoved, terminal,
        attribution: "Timing begins after preflight; terminal observations include report writes. Shared-volume samples are not hard quotas or exclusively attributable allocation", providerQueries: 0 });
      await json(join(directory, "budget.json"), budget);
    };
    let postWrite: TailObservation | undefined;
    try {
      await persistReports(false);
      terminal.push(await observeTail("after-initial-report-and-budget"));
      await persistReports(true);
      postWrite = await observeTail("after-final-report-and-budget");
      if (postWrite.errors.length || stopReason !== undefined || interruptionRequested) {
        terminal.push(postWrite);
        await persistReports(false); // Bounded failure correction; no report/retry loop.
        postWrite = await observeTail("after-failure-correction");
      }
    } catch (error) {
      errors.push("Final report accounting: " + text(error));
      try { await persistReports(false); } catch (failure) { errors.push("Failure report write: " + text(failure)); }
    } finally {
      console.log(JSON.stringify({ kind: "recovery-final-accounting", directory, postWrite, stopReason, interruptionRequested, errors, cleanupErrors, allOwnedGroupsAbsent, scratchRemoved }));
      clearTimeout(hardStop); process.off("SIGINT", interrupted); process.off("SIGTERM", interrupted);
    }
    if (stopReason !== undefined || interruptionRequested || !result || errors.length || cleanupErrors.length || !allOwnedGroupsAbsent || !scratchRemoved || performance.now() > hardAt || priorMs + performance.now() - began > TOTAL_MS) process.exitCode = 1;
  }
}

async function worker(init: Init) {
  const { chromium, expect } = await import("@playwright/test");
  const { startRecoveryFixture, observeRecoveryRecords } = await import("./conversation-recovery.fixture");
  const records = async (page: Page) => {
    const result = await page.evaluate(observeRecoveryRecords, { name: "flow.conversation-recovery.v1", version: 1, timeoutMs: 1000 });
    return result.records; // Missing/pending remains empty for the existing strict draft poll; malformed rejects.
  };
  const { decodeConversationTurnAccepted } = await import("@flow/client");
  const { conversationTurnSchema } = await import("@flow/contracts");
  const checks: string[] = [], pageErrors: string[] = [], cleanupErrors: string[] = [];
  const bodyLoss: BodyLossObservation[] = [], stopObservers: (() => void)[] = [];
  let errorBytes = 0;
  const pageError = (error: Error) => {
    errorBytes += Buffer.byteLength(error.message);
    if (errorBytes > 64 * 1024 || pageErrors.length >= 64) lifetime.abort(Error("Page error evidence bound exceeded"));
    else pageErrors.push(error.message);
  };
  const coverage: Record<string, string> = {
    cookieRead: "NOT_RUN", cookieSseHandshake: "NOT_RUN", cookieSseDelivery: "PENDING: only handshake is asserted", textIntentDraft: "NOT_RUN", materialDraft: "NOT_RUN", sameKeyTurn: "NOT_RUN", crossTabCas: "NOT_RUN",
    pageOnlyAuthLoss: "NOT_RUN", csrfOffline: "NOT_RUN", themes390: "NOT_RUN",
    createTwoStage: "PENDING: direct/source only", queueSteerRecovery: "PENDING: direct/source only",
    profileKnowledgeSteeringDraft: "PENDING: direct/source only", secondCenter: "PENDING: one-center fixture",
  };
  const lifetime = new AbortController();
  const abort = () => lifetime.abort(Error("Supervisor stopped work"));
  process.once("SIGTERM", abort); process.once("SIGINT", abort);
  const deadline = setTimeout(abort, Math.max(0, init.workDeadline - Date.now()));
  const checkpoint = async () => { lifetime.signal.throwIfAborted(); requireThat(Date.now() < init.workDeadline, "Worker work deadline"); };
  let fixture: Awaited<ReturnType<typeof startRecoveryFixture>> | undefined, browser: Browser | undefined, failure: string | null = null;
  const postRows = () => fixture!.wire.filter(row => row.method === "POST" && !row.path.includes("browser-session"));
  const run = async (name: string, key: string, operation: () => Promise<void>) => {
    await checkpoint(); coverage[key] = "RUNNING"; try { await operation(); await checkpoint(); checks.push(name); coverage[key] = "PASSED"; } catch (error) { coverage[key] = "FAILED"; throw error; }
  };
  const observeTurnBodyLoss = (page: Page, requestedText: string) => {
    const observation: BodyLossObservation = { path: null, key: null, bodySha256: null, status: null, headers: {}, events: [], failure: null, finished: false };
    bodyLoss.push(observation);
    let selected: Request | undefined;
    const onRequest = (request: Request) => {
      if (selected || request.method() !== "POST" || new URL(request.url()).pathname !== `/api/conversations/${fixture!.conversationId}/turns`) return;
      const body = request.postData(); if (!body) return;
      try { if (JSON.parse(body).text !== requestedText) return; } catch { return; }
      selected = request; observation.path = new URL(request.url()).pathname;
      observation.key = request.headers()["idempotency-key"] ?? null; observation.bodySha256 = digest(body); observation.events.push("request");
    };
    const onResponse = (response: Response) => {
      if (response.request() !== selected) return;
      observation.status = response.status(); const headers = response.headers();
      for (const name of ["content-length", "content-type", "connection", "cache-control"]) observation.headers[name] = headers[name] ?? "";
      observation.events.push("response-headers");
    };
    const onFailed = (request: Request) => {
      if (request !== selected) return;
      observation.failure = request.failure()?.errorText ?? null; observation.events.push("requestfailed");
    };
    const onFinished = (request: Request) => { if (request === selected) { observation.finished = true; observation.events.push("requestfinished"); } };
    page.on("request", onRequest); page.on("response", onResponse); page.on("requestfailed", onFailed); page.on("requestfinished", onFinished);
    const stop = () => { page.off("request", onRequest); page.off("response", onResponse); page.off("requestfailed", onFailed); page.off("requestfinished", onFinished); };
    stopObservers.push(stop);
    return async (row: RecoveryWire) => {
      const deadline = Math.min(Date.now() + 2000, init.workDeadline);
      try {
        // Playwright requestfailed is the body-failure event; response.finished() is not awaited.
        while (!observation.failure || !row.fault?.socketClosed) {
          await checkpoint(); requireThat(Date.now() < deadline, "Same-request ACK body failure observation deadline"); await sleep(20);
        }
        expect(observation.events).toEqual(["request", "response-headers", "requestfailed"]); expect(observation.finished).toBe(false);
        expect(observation.failure).toMatch(/CONTENT_LENGTH_MISMATCH|FAILED/);
        expect({ path: observation.path, key: observation.key, bodySha256: observation.bodySha256, status: observation.status })
          .toEqual({ path: row.path, key: row.key, bodySha256: digest(row.body), status: row.status });
        requireThat(row.responseBody && row.fault, "Complete real ACK and fault evidence required");
        const bytes = Buffer.from(row.responseBody), fault = row.fault;
        expect(row.responseSha256).toBe(digest(bytes)); expect(fault.contentLength).toBe(bytes.length);
        expect(observation.headers).toEqual({ "content-length": String(bytes.length), "content-type": fault.contentType, "connection": "close", "cache-control": "no-store" });
        expect(fault.kind).toBe("truncated-ack-body"); expect(fault.prefixBytes).toBe(1); expect(bytes.length).toBeGreaterThan(fault.prefixBytes);
        expect(fault.prefixSha256).toBe(digest(bytes.subarray(0, fault.prefixBytes)));
        expect([fault.headersFlushed, fault.prefixFlushed, fault.endFlushed, fault.socketClosed]).toEqual([true, true, true, true]); expect(fault.error).toBeUndefined();
      } finally { stop(); }
    };
  };
  try {
    fixture = await startRecoveryFixture({ databaseUrl: init.databaseUrl, directory: init.directory, cacheDirectory: join(init.scratch, "vite-cache"), checkpoint }, lifetime.signal);
    await checkpoint();
    const endpoint = await new Promise<string>((resolve, reject) => {
      const aborted = () => { process.off("message", onMessage); reject(lifetime.signal.reason); };
      const onMessage = (message: unknown) => {
        const value = message as { kind?: string; endpoint?: string };
        if (value.kind === "chrome-ready" && typeof value.endpoint === "string") { process.off("message", onMessage); lifetime.signal.removeEventListener("abort", aborted); resolve(value.endpoint); }
      };
      process.on("message", onMessage); lifetime.signal.addEventListener("abort", aborted, { once: true });
      lifetime.signal.throwIfAborted(); process.send?.({ kind: "chrome" });
    });
    await checkpoint(); browser = await chromium.connectOverCDP(endpoint, { timeout: 5000 }); await checkpoint();
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: "reduce" });
    const page = await context.newPage(); page.setDefaultTimeout(4500); page.on("pageerror", pageError);
    const input = (target = page) => target.getByRole("textbox", { name: "Message input", exact: true }).filter({ visible: true });
    const openRecovery = async (target = page, keyboard = false) => {
      const trigger = target.getByRole("button", { name: "Saved drafts and receipts", exact: true });
      if (!await trigger.isVisible()) await target.getByRole("button", { name: "Chats", exact: true }).click();
      if (keyboard) { await trigger.focus(); await expect(trigger).toBeFocused(); await trigger.press("Enter"); }
      else await trigger.click();
      const dialog = target.getByRole("dialog", { name: "Saved drafts and receipts", exact: true }); await expect(dialog).toBeVisible(); return dialog;
    };
    await run("actual browser stores HttpOnly cookie; public cookie-only session read opens original center", "cookieRead", async () => {
      await page.goto(fixture!.url + `#conversation=${fixture!.conversationId}`);
      await page.getByLabel("Owner token", { exact: true }).fill(fixture!.token); await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); await expect(input()).toBeVisible();
      expect((await context.cookies()).some(cookie => cookie.name.startsWith("flow-session-") && cookie.httpOnly)).toBe(true);
      expect(fixture!.wire.some(row => row.path === "/api/browser-session" && row.cookie && !row.bearer && row.status === 200)).toBe(true);
    });
    let draftId = "";
    const originalDraftRow = async (dialog: Locator) => {
      expect(draftId).toMatch(/^draft:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i);
      const row = dialog.locator(`[data-recovery-record-id="${draftId}"]`);
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("Saved draft");
      await expect(row).toContainText(`conversation:${fixture!.conversationId}`);
      await expect(row).toContainText("Original recovery draft 中文🙂");
      await expect(row).toContainText("Queue next");
      await expect(row).toContainText("Files: 2");
      await expect(row.locator("time")).toHaveCount(1);
      return row;
    };
    await run("text, intent and exact file reference survive reload and explicit restore without mutation", "textIntentDraft", async () => {
      const files = page.locator("[data-composer-view]").getByRole("button", { name: "Files", exact: true }).filter({ visible: true });
      await files.click();
      const picker = page.getByRole("dialog", { name: "Project text files", exact: true });
      await picker.getByRole("button", { name: "Browse files", exact: true }).click();
      await picker.getByRole("button", { name: "Use saved.txt", exact: true }).click();
      await picker.getByRole("button", { name: "Use later.txt", exact: true }).click();
      await expect(picker.getByRole("region", { name: "Files in this draft" })).toContainText("saved.txt");
      await page.keyboard.press("Escape");
      await input().fill("Original recovery draft 中文🙂"); await page.getByRole("radio", { name: "Queue next", exact: true }).check();
      await expect.poll(async () => (await records(page)).some(record => record.kind === "draft" && record.data?.text === "Original recovery draft 中文🙂" && record.data.intent === "queue")).toBe(true);
      draftId = (await records(page)).find(record => record.data?.text === "Original recovery draft 中文🙂")!.id;
      const saved = (await records(page)).find(record => record.id === draftId)!;
      expect(saved.data?.attachments).toMatchObject([{ name: "saved.txt", metadata: { reference: fixture!.resource.reference } }, { name: "later.txt", metadata: { reference: fixture!.secondResource.reference } }]);
      expect(saved.data?.attachments).toHaveLength(2);
      const contentReads = () => fixture!.wire.filter(row => /\/attachments\/.*\/content/.test(row.path)).length;
      const bodiesBefore = contentReads(), posts = postRows().length; await page.reload(); await expect(input()).toBeVisible();
      const dialog = await openRecovery(), row = await originalDraftRow(dialog);
      await row.getByRole("button", { name: "Restore without sending", exact: true }).click(); await page.keyboard.press("Escape");
      await expect(input()).toHaveValue("Original recovery draft 中文🙂"); await expect(page.getByRole("radio", { name: "Queue next", exact: true })).toBeChecked(); expect(postRows()).toHaveLength(posts);
      const composerFiles = input().locator("xpath=ancestor::form").locator(".aui-composer-attachments .aui-attachment-root");
      await expect(composerFiles).toHaveCount(0); // Restored metadata alone is not a ready composer attachment.
      const commandCount = (await records(page)).filter(record => record.kind === "command").length;
      const assertMaterialSubmitBlocked = async () => {
        for (const delivery of ["Send now", "Queue next"]) {
          await page.getByRole("radio", { name: delivery, exact: true }).check(); await input().press("Enter");
          await expect(page.getByRole("alert").filter({ hasText: "Verify every selected file" }).first()).toBeVisible();
          await expect(input()).toHaveValue("Original recovery draft 中文🙂"); expect(postRows()).toHaveLength(posts);
          expect((await records(page)).filter(record => record.kind === "command")).toHaveLength(commandCount);
        }
      };
      await assertMaterialSubmitBlocked();
      await files.click();
      await expect(picker.getByRole("region", { name: "Files in this draft" })).toContainText("saved.txt");
      await expect(picker.getByRole("region", { name: "Files in this draft" })).toContainText("unverified");
      expect(contentReads()).toBe(bodiesBefore);
      // Verify B first through a real filtered metadata GET. A is still selected
      // and unverified, so B cannot become a partial or reordered submission.
      await picker.getByRole("textbox", { name: "Find uploaded files", exact: true }).fill("later.txt");
      await picker.getByRole("button", { name: "Browse files", exact: true }).click();
      await expect(picker.getByRole("region", { name: "Files in this draft" }).locator("article").filter({ hasText: "later.txt" })).toContainText("ready");
      await page.keyboard.press("Escape"); await expect(composerFiles).toHaveCount(0); await assertMaterialSubmitBlocked();
      await files.click(); await picker.getByRole("textbox", { name: "Find uploaded files", exact: true }).fill("saved.txt");
      await picker.getByRole("button", { name: "Browse files", exact: true }).click();
      await expect(picker.getByRole("region", { name: "Files in this draft" }).locator("article").filter({ hasText: "saved.txt" })).toContainText("ready");
      await page.keyboard.press("Escape");
      // No Use/reselection/remount: original A,B order must reach actual chips.
      await expect(composerFiles).toHaveCount(2);
      await composerFiles.nth(0).getByRole("button", { name: "File attachment", exact: true }).focus();
      await expect(page.getByRole("tooltip")).toHaveText("saved.txt");
      await composerFiles.nth(1).getByRole("button", { name: "File attachment", exact: true }).focus();
      await expect(page.getByRole("tooltip")).toHaveText("later.txt");
      await input().focus();
      expect(contentReads()).toBe(bodiesBefore); expect(postRows()).toHaveLength(posts);
      expect((await records(page)).find(record => record.id === draftId)?.data?.attachments).toMatchObject([{ metadata: { reference: fixture!.resource.reference } }, { metadata: { reference: fixture!.secondResource.reference } }]);
      coverage.materialDraft = "PASSED";
    });
    await run("two actual tabs cannot overwrite the same restored draft version", "crossTabCas", async () => {
      const other = await context.newPage(); other.setDefaultTimeout(4500); other.on("pageerror", pageError);
      await other.goto(fixture!.url + `#conversation=${fixture!.conversationId}`); await expect(input(other)).toBeVisible();
      const dialog = await openRecovery(other), row = await originalDraftRow(dialog); await row.getByRole("button", { name: "Restore without sending", exact: true }).click(); await other.keyboard.press("Escape");
      await page.bringToFront(); await input().fill("Tab A protected draft"); await expect.poll(async () => (await records(page)).find(record => record.id === draftId)?.data?.text).toBe("Tab A protected draft");
      await other.bringToFront(); await input(other).fill("Tab B conflict stays local"); await expect(other.getByRole("alert").filter({ hasText: "another tab" }).first()).toBeVisible();
      expect((await records(page)).find(record => record.id === draftId)?.data?.text).toBe("Tab A protected draft"); await other.close(); await page.bringToFront();
    });
    await run("lost turn ACK preserves exact key/body; reload and re-auth read never submit; explicit retry replays", "sameKeyTurn", async () => {
      await page.getByRole("radio", { name: "Send now", exact: true }).check();
      const turnRows = () => postRows().filter(row => row.path === `/api/conversations/${fixture!.conversationId}/turns`);
      expect(turnRows()).toHaveLength(0);
      const verifyBodyLoss = observeTurnBodyLoss(page, await input().inputValue()); fixture!.dropNext("turn"); await input().press("Enter");
      await expect(page.getByRole("region", { name: "Message receipt", exact: true })).toContainText("Receipt unknown");
      expect(turnRows()).toHaveLength(1); const first = turnRows()[0]!; await verifyBodyLoss(first);
      const requested = conversationTurnSchema.parse(JSON.parse(first.body));
      expect(requested.attachments).toEqual([fixture!.resource.reference, fixture!.secondResource.reference]);
      await input().fill("Next draft stays independent"); await expect.poll(async () => (await records(page)).some(record => record.data?.text === "Next draft stays independent")).toBe(true);
      const posts = postRows().length; await page.reload(); await expect(input()).toBeVisible(); expect(postRows()).toHaveLength(posts); expect(turnRows()).toHaveLength(1);
      const dialog = await openRecovery(); const command = dialog.locator("li").filter({ hasText: "outbox receipt" }); await expect(command).toHaveCount(1);
      expect(turnRows()).toHaveLength(1); await command.getByRole("button", { name: "Retry original request", exact: true }).click(); await expect.poll(() => turnRows().length).toBe(2);
      const retry = turnRows()[1]!; expect({ key: retry.key, body: retry.body }).toEqual({ key: first.key, body: first.body });
      await expect.poll(async () => (await records(page)).find(record => record.kind === "command")?.phase).toBe("accepted");
      expect(turnRows()).toHaveLength(2); requireThat(first.responseBody && retry.responseBody, "Both real ACK identities required");
      const originalAck = decodeConversationTurnAccepted(JSON.parse(first.responseBody), fixture!.conversationId, requested);
      const retryAck = decodeConversationTurnAccepted(JSON.parse(retry.responseBody), fixture!.conversationId, requested);
      for (const ack of [originalAck, retryAck]) {
        expect(ack.turn.id.length).toBeGreaterThan(0); expect(ack.turn.task.id.length).toBeGreaterThan(0);
      }
      expect(retryAck.replayed).toBe(true);
      expect({ id: retryAck.turn.id, taskId: retryAck.turn.task.id }).toEqual({ id: originalAck.turn.id, taskId: originalAck.turn.task.id });
      expect(retry.responseSha256).toBe(digest(retry.responseBody)); expect(retry.fault).toBeUndefined();
      await page.keyboard.press("Escape"); expect((await records(page)).some(record => record.data?.text === "Next draft stays independent")).toBe(true);
      expect(fixture!.wire.some(row => /\/stream/.test(row.path) && row.cookie && !row.bearer && row.status === 200)).toBe(true); coverage.cookieSseHandshake = "PASSED";
    });
    await run("auth loss without reload retains an unsaved page-only draft; reconnect sends no command", "pageOnlyAuthLoss", async () => {
      const posts = postRows().length, pageOrigin = await page.evaluate(() => performance.timeOrigin);
      await page.evaluate(() => {
        const holder = window as Window & { recoveryFixtureRestoreIdb?: () => void };
        const original = IDBDatabase.prototype.transaction;
        Object.defineProperty(IDBDatabase.prototype, "transaction", { configurable: true, writable: true,
          value(this: IDBDatabase, ...args: Parameters<IDBDatabase["transaction"]>) {
            const transaction = original.apply(this, args);
            if (this.name === "flow.conversation-recovery.v1" && args[1] === "readwrite") queueMicrotask(() => transaction.abort());
            return transaction;
          } });
        Object.defineProperty(holder, "recoveryFixtureRestoreIdb", { configurable: true,
          value() { IDBDatabase.prototype.transaction = original; delete holder.recoveryFixtureRestoreIdb; } });
      });
      try {
        await input().fill("Unsaved page-only draft after abort 中文🙂");
        await expect(page.getByRole("alert").filter({ hasText: /storage|transaction|save|checkpoint|abort/i }).first()).toBeVisible();
        expect((await records(page)).some(record => record.data?.text === "Unsaved page-only draft after abort 中文🙂")).toBe(false);
        await fixture!.expireSessions();
        await page.evaluate(() => window.dispatchEvent(new Event("focus"))); // Actual public session read; no reload or private controller access.
        await expect(page.getByRole("heading", { name: "Connect to Flow", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Saved drafts and receipts", exact: true })).not.toBeVisible();
        await page.evaluate(() => (window as Window & { recoveryFixtureRestoreIdb?: () => void }).recoveryFixtureRestoreIdb?.());
        await page.getByLabel("Owner token", { exact: true }).fill(fixture!.token);
        await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
        await expect(input()).toHaveValue("Unsaved page-only draft after abort 中文🙂");
        expect(await page.evaluate(() => performance.timeOrigin)).toBe(pageOrigin);
        expect(postRows()).toHaveLength(posts);
      } finally { await page.evaluate(() => (window as Window & { recoveryFixtureRestoreIdb?: () => void }).recoveryFixtureRestoreIdb?.()); }
    });
    await run("cookie mutation requires CSRF; offline observation never cancels or submits", "csrfOffline", async () => {
      const status = await page.evaluate(async () => (await fetch("/api/conversations", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: "{}" })).status); expect(status).toBe(403);
      const posts = postRows().length;
      await context.setOffline(true); await expect(page.getByText("Offline. Drafts and pending commands have not been cancelled.", { exact: true })).toBeVisible();
      await context.setOffline(false); await expect(input()).toHaveValue("Unsaved page-only draft after abort 中文🙂"); expect(postRows()).toHaveLength(posts);
    });
    await run("recovery dialog opens with Enter and returns focus after Escape at 390 in both themes", "themes390", async () => {
      await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      for (const theme of ["light", "dark"] as const) {
        if (theme === "dark") await page.getByRole("button", { name: "Use dark theme", exact: true }).click();
        const dialog = await openRecovery(page, true); await expect(dialog).toBeVisible();
        const rect = await dialog.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth, width: element.getBoundingClientRect().width })); expect(rect.scroll).toBeLessThanOrEqual(rect.client + 1);
        const png = await page.screenshot(); requireThat(png.length <= 512 * 1024, "Screenshot exceeds its retained budget"); await writeFile(join(init.directory, theme + "-390.png"), png); await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "Saved drafts and receipts", exact: true })).toBeFocused();
      }
    });
    expect(pageErrors).toEqual([]);
  } catch (error) { failure = text(error); }
  finally {
    clearTimeout(deadline); lifetime.abort();
    for (const stop of stopObservers) stop();
    // The supervisor bounds pending startup/close with the owned worker + Chrome groups.
    try { await browser?.close(); } catch (error) { cleanupErrors.push("browser: " + text(error)); }
    try { await fixture?.close(); } catch (error) { cleanupErrors.push("fixture: " + text(error)); }
    if (coverage.materialDraft === "NOT_RUN" && coverage.textIntentDraft === "FAILED") coverage.materialDraft = "NOT_COMPLETED";
    const result: WorkerResult = { checks, pageErrors, failure, cleanupErrors, wire: fixture?.wire ?? [], coverage, bodyLoss };
    const raw = JSON.stringify(result, null, 2); requireThat(Buffer.byteLength(raw) <= 2 * 1024 ** 2, "Browser report exceeds reserved bound");
    await writeFile(join(init.directory, "browser.json"), raw, { mode: 0o600 });
    process.send?.({ kind: "result", result }, () => { process.disconnect(); });
    process.off("SIGTERM", abort); process.off("SIGINT", abort);
  }
}

if (process.argv.includes("--worker")) {
  requireThat(!!process.send, "Worker requires its owning supervisor IPC");
  process.once("message", message => {
    const init = message as Init; requireThat(init.kind === "start", "Invalid worker startup");
    void worker(init).catch(error => { console.error(text(error)); process.exitCode = 1; process.disconnect(); });
  });
} else await supervisor();
