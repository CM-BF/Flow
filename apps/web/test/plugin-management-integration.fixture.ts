import { fileURLToPath } from "node:url";
import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer, preview as productionPreview } from "vite";
import type { PluginMutationResult, PluginMaterialInstall, PluginInstallation, PluginOperation, PluginSnapshot, PluginVersion, BrowserSessionReady, ClaudeMessageSettingsExecutionProfile, AttachmentMetadata } from "@flow/contracts";
import { pluginRuntimeCommandSchema, type PluginRuntimeView } from "../../../packages/contracts/src/plugin-runtime";
import { createConversationFixture } from "./conversation.fixture";

/** Public HTTP protocol fixture only: no database, SDK, package load, or model. */
const fixtureId = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
function registryCenter(label: "A" | "B", cookieMode = false) {
  const fixture = createConversationFixture();
  const handler = fixture.server.listeners("request")[0] as (request: IncomingMessage, response: ServerResponse) => void;
  fixture.server.removeAllListeners("request");
  const at = "2026-10-06T00:00:00.000Z";
  const installations: PluginInstallation[] = Array.from({ length: 11 }, (_, index) => ({
    id: fixtureId(index + 1), scope: { workspaceId: "personal", projectId: null },
    packageName: index ? `@fixture/plugin-${index}` : "sample.notes", revision: 3,
    registrationStatus: "registered", runtimeStatus: "unavailable", runtimeReason: "package_not_verified_or_loaded", createdAt: at, updatedAt: at,
  }));
  const versions: PluginVersion[] = Array.from({ length: 12 }, (_, index) => ({
    id: fixtureId(index + 101), createdAt: at, packageName: "sample.notes", packageVersion: `1.${index}.0`,
    source: "npm", declaredSha256: "a".repeat(64), license: "MIT", hostApiMajor: 1,
    capabilities: ["renderer"], publicConfiguration: [{ key: "center", kind: "enum", required: true, values: ["A", "B"] }],
  }));
  const operations: PluginOperation[] = Array.from({ length: 12 }, (_, index) => ({
    id: fixtureId(index + 201), installationId: fixtureId(1), kind: index ? "configure" : "register", status: "succeeded",
    actor: "owner", inputDigest: "b".repeat(64), beforeRevision: index || null, afterRevision: index + 1, createdAt: at,
  }));
  const reads: { method: string; path: string }[] = [];
  let holdDetail = false;
  let abortedReads = 0;
  let release: (() => void) | undefined;
  const registration = installations[0]!;
  const registrySnapshot = (): PluginSnapshot => ({ installation: { ...registration }, revision: registration.revision, version: versions[0]!, configuration: { center: label }, configurationStatus: "ready", grants: ["renderer"] });
  const material: PluginMaterialInstall = { schemaVersion: 1, id: fixtureId(301), registrationId: registration.id, versionId: versions[0]!.id,
    admittedRevision: 3, fetchOperationId: fixtureId(302), fetchAttemptId: fixtureId(303), artifactId: fixtureId(304),
    storeId: "fixture-store", status: "installed", materialId: "c".repeat(64), treeDigest: "d".repeat(64), hostApiMajor: 1,
    error: null, createdAt: at, updatedAt: at };
  let runtime: PluginRuntimeView = { protocol: "flow.plugin-runtime.v1", registrationId: registration.id, currentRevision: 3,
    enabledRevision: 3, desiredEnabled: true, bindingAllowed: true, reason: "ready", targetRunnerId: fixtureId(401),
    storeId: material.storeId, materialInstallOperationId: material.id, loaded: "unknown", callable: "unknown" };
  const projectId = "i01-project";
  const configuration: ClaudeMessageSettingsExecutionProfile["configuration"] = { harness: "claude", adapterVersion: "claude-sdk-0.3.290-v2",
    model: "i01-model", thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: "a".repeat(64),
    turnSettings: { protocol: "flow.claude-turn-settings.v1", choices: [{ model: "i01-model", thinking: "disabled", effort: { kind: "not-requested" }, speed: "standard" }] },
    limits: { maxTurns: 1, maxBudgetUsd: 0.01, timeoutMs: 1000 } };
  const profile: ClaudeMessageSettingsExecutionProfile = { reference: { id: fixtureId(701), runnerId: fixtureId(702), configDigest: createHash("sha256").update(JSON.stringify(configuration)).digest("hex") },
    configuration, source: "runner-configured", availability: "not-probed", model: { value: "i01-model", resolvedModel: null, displayName: "i01-model", description: "Controlled HTTP projection, no runner was registered", providerCapabilities: "unknown" },
    controls: { access: "configured-policy", queue: false, steer: false, messageSettings: { protocol: "flow.claude-turn-settings.v1", choices: "configuration.turnSettings.choices" } }, createdAt: at };
  const files: AttachmentMetadata[] = ["first.txt", "second.txt"].map((name, index) => ({ reference: { kind: "upload", projectId, resourceId: fixtureId(801 + index), version: 1, contentDigest: createHash("sha256").update(name).digest("hex") },
    name, mediaType: "text/plain", byteLength: Buffer.byteLength(name), createdAt: at, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), state: "ready", retained: false }));
  if (cookieMode) {
    const chat = fixture.chats.get("chat-1")!;
    chat.snapshot.conversation = { ...chat.snapshot.conversation, projectId, executionProfile: profile.reference };
    chat.snapshot.capabilities = { ...chat.snapshot.capabilities, attachmentContext: true,
      messageSettings: { protocol: "flow.claude-turn-settings.v1", profile: profile.reference, choices: "execution-profile" } };
  }
  let contentReads = 0;
  const runtimeReceipts = new Map<string, { body: string; value: PluginMutationResult & { runtime: PluginRuntimeView } }>();
  const runtimeWrites: { key: string; body: string; replayed: boolean; cookie: boolean; csrf: boolean; outcome: string }[] = [];
  let loseRuntimeAck = false, holdRuntimeAck = false, releaseRuntime: (() => void) | undefined;
  let cookie: string | undefined, csrf: string | undefined;
  let sessionReads = 0, sessionConnects = 0;
  const ready = (): BrowserSessionReady => ({ protocol: "flow.browser-session.v1", state: "ready", centerId: fixtureId(label === "A" ? 501 : 502),
    ownerPrincipalId: fixtureId(label === "A" ? 601 : 602), csrfToken: csrf!, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
  const json = (response: ServerResponse, value: unknown, status = 200) => {
    if (!response.destroyed) { response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); response.end(JSON.stringify(value)); }
  };
  const readBody = async (request: IncomingMessage) => {
    const chunks: Buffer[] = []; let bytes = 0;
    for await (const chunk of request) { const value = Buffer.from(chunk); bytes += value.length; if (bytes > 32_768) throw Error("Fixture body limit"); chunks.push(value); }
    return Buffer.concat(chunks).toString("utf8");
  };
  fixture.server.on("request", (request, response) => { void (async () => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const cookieAuthorized = cookie !== undefined && request.headers.cookie?.split(/;\s*/).includes(`flow_i01_fixture=${cookie}`) === true;
    const csrfAuthorized = csrf !== undefined && request.headers["x-flow-csrf"] === csrf;
    if (cookieMode && url.pathname.startsWith("/api/browser-session")) {
      if (request.method === "GET" && url.pathname === "/api/browser-session") {
        sessionReads++; json(response, cookieAuthorized ? ready() : { protocol: "flow.browser-session.v1", state: "unauthenticated" }); return;
      }
      if (request.method === "POST" && url.pathname.endsWith("/connect") && request.headers.authorization === "Bearer flow-fixture-only") {
        await readBody(request); sessionConnects++; cookie = randomUUID(); csrf = "a".repeat(64);
        response.setHeader("set-cookie", `flow_i01_fixture=${cookie}; HttpOnly; SameSite=Strict; Path=/`); json(response, ready()); return;
      }
      if (request.method === "POST" && url.pathname.endsWith("/logout") && cookieAuthorized && csrfAuthorized) {
        await readBody(request); cookie = undefined; csrf = undefined; json(response, { protocol: "flow.browser-session.v1", state: "unauthenticated" }); return;
      }
      json(response, { error: { code: "unauthorized", message: "Fixture connection required" } }, 401); return;
    }
    if (cookieMode) {
      if (!cookieAuthorized || request.method !== "GET" && request.method !== "HEAD" && !csrfAuthorized) {
        json(response, { error: { code: "unauthorized", message: "Fixture session required" } }, 401); return;
      }
      // Only this HTTP fixture translates its verified synthetic cookie into its legacy inner fixture credential.
      // The real App/FlowClient sent Cookie/CSRF, not a business Authorization header. No real center is exercised.
      request.headers.authorization = "Bearer flow-fixture-only";
    }
    if (cookieMode && url.pathname === "/api/execution-profiles" && request.method === "GET") {
      json(response, request.headers["x-flow-execution-profile"] === "flow.claude-turn-settings.v1"
        ? { protocol: "flow.claude-turn-settings.v1", profiles: [{ profile, conversation: { state: "existing-claude-contract", capabilitySource: "conversation-response" } }], nextCursor: null }
        : { profiles: [], nextCursor: null }); return;
    }
    if (cookieMode && url.pathname.startsWith(`/api/projects/${projectId}/attachments`)) {
      if (request.method !== "GET") { json(response, { error: { code: "fixture_readonly", message: "Existing fixture files only" } }, 405); return; }
      const suffix = url.pathname.slice(`/api/projects/${projectId}/attachments`.length);
      if (suffix === "/capabilities") { json(response, { protocol: "text-v1", recoveryScopeId: fixtureId(803), projectId, requiresProject: true,
        mediaTypes: ["text/plain"], extensions: [".txt"], maxFileBytes: 8192, maxCombinedReferences: 4, maxCombinedBytes: 8192,
        order: "knowledge-then-attachments", unboundTtlSeconds: 86400, resourcesPerProject: 128, retainedBytesPerProject: 1048576 }); return; }
      if (!suffix) { json(response, { resources: files, nextCursor: null }); return; }
      const resource = files.find(file => suffix.split("/")[1] === file.reference.resourceId);
      if (!resource) { json(response, { error: { code: "attachment_not_found", message: "No fixture file" } }, 404); return; }
      if (suffix.endsWith("/content")) { contentReads++; const { reference, name, mediaType, byteLength } = resource; json(response, { reference, name, mediaType, byteLength, text: name }); }
      else json(response, resource);
      return;
    }
    if (!url.pathname.startsWith("/api/plugins")) { handler(request, response); return; }
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "authorization,content-type");
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    reads.push({ method: request.method ?? "GET", path: request.url! });
    const send = (value: unknown, status = 200) => json(response, value, status);
    if (request.headers.authorization !== "Bearer flow-fixture-only") { send({ error: { code: "unauthorized", message: "Fixture token required" } }, 401); return; }
    if (url.pathname === `/api/plugins/${registration.id}/runtime/commands` && request.method === "POST" && cookieMode) {
      const body = await readBody(request), key = String(request.headers["idempotency-key"] ?? "");
      if (!key || key.length > 200 || runtimeWrites.length >= 12) { send({ error: { code: "fixture_limit", message: "Fixture command limit" } }, 400); return; }
      const parsed = pluginRuntimeCommandSchema.safeParse(JSON.parse(body));
      if (!parsed.success) { send({ error: { code: "invalid_input", message: "Invalid runtime command" } }, 400); return; }
      const previous = runtimeReceipts.get(key);
      if (previous && previous.body !== body) { send({ error: { code: "idempotency_conflict", message: "Changed body" } }, 409); return; }
      if (!previous && parsed.data.expectedRevision !== registration.revision) { send({ error: { code: "plugin_revision_conflict", message: "Changed revision" } }, 409); return; }
      if (!previous) {
        const input = parsed.data, revision = ++registration.revision, enabled = input.change.kind === "enable";
        runtime = { ...runtime, currentRevision: revision, desiredEnabled: enabled, bindingAllowed: enabled, reason: enabled ? "ready" : "not-enabled",
          enabledRevision: enabled ? revision : null, targetRunnerId: input.change.kind === "enable" ? input.change.targetRunnerId : null,
          storeId: input.change.kind === "enable" ? input.change.storeId : null, materialInstallOperationId: input.change.kind === "enable" ? input.change.materialInstallOperationId : null };
        const operation: PluginOperation = { id: randomUUID(), installationId: registration.id, kind: input.change.kind, status: "succeeded", actor: "owner",
          inputDigest: createHash("sha256").update(body).digest("hex"), beforeRevision: input.expectedRevision, afterRevision: revision, createdAt: at };
        runtimeReceipts.set(key, { body, value: { snapshot: registrySnapshot(), operation, runtime: { ...runtime }, replayed: false } });
      }
      const value = { ...runtimeReceipts.get(key)!.value, replayed: !!previous };
      const wire = { key, body, replayed: !!previous, cookie: cookieAuthorized, csrf: csrfAuthorized, outcome: "accepted-response" };
      runtimeWrites.push(wire);
      if (loseRuntimeAck) { loseRuntimeAck = false; wire.outcome = "accepted-socket-closed"; response.destroy(); return; }
      if (holdRuntimeAck) { holdRuntimeAck = false; wire.outcome = "accepted-response-held"; releaseRuntime = () => { send(value); releaseRuntime = undefined; }; return; }
      send(value); return;
    }
    if (request.method !== "GET") { send({ error: { code: "read_only", message: "Registry fixture is read-only" } }, 405); return; }
    const parts = url.pathname.split("/").filter(Boolean);
    const offset = Number(url.searchParams.get("after") ?? 0), limit = Number(url.searchParams.get("limit") ?? 10);
    const page = <T,>(items: T[], key: string) => ({ [key]: items.slice(offset, offset + limit), nextCursor: items.length > offset + limit ? String(offset + limit) : null });
    if (parts[2] === registration.id && parts[3] === "runtime" && cookieMode) { send(runtime); return; }
    if (parts[2] === registration.id && parts[3] === "material-installs" && cookieMode) { send({ operations: [material], nextCursor: null }); return; }
    if (parts.length === 2) { send(page(installations, "installations")); return; }
    if (parts[3] === "versions") { send(page(versions, "versions")); return; }
    if (parts[3] === "operations") { send(page(operations, "operations")); return; }
    const installation = installations.find(item => item.id === parts[2]);
    if (!installation) { send({ error: { code: "not_found", message: "Unknown registration" } }, 404); return; }
    const snapshot: PluginSnapshot = { installation, revision: installation.revision, version: versions[0]!, configuration: { center: label }, configurationStatus: "ready", grants: ["renderer"] };
    if (holdDetail) {
      holdDetail = false;
      response.on("close", () => { if (!response.writableEnded) abortedReads++; });
      release = () => { send(snapshot); release = undefined; };
    } else send(snapshot);
  })().catch(() => json(response, { error: { code: "fixture_input", message: "Invalid fixture request" } }, 400)); });
  return { ...fixture, registryReads: reads, holdNextDetail: () => { holdDetail = true; }, abortedReads: () => abortedReads,
    releaseDetail: () => release?.(), label, runtimeWrites, material, files, profile, contentReads: () => contentReads, runnerId: fixtureId(401),
    sessionReads: () => sessionReads, sessionConnects: () => sessionConnects,
    loseNextRuntimeAck: () => { loseRuntimeAck = true; }, holdNextRuntimeAck: () => { holdRuntimeAck = true; },
    releaseRuntime: () => releaseRuntime?.(),
    close: async () => { release?.(); releaseRuntime?.(); await fixture.close(); } };
}

