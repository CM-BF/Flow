import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile, readdir, lstat, statfs, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Page } from "@playwright/test";
import type { ConversationTurnAccepted, ConversationQueueAccepted } from "../../../packages/contracts/src/index.js";
import type { CurrentPreview, Wire } from "./web-current-preview.fixture.js";

// Built-ins only until a one-run admission is validated and the attempt is durably recorded.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const evidence = join(root, "docs/evidence/wpf-release03");
const BACKEND = "362af3bac77541e5a60979326bcf4d4b8c947915";
const ARTIFACT = "d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88";
const MAX_TOTAL_MS = 180_000, CLEANUP_MS = 20_000, EVIDENCE_BYTES = 8 * 1024 * 1024;
const digest = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
async function json(path: string, value: unknown) { await writeFile(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 }); }
async function bytesUnder(path: string): Promise<number> {
  let total = 0;
  for (const name of await readdir(path)) {
    if (name === "scratch") continue; // Ephemeral Chrome profile is measured separately, then removed; never retained evidence.
    const child = join(path, name), info = await lstat(child);
    assert.ok(!info.isSymbolicLink(), "Evidence must not follow external symlinks");
    total += info.isDirectory() ? await bytesUnder(child) : info.size;
  }
  return total;
}
async function freeBytes() { const value = await statfs(root); return value.bavail * value.bsize; }
type Gate = { allowRun: true; backend: string; artifactId: string; run: string; expiresAt: string; totalMs: number; minimumFreeBytes: number };
type Init = { kind: "start"; directory: string; databaseUrl: string; token: string; workDeadline: number };
type Observations = Record<string, Record<string, boolean>>;
type WorkerResult = { passed: boolean; history: unknown[]; app: { passed: boolean; observations?: Observations; error?: string }; errors: string[]; cleanupErrors: string[] };

