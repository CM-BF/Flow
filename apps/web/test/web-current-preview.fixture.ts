import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer as createHttpServer, request as requestHttp, type Server } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { FlowClient } from "../../../packages/client/src/index.js";
import { conversationCreationSchema, conversationTurnSchema, type ClaimedTask, type RunnerEventData } from "../../../packages/contracts/src/index.js";
import { CLAUDE_CONTEXT_SOURCE } from "../../../packages/contracts/src/context-observation-event.js";

export const BACKEND = "362af3bac77541e5a60979326bcf4d4b8c947915";
export const repository = fileURLToPath(new URL("../../../", import.meta.url));
export const evidence = join(repository, "docs/evidence/wpf-release03");
export const ARTIFACT_ROOT = "/private/tmp/flow-release03-prepare-5069586-u1zh3mln/artifacts";
export const artifact = {
  artifactId: "d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88",
  sourceHead: "5069586a9f17332de526e101eca3a4250cbc8d91",
  manifestDigest: "d629631d21eedd2afa308c562b31e57fc8597703a57a4c989c5a4af4fefd5e88",
};
export const RELEASE_ID = "388371a4972c469b8ace623454594132";
export const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const failure = (error: unknown) => error instanceof Error ? error.message : String(error);
export const loadTool = (file: string) => import(pathToFileURL(join(repository, "tools/personal-preview", file)).href);
const execute = promisify(execFile);
export const git = async (...args: string[]) => (await execute("git", ["-C", repository, ...args], { maxBuffer: 1024 * 1024, timeout: 2000 })).stdout.trim();
export const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function until<T>(read: () => Promise<T>, ready: (value: T) => boolean, signal: AbortSignal, timeout = 8_000): Promise<T> {
  const deadline = Date.now() + timeout;
  do { signal.throwIfAborted(); const value = await read(); if (ready(value)) return value; await delay(40); } while (Date.now() < deadline);
  throw Error("Fixture condition timed out");
}

/** The execution tree must retain the fixed backend/client/contracts/tool bytes. Test-only commits are allowed. */
export async function sourceIdentity() {
  const protectedPaths = ["apps/server", "packages/client", "packages/contracts", "tools/personal-preview", "pnpm-lock.yaml"];
  assert.equal(await git("diff", BACKEND, "--", ...protectedPaths), "", "Fixed input changed");
  const paths = ["apps/server/src/index.ts", "apps/server/src/context-transparency/store.ts", "packages/client/src/index.ts",
    "packages/client/src/conversation-acknowledgement.ts", "packages/contracts/src/conversation-context.ts",
    "tools/personal-preview/web-artifact.mjs", "tools/personal-preview/web-release.mjs", "tools/personal-preview/environment.mjs",
    "apps/web/test/web-current-preview.fixture.ts", "apps/web/test/web-current-preview.browser.ts"];
  return { head: await git("rev-parse", "HEAD"), backend: BACKEND, sourceTree: await git("rev-parse", `${BACKEND}^{tree}`),
    dirty: await git("status", "--porcelain"), files: await Promise.all(paths.map(async path => ({ path, sha256: sha(await readFile(join(repository, path))) }))) };
}