export async function startPluginManagementPreview(production = false) {
  const first = registryCenter("A"), second = registryCenter("B");
  const centers: string[] = [];
  for (const fixture of [first, second]) {
    await new Promise<void>(resolve => fixture.server.listen(0, "127.0.0.1", resolve));
    const address = fixture.server.address();
    if (!address || typeof address === "string") throw Error("Missing fixture address");
    centers.push(`http://127.0.0.1:${address.port}`);
  }
  const root = fileURLToPath(new URL("..", import.meta.url));
  const proxy = { "/api": centers[0]! };
  const server = production
    ? await productionPreview({ root, preview: { host: "127.0.0.1", port: 0, proxy } })
    : await createServer({ root, define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { host: "127.0.0.1", port: 0, proxy } });
  if ("listen" in server) await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === "string") throw Error("Missing Web address");
  return { first, second, centers, url: `http://127.0.0.1:${address.port}`, close: async () => {
    first.releaseDetail(); second.releaseDetail();
    await server.close();
    await Promise.all([first.close(), second.close()]);
  } };
}
if (process.argv.includes("--app-preview")) {
  const preview = await startPluginManagementPreview();
  console.log(`HTTP fixture only: ${preview.url}`);
  console.log(`Fixture centers: ${preview.centers.join(", ")} · token flow-fixture-only`);
  let closed = false;
  const close = async () => { if (closed) return; closed = true; await preview.close(); process.exit(); };
  process.once("SIGINT", close); process.once("SIGTERM", close);
}


