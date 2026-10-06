import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { Pool } from "pg";
import { chromium, expect } from "@playwright/test";
import { createServer as createVite } from "vite";
import { FlowApiError, FlowClient } from "@flow/client";
import type { ClaimedTask, RunnerEventData } from "@flow/contracts";
import { createServer } from "../../server/src/index";

const output = fileURLToPath(new URL("../../../docs/evidence/wpf-m02/", import.meta.url));
const databaseName = `flow_wpf_m02_${randomUUID().replaceAll("-", "")}`;
const adminUrl = "postgresql://flow:flow-local-only@127.0.0.1:55432/postgres";
const admin = new Pool({ connectionString: adminUrl });
const database = new URL(adminUrl); database.pathname = `/${databaseName}`;
const ownerToken = randomUUID(); // Dedicated test credential: never written to evidence.
const checks: string[] = [];
const check = async (name: string, action: () => Promise<void>) => { await action(); checks.push(name); process.stdout.write(`PASS ${name}\n`); };
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
await admin.query(`CREATE DATABASE "${databaseName}"`);
const server = await createServer({ databaseUrl: database.href, ownerToken, leaseMs: 300_000 });
const requests: { method: string; path: string }[] = [];
server.addHook("onRequest", async request => { requests.push({ method: request.method, path: request.url }); });
await server.listen({ host: "127.0.0.1", port: 0 });
const address = server.server.address(); if (!address || typeof address === "string") throw new Error("Missing center address");
const baseUrl = `http://127.0.0.1:${address.port}`;
const owner = new FlowClient({ baseUrl, token: ownerToken });
const vite = await createVite({ root: fileURLToPath(new URL("..", import.meta.url)), define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("false") }, server: { host: "127.0.0.1", port: 0, strictPort: false, proxy: { "/api": baseUrl } } });
await vite.listen();
const webAddress = vite.httpServer!.address(); if (!webAddress || typeof webAddress === "string") throw new Error("Missing Web address");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
const assignments: ClaimedTask[] = [];
try {
  const registration = await owner.registerRunner({ name: "WPF-M02 isolated protocol runner", harnesses: ["fixture"], capacity: 10 });
  const runner = new FlowClient({ baseUrl, token: registration.token });
  const otherRegistration = await owner.registerRunner({ name: "WPF-M02 revoked protocol runner", harnesses: ["fixture"], capacity: 1 });
  const otherRunner = new FlowClient({ baseUrl, token: otherRegistration.token });
  const sequences = new Map<string, number>();
  const report = async (assignment: ClaimedTask, events: RunnerEventData[], client = runner) => {
    let sequence = sequences.get(assignment.task.id) ?? 0;
    await client.report({ attemptId: assignment.attempt.id, ownerVersion: assignment.attempt.ownerVersion, events: events.map(event => ({ ...event, id: randomUUID(), sequence: ++sequence })) });
    sequences.set(assignment.task.id, sequence);
  };
  await check("ten durable tasks through real PostgreSQL center and public runner protocol", async () => {
    for (let i = 0; i < 10; i++) await owner.submit({ title: `Real center task ${i + 1}`, prompt: `Protocol runner task ${i + 1}; not a live model.`, harness: "fixture" }, randomUUID());
    for (let i = 0; i < 10; i++) {
      const client = i === 9 ? otherRunner : runner;
      let assignment: ClaimedTask | null = null;
      await expect.poll(async () => { assignment = (await client.claim()).assignment; return !!assignment; }, { timeout: 15_000 }).toBe(true);
      assignments.push(assignment!);
      const events: RunnerEventData[] = Array.from({ length: 6 }, (_, n) => ({ type: "message", text: `Task ${i + 1}: saved progress ${n + 1} from the isolated protocol runner.` }));
      if (i < 3) events.push({ type: "decision", decisionId: `real-decision-${i}`, prompt: `Approve the next step for task ${i + 1}?` });
      if (i === 5) {
        const content = "Real center saved artifact for Web acceptance."; const version = digest(content);
        events.push({ type: "artifact", artifactId: "report", title: "Real center artifact", version, content, mediaType: "text/plain" });
        events.push({ type: "verification", artifactId: "report", artifactVersion: version, verifierId: "flow.text", verifierVersion: "1", inputDigest: digest(JSON.stringify({ artifactVersion: version, rule: { kind: "nonempty" } })), result: "passed", evidence: "Nonempty exact artifact verified by the center." });
      }
      if (i >= 5 && i <= 8) events.push({ type: "completed", outcome: i === 7 ? "failed" : i === 8 ? "cancelled" : "succeeded" });
      await report(assignment!, events, client);
    }
    await owner.revokeRunner(otherRegistration.runnerId);
    const snapshot = await owner.workspace(); expect(snapshot.tasks).toHaveLength(10); expect(snapshot.attention).toHaveLength(4);
  });
  await check("Web workspace shows ten tasks and attention without eager detail reads", async () => {
    await page.goto(`http://127.0.0.1:${webAddress.port}`);
    await page.getByLabel("Owner token", { exact: true }).fill(ownerToken); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    await expect(page.getByRole("article", { name: /^Attention:/ })).toHaveCount(4);
    expect(requests.filter(request => request.path.startsWith("/api/details/"))).toHaveLength(0);
    await page.getByRole("button", { name: "Task index", exact: true }).click();
    await expect(page.getByText("10 loaded · 10 matching tasks", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Activity", exact: true }).click();
    await page.screenshot({ path: `${output}real-center-light.png` });
  });
  await check("real inline approval, cancellation acknowledgement and stale decision rejection", async () => {
    await page.getByRole("article", { name: "Attention: Real center task 1", exact: true }).getByRole("button", { name: "Approve", exact: true }).click();
    await expect.poll(async () => (await owner.show(assignments[0]!.task.id)).status).toBe("running");
    expect((await runner.heartbeat({ attemptId: assignments[0]!.attempt.id, ownerVersion: assignments[0]!.attempt.ownerVersion })).decision?.decisionId).toBe("real-decision-0");
    const cancel = page.getByRole("article", { name: "Attention: Real center task 2", exact: true });
    await cancel.getByRole("button", { name: "Cancel task", exact: true }).click(); await cancel.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
    await expect.poll(async () => (await owner.show(assignments[1]!.task.id)).status).toBe("cancel_requested");
    expect((await runner.heartbeat({ attemptId: assignments[1]!.attempt.id, ownerVersion: assignments[1]!.attempt.ownerVersion })).action).toBe("cancel");
    await expect(owner.decide(assignments[1]!.task.id, { decisionId: "real-decision-1", answer: "approve" }, randomUUID())).rejects.toMatchObject({ status: 409 });
    await report(assignments[1]!, [{ type: "completed", outcome: "cancelled" }]);
    await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
    await expect(page.getByRole("article", { name: "Attention: Real center task 2", exact: true })).toHaveCount(0);
  });
  await check("real activity buffers during history reading and opens only requested artifact", async () => {
    const feed = page.locator(".wf-feed"); await feed.evaluate(element => { element.scrollTop = 180; element.dispatchEvent(new Event("scroll")); });
    const before = await feed.evaluate(element => element.scrollTop);
    await report(assignments[3]!, [{ type: "message", text: "New real-center progress while reading history." }]);
    await page.getByRole("button", { name: "Refresh activity", exact: true }).click();
    await expect(page.getByRole("button", { name: /Show latest activity \(/ })).toBeVisible();
    expect(await feed.evaluate(element => element.scrollTop)).toBe(before);
    await page.getByRole("button", { name: /Show latest activity/ }).click();
    await expect(page.getByText("New real-center progress while reading history.", { exact: true })).toBeVisible();
    const artifact = page.getByRole("button", { name: "Real center artifact", exact: true });
    await artifact.click();
    await expect(page.getByText("Real center saved artifact for Web acceptance.", { exact: true })).toBeVisible();
    expect(requests.filter(request => request.path.startsWith("/api/details/"))).toHaveLength(1);
    await expect(page.locator(".flow-status.status-succeeded")).toBeVisible();
    await expect(page.locator(".flow-task-bar .verification-passed")).toBeVisible();
    await page.getByRole("button", { name: "Use dark theme", exact: true }).click();
    await page.screenshot({ path: `${output}real-center-artifact-dark.png` });
    await page.getByRole("button", { name: "Work overview", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Work overview", exact: true }).click();
    await page.screenshot({ path: `${output}real-center-dark-390.png` });
  });
  expect(errors).toEqual([]);
  await writeFile(`${output}real-center-results.json`, JSON.stringify({ at: new Date().toISOString(), database: databaseName, centerPort: address.port, webPort: webAddress.port, input: "M02 + reviewed causal-order correction, real PostgreSQL and HTTP center, ten protocol-runner tasks (not ten models)", checks, pageErrors: errors, finalTasks: (await owner.workspace()).tasks.map(({ id, status, verificationStatus }) => ({ id, status, verificationStatus })), cleanup: "Test-owned center, browser, Vite and database closed/dropped in finally" }, null, 2));
} catch (error) { await page.screenshot({ path: `${output}real-center-failure.png` }); throw error; }
finally {
  await browser.close(); await vite.close(); await server.close();
  await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`); await admin.end();
}
