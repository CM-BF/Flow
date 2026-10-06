import { createServer, preview as previewBuild } from "vite";
import { fileURLToPath } from "node:url";
import { createWorkspaceFixture } from "./workspace-fixture";

/** Test-owned ports and servers; never reuses or stops the user-facing previews. */
export async function startIntegrationFixture(production = false) {
  const first = createWorkspaceFixture();
  const second = createWorkspaceFixture();
  const listen = async (fixture: typeof first) => {
    await new Promise<void>(resolve => fixture.server.listen(0, "127.0.0.1", resolve));
    const address = fixture.server.address();
    if (!address || typeof address === "string") throw Error("Fixture failed to bind");
    return `http://127.0.0.1:${address.port}`;
  };
  const centers = await Promise.all([listen(first), listen(second)]);
  for (const task of second.tasks.values()) {
    task.prompt = "CENTER B: independently owned task with the same identifier.";
    for (const entry of task.entries) if (entry.kind === "text") entry.text = `CENTER B: ${entry.text}`;
  }
  for (const detail of second.details.values()) detail.content = `CENTER B: ${detail.content}`;
  const root = fileURLToPath(new URL("..", import.meta.url));
  const vite = production ? await previewBuild({ root, preview: { host: "127.0.0.1", port: 0, strictPort: false } }) : await createServer({ root, define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("false") }, server: { host: "127.0.0.1", port: 0, strictPort: false, proxy: { "/api": centers[0]! } } });
  if ("listen" in vite) await vite.listen();
  const address = vite.httpServer!.address();
  if (!address || typeof address === "string") throw Error("Preview failed to bind");
  return { first, second, centers, url: `http://127.0.0.1:${address.port}`, close: async () => { await vite.close(); await Promise.all([first.close(), second.close()]); } };
}