/** Real BrowserWorkspace consumes a synthetic public Cookie/registry protocol. No actual center authentication is claimed. */
export async function startPluginRuntimePreview() {
  const fixture = registryCenter("A", true);
  let server: Awaited<ReturnType<typeof createServer>> | undefined;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    fixture.releaseDetail(); fixture.releaseRuntime();
    const results = await Promise.allSettled([server?.close(), fixture.close()]);
    const errors = results.filter(result => result.status === "rejected");
    if (errors.length) throw new AggregateError(errors.map(result => result.reason), "Owned I01 HTTP cleanup failed");
  };
  try {
    await new Promise<void>((resolve, reject) => { fixture.server.once("error", reject); fixture.server.listen(0, "127.0.0.1", () => { fixture.server.off("error", reject); resolve(); }); });
    const address = fixture.server.address(); if (!address || typeof address === "string") throw Error("Missing fixture address");
    server = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)),
      define: { "import.meta.env.VITE_FLOW_FIXTURE": JSON.stringify("true") }, server: { host: "127.0.0.1", port: 0, proxy: { "/api": `http://127.0.0.1:${address.port}` } } });
    await server.listen();
    const web = server.httpServer!.address(); if (!web || typeof web === "string") throw Error("Missing owned Web address");
    return { fixture, url: `http://127.0.0.1:${web.port}`, ports: [address.port, web.port], close };
  } catch (error) {
    try { await close(); } catch (cleanup) { throw new AggregateError([error, cleanup], "I01 setup and cleanup failed"); }
    throw error;
  }
}
