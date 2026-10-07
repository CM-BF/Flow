import { createHash } from "node:crypto";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { readFile, writeFile, readdir, lstat, statfs, mkdir, mkdtemp, rm, appendFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Locator, Page, Request, Response } from "@playwright/test";
import type { RecoveryDatabaseLease, RecoveryWire, RecoverySseTrace, startRecoveryFixture } from "/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-history/apps/web/test/conversation-recovery.fixture";

// Only built-ins are loaded by the parent before fresh admission, monitoring and durable ownership facts.
const root = "/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-history";
// Task presets bind output, phase and selection together; no caller-supplied evidence path.
// The default MSG03 preset preserves its closed-phase guard and historical budget.
const visualAppearance = true;
const taskPreset = { id: "MATURE04-05", evidence: "docs/evidence/wpf-mature04-web-history/browser", runs: "actual",
  phaseId: "CONTEXT-HISTORY-MOUNTED-20261007", totalMs: 90_000, approvalEnv: "FLOW_CONTEXT_HISTORY_BROWSER" } as const;
const evidence = join(root, taskPreset.evidence);
const TOTAL_MS = taskPreset.totalMs, CLEANUP_MS = 30_000, EVIDENCE_BYTES = 9 * 1024 ** 2, LOG_BYTES = 1024 ** 2;
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
sourcePaths.push("apps/web/src/plugin-integration/react.tsx", "apps/web/src/conversation-context/receipts.ts", "apps/web/src/conversations/queue/projection.ts", "apps/web/src/conversations/queue/ConversationQueue.tsx", "apps/web/src/plugin-integration/message-settings.tsx", "apps/web/src/execution-profiles/ExecutionProfilePicker.tsx", "apps/web/src/execution-profiles/execution-profiles.css");
if (visualAppearance) sourcePaths.push("apps/web/src/components/ui/dialog.tsx", "apps/web/src/assistant-ui.css");
sourcePaths.push("apps/web/test/context-history-fixture.ts", "apps/web/test/context-history.browser.ts", "apps/web/src/conversation-context-history/binding.ts", "apps/web/src/conversation-context-history/controller.ts", "apps/web/src/conversation-context-history/ContextHistoryDialog.tsx", "apps/web/src/conversation-context-history/fixture.ts", "apps/web/src/plugin-integration/context-history.tsx");
const journeyGroups = {
  "context-history": ["cookie-no-task", "decoded-read-states", "lazy-detail", "close-late-read", "task-and-visibility", "plugin-revoke", "themes-keyboard", "authority-revoke"],
  full: ["cookieRead", "textIntentDraft", "crossTabCas", "sameKeyTurn", "pageOnlyAuthLoss", "csrfOffline", "themes390"],
  "recovery-chain": ["cookieRead", "textIntentDraft", "crossTabCas", "sameKeyTurn"],
  "page-auth": ["cookieRead", "pageOnlyAuthLoss"],
  "csrf-offline": ["cookieRead", "csrfOffline"],
  appearance: ["cookieRead", "themes390"],
  "connection-choice": ["cookieRead", "connectionChoice"],
  "create-ack-loss": ["cookieRead", "createAckLoss"],
  "created-turn-ack-loss": ["cookieRead", "createdTurnAckLoss"],
  "queue-ack-loss": ["cookieRead", "queueAckLoss"],
  "sse-delivery": ["cookieRead", "sseDelivery"],
  "complete-draft": ["cookieRead", "completeDraft"],
  "steering-recovery": ["cookieRead", "steeringRecovery"],
  "second-center-cycle": ["cookieRead", "secondCenterCycle"],
  "message-settings-app": ["cookieRead", "messageSettingsApp"],
  "message-settings-material-return": ["cookieRead", "messageSettingsMaterialReturn"],
} as const;
type Journey = keyof typeof journeyGroups;
type Group = (typeof journeyGroups)[Journey][number];
const allGroups: readonly Group[] = [...journeyGroups["context-history"],...journeyGroups.full, "connectionChoice", "createAckLoss", "createdTurnAckLoss", "queueAckLoss", "sseDelivery", "completeDraft", "steeringRecovery", "secondCenterCycle", "messageSettingsApp", "messageSettingsMaterialReturn"];
function selectedGroups(journey: unknown): readonly Group[] {
  requireThat(typeof journey === "string" && Object.hasOwn(journeyGroups, journey), "An explicit supported journey is required");
  return journeyGroups[journey as Journey];
}
type FailureReconciliation = { run: string; budgetSha256: string; reviewFile: string; reviewSha256: string };
type Gate = { reconciledFailures?: FailureReconciliation[]; allowRun: true; run: string; journey: Journey; sourceCommit: string; sourceHashes: Record<string, string>; expiresAt: string;
  messageSettingsPhase?: { id: "MSG03-MEMBERSHIP-FIX-20261007"; budgetMs: 120000; spentMs: number; cleanupMs: 30000 };
  visualAppearancePhase?: { id: "CONTEXT-HISTORY-MOUNTED-20261007"; budgetMs: 90000; spentMs: number; cleanupMs: 30000 };
  totalMs: number; minimumFreeBytes: number; scratchParent: string; maxScratchBytes: number;
  twoCenterPhase?: { id: "RECOVERY-TWO-CENTER-20261007"; budgetMs: 90000; spentMs: number; cleanupMs: 30000; databases: 2 } };