export async function runRealIntegration(output: string) {
  const { randomUUID, createHash } = await import("node:crypto");
  const { writeFile } = await import("node:fs/promises");
  const { Pool } = await import("pg");
  const { chromium, expect } = await import("@playwright/test");
  const { FlowClient } = await import("@flow/client");
  const { createServer: createCenter } = await import("../../server/src/index");
  const adminUrl = process.env.FLOW_TEST_ADMIN_URL;
  if (!adminUrl) throw Error("Set FLOW_TEST_ADMIN_URL to the local test PostgreSQL administrator URL.");
  const admin = new Pool({ connectionString: adminUrl });
  const name = `flow_wpf_i01_${randomUUID().replaceAll("-", "")}`;
  const db = new URL(adminUrl); db.pathname = `/${name}`;
  const token = randomUUID();
  const checks: string[] = [];
  await admin.query(`CREATE DATABASE "${name}"`);
  let center: Awaited<ReturnType<typeof createCenter>> | undefined;
  let vite: Awaited<ReturnType<typeof createServer>> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    center = await createCenter({ databaseUrl: db.href, ownerToken: token, leaseMs: 300_000 });
    const requests: string[] = [];
    center.addHook("onRequest", async request => { requests.push(request.url); });
    await center.listen({ host: "127.0.0.1", port: 0 });
    const address = center.server.address(); if (!address || typeof address === "string") throw Error("Center failed to bind");
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const owner = new FlowClient({ baseUrl, token });
    const registration = await owner.registerRunner({ name: "I01 isolated protocol runner", harnesses: ["fixture"], capacity: 1 });
    const runner = new FlowClient({ baseUrl, token: registration.token });
    await owner.submit({ title: "Real center plugin journey", prompt: "Verify the plugin UI against a durable center task.", harness: "fixture" }, randomUUID());
    let assignment: Awaited<ReturnType<typeof runner.claim>>["assignment"] = null;
    await expect.poll(async () => { assignment = (await runner.claim()).assignment; return Boolean(assignment); }, { timeout: 15_000 }).toBe(true);
    const claimed = assignment!;
    await runner.report({ attemptId: claimed.attempt.id, ownerVersion: claimed.attempt.ownerVersion, events: [
      { type: "message", id: randomUUID(), sequence: 1, text: "Real center progress, saved by a protocol runner." },
      { type: "decision", id: randomUUID(), sequence: 2, decisionId: "i01-decision", prompt: "Approve the verified artifact step?" },
    ] });
    vite = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("false") }, server: { host: "127.0.0.1", port: 0, strictPort: false, proxy: { "/api": baseUrl } } });
    await vite.listen(); const webAddress = vite.httpServer!.address(); if (!webAddress || typeof webAddress === "string") throw Error("Web failed to bind");
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${webAddress.port}`);
    await page.getByLabel("Owner token", { exact: true }).fill(token); await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
    await expect(page.getByRole("article", { name: "Attention: Real center plugin journey", exact: true })).toBeVisible();
    expect(requests.filter(path => path.startsWith("/api/details/"))).toHaveLength(0);
    await page.locator('.flow-chat-row').getByRole("button", { name: "Open from plugin", exact: true }).click();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect.poll(async () => (await owner.show(claimed.task.id)).status).toBe("running");
    expect((await runner.heartbeat({ attemptId: claimed.attempt.id, ownerVersion: claimed.attempt.ownerVersion })).decision?.decisionId).toBe("i01-decision");
    checks.push("plugin sidebar opens real task; Web decision is durably observed by public runner heartbeat; initial detail zero");
    const content = "Verified real PostgreSQL center artifact for plugin integration.";
    const hash = (text: string) => createHash("sha256").update(text).digest("hex");
    const version = hash(content);
    await runner.report({ attemptId: claimed.attempt.id, ownerVersion: claimed.attempt.ownerVersion, events: [
      { type: "artifact", id: randomUUID(), sequence: 3, artifactId: "report", title: "Real plugin artifact", version, content, mediaType: "text/plain" },
      { type: "verification", id: randomUUID(), sequence: 4, artifactId: "report", artifactVersion: version, verifierId: "flow.text", verifierVersion: "1", inputDigest: hash(JSON.stringify({ artifactVersion: version, rule: { kind: "nonempty" } })), result: "passed", evidence: "Exact saved artifact verified." },
      { type: "completed", id: randomUUID(), sequence: 5, outcome: "succeeded" },
    ] });
    await expect(page.locator('.flow-task-bar .status-succeeded')).toBeVisible();
    await page.getByRole("button", { name: "Open Real plugin artifact", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Real plugin artifact", exact: true })).toBeFocused();
    await expect(page.getByText(content, { exact: true })).toBeVisible();
    await expect(page.locator('.flow-workspace-artifact-meta [data-verification="passed"]')).toBeVisible();
    expect(requests.filter(path => path.startsWith("/api/details/"))).toHaveLength(1);
    await page.getByRole("tab", { name: "Notes", exact: true }).click(); await page.getByRole("tab", { name: "Task workspace", exact: true }).click();
    await expect(page.getByText(content, { exact: true })).toBeVisible(); expect(requests.filter(path => path.startsWith("/api/details/"))).toHaveLength(1);
    await page.screenshot({ path: `${output}real-center-light.png` });
    checks.push("real artifact/verification through official Thread and plugin WorkspacePanels; explicit one read and cached Notes roundtrip");
    await page.getByRole("tab", { name: "Notes", exact: true }).click(); await page.getByRole("button", { name: "Use Ocean theme", exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'sample.notes.ocean');
    await page.getByRole("button", { name: "Extensions and appearance", exact: true }).click();
    await page.getByRole("button", { name: "Disable sample.notes", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByRole("button", { name: "Extensions and appearance", exact: true })).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole("tab", { name: "Notes", exact: true })).toHaveCount(0);
    await expect(page.getByText(content, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    if (await page.getByRole("button", { name: "Hide chat list", exact: true }).isVisible()) await page.getByRole("button", { name: "Hide chat list", exact: true }).click();
    await page.screenshot({ path: `${output}real-center-dark-390.png` });
    expect(requests.filter(path => path.endsWith("/cancel"))).toHaveLength(0);
    checks.push("real task remains completed while custom theme/plugin disable cleans contributions, returns focus and renders dark 390px; zero cancel commands");
    expect(errors).toEqual([]);
    await writeFile(`${output}real-center-results.json`, JSON.stringify({ at: new Date().toISOString(), input: "Real isolated PostgreSQL center + one public protocol runner task, not a live model", database: name, checks, pageErrors: errors, finalStatus: (await owner.show(claimed.task.id)).status, cleanup: "Test-owned Web/browser/center closed and database dropped in finally" }, null, 2));
    for (const check of checks) process.stdout.write(`PASS ${check}\n`);
  } finally {
    await browser?.close(); await vite?.close(); await center?.close();
    await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); await admin.end();
  }
}