export type Wire = {
  method: string; path: string; status: number; key: string | null; body: string; responseBody: string | null; responseSha256: string | null;
  stream: string | null; forwardedStream: string | null; profile: string | null; dropped: boolean;
};
async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
  const address = server.address(); assert.ok(address && typeof address !== "string"); return address.port;
}
async function closeHttp(server: Server) {
  server.closeAllConnections();
  if (server.listening) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

/** Static bytes only: no Vite, release pointer, install, source copy, or fabricated compatibility record. */
async function previewHost(centerPort: number, signal: AbortSignal) {
  signal.throwIfAborted();
  const { verifyWebArtifact } = await loadTool("web-artifact.mjs");
  const { releaseAsset } = await loadTool("web-release.mjs");
  signal.throwIfAborted();
  const { dist, manifest } = await verifyWebArtifact({ directory: ARTIFACT_ROOT, artifact });
  signal.throwIfAborted();
  assert.equal(manifest.format, 2); assert.equal(manifest.releaseId, RELEASE_ID);
  type File = { path: string; bytes: number; sha256: string };
  const files = manifest.files as File[];
  const index = files.find(file => file.path === "index.html"); assert.ok(index);
  const snapshot = { index: { ...index, path: join(dist, index.path) }, assets: new Map(files.filter(file => file !== index)
    .map(file => [`/__flow_releases/${RELEASE_ID}/${file.path}`, { ...file, path: join(dist, file.path) }])) };
  const wire: Wire[] = []; const problems: string[] = []; let captureBytes = 0; let legacy = false; let drop: "turn" | "queue" | null = null;
  const upstreams = new Set<ReturnType<typeof requestHttp>>();
  const server = createHttpServer((request, response) => {
    void (async () => {
      const path = request.url ?? "/";
      if (!/^\/api(?:\/|$)/.test(path)) {
        if (request.method !== "GET" && request.method !== "HEAD") { response.writeHead(405).end(); return; }
        if (path === "/__flow_preview_identity") { response.setHeader("content-type", "application/json"); response.end(JSON.stringify(artifact)); return; }
        const file = await releaseAsset(snapshot, path.split("?")[0], request.headers.accept?.includes("text/html"));
        if (!file) { response.writeHead(404).end(); return; }
        const mime: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
        response.writeHead(200, { "content-type": mime[extname(file.path)] ?? "application/octet-stream", "cache-control": "no-store" });
        response.end(request.method === "HEAD" ? undefined : file.bytes); return;
      }
      const chunks: Buffer[] = []; let count = 0;
      for await (const chunk of request) { count += chunk.length; assert.ok(count <= 64 * 1024, "Request capture limit"); chunks.push(chunk); }
      assert.ok(wire.length < 1000 && captureBytes < 2 * 1024 * 1024, "Wire evidence limit");
      const body = Buffer.concat(chunks).toString("utf8"); const headers = { ...request.headers };
      if (legacy) delete headers["x-flow-assistant-stream"];
      const inject = request.method === "POST" && (drop === "turn" && /\/turns$/.test(path) || drop === "queue" && /\/queue$/.test(path));
      if (inject) drop = null;
      const upstream = requestHttp({ hostname: "127.0.0.1", port: centerPort, path, method: request.method, headers }, incoming => {
        const json = incoming.headers["content-type"]?.includes("application/json");
        const capture: Buffer[] = []; let received = 0;
        const dropped = inject && (incoming.statusCode ?? 500) >= 200 && (incoming.statusCode ?? 500) < 300;
        if (!dropped) response.writeHead(incoming.statusCode ?? 502, incoming.headers);
        incoming.on("data", (chunk: Buffer) => {
          if (json) { received += chunk.length; if (received <= 128 * 1024) capture.push(chunk); }
          // SSE is forwarded incrementally, never buffered behind end or a JSON timeout.
          if (!dropped) response.write(chunk);
        });
        incoming.on("end", () => {
          let responseBody = json && received <= 128 * 1024 ? Buffer.concat(capture).toString("utf8") : null;
          const responseSha256 = responseBody === null ? null : sha(responseBody);
          // Registration is the only response carrying an ephemeral credential. Never persist it.
          if (path === "/api/runners" && responseBody) {
            try { const registration = JSON.parse(responseBody); delete registration.token; responseBody = JSON.stringify(registration); }
            catch { responseBody = null; problems.push("Malformed runner registration JSON"); }
          }
          const record: Wire = { method: request.method ?? "GET", path, status: incoming.statusCode ?? 502, body, responseBody, responseSha256, dropped,
            key: request.headers["idempotency-key"] ? String(request.headers["idempotency-key"]) : null,
            stream: request.headers["x-flow-assistant-stream"] ? String(request.headers["x-flow-assistant-stream"]) : null,
            forwardedStream: headers["x-flow-assistant-stream"] ? String(headers["x-flow-assistant-stream"]) : null,
            profile: request.headers["x-flow-execution-profile"] ? String(request.headers["x-flow-execution-profile"]) : null };
          captureBytes += Buffer.byteLength(JSON.stringify(record));
          if (captureBytes > 2 * 1024 * 1024 || wire.length >= 1000) { problems.push("Wire evidence limit exceeded"); response.destroy(); return; }
          wire.push(record); if (dropped) response.destroy(); else response.end();
        });
        incoming.on("error", () => { if (!signal.aborted && !response.destroyed) problems.push(`Upstream response interrupted: ${path}`); response.destroy(); });
      });
      upstreams.add(upstream); upstream.once("close", () => upstreams.delete(upstream));
      upstream.on("error", () => { if (!response.destroyed && !signal.aborted) { problems.push(`Upstream request failed: ${path}`); response.writeHead(502).end(); } });
      response.on("close", () => upstream.destroy()); upstream.end(body);
    })().catch(error => { problems.push(failure(error)); if (!response.destroyed) response.writeHead(503).end(); });
  });
  signal.addEventListener("abort", () => { for (const upstream of upstreams) upstream.destroy(); server.closeAllConnections(); }, { once: true });
  try {
    signal.throwIfAborted();
    const port = await listen(server);
    signal.throwIfAborted();
    return { url: `http://127.0.0.1:${port}`, manifest, wire, problems, loseNext: (kind: "turn" | "queue") => { assert.equal(drop, null); drop = kind; },
      setLegacy: (value: boolean) => { legacy = value; }, close: async () => { for (const upstream of upstreams) upstream.destroy(); await closeHttp(server); } };
  } catch (error) { await closeHttp(server); throw error; }
}

export async function startCurrentPreview(databaseUrl: string, token: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const { createServer } = await import("../../server/src/index.js");
  signal.throwIfAborted();
  const app = await createServer({ databaseUrl, ownerToken: token, leaseMs: 300_000 });
  let preview: Awaited<ReturnType<typeof previewHost>> | undefined;
  try {
    signal.throwIfAborted(); await app.listen({ host: "127.0.0.1", port: 0 });
    signal.throwIfAborted();
    const address = app.server.address(); assert.ok(address && typeof address !== "string");
    preview = await previewHost(address.port, signal);
    signal.throwIfAborted();
    const owner = new FlowClient({ baseUrl: preview.url, token });
    return { ...preview, owner, token, async close() {
      const errors: string[] = [];
      try { await preview?.close(); } catch (error) { errors.push(failure(error)); }
      try { await app.close(); } catch (error) { errors.push(failure(error)); }
      assert.deepEqual(errors, [], "Owned factory/HTTP cleanup failed");
    } };
  } catch (error) { await preview?.close(); await app.close(); throw error; }
}
export type CurrentPreview = Awaited<ReturnType<typeof startCurrentPreview>>;

export async function syntheticRunner(fixture: CurrentPreview, label: string, signal: AbortSignal) {
  const registration = await fixture.owner.registerRunner({ name: `RELEASE03 ${label}`, harnesses: ["claude"], capacity: 1 });
  const client = new FlowClient({ baseUrl: fixture.url, token: registration.token });
  const configuration = { harness: "claude", adapterVersion: CLAUDE_CONTEXT_SOURCE.adapterVersion, model: `release-synthetic-${label}`,
    thinking: "disabled", permissionMode: "dontAsk", access: "none", requireReadApproval: false, materialScopeDigest: sha("[]"),
    limits: { maxTurns: 2, maxBudgetUsd: 0.2, timeoutMs: 60_000 } } as const;
  const { profile } = await client.publishExecutionProfile({ configuration }, signal);
  const claim = async (taskId: string) => {
    const result = await until(() => client.claim(signal), value => value.assignment !== null, signal);
    assert.ok(result.assignment); assert.equal(result.assignment.task.id, taskId); return result.assignment;
  };
  const report = (assignment: ClaimedTask, sequence: number, data: RunnerEventData) => client.report({ attemptId: assignment.attempt.id,
    ownerVersion: assignment.attempt.ownerVersion, events: [{ ...data, id: randomUUID(), sequence }] }, signal);
  return { client, profile, configuration, claim, report };
}

export async function createMaterials(fixture: CurrentPreview, title: string, signal: AbortSignal) {
  const { snapshot: { project } } = await fixture.owner.createProject({ workspaceId: "personal", title }, randomUUID(), signal);
  const capabilities = await fixture.owner.attachmentCapabilities(project.id, signal);
  const text = `PRIVATE_ATTACHMENT_${title}_資料🙂`;
  const accepted = await fixture.owner.uploadAttachment(project.id, { recoveryScopeId: capabilities.recoveryScopeId,
    name: "existing.txt", mediaType: "text/plain", text, byteLength: Buffer.byteLength(text), contentDigest: sha(text) }, randomUUID(), signal);
  return { projectId: project.id, text, resource: accepted.resource, ref: accepted.resource.reference };
}

/** Each case is independent. Failure remains a release blocker even if later App checks pass. */
export async function checkHistory(fixture: CurrentPreview, mixed: boolean, signal: AbortSignal) {
  const start = fixture.wire.length; const label = mixed ? "mixed" : "attachment-only";
  const facts: Record<string, unknown> = { label, backend: BACKEND, providerQueries: 0 };
  try {
    const runner = await syntheticRunner(fixture, label, signal);
    const materials = await createMaterials(fixture, label, signal);
    const knowledgeText = "PRIVATE_KNOWLEDGE_資料🙂";
    const source = mixed ? await fixture.owner.createKnowledgeSource(materials.projectId, { expectedVersion: 0, title: "Frozen knowledge", text: knowledgeText }, randomUUID(), signal) : null;
    const knowledge = source ? [{ projectId: materials.projectId, sourceId: source.source.id, version: 1, contentDigest: sha(knowledgeText),
      locator: { kind: "utf8-bytes" as const, start: 0, end: Buffer.byteLength(knowledgeText) } }] : undefined;
    const created = await fixture.owner.createConversation(conversationCreationSchema.parse({ title: label, projectId: materials.projectId,
      executionProfile: runner.profile.reference }), randomUUID(), signal);
    const accepted = await fixture.owner.submitConversationTurn(created.conversation.id, conversationTurnSchema.parse({ expectedRevision: 0,
      text: `Use ${label} materials`, attachments: [materials.ref], ...(knowledge ? { knowledge } : {}) }), randomUUID(), signal);
    const context = accepted.turn.context; assert.ok(context && context.templateVersion === 2);
    const assignment = await runner.claim(accepted.turn.task.id); const nativeSessionId = randomUUID();
    Object.assign(facts, { conversationId: created.conversation.id, taskId: assignment.task.id, attemptId: assignment.attempt.id, context: accepted.turn.context });
    assert.equal(assignment.conversationContext?.executionInputDigest, context.executionInputDigest);
    assert.ok(assignment.task.prompt.includes(materials.text)); if (mixed) assert.ok(assignment.task.prompt.includes(knowledgeText));
    await runner.report(assignment, 1, { type: "session", nativeSessionId, adapterVersion: CLAUDE_CONTEXT_SOURCE.adapterVersion });
    try {
      facts.report = await runner.report(assignment, 2, { type: "context-observation", observation: { source: CLAUDE_CONTEXT_SOURCE,
        observationId: randomUUID(), observedAt: new Date().toISOString(), nativeSessionId, resolvedModel: "synthetic-resolved-model",
        used: 123, compactionWindow: 1000, categories: [{ kind: "used", tokens: 123 }] } });
    } catch (error) { facts.reportError = failure(error); }
    // Read even when reportEvents failed, preserving both HTTP outcomes and the actual task.
    const history = await fixture.owner.contextHistory(assignment.task.id, signal); facts.history = history;
    facts.task = await fixture.owner.show(assignment.task.id, signal);
    const detail = await fixture.owner.conversationContext(created.conversation.id, context.id, signal);
    assert.ok("attachments" in detail); assert.equal(detail.attachments[0]?.text, materials.text);
    if (mixed) assert.equal(detail.sources[0]?.text, knowledgeText);
    assert.equal(facts.reportError, undefined, "Actual reportEvents rejected the native observation");
    assert.equal(JSON.stringify(history).includes("PRIVATE_"), false);
    assert.ok(history.latest); assert.deepEqual(history.latest.materials, { state: "unknown", reason: "metadata-unavailable" });
    assert.equal(history.latest.observation.identity.materialRevisionDigest, null);
    assert.equal(history.latest.observation.identity.executionInputDigest, context.executionInputDigest);
    return { ...facts, passed: true, wireRange: [start, fixture.wire.length] };
  } catch (error) { return { ...facts, passed: false, error: failure(error), wireRange: [start, fixture.wire.length] }; }
}