type Init = { kind: "start"; journey: Journey; directory: string; scratch: string; databaseUrl: string; secondDatabaseUrl?: string; workDeadline: number };
type WorkerResult = { journey: Journey; requiredGroups: readonly Group[]; completedGroups: Group[]; checks: string[];
  pageErrors: string[]; failure: string | null; cleanupErrors: string[]; coverage: Record<string, string>;
  initialization?: unknown; groupTimings?: unknown };
function selectionPassed(journey: Journey, result: WorkerResult | undefined): boolean {
  const required = selectedGroups(journey);
  return !!result && result.journey === journey && result.failure === null
    && Array.isArray(result.pageErrors) && result.pageErrors.length === 0 && Array.isArray(result.cleanupErrors) && result.cleanupErrors.length === 0
    && JSON.stringify(result.requiredGroups) === JSON.stringify(required) && JSON.stringify(result.completedGroups) === JSON.stringify(required)
    && Array.isArray(result.checks) && result.checks.length === required.length && required.every(key => result.coverage?.[key] === "PASSED");
}
type TailObservation = { phase: string; elapsedMs: number; scratchBytes: number | null; evidenceBytes: number | null; freeBytes: number | null; errors: string[] };

// Admission may acknowledge an independently reviewed failed attempt; its immutable FAIL is never rewritten.
function priorAttemptCharge(run: string, budgetText: string, reconciliation?: FailureReconciliation, reviewText?: string): number {
  const previous = JSON.parse(budgetText);
  requireThat(previous.cleanupComplete === true && Number.isFinite(previous.elapsedMs) && previous.elapsedMs >= 0,
    "Prior attempt lacks confirmed cleanup/accounting");
  if (previous.complete === true) {
    requireThat(!reconciliation, "A settled attempt must not use failure reconciliation");
    return previous.elapsedMs;
  }
  requireThat(previous.complete === false && reconciliation?.run === run && digest(budgetText) === reconciliation.budgetSha256
    && typeof reviewText === "string" && digest(reviewText) === reconciliation.reviewSha256,
    "Prior incomplete attempt requires exact independently accepted reconciliation");
  const review = JSON.parse(reviewText), cleanup = review.cleanup;
  requireThat(review.run === run && review.decision === "ACCEPTED_FAILED_SELECTED_ACTUAL_AND_OWNED_CLEANUP_NOT_CASE_OR_FEATURE_PASS"
    && review.observed?.budgetComplete === false && review.observed?.cleanupComplete === true
    && Number.isInteger(review.actual?.exitCode) && review.actual.exitCode !== 0
    && review.actual.stdoutEof === true && review.actual.stderrEof === true
    && cleanup?.dualEof === true && cleanup.scratchAbsent === true
    && cleanup.database?.confirmed === true && cleanup.database.removed === true && cleanup.database.connections === 0
    && Array.isArray(cleanup.database.remaining) && cleanup.database.remaining.length === 0
    && Array.isArray(cleanup.database.errors) && cleanup.database.errors.length === 0
    && cleanup.fixture?.complete === true && Array.isArray(cleanup.fixture.errors) && cleanup.fixture.errors.length === 0
    && Array.isArray(cleanup.freshOwnedProcessObservations) && cleanup.freshOwnedProcessObservations.length > 0
    && cleanup.freshOwnedProcessObservations.every((value: { process?: string; group?: string }) => value.process === "ESRCH" && value.group === "ESRCH"),
    "Failure reconciliation lacks independently accepted owned cleanup");
  const charge = review.accounting?.chargeMs;
  requireThat(Number.isSafeInteger(charge) && charge >= Math.ceil(previous.elapsedMs)
    && Number.isFinite(review.actual.outerElapsedMs) && review.actual.outerElapsedMs >= 0 && charge >= Math.ceil(review.actual.outerElapsedMs),
    "Failure reconciliation must conservatively charge the failed attempt");
  return charge;
}