/** Own process groups include Chrome, started by the supervisor rather than an untracked launch promise. */
async function supervisor() {
  const gatePath = process.env.FLOW_RELEASE03_GATE;
  assert.ok(gatePath, "An explicit future run admission is required; source preparation is not permission to execute");
  const gate = JSON.parse(await readFile(gatePath, "utf8")) as Gate;
  assert.equal(gate.allowRun, true); assert.equal(gate.backend, BACKEND); assert.equal(gate.artifactId, ARTIFACT);
  assert.match(gate.run, /^[a-z0-9-]{1,48}$/); assert.ok(Date.parse(gate.expiresAt) > Date.now());
  assert.ok(gate.totalMs > CLEANUP_MS && gate.totalMs <= MAX_TOTAL_MS);
  assert.ok(gate.minimumFreeBytes >= 1024 ** 3 + 128 * 1024 ** 2, "Admission must retain at least the agreed resource margin");
  await mkdir(evidence, { recursive: true });
  const runs = join(evidence, "runs"); await mkdir(runs, { recursive: true, mode: 0o700 });
  let spent = 0;
  for (const name of await readdir(runs)) {
    const ended = JSON.parse(await readFile(join(runs, name, "budget.json"), "utf8"));
    assert.equal(ended.complete, true, "An earlier attempt needs cleanup/accounting before another run");
    spent += ended.elapsedMs;
  }
  assert.ok(spent + gate.totalMs <= MAX_TOTAL_MS, "Cumulative runtime budget exhausted");
  const directory = join(runs, gate.run); await mkdir(directory, { mode: 0o700 }); // Existing run names never overwrite raw evidence.
  const started = Date.now(); const workDeadline = started + gate.totalMs - CLEANUP_MS;
  const hardDeadline = started + gate.totalMs;
  const budget = { complete: false, startedAt: new Date(started).toISOString(), elapsedMs: 0, previousMs: spent, permittedMs: gate.totalMs };
  await json(join(directory, "budget.json"), budget);
  const cleanupErrors: string[] = [], errors: string[] = [];
  const children: ChildProcess[] = []; const exited = new Map<ChildProcess, Promise<void>>();
  let logBytes = 0, minimumFree = Number.POSITIVE_INFINITY, monitorBusy = false, monitor: NodeJS.Timeout | undefined;
  let result: WorkerResult | undefined; let databaseCreated = false, databaseCreateAttempted = false, markerWritten = false;
  let chromeStarting = false; let workStopped = false;
  const databaseName = `flow_release03_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  const marker = randomUUID();
  const hardStop = setTimeout(() => {
    for (const child of children) if (child.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch { /* Still preserve incomplete cleanup below. */ } }
    // Fail closed even if an external cleanup promise stops settling. The unfinished budget prevents a rerun.
    writeFileSync(join(directory, "hard-stop.json"), JSON.stringify({ at: new Date().toISOString(), databaseName, marker,
      databaseCreateAttempted, databaseCreated, markerWritten, ownedPids: children.map(child => child.pid), cleanupConfirmed: false }), { mode: 0o600 });
    process.exit(1);
  }, Math.max(0, hardDeadline - Date.now()));
  // Dedicated local fixture PG only. Never read personal credentials or reuse a product database.
  const adminUrl = "postgresql://flow:flow-local-only@127.0.0.1:55432/postgres";
  const database = new URL(adminUrl); database.pathname = `/${databaseName}`;
  const logPath = join(directory, "process.log"); await writeFile(logPath, "", { mode: 0o600 });
  let logWrites = Promise.resolve();
  const stopWork = (reason: string) => {
    if (!workStopped) errors.push(reason); workStopped = true;
    for (const child of children) if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") cleanupErrors.push(errorText(error)); } }
  };
  const onSignal = () => stopWork("Supervisor interrupted");
  process.once("SIGTERM", onSignal); process.once("SIGINT", onSignal);
  const own = (child: ChildProcess) => {
    children.push(child);
    exited.set(child, new Promise(resolve => { child.once("close", () => resolve()); child.once("error", error => { errors.push(errorText(error)); resolve(); }); }));
    for (const stream of [child.stdout, child.stderr]) stream?.on("data", (chunk: Buffer) => {
      logBytes += chunk.length;
      if (logBytes > 1024 * 1024) { stopWork("Process logs exceeded 1 MiB"); return; }
      logWrites = logWrites.then(() => import("node:fs/promises").then(fs => fs.appendFile(logPath, chunk))).catch(error => stopWork(errorText(error)));
    });
    return child;
  };
  let Pool: typeof import("pg").Pool | undefined;
  const query = async (url: string, action: (pool: import("pg").Pool) => Promise<void>) => {
    assert.ok(Pool); const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 1000, query_timeout: 2000, statement_timeout: 1500 });
    try { await action(pool); } finally { await pool.end(); }
  };
  try {
    minimumFree = await freeBytes(); assert.ok(minimumFree >= gate.minimumFreeBytes, "Free space below admitted start threshold");
    const fixture = await import("./web-current-preview.fixture.js");
    await json(join(directory, "sources.json"), await fixture.sourceIdentity());
    ({ Pool } = await import("pg"));
    await json(join(directory, "database-owner.json"), { databaseName, marker, backend: BACKEND });
    databaseCreateAttempted = true;
    await query(adminUrl, async pool => { await pool.query(`CREATE DATABASE "${databaseName}"`); databaseCreated = true; });
    await query(database.href, async pool => {
      await pool.query("CREATE TABLE public.release_fixture_owner(id uuid PRIMARY KEY)");
      await pool.query("INSERT INTO public.release_fixture_owner VALUES($1)", [marker]); markerWritten = true;
    });
    const scratch = join(directory, "scratch"); await mkdir(scratch, { mode: 0o700 });
    const worker = own(spawn(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url), "--worker"], {
      cwd: root, detached: true, stdio: ["ignore", "pipe", "pipe", "ipc"],
      env: { ...process.env, TSX_DISABLE_CACHE: "1", TMPDIR: scratch, TMP: scratch, TEMP: scratch },
    }));
    worker.on("message", message => {
      const data = message as { kind?: string; result?: WorkerResult };
      if (data.kind === "result") result = data.result;
      if (data.kind === "chrome" && !chromeStarting) {
        chromeStarting = true;
        void (async () => {
          assert.ok(!workStopped && Date.now() < workDeadline);
          const profile = join(scratch, "chrome"); await mkdir(profile, { mode: 0o700 });
          const chrome = own(spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--remote-debugging-port=0",
            "--remote-debugging-address=127.0.0.1", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
            "--disable-background-networking", "--disable-component-update", "--disable-sync", "about:blank"],
          { detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, TMPDIR: scratch, TMP: scratch, TEMP: scratch } }));
          let port = "";
          while (!port && !workStopped && Date.now() < workDeadline) {
            assert.equal(chrome.exitCode, null, "Owned Chrome exited during startup");
            try { port = (await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0] ?? ""; }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
            if (!port) await sleep(30);
          }
          assert.match(port, /^\d+$/); assert.ok(!workStopped && Date.now() < workDeadline);
          if (worker.connected) worker.send({ kind: "chrome-ready", endpoint: `http://127.0.0.1:${port}` });
        })().catch(error => stopWork(`Chrome startup: ${errorText(error)}`));
      }
    });
    worker.send({ kind: "start", directory, databaseUrl: database.href, token: `release03-${randomUUID()}`, workDeadline } satisfies Init);
    monitor = setInterval(() => {
      if (monitorBusy) return; monitorBusy = true;
      void (async () => {
        const free = await freeBytes(); minimumFree = Math.min(minimumFree, free);
        if (free <= 1024 ** 3 + 64 * 1024 ** 2) stopWork("Free space reached stop margin");
        if (await bytesUnder(evidence) > EVIDENCE_BYTES) stopWork("Evidence exceeded 8 MiB");
        if (Date.now() >= workDeadline) stopWork("Work deadline reached; cleanup reserve started");
      })().catch(error => stopWork(`Resource monitor failed: ${errorText(error)}`)).finally(() => { monitorBusy = false; });
    }, 250);
    while (worker.exitCode === null && worker.signalCode === null && !workStopped && Date.now() < workDeadline) await sleep(50);
    if (!result) errors.push("Worker did not return a complete result");
  } catch (error) { errors.push(errorText(error)); }
  finally {
    if (monitor) clearInterval(monitor);
    // Signals apply to the exact detached children we created, including Chrome's process group.
    for (const child of children) if (child.pid) { try { process.kill(-child.pid, "SIGTERM"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") cleanupErrors.push(errorText(error)); } }
    const grace = Math.min(Date.now() + 3000, hardDeadline - 12_000);
    while (Date.now() < grace && children.some(child => child.exitCode === null && child.signalCode === null)) await sleep(30);
    for (const child of children) if (child.pid) {
      try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") cleanupErrors.push(errorText(error)); }
    }
    for (const child of children) {
      await Promise.race([exited.get(child), sleep(Math.max(0, Math.min(1000, hardDeadline - Date.now())))]);
      if (child.exitCode === null && child.signalCode === null) cleanupErrors.push(`Owned PID ${child.pid} exit unconfirmed`);
      if (child.pid) { try { process.kill(-child.pid, 0); cleanupErrors.push(`Owned process group ${child.pid} remains`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") cleanupErrors.push(errorText(error)); } }
    }
    let databaseRemoved = false;
    if (databaseCreateAttempted && !databaseCreated) cleanupErrors.push("CREATE outcome unknown; database owner record retained for explicit inspection");
    if (databaseCreated) {
      try {
        assert.ok(markerWritten, "Marker not confirmed; retain database for explicit recovery");
        assert.ok(Date.now() < hardDeadline - 7000, "Insufficient cleanup time to verify and drop database");
        await query(database.href, async pool => { assert.deepEqual((await pool.query("SELECT id FROM public.release_fixture_owner")).rows, [{ id: marker }]); });
        await query(adminUrl, async pool => {
          await pool.query(`DROP DATABASE "${databaseName}"`); // No FORCE/termination of unknown sessions.
          databaseRemoved = (await pool.query("SELECT datname FROM pg_database WHERE datname=$1", [databaseName])).rowCount === 0;
          assert.ok(databaseRemoved);
        });
      } catch (error) { cleanupErrors.push(errorText(error)); }
    }
    if (!cleanupErrors.some(error => /process group|exit unconfirmed/.test(error))) {
      try { await rm(join(directory, "scratch"), { recursive: true, force: true }); } catch (error) { cleanupErrors.push(errorText(error)); }
    }
    await logWrites;
    const cleanup = { databaseName, databaseCreateAttempted, databaseCreated, markerWritten, databaseRemoved, errors: cleanupErrors,
      processIds: children.map(child => ({ pid: child.pid, exitCode: child.exitCode, signalCode: child.signalCode })), finishedAt: new Date().toISOString() };
    await json(join(directory, "cleanup.json"), cleanup);
    if (await bytesUnder(evidence) > EVIDENCE_BYTES - 32 * 1024) errors.push("Insufficient evidence headroom for final report");
    await json(join(directory, "supervisor.json"), { checksAndCleanupPassed: !!result?.passed && !errors.length && !cleanupErrors.length,
      result, errors, cleanup, minimumFreeBytes: minimumFree, freeAtEnd: await freeBytes(), attribution: "Shared filesystem observations; not exclusively attributable to this run", providerQueries: 0 });
    process.off("SIGTERM", onSignal); process.off("SIGINT", onSignal);
  }
  // A valid SVC attestation is gated by BOTH native history cases, actual App checks, and completed cleanup.
  let compatibilityId: string | null = null;
  try { if (result?.passed && !errors.length && !cleanupErrors.length && result.app.observations) {
    const fixture = await import("./web-current-preview.fixture.js");
    const reportDirectory = join(directory, "compatibility"); await mkdir(reportDirectory, { mode: 0o700 });
    const checks: Record<string, string> = {};
    for (const [check, observations] of Object.entries(result.app.observations)) {
      assert.ok(Object.values(observations).every(value => value === true));
      const raw = JSON.stringify({ format: 1, check, backendHead: BACKEND, artifactId: ARTIFACT, observations });
      checks[check] = digest(raw); await writeFile(join(reportDirectory, `${check}.json`), raw, { mode: 0o600 });
    }
    await writeFile(join(reportDirectory, "report.json"), JSON.stringify({ format: 1, policy: "flow-web-api-v1", backendHead: BACKEND, artifact: fixture.artifact, checks }), { mode: 0o600 });
    const store = join(directory, "verified-reports"); await mkdir(store, { mode: 0o700 });
    const { importWebCompatibility, verifyWebCompatibility } = await fixture.loadTool("web-release.mjs");
    compatibilityId = await importWebCompatibility({ directory: await realpath(store), reportDirectory });
    await verifyWebCompatibility({ directory: store, artifact: fixture.artifact, backendHead: BACKEND, compatibilityId });
    await json(join(directory, "compatibility-id.json"), { compatibilityId, backend: BACKEND, artifact: fixture.artifact });
  } else process.exitCode = 1;
  } catch (error) { errors.push(`Compatibility import: ${errorText(error)}`); process.exitCode = 1; }
  // Report import/verification is part of the same measured attempt, not an uncounted epilogue.
  await json(join(directory, "outcome.json"), { passed: !!compatibilityId && !errors.length && !cleanupErrors.length,
    compatibilityId, errors, cleanupErrors, backend: BACKEND, artifactId: ARTIFACT });
  Object.assign(budget, { complete: true, elapsedMs: Date.now() - started });
  await json(join(directory, "budget.json"), budget); clearTimeout(hardStop);
}

const input = (page: Page) => page.getByRole("textbox", { name: "Message input", exact: true }).filter({ visible: true });
const decoded = <T,>(wire: Wire) => JSON.parse(wire.responseBody ?? "null") as T;
async function actualApp(fixture: CurrentPreview, browser: Browser, directory: string, signal: AbortSignal) {
  const { expect } = await import("@playwright/test");
  const { createMaterials, syntheticRunner, until, sha } = await import("./web-current-preview.fixture.js");
  const { assertConversationContextMatches, decodeConversationTurnAccepted } = await import("../../../packages/client/src/index.js");
  const { conversationTurnSchema } = await import("../../../packages/contracts/src/index.js");
  const wireStart = fixture.wire.length;
  const runner = await syntheticRunner(fixture, "app", signal);
  const material = await createMaterials(fixture, "RELEASE03 App", signal);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const page = await context.newPage(); page.setDefaultTimeout(6000); page.setDefaultNavigationTimeout(8000);
  const pageErrors: string[] = [], consoleErrors: Array<{ text: string; url: string }> = [];
  const loadedAssets: Array<{ path: string; sha256: string }> = [], assetReads: Promise<void>[] = [];
  const checks: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push({ text: message.text(), url: message.location().url }); });
  page.on("response", response => {
    const path = new URL(response.url()).pathname;
    if (response.status() === 200 && /\.(js|css)$/.test(path)) assetReads.push(response.body().then(bytes => { loadedAssets.push({ path, sha256: sha(bytes) }); })
      .catch(error => { pageErrors.push(`Asset capture: ${errorText(error)}`); }));
  });
  const posts = (pattern: RegExp) => fixture.wire.slice(wireStart).filter(row => row.method === "POST" && pattern.test(row.path));
  const connect = async () => {
    await page.goto(fixture.url, { waitUntil: "domcontentloaded" });
    await page.getByLabel("Owner token", { exact: true }).fill(fixture.token);
    await page.getByRole("button", { name: "Connect workspace", exact: true }).click(); await expect(input(page)).toBeVisible();
  };
  const profile = async () => {
    await page.getByRole("button", { name: "Execution profile: Runner default", exact: true }).filter({ visible: true }).click();
    await page.getByRole("dialog", { name: "Execution profile", exact: true }).getByRole("radio", { name: /release-synthetic-app/ }).check();
    await page.keyboard.press("Escape");
  };
  const chooseFile = async () => {
    await page.getByRole("button", { name: "Files", exact: true }).filter({ visible: true }).click();
    const dialog = page.getByRole("dialog", { name: "Project text files", exact: true });
    await dialog.getByRole("button", { name: "Browse files", exact: true }).click();
    await dialog.getByRole("button", { name: "Use existing.txt", exact: true }).click(); await page.keyboard.press("Escape");
    await expect(page.locator(".aui-composer-attachments .aui-attachment-root").filter({ visible: true })).toHaveCount(1);
  };
  try {
    await connect(); await profile();
    const index = fixture.manifest.files.find((file: { path: string }) => file.path === "index.html");
    assert.equal(sha(Buffer.from(await (await fetch(fixture.url, { signal })).arrayBuffer())), index.sha256);
    await input(page).fill("RELEASE03 plain v1"); await page.getByRole("button", { name: "Send message", exact: true }).filter({ visible: true }).click();
    const plain = (await until(async () => posts(/\/turns$/), rows => rows.length >= 1, signal))[0]!;
    assert.equal(Object.hasOwn(JSON.parse(plain.body), "attachments"), false); assert.equal(Object.hasOwn(JSON.parse(plain.body), "knowledge"), false);
    const plainAck = decoded<ConversationTurnAccepted>(plain); assert.ok(!plainAck.turn.context || plainAck.turn.context.templateVersion === 1);
    const plainTask = await runner.claim(plainAck.turn.task.id);
    await runner.report(plainTask, 1, { type: "session", nativeSessionId: randomUUID(), adapterVersion: runner.configuration.adapterVersion });
    await runner.report(plainTask, 2, { type: "completed", outcome: "succeeded" });
    checks.push("Real plain Send omits both material fields and uses the legacy receipt path");
    await page.locator('.flow-workspace-bar button[aria-label="New chat"]').click(); await profile();
    const text = "RELEASE03 fixed attachment", nextDraft = "Independent draft after lost ACK";
    await input(page).fill(text); await page.getByRole("button", { name: "Knowledge", exact: true }).filter({ visible: true }).click();
    const knowledge = page.getByRole("dialog", { name: "Conversation knowledge", exact: true });
    await knowledge.getByLabel("Conversation project").selectOption(material.projectId);
    await knowledge.getByRole("button", { name: "Prepare conversation in project", exact: true }).click();
    await expect(knowledge).toContainText("Conversation project locked"); await page.keyboard.press("Escape");
    await expect(input(page)).toHaveValue(text); await chooseFile();
    fixture.loseNext("turn"); await page.getByRole("button", { name: "Send message", exact: true }).filter({ visible: true }).click();
    await expect(input(page)).toHaveValue(""); await input(page).fill(nextDraft);
    await expect(page.getByRole("region", { name: "Message receipt", exact: true })).toContainText("Receipt unknown");
    const first = posts(/\/turns$/).at(-1)!; assert.ok(first.dropped); assert.deepEqual(JSON.parse(first.body).attachments, [material.ref]);
    const accepted = decoded<ConversationTurnAccepted>(first), conversationId = accepted.conversation.id, taskId = accepted.turn.task.id;
    decodeConversationTurnAccepted(accepted, conversationId, conversationTurnSchema.parse(JSON.parse(first.body)));
    assert.equal(accepted.turn.context?.templateVersion, 2);
    const running = await runner.claim(taskId);
    await runner.report(running, 1, { type: "session", nativeSessionId: randomUUID(), adapterVersion: runner.configuration.adapterVersion });
    await page.getByRole("button", { name: "Retry same message", exact: true }).click();
    await expect(page.getByRole("region", { name: "Message receipt", exact: true })).toHaveCount(0); await expect(input(page)).toHaveValue(nextDraft);
    const sameTurnPosts = posts(/\/turns$/).filter(row => row.path === first.path); assert.equal(sameTurnPosts.length, 2);
    const retry = sameTurnPosts[1]!; const retried = decoded<ConversationTurnAccepted>(retry);
    assert.equal(retry.key, first.key); assert.equal(retry.body, first.body); assert.equal(retried.turn.id, accepted.turn.id); assert.equal(retried.replayed, true);
    checks.push("Real v2 lost successful ACK retries the same key/body/turn; next draft survives");
    await chooseFile(); await page.getByRole("radio", { name: "Queue next", exact: true }).filter({ visible: true }).check();
    await input(page).fill("Queue fixed attachment"); fixture.loseNext("queue"); await input(page).press("Enter");
    await expect(page.getByRole("region", { name: "enqueue receipt", exact: true })).toContainText("Receipt unknown");
    const queued = posts(/\/queue$/).at(-1)!; assert.ok(queued.dropped); await input(page).fill("Independent queue draft");
    await page.getByRole("button", { name: "Retry same enqueue", exact: true }).click();
    await expect(page.getByRole("region", { name: "enqueue receipt", exact: true })).toContainText("accepted");
    const queueRetry = posts(/\/queue$/).at(-1)!; const queueAck = decoded<ConversationQueueAccepted>(queueRetry);
    assert.equal(queueRetry.key, queued.key); assert.equal(queueRetry.body, queued.body);
    assert.equal(queueAck.item.id, decoded<ConversationQueueAccepted>(queued).item.id); assert.equal(queueAck.item.context?.templateVersion, 2);
    assertConversationContextMatches(undefined, queueAck.item.context, { projectId: material.projectId, attachments: [material.ref] });
    assert.equal(posts(/\/cancel$/).length, 0); await expect(input(page)).toHaveValue("Independent queue draft");
    checks.push("Queue Enter preserves v2 references and same-key recovery without cancelling the running task");
    const negotiated = (await until(async () => fixture.wire, rows => rows.some(row => row.path === `/api/conversations/${conversationId}` && row.forwardedStream === "patch-v1"), signal))
      .find(row => row.path === `/api/conversations/${conversationId}` && row.forwardedStream === "patch-v1")!;
    await page.screenshot({ path: join(directory, "app-light.png") });
    await page.getByRole("button", { name: "Use dark theme", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(directory, "app-dark-390.png") });
    fixture.setLegacy(true); await page.setViewportSize({ width: 1280, height: 800 }); await connect();
    const chats = page.getByRole("button", { name: "Chats", exact: true }); if (!/\bactive\b/.test(await chats.getAttribute("class") ?? "")) await chats.click();
    await page.getByRole("navigation", { name: "Conversations", exact: true }).getByRole("button", { name: text, exact: true }).click();
    const legacy = (await until(async () => fixture.wire, rows => rows.some(row => row.path === `/api/conversations/${conversationId}` && row.forwardedStream === null), signal))
      .find(row => row.path === `/api/conversations/${conversationId}` && row.forwardedStream === null)!;
    const supplemental = await page.evaluate(async ({ token, id, profileId }) => {
      const denied = await fetch(`/api/conversations/${id}`);
      const profiles = await fetch("/api/execution-profiles", { headers: { authorization: `Bearer ${token}`, "X-Flow-Execution-Profile": "steering-v1" } });
      const body = await profiles.json(); return { denied: denied.status, status: profiles.status, found: body.profiles.some((item: { reference: { id: string } }) => item.reference.id === profileId) };
    }, { token: fixture.token, id: conversationId, profileId: runner.profile.reference.id });
    await Promise.all(assetReads); assert.deepEqual(pageErrors, []);
    const permittedErrors = consoleErrors.every(error => {
      const path = error.url ? new URL(error.url).pathname : "";
      return fixture.wire.some(row => row.path === path && row.dropped) && /ERR_EMPTY_RESPONSE|ERR_FAILED/.test(error.text)
        || path === `/api/conversations/${conversationId}` && /401/.test(error.text) || path === "/favicon.ico" && /404/.test(error.text);
    });
    assert.ok(permittedErrors, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`);
    for (const asset of loadedAssets) {
      const prefix = `/__flow_releases/${fixture.manifest.releaseId}/`; assert.ok(asset.path.startsWith(prefix));
      assert.equal(asset.sha256, fixture.manifest.files.find((file: { path: string }) => file.path === asset.path.slice(prefix.length))?.sha256);
    }
    assert.ok(loadedAssets.some(file => file.path.endsWith(".js"))); assert.ok(loadedAssets.some(file => file.path.endsWith(".css")));
    const legacyBody = JSON.parse(legacy.responseBody!), negotiatedBody = JSON.parse(negotiated.responseBody!);
    const observations: Observations = {
      read: { ownerAuthenticated: supplemental.denied === 401, conversationBound: legacyBody.conversation.id === conversationId, taskBound: legacyBody.lastTurn.task.id === taskId },
      send: { acceptedTurnBound: accepted.turn.conversationId === conversationId && accepted.turn.user.text === text,
        requestedProfilePreserved: JSON.stringify(accepted.conversation.executionProfile) === JSON.stringify(runner.profile.reference) },
      recover: { sameKey: first.key === retry.key, sameBody: first.body === retry.body, sameTurn: accepted.turn.id === retried.turn.id },
      negotiation: { legacyReadable: legacyBody.capabilities.liveAssistantText === false, streamHeaderHandled: negotiatedBody.capabilities.liveAssistantText === true,
        profileHeaderHandled: supplemental.status === 200 && supplemental.found },
    };
    assert.ok(Object.values(observations).every(values => Object.values(values).every(Boolean)));
    const result = { passed: true, checks, observations, pageErrors, consoleErrors, loadedAssets };
    await json(join(directory, "app.json"), result); return result;
  } catch (error) {
    await page.screenshot({ path: join(directory, "app-failure.png") }).catch(() => {});
    const result = { passed: false, checks, error: errorText(error), pageErrors, consoleErrors, loadedAssets };
    await json(join(directory, "app.json"), result); return result;
  } finally { await context.close(); }
}

async function worker() {
  const init = await new Promise<Init>(resolve => process.once("message", message => resolve(message as Init))); assert.equal(init.kind, "start");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(Error("Work deadline")), Math.max(0, init.workDeadline - Date.now()));
  process.once("SIGTERM", () => controller.abort(Error("Supervisor requested cleanup")));
  let fixture: CurrentPreview | undefined, browser: Browser | undefined;
  const result: WorkerResult = { passed: false, history: [], app: { passed: false, error: "Not run" }, errors: [], cleanupErrors: [] };
  try {
    const api = await import("./web-current-preview.fixture.js");
    fixture = await api.startCurrentPreview(init.databaseUrl, init.token, controller.signal);
    for (const mixed of [false, true]) {
      controller.signal.throwIfAborted(); result.history.push(await api.checkHistory(fixture, mixed, controller.signal));
      await json(join(init.directory, "history.json"), result.history); await json(join(init.directory, "wire.json"), fixture.wire);
    }
    controller.signal.throwIfAborted();
    // The supervisor owns Chrome before its startup begins; a late launch cannot escape final cleanup.
    const endpoint = new Promise<string>((resolve, reject) => {
      process.on("message", message => { const value = message as { kind?: string; endpoint?: string }; if (value.kind === "chrome-ready" && value.endpoint) resolve(value.endpoint); });
      controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
    });
    process.send?.({ kind: "chrome" });
    const { chromium } = await import("@playwright/test"); browser = await chromium.connectOverCDP(await endpoint, { timeout: 8000 });
    result.app = await actualApp(fixture, browser, init.directory, controller.signal);
    assert.deepEqual(fixture.problems, []);
    result.passed = result.app.passed && result.history.length === 2 && result.history.every(item => (item as { passed: boolean }).passed);
  } catch (error) { result.errors.push(errorText(error)); }
  finally {
    clearTimeout(timer);
    try { await browser?.close(); } catch (error) { result.cleanupErrors.push(errorText(error)); }
    try { await fixture?.close(); } catch (error) { result.cleanupErrors.push(errorText(error)); }
    if (fixture) await json(join(init.directory, "wire.json"), fixture.wire);
    result.passed &&= result.errors.length === 0 && result.cleanupErrors.length === 0;
    await json(join(init.directory, "worker.json"), result); process.send?.({ kind: "result", result }); process.disconnect?.();
  }
}

if (process.argv.includes("--worker")) await worker(); else await supervisor();
