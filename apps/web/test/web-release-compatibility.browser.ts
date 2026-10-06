import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect, type Page, type Browser } from "@playwright/test";
import { BACKEND, NEW_WEB, RELEASE_ID, evidence, hash, repository, startReleaseFixture, until } from "./web-release-compatibility.fixture";

const fixture = await startReleaseFixture();
let browser: Browser | undefined;
const results: unknown[] = []; let failure: string | null = null;
const input = (page: Page) => page.getByRole("textbox", { name: "Message input", exact: true }).filter({ visible: true });
async function connect(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.getByLabel("Owner token", { exact: true }).fill(fixture.token);
  await page.getByRole("button", { name: "Connect workspace", exact: true }).click();
  await expect(input(page)).toBeVisible();
}

try {
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const { importWebCompatibility, verifyWebCompatibility } = await import(pathToFileURL(join(repository, "tools/personal-preview/web-release.mjs")).href);
  for (const preview of fixture.previews) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    const page = await context.newPage(); page.setDefaultTimeout(15_000);
    const pageErrors: string[] = [], consoleErrors: Array<{ text: string; url: string }> = [], loadedAssets: Array<{ path: string; sha256: string }> = [];
    const assetReads: Promise<void>[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") consoleErrors.push({ text: message.text(), url: message.location().url }); });
    page.on("response", response => {
      const path = new URL(response.url()).pathname.slice(1);
      if (response.status() === 200 && /\.(js|css)$/.test(path)) assetReads.push(response.body().then(bytes => { loadedAssets.push({ path, sha256: hash(bytes) }); }));
    });
    const text = `Release ${preview.label} durable message`, draft = `Independent ${preview.label} draft`;
    try {
      await connect(page, preview.url);
      const identity = await (await fetch(preview.url + "/__flow_preview_identity")).json(); assert.deepEqual(identity, preview.artifact);
      const manifest = preview.manifest as { files: Array<{ path: string; sha256: string }> };
      assert.equal(hash(Buffer.from(await (await fetch(preview.url)).arrayBuffer())), manifest.files.find(file => file.path === "index.html")!.sha256);
      await page.getByRole("button", { name: "Execution profile: Runner default", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Execution profile", exact: true });
      await expect(dialog.getByRole("radio", { name: /release-synthetic/ })).toBeVisible();
      await dialog.getByRole("radio", { name: /release-synthetic/ }).check(); await page.keyboard.press("Escape");
      await input(page).fill(text); preview.proxy.loseNextTurn();
      await page.getByRole("button", { name: "Send message", exact: true }).filter({ visible: true }).click();
      await expect(input(page)).toHaveValue(""); await input(page).fill(draft);
      const receipt = page.getByRole("region", { name: "Message receipt", exact: true });
      await expect(receipt).toContainText("Receipt unknown"); await expect(input(page)).toHaveValue(draft);
      const first = preview.proxy.records.find(record => record.dropped)!;
      assert.ok(first && first.status >= 200 && first.status < 300); assert.ok(first.key && first.body);
      const accepted = first.response, conversationId = accepted.conversation.id, taskId = accepted.turn.task.id;
      const finalTask = await until(() => fixture.request(`/api/tasks/${taskId}`), value => value.status === "succeeded");
      assert.equal(finalTask.verificationStatus, "passed");
      await page.getByRole("button", { name: "Retry same message", exact: true }).click();
      await expect(receipt).toHaveCount(0); await expect(input(page)).toHaveValue(draft);
      await expect(page.getByText(`Release fixture reply: ${text}`, { exact: true })).toBeVisible();
      const posts = preview.proxy.records.filter(record => record.method === "POST" && record.path === first.path);
      assert.equal(posts.length, 2); const recovered = posts[1]!;
      assert.equal(recovered.key, first.key); assert.equal(recovered.body, first.body);
      assert.equal(recovered.response.replayed, true); assert.equal(recovered.response.turn.id, accepted.turn.id);
      assert.equal((await fixture.request(`/api/conversations/${conversationId}/turns`)).turns.length, 1);
      await until(async () => preview.proxy.records, records => records.some(record => record.path === `/api/tasks/${taskId}` && record.method === "GET" && record.response?.id === taskId));
      const negotiated = preview.proxy.records.find(record => record.path === `/api/conversations/${conversationId}` && record.forwardedStream === "patch-v1" && record.response?.conversation?.id === conversationId);
      assert.ok(negotiated); assert.equal(negotiated.response.capabilities.liveAssistantText, true);
      await page.screenshot({ path: join(evidence, `${preview.label}-light.png`) });
      await page.getByRole("button", { name: "Use dark theme", exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: join(evidence, `${preview.label}-dark-390.png`) });

      // A real reload of the same built App also consumes the center's legacy (unnegotiated) representation.
      // Only the transport header is omitted; neither API response nor product JavaScript is substituted.
      preview.proxy.setLegacy(true); await page.setViewportSize({ width: 1280, height: 800 });
      await connect(page, preview.url);
      const nav = page.getByRole("navigation", { name: "Conversations", exact: true });
      const chats = page.getByRole("button", { name: "Chats", exact: true });
      if (!/\bactive\b/.test(await chats.getAttribute("class") ?? "")) await chats.click();
      await expect(nav).toBeVisible();
      await nav.getByRole("button", { name: text, exact: true }).click();
      await expect(page.getByText(`Release fixture reply: ${text}`, { exact: true })).toBeVisible();
      const legacy = preview.proxy.records.findLast(record => record.path === `/api/conversations/${conversationId}` && !record.forwardedStream && record.response?.conversation?.id === conversationId);
      assert.ok(legacy); assert.equal(legacy.response.capabilities.liveAssistantText, false);
      const directory = preview.proxy.records.find(record => record.path.startsWith("/api/execution-profiles") && !record.profile && record.response?.profiles);
      assert.ok(directory?.response.profiles.some((profile: any) => profile.reference.id === fixture.profile.reference.id));
      // Supplement the App's normal unnegotiated profile read with the public opt-in header contract.
      const negotiation = await page.evaluate(async ({ token, id }) => {
        const auth = { authorization: `Bearer ${token}` };
        const denied = await fetch(`/api/conversations/${id}`);
        const explicit = await fetch("/api/execution-profiles", { headers: { ...auth, "X-Flow-Execution-Profile": "steering-v1" } });
        return { denied: denied.status, status: explicit.status, profiles: (await explicit.json()).profiles };
      }, { token: fixture.token, id: conversationId });
      assert.equal(negotiation.denied, 401); assert.equal(negotiation.status, 200);
      assert.ok(negotiation.profiles.some((profile: any) => profile.reference.id === fixture.profile.reference.id && profile.reference.configDigest === fixture.profile.reference.configDigest));
      await Promise.all(assetReads); assert.equal(pageErrors.length, 0);
      const expectedConsole = consoleErrors.every(error => {
        const path = error.url ? new URL(error.url).pathname : "";
        return path === first.path && /502|ERR_EMPTY_RESPONSE|ERR_FAILED/.test(error.text)
          || path === `/api/conversations/${conversationId}` && /401/.test(error.text)
          || path === "/favicon.ico" && /404/.test(error.text);
      });
      assert.ok(expectedConsole, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`);
      for (const asset of loadedAssets) {
        const path = preview.label === "new" ? asset.path.replace(`__flow_releases/${RELEASE_ID}/`, "") : asset.path;
        if (preview.label === "new") assert.ok(asset.path.startsWith(`__flow_releases/${RELEASE_ID}/`));
        assert.equal(asset.sha256, manifest.files.find(file => file.path === path)?.sha256);
      }
      assert.ok(loadedAssets.some(asset => asset.path.endsWith(".js"))); assert.ok(loadedAssets.some(asset => asset.path.endsWith(".css")));
      const observations = {
        read: { ownerAuthenticated: negotiation.denied === 401, conversationBound: legacy.response.conversation.id === conversationId, taskBound: legacy.response.lastTurn.task.id === taskId },
        send: { acceptedTurnBound: accepted.turn.conversationId === conversationId && accepted.turn.user.text === text && accepted.turn.number === 1, requestedProfilePreserved: JSON.stringify(accepted.conversation.executionProfile) === JSON.stringify(fixture.profile.reference) },
        recover: { sameKey: recovered.key === first.key, sameBody: recovered.body === first.body, sameTurn: recovered.response.turn.id === accepted.turn.id },
        negotiation: { legacyReadable: legacy.response.capabilities.liveAssistantText === false, streamHeaderHandled: negotiated.response.capabilities.liveAssistantText === true, profileHeaderHandled: negotiation.status === 200 && negotiation.profiles.some((profile: any) => profile.reference.id === fixture.profile.reference.id) },
      };
      const directoryPath = join(evidence, preview.label); await mkdir(directoryPath, { recursive: true });
      const checks: Record<string, string> = {};
      for (const [check, values] of Object.entries(observations)) {
        assert.ok(Object.values(values).every(value => value === true));
        const raw = JSON.stringify({ format: 1, check, backendHead: BACKEND, artifactId: preview.artifact.artifactId, observations: values });
        assert.ok(Buffer.byteLength(raw) <= 4096); checks[check] = hash(raw); await writeFile(join(directoryPath, `${check}.json`), raw);
      }
      const report = { format: 1, policy: "flow-web-api-v1", backendHead: BACKEND, artifact: preview.artifact, checks };
      await writeFile(join(directoryPath, "report.json"), JSON.stringify(report));
      const compatibilityId = await importWebCompatibility({ directory: preview.directory, reportDirectory: directoryPath });
      await verifyWebCompatibility({ directory: preview.directory, artifact: preview.artifact, backendHead: BACKEND, compatibilityId });
      const record = { label: preview.label, artifact: preview.artifact, compatibilityId, observations, conversationId, taskId, firstKey: first.key, bodySha256: hash(first.body!), pageErrors, consoleErrors, loadedAssets,
        legacyMode: "Real App reload; observation proxy omitted only X-Flow-Assistant-Stream", profileNegotiation: "Actual App default directory plus supplemental same-origin authenticated opt-in GET", providerQueries: 0 };
      await writeFile(join(evidence, `${preview.label}-http.json`), JSON.stringify(preview.proxy.records, null, 2) + "\n");
      results.push(record); console.log(`PASS ${preview.label}: real App read/send/original-key recovery/negotiation; ${compatibilityId}`);
    } catch (error) {
      await page.screenshot({ path: join(evidence, `${preview.label}-failure.png`) }).catch(() => {});
      await writeFile(join(evidence, `${preview.label}-failed-http.json`), JSON.stringify(preview.proxy.records, null, 2) + "\n");
      await writeFile(join(evidence, `${preview.label}-failed-page.json`), JSON.stringify({ pageErrors, consoleErrors, body: await page.locator("body").innerText().catch(() => "unavailable") }, null, 2));
      throw error;
    } finally { await context.close(); }
  }
} catch (error) { failure = error instanceof Error ? error.stack ?? error.message : String(error); process.exitCode = 1; }
finally {
  try { await browser?.close(); } catch { failure = `${failure ?? ""}\nBrowser cleanup failed`; process.exitCode = 1; }
  try { await fixture.close(); } catch { failure = `${failure ?? ""}\nFixture cleanup failed; see cleanup.json`; process.exitCode = 1; }
  const paths = ["apps/web/test/web-release-compatibility.fixture.ts", "apps/web/test/web-release-compatibility.browser.ts"];
  const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(join(repository, path))) })));
  await writeFile(join(evidence, "browser-results.json"), JSON.stringify({ at: new Date().toISOString(), backend: BACKEND, oldWeb: BACKEND, newWeb: NEW_WEB, sources, results, failure, passed: !failure && results.length === 2 }, null, 2) + "\n");
  if (failure) console.error(failure);
}