async function supervisor() {
  requireThat(process.env[taskPreset.approvalEnv] === "1", "Separate task-specific real browser/PG approval is required");
  const gatePath = process.env.FLOW_RECOVERY_GATE, adminUrl = process.env.FLOW_RECOVERY_TEST_ADMIN;
  requireThat(gatePath && adminUrl, "Fresh explicit gate and isolated PG admin endpoint are required; no discovery/default");
  const gate = JSON.parse(await readFile(gatePath, "utf8")) as Gate;
  if (visualAppearance) {
    requireThat(gate.journey === "context-history" && gate.messageSettingsPhase === undefined,
      "Context history can select only its own fixed journey and phase");
  } else {
    requireThat(["message-settings-app", "message-settings-material-return"].includes(gate.journey) && gate.visualAppearancePhase === undefined,
      "MSG03 owner entry cannot replay historical Recovery journeys or another task phase");
    requireThat(digest(await readFile(join(evidence, "browser-phase.json"))) === "bd32b2d5808ece143ea2d33c2c4c5ba86957e35b2ce790414b86c3ced2051310",
      "Closed original MSG03 phase must remain unchanged; unused credit does not transfer");
  }
  const phase = visualAppearance ? gate.visualAppearancePhase : gate.messageSettingsPhase;
  requireThat(phase?.id === taskPreset.phaseId && phase.budgetMs === TOTAL_MS && phase.cleanupMs === CLEANUP_MS
    && Number.isSafeInteger(phase.spentMs) && phase.spentMs >= 0 && gate.totalMs <= TOTAL_MS - phase.spentMs,
    "Independent task phase with conservative actual outer/late/parent accounting required");
  const requiredGroups = selectedGroups(gate.journey);
  const twoCenter = gate.journey === "second-center-cycle", cleanupMs = twoCenter ? 30_000 : CLEANUP_MS;
  const evidenceLimit = twoCenter ? 13 * 1024 ** 2 : EVIDENCE_BYTES;
  const retainedReserve = twoCenter ? 9 * 1024 ** 2 : RUN_RETAIN_RESERVE;
  const extraResourceBytes = twoCenter ? 133 * 1024 ** 2 : 0, stopFree = STOP_FREE + extraResourceBytes;
  if (twoCenter) {
    const phase = gate.twoCenterPhase;
    requireThat(phase?.id === "RECOVERY-TWO-CENTER-20261007" && phase.budgetMs === 90_000
      && phase.cleanupMs === 30_000 && phase.databases === 2 && Number.isSafeInteger(phase.spentMs) && phase.spentMs >= 0
      && gate.totalMs >= 60_000 && gate.totalMs <= 90_000 - phase.spentMs, "Independent two-center phase and cleanup budget required");
  } else requireThat(gate.twoCenterPhase === undefined, "Two-center admission cannot authorize another journey");
  requireThat(gate.allowRun === true && /^[a-z0-9-]{1,48}$/.test(gate.run), "Invalid one-run gate");
  requireThat(Date.parse(gate.expiresAt) > Date.now(), "Admission expired");
  requireThat(Number.isFinite(gate.totalMs) && gate.totalMs >= 45_000 && gate.totalMs <= 90_000, "Invalid admitted time budget");
  if (gate.journey === "steering-recovery") requireThat(gate.totalMs <= 60_000, "Steering phase requires a <=60s attempt including cleanup");
  requireThat(gate.minimumFreeBytes >= START_FREE + extraResourceBytes && Number.isFinite(gate.minimumFreeBytes), "Browser start margin must be explicitly admitted");
  requireThat(Number.isSafeInteger(gate.maxScratchBytes) && gate.maxScratchBytes > 0 && gate.maxScratchBytes <= 64 * 1024 ** 2, "Scratch requires an explicit <=64MiB bound");
  requireThat(await realpath(gate.scratchParent) === "/private/tmp", "Scratch must use the explicitly admitted local tmp parent");
  const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", timeout: 2000 }).trim();
  requireThat(sourceCommit === gate.sourceCommit, "Source commit differs from admission");
  const sourceHashes = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, digest(await readFile(join(root, path)))])));
  for (const path of sourcePaths) requireThat(sourceHashes[path] === gate.sourceHashes[path], `Admitted source mismatch: ${path}`);
  const dirty = !!execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8", timeout: 2000 }).trim();
  const runs = join(evidence, taskPreset.runs); await mkdir(runs, { recursive: true });
  const reconciliations = gate.reconciledFailures ?? [];
  requireThat(Array.isArray(reconciliations) && reconciliations.length <= 8, "Invalid failure reconciliation list");
  const remainingReconciliations = new Map<string, FailureReconciliation>();
  for (const item of reconciliations) {
    requireThat(item && /^[a-z0-9-]{1,48}$/.test(item.run) && /^[a-z0-9-]+\.json$/.test(item.reviewFile)
      && /^[a-f0-9]{64}$/.test(item.budgetSha256) && /^[a-f0-9]{64}$/.test(item.reviewSha256)
      && !remainingReconciliations.has(item.run), "Invalid or duplicate failure reconciliation");
    remainingReconciliations.set(item.run, item);
  }
  let priorMs = 0;
  for (const name of await readdir(runs)) {
    const reconciliation = remainingReconciliations.get(name);
    const budgetText = await readFile(join(runs, name, "budget.json"), "utf8");
    const reviewText = reconciliation ? await readFile(join(evidence, reconciliation.reviewFile), "utf8") : undefined;
    priorMs += priorAttemptCharge(name, budgetText, reconciliation, reviewText);
    remainingReconciliations.delete(name);
  }
  requireThat(remainingReconciliations.size === 0, "Failure reconciliation refers to an unknown run");
  // Preserve accounting for any run made with the older entry point; never silently start a new budget.
  for (const name of (await readdir(evidence)).filter(name => name.endsWith("-browser-budget.json"))) {
    const previous = JSON.parse(await readFile(join(evidence, name), "utf8"));
    requireThat(previous.endedAt && Number.isFinite(previous.elapsedMs) && previous.cleanupErrors?.length === 0, "Legacy attempt lacks settled cleanup");
    priorMs += previous.elapsedMs;
  }
  requireThat(phase.spentMs >= Math.ceil(priorMs), "Phase accounting cannot undercharge retained attempts");
  priorMs = phase.spentMs; // Includes the independently captured outer terminal; no local/Recovery credit transfers.
  requireThat(priorMs + gate.totalMs <= TOTAL_MS, "Cumulative browser/HTTP budget exhausted");
  requireThat(await freeBytes() >= gate.minimumFreeBytes, "Fresh free space below admitted start threshold");
  requireThat(await treeBytes(evidence) < evidenceLimit - retainedReserve, "Insufficient retained evidence headroom");
  const directory = join(runs, gate.run); await mkdir(directory, { mode: 0o700 }); // Exclusive: never overwrite a run.
  const began = performance.now(), workDeadline = Date.now() + gate.totalMs - cleanupMs;
  const hardAt = began + gate.totalMs;
  const budget = { complete: false, cleanupComplete: false, journey: gate.journey, startedAt: new Date().toISOString(), priorMs, permittedMs: gate.totalMs, cleanupReserveMs: cleanupMs, elapsedMs: 0 };
  writeFileSync(join(directory, "budget.json"), JSON.stringify(budget), { mode: 0o600 });
  const children: ChildProcess[] = [], closed = new Map<ChildProcess, Promise<void>>();
  const errors: string[] = [], cleanupErrors: string[] = [];
  let lease: RecoveryDatabaseLease | undefined, secondLease: RecoveryDatabaseLease | undefined, scratch: string | undefined, result: WorkerResult | undefined;
  let minimumFreeBytes = Infinity, peakScratchBytes = 0, logBytes = 0, stopped = false, chromeRequested = false;
  let stopReason: string | undefined, interruptionRequested = false;
  let monitor: NodeJS.Timeout | undefined, monitoring: Promise<void> | undefined, logs = Promise.resolve();
  let monitorRetiring = false;
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
        databaseState: lease?.state, secondDatabase: secondLease?.database, secondDatabaseState: secondLease?.state, ownedPids: children.map(child => child.pid), cleanupConfirmed: false }), { mode: 0o600 });
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
  const working = () => { requireThat(!stopped && performance.now() < hardAt - cleanupMs, "Work deadline reached; cleanup reserve started"); };
  const checkpoint = async (mode: "work" | "monitor" = "work") => {
    try {
      working();
      const free = await freeBytes(); minimumFreeBytes = Math.min(minimumFreeBytes, free);
      requireThat(free > stopFree, "Free space reached stop margin");
      requireThat(await treeBytes(evidence) <= evidenceLimit - 32 * 1024, "Evidence limit reached");
      if (scratch) { const bytes = await treeBytes(scratch, true); peakScratchBytes = Math.max(peakScratchBytes, bytes); requireThat(bytes <= gate.maxScratchBytes, "Scratch limit reached"); }
      // A timer already in flight still checks resources, but normal cleanup has retired its work guard.
      if (mode === "work" || !monitorRetiring) working();
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
  const databaseCleanups: { target: "A" | "B"; result: Awaited<ReturnType<RecoveryDatabaseLease["close"]>> | null; error: string | null }[] = [];
  try {
    await json(join(directory, "sources.json"), { sourceCommit, dirty, sourceHashes, journey: gate.journey, requiredGroups });
    monitor = setInterval(() => { if (!monitoring) monitoring = checkpoint("monitor").catch(() => {}).finally(() => { monitoring = undefined; }); }, 250);
    await checkpoint(); // Before any Vite/PG/Playwright/business import or CREATE.
    const { RecoveryDatabaseLease } = await import("/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-history/apps/web/test/conversation-recovery.fixture");
    await checkpoint();
    const databaseDirectory = twoCenter ? join(directory, "db-a") : directory;
    if (twoCenter) await mkdir(databaseDirectory, { mode: 0o700 });
    lease = new RecoveryDatabaseLease(adminUrl, databaseDirectory);
    await lease.create(checkpoint);
    if (twoCenter) {
      await checkpoint(); const secondDirectory = join(directory, "db-b"); await mkdir(secondDirectory, { mode: 0o700 });
      secondLease = new RecoveryDatabaseLease(adminUrl, secondDirectory);
      await secondLease.create(checkpoint);
    }
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
    const workerArgs = ["--import", "tsx", fileURLToPath(import.meta.url), "--worker", ...(visualAppearance ? ["--visual-appearance"] : [])];
    await json(join(directory, "launch-config.json"), {
      temp: { TMPDIR: scratch, TMP: scratch, TEMP: scratch, MAC_CHROMIUM_TMPDIR: scratch, BREAKPAD_DUMP_LOCATION: crashpad, XDG_CACHE_HOME: join(scratch, "cache") },
      worker: { executable: process.execPath, argv: workerArgs, inheritsNodeArguments: false },
      chrome: { executable: chromeExecutable, argv: chromeArgs },
    }); // Deliberate whitelist: never serialize inherited environment or credential-bearing arguments.
    const worker = own(spawn(process.execPath, workerArgs, { cwd: root, detached: true,
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
    working(); worker.send({ kind: "start", journey: gate.journey, directory, scratch, databaseUrl: lease.url, ...(secondLease ? { secondDatabaseUrl: secondLease.url } : {}), workDeadline } satisfies Init);
    while (worker.exitCode === null && worker.signalCode === null && !stopped) { await sleep(30); working(); }
    if (!result) errors.push("Worker did not return a complete result");
  } catch (error) { errors.push(text(error)); }
  finally {
    monitorRetiring = true; stopped = true; if (monitor) clearInterval(monitor); await monitoring;
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
    // Each lease has its own durable ownership/cleanup directory. B startup or cleanup never skips A.
    const ownedDatabases = [{ target: "A" as const, lease }, { target: "B" as const, lease: secondLease }].filter(item => item.lease);
    await Promise.allSettled(ownedDatabases.map(async item => {
      try {
        const result = await item.lease!.close(hardAt);
        if (item.target === "A") databaseCleanup = result;
        databaseCleanups.push({ target: item.target, result, error: null }); cleanupErrors.push(...result.errors);
      } catch (error) {
        const message = "Database " + item.target + " cleanup: " + text(error);
        databaseCleanups.push({ target: item.target, result: null, error: message }); cleanupErrors.push(message);
        try { await json(join(twoCenter ? join(directory, item.target === "A" ? "db-a" : "db-b") : directory, "cleanup-error.json"), { error: message, confirmed: false }); }
        catch (failure) { cleanupErrors.push("Database failure receipt: " + text(failure)); }
      }
    }));
    const terminal: TailObservation[] = [];
    const observeTail = async (phase: string, includeScratch = false, reserveBytes = 0): Promise<TailObservation> => {
      const observation: TailObservation = { phase, elapsedMs: 0, scratchBytes: null, evidenceBytes: null, freeBytes: null, errors: [] };
      const failed = (message: string) => { observation.errors.push(message); errors.push(`${phase}: ${message}`); };
      try {
        observation.freeBytes = await freeBytes(); minimumFreeBytes = Math.min(minimumFreeBytes, observation.freeBytes);
        if (observation.freeBytes <= stopFree) failed("Free space reached stop margin");
      } catch (error) { failed("Free-space accounting: " + text(error)); }
      try {
        observation.evidenceBytes = await treeBytes(evidence);
        if (observation.evidenceBytes > evidenceLimit - reserveBytes) failed("Retained evidence limit reached");
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
    if (!selectionPassed(gate.journey, result)) errors.push("The selected journey did not complete every required group");
    const persistReports = async (complete: boolean) => {
      const elapsedMs = performance.now() - began;
      Object.assign(budget, { complete, cleanupComplete: allOwnedGroupsAbsent && scratchRemoved && cleanupErrors.length === 0, elapsedMs });
      const passed = complete && stopReason === undefined && !interruptionRequested && allOwnedGroupsAbsent && scratchRemoved && selectionPassed(gate.journey, result) && !errors.length && !cleanupErrors.length && elapsedMs <= gate.totalMs && priorMs + elapsedMs <= TOTAL_MS;
      await json(join(directory, "supervisor.json"), { passed, selectedPassed: passed, fullJourneyPassed: passed && gate.journey === "full",
        journey: gate.journey, requiredGroups, completedGroups: result?.completedGroups ?? [],
        initialization: result?.initialization ?? null, groupTimings: result?.groupTimings ?? null,
        acceptanceScope: gate.journey === "full" ? "original seven-group subset; not full feature approval" : "selected journey only; full journey remains unverified",
        errors, cleanupErrors, databaseCleanup, task: taskPreset.id, ...(visualAppearance ? { visualAppearancePhase: phase } : { messageSettingsPhase: phase }), ...(twoCenter ? { databaseCleanups, twoCenterPhase: gate.twoCenterPhase } : {}), processIds: children.map(child => ({ pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode })),
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
      console.log(JSON.stringify({ kind: "recovery-final-accounting", directory, journey: gate.journey, requiredGroups, completedGroups: result?.completedGroups ?? [], postWrite, stopReason, interruptionRequested, errors, cleanupErrors, allOwnedGroupsAbsent, scratchRemoved }));
      clearTimeout(hardStop); process.off("SIGINT", interrupted); process.off("SIGTERM", interrupted);
    }
    if (stopReason !== undefined || interruptionRequested || !result || errors.length || cleanupErrors.length || !allOwnedGroupsAbsent || !scratchRemoved || performance.now() > hardAt || priorMs + performance.now() - began > TOTAL_MS) process.exitCode = 1;
  }
}

async function worker(init: Init) {
  const lifetime = new AbortController(); const abort = () => lifetime.abort();
  process.on("SIGTERM", abort); process.on("SIGINT", abort);
  const deadline = setTimeout(abort, Math.max(1, init.workDeadline - Date.now()));
  const checkpoint = async () => { lifetime.signal.throwIfAborted(); requireThat(Date.now() < init.workDeadline, "Work deadline"); };
  let browser: Browser | undefined, failure: string | null = null;
  const cleanupErrors: string[] = [];
  try {
    const { chromium } = await import("/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-history/node_modules/@playwright/test/index.mjs"); await checkpoint();
    const endpoint = await new Promise<string>((resolve, reject) => {
      const onMessage = (value: unknown) => {
        if (value && typeof value === "object" && "kind" in value && value.kind === "chrome-ready" && "endpoint" in value && typeof value.endpoint === "string") {
          process.off("message", onMessage); lifetime.signal.removeEventListener("abort", aborted); resolve(value.endpoint);
        }
      };
      const aborted = () => { process.off("message", onMessage); reject(Error("Owned Chrome startup aborted")); };
      process.on("message", onMessage); lifetime.signal.addEventListener("abort", aborted, { once: true });
      lifetime.signal.throwIfAborted(); process.send?.({ kind: "chrome" });
    });
    browser = await chromium.connectOverCDP(endpoint, { timeout: Math.max(1, Math.min(4000, init.workDeadline - Date.now())) });
    const { runContextHistoryBrowser } = await import("/Users/citrine/Projects/AgentHarness/Flow-worktrees/web-context-history/apps/web/test/context-history.browser.ts");
    await runContextHistoryBrowser(browser, { databaseUrl: init.databaseUrl, directory: init.directory, cacheDirectory: join(init.scratch, "vite"), checkpoint }, lifetime.signal);
  } catch (error) { failure = text(error); }
  finally {
    clearTimeout(deadline); lifetime.abort();
    try { await browser?.close(); } catch { cleanupErrors.push("CDP disconnect failed"); }
    let observed: { checks: Group[]; pageErrors: string[]; cleanupErrors: string[]; failure: string | null; passed: boolean } | undefined;
    try { observed = JSON.parse(await readFile(join(init.directory, "context-browser.json"), "utf8")); } catch { failure ??= "Missing complete context browser result"; }
    if (!observed?.passed) failure ??= observed?.failure ?? "Context browser did not pass";
    cleanupErrors.push(...observed?.cleanupErrors ?? []);
    const requiredGroups = selectedGroups(init.journey), completedGroups = observed?.checks ?? [];
    const result: WorkerResult = { journey: init.journey, requiredGroups, completedGroups, checks: completedGroups,
      failure, pageErrors: observed?.pageErrors ?? [], cleanupErrors,
      coverage: Object.fromEntries(requiredGroups.map(group => [group, completedGroups.includes(group) ? "PASSED" : "NOT_COMPLETED"])) };
    await json(join(init.directory, "browser.json"), result);
    process.send?.({ kind: "result", result }, () => { process.disconnect(); });
    process.off("SIGTERM", abort); process.off("SIGINT", abort);
  }
}
if (process.argv.includes("--worker")) {
  requireThat(!!process.send, "Worker requires its owning supervisor IPC");
  process.once("message", message => { const init = message as Init; requireThat(init.kind === "start", "Invalid worker startup");
    void worker(init).catch(error => { console.error(text(error)); process.exitCode = 1; process.disconnect(); }); });
} else await supervisor();
